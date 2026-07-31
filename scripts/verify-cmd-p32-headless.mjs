// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P32 情报人员建设迁移。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P32 Headless：未找到 Chrome page target');
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
  for (let attempt = 0; attempt < 40 && (game.factions[game.playerFactionId].beautyStock ?? 0) < 3; attempt += 1) {
    const city = Object.values(game.cities).find((entry) =>
      entry.ruler === game.playerFactionId && (entry.beautySeekLeft ?? 0) > 0 && entry.gold >= 60);
    if (!city) throw new Error('建立美女库存时无可用寻访城市');
    response = await fetch('/api/game/civil/seek-beauty', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: city.id }),
    });
    if (!response.ok) throw new Error('正式寻访失败：' + await response.text());
    game = await response.json();
  }
  if ((game.factions[game.playerFactionId].beautyStock ?? 0) < 3) {
    throw new Error('40次正式寻访仍未建立3点美女库存');
  }
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
  for (let i = 0; i < 60 && !by('command-domain-diplomacy'); i += 1) await pause(50);
  let game = await state();
  const target = Object.values(game.factions).find((faction) =>
    faction.id !== game.playerFactionId && faction.isAlive &&
    !game.diplomacy.some((entry) =>
      ((entry.factionA === game.playerFactionId && entry.factionB === faction.id) ||
       (entry.factionB === game.playerFactionId && entry.factionA === faction.id)) &&
      String(entry.relation) === 'war'));
  if (!target) throw new Error('缺少可献美目标');

  await click('command-domain-diplomacy');
  await choose('command-diplomacy-target', target.id);
  await click('command-diplomacy-facet-negotiation');
  await click('command-diplomacy-gift-beauty');
  await click('command-confirm-submit', 650);
  game = await state();
  if ((game.intel?.plantableBeauty?.[target.id] ?? 0) < 1) throw new Error('献美未生成点化额度');
  await click('command-drawer-close');

  const intelTrigger = [...by('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith('谍报'));
  if (!intelTrigger) throw new Error('旧谍报入口缺失');
  intelTrigger.click(); await pause();
  const legacy = {
    panel: count('spy-panel'),
    recruit: count('btn-spy-recruit'),
    trainFemale: count('btn-spy-train-female'),
    plantFemale: count('intel-plant-female'),
    mission: count('btn-spy-mission'),
  };
  if (legacy.panel !== 1 || legacy.recruit !== 0 || legacy.trainFemale !== 0 ||
      legacy.plantFemale !== 0 || legacy.mission !== 1) {
    throw new Error('P32 旧入口原子性异常：' + JSON.stringify(legacy));
  }

  await click('command-domain-intel');
  await click('command-intel-facet-personnel');
  const newWrites = {
    recruit: count('command-intel-recruit'),
    trainFemale: count('command-intel-train-female'),
    plantFemale: count('command-intel-plant-female'),
  };
  if (Object.values(newWrites).some((entry) => entry !== 1)) {
    throw new Error('P32 新人员建设入口数量异常：' + JSON.stringify(newWrites));
  }

  const beforeCancel = await state();
  await click('command-intel-recruit');
  if (!by('command-confirm-dialog')?.innerText.includes('确认招募密探')) throw new Error('招募未进入统一终审');
  await click('command-confirm-cancel');
  if (snapshot(await state()) !== snapshot(beforeCancel)) throw new Error('招募取消改变权威状态');

  const beforeRecruit = await state();
  await click('command-intel-recruit');
  await click('command-confirm-submit', 650);
  const afterRecruit = await state();
  const recruited = Object.keys(afterRecruit.intel.agents).length - Object.keys(beforeRecruit.intel.agents).length;
  if (recruited < 1 || recruited > 3 || afterRecruit.actionLog[0]?.type !== 'spy_recruit') {
    throw new Error('新招募确认链异常');
  }

  const beforeTrain = await state();
  await click('command-intel-train-female');
  await click('command-confirm-submit', 650);
  const afterTrain = await state();
  const trained = Object.values(afterTrain.intel.agents)
    .filter((agent) => !beforeTrain.intel.agents[agent.id]);
  if (trained.length !== 1 || trained[0].agentKind !== 'female' ||
      afterTrain.actionLog[0]?.type !== 'spy_train_female') {
    throw new Error('新女间谍训练确认链异常');
  }

  await choose('command-intel-plant-target', target.id);
  const beforePlant = await state();
  await click('command-intel-plant-female');
  await click('command-confirm-submit', 650);
  const afterPlant = await state();
  const planted = Object.values(afterPlant.intel.agents)
    .filter((agent) => !beforePlant.intel.agents[agent.id]);
  if (planted.length !== 1 || planted[0].agentKind !== 'female' ||
      (afterPlant.intel?.plantableBeauty?.[target.id] ?? 0) !==
      (beforePlant.intel?.plantableBeauty?.[target.id] ?? 0) - 1 ||
      afterPlant.actionLog[0]?.type !== 'spy_plant_female') {
    throw new Error('新献美点化确认链异常');
  }
  return {
    viewport: [innerWidth, innerHeight], legacy, newWrites,
    recruitCancelPreserved: true, recruited,
    trainedFemale: trained[0].name, plantedFemale: planted[0].name,
    logs: ['spy_recruit', 'spy_train_female', 'spy_plant_female'],
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P32 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
