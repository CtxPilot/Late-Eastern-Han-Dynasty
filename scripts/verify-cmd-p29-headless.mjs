// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P29 计略原子切换与跨情报导航总验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P29 Headless：未找到 Chrome page target');

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

  const leftText = byId('left-panel')?.innerText ?? '';
  if (leftText.includes('计谋')) throw new Error('左栏旧计谋入口仍存在');
  if (document.querySelectorAll('[data-testid="plot-panel"]').length !== 0) {
    throw new Error('旧 PlotPanel DOM 未归零');
  }
  if (document.querySelectorAll('[data-testid="btn-plot-launch"]').length !== 0) {
    throw new Error('旧计谋写入口未归零');
  }

  await click('command-domain-strategy');
  await click('command-strategy-facet-launch');
  const drawer = byId('command-strategy-drawer');
  if (!drawer) throw new Error('计略抽屉未打开');
  const writeCount = drawer.querySelectorAll('[data-command-write="true"]').length;
  if (writeCount !== 1) throw new Error('计略唯一提交入口数量异常');
  const typeOptions = [...byId('command-strategy-plot-type').options].map((option) => option.value);
  const expectedTypes = ['honeyTrap', 'sowDiscord', 'falseIntel', 'emptyFort'];
  if (expectedTypes.some((type) => !typeOptions.includes(type))) throw new Error('四计选项不完整');

  await select('command-strategy-plot-type', 'honeyTrap');
  if (!(byId('command-strategy-launch-reason')?.innerText ?? '').includes('探秘')) {
    throw new Error('美人计未显示探秘前置');
  }
  await click('command-strategy-go-intel');
  if (byId('command-domain-intel')?.getAttribute('aria-expanded') !== 'true') {
    throw new Error('计略未正式切换到情报域');
  }
  if (!(byId('command-drawer')?.innerText ?? '').includes('仍在左侧谍报面板')) {
    throw new Error('情报域未说明当前权威入口');
  }

  await click('command-domain-strategy');
  await click('command-strategy-facet-launch');
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
  if ((await state()).plots.length !== before.plots.length) throw new Error('取消终审却生成计谋');
  await click('command-strategy-launch-submit');
  await click('command-confirm-submit', 650);
  const after = await state();
  const created = after.plots.find((plot) => !before.plots.some((oldPlot) => oldPlot.id === plot.id));
  if (!created || created.type !== 'sowDiscord' || created.stage !== 'prep') {
    throw new Error('唯一入口未生成准备中的离间计');
  }
  const afterGold = Object.values(after.cities)
    .filter((city) => city.ruler === after.playerFactionId)
    .reduce((sum, city) => sum + city.gold, 0);
  if (beforeGold - afterGold !== 200) throw new Error('离间计扣金不是200');
  await click('command-strategy-facet-ongoing');
  if (!(byId('command-strategy-plot-' + created.id)?.innerText ?? '').includes('准备中')) {
    throw new Error('进行中摘要未即时同步');
  }

  return {
    viewport: [innerWidth, innerHeight],
    legacyPlotDom: 0,
    legacyWriteEntries: 0,
    typeOptions,
    newWriteEntries: writeCount,
    intelNavigation: true,
    cancelPreservedDraft: true,
    goldCost: beforeGold - afterGold,
    createdPlot: [created.type, created.stage],
    ongoingSynced: true,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P29 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
