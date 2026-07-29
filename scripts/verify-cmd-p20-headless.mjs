// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P20 征兵/训练军备唯一入口浏览器验收。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P20 Headless：未找到 Chrome page target');
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
  if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.exception?.description ?? result.result.exceptionDetails.text);
  return result.result.result.value;
}
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1400));
const result = await evaluate(`
  const pause = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
  const byId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const click = async (id, ms = 250) => { const el = byId(id); if (!el) throw new Error('缺少元素 ' + id); el.click(); await pause(ms); };
  const state = async () => (await fetch('/api/game/state')).json();
  const snapshot = (game) => JSON.stringify({ cities: game.cities, log: game.actionLog, rng: game.rng });
  const initial = await state();

  const rightOldButtons = document.querySelectorAll('[data-testid="btn-conscript"], [data-testid="btn-train"]').length;
  if (rightOldButtons !== 0) throw new Error('右栏旧征兵/训练按钮仍存在');
  await click('command-domain-military');
  const citySelect = byId('command-military-readiness-city');
  if (!citySelect) throw new Error('军事军备城市选择器缺失');
  const cityId = Number(citySelect.value);
  const beforeCancel = await state();
  await click('military-readiness-conscript');
  if (!byId('command-confirm-dialog')) throw new Error('征兵未进入统一终审');
  await click('command-confirm-cancel');
  const afterCancel = await state();
  if (snapshot(beforeCancel) !== snapshot(afterCancel)) throw new Error('取消征兵后权威状态变化');

  await click('military-readiness-conscript');
  await click('command-confirm-submit', 600);
  const afterConscript = await state();
  const conscripted = afterConscript.cities[cityId];
  const beforeCity = beforeCancel.cities[cityId];
  const troopGain = conscripted.troops - beforeCity.troops;
  const maleDelta = beforeCity.demographics.adultMale - conscripted.demographics.adultMale;
  if (troopGain < 300 || troopGain > 500 || maleDelta !== troopGain) throw new Error('征兵兵力/成年男丁结算错误');
  if (beforeCity.gold - conscripted.gold !== 80 || beforeCity.food - conscripted.food !== 120) throw new Error('征兵资源消耗错误');

  await click('military-readiness-train');
  if (!byId('command-confirm-dialog')) throw new Error('训练未进入统一终审');
  await click('command-confirm-submit', 600);
  const afterTrain = await state();
  const trained = afterTrain.cities[cityId];
  const moraleGain = trained.troopsMorale - conscripted.troopsMorale;
  if (moraleGain < 5 || moraleGain > 10 || conscripted.food - trained.food !== 60) throw new Error('训练士气/粮耗结算错误');
  if (!afterTrain.actionLog.some((entry) => entry.type === 'conscript') || !afterTrain.actionLog.some((entry) => entry.type === 'train')) throw new Error('军备行动日志缺失');

  return {
    viewport: [innerWidth, innerHeight],
    city: trained.name,
    rightOldButtons,
    conscriptCancelUnchanged: true,
    troopGain,
    maleDelta,
    conscriptGoldCost: 80,
    conscriptFoodCost: 120,
    moraleGain,
    trainFoodCost: 60,
    uniqueReadinessEntry: 1,
  };
`);
await ws.close();
if (consoleErrors.length > 0) throw new Error(`CMD-P20 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
