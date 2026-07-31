// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P37 家族婚配/手动跟随写链迁移验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P37 Headless：未找到 Chrome page target');
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
  const created = await response.json();
  const releasable = Object.values(created.officers).find((officer) =>
    officer.faction === created.playerFactionId
    && officer.id !== created.factions[created.playerFactionId].rulerId);
  if (!releasable) throw new Error('缺少手动跟随在野夹具');
  const released = await fetch('/api/game/personnel/release-officer', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ officerId: releasable.id }),
  });
  if (!released.ok) throw new Error('创建手动跟随在野夹具失败：' + await released.text());
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
  const state = async () => (await fetch('/api/game/state')).json();
  for (let i = 0; i < 60 && !by('command-domain-family'); i += 1) await pause(50);

  const familyButton = [...by('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith('家族'));
  if (!familyButton) throw new Error('旧家族入口缺失');
  familyButton.click(); await pause();
  const legacyMarryTab = [...by('family-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim() === '婚配');
  if (!legacyMarryTab) throw new Error('旧家族婚配只读页签缺失');
  legacyMarryTab.click(); await pause();
  const legacyWrites = {
    marry: count('btn-family-marry'),
    followCheck: count('btn-follow-check'),
  };
  if (legacyWrites.marry !== 0 || legacyWrites.followCheck !== 0) {
    throw new Error('旧家族写入口未归零：' + JSON.stringify(legacyWrites));
  }

  await click('command-domain-family');
  await click('command-family-facet-marriage');
  const marriageWriteCount = count('command-family-marry');
  await click('command-family-facet-follow');
  const followWriteCount = count('command-family-follow-check');
  const newWriteCount = marriageWriteCount + followWriteCount;
  if (marriageWriteCount !== 1 || followWriteCount !== 1) {
    throw new Error('新家族写入口数量异常：' + JSON.stringify({ marriageWriteCount, followWriteCount }));
  }
  await click('command-family-facet-marriage');
  const before = await state();
  const female = Object.values(before.females).find((entry) =>
    entry.factionId === before.playerFactionId &&
    (entry.status === 'single' || entry.status === 'widow') &&
    entry.husbandId == null &&
    entry.giftedToOfficerId == null);
  const officer = Object.values(before.officers).find((entry) =>
    entry.faction === before.playerFactionId &&
    entry.wifeId == null &&
    entry.location != null &&
    before.cities[entry.location]?.gold >= 300);
  if (!female || !officer) throw new Error('缺少可婚配夹具');
  await choose('command-family-female-select', female.id);
  await choose('command-family-officer-select', officer.id);

  const beforeCancel = JSON.stringify(await state());
  await click('command-family-marry');
  if (count('command-confirm-dialog') !== 1) throw new Error('婚配未进入统一终审');
  await click('command-confirm-cancel');
  if (JSON.stringify(await state()) !== beforeCancel) throw new Error('婚配取消改变权威状态');
  if (by('command-family-female-select').value !== String(female.id)) {
    throw new Error('婚配取消未保留女角草稿');
  }

  await click('command-family-marry');
  await click('command-confirm-submit', 650);
  const married = await state();
  if (married.females[female.id].husbandId !== officer.id) throw new Error('婚配确认未建立正妻关系');
  if (married.officers[officer.id].wifeId !== female.id) throw new Error('婚配确认未建立双向关系');

  await click('command-family-facet-follow');
  const beforeFollowCancel = JSON.stringify(await state());
  await click('command-family-follow-check');
  if (!by('command-confirm-dialog').innerText.includes('消费权威 RNG')) {
    throw new Error('手动跟随终审未披露 RNG 消费');
  }
  await click('command-confirm-cancel');
  if (JSON.stringify(await state()) !== beforeFollowCancel) throw new Error('跟随取消改变权威状态');
  await click('command-family-follow-check');
  await click('command-confirm-submit', 650);
  if (count('command-confirm-dialog') !== 0) throw new Error('跟随确认后终审未关闭');

  return {
    viewport: [innerWidth, innerHeight],
    legacyWrites,
    newWriteCount,
    marriageCancelPreserved: true,
    married: female.name + '×' + officer.name,
    followCancelPreserved: true,
    followConfirmed: true,
    actionLog: (await state()).actionLog[0]?.type,
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P37 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
