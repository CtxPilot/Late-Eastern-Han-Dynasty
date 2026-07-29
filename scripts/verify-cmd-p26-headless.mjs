// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P26 计略迁移前浏览器基线。
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --window-size=1440,900 \
 *     --remote-debugging-port=9238 http://127.0.0.1:5173
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P26 Headless：未找到 Chrome page target');

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
  const state = async () => {
    const response = await fetch('/api/game/state');
    if (!response.ok) throw new Error('读取权威状态失败：' + await response.text());
    return response.json();
  };
  const totalGold = (game) => Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId)
    .reduce((sum, city) => sum + city.gold, 0);

  const left = byId('left-panel');
  const plotSection = sectionButton('计谋', left);
  if (!plotSection) throw new Error('左栏计谋入口缺失');
  plotSection.click();
  await pause();

  const legacyPanel = byId('plot-panel');
  if (!legacyPanel || allById('btn-plot-launch').length !== 1) {
    throw new Error('旧计谋面板或发起入口数量异常');
  }

  await click('command-domain-strategy');
  const drawer = document.querySelector('aside[aria-label="计略命令抽屉"]')
    ?? document.querySelector('[data-testid="command-drawer"]');
  if (!drawer || !drawer.innerText.includes('仍在左侧计谋面板')) {
    throw new Error('计略抽屉未说明旧入口位置');
  }
  const commandStrategyWriteCount = drawer.querySelectorAll('[data-command-write="true"]').length;
  if (commandStrategyWriteCount !== 0) throw new Error('计略抽屉提前出现提交入口');
  await click('command-domain-strategy');

  const selects = legacyPanel.querySelectorAll('select');
  const typeSelect = selects[0];
  if (!typeSelect) throw new Error('旧计谋类型选择器缺失');
  typeSelect.value = 'sowDiscord';
  typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();

  const targetSelect = legacyPanel.querySelectorAll('select')[1];
  const targetOption = [...targetSelect.options].find((option) => option.value && !option.disabled);
  if (!targetOption) throw new Error('离间计没有可用目标势力');
  targetSelect.value = targetOption.value;
  targetSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();

  const beforeCancel = await state();
  await click('btn-plot-launch');
  const reviewText = byId('command-confirm-dialog')?.innerText ?? '';
  if (!reviewText.includes('确认发起离间计') || !reviewText.includes('金 200')) {
    throw new Error('旧离间计未进入正确终审');
  }
  await click('command-confirm-cancel');
  const afterCancel = await state();
  if (totalGold(afterCancel) !== totalGold(beforeCancel)
    || (afterCancel.plots?.length ?? 0) !== (beforeCancel.plots?.length ?? 0)) {
    throw new Error('取消离间计改变了权威状态');
  }

  await click('btn-plot-launch');
  await click('command-confirm-submit', 650);
  const afterConfirm = await state();
  const newPlots = (afterConfirm.plots ?? []).filter(
    (plot) => !(beforeCancel.plots ?? []).some((oldPlot) => oldPlot.id === plot.id),
  );
  if (totalGold(beforeCancel) - totalGold(afterConfirm) !== 200
    || newPlots.length !== 1
    || newPlots[0].type !== 'sowDiscord'
    || newPlots[0].targetFactionId !== Number(targetOption.value)
    || newPlots[0].stage !== 'prep') {
    throw new Error('离间计确认后的权威结算错误');
  }
  if (!afterConfirm.actionLog.some((entry) => entry.type === 'plot_launch')) {
    throw new Error('离间计行动日志缺失');
  }

  return {
    viewport: [innerWidth, innerHeight],
    legacyPlotPanels: allById('plot-panel').length,
    legacyLaunchEntries: allById('btn-plot-launch').length,
    commandStrategyWriteCount,
    targetFaction: afterConfirm.factions[Number(targetOption.value)]?.name ?? targetOption.textContent,
    cancelUnchanged: true,
    goldCost: totalGold(beforeCancel) - totalGold(afterConfirm),
    createdPlotType: newPlots[0].type,
    createdPlotStage: newPlots[0].stage,
    plotLaunchLog: true,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P26 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
