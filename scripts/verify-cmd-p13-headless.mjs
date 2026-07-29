// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P13 外交交涉（进贡/献美）浏览器验收。
 * Prerequisites: pnpm dev + 1440×900 Chrome CDP 9238。
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P13 Headless：未找到 Chrome page target');
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
  if (!result.result?.result) throw new Error('CDP evaluate 失败：' + JSON.stringify(result));
  return result.result.result.value;
}
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  const snapshot = (game) => JSON.stringify({
    factions: game.factions, cities: game.cities, diplomacy: game.diplomacy,
    intel: game.intel, actionLog: game.actionLog, rng: game.rng,
  });
  const openNegotiation = async (targetId) => {
    byTestId('command-domain-diplomacy').click();
    await pause();
    const select = byTestId('command-diplomacy-target');
    select.value = String(targetId);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    byTestId('command-diplomacy-facet-negotiation').click();
    await pause();
  };
  const cancelAndAssert = async (before, label) => {
    byTestId('command-confirm-cancel').click();
    await pause();
    if (snapshot(await state()) !== snapshot(before)) throw new Error(label + '取消后权威状态变化');
  };
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

  await openNegotiation(target.id);
  if (!byTestId('command-diplomacy-negotiation')) throw new Error('交涉分面缺失');
  if (!byTestId('command-diplomacy-gift-beauty').disabled) throw new Error('零库存时献美应禁用');

  // 进贡取消 + 确认。
  let before = await state();
  byTestId('command-diplomacy-tribute').click();
  await pause();
  if (!byTestId('command-confirm-dialog')?.innerText.includes('确认进贡')) throw new Error('进贡终审标题错误');
  await cancelAndAssert(before, '进贡');
  byTestId('command-diplomacy-tribute').click();
  await pause();
  await submit();
  let after = await state();
  if ((linkOf(after, target.id)?.favorability ?? 0) !== Math.min(100, (linkOf(before, target.id)?.favorability ?? 0) + 15)) {
    throw new Error('进贡友好结算错误');
  }
  if (after.actionLog[0]?.type !== 'tribute') throw new Error('进贡日志缺失');

  // 用正式内政寻访建立库存；失败可重试，但不写测试专用状态。
  let stocked = after;
  const seekCities = Object.values(stocked.cities)
    .filter((city) => city.ruler === stocked.playerFactionId && (city.beautySeekLeft ?? 0) > 0);
  for (let attempt = 0; attempt < 20 && (stocked.factions[stocked.playerFactionId].beautyStock ?? 0) < 1; attempt += 1) {
    const city = seekCities.find((entry) => stocked.cities[entry.id].gold >= 60);
    if (!city) throw new Error('寻访建立库存时无可支付城池');
    const response = await fetch('/api/game/civil/seek-beauty', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: city.id }),
    });
    if (!response.ok) throw new Error('寻访失败：' + await response.text());
    stocked = await response.json();
  }
  if ((stocked.factions[stocked.playerFactionId].beautyStock ?? 0) < 1) throw new Error('20次寻访仍未建立美女库存');
  // 通过既有旧外交 action 拉回完整权威快照，避免测试接触 Zustand 内部。
  byTestId('command-drawer-close').click();
  await pause();
  const oldTrigger = [...byTestId('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().split('\\n')[0] === '外交');
  if (!oldTrigger) throw new Error('旧外交对照入口缺失');
  oldTrigger.click();
  await pause();
  const syncTribute = [...byTestId('dip-faction-' + target.id).querySelectorAll('button')]
    .find((button) => button.innerText.trim() === '进贡');
  syncTribute.click();
  await pause();
  await submit();
  await openNegotiation(target.id);
  const giftButton = byTestId('command-diplomacy-gift-beauty');
  if (!giftButton || giftButton.disabled) throw new Error('有库存且非战争时献美未启用');
  before = await state();
  giftButton.click();
  await pause();
  if (!byTestId('command-confirm-dialog')?.innerText.includes('确认献美')) throw new Error('献美终审标题错误');
  await cancelAndAssert(before, '献美');
  byTestId('command-diplomacy-gift-beauty').click();
  await pause();
  await submit();
  after = await state();
  if ((after.factions[after.playerFactionId].beautyStock ?? 0) !== (before.factions[before.playerFactionId].beautyStock ?? 0) - 1) {
    throw new Error('献美未扣己方库存1');
  }
  if ((linkOf(after, target.id)?.favorability ?? 0) !== Math.min(100, (linkOf(before, target.id)?.favorability ?? 0) + 12)) {
    throw new Error('献美友好结算错误');
  }
  if ((after.intel?.plantableBeauty?.[target.id] ?? 0) !== (before.intel?.plantableBeauty?.[target.id] ?? 0) + 1) {
    throw new Error('献美未增加点化额度1');
  }
  if (after.actionLog[0]?.type !== 'gift_beauty_dip') throw new Error('献美日志缺失');

  // 战争目标必须禁用献美；盟约仍无新提交按钮，点化仍不在本抽屉。
  byTestId('command-drawer-close').click();
  await pause();
  await openNegotiation(warTarget.id);
  if (!byTestId('command-diplomacy-gift-beauty').disabled ||
      !byTestId('command-diplomacy-gift-reason')?.innerText.includes('交战')) {
    throw new Error('战争目标献美门禁错误');
  }
  if (byTestId('command-diplomacy-drawer').innerText.includes('点化女间谍') &&
      document.querySelector('[data-testid^="command-diplomacy-plant"]')) {
    throw new Error('外交抽屉出现点化写入口');
  }
  const allianceWrites = [...byTestId('command-diplomacy-drawer').querySelectorAll('button')]
    .filter((button) => !button.disabled && button.innerText.includes('结盟'));
  if (allianceWrites.length) throw new Error('CMD-P13 提前迁移结盟写入口');

  return {
    viewport: '1440x900',
    tribute: '取消不变；确认友好+15并写 tribute',
    giftBeauty: '取消不变；确认己方库存-1、友好+12、点化额度+1；敌方库存由服务端专项覆盖',
    warGate: '战争目标献美禁用并显示原因',
    allianceWrites: allianceWrites.length,
    plantFemaleWrites: 0,
  };
`);
if (consoleErrors.length) throw new Error(`CMD-P13 Headless 控制台错误：${consoleErrors.join(' | ')}`);
console.log(JSON.stringify({ ...result, consoleErrors }, null, 2));
ws.close();
