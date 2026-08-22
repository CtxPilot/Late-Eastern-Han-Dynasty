// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// Session 372 Phase 3：离线可玩最小闭环端到端冒烟（?offline=1，Chrome CDP 9242）。
// 前置：pnpm dev（vite:5173）；无需后端参与断言（网关回退产生的网络错误已豁免）。
const cdpPort = '9242';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('未找到 Chrome page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pendingMap = new Map();
const consoleErrors = [];
let nextId = 0;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Page.javascriptDialogOpening') {
    // 自动接受读档覆盖确认等原生对话框，避免无头环境阻塞
    void cmd('Page.handleJavaScriptDialog', { accept: true });
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  pendingMap.get(m.id)?.(m);
};
await new Promise((r) => { ws.onopen = r; });
const cmd = (method, params = {}) => new Promise((res) => { const id = ++nextId; pendingMap.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const result = await cmd('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  const exc = result.result?.exceptionDetails;
  if (exc) throw new Error(exc.exception?.description ?? exc.text);
  return result.result.result.value;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expr)) return true;
    await pause(250);
  }
  return false;
}
async function clickByText(selector, text, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(`return (() => {
      const btn = [...document.querySelectorAll('${selector}')].find((b) => (b.textContent ?? '').includes('${text}'));
      if (!btn) return false; btn.click(); return true;
    })();`);
    if (ok) return true;
    await pause(250);
  }
  return false;
}
let pass = 0, fail = 0;
const assert = (c, msg) => { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.error(`  ✗ ${msg}`); } };
const dismissEvents = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await evaluate(`return !!document.querySelector('[data-testid="event-dialog-overlay"]')`))) return;
    await evaluate(`return (document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true`);
    await pause(400);
  }
};

await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Page.addScriptToEvaluateOnNewDocument', {
  source: "window.__errs=[]; window.addEventListener('unhandledrejection', function(e){ window.__errs.push(String((e.reason && e.reason.message) || e.reason)); });",
});
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
// 目标地址可用 SMOKE_URL 覆盖（默认本地 dev 离线参数）；生产产物验证时指向 Pages 子路径
const targetUrl = process.env.SMOKE_URL ?? 'http://localhost:5173/?offline=1';
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);

assert(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`), '离线 boot：fetchStatic 经 Worker，进入剧本选择');
assert(await clickByText('button', '英雄集结'), '选择剧本：英雄集结');
await pause(500);
assert(await clickByText('button', '曹操'), '选择势力：曹操军');
await pause(400);
assert(await clickByText('button', '进入剧本'), '点击进入剧本');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`, 20000), '世界屏渲染（命令坞就绪）');
await dismissEvents();

const readMonth = `return ((document.querySelector('[data-testid="top-bar"]')?.textContent ?? '').match(/\\d+年[^月]*?(\\d+)月/) ?? ['',''])[1]`;
const monthBefore = String(await evaluate(readMonth));
await evaluate(`return (() => { document.querySelector('[data-testid="btn-end-turn"]')?.click(); return true; })();`);
// 等待月份推进；期间若弹事件则先抉择
let advanced = false;
for (let i = 0; i < 30; i++) {
  await dismissEvents();
  const m = String(await evaluate(readMonth));
  if (m && m !== monthBefore) { advanced = true; break; }
  await pause(500);
}
assert(advanced, `结束回合推进月份（${monthBefore}月 → 次月），权威引擎离线结算`);

// 槽位存档：唯一名避免覆盖确认；保存后经网关列表断言
const slot = `off-${Date.now() % 1000000}`;
await evaluate(`return (() => { document.querySelector('[data-testid="btn-save-slots"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="save-slot-name"]')`), '槽位面板打开');
await evaluate(`return (() => {
  const input = document.querySelector('[data-testid="save-slot-name"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '${slot}');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})();`);
await evaluate(`return (() => { document.querySelector('[data-testid="btn-save-slot"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-load-slot-${slot}"]')`, 12000), `保存成功（槽位列表出现 ${slot}）`);

// 读档恢复
await evaluate(`return (() => { document.querySelector('[data-testid="btn-load-slot-${slot}"]')?.click(); return true; })();`);
await pause(800);
await waitFor(`return !!document.querySelector('[data-testid="save-slot-name"]')`) && await evaluate(`return (() => { document.querySelector('.absolute.right-3.top-12 button')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`), '读档后回到世界屏');

const errs = await evaluate(`return (window.__errs || []).join(' | ')`);
assert(!errs, `无未处理拒绝（${errs || '无'}）`);
const realErrors = consoleErrors.filter((t) => !/net::ERR|Failed to fetch|WebSocket/i.test(t));
assert(realErrors.length === 0, `控制台无非网络错误（${realErrors.length}）${realErrors[0] ? ': ' + realErrors[0].slice(0, 120) : ''}`);

console.log(`\n${pass} passed, ${fail} failed`);
ws.close();
process.exit(fail > 0 ? 1 : 0);
