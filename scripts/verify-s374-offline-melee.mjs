// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 374：Tier I 战场 + 白刃战离线覆盖端到端验收（?offline=1，Chrome CDP 9242）。
 *
 * 前置：pnpm --filter @leh/client dev（vite:5173，无需后端）+ headless Chrome（CDP 9242）。
 *
 * 链路：
 *  1. 离线 boot → 选剧本/势力 → 世界屏；
 *  2. UI 存槽 S1 → IndexedDB 信封注入两支敌我 Army + activeBattlefield → 槽位 S2；
 *  3. UI 读档 S2 → 战场屏渲染（getBattlefield 恢复链）；
 *  4. 真实点击「进军X」（battlefieldMarch）往返一次；
 *  5. 「交战」→ 六角微操（createBattle + BattleView 渲染）→ 撤退 → 结算退出（50% 回流）；
 *  6. 「交战」→ 标准模式：战术姿态强攻（meleeSetTactic）→ 变阵圆阵 / 全军突击 / 普通攻击
 *     （meleeRound 幂等 commandId 链）→ 鸣金收兵（meleeExit）；
 *  7. 「交战」→ 自动结算（runAutoBattle + applyMeleeSettlement）→ 战斗结束面板；
 *  8. 「撤兵」（battlefieldExit）回世界屏；
 *  9. 断言全程零 /api/ 在线回退（XHR 钩子）+ 无未处理拒绝 + 控制台无非网络错误。
 */
const cdpPort = process.env.CDP_PORT ?? '9242';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('未找到 Chrome page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pendingMap = new Map();
const consoleErrors = [];
let nextId = 0;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Page.javascriptDialogOpening') {
    void cmd('Page.handleJavaScriptDialog', { accept: true });
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  pendingMap.get(m.id)?.(m);
};
await new Promise((r) => { ws.onopen = r; });
const cmd = (method, params = {}) => new Promise((res) => { const id = ++nextId; pendingMap.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const result = await cmd('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  const exc = result.result?.exceptionDetails;
  if (exc) throw new Error(exc.exception?.description ?? exc.text);
  return result.result.result.value;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expr)) return true;
    await pause(250);
  }
  return false;
}
async function clickByText(selector, text, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(`return (() => {
      const btn = [...document.querySelectorAll('${selector}')].find((b) => (b.textContent ?? '').includes('${text}'));
      if (!btn) return false; btn.click(); return true;
    })();`);
    if (ok) return true;
    await pause(250);
  }
  return false;
}
let pass = 0, fail = 0;
const assert = (c, msg) => { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.error(`  ✗ ${msg}`); } };
const dismissEvents = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await evaluate(`return !!document.querySelector('[data-testid="event-dialog-overlay"]')`))) return;
    await evaluate(`return (document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true`);
    await pause(400);
  }
};

await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__errs = [];
    window.__xhrUrls = [];
    window.addEventListener('unhandledrejection', function(e){ window.__errs.push(String((e.reason && e.reason.message) || e.reason)); });
    (function(){
      const origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url){
        if (String(url).includes('/api/')) window.__xhrUrls.push(String(url));
        return origOpen.call(this, method, url);
      };
    })();
  `,
});
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const targetUrl = process.env.SMOKE_URL ?? 'http://localhost:5173/?offline=1';
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);

assert(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`), '离线 boot：剧本选择就绪');
assert(await clickByText('button', '英雄集结'), '选择剧本：英雄集结');
await pause(500);
assert(await clickByText('button', '曹操'), '选择势力：曹操军');
await pause(400);
assert(await clickByText('button', '进入剧本'), '点击进入剧本');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`, 20000), '世界屏渲染');
await dismissEvents();

// ====== 槽位 S1（合法存档链起点） ======
const slotBase = `s374-${Date.now() % 1000000}`;
const slotA = `${slotBase}a`;
const slotB = `${slotBase}b`;
await evaluate(`return (() => { document.querySelector('[data-testid="btn-save-slots"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="save-slot-name"]')`), '槽位面板打开');
await evaluate(`return (() => {
  const input = document.querySelector('[data-testid="save-slot-name"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '${slotA}');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})();`);
await evaluate(`return (() => { document.querySelector('[data-testid="btn-save-slot"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-load-slot-${slotA}"]')`, 12000), `S1 已保存（${slotA}）`);

// ====== IndexedDB 注入：两支 Army + Tier I 战场 ======
const inject = await evaluate(`return (async () => {
  const openDb = () => new Promise((resolve, reject) => {
    const req = indexedDB.open('leh', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const db = await openDb();
  const readRec = (slot) => new Promise((resolve, reject) => {
    const tx = db.transaction('save_slots', 'readonly');
    const rq = tx.objectStore('save_slots').get(slot);
    rq.onsuccess = () => resolve(rq.result ?? null);
    rq.onerror = () => reject(rq.error);
  });
  const putRec = (rec) => new Promise((resolve, reject) => {
    const tx = db.transaction('save_slots', 'readwrite');
    const rq = tx.objectStore('save_slots').put(rec);
    rq.onsuccess = () => resolve(true);
    rq.onerror = () => reject(rq.error);
  });
  const record = await readRec('${slotA}');
  if (!record) return { ok: false, error: 'S1 记录不存在' };
  const envelope = JSON.parse(record.envelopeJson);
  const snap = envelope.snapshot;
  const pf = snap.playerFactionId;

  // 选一条 己方城 P ↔ 敌方城 T 的邻接边
  const nodes = snap.campaignNodes;
  let edge = null;
  for (const n of nodes) {
    if (n.ruler !== pf) continue;
    for (const adj of n.adjacentNodeIds) {
      const t = nodes.find((x) => x.id === adj);
      if (t && t.ruler != null && t.ruler !== pf) { edge = { p: n.id, t: t.id }; break; }
    }
    if (edge) break;
  }
  if (!edge) return { ok: false, error: '找不到敌我相邻边' };
  const targetNode = nodes.find((n) => n.id === edge.t);
  const enemyFactionId = targetNode.ruler;

  const mkArmy = (id, factionId, commanderId, name, troops, maxTroops) => ({
    id, factionId, name,
    commanderId, subCommanderIds: [],
    unitType: 'lightInfantry', formation: 0,
    currentNodeId: edge.t, path: [], phase: 'garrison',
    troops, maxTroops,
    food: Math.floor(maxTroops * 0.8), maxFood: maxTroops * 2,
    morale: 85, organization: 85,
    experience: 0, fatigue: 10,
    squads: [], structures: [],
  });
  const playerCommander = snap.factions[pf].officerIds[0];
  const enemyCommander = snap.factions[enemyFactionId].officerIds[0];
  if (!playerCommander || !enemyCommander) return { ok: false, error: '缺可任主将的武将' };
  const armyA = mkArmy('army-s374-a', pf, playerCommander, '曹操中军', 9000, 10000);
  const armyB = mkArmy('army-s374-b', enemyFactionId, enemyCommander, '敌军前部', 3000, 5000);

  // 复刻 engine/battlefield.ts extractBattlefieldNodes（目标+邻接∪出发+邻接）
  const relevant = new Set([edge.p, edge.t]);
  for (const id of targetNode.adjacentNodeIds) relevant.add(id);
  const fromNode = nodes.find((n) => n.id === edge.p);
  for (const id of (fromNode?.adjacentNodeIds ?? [])) relevant.add(id);
  const bfNodes = nodes.filter((n) => relevant.has(n.id)).map((n) => ({
    id: n.id, name: n.name, type: n.type, x: n.x, y: n.y, ruler: n.ruler,
    adjacentNodeIds: [...n.adjacentNodeIds],
    garrison: n.garrison ?? 0,
    wallDurability: Math.min(n.wallDurability ?? 0, n.maxWallDurability ?? 0),
    maxWallDurability: n.maxWallDurability ?? 0,
    armyIds: n.id === edge.t ? [armyA.id, armyB.id] : [],
    traps: [],
  }));
  snap.activeBattlefieldInstance = null;
  snap.activeMelee = null;
  snap.activeBattles = [];
  snap.campaignArmies = [armyA, armyB];
  snap.activeBattlefield = {
    id: 'bf-s374', warId: 'war-s374',
    attackerFactionId: pf, defenderFactionId: enemyFactionId,
    targetCityId: edge.t,
    nodes: bfNodes, armyIds: [armyA.id, armyB.id],
    turn: 0, phase: 'active',
  };

  const json = JSON.stringify(envelope);
  const bytes = new TextEncoder().encode(json).length;
  await putRec({
    slot: '${slotB}',
    updatedAt: new Date().toISOString(),
    scenarioId: Number(envelope.scenarioId ?? 0),
    sizeBytes: bytes,
    envelopeJson: json,
  });
  db.close();
  return { ok: true, targetName: targetNode.name, targetId: edge.t, enemy: enemyFactionId };
})();`);
assert(inject.ok === true, `信封注入成功（目标城 ${inject.targetName ?? inject.error}）`);

// 刷新槽位面板并读档 S2 → 战场屏
await evaluate(`return (() => { document.querySelector('.absolute.right-3.top-12 button')?.click(); return true; })();`);
await pause(400);
await evaluate(`return (() => { document.querySelector('[data-testid="btn-save-slots"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-load-slot-${slotB}"]')`, 12000), `S2 出现在槽位列表（${slotB}）`);
await evaluate(`return (() => { document.querySelector('[data-testid="btn-load-slot-${slotB}"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]') || document.body.innerText.includes('战场地图')`, 15000) && await waitFor(`return document.body.innerText.includes('战场地图')`, 8000), '读档 S2 → 战场屏渲染（getBattlefield 恢复链）');
assert(await waitFor(`return document.body.innerText.includes('1 处接战')`, 6000), '同节点敌我两军识别为接战');

// ====== battlefieldMarch：进军邻节点，再折返目标城 ======
const targetName = String(inject.targetName ?? '').replace(/'/g, '');
assert(await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '').startsWith('进军')); if (!b) return false; b.click(); return true; })();`), '点击「进军<邻城>」（battlefieldMarch）');
assert(await waitFor(`return !document.body.innerText.includes('处接战')`, 8000), '行军后离开目标城（接战解除）');
assert(await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '') === '进军${targetName}'); if (!b) return false; b.click(); return true; })();`), `折返「进军${targetName}」（battlefieldMarch 回目标城）`);
assert(await waitFor(`return document.body.innerText.includes('1 处接战')`, 10000), '接战恢复（两军重回同节点）');

// ====== 六角微操入口（createBattle + BattleView）→ 撤退 → 结算退出 ======
assert(await clickByText('button', '交战'), '点击「交战」弹出三选弹窗');
assert(await waitFor(`return !!document.querySelector('[data-testid="melee-mode-tactical"]')`, 6000), '白刃战三选弹窗出现');
await evaluate(`return (() => { document.querySelector('[data-testid="melee-mode-tactical"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="battle-weather"]')`, 12000), '六角微操：BattleView 渲染（离线 createBattle）');
await evaluate(`return (() => { document.querySelector('[data-testid="btn-battle-retreat"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-exit-battle"]')`, 12000), '战术撤退成功进入结束态');
await evaluate(`return (() => { document.querySelector('[data-testid="btn-exit-battle"]')?.click(); return true; })();`);
assert(await waitFor(`return document.body.innerText.includes('战斗结束')`, 12000), '六角微操结算回流 → 白刃战结束面板');

// ====== 标准模式：姿态/变阵/动作/刷新战术点/退出 ======
await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('返回战场地图')); b?.click(); return true; })();`);
await pause(600);
assert(await clickByText('button', '交战'), '再次「交战」');
assert(await waitFor(`return !!document.querySelector('[data-testid="melee-mode-standard"]')`, 6000), '三选弹窗恢复');
await evaluate(`return (() => { document.querySelector('[data-testid="melee-mode-standard"]')?.click(); return true; })();`);
assert(await waitFor(`return document.body.innerText.includes('标准指挥')`, 8000), '标准模式面板渲染');
const readRound = `return Number((document.body.innerText.match(/回合 (\\d+)\\/20/) ?? [])[1] ?? -1)`;
const readTp = `return Number((document.body.innerText.match(/战术点\\s*(\\d+)\\s*\\/\\s*10/) ?? [])[1] ?? -1)`;
const round0 = Number(await evaluate(readRound));
const tp0 = Number(await evaluate(readTp));
assert(round0 === 0 && tp0 > 0, `初始回合/战术点读数（round=${round0}, tp=${tp0}）`);
const troopsBefore = Number(await evaluate(`return Number((document.body.innerText.match(/进攻方 · 前军[\\s\\S]*?兵力\\s*([\\d,]+)/) ?? [])[1]?.replace(/,/g, '') ?? 0)`));
assert(troopsBefore > 0, `读取攻方兵力基线（${troopsBefore}）`);
// 战术姿态：强攻（不耗 TP）
await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('强攻')); b?.click(); return true; })();`);
await pause(500);
assert(await evaluate(`return [...document.querySelectorAll('button')].find((x) => x.textContent.includes('强攻'))?.disabled === true`), '战术姿态「强攻」写入（选中态禁用重复提交）');
// 变阵圆阵（cost 1，执行并推进到第 1 回合）
assert(await clickByText('button', '圆阵'), '变阵「圆阵」（meleeRound change_formation）');
await waitFor(`return Number((document.body.innerText.match(/回合 (\\d+)\\/20/) ?? [])[1] ?? -1) >= 1`, 8000);
assert(await evaluate(`return document.body.innerText.includes('圆阵')`), '第 1 回合变阵生效（攻方圆阵）');
// 全军突击（cost 4）
await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('全军突击')); b?.click(); return true; })();`);
await pause(300);
assert(await clickByText('button', '传令'), '传令·全军突击');
assert(await waitFor(`return document.body.innerText.includes('回合结果') && Number((document.body.innerText.match(/回合 (\\d+)\\/20/) ?? [])[1] ?? -1) >= 2`, 10000), '第 2 回合结算出结果（幂等 commandId 链）');
const tpLow = Number(await evaluate(readTp));
assert(tpLow >= 0 && tpLow < tp0, `动作消耗后战术点下降（${tp0} → ${tpLow}）`);
// 刷新战术点（meleeRefresh：主将智力加成回补）
await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('刷新战术点')); b?.click(); return true; })();`);
assert(await waitFor(`return Number((document.body.innerText.match(/战术点\\s*(\\d+)\\s*\\/\\s*10/) ?? [])[1] ?? -1) > ${tpLow}`, 8000), `刷新战术点回补（${tpLow} → 增加）`);
const troopsAfterStandard = Number(await evaluate(`return Number((document.body.innerText.match(/进攻方 · 前军[\\s\\S]*?兵力\\s*([\\d,]+)/) ?? [])[1]?.replace(/,/g, '') ?? 0)`));
assert(troopsAfterStandard > 0 && troopsAfterStandard <= troopsBefore, `标准模式兵力快照一致（${troopsBefore} → ${troopsAfterStandard}）`);
assert(await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('鸣金收兵')); b?.click(); return true; })();`), '鸣金收兵（meleeExit）');
assert(await waitFor(`return document.body.innerText.includes('战场地图')`, 8000), '退回战场屏');

// ====== 自动结算（runAutoBattle + applyMeleeSettlement） ======
assert(await clickByText('button', '交战'), '第三次「交战」');
assert(await waitFor(`return !!document.querySelector('[data-testid="melee-mode-auto"]')`, 6000), '三选弹窗恢复');
await evaluate(`return (() => { document.querySelector('[data-testid="melee-mode-auto"]')?.click(); return true; })();`);
assert(await waitFor(`return document.body.innerText.includes('战斗结束')`, 12000), '自动结算推演至战斗结束（applyMeleeSettlement）');
await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('返回战场地图')); b?.click(); return true; })();`);
assert(await waitFor(`return document.body.innerText.includes('战场地图')`, 8000), '返回战场屏');

// ====== 撤兵（battlefieldExit）回世界屏 ======
assert(await clickByText('button', '撤兵'), '点击「撤兵」（battlefieldExit）');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`, 10000), '回到世界屏');

// ====== 离线纯度与错误断言 ======
const xhrCalls = await evaluate(`return (window.__xhrUrls || []).length`);
assert(xhrCalls === 0, `零在线回退（/api/ 调用数 = ${xhrCalls}）`);
const errs = await evaluate(`return (window.__errs || []).join(' | ')`);
assert(!errs, `无未处理拒绝（${errs || '无'}）`);
const realErrors = consoleErrors.filter((t) => !/net::ERR|Failed to fetch|WebSocket|favicon/i.test(t));
assert(realErrors.length === 0, `控制台无非网络错误（${realErrors.length}）${realErrors[0] ? ': ' + realErrors[0].slice(0, 160) : ''}`);

console.log(`\n${pass} passed, ${fail} failed`);
ws.close();
process.exit(fail > 0 ? 1 : 0);
