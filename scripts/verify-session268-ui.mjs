// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 268：命令坞命中测试 + 旧 UI 清理 + S13 五槽装备数据链浏览器验收。 */
const cdpPort = process.env.CDP_PORT ?? '9240';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('未找到 Chrome page target');

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
    expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true,
  });
  if (result.result?.exceptionDetails) {
    throw new Error(result.result.exceptionDetails.exception?.description ?? result.result.exceptionDetails.text);
  }
  return result.result.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function physicalClick(testId) {
  const point = await evaluate(`
    const el = document.querySelector('[data-testid="${testId}"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2,
      hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid]')?.getAttribute('data-testid') };
  `);
  if (!point) throw new Error(`元素不存在：${testId}`);
  if (point.hit !== testId) throw new Error(`元素被遮挡：${testId}，命中 ${point.hit ?? '无 testid'}`);
  await evaluate(`document.elementFromPoint(${point.x}, ${point.y}).closest('[data-testid]').click(); return true;`);
  await pause(120);
}

await command('Runtime.enable');
await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173' });
await pause(1000);
await evaluate(`
  const response = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }) });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
`);
await pause(1500);

const initial = await evaluate(`
  const state = await (await fetch('/api/game/state')).json();
  const staticData = await (await fetch('/api/game/static')).json();
  return {
    oldSections: [...document.querySelectorAll('[data-testid="right-panel"] button')]
      .filter((el) => ['内政操作', '军事操作'].includes(el.textContent.trim())).length,
    dockButtons: document.querySelectorAll('[data-testid^="command-domain-"]').length,
    itemCount: staticData.items?.length ?? 0,
    caoEquipment: state.officers[1]?.equipment ?? {},
  };
`);
if (initial.oldSections !== 0) throw new Error(`旧操作区仍有 ${initial.oldSections} 个`);
if (initial.dockButtons !== 9) throw new Error(`命令域按钮应为9，实际 ${initial.dockButtons}`);
if (initial.itemCount < 5) throw new Error(`宝物静态目录异常：${initial.itemCount}`);
if (Object.keys(initial.caoEquipment).length === 0) throw new Error('运行态曹操装备数据为空');

const domains = ['civil', 'military', 'personnel', 'diplomacy', 'strategy', 'intel', 'farming', 'family', 'court'];
for (const domain of domains) {
  await physicalClick(`command-domain-${domain}`);
  const active = await evaluate(`return document.querySelector('[data-testid="command-domain-${domain}"]')?.getAttribute('aria-expanded');`);
  if (active !== 'true') throw new Error(`命令域未打开：${domain}`);
}

// 抽屉打开时再从“朝廷”物理切回“人事”，验证抽屉不再盖住命令坞。
await physicalClick('command-domain-personnel');
await physicalClick('command-personnel-officer-1');
await physicalClick('officer-tab-equipment');
const equipment = await evaluate(`
  const detail = document.querySelector('[data-testid="officer-detail"]');
  const labels = ['主武器', '副武器', '铠甲', '坐骑', '兵书'];
  return {
    slots: document.querySelectorAll('[data-testid^="equip-slot-"]').length,
    labels: labels.filter((label) => detail?.innerText.includes(label)).length,
    sword: detail?.innerText.includes('倚天剑') ?? false,
    tab: document.querySelector('[data-testid="officer-tab-equipment"]')?.textContent.trim(),
  };
`);
if (equipment.slots !== 5 || equipment.labels !== 5) throw new Error(`装备槽不完整：${JSON.stringify(equipment)}`);
if (!equipment.sword) throw new Error('曹操已绑定装备“倚天剑”未显示');
if (!/^装备\s+1\/5$/.test(equipment.tab ?? '')) throw new Error(`装备页签计数异常：${equipment.tab}`);

const realErrors = consoleErrors.filter((entry) => !/favicon/i.test(entry));
if (realErrors.length > 0) throw new Error(`控制台错误：${JSON.stringify(realErrors)}`);
console.log(JSON.stringify({ viewport: [1440, 900], ...initial, domainsOpened: domains.length,
  equipment, consoleErrors: 0 }, null, 2));
ws.close();
