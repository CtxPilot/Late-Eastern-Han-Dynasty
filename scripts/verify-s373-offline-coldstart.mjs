// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 373 Phase 4：PWA 完全离线冷启动验收。
 *
 * 前置：
 *   1. 生产构建已注入 GITHUB_PAGES_BASE 与 VITE_OFFLINE=1（dist 含 sw.js）
 *   2. 静态伺服产物（如 `python3 -m http.server 8899` 于产物父目录）
 *   3. Chrome CDP :9242
 * 用法：SMOKE_URL=http://127.0.0.1:8899/<子路径>/ node scripts/verify-s373-offline-coldstart.mjs
 *
 * 流程：首访注册 SW 并预缓存 → CDP 断网仿真 → 刷新（冷启动）→ 字体/引擎/存读档全部离线可用。
 */
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
    void cmd('Page.handleJavaScriptDialog', { accept: true });
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  pendingMap.get(m.id)?.(m);
};
await new Promise((r) => { ws.onopen = r; });
function cmd(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++nextId;
    pendingMap.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
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
const assert = (c, msg) => { if (c) { pass++; console.log(`  ✓ ${msg}`); } else { fail++; console.error(`  ✗ ${msg}`); } };

await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Network.enable');
await cmd('Page.addScriptToEvaluateOnNewDocument', {
  source: "window.__errs=[]; window.addEventListener('unhandledrejection', function(e){ window.__errs.push(String((e.reason && e.reason.message) || e.reason)); });",
});
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const targetUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:8899/Late-Eastern-Han-Dynasty/';
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);

assert(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`), '首访加载完成（剧本选择渲染）');

// Service Worker 注册与预缓存就绪
assert(await waitFor(`return !!(navigator.serviceWorker.controller || (await navigator.serviceWorker.ready).active)`, 12000), 'Service Worker 已接管页面');
const cacheInfo = await evaluate(`
  const keys = await caches.keys();
  const lehKey = keys.find((k) => k.startsWith('leh-'));
  if (!lehKey) return { ok: false };
  const entries = await (await caches.open(lehKey)).keys();
  return { ok: true, key: lehKey, count: entries.length };
`);
assert(cacheInfo.ok === true && cacheInfo.count >= 8, `预缓存清单落库（${cacheInfo.key ?? '-'} · ${cacheInfo.count ?? 0} 条）`);

// 断网仿真 → 冷启动刷新
await cmd('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await cmd('Page.navigate', { url: targetUrl });
await pause(2000);

assert(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`, 20000), '断网冷启动：剧本选择照常渲染（SW 缓存供给）');
assert(await waitFor(`return document.fonts.check('12px HanDynastySerif') && document.fonts.check('12px HanDynastySeal')`, 8000), '工程字体离线可用');

// 离线开局与回合推进
assert(await clickByText('button', '英雄集结'), '选择剧本：英雄集结');
await pause(500);
assert(await clickByText('button', '曹操'), '选择势力：曹操军');
await pause(400);
assert(await clickByText('button', '进入剧本'), '点击进入剧本');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`, 20000), '世界屏渲染');
for (let i = 0; i < 4 && await evaluate(`return !!document.querySelector('[data-testid="event-dialog-overlay"]')`); i++) {
  await evaluate(`return ((document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true)`);
  await pause(400);
}
const readMonth = `return ((document.querySelector('[data-testid="top-bar"]')?.textContent ?? '').match(/\\d+年[^月]*?(\\d+)月/) ?? ['',''])[1]`;
const monthBefore = String(await evaluate(readMonth));
await evaluate(`return (() => { document.querySelector('[data-testid="btn-end-turn"]')?.click(); return true; })();`);
let advanced = false;
for (let i = 0; i < 30; i++) {
  if (!(await evaluate(`return !!document.querySelector('[data-testid="event-dialog-overlay"]')`))) {
    // 无弹窗时检查月份
  } else {
    await evaluate(`return ((document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true)`);
  }
  const m = String(await evaluate(readMonth));
  if (m && m !== monthBefore) { advanced = true; break; }
  await pause(500);
}
assert(advanced, `断网下结束回合推进月份（${monthBefore}月 → 次月）`);

// 离线槽位存档（IndexedDB 不受断网影响）
const slot = `cold-${Date.now() % 1000000}`;
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
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-load-slot-${slot}"]')`, 12000), `离线保存成功（出现 ${slot}）`);

// 恢复网络并清理
await cmd('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

const errs = await evaluate(`return (window.__errs || []).join(' | ')`);
assert(!errs, `无未处理拒绝（${errs || '无'}）`);
const realErrors = consoleErrors.filter((t) => !/net::ERR|Failed to fetch|WebSocket/i.test(t));
assert(realErrors.length === 0, `控制台无非网络错误（${realErrors.length}）${realErrors[0] ? ': ' + realErrors[0].slice(0, 120) : ''}`);

console.log(`\n${pass} passed, ${fail} failed`);
ws.close();
process.exit(fail > 0 ? 1 : 0);
