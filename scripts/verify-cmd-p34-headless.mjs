// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P34 情报原子切换总验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P34 Headless：未找到 Chrome page target');
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
  for (let i = 0; i < 60 && !by('command-domain-intel'); i += 1) await pause(50);

  const legacy = {
    panel: count('spy-panel'),
    leftAccordion: [...by('left-panel').querySelectorAll('button')]
      .filter((button) => button.innerText.trim().startsWith('谍报')).length,
    mission: count('btn-spy-mission'),
  };
  if (Object.values(legacy).some((entry) => entry !== 0)) {
    throw new Error('P34 旧谍报源码/DOM 未原子归零：' + JSON.stringify(legacy));
  }

  await click('command-domain-intel');
  await click('command-intel-facet-personnel');
  const personnelWrites = {
    recruit: count('command-intel-recruit'),
    train: count('command-intel-train-female'),
    plant: count('command-intel-plant-female'),
  };
  if (Object.values(personnelWrites).some((entry) => entry !== 1)) {
    throw new Error('人员三链入口不唯一：' + JSON.stringify(personnelWrites));
  }
  await click('command-intel-recruit');
  await click('command-confirm-submit', 650);
  let game = await state();
  const agent = Object.values(game.intel.agents).find((entry) =>
    entry.factionId === game.playerFactionId && entry.status === 'idle');
  if (!agent || game.actionLog[0]?.type !== 'spy_recruit') throw new Error('招募确认链失败');

  await click('command-drawer-close');
  await click('command-domain-strategy');
  await click('command-strategy-facet-launch');
  await click('command-strategy-go-intel');
  if (!by('command-intel-recon-intent') ||
      !by('command-intel-panel-tasks') ||
      count('command-intel-mission') !== 1) {
    throw new Error('计略→intel/recon 未落到唯一任务入口');
  }

  game = await state();
  const roads = [[1,2],[1,3],[1,7],[1,13],[1,25],[2,20],[2,22],[3,4],[3,13],[4,7],[4,18],[5,6],[5,8],[5,11],[5,25],[6,24],[6,26],[7,8],[8,11],[9,10],[9,12],[9,18],[10,17],[11,12],[16,17],[17,18],[13,15],[14,15],[14,21],[15,18],[19,20],[19,21],[20,22],[22,23],[24,25],[26,27],[27,28],[14,29],[29,30]];
  const ownIds = new Set(Object.values(game.cities).filter((city) => city.ruler === game.playerFactionId).map((city) => city.id));
  const targetId = Object.values(game.cities).find((city) =>
    city.ruler !== game.playerFactionId && roads.some(([a,b]) =>
      (a === city.id && ownIds.has(b)) || (b === city.id && ownIds.has(a))))?.id;
  if (!targetId) throw new Error('缺少官道邻接敌城');
  await choose('command-intel-mission-agent', agent.id);
  await choose('command-intel-mission-target', targetId);
  await click('command-intel-mission');
  await click('command-confirm-submit', 650);
  game = await state();
  if (game.actionLog[0]?.type !== 'spy_mission') throw new Error('recon 落点任务提交失败');

  const nextAgent = Object.values(game.intel.agents).find((entry) =>
    entry.factionId === game.playerFactionId && entry.status === 'idle');
  if (!nextAgent) throw new Error('缺少用于反间验收的空闲密探');
  await click('command-intel-facet-counter');
  const counterWrites = {
    station: count('command-intel-station'),
    unstation: count('command-intel-unstation'),
    captiveExecute: count('command-intel-captive-execute'),
    captiveRelease: count('command-intel-captive-release'),
  };
  if (counterWrites.station !== 1 || counterWrites.unstation !== 1 ||
      counterWrites.captiveExecute !== 0 || counterWrites.captiveRelease !== 0) {
    throw new Error('反间/俘虏入口异常：' + JSON.stringify(counterWrites));
  }
  const ownCity = Object.values(game.cities).find((city) => city.ruler === game.playerFactionId);
  await choose('command-intel-counter-city', ownCity.id);
  await choose('command-intel-counter-agent', nextAgent.id);
  await click('command-intel-station');
  await click('command-confirm-submit', 650);
  await click('command-intel-unstation');
  await click('command-confirm-submit', 650);
  game = await state();
  if (game.actionLog[0]?.type !== 'spy_unstation') throw new Error('反间驻防/撤防链失败');

  return {
    viewport: [innerWidth, innerHeight],
    legacy,
    personnelWrites,
    reconLanding: true,
    missionWrites: 1,
    counterWrites,
    logs: ['spy_recruit', 'spy_mission', 'spy_station', 'spy_unstation'],
    consoleErrors: 0,
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P34 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
