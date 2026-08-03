// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** BF-P6 回归：真实 Chrome 验证 Tier I 战场地图撤兵回大地图。需 dev + Chrome CDP。 */
const port = process.env.CDP_PORT ?? '9223';
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('未找到 Chrome page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map(); const errors = []; let nextId = 0;
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
  pending.get(message.id)?.(message);
};
await new Promise((resolve) => { ws.onopen = resolve; });
const command = (method, params = {}) => new Promise((resolve) => { const id = ++nextId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (source) => {
  const result = await command('Runtime.evaluate', { expression: `(async()=>{${source}})()`, awaitPromise: true, returnByValue: true });
  if (result.result?.exceptionDetails) throw new Error(result.result.exception?.description ?? result.result.exceptionDetails.text);
  return result.result.result.value;
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await command('Runtime.enable');
await command('Page.navigate', { url: 'http://localhost:5173/' });
await wait(700);
await evaluate(`
  const created = await fetch('/api/game/create', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({scenarioId: 1, playerFactionId: 2}) });
  if (!created.ok) throw Error(await created.text());
  const state = await created.json();
  const from = Object.values(state.cities).find((city) => city.ruler === state.playerFactionId && city.troops >= 1000 && state.campaignNodes.find((node) => node.id === city.id)?.adjacentNodeIds.some((id) => state.cities[id]?.ruler !== state.playerFactionId));
  const target = state.campaignNodes.find((node) => node.id === from.id).adjacentNodeIds.find((id) => state.cities[id]?.ruler !== state.playerFactionId);
  const initialized = await fetch('/api/game/battlefield/init', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({targetCityId: target, fromCityId: from.id}) });
  if (!initialized.ok) throw Error(await initialized.text());
  location.reload();
`);
await wait(1200);
if (!(await evaluate(`return document.body.innerText.includes('战场地图') && Boolean([...document.querySelectorAll('button')].find((button) => button.textContent?.includes('撤兵')))`))) throw new Error('Tier I 战场地图或撤兵按钮未渲染');
await evaluate(`const button=[...document.querySelectorAll('button')].find((node)=>node.textContent?.includes('撤兵')); button.click();`);
await wait(700);
const result = await evaluate(`const state=await (await fetch('/api/game/state')).json(); return { activeBattlefield: state.activeBattlefield, world: document.body.innerText.includes('结束回合') };`);
if (result.activeBattlefield !== null || !result.world) throw new Error(`Tier I 退出未回大地图：${JSON.stringify(result)}`);
await evaluate(`const created=await fetch('/api/game/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenarioId:1,playerFactionId:1})}); if(!created.ok) throw Error(await created.text()); location.reload();`);
await wait(900);
await evaluate(`const button=document.querySelector('[data-testid="btn-enter-nanjun-battlefield"]'); if(!button) throw Error('郡域战场入口未渲染'); button.click();`);
await wait(700);
if (!(await evaluate(`return Boolean(document.querySelector('[data-testid="btn-exit-battlefield"]'))`))) throw new Error('Tier II 退出按钮未渲染');
await evaluate(`document.querySelector('[data-testid="btn-exit-battlefield"]').click();`);
await wait(600);
const commanderyResult = await evaluate(`const state=await (await fetch('/api/game/state')).json(); return { activeBattlefieldInstance: state.activeBattlefieldInstance, world: document.body.innerText.includes('结束回合') };`);
if (commanderyResult.activeBattlefieldInstance !== null || !commanderyResult.world) throw new Error(`Tier II 退出未回大地图：${JSON.stringify(commanderyResult)}`);
if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`);
console.log(JSON.stringify({ tierI: true, tierII: true, exit: true, returnedWorld: true, consoleErrors: 0 }));
ws.close();
