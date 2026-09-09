// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// Session 441 docs/44 S4d：战斗中使用 UI 验收（?offline=1，Chrome CDP 9242）。
// 前置：pnpm --filter @leh/client dev（vite:5173）+ headless Chrome（CDP 9242）。
// 覆盖：曹操军邺(5)出征平原(11) → 围城 → 军令「亲统强攻」→ BattleView →
//   未选中无药品按钮 → 选中我军出现药品按钮 → 空态文案（新档零库存，沿 432/435 口径）
//   → 开合切换 → console 0 error。
// 成功路径（体力恢复/扣槽/行动结束/八拒绝）由 `pnpm verify-s44d-battle-consumable`
// 24/24 覆盖；点击成功链路需真实库存（纯 gameplay 约 700 次搜索，不可达），
// 故浏览器端仅验收门禁与空态（诚实边界，沿 432/435 未做浏览器验收先例）。
const cdpPort = process.env.CDP_PORT ?? '9242';
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
async function clickByTestId(testid, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(`return (() => {
      const el = document.querySelector('[data-testid="${testid}"]');
      if (!el || el.disabled) return false; el.click(); return true;
    })();`);
    if (ok) return true;
    await pause(250);
  }
  return false;
}
const setSelect = (testid, value) => evaluate(`return (() => {
  const sel = document.querySelector('[data-testid="${testid}"]');
  if (!sel) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, '${value}');
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})();`);
const setInput = (testid, value) => evaluate(`return (() => {
  const input = document.querySelector('[data-testid="${testid}"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, '${value}');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})();`);
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
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);

assert(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`), '进入剧本选择');
await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>[...x.querySelectorAll('h2')].some(h=>h.textContent==='英雄集结·开局即高光（0-A Demo）')); b?.click(); return !!b; })();`);
await pause(500);
await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>[...x.querySelectorAll('strong')].some(s=>s.textContent==='曹操军')); b?.click(); return !!b; })();`);
await pause(400);
assert(await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入剧本')); b?.click(); return !!b; })();`), '点击进入剧本（曹操军）');
assert(await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`, 20000), '世界屏载入');
await dismissEvents();

// —— 单路出征：邺(5) → 平原(11) ——
assert(await clickByTestId('command-domain-military'), '命令坞点开「军事」域');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-military-drawer"]')`), '军事抽屉打开');
assert(await clickByTestId('command-military-facet-formation'), '切到「编成」分面');
await setSelect('command-military-from-city', '5');
await pause(400);
await setSelect('command-military-target-city', '11');
await pause(300);
const picked = await evaluate(`return (() => {
  const sel = document.querySelector('[data-testid="command-military-commander"]');
  const opt = [...(sel?.options ?? [])].find((o) => o.textContent.includes('司马懿'));
  if (!opt) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, opt.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})();`);
assert(picked, '选中主将（司马懿）');
await pause(300);
await setInput('command-military-troops', '2000');
await setInput('command-military-food', '2000');
await pause(300);
assert(await clickByTestId('command-military-start'), '点击出征');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-confirm-dialog"]')`), '出征终审弹窗出现');
assert(await clickByTestId('command-confirm-submit'), '出征终审提交');
assert(await waitFor(`return !document.querySelector('[data-testid="command-confirm-dialog"]')`), '出征终审关闭');
await pause(600);

// —— 推月抵达围城 → 亲统强攻 ——
assert(await clickByTestId('btn-end-turn'), '点击结束回合（行军抵达）');
assert(await clickByTestId('command-military-facet-orders'), '切到「军令」分面');
await pause(500);
const pickedSieging = await evaluate(`return (() => {
  const sel = document.querySelector('[data-testid="command-military-orders-army"]');
  const opt = [...(sel?.options ?? [])].find((o) => o.textContent.includes('司马懿'));
  if (!opt) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, opt.value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})();`);
assert(pickedSieging, '军令面板选中围城军（司马懿）');
await pause(500);
assert(await clickByTestId('military-order-siege-storm'), '点击亲统强攻（进入终审）');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-confirm-dialog"]')`), '亲统终审弹窗出现');
assert(await clickByTestId('command-confirm-submit'), '亲统终审提交');

// —— BattleView：药品按钮门禁与空态 ——
assert(await waitFor(`return !!document.querySelector('[data-testid="battle-weather"]')`, 20000), '六角战场载入');
await pause(800);
assert(await evaluate(`return !document.querySelector('[data-testid="btn-battle-consumable"]')`), '未选中单位无药品按钮');
assert(await clickByTestId('btn-select-attacker'), '选中我军单位');
await pause(600);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-battle-consumable"]')`), '选中后出现药品按钮');
assert(await clickByTestId('btn-battle-consumable'), '打开药品选择器');
const emptyText = await evaluate(`return document.querySelector('[data-testid="battle-consumable-empty"]')?.textContent ?? '';`);
assert(emptyText.includes('暂无可用药品'), `空态文案（新档零库存）：「${emptyText.slice(0, 24)}」`);
assert(await clickByTestId('btn-battle-consumable'), '收起药品选择器');
assert(await waitFor(`return !document.querySelector('[data-testid="battle-consumable-picker"]')`), '选择器关闭');

// console 错误
const realErrors = consoleErrors.filter((m) => !m.includes('favicon') && !m.includes('/api/'));
assert(realErrors.length === 0, `无非网络 console error（${realErrors.length}）`);
if (realErrors.length > 0) console.error(realErrors.slice(0, 3));

console.log(`Session 441 s44d-battle-consumable UI: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
