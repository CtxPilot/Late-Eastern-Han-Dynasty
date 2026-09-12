// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// Session 444 docs/45 S5a：策应军手动入场 UI 冒烟（?offline=1，Chrome CDP 9242）。
// 前置：pnpm --filter @leh/client dev（vite:5173）+ headless Chrome（CDP 9242）。
//
// 说明：S5a 手动入场的正向场景（战斗进行中新增策应军）在纯 UI 点击下不可达——
// 同城围城军在开战时已被 doCampaignSiegeStorm 整组纳入（除 8 帽溢出，而溢出军
// 亦超帽不可再入），后至援军又须在战斗屏推进月结。故沿 s374/s369 先例，经
// IndexedDB 注入合法存档信封（真实战斗快照由引擎同源构造），再走读档→BattleView。
// 覆盖：存槽 → 注入「亲统围城战 + 一支未入战同城围城军」→ 读档落战场屏
//       → 「增援入场」按钮可见（D2 资格）→ 选择器列出且仅列出资格军（D9）
//       → 点击入场 → 军旗条出现增援军（D5 整军入场）→ console 0 error。
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
const cmd = (method, params = {}) => new Promise((res) => {
  const id = ++nextId;
  pendingMap.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await cmd('Runtime.evaluate', {
    expression: `(async()=>{${expression}})()`,
    awaitPromise: true,
    returnByValue: true,
  });
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
async function clickByTestId(testid, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(`return (() => {
      const el = document.querySelector('[data-testid="${testid}"]');
      if (!el || el.disabled) return false; el.click(); return true;
    })();`);
    if (ok) return true;
    await pause(250);
  }
  return false;
}
const setInput = (testid, value) => evaluate(`return (() => {
  const input = document.querySelector('[data-testid="${testid}"]');
  if (!input) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, '${value}');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})();`);
let pass = 0;
let fail = 0;
const assert = (c, msg) => {
  if (c) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error(`  ✗ ${msg}`); }
};
const dismissEvents = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await evaluate(`return !!document.querySelector('[data-testid="event-dialog-overlay"]')`))) return;
    await evaluate(`return (document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true`);
    await pause(400);
  }
};

const slotSrc = 's45a-src';
const slotDst = 's45a';

await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const targetUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/?offline=1';
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);

assert(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`), '进入剧本选择');
await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>[...x.querySelectorAll('h2')].some(h=>h.textContent==='英雄集结·开局即高光（0-A Demo）')); b?.click(); return !!b; })();`);
await pause(500);
await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>[...x.querySelectorAll('strong')].some(s=>s.textContent==='曹操军')); b?.click(); return !!b; })();`);
await pause(400);
assert(await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入剧本')); b?.click(); return !!b; })();`), '点击进入剧本（曹操军）');
assert(await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`, 20000), '世界屏载入');
await dismissEvents();

// —— 存源槽 ——
assert(await clickByTestId('btn-save-slots'), '打开槽位存档面板');
assert(await waitFor(`return !!document.querySelector('[data-testid="save-slot-name"]')`), '槽位面板就绪');
await setInput('save-slot-name', slotSrc);
await pause(200);
assert(await clickByTestId('btn-save-slot'), `保存源槽「${slotSrc}」`);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-load-slot-${slotSrc}"]')`, 12000), `源槽出现在列表（${slotSrc}）`);

// —— IndexedDB 注入：亲统围城战 + 一支未入战同城围城军 ——
const inject = await evaluate(`return (async () => {
  const openDb = () => new Promise((resolve, reject) => {
    const req = indexedDB.open('leh', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('save_slots')) {
        const store = db.createObjectStore('save_slots', { keyPath: 'slot' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
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
  const record = await readRec('${slotSrc}');
  if (!record) return { ok: false, error: '源槽记录不存在' };
  const envelope = JSON.parse(record.envelopeJson);
  const snap = envelope.snapshot;
  const pf = snap.playerFactionId;
  const cityId = 11;
  const city = snap.cities[cityId];
  if (!city) return { ok: false, error: '目标城不存在' };
  const defenderFaction = city.ruler;
  if (defenderFaction == null || defenderFaction === pf) return { ok: false, error: '目标城非敌对' };
  const attackerOfficer = snap.factions[pf].officerIds[0];
  const reserveOfficer = snap.factions[pf].officerIds[1];
  const defenderOfficer = snap.factions[defenderFaction].officerIds[0];
  if (!attackerOfficer || !reserveOfficer || !defenderOfficer) return { ok: false, error: '缺可任主将的武将' };

  const mkArmy = (id, name, commanderId) => ({
    id, factionId: pf, name,
    commanderId, subCommanderIds: [],
    unitType: 'lightInfantry', formation: 0,
    currentNodeId: cityId, targetNodeId: cityId, path: [], phase: 'sieging',
    troops: 5000, maxTroops: 5000,
    food: 3000, maxFood: 9000,
    morale: 85, organization: 85,
    experience: 0, fatigue: 0,
    squads: [], structures: [], fromNodeId: 5,
  });
  const armyA = mkArmy('army-s45a-a', '关羽军', attackerOfficer);
  const armyB = mkArmy('army-s45a-b', '张飞军', reserveOfficer);

  const mkUnit = (id, armyId, commanderId, commanderName, factionId, side, q, r) => ({
    id, armyId,
    commanderId, commanderName, factionId, side,
    unitType: 'lightInfantry', formation: 0,
    troopCount: 5000, maxTroops: 5000,
    morale: 80, food: 3000,
    position: { q, r }, facing: side === 'attacker' ? 0 : 3,
    mp: 5, maxMp: 5, energy: 100, maxEnergy: 100,
    hasActed: false, isRetreated: false, isDestroyed: false, statusEffects: [],
  });
  const terrain = Array.from({ length: 15 }, () => Array.from({ length: 20 }, () => 'plain'));
  const battle = {
    id: 'battle-inj-11-1', turn: 1, weather: 'clear', weatherChangeTimer: 3,
    attackerFaction: pf, defenderFaction, isSiege: true, cityId,
    settled: false, phase: 'player', winner: null,
    units: [
      mkUnit('attacker-army-s45a-a-' + attackerOfficer, armyA.id, attackerOfficer, '关羽', pf, 'attacker', 2, 3),
      mkUnit('defender-1', 'army-def-1', defenderOfficer, '守将', defenderFaction, 'defender', 16, 11),
    ],
    hexGrid: { width: 20, height: 15, terrain },
    log: [{ turn: 1, message: '测试亲统强攻（注入）' }],
    message: '亲统强攻！歼灭守军即可占城',
    tacticalPoints: 5, tacticalPointsUsed: 0,
  };
  snap.activeBattles = [battle];
  snap.activeBattlefield = null;
  snap.activeMelee = null;
  snap.activeBattlefieldInstance = null;
  snap.campaignArmies = [armyA, armyB];

  const json = JSON.stringify(envelope);
  const bytes = new TextEncoder().encode(json).length;
  await putRec({
    slot: '${slotDst}',
    updatedAt: new Date().toISOString(),
    scenarioId: Number(envelope.scenarioId ?? 0),
    sizeBytes: bytes,
    envelopeJson: json,
  });
  db.close();
  return { ok: true, reserveId: armyB.id, reserveName: armyB.name, mainId: armyA.id };
})();`);
assert(inject.ok === true, `注入合法存档信封（${inject.ok ? inject.reserveName : inject.error}）`);

// —— 刷新槽位并读档 → 战场屏 ——
await evaluate(`return (() => { document.querySelector('[data-testid="btn-save-slots"]')?.click(); return true; })();`);
await pause(400);
assert(await clickByTestId('btn-save-slots'), '重新打开槽位面板');
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-load-slot-${slotDst}"]')`, 12000), `注入槽出现（${slotDst}）`);
await clickByTestId(`btn-load-slot-${slotDst}`);
assert(await waitFor(`return !!document.querySelector('[data-testid="battle-weather"]')`, 20000), '读档落战场屏（BattleView 渲染）');
await pause(800);

// —— 增援入场：按钮可见 → 选择器 → 入场 ——
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-battle-reinforce"]')`, 8000), 'D2/D9：「增援入场」按钮可见（存在资格军）');
const beforeBanners = await evaluate(`return document.querySelector('[data-testid="battle-army-banners"]')?.textContent?.trim() ?? '';`);
assert(!beforeBanners.includes(inject.reserveName), `入场前军旗条不含援军（${beforeBanners || '—'}）`);
assert(await clickByTestId('btn-battle-reinforce'), '点击「增援入场」展开选择器');
assert(await waitFor(`return !!document.querySelector('[data-testid="battle-reinforce-picker"]')`), '选择器出现');
assert(await evaluate(`return !!document.querySelector('[data-testid="battle-reinforce-${inject.reserveId}"]')`), '选择器列出资格援军');
assert(await evaluate(`return !document.querySelector('[data-testid="battle-reinforce-${inject.mainId}"]')`), '选择器不含已参战主军');
assert(await clickByTestId(`battle-reinforce-${inject.reserveId}`), '点击援军入场');
assert(await waitFor(`return document.querySelector('[data-testid="battle-army-banners"]')?.textContent?.includes('${inject.reserveName}') ?? false`, 10000), '入场后军旗条出现援军（整军入场）');
const afterBanners = await evaluate(`return document.querySelector('[data-testid="battle-army-banners"]')?.textContent?.trim() ?? '';`);
assert(afterBanners.includes(inject.reserveName), `军旗条「${afterBanners}」`);
const report = await evaluate(`return document.querySelector('[data-testid="battle-report"]')?.textContent ?? '';`);
assert(report.includes('增援入场'), '战报含「增援入场」行');
assert(await evaluate(`return !document.querySelector('[data-testid="battle-reinforce-picker"]')`), '入场后选择器收起');

// —— console 错误 ——
const realErrors = consoleErrors.filter((m) => !m.includes('favicon') && !m.includes('/api/'));
assert(realErrors.length === 0, `无非网络 console error（${realErrors.length}）`);
if (realErrors.length > 0) console.error(realErrors.slice(0, 3));

console.log(`Session 444 S5a 策应军手动入场 UI: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
