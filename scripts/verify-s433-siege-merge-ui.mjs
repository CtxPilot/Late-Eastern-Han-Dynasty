// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// Session 433 docs/43 S1：围城合流 UI 冒烟（?offline=1，Chrome CDP 9242）。
// 前置：pnpm --filter @leh/client dev（vite:5173）+ headless Chrome（CDP 9242）。
// 覆盖：曹操军自邺(5)/濮阳(8) 双路出征平原(11) → 双军围城 → 军列表「N 军合流」标注
//       → 军令面板标注 → 强攻终审「合流」条目（D12）。
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
// 注意：0-B 剧本扩容后 #4~#8 剧本卡描述亦含「曹操」，必须按 h2 精确匹配 S1 卡，
// 势力必须按 faction 卡内 <strong> 精确匹配「曹操军」，否则会误入他剧本（如群雄讨董）导致后续级联失败。
await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>[...x.querySelectorAll('h2')].some(h=>h.textContent==='英雄集结·开局即高光（0-A Demo）')); b?.click(); return !!b; })();`);
await pause(500);
await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>[...x.querySelectorAll('strong')].some(s=>s.textContent==='曹操军')); b?.click(); return !!b; })();`);
await pause(400);
assert(await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入剧本')); b?.click(); return !!b; })();`), '点击进入剧本（曹操军）');
assert(await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`, 20000), '世界屏载入');
await dismissEvents();

// —— 双路出征：邺(5)/濮阳(8) → 平原(11) ——
assert(await clickByTestId('command-domain-military'), '命令坞点开「军事」域');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-military-drawer"]')`), '军事抽屉打开');
assert(await clickByTestId('command-military-facet-formation'), '切到「编成」分面');

const startCampaign = async (fromCityId, targetCityId, commanderName) => {
  await setSelect('command-military-from-city', fromCityId);
  await pause(400);
  await setSelect('command-military-target-city', targetCityId);
  await pause(300);
  const picked = await evaluate(`return (() => {
    const sel = document.querySelector('[data-testid="command-military-commander"]');
    const opt = [...(sel?.options ?? [])].find((o) => o.textContent.includes('${commanderName}'));
    if (!opt) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(sel, opt.value);
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })();`);
  if (!picked) return false;
  await pause(300);
  await setInput('command-military-troops', '2000');
  await setInput('command-military-food', '2000');
  await pause(300);
  if (!(await clickByTestId('command-military-start'))) return false;
  if (!(await waitFor(`return !!document.querySelector('[data-testid="command-confirm-dialog"]')`))) return false;
  return clickByTestId('command-confirm-submit');
};

assert(await startCampaign('5', '11', '司马懿'), '出征①：邺 → 平原（司马懿）');
assert(await waitFor(`return !document.querySelector('[data-testid="command-confirm-dialog"]')`), '出征①终审提交');
await pause(600);
assert(await startCampaign('8', '11', '吕虔'), '出征②：濮阳 → 平原（吕虔）');
assert(await waitFor(`return !document.querySelector('[data-testid="command-confirm-dialog"]')`), '出征②终审提交');
await pause(800);

// —— 推月：双军抵达围城 ——
assert(await clickByTestId('btn-end-turn'), '点击结束回合（双军行军抵达）');
// 战役 Army 列表寄于左栏「战役」手风琴内（闭合时不渲染），先展开再断言
await evaluate(`return (() => { const b=[...document.querySelectorAll('#left-panel button, [data-testid="left-panel"] button')].find(x=>x.textContent.replace(/\s+/g, '').startsWith('战役')); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return true; })();`);
await pause(600);
assert(await waitFor(`return !!document.querySelector('[data-testid="campaign-army-merge"]')`, 25000), '军列表出现合流标注');
const mergeText = await evaluate(`return document.querySelector('[data-testid="campaign-army-merge"]')?.textContent?.trim() ?? '';`);
assert(/^2 军合流 · 共 4000 兵$/.test(mergeText), `军列表标注「${mergeText}」`);

// —— 军令面板：选中围城军 → 合流标注 + 强攻终审 ——
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
const orderMergeText = await evaluate(`return document.querySelector('[data-testid="military-merge-label"]')?.textContent?.trim() ?? '';`);
assert(/^2 军合流 · 共 4000 兵$/.test(orderMergeText), `军令面板标注「${orderMergeText}」`);
assert(await clickByTestId('military-order-assault'), '点击强攻（进入终审）');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-confirm-dialog"]')`), '强攻终审弹窗出现');
const dialogText = await evaluate(`return document.querySelector('[data-testid="command-confirm-dialog"]')?.textContent ?? '';`);
assert(dialogText.includes('合流') && dialogText.includes('2 军合流 · 共 4000 兵'), '终审含「合流」条目与规模');
assert(await clickByTestId('command-confirm-cancel'), '取消强攻（不结算）');
await pause(400);

// console 错误
const realErrors = consoleErrors.filter((m) => !m.includes('favicon') && !m.includes('/api/'));
assert(realErrors.length === 0, `无非网络 console error（${realErrors.length}）`);
if (realErrors.length > 0) console.error(realErrors.slice(0, 3));

console.log(`Session 433 siege-merge UI: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
