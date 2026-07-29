// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P21 军事四分面与唯一玩家入口原子总验收。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P21 Headless：未找到 Chrome page target');
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
  const allById = (id) => document.querySelectorAll('[data-testid="' + id + '"]');
  const click = async (id, ms = 250) => {
    const element = byId(id);
    if (!element) throw new Error('缺少元素 ' + id);
    element.click();
    await pause(ms);
  };
  const setSelect = (id, value) => {
    const element = byId(id);
    if (!element) throw new Error('缺少选择器 ' + id);
    element.value = String(value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const sectionButton = (text, root) => [...root.querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith(text));
  const state = async () => (await fetch('/api/game/state')).json();
  const snapshot = (game) => JSON.stringify({
    cities: game.cities,
    officers: game.officers,
    armies: game.campaignArmies,
    factions: game.factions,
    log: game.actionLog,
    rng: game.rng,
  });

  const initial = await state();
  const legacyTestIds = ['btn-march', 'btn-conscript', 'btn-train'];
  const legacyRightWriteCount = legacyTestIds.reduce((sum, id) => sum + allById(id).length, 0);
  if (legacyRightWriteCount !== 0) throw new Error('右栏旧军事写控件仍存在');

  const left = byId('left-panel');
  const campaignSection = sectionButton('战役', left);
  if (!campaignSection) throw new Error('左栏战役只读入口缺失');
  campaignSection.click();
  await pause();
  const legacyLabels = ['出征编成', '编成出征', '强攻', '劝降', '撤退', '激励', '陷阱', '休整', '斥候'];
  const legacyLeftWriteCount = [...left.querySelectorAll('button')]
    .filter((button) => legacyLabels.includes(button.innerText.trim())).length;
  if (legacyLeftWriteCount !== 0) throw new Error('左栏旧军事写控件仍存在：' + legacyLeftWriteCount);
  if (!left.innerText.includes('战役层军团只读摘要')) throw new Error('左栏战役未保持只读说明');

  const right = byId('right-panel');
  const militarySection = sectionButton('军事操作', right);
  if (!militarySection) throw new Error('右栏军事只读提示入口缺失');
  militarySection.click();
  await pause();
  if (!right.innerText.includes('命令坞“军事”')) throw new Error('右栏未指向军事唯一入口');

  await click('command-domain-military');
  const facets = ['readiness', 'formation', 'orders', 'reports'];
  for (const facet of facets) {
    if (allById('command-military-facet-' + facet).length !== 1) {
      throw new Error('军事分面不唯一：' + facet);
    }
  }
  if (allById('command-military-drawer').length !== 1) throw new Error('军事抽屉不唯一');
  if (allById('military-readiness-conscript').length !== 1 || allById('military-readiness-train').length !== 1) {
    throw new Error('军备提交入口不唯一');
  }

  const readinessCityId = Number(byId('command-military-readiness-city').value);
  const beforeConscriptCancel = await state();
  await click('military-readiness-conscript');
  await click('command-confirm-cancel');
  const afterConscriptCancel = await state();
  if (snapshot(beforeConscriptCancel) !== snapshot(afterConscriptCancel)) {
    throw new Error('取消征兵后权威状态变化');
  }
  await click('military-readiness-conscript');
  await click('command-confirm-submit', 600);
  const afterConscript = await state();
  const troopGain = afterConscript.cities[readinessCityId].troops
    - beforeConscriptCancel.cities[readinessCityId].troops;
  if (troopGain <= 0 || !afterConscript.actionLog.some((entry) => entry.type === 'conscript')) {
    throw new Error('军备确认链未完成');
  }

  const fromCity = Object.values(afterConscript.cities).find((city) => {
    if (city.ruler !== afterConscript.playerFactionId || city.troops < 5000 || city.food < 1500) return false;
    const officers = Object.values(afterConscript.officers).filter((officer) =>
      officer.faction === afterConscript.playerFactionId
      && officer.location === city.id
      && officer.status === 'active');
    const hasEnemyTarget = afterConscript.campaignNodes.find((node) => node.id === city.id)
      ?.adjacentNodeIds.some((id) => afterConscript.cities[id]?.ruler !== afterConscript.playerFactionId);
    return hasEnemyTarget && officers.length >= 2
      && officers.some((officer) => officer.stats.intelligence >= 85);
  });
  if (!fromCity) throw new Error('找不到总验收所需编成城市');
  const officers = Object.values(afterConscript.officers).filter((officer) =>
    officer.faction === afterConscript.playerFactionId
    && officer.location === fromCity.id
    && officer.status === 'active');
  const advisor = officers.find((officer) => officer.stats.intelligence >= 85);
  const commander = officers.find((officer) => officer.id !== advisor.id);
  const target = afterConscript.campaignNodes.find((node) => node.id === fromCity.id)
    .adjacentNodeIds.map((id) => afterConscript.cities[id])
    .find((city) => city.ruler !== afterConscript.playerFactionId);

  await click('command-military-facet-formation');
  if (allById('command-military-start').length !== 1) throw new Error('编成提交入口不唯一');
  setSelect('command-military-from-city', fromCity.id); await pause();
  setSelect('command-military-commander', commander.id);
  setSelect('command-military-advisor', advisor.id);
  setSelect('command-military-target-city', target.id); await pause();
  const beforeFormationCancel = await state();
  await click('command-military-start');
  await click('command-confirm-cancel');
  const afterFormationCancel = await state();
  if (snapshot(beforeFormationCancel) !== snapshot(afterFormationCancel)) {
    throw new Error('取消编成后权威状态变化');
  }
  await click('command-military-start');
  await click('command-confirm-submit', 800);
  const afterFormation = await state();
  const army = afterFormation.campaignArmies.find((item) =>
    !afterConscript.campaignArmies.some((old) => old.id === item.id));
  if (!army || army.advisorId !== advisor.id) throw new Error('编成确认链未创建带参谋军团');

  await click('command-military-facet-orders');
  if (allById('command-military-orders').length !== 1) throw new Error('军令入口不唯一');
  setSelect('command-military-orders-army', army.id); await pause();
  const beforeOrderCancel = await state();
  await click('military-order-advisor-inspire');
  await click('command-confirm-cancel');
  const afterOrderCancel = await state();
  if (snapshot(beforeOrderCancel) !== snapshot(afterOrderCancel)) {
    throw new Error('取消军令后权威状态变化');
  }
  await click('military-order-advisor-inspire');
  await click('command-confirm-submit', 600);
  const afterOrder = await state();
  const inspired = afterOrder.campaignArmies.find((item) => item.id === army.id);
  if (inspired.morale !== Math.min(100, army.morale + 15)) throw new Error('军令确认链结算错误');

  await click('command-military-facet-reports');
  const reports = byId('command-military-reports');
  if (!reports || !reports.innerText.includes('征兵') || !reports.innerText.includes('出征')) {
    throw new Error('战报分面未汇总本轮军事日志');
  }

  return {
    viewport: [innerWidth, innerHeight],
    facets,
    legacyRightWriteCount,
    legacyLeftWriteCount,
    uniqueMilitaryDrawer: 1,
    conscriptCancelUnchanged: true,
    formationCancelUnchanged: true,
    orderCancelUnchanged: true,
    troopGain,
    armyCreated: army.name,
    moraleDelta: inspired.morale - army.morale,
    reportsContainFullChain: true,
    marchCompatibilityUiCount: allById('btn-march').length,
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P21 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
