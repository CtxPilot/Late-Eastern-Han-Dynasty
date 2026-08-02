// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 274：六郡跨入口、退出回环与 0-A 大地图归属总验收。 */
const cdpPort = process.env.CDP_PORT ?? '9241';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('未找到 Chrome page target');

const cases = [
  { id: 'nanjun', templateId: 'nanjun-190', nodes: 16, routes: 11, entries: 2, seat: 'nanjun_jiangling', seatName: '江陵', worldCityId: 14, worldCityName: '江陵', binding: 'direct' },
  { id: 'yingchuan', templateId: 'yingchuan-190', nodes: 17, routes: 29, entries: 2, seat: 'yingchuan_yangdi', seatName: '阳翟', worldCityId: 3, worldCityName: '阳翟', binding: 'direct' },
  { id: 'chenliu', templateId: 'chenliu-190', nodes: 17, routes: 19, entries: 3, seat: 'chenliu_chenliu', seatName: '陈留', worldCityId: 7, worldCityName: '陈留', binding: 'direct' },
  { id: 'henan', templateId: 'henan-190', nodes: 21, routes: 40, entries: 3, seat: 'henan_luoyang', seatName: '雒阳', worldCityId: 1, worldCityName: '洛阳', binding: 'direct' },
  { id: 'henei', templateId: 'henei-190', nodes: 18, routes: 35, entries: 3, seat: 'henei_huai', seatName: '怀', worldCityId: 1, worldCityName: '洛阳', binding: 'proxy' },
  { id: 'hongnong', templateId: 'hongnong-190', nodes: 9, routes: 17, entries: 3, seat: 'hongnong_hongnong', seatName: '弘农', worldCityId: 2, worldCityName: '长安', binding: 'proxy' },
];

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
  const result = await command('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.exception?.description ?? result.result.exceptionDetails.text);
  return result.result.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await command('Runtime.enable');
await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173' });
await pause(1000);
await evaluate(`
  const response = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }) });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
`);
await pause(1500);

const results = [];
for (const expected of cases) {
  const hit = await evaluate(`
    const el = document.querySelector('[data-testid="btn-enter-${expected.id}-battlefield"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid]');
    return { testId: target?.getAttribute('data-testid'), x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  if (!hit || hit.testId !== `btn-enter-${expected.id}-battlefield`) {
    throw new Error(`${expected.id} 入口未命中：${JSON.stringify(hit)}`);
  }
  await evaluate(`document.elementFromPoint(${hit.x}, ${hit.y}).closest('[data-testid]').click(); return true;`);
  await pause(700);

  const actual = await evaluate(`
    const state = await (await fetch('/api/game/state')).json();
    const inst = state.activeBattlefieldInstance;
    const city = state.cities[${expected.worldCityId}];
    return {
      templateId: inst?.templateId,
      nodes: inst?.nodeStates?.length ?? 0,
      routes: inst?.routeStates?.length ?? 0,
      entries: inst?.entryNodeIds?.length ?? 0,
      seat: inst?.targetSeatNodeId,
      defenderFactionId: inst?.defenderFactionId,
      worldCityName: city?.name,
      worldCityRuler: city?.ruler,
      seatVisible: document.body.innerText.includes(${JSON.stringify(expected.seatName)}),
    };
  `);
  for (const key of ['templateId', 'nodes', 'routes', 'entries', 'seat', 'worldCityName']) {
    if (actual[key] !== expected[key]) throw new Error(`${expected.id} ${key} 异常：${JSON.stringify({ expected: expected[key], actual: actual[key] })}`);
  }
  if (!actual.seatVisible) throw new Error(`${expected.id} 治所未渲染：${expected.seatName}`);
  if (actual.worldCityRuler != null && actual.worldCityRuler !== 1 && actual.defenderFactionId !== actual.worldCityRuler) {
    throw new Error(`${expected.id} 守方未采用大地图归属：${JSON.stringify(actual)}`);
  }
  results.push({ id: expected.id, templateId: actual.templateId, nodes: actual.nodes, routes: actual.routes, entries: actual.entries, worldCity: `${expected.worldCityId}:${actual.worldCityName}`, binding: expected.binding });

  const exitHit = await evaluate(`
    const el = document.querySelector('[data-testid="btn-exit-battlefield"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid]');
    return { testId: target?.getAttribute('data-testid'), x: r.left + r.width / 2, y: r.top + r.height / 2 };
  `);
  if (!exitHit || exitHit.testId !== 'btn-exit-battlefield') throw new Error(`${expected.id} 退出入口未命中：${JSON.stringify(exitHit)}`);
  await evaluate(`document.elementFromPoint(${exitHit.x}, ${exitHit.y}).closest('[data-testid]').click(); return true;`);
  await pause(500);
  const returned = await evaluate(`
    const state = await (await fetch('/api/game/state')).json();
    return { instanceCleared: state.activeBattlefieldInstance == null, entryVisible: document.querySelector('[data-testid="btn-enter-${expected.id}-battlefield"]') !== null };
  `);
  if (!returned.instanceCleared || !returned.entryVisible) throw new Error(`${expected.id} 退出回环异常：${JSON.stringify(returned)}`);
}

const realErrors = consoleErrors.filter((entry) => !/favicon/i.test(entry));
if (realErrors.length > 0) throw new Error(`控制台错误：${JSON.stringify(realErrors)}`);
console.log(JSON.stringify({ viewport: [1440, 900], commanderies: results, exitLoops: results.length, consoleErrors: 0 }, null, 2));
ws.close();
