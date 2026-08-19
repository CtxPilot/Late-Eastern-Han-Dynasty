// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 345：军屯田 UI 走通（屯田域 → 开启军屯 → 终审 → 月结产粮 → 季度扣士气）。 */
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

// 场景2（关东义兵）曹操势力（faction 1，首城陈留）
const createOk = await evaluate(`(async () => {
  const response = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 2, playerFactionId: 1 }) });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
  return true;
})()`);
assert(createOk, '创建场景2（关东义兵）');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-farming"]')`), '命令坞渲染');

// 处理待决事件（API 直选首个选项；UI 事件对话框依赖 store 同步，此处不验证其渲染）
async function dismissEvents() {
  for (let i = 0; i < 8; i++) {
    const ids = await evaluate(`(async () => {
      const s = await (await fetch('/api/game/state')).json();
      return s.pendingEvents ?? [];
    })()`);
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

// 打开屯田域
await evaluate(`(async () => { document.querySelector('[data-testid="command-domain-farming"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-farming-drawer"]')`), '屯田抽屉打开');

// 军屯状态初始为关
const initialOff = await evaluate(`
  return document.querySelector('[data-testid="command-military-farming-toggle"]')?.textContent.includes('开启军屯')
`);
assert(initialOff, '军屯初始为关（按钮显示「开启军屯」）');

// 点开启 → 终审对话框
await evaluate(`(async () => { document.querySelector('[data-testid="command-military-farming-toggle"]')?.click(); return true; })()`);
assert(await waitFor(`return document.querySelector('[data-testid="command-confirm-dialog"]')?.textContent.includes('开启') === true`), '终审对话框出现（开启军屯）');

// 确认
await evaluate(`(async () => { document.querySelector('[data-testid="command-confirm-submit"]')?.click(); return true; })()`);
assert(await waitFor(`return document.querySelector('[data-testid="command-military-farming-toggle"]')?.textContent.includes('停办军屯') === true`), '确认后按钮变为「停办军屯」');
const lockedNow = await evaluate(`return document.querySelector('[data-testid="command-farming-military"]')?.textContent.includes('本季已调')`);
assert(lockedNow, '本季已调提示出现（季度锁）');

// 推进一月（190-02，非季度首月）
async function endTurnOnce() {
  const before = await evaluate(`(async () => { const s = await (await fetch('/api/game/state')).json(); return s.currentMonth; })()`);
  for (let attempt = 0; attempt < 3; attempt++) {
    const ok = await evaluate(`(async () => {
      const r = await fetch('/api/game/end-turn', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) return false;
      return true;
    })()`);
    if (ok) break;
    await dismissEvents();
    await pause(300);
  }
  return waitFor(`(async () => { const s = await (await fetch('/api/game/state')).json(); return s.currentMonth !== ${before}; })()`, 8000);
}
assert(await endTurnOnce(), '推进一月至 190-02');
const afterTurn = await evaluate(`
  (async () => {
    const state = await (await fetch('/api/game/state')).json();
    const city = state.cities[Object.values(state.cities).find((c) => c.ruler === state.playerFactionId)?.id ?? 0];
    return { month: state.currentMonth, morale: city.troopsMorale, on: city.militaryFarming };
  })()
`);
assert(afterTurn.on === true, '军屯保持开启');
assert(afterTurn.morale === 70, `非季度首月不扣士气（${afterTurn.morale}）`);

// 连推至 4 月（季度首月）扣士气
assert(await endTurnOnce(), '推进至 190-03');
assert(await endTurnOnce(), '推进至 190-04（季度首月）');
const quarterResult = await evaluate(`
  (async () => {
    const state = await (await fetch('/api/game/state')).json();
    const city = state.cities[Object.values(state.cities).find((c) => c.ruler === state.playerFactionId)?.id ?? 0];
    return { month: state.currentMonth, morale: city.troopsMorale };
  })()
`);
assert(quarterResult.month === 4, `推进至季度首月 190-04（${quarterResult.month}）`);
assert(quarterResult.morale === 67, `季度首月士气扣 3（70→${quarterResult.morale}）`);

// 刷新客户端（推进后 store 未同步），重开屯田抽屉验证季度解锁
await evaluate(`(async () => { location.reload(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-farming"]')`), '刷新后命令坞渲染');
await evaluate(`(async () => { document.querySelector('[data-testid="command-domain-farming"]')?.click(); return true; })()`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-farming-drawer"]')`), '刷新后屯田抽屉打开');

// 新季度解锁 → 关闭军屯
const unlockOk = await evaluate(`
  return !(document.querySelector('[data-testid="command-farming-military"]')?.textContent ?? '').includes('本季已调')
`);
assert(unlockOk, '新季度解锁（本季已调提示消失）');
await evaluate(`(async () => { document.querySelector('[data-testid="command-military-farming-toggle"]')?.click(); return true; })()`);
await pause(300);
await evaluate(`(async () => { document.querySelector('[data-testid="command-confirm-submit"]')?.click(); return true; })()`);
assert(await waitFor(`return document.querySelector('[data-testid="command-military-farming-toggle"]')?.textContent.includes('开启军屯') === true`), '确认后按钮恢复「开启军屯」（已停办）');

assert(consoleErrors.length === 0, `无控制台错误（${consoleErrors.length}）`);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
