// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P24 S03 四条内政写链迁移浏览器验收。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P24 Headless：未找到 Chrome page target');
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
  const snapshot = (game) => JSON.stringify({ cities: game.cities, log: game.actionLog, rng: game.rng });
  const right = byId('right-panel');
  const civilSection = [...right.querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith('内政操作'));
  if (!civilSection) throw new Error('右栏内政操作入口缺失');
  civilSection.click();
  await pause();

  const oldS03 = document.querySelectorAll(
    '[data-testid="btn-develop-farm"], [data-testid="btn-develop-commerce"], '
    + '[data-testid="btn-develop-wall"], [data-testid="btn-relief"]',
  ).length;
  const oldSeek = document.querySelectorAll('[data-testid="btn-seek-beauty"]').length;
  if (oldS03 !== 0) throw new Error('右栏 S03 旧写按钮仍存在');
  if (oldSeek !== 1) throw new Error('S09 寻访未按边界保留');

  await click('command-domain-civil');
  const selector = byId('command-civil-city-select');
  const cityId = Number(selector?.value);
  if (!cityId) throw new Error('内政城市选择器缺失');
  const initial = await state();

  await click('command-civil-facet-industry');
  const beforeCancel = await state();
  await click('command-civil-farm');
  if (!byId('command-confirm-dialog')) throw new Error('农业开发未进入统一终审');
  await click('command-confirm-cancel');
  if (snapshot(beforeCancel) !== snapshot(await state())) throw new Error('取消农业开发后权威状态变化');

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

  const a = initial.cities[cityId];
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
    oldS03Buttons: oldS03,
    retainedS09SeekButtons: oldSeek,
    newS03WriteButtons: document.querySelectorAll('[data-command-write="true"]').length,
    cancelUnchanged: true,
    farmGain,
    commerceGain,
    wallGain,
    moraleGain,
    consoleDialogs: 4,
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P24 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
