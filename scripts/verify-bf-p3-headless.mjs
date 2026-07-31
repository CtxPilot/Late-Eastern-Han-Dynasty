// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** BF-P3 动态战况浏览器验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('BF-P3 Headless：未找到 Chrome page target');
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
  const pause = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
  document.querySelector('[data-testid="btn-enter-nanjun-battlefield"]')?.click();
  await pause(800);
  const situation = document.querySelector('[data-testid="bf-dynamic-situation"]');
  if (!situation) throw new Error('进入南郡后缺少动态战况');
  const text = situation.innerText;
  if (!text.includes('战况：') || !text.includes('侦察') || !text.includes('伏击') || !text.includes('部署')) {
    throw new Error('动态战况摘要不完整：' + text);
  }
  const footer = [...document.querySelectorAll('div')].find((node) => node.innerText?.includes('RNG') && node.innerText?.includes('phase='));
  if (!footer) throw new Error('缺少 RNG 生成审计摘要');
  return { viewport: [innerWidth, innerHeight], situation: text, auditVisible: true };
`);
ws.close();
if (consoleErrors.length > 0) throw new Error(`BF-P3 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
console.log(JSON.stringify({ ...result, consoleErrors: 0 }, null, 2));
