// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// Session 434 docs/43 S2：六角多军 UI 冒烟（?offline=1，Chrome CDP 9242）。
// 前置：pnpm --filter @leh/client dev（vite:5173）+ headless Chrome（CDP 9242）。
// 覆盖：曹操军自邺(5)/濮阳(8) 双路出征平原(11) → 双军围城 → 军令「亲统强攻」
//       → 终审合流条目 → BattleView 参战军旗条（D12）→ 分军撤退（战斗继续）
//       → 余部撤退（战斗结束）→ 退出结算回世界屏。
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
assert(await clickByTestId('command-military-facet-orders'), '切到「军令」分面');
await pause(500);

// —— 亲统强攻：选中围城军 → 终审 → 进入六角 ——
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
const dialogText = await evaluate(`return document.querySelector('[data-testid="command-confirm-dialog"]')?.textContent ?? '';`);
assert(dialogText.includes('合流') && dialogText.includes('2 军合流 · 共 4000 兵'), '亲统终审含合流条目');
assert(await clickByTestId('command-confirm-submit'), '亲统终审提交');

// —— BattleView：军旗条 ——
assert(await waitFor(`return !!document.querySelector('[data-testid="battle-weather"]')`, 20000), '六角战场载入');
await pause(800);
const banners = await evaluate(`return document.querySelector('[data-testid="battle-army-banners"]')?.textContent?.trim() ?? '';`);
const parts = banners.replace(/^参战：/, '').split('·').map((s) => s.trim()).filter(Boolean);
assert(parts.length === 2 && parts.some((p) => p.includes('司马懿')) && parts.some((p) => p.includes('吕虔')), `参战军旗条「${banners}」`);

// —— 分军撤退：无选中 → 撤首军，战斗继续 ——
assert(await clickByTestId('btn-battle-retreat'), '点击战术撤退①');
await pause(1000);
assert(await evaluate(`return !!document.querySelector('[data-testid="battle-weather"]')`), '一军撤出后战斗继续（仍在战场）');
assert(await evaluate(`return !document.querySelector('[data-testid="btn-exit-battle"]')`), '战斗未结束（无退出按钮）');

// —— 余部撤退：战斗结束 → 退出结算 ——
assert(await clickByTestId('btn-battle-retreat'), '点击战术撤退②');
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-exit-battle"]')`), '余部撤出后战斗结束');
assert(await clickByTestId('btn-exit-battle'), '退出战场结算');
assert(await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`, 20000), '返回世界屏');

// console 错误
const realErrors = consoleErrors.filter((m) => !m.includes('favicon') && !m.includes('/api/'));
assert(realErrors.length === 0, `无非网络 console error（${realErrors.length}）`);
if (realErrors.length > 0) console.error(realErrors.slice(0, 3));

console.log(`Session 434 hex-multi-army UI: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
