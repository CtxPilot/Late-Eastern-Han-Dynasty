// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P38 家族原子切换总验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P38 Headless：未找到 Chrome page target');
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
  const pause = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const count = (id) => document.querySelectorAll('[data-testid="' + id + '"]').length;
  const click = async (id, ms = 350) => {
    const element = by(id);
    if (!element) throw new Error('缺少元素 ' + id);
    if (element.disabled) throw new Error('元素不可用 ' + id + '：' + element.title);
    element.click(); await pause(ms);
  };
  const choose = async (id, value) => {
    const select = by(id);
    if (!select) throw new Error('缺少选择器 ' + id);
    select.value = String(value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
  };
  const post = async (path, body) => {
    const response = await fetch('/api/game' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(path + ' 失败：' + await response.text());
    return response.json();
  };
  const state = async () => (await fetch('/api/game/state')).json();
  for (let i = 0; i < 60 && !by('command-domain-family'); i += 1) await pause(50);

  const leftFamilyButtons = [...by('left-panel').querySelectorAll('button')]
    .filter((button) => button.innerText.trim().startsWith('家族')).length;
  const legacyDom = count('family-panel');
  if (leftFamilyButtons !== 0 || legacyDom !== 0) {
    throw new Error('旧家族壳未归零：' + JSON.stringify({ leftFamilyButtons, legacyDom }));
  }

  await click('command-domain-family');
  for (const facet of ['overview', 'kinship', 'marriage', 'follow']) {
    if (count('command-family-facet-' + facet) !== 1) throw new Error('家族分面不唯一：' + facet);
  }
  await click('command-family-facet-marriage');
  if (count('command-family-marry') !== 1) throw new Error('婚配唯一入口异常');
  const before = await state();
  const female = Object.values(before.females).find((entry) =>
    entry.factionId === before.playerFactionId
    && (entry.status === 'single' || entry.status === 'widow')
    && entry.husbandId == null
    && entry.giftedToOfficerId == null);
  const officer = Object.values(before.officers).find((entry) =>
    entry.faction === before.playerFactionId
    && entry.wifeId == null
    && entry.location != null
    && before.cities[entry.location]?.gold >= 300);
  if (!female || !officer) throw new Error('缺少婚配/关系同步夹具');
  await choose('command-family-female-select', female.id);
  await choose('command-family-officer-select', officer.id);
  await click('command-family-marry');
  await click('command-confirm-submit', 650);
  const married = await state();
  if (married.females[female.id].husbandId !== officer.id) throw new Error('唯一婚配入口提交失败');

  const released = await post('/personnel/release-officer', { officerId: officer.id });
  if (released.females[female.id].factionId != null) throw new Error('释放武将时正妻未随迁流落');
  const targetCity = Object.values(released.cities).find((city) =>
    city.ruler === released.playerFactionId);
  if (!targetCity) throw new Error('缺少家眷回归目标城');
  const joined = await post('/personnel/join-faction', {
    officerId: officer.id,
    factionId: released.playerFactionId,
    cityId: targetCity.id,
  });
  if (
    joined.females[female.id].factionId !== joined.playerFactionId
    || joined.females[female.id].locationId !== targetCity.id
  ) throw new Error('加入势力时正妻未随迁入府');

  await click('command-family-facet-kinship');
  if (count('command-family-branch-' + officer.id) !== 1) {
    throw new Error('关系同步后命令坞姻亲支未恢复');
  }

  return {
    viewport: [innerWidth, innerHeight],
    legacy: { leftFamilyButtons, legacyDom },
    facets: 4,
    uniqueMarriageWrite: 1,
    married: female.name + '×' + officer.name,
    releaseDependentSync: true,
    joinDependentSync: true,
    kinshipResynced: true,
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P38 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
