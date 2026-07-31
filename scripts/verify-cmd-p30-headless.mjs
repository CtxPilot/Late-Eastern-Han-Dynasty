// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P30 情报迁移前浏览器基线。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P30 Headless：未找到 Chrome page target');

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
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
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
  const pause = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
  const byId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const click = async (id, ms = 350) => {
    const element = byId(id);
    if (!element) throw new Error('缺少元素 ' + id);
    if (element.disabled) throw new Error('元素不可用 ' + id);
    element.click();
    await pause(ms);
  };
  const state = async () => (await fetch('/api/game/state')).json();

  const intelButton = [...byId('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith('谍报'));
  if (!intelButton) throw new Error('旧谍报入口缺失');
  intelButton.click();
  await pause();
  if (document.querySelectorAll('[data-testid="spy-panel"]').length !== 1) {
    throw new Error('旧 SpyPanel 应恰好存在1个');
  }
  const legacyWrites = {
    recruit: document.querySelectorAll('[data-testid="btn-spy-recruit"]').length,
    trainFemale: document.querySelectorAll('[data-testid="btn-spy-train-female"]').length,
    plantFemale: document.querySelectorAll('[data-testid="intel-plant-female"]').length,
    mission: document.querySelectorAll('[data-testid="btn-spy-mission"]').length,
  };
  if (Object.values(legacyWrites).some((count) => count !== 1)) {
    throw new Error('旧情报核心写入口数量异常：' + JSON.stringify(legacyWrites));
  }

  await click('command-domain-intel');
  const commandDrawer = byId('command-drawer');
  const newWriteCount = commandDrawer.querySelectorAll('[data-command-write="true"]').length;
  if (newWriteCount !== 0) throw new Error('P30 命令坞情报不应出现新写入口');
  if (!commandDrawer.innerText.includes('仍在左侧谍报面板')) {
    throw new Error('命令坞情报未指明迁移期权威入口');
  }

  await click('command-domain-intel');
  const before = await state();
  const capitalId = before.factions[before.playerFactionId].capitalCityId;
  const beforeCity = before.cities[capitalId];
  const beforeAgents = Object.values(before.intel.agents)
    .filter((agent) => agent.factionId === before.playerFactionId).length;
  await click('btn-spy-recruit');
  await click('command-confirm-cancel');
  const afterCancel = await state();
  if (afterCancel.cities[capitalId].gold !== beforeCity.gold
    || afterCancel.cities[capitalId].food !== beforeCity.food
    || Object.keys(afterCancel.intel.agents).length !== Object.keys(before.intel.agents).length) {
    throw new Error('取消招募却改变权威状态');
  }
  await click('btn-spy-recruit');
  await click('command-confirm-submit', 650);
  const after = await state();
  const afterAgents = Object.values(after.intel.agents)
    .filter((agent) => agent.factionId === after.playerFactionId).length;
  const recruited = afterAgents - beforeAgents;
  if (recruited < 1 || recruited > 3) throw new Error('招募人数不在1～3范围');
  if (beforeCity.gold - after.cities[capitalId].gold !== recruited * 120) {
    throw new Error('招募扣金与人数不匹配');
  }
  if (beforeCity.food - after.cities[capitalId].food !== recruited * 60) {
    throw new Error('招募扣粮与人数不匹配');
  }
  if (after.actionLog[0]?.type !== 'spy_recruit') throw new Error('未写 spy_recruit 行动日志');

  return {
    viewport: [innerWidth, innerHeight],
    legacyPanel: 1,
    legacyWrites,
    newWriteCount,
    cancelPreservedState: true,
    recruited,
    goldCost: beforeCity.gold - after.cities[capitalId].gold,
    foodCost: beforeCity.food - after.cities[capitalId].food,
    actionLog: after.actionLog[0].type,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P30 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
