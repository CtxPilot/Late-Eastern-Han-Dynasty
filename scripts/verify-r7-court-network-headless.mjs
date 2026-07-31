// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** R7 S09 宫廷人脉字段、文案与地方结交浏览器验收。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('R7 Headless：未找到 Chrome page target');
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
  const initial = await state();
  const serialized = JSON.stringify(initial);
  if (serialized.includes('beautyStock') || serialized.includes('beautySeekLeft') || serialized.includes('beautyPool')) {
    throw new Error('新 GameState 仍下发旧 beauty 字段');
  }
  if (!Object.values(initial.cities).every((city) => Number.isInteger(city.courtNetworkOpportunities))) {
    throw new Error('城市缺少 courtNetworkOpportunities');
  }
  if (!Object.values(initial.factions).every((faction) => Number.isInteger(faction.courtNetwork))) {
    throw new Error('势力缺少 courtNetwork');
  }
  const forbidden = ['美女库存', '势力美女', '抢夺美女', '搜罗美女'];
  if (forbidden.some((text) => document.body.innerText.includes(text))) {
    throw new Error('页面仍显示旧女性库存语义');
  }
  if (!document.body.innerText.includes('人脉')) throw new Error('顶栏未显示人脉');

  await click('command-domain-civil');
  const selector = byId('command-civil-city-select');
  const cityId = Number(selector?.value);
  if (!cityId) throw new Error('内政城市选择器缺失');
  if (!document.body.innerText.includes('宫廷人脉')) throw new Error('内政抽屉缺少宫廷人脉文案');
  const before = await state();
  const demographicsBefore = JSON.stringify(before.cities[cityId].demographics);
  await click('command-civil-seek-beauty');
  if (!byId('command-confirm-dialog')) throw new Error('地方结交未进入统一终审');
  if (!byId('command-confirm-dialog').innerText.includes('人脉')) throw new Error('终审仍使用旧资源文案');
  await click('command-confirm-submit', 550);
  const after = await state();
  if (before.cities[cityId].gold - after.cities[cityId].gold !== 60) throw new Error('地方结交未扣60金');
  if (JSON.stringify(after.cities[cityId].demographics) !== demographicsBefore) {
    throw new Error('地方结交错误修改人口四桶');
  }
  const networkGain = after.factions[after.playerFactionId].courtNetwork
    - before.factions[before.playerFactionId].courtNetwork;
  const opportunityUsed = before.cities[cityId].courtNetworkOpportunities
    - after.cities[cityId].courtNetworkOpportunities;
  if (!((networkGain === 1 && opportunityUsed === 1) || (networkGain === 0 && opportunityUsed === 0))) {
    throw new Error('地方结交库存与城市机会结算不一致');
  }
  if (!after.actionLog.some((entry) =>
    entry.type === 'beauty_seek' && (entry.message.includes('结交成功') || entry.message.includes('结交未果'))
  )) throw new Error('地方结交日志缺失或仍是旧语义');
  return {
    viewport: [innerWidth, innerHeight],
    city: after.cities[cityId].name,
    networkGain,
    opportunityUsed,
    demographicsUnchanged: true,
    legacyFields: 0,
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`R7 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
