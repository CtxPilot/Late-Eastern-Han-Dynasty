// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 369：S18 家属质任待决处置弹窗真实点击验收。
 * 前置与 Session 351 一致：经合法存档导入链注入 pendingFamilyTreatment（HTTP 链当时已验收），
 * 本脚本只补 DOM 点击：TopBar 门禁 → 三选一 → 写入处置 → 解除回合阻塞。
 */
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

const createOk = await evaluate(`(async () => {
  const response = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 2, playerFactionId: 1 }) });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
  return true;
})()`);
assert(createOk, '创建场景2（关东义兵）');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`), '命令坞渲染');

// 经合法导出→改注待决项→导入 链构造待决状态（同 Session 351 的 HTTP 验收前置）
const importResult = await evaluate(`(async () => {
  const envelope = await (await fetch('/api/game/save/export')).json();
  const snapshot = envelope.snapshot;
  const playerFactionId = snapshot.playerFactionId;
  const capturedCity = Object.values(snapshot.cities).find((c) => c.ruler === playerFactionId && c.isCapital)
    ?? Object.values(snapshot.cities).find((c) => c.ruler === playerFactionId);
  if (!capturedCity) return { ok: false, error: '没有玩家城' };
  const previousRuler = Object.values(snapshot.cities).find((c) => c.ruler !== playerFactionId)?.ruler;
  if (!previousRuler) return { ok: false, error: '没有旧主势力' };
  const affectedCityIds = Object.values(snapshot.cities)
    .filter((c) => c.ruler === previousRuler)
    .slice(0, 2)
    .map((c) => c.id);
  capturedCity.garrisonFamilies = 800;
  snapshot.pendingFamilyTreatment = {
    cityId: capturedCity.id,
    previousFactionId: previousRuler,
    familyCount: 1200,
    affectedCityIds,
  };
  const response = await fetch('/api/game/save/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(envelope) });
  if (!response.ok) return { ok: false, error: await response.text() };
  return { ok: true, cityId: capturedCity.id, cityName: capturedCity.name };
})()`);
assert(importResult.ok === true, `导入含家属待决项的存档（城：${importResult.cityName ?? importResult.error}）`);

await evaluate(`(async () => { location.reload(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="family-treatment-dialog"]')`), '刷新后全局待决弹窗出现');

const dialogText = await evaluate(`return document.querySelector('[data-testid="family-treatment-dialog"]')?.textContent ?? ''`);
assert(dialogText.includes('家属质任'), '弹窗标题为家属质任');
assert(dialogText.includes(String(importResult.cityName)), `弹窗显示失陷城名（${importResult.cityName}）`);
assert(dialogText.includes('1200'), '弹窗显示家属口数');
for (const mode of ['kindness', 'neutral', 'repression']) {
  const label = { kindness: '善待', neutral: '中立', repression: '镇压' }[mode];
  const exists = await evaluate(`return !!document.querySelector('[data-testid="family-treatment-${mode}"]')`);
  assert(exists, `三选一按钮存在：${label}`);
}

const endTurnState = await evaluate(`(() => { const b = document.querySelector('[data-testid="btn-end-turn"]'); return b ? { text: b.textContent, disabled: b.disabled } : null; })()`);
assert(endTurnState && endTurnState.text.includes('待处置家属') && endTurnState.disabled === true, '结束回合按钮被门禁禁用');

// 真实点击「善待」
await evaluate(`(async () => { document.querySelector('[data-testid="family-treatment-kindness"]')?.click(); return true; })()`);
assert(await waitFor(`return !document.querySelector('[data-testid="family-treatment-dialog"]')`), '点击善待后弹窗关闭');

const afterChoose = await evaluate(`(async () => {
  const s = await (await fetch('/api/game/state')).json();
  return { pending: s.pendingFamilyTreatment ?? null, treatment: s.cities[${importResult.cityId}]?.familyTreatment ?? null };
})()`);
assert(afterChoose.pending === null, '待决项已清除');
assert(afterChoose.treatment && afterChoose.treatment.mode === 'kindness', `处置写入 kindness（${afterChoose.treatment && afterChoose.treatment.mode}）`);

// 门禁解除后真实点击结束回合
assert(await waitFor(`return document.querySelector('[data-testid="btn-end-turn"]')?.textContent.includes('结束回合') === true`), '门禁解除，按钮恢复结束回合');

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
const monthBefore = await evaluate(`(async () => (await (await fetch('/api/game/state')).json()).currentMonth)()`);
await evaluate(`(async () => { document.querySelector('[data-testid="btn-end-turn"]')?.click(); return true; })()`);
assert(await waitFor(`(async () => { const s = await (await fetch('/api/game/state')).json(); return s.currentMonth !== ${monthBefore}; })()`, 8000), '真实点击结束后合推进月份');

assert(consoleErrors.length === 0, `无控制台错误（${consoleErrors.length}）`);

console.log(`\n${pass} passed, ${fail} failed`);
ws.close();
process.exit(fail > 0 ? 1 : 0);
