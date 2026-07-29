// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P23 内政只读城市总览浏览器验收。
 * 前置：pnpm dev；1440×900 Chrome CDP（默认 9238）。
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P23 Headless：未找到 Chrome page target');

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
  const state = async () => (await fetch('/api/game/state')).json();
  const click = async (id) => {
    const element = byId(id);
    if (!element || element.disabled) throw new Error('元素缺失或不可用：' + id);
    element.click();
    await pause();
  };

  const right = byId('right-panel');
  const civilSection = sectionButton('内政操作', right);
  if (!civilSection) throw new Error('右栏内政操作入口缺失');
  civilSection.click();
  await pause();

  const legacyIds = ['btn-develop-farm', 'btn-develop-commerce', 'btn-develop-wall', 'btn-relief', 'btn-seek-beauty'];
  for (const id of legacyIds) {
    if (allById(id).length !== 1) throw new Error('旧写入口数量异常：' + id);
  }

  await click('command-domain-civil');
  const drawer = byId('command-civil-drawer');
  if (!drawer) throw new Error('内政只读抽屉缺失');
  const facetIds = ['overview', 'industry', 'construction', 'relief'];
  for (const id of facetIds) {
    if (allById('command-civil-facet-' + id).length !== 1) throw new Error('内政分面数量异常：' + id);
  }
  const selector = byId('command-civil-city-select');
  const initial = await state();
  const ownCities = Object.values(initial.cities).filter((city) => city.ruler === initial.playerFactionId);
  if (!selector || selector.options.length !== ownCities.length) throw new Error('己方城市选择器数量错误');
  if (drawer.querySelectorAll('[data-command-write="true"]').length !== 0) throw new Error('只读抽屉出现写入口');

  await click('command-civil-facet-industry');
  const cityId = Number(selector.value);
  const before = await state();
  const beforeFarm = before.cities[cityId].stats.farm;
  const shownBefore = Number(byId('command-civil-value-farm')?.innerText);
  if (shownBefore !== beforeFarm) throw new Error('农业摘要未读取权威状态');
  byId('btn-develop-farm').click();
  await pause(450);
  const after = await state();
  const shownAfter = Number(byId('command-civil-value-farm')?.innerText);
  if (shownAfter !== after.cities[cityId].stats.farm || shownAfter <= shownBefore) {
    throw new Error('旧农业写操作后只读摘要未即时同步');
  }

  for (const id of ['construction', 'relief', 'overview']) await click('command-civil-facet-' + id);
  return {
    viewport: [innerWidth, innerHeight],
    selectedCity: before.cities[cityId].name,
    ownCityOptions: selector.options.length,
    facets: facetIds,
    newWriteButtons: drawer.querySelectorAll('[data-command-write="true"]').length,
    legacyWriteEntries: legacyIds.length,
    farmGain: shownAfter - shownBefore,
    snapshotSync: true,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P23 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
