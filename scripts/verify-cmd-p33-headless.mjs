// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P33 情报任务/反间/俘虏迁移。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P33 Headless：未找到 Chrome page target');
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
  let response = await fetch('/api/game/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error('创建英雄集结曹操局失败：' + await response.text());
  let game = await response.json();
  const city = Object.values(game.cities).find((entry) =>
    entry.ruler === game.playerFactionId && entry.gold >= 360 && entry.food >= 180);
  if (!city) throw new Error('缺少可招募密探的己方城');
  response = await fetch('/api/game/intel/recruit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cityId: city.id }),
  });
  if (!response.ok) throw new Error('正式招募密探失败：' + await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1500));
const result = await evaluate(`
  const pause = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const count = (id) => document.querySelectorAll('[data-testid="' + id + '"]').length;
  const click = async (id, ms = 350) => {
    const element = by(id);
    if (!element) throw new Error('缺少元素 ' + id);
    if (element.disabled) throw new Error('元素不可用 ' + id + '：' + (element.title || ''));
    element.click(); await pause(ms);
  };
  const choose = async (id, value) => {
    const select = by(id);
    if (!select) throw new Error('缺少选择器 ' + id);
    select.value = String(value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
  };
  const state = async () => (await fetch('/api/game/state')).json();
  const snapshot = (game) => JSON.stringify({
    cities: game.cities, factions: game.factions, intel: game.intel,
    actionLog: game.actionLog, rng: game.rng,
  });
  for (let i = 0; i < 60 && !by('command-domain-intel'); i += 1) await pause(50);
  const intelTrigger = [...by('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith('谍报'));
  if (!intelTrigger) throw new Error('旧谍报入口缺失');
  intelTrigger.click(); await pause();
  const legacyPanel = by('spy-panel');
  const legacy = {
    panel: count('spy-panel'),
    buttons: legacyPanel?.querySelectorAll('button').length ?? -1,
    selects: legacyPanel?.querySelectorAll('select').length ?? -1,
    mission: count('btn-spy-mission'),
  };
  if (legacy.panel !== 1 || legacy.buttons !== 0 || legacy.selects !== 0 || legacy.mission !== 0) {
    throw new Error('P33 旧写入口未归零：' + JSON.stringify(legacy));
  }

  await click('command-domain-intel');
  await click('command-intel-facet-counter');
  const newWrites = {
    station: count('command-intel-station'),
    unstation: count('command-intel-unstation'),
    mission: count('command-intel-mission'),
    captiveExecute: count('command-intel-captive-execute'),
    captiveRelease: count('command-intel-captive-release'),
  };
  if (newWrites.station !== 1 || newWrites.unstation !== 1 ||
      newWrites.captiveExecute !== 0 || newWrites.captiveRelease !== 0) {
    throw new Error('P33 反间/俘虏入口异常：' + JSON.stringify(newWrites));
  }
  const captiveEmptyState = by('command-intel-panel-counter')?.innerText.includes('暂无扣押敌谍') ?? false;
  if (!captiveEmptyState) throw new Error('俘虏空态未渲染');
  let game = await state();
  const agent = Object.values(game.intel.agents).find((entry) =>
    entry.factionId === game.playerFactionId && entry.status === 'idle' && entry.cooldownMonths <= 0);
  if (!agent) throw new Error('缺少空闲密探');
  const ownCity = Object.values(game.cities).find((entry) => entry.ruler === game.playerFactionId);
  await choose('command-intel-counter-city', ownCity.id);
  await choose('command-intel-counter-agent', agent.id);
  await click('command-intel-station');
  if (!by('command-confirm-dialog')?.innerText.includes('确认驻守反间')) throw new Error('驻防未进入统一终审');
  await click('command-confirm-submit', 650);
  game = await state();
  if (game.intel.cityDefense[ownCity.id]?.stationAgentId !== agent.id ||
      game.actionLog[0]?.type !== 'spy_station') throw new Error('驻防确认链异常');

  await click('command-intel-unstation');
  if (!by('command-confirm-dialog')?.innerText.includes('确认撤回反间')) throw new Error('撤防未进入统一终审');
  await click('command-confirm-submit', 650);
  game = await state();
  if (game.intel.cityDefense[ownCity.id]?.stationAgentId ||
      game.actionLog[0]?.type !== 'spy_unstation') throw new Error('撤防确认链异常');

  await click('command-intel-facet-tasks');
  newWrites.mission = count('command-intel-mission');
  if (newWrites.mission !== 1) throw new Error('新任务入口不是唯一');
  game = await state();
  const roads = [[1,2],[1,3],[1,7],[1,13],[1,25],[2,20],[2,22],[3,4],[3,13],[4,7],[4,18],[5,6],[5,8],[5,11],[5,25],[6,24],[6,26],[7,8],[8,11],[9,10],[9,12],[9,18],[10,17],[11,12],[16,17],[17,18],[13,15],[14,15],[14,21],[15,18],[19,20],[19,21],[20,22],[22,23],[24,25],[26,27],[27,28],[14,29],[29,30]];
  const ownIds = new Set(Object.values(game.cities).filter((city) => city.ruler === game.playerFactionId).map((city) => city.id));
  const targetId = Object.values(game.cities).find((city) =>
    city.ruler !== game.playerFactionId && roads.some(([a,b]) =>
      (a === city.id && ownIds.has(b)) || (b === city.id && ownIds.has(a))))?.id;
  if (!targetId) throw new Error('缺少官道邻接敌城');
  await choose('command-intel-mission-agent', agent.id);
  await choose('command-intel-mission-type', 'recon');
  await choose('command-intel-mission-target', targetId);
  const beforeCancel = await state();
  await click('command-intel-mission');
  if (!by('command-confirm-dialog')?.innerText.includes('确认派出探秘')) throw new Error('任务未进入统一终审');
  await click('command-confirm-cancel');
  if (snapshot(await state()) !== snapshot(beforeCancel)) throw new Error('任务取消改变权威状态');
  await click('command-intel-mission');
  await click('command-confirm-submit', 650);
  const afterMission = await state();
  if (afterMission.actionLog[0]?.type !== 'spy_mission' ||
      afterMission.intel.recentMissions[0]?.agentId !== agent.id) throw new Error('任务确认链异常');
  return {
    viewport: [innerWidth, innerHeight], legacy, newWrites,
    stationConfirmed: true, unstationConfirmed: true,
    missionCancelPreserved: true, missionConfirmed: afterMission.intel.recentMissions[0].message,
    captiveEmptyState,
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P33 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
