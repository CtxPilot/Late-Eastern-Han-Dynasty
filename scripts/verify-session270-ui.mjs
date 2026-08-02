// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 270：河南尹第四模板真实浏览器入口与渲染验收。 */
const cdpPort = process.env.CDP_PORT ?? '9241';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('未找到 Chrome page target');

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
const hit = await evaluate(`
  const el = document.querySelector('[data-testid="btn-enter-henan-battlefield"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const target = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid]');
  return { testId: target?.getAttribute('data-testid'), x: r.left + r.width / 2, y: r.top + r.height / 2 };
`);
if (!hit || hit.testId !== 'btn-enter-henan-battlefield') throw new Error(`河南尹入口未命中：${JSON.stringify(hit)}`);
await evaluate(`document.elementFromPoint(${hit.x}, ${hit.y}).closest('[data-testid]').click(); return true;`);
await pause(1200);

const result = await evaluate(`
  const state = await (await fetch('/api/game/state')).json();
  const inst = state.activeBattlefieldInstance;
  const text = document.body.innerText;
  return {
    templateId: inst?.templateId,
    nodeCount: inst?.nodeStates?.length ?? 0,
    routeCount: inst?.routeStates?.length ?? 0,
    entryCount: inst?.entryNodeIds?.length ?? 0,
    seat: inst?.targetSeatNodeId,
    labelVisible: text.includes('河南尹'),
    luoyangVisible: text.includes('雒阳'),
    xingyangVisible: text.includes('荥阳'),
  };
`);
if (result.templateId !== 'henan-190' || result.nodeCount !== 21 || result.routeCount !== 40 || result.entryCount !== 3 || result.seat !== 'henan_luoyang') {
  throw new Error(`河南尹运行态异常：${JSON.stringify(result)}`);
}
if (!result.labelVisible || !result.luoyangVisible || !result.xingyangVisible) throw new Error(`河南尹渲染缺项：${JSON.stringify(result)}`);
const realErrors = consoleErrors.filter((entry) => !/favicon/i.test(entry));
if (realErrors.length > 0) throw new Error(`控制台错误：${JSON.stringify(realErrors)}`);
console.log(JSON.stringify({ viewport: [1440, 900], ...result, consoleErrors: 0 }, null, 2));
ws.close();
