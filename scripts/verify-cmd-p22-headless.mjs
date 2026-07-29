// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P22 内政迁移前浏览器基线。
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --window-size=1440,900 \
 *     --remote-debugging-port=9238 http://127.0.0.1:5173
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P22 Headless：未找到 Chrome page target');

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

  const right = byId('right-panel');
  const civilSection = sectionButton('内政操作', right);
  if (!civilSection) throw new Error('右栏内政操作入口缺失');
  civilSection.click();
  await pause();

  const legacyIds = [
    'btn-develop-farm',
    'btn-develop-commerce',
    'btn-develop-wall',
    'btn-relief',
    'btn-seek-beauty',
  ];
  for (const id of legacyIds) {
    if (allById(id).length !== 1) throw new Error('旧写入口数量异常：' + id);
  }

  await click('command-domain-civil');
  const drawer = document.querySelector('aside[aria-label="内政命令抽屉"]')
    ?? document.querySelector('[data-testid="command-drawer"]');
  if (!drawer) throw new Error('命令坞内政抽屉缺失');
  if (!drawer.innerText.includes('开发与施米暂仍在右侧城池面板')) {
    throw new Error('内政抽屉未说明旧入口位置');
  }
  const commandCivilWriteCount = drawer.querySelectorAll('[data-command-write="true"]').length;
  if (commandCivilWriteCount !== 0) throw new Error('内政抽屉提前出现提交入口');
  await click('command-domain-civil');

  const initial = await state();
  const cityId = Number(Object.values(initial.cities)
    .find((city) => city.ruler === initial.playerFactionId && city.gold >= 480 && city.food >= 150
      && (city.beautySeekLeft ?? 0) >= 1)?.id);
  const selectedName = right.querySelector('h2')?.innerText ?? '';
  const initialCity = initial.cities[cityId];
  if (!initialCity || !selectedName.includes(initialCity.name)) {
    throw new Error('开局未选中满足基线资源的玩家都城');
  }

  const beforeFarm = await state();
  await click('btn-develop-farm');
  if (byId('command-confirm-dialog')) throw new Error('旧农业开发不应伪报已有终审');
  const afterFarm = await state();
  const farmGain = afterFarm.cities[cityId].stats.farm - beforeFarm.cities[cityId].stats.farm;
  if (farmGain < 20 || farmGain > 30 || beforeFarm.cities[cityId].gold - afterFarm.cities[cityId].gold !== 100) {
    throw new Error('农业开发基线结算错误');
  }

  await click('btn-develop-commerce');
  const afterCommerce = await state();
  const commerceGain = afterCommerce.cities[cityId].stats.commerce - afterFarm.cities[cityId].stats.commerce;
  if (commerceGain < 18 || commerceGain > 28 || afterFarm.cities[cityId].gold - afterCommerce.cities[cityId].gold !== 100) {
    throw new Error('商业开发基线结算错误');
  }

  await click('btn-develop-wall');
  const afterWall = await state();
  const wallGain = afterWall.cities[cityId].stats.wall - afterCommerce.cities[cityId].stats.wall;
  if (wallGain < 15 || wallGain > 25 || afterCommerce.cities[cityId].gold - afterWall.cities[cityId].gold !== 120) {
    throw new Error('城防开发基线结算错误');
  }

  await click('btn-relief');
  const afterRelief = await state();
  const moraleGain = afterRelief.cities[cityId].stats.morale - afterWall.cities[cityId].stats.morale;
  if (moraleGain < 0 || moraleGain > 12 || afterWall.cities[cityId].food - afterRelief.cities[cityId].food !== 150) {
    throw new Error('施米基线结算错误');
  }

  const beforeSeek = afterRelief;
  await click('btn-seek-beauty');
  const afterSeek = await state();
  const seekGoldCost = beforeSeek.cities[cityId].gold - afterSeek.cities[cityId].gold;
  const stockDelta = (afterSeek.factions[afterSeek.playerFactionId].beautyStock ?? 0)
    - (beforeSeek.factions[beforeSeek.playerFactionId].beautyStock ?? 0);
  const seekLeftDelta = (beforeSeek.cities[cityId].beautySeekLeft ?? 0)
    - (afterSeek.cities[cityId].beautySeekLeft ?? 0);
  if (seekGoldCost !== 60 || ![0, 1].includes(stockDelta) || seekLeftDelta !== stockDelta) {
    throw new Error('S09 寻访基线结算错误');
  }

  const requiredLogs = ['develop_farm', 'develop_commerce', 'develop_wall', 'relief', 'beauty_seek'];
  for (const type of requiredLogs) {
    if (!afterSeek.actionLog.some((entry) => entry.type === type)) throw new Error('行动日志缺失：' + type);
  }

  return {
    viewport: [innerWidth, innerHeight],
    city: initialCity.name,
    legacyWriteEntries: legacyIds.length,
    commandCivilWriteCount,
    immediateSubmitWithoutConfirm: true,
    farmGain,
    commerceGain,
    wallGain,
    moraleGain,
    seekGoldCost,
    seekResult: stockDelta === 1 ? 'success' : 'failure',
    seekLeftDelta,
  };
`);

await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P22 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
