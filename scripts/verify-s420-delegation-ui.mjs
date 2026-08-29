// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// Session 420 S1：委任军团 UI 冒烟（?offline=1，Chrome CDP 9242）。
// 前置：pnpm --filter @leh/client dev（vite:5173）+ headless Chrome（CDP 9242）。
// 覆盖：命令坞「军团」域 → 建区终审 → 区卡与区政 → 方针改期提示 → 解散回归空态。
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
await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('英雄集结')); b?.click(); return true; })();`);
await pause(500);
await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('曹操')); b?.click(); return true; })();`);
await pause(400);
assert(await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入剧本')); b?.click(); return !!b; })();`), '点击进入剧本');
assert(await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`, 20000), '世界屏载入');
await dismissEvents();

// —— 军团域：开抽屉 ——
assert(await clickByTestId('command-domain-delegation'), '命令坞点开「军团」域');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-delegation-drawer"]')`), '军团抽屉打开');
assert(await evaluate(`return !!document.querySelector('[data-testid="command-delegation-create"]')`), '建区表单在场');
assert(
  await evaluate(`return (() => { const t = document.querySelector('[data-testid="command-delegation-drawer"]')?.textContent ?? ''; return t.includes('首都不可委任') && t.includes('每季可改一次'); })();`),
  '规则说明含首都禁任与方针冷却',
);

// —— 建区：选两城 + 选都督 + 终审 ——
const pickedCities = await evaluate(`return (() => {
  const picks = [...document.querySelectorAll('[data-testid^="command-delegation-pick-"]')].slice(0, 2);
  picks.forEach((b) => b.click());
  return picks.map((b) => b.getAttribute('data-testid'));
})();`);
assert(pickedCities.length === 2, `勾选两座直辖城（${pickedCities.join(' ')}）`);
const governorSet = await evaluate(`return (() => {
  const sel = document.querySelector('[data-testid="command-delegation-governor"]');
  if (!sel || sel.options.length < 2) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(sel, sel.options[1].value);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
})();`);
assert(governorSet, '选择合格都督');
const governorName = await evaluate(`return (() => {
  const sel = document.querySelector('[data-testid="command-delegation-governor"]');
  return sel?.selectedOptions[0]?.textContent ?? '';
})();`);
assert(await clickByTestId('command-delegation-create-submit'), '点击建立委任区（进入终审）');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-confirm-dialog"]')`), '终审弹窗出现');
assert(await clickByTestId('command-confirm-submit'), '终审确认');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-delegation-region-1"]')`, 10000), '委任区卡片出现');
assert(
  await evaluate(`return (() => { const t = document.querySelector('[data-testid="command-delegation-region-1"]')?.textContent ?? ''; return t.includes('${governorName.split('（')[0] ?? ''}') || t.includes('都督'); })();`),
  '区卡含都督信息',
);
assert(
  await evaluate(`return (() => { const t = document.querySelector('[data-testid="command-delegation-drawer"]')?.textContent ?? ''; return /1\\/\\d+/.test(t) || t.includes('(1/'); })()`),
  '建区计数更新（1/上限）',
);

// —— 方针：改为攻略型 → 下季生效提示；同季再改被拒 ——
assert(await clickByTestId('command-delegation-policy-offensive'), '点击攻略型方针');
await pause(600);
assert(
  await evaluate(`return (() => { const t = document.querySelector('[data-testid="command-delegation-region-1"]')?.textContent ?? ''; return t.includes('下季生效'); })();`),
  '区卡显示「下季生效」',
);
assert(
  await evaluate(`return (() => { const b = document.querySelector('[data-testid="command-delegation-policy-armament"]'); return !!b && b.disabled; })();`),
  '同季其他方针按钮禁用（冷却）',
);

// —— 划出全部城 → 自动解散回空态 ——
const removed = await evaluate(`return (async () => {
  let count = 0;
  for (let i = 0; i < 8; i++) {
    const btn = document.querySelector('[data-testid^="command-delegation-remove-"]');
    if (!btn || btn.disabled) break;
    btn.click();
    count += 1;
    await new Promise((r) => setTimeout(r, 500));
  }
  return count;
})()`);
assert(removed >= 2, `划出区内 ${removed} 座城`);
assert(
  await waitFor(`return !!document.querySelector('[data-testid="command-delegation-none"]')`, 10000),
  '划空后委任区自动解散（空态提示回归）',
);

// console 错误
const realErrors = consoleErrors.filter((m) => !m.includes('favicon') && !m.includes('/api/'));
assert(realErrors.length === 0, `无非网络 console error（${realErrors.length}）`);
if (realErrors.length > 0) console.error(realErrors.slice(0, 3));

console.log(`Session 420 delegation UI: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
