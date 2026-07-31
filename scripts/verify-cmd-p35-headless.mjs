// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P35 家族迁移前浏览器基线。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P35 Headless：未找到 Chrome page target');

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
  for (let i = 0; i < 60 && !by('command-domain-family'); i += 1) await pause(50);

  const familyButton = [...by('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith('家族'));
  if (!familyButton) throw new Error('旧家族入口缺失');
  familyButton.click(); await pause();
  if (count('family-panel') !== 1) throw new Error('旧 FamilyPanel 应恰好存在1个');

  const marryTab = [...by('family-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim() === '婚配');
  if (!marryTab) throw new Error('旧家族婚配页签缺失');
  marryTab.click(); await pause();
  const legacyWrites = {
    marry: count('btn-family-marry'),
    followCheck: count('btn-follow-check'),
  };
  if (legacyWrites.marry !== 1 || legacyWrites.followCheck !== 1) {
    throw new Error('旧家族写入口数量异常：' + JSON.stringify(legacyWrites));
  }

  await click('command-domain-family');
  const drawer = by('command-drawer');
  const newWriteCount = drawer.querySelectorAll('[data-command-write="true"]').length;
  if (newWriteCount !== 0) throw new Error('P35 命令坞家族不应出现新写入口');
  if (!drawer.innerText.includes('仍在左侧家族面板')) {
    throw new Error('命令坞家族未指明迁移期权威入口');
  }
  await click('command-domain-family');

  const before = await state();
  const female = Object.values(before.females).find((entry) =>
    entry.factionId === before.playerFactionId &&
    (entry.status === 'single' || entry.status === 'widow') &&
    entry.husbandId == null);
  const officer = Object.values(before.officers).find((entry) =>
    entry.faction === before.playerFactionId &&
    entry.wifeId == null &&
    entry.location != null &&
    before.cities[entry.location]?.gold >= 300);
  if (!female || !officer) throw new Error('缺少可婚配女角或可支付武将');

  await choose('family-female-select', female.id);
  await choose('family-officer-select', officer.id);
  await click('btn-family-marry');
  await click('command-confirm-cancel');
  const afterCancel = await state();
  if (JSON.stringify(afterCancel) !== JSON.stringify(before)) {
    throw new Error('取消婚配却改变权威状态');
  }

  await click('btn-family-marry');
  await click('command-confirm-submit', 650);
  const after = await state();
  const payCityId = officer.location;
  if (before.cities[payCityId].gold - after.cities[payCityId].gold !== 300) {
    throw new Error('婚配未扣金300');
  }
  if (after.females[female.id].husbandId !== officer.id ||
      after.females[female.id].status !== 'married' ||
      after.officers[officer.id].wifeId !== female.id) {
    throw new Error('婚配双向关系未建立');
  }
  const expectedLoyalty = Math.min(100, before.officers[officer.id].loyalty + 18);
  if (after.officers[officer.id].loyalty !== expectedLoyalty) {
    throw new Error('婚配忠诚收益不符');
  }
  if (after.actionLog[0]?.type !== 'marry') throw new Error('未写 marry 行动日志');

  return {
    viewport: [innerWidth, innerHeight],
    legacyPanel: 1,
    legacyWrites,
    newWriteCount,
    cancelPreservedState: true,
    marriage: {
      female: female.name,
      officer: officer.name,
      goldCost: 300,
      loyaltyAfter: after.officers[officer.id].loyalty,
      actionLog: after.actionLog[0].type,
    },
    consoleErrors: 0,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P35 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
