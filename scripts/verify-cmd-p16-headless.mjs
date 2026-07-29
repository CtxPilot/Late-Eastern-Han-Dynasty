// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P16 军事迁移前浏览器基线。
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --window-size=1440,900 \
 *     --remote-debugging-port=9238 http://127.0.0.1:5173
 *
 * Optional:
 *   CDP_PORT=9238 node scripts/verify-cmd-p16-headless.mjs
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P16 Headless：未找到 Chrome page target');

const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const consoleErrors = [];
let nextId = 0;

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
  }
  pending.get(message.id)?.(message);
};
await new Promise((resolve) => { ws.onopen = resolve; });

function command(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', {
    expression: `(async()=>{${expression}})()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.result?.exceptionDetails) {
    throw new Error(result.result.exceptionDetails.exception?.description ?? result.result.exceptionDetails.text);
  }
  return result.result.result.value;
}

await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error('创建英雄集结曹操局失败：' + await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1400));

const result = await evaluate(`
  const pause = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const exactButton = (text, root = document) => [...root.querySelectorAll('button')]
    .find((button) => button.innerText.trim() === text);
  const sectionButton = (text, root = document) => [...root.querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith(text));
  const state = async () => {
    const response = await fetch('/api/game/state');
    if (!response.ok) throw new Error('读取权威状态失败：' + await response.text());
    return response.json();
  };
  const snapshot = (game) => JSON.stringify({
    cities: game.cities,
    officers: game.officers,
    campaignArmies: game.campaignArmies,
    actionLog: game.actionLog,
    rng: game.rng,
  });

  const militaryDomain = byTestId('command-domain-military');
  if (!militaryDomain) throw new Error('命令坞军事按钮缺失');
  militaryDomain.click();
  await pause();
  const shell = byTestId('command-shell');
  if (!shell || !shell.innerText.includes('仍在战役与城池面板')) {
    throw new Error('军事占位未诚实说明旧入口');
  }
  const commandMilitarySubmitCount = [...shell.querySelectorAll('button')]
    .filter((button) => /出征|征兵|训练|强攻|劝降|撤退/.test(button.innerText)).length;
  if (commandMilitarySubmitCount !== 0) {
    throw new Error('CMD-P16 不应提前出现军事写按钮');
  }
  militaryDomain.click();
  await pause();

  const initial = await state();
  const playerCities = Object.values(initial.cities).filter(
    (city) => city.ruler === initial.playerFactionId && city.troops >= 3000 && city.food >= 2000,
  );
  const fromCity = playerCities.find((city) => {
    const node = initial.campaignNodes.find((item) => item.id === city.id);
    return node?.adjacentNodeIds.some((id) => initial.cities[id]?.ruler !== initial.playerFactionId);
  });
  if (!fromCity) throw new Error('找不到可建立战役基线的己方出发城');

  const left = byTestId('left-panel');
  if (!left) throw new Error('左栏缺失');
  const citiesSection = sectionButton('己方城池', left);
  if (!citiesSection) throw new Error('己方城池手风琴缺失');
  citiesSection.click();
  await pause();
  const cityButton = [...left.querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith(fromCity.name));
  if (!cityButton) throw new Error('己方城池列表缺少 ' + fromCity.name);
  cityButton.click();
  await pause();
  const campaignSection = sectionButton('战役', left);
  if (!campaignSection) throw new Error('战役手风琴缺失');
  campaignSection.click();
  await pause();

  const campaignText = left.innerText;
  if (!campaignText.includes('出征编成') || !campaignText.includes('我军（')) {
    throw new Error('旧战役编成或军队列表缺失');
  }
  const selects = [...left.querySelectorAll('select')];
  if (selects.length < 5) throw new Error('战役编成字段不完整');
  const chooseFirstEnabled = (select) => {
    const option = [...select.options].find((item) => item.value && !item.disabled);
    if (!option) throw new Error('战役编成下拉无可用候选');
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  chooseFirstEnabled(selects[0]);
  chooseFirstEnabled(selects[2]);
  await pause();

  const start = exactButton('出征', left);
  if (!start || start.disabled) throw new Error('旧战役出征按钮缺失或禁用');
  const beforeCancel = await state();
  start.click();
  await pause();
  const cancel = byTestId('command-confirm-cancel');
  if (!cancel) throw new Error('战役出征终审取消按钮缺失');
  cancel.click();
  await pause();
  const afterCancel = await state();
  if (snapshot(beforeCancel) !== snapshot(afterCancel)) {
    throw new Error('取消战役出征后权威状态发生变化');
  }

  exactButton('出征', left)?.click();
  await pause();
  const submit = byTestId('command-confirm-submit');
  if (!submit || submit.disabled) throw new Error('战役出征终审提交按钮缺失或禁用');
  submit.click();
  await pause(750);
  const afterConfirm = await state();
  const newArmy = afterConfirm.campaignArmies.find(
    (army) => !beforeCancel.campaignArmies.some((old) => old.id === army.id),
  );
  if (!newArmy) throw new Error('确认战役出征后未生成 Campaign Army');
  if (newArmy.fromNodeId !== fromCity.id || newArmy.factionId !== initial.playerFactionId) {
    throw new Error('新战役军队的出发地或归属错误');
  }
  if ((afterConfirm.cities[fromCity.id]?.troops ?? Infinity) >= beforeCancel.cities[fromCity.id].troops) {
    throw new Error('确认战役出征后出发城兵力未扣减');
  }
  if (!afterConfirm.actionLog.some((entry) => entry.type === 'campaign_start')) {
    throw new Error('确认战役出征后缺少 campaign_start 日志');
  }

  return {
    viewport: [innerWidth, innerHeight],
    commandMilitarySubmitCount,
    legacyCampaignEntryCount: [...left.querySelectorAll('button')]
      .filter((button) => button.innerText.trim().startsWith('战役')).length,
    rightMilitaryEntryCount: [...document.querySelectorAll('button')]
      .filter((button) => button.innerText.trim().startsWith('军事操作')).length,
    fromCity: fromCity.name,
    cancelUnchanged: true,
    armyCreated: newArmy.name,
    troopDelta: beforeCancel.cities[fromCity.id].troops - afterConfirm.cities[fromCity.id].troops,
    actionLogType: afterConfirm.actionLog.find((entry) => entry.type === 'campaign_start')?.type,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P16 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
