// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 454：S24 关系网深度缔结面真实点击验收。
 * 前提：pnpm dev（5173/3001）+ google-chrome --headless=new --remote-debugging-port=9242。
 * 覆盖：世界屏→人事名册→诸葛亮详情→关系页同城缔结入口→低亲和结义被服务端拒绝并提示。
 * 诚实边界：高亲和成功结义在日常开局不可点击到达（需亲和≥80），成功路径由 verify-s52 engine 脚本覆盖。
 */
const cdpPort = process.env.CDP_PORT ?? '9242';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('no page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
const consoleErrors = [];
let nextId = 0;
ws.onmessage = (event) => {
  const m = JSON.parse(event.data);
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  pending.get(m.id)?.(m);
};
await new Promise((r) => { ws.onopen = r; });
function command(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++nextId;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const trimmed = expression.trimStart();
  const body = trimmed.startsWith('return') || trimmed.includes(';') ? trimmed : `return (${trimmed});`;
  const result = await command('Runtime.evaluate', { expression: `(async()=>{${body}})()`, awaitPromise: true, returnByValue: true });
  const exc = result.result?.exceptionDetails ?? result.exceptionDetails;
  if (exc) throw new Error(exc.exception?.description ?? exc.text);
  return result.result.result.value;
}
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expr)) return true;
    await pause(200);
  }
  return false;
}
let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.error('  ✗ ' + m); } };

await command('Runtime.enable');
await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173' });
await pause(1500);
await evaluate(`(async () => {
  const res = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 1, playerFactionId: 2 }) });
  if (!res.ok) throw new Error(await res.text());
  location.reload();
  return true;
})()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-personnel"]')`), '世界屏与人事命令坞渲染');
await pause(2500);
await evaluate(`document.querySelector('[data-testid="command-domain-personnel"]')?.click(); return true;`);
await pause(500);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-personnel-drawer"]')`), '人事抽屉打开');

// 名册首屏即含诸葛亮（刘备军）
const rosterOk = await waitFor(`return !!document.querySelector('[data-testid="command-personnel-officer-4"]')`);
assert(rosterOk, '名册首屏含诸葛亮');
await evaluate(`document.querySelector('[data-testid="command-personnel-officer-4"]')?.click(); return true;`);
assert(await waitFor(`return !!document.querySelector('[data-testid="officer-detail"]')`), '武将详情打开');

await evaluate(`document.querySelector('[data-testid="officer-tab-relations"]')?.click(); return true;`);
assert(await waitFor(`return !!document.querySelector('[data-testid="officer-swear-10"]')`), '关系页出现「同城缔结」与赵云结义按钮');

const bondText = await evaluate(`return document.querySelector('[data-testid="officer-detail"]')?.textContent ?? ''`);
assert(bondText.includes('义结金兰需亲和'), '缔结门槛提示上屏');

// 点击结义：默认亲和不足 → 服务端权威拒绝并在顶栏给出原因
await evaluate(`document.querySelector('[data-testid="officer-swear-10"]')?.click(); return true;`);
const rejected = await waitFor(`return (document.body.textContent ?? '').includes('亲和不足')`, 8000);
assert(rejected, '低亲和结义被服务端拒绝并显示「亲和不足」');

console.log('console errors: ' + consoleErrors.length);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).join('\n'));
console.log(`结果：${pass} 通过 / ${fail} 失败`);
ws.close();
if (fail > 0) process.exit(1);
