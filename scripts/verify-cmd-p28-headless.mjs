// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P28 计略四计写链迁移浏览器验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P28 Headless：未找到 Chrome page target');

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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error('创建英雄集结曹操局失败：' + await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1400));

const result = await evaluate(`
  const pause = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
  const byId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const allById = (id) => document.querySelectorAll('[data-testid="' + id + '"]');
  const click = async (id, ms = 350) => {
    const element = byId(id);
    if (!element) throw new Error('缺少元素 ' + id);
    if (element.disabled) throw new Error('元素不可用 ' + id);
    element.click();
    await pause(ms);
  };
  const select = async (id, value) => {
    const element = byId(id);
    if (!element) throw new Error('缺少选择器 ' + id);
    element.value = String(value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
    await pause();
  };
  const state = async () => (await fetch('/api/game/state')).json();

  const leftPlotButton = [...byId('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith('计谋'));
  if (!leftPlotButton) throw new Error('旧计谋入口缺失');
  leftPlotButton.click();
  await pause();
  const legacyLaunchEntries = allById('btn-plot-launch').length;
  if (legacyLaunchEntries !== 1) throw new Error('迁移期旧计谋写入口应恰好保留1个');

  await click('command-domain-strategy');
  await click('command-strategy-facet-launch');
  const drawer = byId('command-strategy-drawer');
  const newWriteCount = drawer.querySelectorAll('[data-command-write="true"]').length;
  if (newWriteCount !== 1) throw new Error('新计略提交入口数量异常');
  const typeOptions = [...byId('command-strategy-plot-type').options].map((option) => option.value);
  const expectedTypes = ['honeyTrap', 'sowDiscord', 'falseIntel', 'emptyFort'];
  if (expectedTypes.some((type) => !typeOptions.includes(type))) throw new Error('四计选项不完整');

  await select('command-strategy-plot-type', 'honeyTrap');
  const honeyReason = byId('command-strategy-launch-reason')?.innerText ?? '';
  if (!honeyReason.includes('探秘')) throw new Error('美人计未显示探秘前置原因');
  await select('command-strategy-plot-type', 'falseIntel');
  const falseReason = byId('command-strategy-launch-reason')?.innerText ?? '';
  if (!falseReason.includes('探秘')) throw new Error('假情报未显示探秘前置原因');
  await select('command-strategy-plot-type', 'emptyFort');
  const emptyReason = byId('command-strategy-launch-reason')?.innerText ?? '';
  if (!emptyReason.includes('寡兵')) throw new Error('空城疑兵未显示候选门禁原因');

  await select('command-strategy-plot-type', 'sowDiscord');
  const targetSelect = byId('command-strategy-target-faction');
  const target = [...targetSelect.options].find((option) => option.value && !option.disabled);
  if (!target) throw new Error('离间计没有可用目标');
  await select('command-strategy-target-faction', target.value);
  const before = await state();
  const beforeGold = Object.values(before.cities)
    .filter((city) => city.ruler === before.playerFactionId)
    .reduce((sum, city) => sum + city.gold, 0);

  await click('command-strategy-launch-submit');
  await click('command-confirm-cancel');
  if (byId('command-strategy-target-faction').value !== target.value) {
    throw new Error('取消终审后离间草稿未保留');
  }
  const afterCancel = await state();
  if ((afterCancel.plots ?? []).length !== (before.plots ?? []).length) throw new Error('取消终审却生成计谋');

  await click('command-strategy-launch-submit');
  await click('command-confirm-submit', 650);
  const after = await state();
  const created = (after.plots ?? []).find(
    (plot) => !(before.plots ?? []).some((oldPlot) => oldPlot.id === plot.id),
  );
  if (!created || created.type !== 'sowDiscord' || created.stage !== 'prep') {
    throw new Error('新入口未生成准备中的离间计');
  }
  const afterGold = Object.values(after.cities)
    .filter((city) => city.ruler === after.playerFactionId)
    .reduce((sum, city) => sum + city.gold, 0);
  if (beforeGold - afterGold !== 200) throw new Error('离间计扣金不是200');

  await click('command-strategy-facet-ongoing');
  const card = byId('command-strategy-plot-' + created.id);
  if (!card || !card.innerText.includes('离间计') || !card.innerText.includes('准备中')) {
    throw new Error('新计略写入后进行中摘要未即时同步');
  }

  return {
    viewport: [innerWidth, innerHeight],
    typeOptions,
    legacyLaunchEntries,
    newWriteCount,
    disabledReasons: { honey: honeyReason, falseIntel: falseReason, emptyFort: emptyReason },
    cancelPreservedDraft: true,
    goldCost: beforeGold - afterGold,
    createdPlotType: created.type,
    createdPlotStage: created.stage,
    ongoingSynced: true,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P28 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
