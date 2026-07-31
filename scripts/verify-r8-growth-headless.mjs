// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** R8 四个玩家可读成长入口浏览器验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('R8 Headless：未找到 Chrome page target');
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
  byId('command-domain-personnel')?.click();
  await pause();
  const firstOfficer = document.querySelector('[data-testid^="command-personnel-officer-"]');
  if (!firstOfficer) throw new Error('人物名册缺少可查看人物');
  firstOfficer.click();
  await pause();
  const detail = byId('officer-detail');
  if (!detail?.innerText.includes('人物成长')) throw new Error('人物详情缺少人物成长入口');
  if (!detail.innerText.includes('阵型精通')) throw new Error('人物详情缺少阵型精通入口');
  detail.querySelector('[aria-label="关闭"]')?.click();
  await pause();
  byId('command-domain-military')?.click();
  await pause();
  const military = byId('command-military-drawer');
  if (!military?.innerText.includes('军团战备')) throw new Error('军事抽屉缺少军团战备入口');
  byId('command-drawer-close')?.click();
  await pause();
  const left = byId('left-panel');
  const campaign = [...left.querySelectorAll('button')].find((button) => button.innerText.trim().startsWith('战役'));
  if (!campaign) throw new Error('左栏缺少战役入口');
  campaign.click();
  await pause();
  if (!left.innerText.includes('战役态势')) throw new Error('战役面板缺少战役态势入口');
  return {
    viewport: [innerWidth, innerHeight],
    entries: ['人物成长', '军团战备', '阵型精通', '战役态势'],
  };
`);
ws.close();
if (consoleErrors.length > 0) throw new Error(`R8 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
console.log(JSON.stringify({ ...result, consoleErrors: 0 }, null, 2));
