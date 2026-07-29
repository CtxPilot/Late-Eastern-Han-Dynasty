// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P11 旧外交入口浏览器基线。
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --window-size=1440,900 \
 *     --remote-debugging-port=9238 http://127.0.0.1:5173
 *
 * Optional:
 *   CDP_PORT=9238 node scripts/verify-cmd-p11-headless.mjs
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P11 Headless：未找到 Chrome page target');

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
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
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
  const exactButton = (text) => [...document.querySelectorAll('button')]
    .find((button) => button.innerText.trim() === text);
  const state = async () => {
    const response = await fetch('/api/game/state');
    if (!response.ok) throw new Error('读取权威状态失败：' + await response.text());
    return response.json();
  };
  const snapshot = (game) => JSON.stringify({
    factions: game.factions,
    cities: game.cities,
    diplomacy: game.diplomacy,
    intel: game.intel,
    actionLog: game.actionLog,
    rng: game.rng,
  });
  const submit = async () => {
    const button = byTestId('command-confirm-submit');
    if (!button || button.disabled) throw new Error('终审提交按钮缺失或禁用');
    button.click();
    await pause(650);
  };
  const cancelAndAssert = async (before, label) => {
    const cancel = byTestId('command-confirm-cancel');
    if (!cancel) throw new Error(label + '取消按钮缺失');
    cancel.click();
    await pause();
    if (snapshot(await state()) !== snapshot(before)) throw new Error(label + '取消后权威状态变化');
  };

  const oldTrigger = [...byTestId('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().split('\\n')[0] === '外交');
  if (!oldTrigger) throw new Error('旧外交手风琴入口缺失');
  oldTrigger.click();
  await pause();
  const cards = [...document.querySelectorAll('[data-testid^="dip-faction-"]')];
  if (cards.length !== 3) throw new Error('英雄集结外交目标应为3，实际' + cards.length);

  const neutralCard = cards.find((card) => {
    const gift = card.querySelector('[data-testid^="btn-gift-beauty-"]');
    const alliance = [...card.querySelectorAll('button')].find((button) => button.innerText.includes('结盟'));
    return gift && !gift.disabled && alliance && !card.innerText.includes('交战');
  }) ?? cards.find((card) => !card.innerText.includes('交战'));
  if (!neutralCard) throw new Error('找不到非战争外交目标');
  const targetId = Number(neutralCard.dataset.testid.replace('dip-faction-', ''));

  const warCard = cards.find((card) => card.innerText.includes('交战'));
  if (!warCard) throw new Error('找不到战争关系目标以验证门禁');
  const warGift = warCard.querySelector('[data-testid^="btn-gift-beauty-"]');
  const warAlliance = [...warCard.querySelectorAll('button')].find((button) => button.innerText.includes('结盟'));
  if (!warGift?.disabled || !warAlliance?.disabled || !warCard.innerText.includes('交战中不可结盟')) {
    throw new Error('战争目标献美/结盟门禁基线错误');
  }

  // 进贡：取消不提交；连续确认直至把当前友好推至结盟门槛。
  let before = await state();
  const initialLink = before.diplomacy.find((entry) =>
    (entry.factionA === before.playerFactionId && entry.factionB === targetId) ||
    (entry.factionB === before.playerFactionId && entry.factionA === targetId));
  const initialFavor = initialLink?.favorability ?? 0;
  neutralCard.querySelector('button').click();
  await pause();
  if (!byTestId('command-confirm-dialog')?.innerText.includes('确认进贡')) throw new Error('进贡终审标题错误');
  await cancelAndAssert(before, '进贡');
  const tributeCount = Math.ceil((30 - initialFavor) / 15);
  for (let index = 0; index < tributeCount; index += 1) {
    [...document.querySelectorAll('[data-testid="dip-faction-' + targetId + '"] button')]
      .find((button) => button.innerText.trim() === '进贡').click();
    await pause();
    await submit();
  }
  let after = await state();
  const link = after.diplomacy.find((entry) =>
    (entry.factionA === after.playerFactionId && entry.factionB === targetId) ||
    (entry.factionB === after.playerFactionId && entry.factionA === targetId));
  if (link?.favorability !== Math.min(100, initialFavor + tributeCount * 15) || link.favorability < 30 || after.actionLog[0]?.type !== 'tribute') {
    throw new Error('进贡断言失败：initial=' + initialFavor + ' count=' + tributeCount + ' after=' + link?.favorability + ' log=' + after.actionLog[0]?.type);
  }

  // 结盟：取消不消费 RNG/金钱；确认必写 alliance 日志，成功或失败均属权威结果。
  const allianceButton = [...document.querySelectorAll('[data-testid="dip-faction-' + targetId + '"] button')]
    .find((button) => button.innerText.includes('结盟'));
  if (!allianceButton || allianceButton.disabled) throw new Error('友好30后结盟未启用');
  before = await state();
  allianceButton.click();
  await pause();
  const dialogText = byTestId('command-confirm-dialog')?.innerText ?? '';
  if (!dialogText.includes('确认结盟') || !dialogText.includes('成功率') || !dialogText.includes('金 500')) {
    throw new Error('结盟终审摘要不完整');
  }
  await cancelAndAssert(before, '结盟');
  [...document.querySelectorAll('[data-testid="dip-faction-' + targetId + '"] button')]
    .find((button) => button.innerText.includes('结盟')).click();
  await pause();
  await submit();
  after = await state();
  if (after.actionLog[0]?.type !== 'alliance') throw new Error('结盟未写 alliance 权威日志');

  // 点化按钮虽然混排在旧外交卡片，唯一写链路属于 intel；本基线不把它算作外交提交。
  const plantButtons = document.querySelectorAll('[data-testid^="btn-plant-female-"]');
  if (plantButtons.length !== 3) throw new Error('点化跨域按钮数量与外交目标不一致');

  return {
    viewport: '1440x900',
    targets: cards.length,
    tribute: '取消不变；连续确认至友好30并写 tribute（次数' + tributeCount + '）',
    alliance: '取消不变；确认消费权威判定并写 alliance',
    warGate: '战争目标献美、结盟禁用且显示原因',
    crossDomain: '点化按钮3个；归属情报 /intel/plant-female，不计作外交写入口',
  };
`);

if (consoleErrors.length) {
  throw new Error(`CMD-P11 Headless 控制台错误：${consoleErrors.join(' | ')}`);
}
console.log(JSON.stringify({ ...result, consoleErrors }, null, 2));
ws.close();
