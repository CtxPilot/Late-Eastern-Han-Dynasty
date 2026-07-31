// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** BF-P4 两郡对照浏览器验收。需 dev + 1440×900 CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('BF-P4 Headless：未找到 Chrome page target');
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
  if (!response.ok) throw new Error(await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1400));
const result = await evaluate(`
  const pause = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
  const click = (id) => {
    const node = document.querySelector('[data-testid="' + id + '"]');
    if (!node) throw new Error('缺少控件 ' + id);
    node.click();
  };
  click('btn-enter-yingchuan-battlefield');
  await pause(800);
  const yingchuan = document.body.innerText;
  if (!yingchuan.includes('颍川郡战场') || !yingchuan.includes('郡治：阳翟')) {
    throw new Error('颍川标题或郡治未呈现');
  }
  if (!yingchuan.includes('17 县 / 29 路线')) {
    throw new Error('颍川节点/道路对照不符：' + yingchuan.slice(-300));
  }
  if (document.querySelectorAll('[data-testid^="bf-node-yingchuan_"]').length !== 17) {
    throw new Error('颍川县节点 DOM 数量不为17');
  }
  document.querySelector('[data-testid="battlefield-duel-stance"]').value = 'assault';
  document.querySelector('[data-testid="battlefield-duel-stance"]').dispatchEvent(new Event('change', { bubbles: true }));
  click('btn-formation-front-duel');
  await pause(500);
  if (!document.body.innerText.includes('单挑：') || !document.body.innerText.includes('强攻')) {
    throw new Error('阵前单挑未进入共用 DuelPanel 或倾向未生效');
  }
  click('btn-duel-step');
  await pause(250);
  click('btn-duel-skip');
  await pause(500);
  if (!document.querySelector('[data-testid="btn-close-battlefield-duel"]')) {
    throw new Error('阵前单挑未完成权威结算：' + document.body.innerText.slice(-500));
  }
  click('btn-close-battlefield-duel');
  await pause(300);
  click('btn-city-front-duel');
  await pause(300);
  click('btn-duel-skip');
  await pause(500);
  if (!document.querySelector('[data-testid="btn-close-battlefield-duel"]')) {
    throw new Error('城下单挑未完成权威结算');
  }
  click('btn-close-battlefield-duel');
  await pause(300);
  click('btn-exit-battlefield');
  await pause(600);
  click('btn-enter-nanjun-battlefield');
  await pause(800);
  const nanjun = document.body.innerText;
  if (!nanjun.includes('南郡战场') || !nanjun.includes('16 县 / 11 路线')) {
    throw new Error('南郡旧模板回归失败');
  }
  return {
    viewport: [innerWidth, innerHeight],
    yingchuan: '17县/29道路/阳翟郡治',
    nanjun: '16县/11路线/江陵郡治',
    duels: '阵前+城下共享演出并完成回写',
  };
`);
ws.close();
if (consoleErrors.length > 0) throw new Error(`BF-P4 Headless：控制台错误 ${JSON.stringify(consoleErrors)}`);
console.log(JSON.stringify({ ...result, consoleErrors: 0 }, null, 2));
