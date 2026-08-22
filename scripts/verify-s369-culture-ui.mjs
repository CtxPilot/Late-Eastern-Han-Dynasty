// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 369：S03 文化产业分面真实点击验收（发展文化→终审→进度条→门槛提示→完成+60）。 */
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

async function fetchState() {
  return evaluate(`(async () => (await (await fetch('/api/game/state')).json()))()`);
}

await command('Runtime.enable');
await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173' });
await pause(1500);

// 场景2（关东义兵）曹操势力（faction 1，首城陈留）
const createOk = await evaluate(`(async () => {
  const response = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 2, playerFactionId: 1 }) });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
  return true;
})()`);
assert(createOk, '创建场景2（关东义兵）');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`), '命令坞渲染');

async function dismissEvents() {
  for (let i = 0; i < 8; i++) {
    const ids = await evaluate(`(async () => (await (await fetch('/api/game/state')).json()).pendingEvents ?? [])()`);
    if (!Array.isArray(ids) || ids.length === 0) return true;
    for (const eventId of ids) {
      await evaluate(`(async () => { await fetch('/api/game/event/choose', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: ${eventId}, choiceIndex: 0 }) }); return true; })()`);
    }
    await pause(200);
  }
  return true;
}
await dismissEvents();
await pause(500);

// 打开内政域 → 产业分面
await evaluate(`(async () => { document.querySelector('[data-testid="command-domain-civil"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-civil-drawer"]')`), '内政抽屉打开');
await evaluate(`(async () => { document.querySelector('[data-testid="command-civil-facet-industry"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-civil-culture-progress"]')`), '产业分面渲染文化进度区');

// 初始只读预览：0/999 · Lv0/5 · 距 Lv1 门槛 100 还需 100 点
const initialCulture = await evaluate(`return document.querySelector('[data-testid="command-civil-value-culture"]')?.textContent`);
assert(initialCulture === '0', `文化积累初值显示 0（${initialCulture}）`);
const progressInfo = await evaluate(`(() => { const p = document.querySelector('[data-testid="command-civil-culture-progress"] progress'); return p ? { value: Number(p.getAttribute('value')), max: Number(p.getAttribute('max')) } : null; })()`);
assert(progressInfo && progressInfo.value === 0 && progressInfo.max === 999, `原生进度条 value/max = ${progressInfo && `${progressInfo.value}/${progressInfo.max}`}`);
const initialLevel = await evaluate(`return document.querySelector('[data-testid="command-civil-culture-level"]')?.textContent`);
assert(initialLevel === 'Lv0/5', `技艺门槛等级 Lv0/5（${initialLevel}）`);
const initialThreshold = await evaluate(`return document.querySelector('[data-testid="command-civil-culture-threshold"]')?.textContent ?? ''`);
assert(initialThreshold.includes('距 Lv1 门槛 100 还需 100 点') && initialThreshold.includes('只读'), '下一门槛与差值文案正确且标注只读');

// 点击「发展文化」→ 终审对话框
await evaluate(`(async () => { document.querySelector('[data-testid="command-civil-culture"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-confirm-dialog"]')`), '终审对话框出现');
const dialogText = await evaluate(`return document.querySelector('[data-testid="command-confirm-dialog"]')?.textContent ?? ''`);
assert(dialogText.includes('发展文化'), '终审标题含「发展文化」');
assert(dialogText.includes('首付120金 / 总计360金'), '终审展示首付/总计成本');
assert(dialogText.includes('持续6个月；完成后文化+60'), '终审展示工期与收益摘要');

const goldBefore = await evaluate(`(async () => { const s = await (await fetch('/api/game/state')).json(); const c = Object.values(s.cities).find((x) => x.ruler === s.playerFactionId && x.isCapital); return c.gold; })()`);

// 确认提交 → 项目启动
await evaluate(`(async () => { document.querySelector('[data-testid="command-confirm-submit"]')?.click(); return true; })()`);
assert(await waitFor(`return !document.querySelector('[data-testid="command-confirm-dialog"]')`), '确认后对话框关闭');
const goldAfterStart = await evaluate(`(async () => { const s = await (await fetch('/api/game/state')).json(); const c = Object.values(s.cities).find((x) => x.ruler === s.playerFactionId && x.isCapital); return c.gold; })()`);
assert(goldAfterStart === goldBefore - 120, `首付扣金120（${goldBefore}→${goldAfterStart}）`);

// 总览分面出现持续项目卡片
await evaluate(`(async () => { document.querySelector('[data-testid="command-civil-facet-overview"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="civil-active-project"]')`), '总览显示持续项目卡片');
const projectText = await evaluate(`return document.querySelector('[data-testid="civil-active-project"]')?.textContent ?? ''`);
assert(projectText.includes('文化') && projectText.includes('剩余6个月') && projectText.includes('已付120/360金'), `项目卡片为文化·剩余6月·已付120/360（${projectText.slice(0, 40)}…）`);

// 重复发起守卫：产业分面再点发展文化，客户端校验应报“已有持续项目”
await evaluate(`(async () => { document.querySelector('[data-testid="command-civil-facet-industry"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-civil-culture-progress"]')`), '回到产业分面');
await evaluate(`(async () => { document.querySelector('[data-testid="command-civil-culture"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-confirm-dialog"]')`), '重复发起弹出终审');
await evaluate(`(async () => { document.querySelector('[data-testid="command-confirm-submit"]')?.click(); return true; })()`);
assert(await waitFor(`return (document.querySelector('[data-testid="command-confirm-error"]')?.textContent ?? '').includes('已有')`), '重复发起被客户端门禁拦截');

const goldAfterGuard = await evaluate(`(async () => { const s = await (await fetch('/api/game/state')).json(); const c = Object.values(s.cities).find((x) => x.ruler === s.playerFactionId && x.isCapital); return c.gold; })()`);
assert(goldAfterGuard === goldAfterStart, '守卫拦截不重复扣金');
await evaluate(`(async () => { document.querySelector('[data-testid="command-confirm-cancel"]')?.click(); return true; })()`);
assert(await waitFor(`return !document.querySelector('[data-testid="command-confirm-dialog"]')`), '取消关闭终审');

// 推进6个月（处理随机事件）→ 项目完成
async function endTurnOnce(label) {
  const before = await evaluate(`(async () => (await (await fetch('/api/game/state')).json()).currentMonth)()`);
  for (let attempt = 0; attempt < 4; attempt++) {
    const ok = await evaluate(`(async () => { const r = await fetch('/api/game/end-turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); return r.ok; })()`);
    if (ok) break;
    await dismissEvents();
    await pause(300);
  }
  const changed = await waitFor(`(async () => { const s = await (await fetch('/api/game/state')).json(); return s.currentMonth !== ${before}; })()`, 8000);
  assert(changed, label);
}
for (let month = 1; month <= 6; month++) {
  await endTurnOnce(`推进第${month}个月`);
}
const afterMonths = await fetchState();
const capitalAfter = Object.values(afterMonths.cities).find((c) => c.ruler === afterMonths.playerFactionId && c.isCapital);
assert(capitalAfter.activeDevelopment == null, '6个月后持续项目完成并清除');
assert((capitalAfter.stats.culture ?? 0) === 60, `完成文化+60（${capitalAfter.stats.culture}）`);

// 刷新客户端同步 store，再验 UI 只读预览更新
await evaluate(`(async () => { location.reload(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`), '刷新后命令坞渲染');
await evaluate(`(async () => { document.querySelector('[data-testid="command-domain-civil"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-civil-drawer"]')`), '内政抽屉打开');
await evaluate(`(async () => { document.querySelector('[data-testid="command-civil-facet-industry"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-civil-culture-progress"]')`), '产业分面渲染');
const finalCulture = await evaluate(`return document.querySelector('[data-testid="command-civil-value-culture"]')?.textContent`);
assert(finalCulture === '60', `文化积累显示 60（${finalCulture}）`);
const finalProgress = await evaluate(`(() => { const p = document.querySelector('[data-testid="command-civil-culture-progress"] progress'); return p ? Number(p.getAttribute('value')) : null; })()`);
assert(finalProgress === 60, `进度条推进到 60（${finalProgress}）`);
const finalThreshold = await evaluate(`return document.querySelector('[data-testid="command-civil-culture-threshold"]')?.textContent ?? ''`);
assert(finalThreshold.includes('距 Lv1 门槛 100 还需 40 点'), `差值文案更新为还需40（${finalThreshold.slice(0, 30)}…）`);

assert(consoleErrors.length === 0, `无控制台错误（${consoleErrors.length}）`);

console.log(`\n${pass} passed, ${fail} failed`);
ws.close();
process.exit(fail > 0 ? 1 : 0);
