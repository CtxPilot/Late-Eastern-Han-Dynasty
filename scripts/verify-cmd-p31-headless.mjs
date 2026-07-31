// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** CMD-P31 情报四分面只读态势。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P31 Headless：未找到 Chrome page target');
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
  const state = async () => (await fetch('/api/game/state')).json();
  const intelButton = [...byId('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith('谍报'));
  if (!intelButton) throw new Error('旧谍报入口缺失');
  intelButton.click();
  await pause();
  const legacyPanel = document.querySelectorAll('[data-testid="spy-panel"]').length;
  const legacyWrites = {
    recruit: document.querySelectorAll('[data-testid="btn-spy-recruit"]').length,
    trainFemale: document.querySelectorAll('[data-testid="btn-spy-train-female"]').length,
    plantFemale: document.querySelectorAll('[data-testid="intel-plant-female"]').length,
    mission: document.querySelectorAll('[data-testid="btn-spy-mission"]').length,
  };
  if (legacyPanel !== 1 || Object.values(legacyWrites).some((count) => count !== 1)) {
    throw new Error('旧情报入口基线异常：' + JSON.stringify({ legacyPanel, legacyWrites }));
  }
  await click('command-domain-intel');
  const facets = ['situation', 'personnel', 'tasks', 'counter'];
  for (const facet of facets) {
    if (document.querySelectorAll('[data-testid="command-intel-facet-' + facet + '"]').length !== 1) {
      throw new Error('情报分面数量异常：' + facet);
    }
    await click('command-intel-facet-' + facet);
    if (!byId('command-intel-panel-' + facet)) throw new Error('情报分面未切换：' + facet);
  }
  const newWriteCount = byId('command-drawer')
    .querySelectorAll('[data-command-write="true"]').length;
  if (newWriteCount !== 0) throw new Error('P31 命令坞情报不应出现写入口');
  await click('command-domain-intel');
  const before = await state();
  const beforeAgents = Object.values(before.intel.agents)
    .filter((agent) => agent.factionId === before.playerFactionId && agent.status !== 'dead').length;
  await click('btn-spy-recruit');
  await click('command-confirm-submit', 650);
  const after = await state();
  const ownAgents = Object.values(after.intel.agents)
    .filter((agent) => agent.factionId === after.playerFactionId && agent.status !== 'dead');
  const recruited = ownAgents.length - beforeAgents;
  if (recruited < 1 || recruited > 3) throw new Error('旧招募链未产生1～3名密探');
  await click('command-domain-intel');
  await click('command-intel-facet-personnel');
  const personnelText = byId('command-intel-panel-personnel').innerText;
  if (!ownAgents.every((agent) => personnelText.includes(agent.name))) {
    throw new Error('人员摘要未与旧招募结果即时同步');
  }
  return {
    viewport: [innerWidth, innerHeight], legacyPanel, legacyWrites, facets,
    newWriteCount, recruited, personnelSynced: true,
  };
`);
await ws.close();
if (consoleErrors.length > 0) {
  throw new Error(`CMD-P31 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
}
console.log(JSON.stringify({ ...result, consoleErrors: consoleErrors.length }, null, 2));
