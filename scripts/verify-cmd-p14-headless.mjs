// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P14 外交盟约（结盟）浏览器验收。
 * Prerequisites: pnpm dev + 1440×900 Chrome CDP 9238。
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P14 Headless：未找到 Chrome page target');
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
  return result.result.result.value;
}
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error('创建英雄集结曹操局失败：' + await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1400));

const result = await evaluate(`
  const pause = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const state = async () => (await fetch('/api/game/state')).json();
  const linkOf = (game, targetId) => game.diplomacy.find((entry) =>
    (entry.factionA === game.playerFactionId && entry.factionB === targetId) ||
    (entry.factionB === game.playerFactionId && entry.factionA === targetId));
  const totalGold = (game) => Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId)
    .reduce((sum, city) => sum + city.gold, 0);
  const snapshot = (game) => JSON.stringify({
    factions: game.factions, cities: game.cities, diplomacy: game.diplomacy,
    actionLog: game.actionLog, rng: game.rng,
  });
  const submit = async () => {
    const button = byTestId('command-confirm-submit');
    if (!button || button.disabled) throw new Error('终审提交缺失或禁用');
    button.click();
    await pause(650);
  };
  const initial = await state();
  const target = Object.values(initial.factions).find((faction) => {
    if (faction.id === initial.playerFactionId || !faction.isAlive) return false;
    return String(linkOf(initial, faction.id)?.relation ?? 'neutral') !== 'war';
  });
  const warTarget = Object.values(initial.factions).find((faction) =>
    faction.id !== initial.playerFactionId && faction.isAlive &&
    String(linkOf(initial, faction.id)?.relation ?? 'neutral') === 'war');
  if (!target || !warTarget) throw new Error('缺少非战争/战争外交目标');

  byTestId('command-domain-diplomacy').click();
  await pause();
  const select = byTestId('command-diplomacy-target');
  select.value = String(target.id);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  byTestId('command-diplomacy-facet-treaty').click();
  await pause();
  if (!byTestId('command-diplomacy-treaty')) throw new Error('盟约分面缺失');
  const initialAlliance = byTestId('command-diplomacy-alliance');
  if (!initialAlliance.disabled || !byTestId('command-diplomacy-alliance-reason')?.innerText.includes('友好不足')) {
    throw new Error('友好不足结盟门禁错误');
  }

  // 用已迁移的新进贡入口达到友好门槛。
  byTestId('command-diplomacy-facet-negotiation').click();
  await pause();
  let current = await state();
  const tributeCount = Math.max(0, Math.ceil((30 - (linkOf(current, target.id)?.favorability ?? 0)) / 15));
  for (let index = 0; index < tributeCount; index += 1) {
    byTestId('command-diplomacy-tribute').click();
    await pause();
    await submit();
  }
  byTestId('command-diplomacy-facet-treaty').click();
  await pause();
  const alliance = byTestId('command-diplomacy-alliance');
  if (!alliance || alliance.disabled) throw new Error('友好达到30后结盟未启用');
  const treatyText = byTestId('command-diplomacy-treaty').innerText;
  if (!treatyText.includes('当前成功率') || !treatyText.includes('使者')) {
    throw new Error('盟约成功率/使者摘要缺失');
  }

  // 取消不消费金/RNG，确认无论成败均扣500并写 alliance。
  let before = await state();
  alliance.click();
  await pause();
  const dialog = byTestId('command-confirm-dialog');
  if (!dialog?.innerText.includes('确认结盟') || !dialog.innerText.includes('成功率') ||
      !dialog.innerText.includes('失败后果')) {
    throw new Error('结盟终审摘要不完整');
  }
  byTestId('command-confirm-cancel').click();
  await pause();
  if (snapshot(await state()) !== snapshot(before)) throw new Error('结盟取消后权威状态变化');

  byTestId('command-diplomacy-alliance').click();
  await pause();
  await submit();
  const after = await state();
  if (totalGold(after) !== totalGold(before) - 500) throw new Error('结盟未权威扣金500');
  if (after.actionLog[0]?.type !== 'alliance' || !after.actionLog[0]?.message.includes('成功率')) {
    throw new Error('结盟权威日志缺失成功率');
  }
  const afterRelation = String(linkOf(after, target.id)?.relation ?? 'neutral');
  const beforeRelation = String(linkOf(before, target.id)?.relation ?? 'neutral');
  if (afterRelation !== 'allied' && afterRelation !== beforeRelation) {
    throw new Error('结盟失败不应改变关系，成功应变为allied');
  }

  // 战争目标始终禁用；未实装盟约不造假按钮；点化仍无入口。
  select.value = String(warTarget.id);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  if (!byTestId('command-diplomacy-alliance').disabled ||
      !byTestId('command-diplomacy-alliance-reason')?.innerText.includes('交战')) {
    throw new Error('战争目标结盟门禁错误');
  }
  const fakeTreaties = [...byTestId('command-diplomacy-drawer').querySelectorAll('button')]
    .filter((button) => /停战|互不侵犯|求援|借道|点化/.test(button.innerText));
  if (fakeTreaties.length) throw new Error('外交抽屉出现未实装盟约/点化假按钮');

  return {
    viewport: '1440x900',
    threshold: '新进贡' + tributeCount + '次达到友好30',
    alliance: '取消不变；确认扣金500并消费权威判定',
    outcome: afterRelation === 'allied' ? '成功→allied' : '失败→关系不变',
    warGate: '战争目标结盟禁用并显示原因',
    fakeTreatyActions: fakeTreaties.length,
  };
`);
if (consoleErrors.length) throw new Error(`CMD-P14 Headless 控制台错误：${consoleErrors.join(' | ')}`);
console.log(JSON.stringify({ ...result, consoleErrors }, null, 2));
ws.close();
