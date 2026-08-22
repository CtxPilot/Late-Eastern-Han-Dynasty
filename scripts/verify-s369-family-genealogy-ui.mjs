// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 369：S18 家族族谱分面真实点击验收（场景1 曹操军 → 族谱 → 曹丕记录）。 */
const cdpPort = process.env.CDP_PORT ?? '9242';
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
  const body = expression.trimStart().startsWith('return') ? expression : `return (${expression});`;
  const result = await command('Runtime.evaluate', { expression: `(async()=>{${body}})()`, awaitPromise: true, returnByValue: true });
  const exc = result.result?.exceptionDetails ?? result.exceptionDetails;
  if (exc) throw new Error(exc.exception?.description ?? exc.text);
  return result.result.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(expr, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expr)) return true;
    await pause(200);
  }
  return false;
}

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); } else { fail++; console.error(`  ✗ ${msg}`); }
}

await command('Runtime.enable');
await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173' });
await pause(1500);

// 场景1（英雄集结）曹操军（faction 1，洛阳）；childEventIds 含曹丕 953
const createOk = await evaluate(`(async () => {
  const response = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }) });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
  return true;
})()`);
assert(createOk, '创建场景1（英雄集结·曹操军）');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-family"]')`), '命令坞渲染');

// 打开家族域
await evaluate(`(async () => { document.querySelector('[data-testid="command-domain-family"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-family-drawer"]')`), '家族抽屉打开');

// 总览分面先显示族谱记录数
const overviewCount = await evaluate(`return document.querySelector('[data-testid="command-family-genealogy-count"]')?.textContent`);
assert(Number(overviewCount) >= 1, `总览族谱记录数 ≥1（${overviewCount}）`);

// 切到族谱分面
await evaluate(`(async () => { document.querySelector('[data-testid="command-family-facet-genealogy"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-family-genealogy-953"]')`), '族谱分面出现曹丕记录（953）');

const recordText = await evaluate(`return document.querySelector('[data-testid="command-family-genealogy-953"]')?.textContent ?? ''`);
assert(recordText.includes('曹丕'), '记录标题为曹丕');
assert(recordText.includes('父：曹操'), '记录含父亲曹操');
assert(recordText.includes('正史'), '史料层标注正史');

// 未启用子女的剧本应显示空态（切场景2验证空态文案）
const create2 = await evaluate(`(async () => {
  const response = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 2, playerFactionId: 1 }) });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
  return true;
})()`);
assert(create2, '切换场景2（关东义兵，无固定子女）');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-family"]')`), '场景2命令坞渲染');
await evaluate(`(async () => { document.querySelector('[data-testid="command-domain-family"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-family-drawer"]')`), '场景2家族抽屉打开');
await evaluate(`(async () => { document.querySelector('[data-testid="command-family-facet-genealogy"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-family-panel-genealogy"]')`), '族谱分面渲染');
const emptyText = await evaluate(`return document.querySelector('[data-testid="command-family-panel-genealogy"]')?.textContent ?? ''`);
assert(emptyText.includes('当前剧本没有与本势力相连的固定族谱记录'), '无关联时显示只读空态');

assert(consoleErrors.length === 0, `无控制台错误（${consoleErrors.length}）`);

console.log(`\n${pass} passed, ${fail} failed`);
ws.close();
process.exit(fail > 0 ? 1 : 0);
