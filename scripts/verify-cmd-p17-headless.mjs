// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P17 军事只读军情浏览器验收。
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --window-size=1440,900 \
 *     --remote-debugging-port=9238 http://127.0.0.1:5173
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P17 Headless：未找到 Chrome page target');

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
  const writeButtonCount = (root) => [...root.querySelectorAll('button')]
    .filter((button) => /^(征兵|训练|出征|出征攻城|强攻|劝降|撤退|激励|陷阱|休整|斥候|建造)$/.test(button.innerText.trim()))
    .length;

  const initial = await state();
  const playerCities = Object.values(initial.cities).filter((city) => city.ruler === initial.playerFactionId);
  const expectedTotalTroops = playerCities.reduce((sum, city) => sum + city.troops, 0);

  byTestId('command-domain-military')?.click();
  await pause();
  let drawer = byTestId('command-military-drawer');
  if (!drawer) throw new Error('军事只读抽屉缺失');
  const facetIds = ['readiness', 'formation', 'orders', 'reports'];
  for (const facet of facetIds) {
    const button = byTestId('command-military-facet-' + facet);
    if (!button) throw new Error('军事分面缺失：' + facet);
    button.click();
    await pause();
    if (!byTestId('command-military-' + facet)) throw new Error('军事分面内容缺失：' + facet);
  }
  byTestId('command-military-facet-readiness').click();
  await pause();
  drawer = byTestId('command-military-drawer');
  const initialWriteButtons = writeButtonCount(drawer);
  if (initialWriteButtons !== 0) throw new Error('新军事抽屉不应包含写按钮');
  const citySummaryCount = drawer.querySelectorAll('[data-testid^="command-military-city-"]').length;
  if (citySummaryCount !== playerCities.length) {
    throw new Error('军备城池数与权威己方城数不一致');
  }
  if (!drawer.innerText.includes(expectedTotalTroops.toLocaleString('zh-CN'))) {
    throw new Error('军备总兵力未读取权威状态');
  }
  byTestId('command-drawer-close')?.click();
  await pause();

  const fromCity = playerCities
    .filter((city) => city.troops >= 3000 && city.food >= 2000)
    .find((city) => {
      const node = initial.campaignNodes.find((item) => item.id === city.id);
      return node?.adjacentNodeIds.some((id) => initial.cities[id]?.ruler !== initial.playerFactionId);
    });
  if (!fromCity) throw new Error('找不到可建立战役同源验证的己方城');
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
  const selects = [...left.querySelectorAll('select')];
  if (selects.length < 5) throw new Error('旧战役编成字段不完整');
  const chooseFirst = (select) => {
    const option = [...select.options].find((item) => item.value && !item.disabled);
    if (!option) throw new Error('旧战役编成无可用候选');
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  chooseFirst(selects[0]);
  chooseFirst(selects[2]);
  await pause();
  const start = exactButton('出征', left);
  if (!start || start.disabled) throw new Error('旧战役出征按钮缺失或禁用');
  start.click();
  await pause();
  const submit = byTestId('command-confirm-submit');
  if (!submit || submit.disabled) throw new Error('旧战役出征终审无法提交');
  submit.click();
  await pause(750);
  const after = await state();
  const created = after.campaignArmies.find(
    (army) => !initial.campaignArmies.some((old) => old.id === army.id),
  );
  if (!created) throw new Error('旧战役确认后未生成 Campaign Army');

  byTestId('command-domain-military')?.click();
  await pause();
  byTestId('command-military-facet-formation')?.click();
  await pause();
  if (!byTestId('command-military-army-' + created.id)) {
    throw new Error('新编成摘要未即时读取旧入口生成的 Army');
  }
  byTestId('command-military-facet-orders')?.click();
  await pause();
  const orders = byTestId('command-military-orders');
  if (!orders?.innerText.includes(created.name) || !orders.innerText.includes(created.troops)) {
    throw new Error('新军令摘要未显示权威 Army');
  }
  byTestId('command-military-facet-reports')?.click();
  await pause();
  const reports = byTestId('command-military-reports');
  if (!reports?.innerText.includes('出征')) throw new Error('新战报摘要未读取 campaign_start 日志');
  const finalWriteButtons = writeButtonCount(byTestId('command-military-drawer'));
  if (finalWriteButtons !== 0) throw new Error('Army 创建后新抽屉出现写按钮');

  return {
    viewport: [innerWidth, innerHeight],
    facets: facetIds.length,
    citySummaryCount,
    initialWriteButtons,
    oldCampaignEntryCount: [...left.querySelectorAll('button')]
      .filter((button) => button.innerText.trim().startsWith('战役')).length,
    armyCreatedFromLegacy: created.name,
    formationSynced: true,
    ordersSynced: true,
    reportsSynced: true,
    finalWriteButtons,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P17 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
