// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P19 Campaign Army 军令唯一入口浏览器验收。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P19 Headless：未找到 Chrome page target');
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
  if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.exception?.description ?? result.result.exceptionDetails.text);
  return result.result.result.value;
}
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1400));
const result = await evaluate(`
  const pause = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
  const byId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const click = async (id, ms = 250) => { const el = byId(id); if (!el) throw new Error('缺少元素 ' + id); el.click(); await pause(ms); };
  const setSelect = (id, value) => {
    const el = byId(id); if (!el) throw new Error('缺少选择器 ' + id);
    el.value = String(value); el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const state = async () => (await fetch('/api/game/state')).json();
  const snapshot = (game) => JSON.stringify({ officers: game.officers, armies: game.campaignArmies, factions: game.factions, log: game.actionLog, rng: game.rng });
  const initial = await state();
  const fromCity = Object.values(initial.cities).find((city) => {
    if (city.ruler !== initial.playerFactionId || city.troops < 5000 || city.food < 1500) return false;
    const officers = Object.values(initial.officers).filter((officer) => officer.faction === 1 && officer.location === city.id && officer.status === 'active');
    const target = initial.campaignNodes.find((node) => node.id === city.id)?.adjacentNodeIds.some((id) => initial.cities[id]?.ruler !== 1);
    return target && officers.length >= 2 && officers.some((officer) => officer.stats.intelligence >= 85);
  });
  if (!fromCity) throw new Error('找不到有主将与参谋的合格出发城');
  const officers = Object.values(initial.officers).filter((officer) => officer.faction === 1 && officer.location === fromCity.id && officer.status === 'active');
  const advisor = officers.find((officer) => officer.stats.intelligence >= 85);
  const commander = officers.find((officer) => officer.id !== advisor.id);
  const target = initial.campaignNodes.find((node) => node.id === fromCity.id).adjacentNodeIds.map((id) => initial.cities[id]).find((city) => city.ruler !== 1);

  await click('command-domain-military');
  await click('command-military-facet-formation');
  setSelect('command-military-from-city', fromCity.id); await pause();
  setSelect('command-military-commander', commander.id);
  setSelect('command-military-advisor', advisor.id);
  setSelect('command-military-target-city', target.id); await pause();
  await click('command-military-start');
  await click('command-confirm-submit', 800);
  const afterStart = await state();
  const army = afterStart.campaignArmies.find((item) => !initial.campaignArmies.some((old) => old.id === item.id));
  if (!army || army.advisorId !== advisor.id) throw new Error('未创建带参谋的 Campaign Army');

  await click('command-military-facet-orders');
  if (!byId('command-military-orders-army')) throw new Error('军事军令选择器缺失');
  setSelect('command-military-orders-army', army.id); await pause();
  const left = byId('left-panel');
  const legacyLabels = ['强攻', '劝降', '撤退', '激励', '陷阱', '休整', '斥候'];
  const legacyWriteCount = [...left.querySelectorAll('button')].filter((button) => legacyLabels.includes(button.innerText.trim())).length;
  if (legacyWriteCount !== 0) throw new Error('左栏旧军令按钮仍存在：' + legacyWriteCount);

  const beforeCancel = await state();
  await click('military-order-advisor-inspire');
  if (!byId('command-confirm-dialog')) throw new Error('参谋行动未进入统一终审');
  await click('command-confirm-cancel');
  const afterCancel = await state();
  if (snapshot(beforeCancel) !== snapshot(afterCancel)) throw new Error('取消参谋军令后权威状态变化');

  await click('military-order-advisor-inspire');
  await click('command-confirm-submit', 600);
  const afterInspire = await state();
  const inspiredArmy = afterInspire.campaignArmies.find((item) => item.id === army.id);
  if (inspiredArmy.morale !== Math.min(100, army.morale + 15)) throw new Error('激励士气结算错误');
  if (afterInspire.officers[advisor.id].stamina !== afterStart.officers[advisor.id].stamina - 15) throw new Error('激励体力结算错误');

  await click('military-order-build-camp');
  if (!byId('command-confirm-dialog') || !document.body.innerText.includes('确认营建营寨')) throw new Error('营建未进入统一终审');
  await click('command-confirm-submit', 600);
  const afterBuild = await state();
  const builtArmy = afterBuild.campaignArmies.find((item) => item.id === army.id);
  if (!builtArmy.structures.some((item) => item.type === 'camp')) throw new Error('确认后未开始营寨建造');
  if (afterBuild.factions[1].gold !== afterInspire.factions[1].gold - 100) throw new Error('营寨金消耗错误');

  return {
    viewport: [innerWidth, innerHeight],
    army: army.name,
    legacyWriteCount,
    advisorCancelUnchanged: true,
    moraleDelta: inspiredArmy.morale - army.morale,
    advisorStaminaDelta: afterStart.officers[advisor.id].stamina - afterInspire.officers[advisor.id].stamina,
    campGoldCost: afterInspire.factions[1].gold - afterBuild.factions[1].gold,
    uniqueOrdersEntry: 1,
  };
`);
await ws.close();
if (consoleErrors.length > 0) throw new Error(`CMD-P19 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
