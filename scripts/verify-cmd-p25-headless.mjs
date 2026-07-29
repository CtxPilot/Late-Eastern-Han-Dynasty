// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P25 S09 跨系统寻访与内政原子切换浏览器验收。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P25 Headless：未找到 Chrome page target');
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
  if (!response.ok) throw new Error(await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1400));
const result = await evaluate(`
  const pause = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
  const byId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const click = async (id, ms = 250) => {
    const el = byId(id);
    if (!el || el.disabled) throw new Error('缺少或不可用元素 ' + id);
    el.click();
    await pause(ms);
  };
  const state = async () => (await fetch('/api/game/state')).json();
  const snapshot = (game) => JSON.stringify({
    cities: game.cities, factions: game.factions, log: game.actionLog, rng: game.rng,
  });

  const oldWrites = document.querySelectorAll(
    '[data-testid="btn-develop-farm"], [data-testid="btn-develop-commerce"], '
    + '[data-testid="btn-develop-wall"], [data-testid="btn-relief"], '
    + '[data-testid="btn-seek-beauty"]',
  ).length;
  if (oldWrites !== 0) throw new Error('右栏旧内政/寻访写按钮仍存在');

  await click('command-domain-civil');
  const selector = byId('command-civil-city-select');
  const cityId = Number(selector?.value);
  if (!cityId) throw new Error('内政城市选择器缺失');
  if (!byId('command-civil-s09-card')) throw new Error('S09 宫廷人脉跨系统卡片缺失');
  const s09CrossSystemCards = document.querySelectorAll('[data-testid="command-civil-s09-card"]').length;
  if (document.querySelectorAll('[data-testid="command-civil-seek-beauty"]').length !== 1) {
    throw new Error('S09 寻访入口不唯一');
  }
  const initial = await state();

  const beforeSeekCancel = await state();
  await click('command-civil-seek-beauty');
  if (!byId('command-confirm-dialog')) throw new Error('寻访未进入统一终审');
  await click('command-confirm-cancel');
  if (snapshot(beforeSeekCancel) !== snapshot(await state())) throw new Error('取消寻访后权威状态变化');

  await click('command-civil-seek-beauty');
  await click('command-confirm-submit', 550);
  const afterSeek = await state();
  const seekBefore = initial.cities[cityId];
  const seekAfter = afterSeek.cities[cityId];
  const stockBefore = initial.factions[initial.playerFactionId].beautyStock;
  const stockAfter = afterSeek.factions[afterSeek.playerFactionId].beautyStock;
  if (seekBefore.gold - seekAfter.gold !== 60) throw new Error('寻访未正确扣除60金');
  const stockGain = stockAfter - stockBefore;
  const seekUsed = seekBefore.beautySeekLeft - seekAfter.beautySeekLeft;
  if (!((stockGain === 1 && seekUsed === 1) || (stockGain === 0 && seekUsed === 0))) {
    throw new Error('寻访成功/失败的库存与次数结算不一致');
  }
  if (!afterSeek.actionLog.some((entry) => entry.type === 'beauty_seek')) {
    throw new Error('寻访行动日志缺失');
  }

  await click('command-civil-facet-industry');
  const beforeFarmCancel = await state();
  await click('command-civil-farm');
  await click('command-confirm-cancel');
  if (snapshot(beforeFarmCancel) !== snapshot(await state())) throw new Error('取消农业开发后权威状态变化');
  await click('command-civil-farm');
  await click('command-confirm-submit', 550);
  const afterFarm = await state();

  await click('command-civil-commerce');
  await click('command-confirm-submit', 550);
  const afterCommerce = await state();
  await click('command-civil-facet-construction');
  await click('command-civil-wall');
  await click('command-confirm-submit', 550);
  const afterWall = await state();
  await click('command-civil-facet-relief');
  await click('command-civil-relief');
  await click('command-confirm-submit', 550);
  const afterRelief = await state();

  const a = afterSeek.cities[cityId];
  const b = afterFarm.cities[cityId];
  const c = afterCommerce.cities[cityId];
  const d = afterWall.cities[cityId];
  const e = afterRelief.cities[cityId];
  const farmGain = b.stats.farm - a.stats.farm;
  const commerceGain = c.stats.commerce - b.stats.commerce;
  const wallGain = d.stats.wall - c.stats.wall;
  const moraleGain = e.stats.morale - d.stats.morale;
  if (farmGain < 20 || farmGain > 30 || a.gold - b.gold !== 100) throw new Error('农业结算错误');
  if (commerceGain < 18 || commerceGain > 28 || b.gold - c.gold !== 100) throw new Error('商业结算错误');
  if (wallGain < 15 || wallGain > 25 || c.gold - d.gold !== 120) throw new Error('城防结算错误');
  if (moraleGain < 0 || moraleGain > 12 || d.food - e.food !== 150) throw new Error('施米结算错误');
  for (const type of ['develop_farm', 'develop_commerce', 'develop_wall', 'relief']) {
    if (!afterRelief.actionLog.some((entry) => entry.type === type)) throw new Error('行动日志缺失：' + type);
  }
  return {
    viewport: [innerWidth, innerHeight],
    city: e.name,
    oldWriteButtons: oldWrites,
    s09CrossSystemCards,
    seekCancelUnchanged: true,
    farmCancelUnchanged: true,
    seekResult: stockGain === 1 ? 'success' : 'failure',
    seekGoldCost: seekBefore.gold - seekAfter.gold,
    stockGain,
    seekUsed,
    farmGain,
    commerceGain,
    wallGain,
    moraleGain,
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P25 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
