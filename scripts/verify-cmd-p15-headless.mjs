// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P15 外交原子切换与点化情报归域浏览器验收。
 * Prerequisites: pnpm dev + 1440×900 Chrome CDP 9238。
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P15 Headless：未找到 Chrome page target');
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
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await evaluate(`
  const created = await fetch('/api/game/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!created.ok) throw new Error('创建英雄集结曹操局失败：' + await created.text());
  let game = await created.json();
  const cities = Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId && (city.beautySeekLeft ?? 0) > 0);
  for (let attempt = 0; attempt < 20 && (game.factions[game.playerFactionId].beautyStock ?? 0) < 1; attempt += 1) {
    const city = cities.find((entry) => game.cities[entry.id].gold >= 60);
    if (!city) throw new Error('寻访建立库存时无可支付城池');
    const response = await fetch('/api/game/civil/seek-beauty', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: city.id }),
    });
    if (!response.ok) throw new Error('寻访失败：' + await response.text());
    game = await response.json();
  }
  if ((game.factions[game.playerFactionId].beautyStock ?? 0) < 1) {
    throw new Error('20次正式寻访仍未建立美女库存');
  }
  location.reload();
`);
await pause(1500);

const result = await evaluate(`
  const pause = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const all = (selector) => [...document.querySelectorAll(selector)];
  const state = async () => (await fetch('/api/game/state')).json();
  const linkOf = (game, targetId) => game.diplomacy.find((entry) =>
    (entry.factionA === game.playerFactionId && entry.factionB === targetId) ||
    (entry.factionB === game.playerFactionId && entry.factionA === targetId));
  const snapshot = (game) => JSON.stringify({
    factions: game.factions, cities: game.cities, diplomacy: game.diplomacy,
    intel: game.intel, actionLog: game.actionLog, rng: game.rng,
  });
  for (let i = 0; i < 60 && !by('command-domain-diplomacy'); i += 1) await pause(50);
  if (!by('command-domain-diplomacy')) throw new Error('命令坞未就绪');

  const left = by('left-panel');
  const oldDiplomacyTriggers = [...left.querySelectorAll('button')]
    .filter((button) => button.innerText.trim().split('\\n')[0] === '外交');
  const legacyDom = oldDiplomacyTriggers.length
    + all('[data-testid^="dip-faction-"]').length
    + all('[data-testid^="btn-gift-beauty-"]').length
    + all('[data-testid^="btn-plant-female-"]').length;
  if (legacyDom !== 0) throw new Error('旧外交 DOM 未物理删除：' + legacyDom);

  let game = await state();
  const target = Object.values(game.factions).find((faction) =>
    faction.id !== game.playerFactionId && faction.isAlive &&
    String(linkOf(game, faction.id)?.relation ?? 'neutral') !== 'war');
  if (!target) throw new Error('缺少非战争外交目标');

  by('command-domain-diplomacy').click(); await pause();
  const select = by('command-diplomacy-target');
  select.value = String(target.id);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  by('command-diplomacy-facet-negotiation').click(); await pause();
  if (all('[data-testid="command-diplomacy-gift-beauty"]').length !== 1) {
    throw new Error('新外交献美入口不是唯一一份');
  }
  const beforeGift = await state();
  by('command-diplomacy-gift-beauty').click(); await pause();
  if (!by('command-confirm-dialog')?.innerText.includes('确认献美')) throw new Error('献美未进入终审');
  by('command-confirm-submit').click(); await pause(650);
  const afterGift = await state();
  if ((afterGift.intel?.plantableBeauty?.[target.id] ?? 0) !==
      (beforeGift.intel?.plantableBeauty?.[target.id] ?? 0) + 1) {
    throw new Error('新外交献美未增加点化额度');
  }

  by('command-drawer-close').click(); await pause();
  const intelTrigger = [...left.querySelectorAll('button')]
    .find((button) => button.innerText.trim().split('\\n')[0] === '谍报');
  if (!intelTrigger) throw new Error('左栏谍报入口缺失');
  intelTrigger.click(); await pause();
  if (all('[data-testid="intel-plant-female"]').length !== 1) {
    throw new Error('情报点化入口不是唯一一份');
  }
  const plantSelect = by('intel-plant-female-target');
  plantSelect.value = String(target.id);
  plantSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  if (by('intel-plant-female').disabled) throw new Error('献美后情报点化仍禁用');

  const beforeCancel = await state();
  by('intel-plant-female').click(); await pause();
  if (!by('command-confirm-dialog')?.innerText.includes('确认点化女间谍')) throw new Error('点化未进入谍报终审');
  by('command-confirm-cancel').click(); await pause();
  if (snapshot(await state()) !== snapshot(beforeCancel)) throw new Error('点化取消改变权威状态');

  const beforePlant = await state();
  const agentsBefore = Object.keys(beforePlant.intel?.agents ?? {}).length;
  by('intel-plant-female').click(); await pause();
  by('command-confirm-submit').click(); await pause(650);
  const afterPlant = await state();
  const agentsAfter = Object.keys(afterPlant.intel?.agents ?? {}).length;
  if (agentsAfter !== agentsBefore + 1) throw new Error('点化未生成一名女间谍');
  if ((afterPlant.intel?.plantableBeauty?.[target.id] ?? 0) !==
      (beforePlant.intel?.plantableBeauty?.[target.id] ?? 0) - 1) {
    throw new Error('点化未扣除额度1');
  }
  if (afterPlant.actionLog[0]?.type !== 'spy_plant_female') throw new Error('点化日志缺失');
  const newAgents = Object.values(afterPlant.intel.agents)
    .filter((agent) => !beforePlant.intel.agents[agent.id]);
  if (newAgents.length !== 1 || newAgents[0].agentKind !== 'female') {
    throw new Error('点化生成对象不是女间谍');
  }

  return {
    viewport: '1440x900',
    legacyDiplomacyDom: legacyDom,
    diplomacyGiftEntryCount: 1,
    intelPlantEntryCount: 1,
    plantFlow: '取消不变；确认额度-1并生成女间谍',
    actionLog: afterPlant.actionLog[0].type,
  };
`);
if (consoleErrors.length) throw new Error(`CMD-P15 Headless 控制台错误：${consoleErrors.join(' | ')}`);
console.log(JSON.stringify({ ...result, consoleErrors: 0 }, null, 2));
ws.close();
