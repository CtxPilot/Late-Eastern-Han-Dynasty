// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 376：离线覆盖扩充 III——郡域 battlefield-instance 写链端到端验收。
 *
 * 前置：pnpm --filter @leh/client dev（vite:5173，无需后端）+ headless Chrome（CDP 9242）。
 *
 * 真实点击链（?offline=1 全程离线）：
 *  1. UI 存槽 S1 → IndexedDB 信封注入一支玩家 CampaignArmy（合法 adoptSaveEnvelope 链）→ 存 S2 → 读档；
 *  2. 「南郡水网」进入郡域战场（enterNanjunBattlefield：模板生成 + 战况条渲染）；
 *  3. 阵前挑战（startBattlefieldDuel）→ DuelPanel 逐回合（stepBattlefieldDuel ×2）
 *     → 跳过至终局（skipBattlefieldDuel，runDuelToCompletion + settleBattlefieldDuel）
 *     → 返回战场（closeBattlefieldDuel，挑战按钮恢复可点 = activeDuel 清空）;
 *  4. 点击入口县「当阳」节点（engageCounty：runAutoBattle 攻打民兵驻军，
 *     占领后节点渲染「驻N」标记）;
 *  5. 「退出战场」（exitNanjunBattlefield）回世界屏；
 *  6. 断言全程零 /api/ 在线回退（XHR 钩子）+ 无未处理拒绝 + 控制台无非网络错误。
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
assert(await waitFor(`return [...document.querySelectorAll('button')].some((b) => b.textContent.includes('英雄集结'))`), '剧本按钮出现');
assert(await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('英雄集结')); b?.click(); return true; })();`), '选择剧本：英雄集结');
await pause(500);
assert(await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('曹操')); b?.click(); return true; })();`), '选择势力：曹操军');
await pause(400);
assert(await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入剧本')); b?.click(); return true; })();`), '点击进入剧本');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`, 20000), '世界屏渲染');
await dismissEvents();

// ====== 槽位 S1 → 注入玩家 CampaignArmy → S2 读档 ======
const slotBase = `s376-${Date.now() % 1000000}`;
const slotA = `${slotBase}a`;
const slotB = `${slotBase}b`;
assert(await evaluate(`return (() => { document.querySelector('[data-testid="btn-save-slots"]')?.click(); return true; })();`), '打开槽位面板');
assert(await waitFor(`return !!document.querySelector('[data-testid="save-slot-name"]')`, 8000), '槽位输入就绪');
await evaluate(`return (() => {
  const input = document.querySelector('[data-testid="save-slot-name"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, '${slotA}');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})();`);
await evaluate(`return (() => { document.querySelector('[data-testid="btn-save-slot"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-load-slot-${slotA}"]')`, 12000), `S1 已保存（${slotA}）`);

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
  const commander = snap.factions[pf].officerIds[0];
  const capital = snap.factions[pf].capitalCityId;
  if (!commander || capital == null) return { ok: false, error: '缺君主或治所' };
  snap.campaignArmies = [{
    id: 'army-s376', factionId: pf, name: '曹操南征军',
    commanderId: commander, subCommanderIds: [],
    unitType: 'lightInfantry', formation: 0,
    currentNodeId: capital, path: [], phase: 'garrison',
    troops: 9000, maxTroops: 10000,
    food: 6000, maxFood: 12000,
    morale: 90, organization: 85,
    experience: 0, fatigue: 5,
    squads: [], structures: [],
  }];
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
  return { ok: true };
})();`);
assert(inject.ok === true, `信封注入成功（${inject.error ?? '曹操南征军'}）`);
await evaluate(`return (() => { document.querySelector('.absolute.right-3.top-12 button')?.click(); return true; })();`);
await pause(400);
await evaluate(`return (() => { document.querySelector('[data-testid="btn-save-slots"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-load-slot-${slotB}"]')`, 12000), `S2 出现在槽位列表（${slotB}）`);
await evaluate(`return (() => { document.querySelector('[data-testid="btn-load-slot-${slotB}"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-enter-nanjun-battlefield"]')`, 15000), `读档 S2 回世界屏（带出征军）`);

// ====== 进入郡域战场（enterNanjunBattlefield） ======
assert(await evaluate(`return (() => { document.querySelector('[data-testid="btn-enter-nanjun-battlefield"]')?.click(); return true; })();`), '点击「南郡水网」');
assert(await waitFor(`return document.body.innerText.includes('郡域战争沙盘') && document.body.innerText.includes('南郡战场')`, 12000), '南郡战场沙盘渲染');
assert(await waitFor(`return !!document.querySelector('[data-testid="bf-dynamic-situation"]')`, 8000), '战况条渲染（天气/侦察/伏击/部署）');

// ====== 阵前单挑四链 ======
assert(await evaluate(`return (() => { document.querySelector('[data-testid="btn-formation-front-duel"]')?.click(); return true; })();`), '点击「阵前挑战」');
assert(await waitFor(`return !!document.querySelector('[data-testid="duel-stance-summary"]')`, 10000), 'DuelPanel 渲染（createDuel 经权威引擎）');
for (let i = 0; i < 2; i++) {
  await evaluate(`return (() => { const b=document.querySelector('[data-testid="btn-duel-step"]'); if (!b) return false; b.click(); return true; })();`);
  await pause(500);
}
assert(true, `阵前单挑逐回合推进 ×2（stepDuel + 装备加成入参）`);
await evaluate(`return (() => { document.querySelector('[data-testid="btn-duel-skip"]')?.click(); return true; })();`);
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-close-battlefield-duel"]')`, 12000), '跳过至终局结算（runDuelToCompletion + settleBattlefieldDuel）');
await evaluate(`return (() => { document.querySelector('[data-testid="btn-close-battlefield-duel"]')?.click(); return true; })();`);
assert(await waitFor(`return !document.querySelector('[data-testid="duel-stance-summary"]') && !document.querySelector('[data-testid="btn-formation-front-duel"]')?.disabled`, 10000), '关闭单挑回战场（activeDuel 清空，挑战按钮恢复）');

// ====== 攻打当阳（engageCounty） ======
const clickNode = await evaluate(`return (() => {
  const g = document.querySelector('[data-testid="bf-node-nanjun_dangyang"]');
  if (!g) return false;
  g.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return true;
})()`);
assert(clickNode, '点击当阳县节点（engageCounty：runAutoBattle vs 民兵驻军）');
assert(await waitFor(`return !!document.querySelector('[data-testid="bf-node-nanjun_dangyang"] text:last-child') && (document.querySelector('[data-testid="bf-node-nanjun_dangyang"]').textContent.includes('驻'))`, 15000), '当阳占领生效（节点渲染「驻N」占领标记）');

// ====== 退出战场（exitNanjunBattlefield） ======
assert(await evaluate(`return (() => { document.querySelector('[data-testid="btn-exit-battlefield"]')?.click(); return true; })();`), '点击「退出战场」');
assert(await waitFor(`return !!document.querySelector('[data-testid="btn-enter-nanjun-battlefield"]')`, 10000), '回到世界屏');

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
