// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P18 Campaign Army 唯一玩家编成入口浏览器验收。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P18 Headless：未找到 Chrome page target');

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
  const sectionButton = (text, root = document) => [...root.querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith(text));
  const state = async () => {
    const response = await fetch('/api/game/state');
    if (!response.ok) throw new Error('读取权威状态失败：' + await response.text());
    return response.json();
  };
  const setSelect = (element, value) => {
    element.value = String(value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const snapshot = (game) => JSON.stringify({
    cities: game.cities,
    officers: game.officers,
    campaignArmies: game.campaignArmies,
    actionLog: game.actionLog,
    rng: game.rng,
  });

  const initial = await state();
  const fromCity = Object.values(initial.cities)
    .filter((city) => city.ruler === initial.playerFactionId && city.troops >= 5000 && city.food >= 1500)
    .find((city) => {
      const node = initial.campaignNodes.find((item) => item.id === city.id);
      const hasTarget = node?.adjacentNodeIds.some((id) => initial.cities[id]?.ruler !== initial.playerFactionId);
      const hasOfficer = Object.values(initial.officers).some(
        (officer) => officer.faction === initial.playerFactionId
          && officer.location === city.id && officer.status === 'active',
      );
      return hasTarget && hasOfficer;
    });
  if (!fromCity) throw new Error('找不到满足 P18 验收的出发城');
  const node = initial.campaignNodes.find((item) => item.id === fromCity.id);
  const target = node.adjacentNodeIds.map((id) => initial.cities[id])
    .find((city) => city && city.ruler !== initial.playerFactionId);
  const commander = Object.values(initial.officers).find(
    (officer) => officer.faction === initial.playerFactionId
      && officer.location === fromCity.id && officer.status === 'active',
  );
  if (!target || !commander) throw new Error('编成候选不完整');

  if (document.querySelectorAll('[data-testid="btn-march"]').length !== 0) {
    throw new Error('右侧简化出征按钮仍存在');
  }
  const left = byTestId('left-panel');
  const campaignSection = sectionButton('战役', left);
  if (!campaignSection) throw new Error('左栏战役入口缺失');
  campaignSection.click();
  await pause();
  if (left.innerText.includes('出征编成')) throw new Error('左栏旧编成表单仍存在');
  const legacyStartCount = [...left.querySelectorAll('button')]
    .filter((button) => button.innerText.trim() === '出征').length;
  if (legacyStartCount !== 0) throw new Error('左栏旧出征提交按钮仍存在');
  if (!left.innerText.includes('我军（')) throw new Error('P19 前应保留左栏军团列表与军令');

  byTestId('command-domain-military').click();
  await pause();
  byTestId('command-military-facet-formation').click();
  await pause();
  const form = byTestId('command-military-formation-form');
  if (!form) throw new Error('命令坞军事编成表单缺失');
  const uniqueStartCount = [...document.querySelectorAll('button')]
    .filter((button) => button.innerText.trim() === '编成出征').length;
  if (uniqueStartCount !== 1) throw new Error('编成出征玩家入口不唯一：' + uniqueStartCount);

  setSelect(byTestId('command-military-from-city'), fromCity.id);
  await pause();
  setSelect(byTestId('command-military-commander'), commander.id);
  setSelect(byTestId('command-military-target-city'), target.id);
  await pause();
  const start = byTestId('command-military-start');
  if (!start || start.disabled) throw new Error('新编成出征按钮缺失或禁用');
  const draftBeforeCancel = {
    from: byTestId('command-military-from-city').value,
    commander: byTestId('command-military-commander').value,
    target: byTestId('command-military-target-city').value,
  };
  const beforeCancel = await state();
  start.click();
  await pause();
  byTestId('command-confirm-cancel')?.click();
  await pause();
  const afterCancel = await state();
  if (snapshot(beforeCancel) !== snapshot(afterCancel)) throw new Error('取消终审后权威状态发生变化');
  const draftAfterCancel = {
    from: byTestId('command-military-from-city').value,
    commander: byTestId('command-military-commander').value,
    target: byTestId('command-military-target-city').value,
  };
  if (JSON.stringify(draftBeforeCancel) !== JSON.stringify(draftAfterCancel)) {
    throw new Error('取消终审后编成草稿未保留');
  }

  byTestId('command-military-start').click();
  await pause();
  const submit = byTestId('command-confirm-submit');
  if (!submit || submit.disabled) throw new Error('新编成终审无法提交');
  submit.click();
  await pause(800);
  const afterConfirm = await state();
  const created = afterConfirm.campaignArmies.find(
    (army) => !beforeCancel.campaignArmies.some((old) => old.id === army.id),
  );
  if (!created) throw new Error('确认后未生成 Campaign Army');
  if (created.fromNodeId !== fromCity.id || created.targetNodeId !== target.id) {
    throw new Error('Campaign Army 出发地或目标错误');
  }
  const troopDelta = beforeCancel.cities[fromCity.id].troops - afterConfirm.cities[fromCity.id].troops;
  const foodDelta = beforeCancel.cities[fromCity.id].food - afterConfirm.cities[fromCity.id].food;
  if (troopDelta !== 5000 || foodDelta !== 1500) throw new Error('出发城兵粮扣减错误');
  if (!afterConfirm.actionLog.some((entry) => entry.type === 'campaign_start')) {
    throw new Error('缺少 campaign_start 行动日志');
  }
  if (!byTestId('command-military-army-' + created.id)) {
    throw new Error('创建后编成摘要未即时同步');
  }

  return {
    viewport: [innerWidth, innerHeight],
    rightMarchButtons: document.querySelectorAll('[data-testid="btn-march"]').length,
    legacyStartCount,
    uniqueStartCount,
    cancelStateUnchanged: true,
    cancelDraftRetained: true,
    armyCreated: created.name,
    troopDelta,
    foodDelta,
    campaignLog: true,
    legacyArmyCommandsRetained: true,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P18 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
