// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P27 计略三分面只读态势浏览器验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P27 Headless：未找到 Chrome page target');

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
  const sectionButton = (text, root = document) => [...root.querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith(text));
  const click = async (id, ms = 350) => {
    const element = byId(id);
    if (!element) throw new Error('缺少元素 ' + id);
    if (element.disabled) throw new Error('元素不可用 ' + id);
    element.click();
    await pause(ms);
  };
  const state = async () => (await fetch('/api/game/state')).json();

  await click('command-domain-strategy');
  const drawer = byId('command-strategy-drawer');
  if (!drawer) throw new Error('计略只读抽屉缺失');
  const initialSituationMetrics = byId('command-strategy-situation')?.innerText.includes('0/4') ?? false;
  if (!initialSituationMetrics) throw new Error('计略初始态势未显示进行中上限');
  const facets = ['situation', 'launch', 'ongoing'];
  for (const facet of facets) {
    if (allById('command-strategy-facet-' + facet).length !== 1) {
      throw new Error('计略分面数量异常：' + facet);
    }
    await click('command-strategy-facet-' + facet);
    if (!byId('command-strategy-' + facet)) throw new Error('计略分面正文缺失：' + facet);
  }
  if (drawer.querySelectorAll('[data-command-write="true"]').length !== 0) {
    throw new Error('CMD-P27 提前出现计略提交入口');
  }
  await click('command-domain-strategy');

  const left = byId('left-panel');
  const plotSection = sectionButton('计谋', left);
  if (!plotSection) throw new Error('左栏旧计谋入口缺失');
  plotSection.click();
  await pause();
  const legacyPanel = byId('plot-panel');
  const typeSelect = legacyPanel?.querySelectorAll('select')[0];
  if (!legacyPanel || !typeSelect || allById('btn-plot-launch').length !== 1) {
    throw new Error('旧计谋唯一写入口异常');
  }
  typeSelect.value = 'sowDiscord';
  typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  const targetSelect = legacyPanel.querySelectorAll('select')[1];
  const target = [...targetSelect.options].find((option) => option.value && !option.disabled);
  if (!target) throw new Error('离间计没有可用目标');
  targetSelect.value = target.value;
  targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  const before = await state();
  await click('btn-plot-launch');
  await click('command-confirm-submit', 650);
  const after = await state();
  const created = (after.plots ?? []).find(
    (plot) => !(before.plots ?? []).some((oldPlot) => oldPlot.id === plot.id),
  );
  if (!created || created.type !== 'sowDiscord') throw new Error('旧入口未生成离间计');

  await click('command-domain-strategy');
  await click('command-strategy-facet-ongoing');
  const card = byId('command-strategy-plot-' + created.id);
  if (!card || !card.innerText.includes('离间计') || !card.innerText.includes('准备中')) {
    throw new Error('旧入口写入后计略摘要未即时同步');
  }
  const finalDrawer = byId('command-strategy-drawer');
  const finalWriteCount = finalDrawer.querySelectorAll('[data-command-write="true"]').length;
  if (finalWriteCount !== 0) throw new Error('计略只读抽屉出现提交入口');

  return {
    viewport: [innerWidth, innerHeight],
    facets,
    initialSituationMetrics,
    legacyLaunchEntries: allById('btn-plot-launch').length,
    commandStrategyWriteCount: finalWriteCount,
    syncedPlotType: created.type,
    syncedPlotStage: created.stage,
    syncedTarget: after.factions[created.targetFactionId]?.name ?? target.textContent,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P27 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
