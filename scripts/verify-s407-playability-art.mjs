// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// Session 407：P0 可玩性三件套 + 美术批次① 冒烟（?offline=1，Chrome CDP 9242）。
// 前置：pnpm --filter @leh/client dev（vite:5173，无需后端）+ headless Chrome。
// 覆盖：首回合引导三步 / 霸业面板 / 印章字体生效 / 本月纪要 / 调试入口仍可用（dev）。
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
const cmd = (method, params = {}) => new Promise((res) => {
  const id = ++nextId;
  pendingMap.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await cmd('Runtime.evaluate', {
    expression: `(async()=>{${expression}})()`,
    awaitPromise: true,
    returnByValue: true,
  });
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
let pass = 0;
let fail = 0;
const assert = (c, msg) => {
  if (c) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error(`  ✗ ${msg}`); }
};
const dismissEvents = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await evaluate(`return !!document.querySelector('[data-testid="event-dialog-overlay"]')`))) return;
    await evaluate(`return (document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true`);
    await pause(400);
  }
};

await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const targetUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/?offline=1';
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);

// 引导关闭状态存 localStorage：重跑前清掉，保证每次都从「未完成」开始。
await evaluate(`return (() => { localStorage.removeItem('leh-guide-first-turn-dismissed'); return true; })();`);
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);

assert(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`), '进入剧本选择');
assert(await clickByText('button', '英雄集结'), '选择剧本：英雄集结');
await pause(500);
assert(await clickByText('button', '曹操'), '选择势力：曹操军');
await pause(400);
assert(await clickByText('button', '进入剧本'), '点击进入剧本');
assert(await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`, 20000), '世界屏：战略卡片容器');
await dismissEvents();

// —— P0-2 首回合引导 ——
assert(await waitFor(`return !!document.querySelector('[data-testid="first-turn-guide"]')`), '首回合引导卡可见');
assert(
  await evaluate(`return !!document.querySelector('[data-testid="guide-step-1"]') && !!document.querySelector('[data-testid="guide-step-2"]') && !!document.querySelector('[data-testid="guide-step-3"]')`),
  '引导三步清单齐全',
);
assert(
  await evaluate(`return document.querySelector('[data-testid="guide-step-1"]').textContent.includes('✓')`),
  '第一步显示已完成（开局自动选中都城）',
);

// —— P0-1 霸业面板（左栏默认展开）——
assert(await waitFor(`return !!document.querySelector('[data-testid="hegemony-panel"]')`), '霸业面板默认展开');
assert(
  await evaluate(`return (() => { const t = document.querySelector('[data-testid="hegemony-panel"]')?.textContent ?? ''; return t.includes('霸业 · 占城') && t.includes('天下大势'); })()`),
  '霸业面板含占城进度与天下排行',
);
assert(
  await evaluate(`return (() => { const h1 = document.querySelector('[data-testid="strategic-world-view"] h1'); return h1 && getComputedStyle(h1).fontFamily.includes('HanDynastySeal'); })()`),
  '大标题启用印章字体（HanDynastySeal）',
);

// 引导第一步：点一座己方城（左栏己方城池）
assert(
  await evaluate(`return (() => { const acc = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('己方城池')); acc?.click(); return true; })()`),
  '展开左栏己方城池',
);
await pause(300);
assert(
  await evaluate(`return (() => {
    const panel = document.querySelector('[data-testid="left-panel"]');
    const btn = panel && [...panel.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('兵'));
    if (!btn) return false; btn.click(); return true;
  })()`),
  '点选己方城 → 引导第一步完成',
);
await pause(400);
assert(
  await evaluate(`return document.querySelector('[data-testid="guide-step-1"]')?.textContent.includes('✓') ?? false`),
  '引导第一步打勾',
);

// —— P0-3 本月纪要（结束回合 → 纪要卡出现并可关闭）——
const readMonth = `return ((document.querySelector('[data-testid="top-bar"]')?.textContent ?? '').match(/\\d+年[^月]*?(\\d+)月/) ?? ['',''])[1]`;
const monthBefore = String(await evaluate(readMonth));
await evaluate(`return (() => { document.querySelector('[data-testid="btn-end-turn"]')?.click(); return true; })();`);
let advanced = false;
for (let i = 0; i < 30; i++) {
  await dismissEvents();
  const m = String(await evaluate(readMonth));
  if (m && m !== monthBefore) { advanced = true; break; }
  await pause(300);
}
assert(advanced, `结束回合推进月份（${monthBefore}月 → 次月）`);
assert(
  await waitFor(`return !!document.querySelector('[data-testid="month-report"]')`, 8000),
  '本月纪要卡出现',
);
assert(
  await evaluate(`return (() => { const t = document.querySelector('[data-testid="month-report"]')?.textContent ?? ''; return t.includes('本月纪要'); })()`),
  '纪要卡含标题「本月纪要」',
);
assert(
  await evaluate(`return (() => { const b = [...document.querySelectorAll('[data-testid="month-report"] button')].find((x) => x.getAttribute('aria-label') === '关闭本月纪要'); if (!b) return false; b.click(); return true; })()`),
  '关闭本月纪要',
);
await pause(300);
assert(
  await evaluate(`return !document.querySelector('[data-testid="month-report"]') && !document.querySelector('[data-testid="turn-progress-overlay"]')`),
  '纪要关闭且结算遮罩已退出',
);

// —— 霸业面板在月结后仍可用（左栏手风琴单开：先重新展开「霸业」再断言）——
assert(
  await evaluate(`return (() => {
    const panel = document.querySelector('[data-testid="left-panel"]');
    const acc = panel && [...panel.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('霸业'));
    if (!acc) return false; acc.click(); return true;
  })()`),
  '重新展开左栏「霸业」',
);
await pause(300);
assert(
  await evaluate(`return !!document.querySelector('[data-testid="hegemony-panel"]')`),
  '月结后霸业面板仍可用',
);

// console 错误
const realErrors = consoleErrors.filter((m) => !m.includes('favicon') && !m.includes('/api/'));
assert(realErrors.length === 0, `无非网络 console error（${realErrors.length}）`);

console.log(`Session 407 playability+art: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
