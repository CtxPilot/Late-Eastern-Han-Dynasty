// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** S10 R3 四倾向浏览器验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('R3 Headless：未找到 Chrome page target');
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
  const result = await command('Runtime.evaluate', {
    expression: `(async()=>{${expression}})()`,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.result?.exceptionDetails) {
    throw new Error(result.result.exceptionDetails.exception?.description ?? result.result.exceptionDetails.text);
  }
  if (result.error) throw new Error(result.error.message);
  return result.result.result.value;
}
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await command('Page.navigate', { url: 'http://127.0.0.1:5173/' });
await new Promise((resolve) => setTimeout(resolve, 1000));
await evaluate(`
  const create = await fetch('/api/game/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!create.ok) throw new Error('创建英雄集结曹操局失败：' + await create.text());
  const state = await create.json();
  const started = await fetch('/api/game/battle/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cityId: 19 }),
  });
  if (!started.ok) throw new Error('创建战斗失败：' + await started.text());
  location.href = '/';
`);
await new Promise((resolve) => setTimeout(resolve, 3000));
consoleErrors.length = 0;
const result = await evaluate(`
  const pause = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  for (let i = 0; i < 60 && !document.querySelector('canvas'); i += 1) await pause(50);
  const battle = await (await fetch('/api/game/battle')).json();
  const attacker = battle.units.find((unit) => unit.side === 'attacker');
  const canvas = document.querySelector('canvas');
  if (!attacker || !canvas) throw new Error('战斗画布或攻方单位缺失');
  const rect = canvas.getBoundingClientRect();
  const size = 28;
  const x = rect.left + 50 + size * (Math.sqrt(3) * attacker.position.q + Math.sqrt(3) / 2 * attacker.position.r);
  const y = rect.top + 50 + size * (3 / 2 * attacker.position.r);
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  }
  await pause();
  if (!by('btn-duel')) throw new Error('选中攻方后未出现单挑按钮');
  by('btn-duel').click();
  await pause();
  if (!by('duel-stance-picker')) throw new Error('未出现四倾向选择器');
  const ids = ['assault', 'steady', 'bait', 'delegate'];
  for (const id of ids) if (!by('duel-stance-' + id)) throw new Error('缺少倾向：' + id);
  by('duel-stance-bait').click();
  await pause();
  const baitClass = by('duel-stance-bait').className;
  if (!baitClass.includes('bg-yellow-800')) throw new Error('诱敌选择未进入选中态');
  const invalid = await fetch('/api/game/battle/duel/challenge', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengerUnitId: 'atk-1', targetUnitId: 'def-1', stance: 'invalid' }),
  });
  if (invalid.status !== 400) throw new Error('服务端未拒绝非法倾向');
  return {
    viewport: [innerWidth, innerHeight],
    stanceButtons: ids.length,
    selected: 'bait',
    invalidStanceStatus: invalid.status,
  };
`);
await command('Runtime.disable');
ws.close();
if (consoleErrors.length) throw new Error(`控制台错误：${consoleErrors.join(' | ')}`);
console.log(JSON.stringify({ ...result, consoleErrors: 0 }, null, 2));
