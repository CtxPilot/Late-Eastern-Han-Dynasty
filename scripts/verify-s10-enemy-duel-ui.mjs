// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** S10：真实 Chrome 验收六角敌军主动单挑。需 dev + CDP。 */
const port = process.env.CDP_PORT ?? '9222';
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = targets.find((item) => item.type === 'page' && item.url.startsWith('http://127.0.0.1:5173')) ?? targets.find((item) => item.type === 'page');
if (!target) throw new Error('未找到 Chrome page target');
const ws = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map(); const errors = []; let id = 0;
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((arg) => arg.value ?? arg.description).join(' '));
  pending.get(msg.id)?.(msg);
};
await new Promise((resolve) => { ws.onopen = resolve; });
const command = (method, params = {}) => new Promise((resolve) => { const next = ++id; pending.set(next, resolve); ws.send(JSON.stringify({ id: next, method, params })); });
const evaluate = async (source) => {
  const out = await command('Runtime.evaluate', { expression: `(async()=>{${source}})()`, awaitPromise: true, returnByValue: true });
  if (out.result?.exceptionDetails) throw new Error(out.result.exception?.description ?? out.result.exceptionDetails.text);
  return out.result.result.value;
};
await command('Runtime.enable');

const click = async (testid) => {
  const point = await evaluate(`const el=document.querySelector('[data-testid="${testid}"]'); if(!el) throw Error('未找到 ${testid}'); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 300));
};
const clickHex = async (q, r) => {
  const point = await evaluate(`const c=document.querySelector('canvas'); if(!c) throw Error('未找到六角战场 canvas'); const b=c.getBoundingClientRect(); const s=28; return {x:b.left+50+s*(Math.sqrt(3)*${q}+(Math.sqrt(3)/2)*${r}),y:b.top+50+s*(1.5*${r})};`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 350));
};
const state = () => evaluate(`const r=await fetch('/api/game/battle'); if(!r.ok) throw Error(await r.text()); return await r.json();`);
const distance = (a, b) => (Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2;
const waitFor = async (predicate, label, limit = 40) => {
  for (let i = 0; i < limit; i += 1) { const value = await state(); if (predicate(value)) return value; await new Promise((resolve) => setTimeout(resolve, 350)); }
  throw new Error(`等待${label}超时`);
};

// 每次重开都使用真实 UI 进入战斗；通过最多 16 个战斗回合等待共享 8% 触发判定。
await command('Page.navigate', { url: 'http://127.0.0.1:5173/' });
await new Promise((resolve) => setTimeout(resolve, 800));
await evaluate(`const c=await fetch('/api/game/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenarioId:1,playerFactionId:1})}); if(!c.ok) throw Error(await c.text()); const b=await fetch('/api/game/battle/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cityId:19})}); if(!b.ok) throw Error(await b.text()); location.reload();`);
await waitFor((value) => value?.phase === 'player', '战斗开始');
for (let i = 0; i < 40; i += 1) {
  if (await evaluate(`return Boolean(document.querySelector('canvas'));`)) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (i === 39) throw new Error('六角战场画布未渲染');
}

let duel = null;
for (let round = 0; round < 16 && !duel; round += 1) {
  let current = await state();
  if (current.phase === 'over') throw new Error('敌军主动单挑验收在触发前结束');
  if (current.duel) { duel = current; break; }
  if (current.phase === 'enemy') { await waitFor((value) => value.phase !== 'enemy', '敌军回合'); continue; }
  const atk = current.units.find((unit) => unit.side === 'attacker' && !unit.isDestroyed && unit.troopCount > 0);
  const def = current.units.find((unit) => unit.side === 'defender' && !unit.isDestroyed && unit.troopCount > 0);
  if (!atk || !def) throw new Error('缺少存活攻守单位');
  await clickHex(atk.position.q, atk.position.r);
  current = await state();
  const selected = current.units.find((unit) => unit.id === atk.id);
  const target = current.units.find((unit) => unit.id === def.id);
  if (!selected || !target) throw new Error('选中单位状态丢失');
  if (distance(selected.position, target.position) > 1) {
    const keys = await evaluate(`const r=await fetch('/api/game/battle/move-range/${encodeURIComponent('${atk.id}')}'); if(!r.ok) throw Error(await r.text()); return (await r.json()).keys;`);
    const next = keys.map((key) => { const [q, r] = key.split(',').map(Number); return { q, r, d: distance({q,r}, target.position) }; }).sort((a,b)=>a.d-b.d)[0];
    if (next) await clickHex(next.q, next.r);
    else {
      // 防止动画竞态让客户端 moveRange 尚未刷新：仍经同一权威移动 API，随后继续用真实 UI 结束行动。
      const fallback = { q: selected.position.q + (target.position.q > selected.position.q ? 1 : -1), r: selected.position.r };
      const moved = await evaluate(`const r=await fetch('/api/game/battle/move',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify({unitId: atk.id, q: fallback.q, r: fallback.r})})}); if(!r.ok) throw Error(await r.text()); return await r.json();`);
      if (moved.units.find((unit) => unit.id === atk.id)?.position.q !== fallback.q) throw new Error('移动回退未生效');
    }
  }
  await click('btn-finish-player');
  current = await waitFor((value) => value.phase !== 'enemy' || value.duel != null, '敌军回合');
  if (current.duel) duel = current;
}
if (!duel?.duel) throw new Error('16 个敌军回合内未触发主动单挑（共享概率链可能正常落空）');
await waitFor((value) => value.duel?.phase === 'dueling', '单挑面板');
if (!(await evaluate(`return Boolean(document.querySelector('[data-testid="duel-stance-summary"]'));`))) throw new Error('单挑面板未呈现倾向摘要');
await click('btn-duel-skip');
const resolved = await waitFor((value) => value.duel?.phase === 'resolved', '单挑结算');
if (!(await evaluate(`return Boolean(document.querySelector('[data-testid="btn-duel-skip"]')) === false;`))) throw new Error('单挑跳过后控件仍可用');
if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`);
console.log(JSON.stringify({ duel: true, resolved: resolved.duel.result?.outcome ?? null, consoleErrors: 0 }));
ws.close();
