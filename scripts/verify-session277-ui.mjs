// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 277/334：六角 A* 路径、同回合撤销与跨回合封闭浏览器验收。需 dev + CDP。 */
const cdpPort = process.env.CDP_PORT ?? '9242';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('未找到 Chrome page target');
const ws = new WebSocket(page.webSocketDebuggerUrl); const pending = new Map(); const errors = []; let id = 0;
ws.onmessage = (event) => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((a) => a.value ?? a.description).join(' ')); pending.get(msg.id)?.(msg); };
await new Promise((resolve) => { ws.onopen = resolve; });
const command = (method, params = {}) => new Promise((resolve) => { const next = ++id; pending.set(next, resolve); ws.send(JSON.stringify({ id: next, method, params })); });
async function evaluate(source) { const out = await command('Runtime.evaluate', { expression: `(async()=>{${source}})()`, awaitPromise: true, returnByValue: true }); if (out.result?.exceptionDetails) throw new Error(out.result.exceptionDetails.exception?.description ?? out.result.exceptionDetails.text); return out.result.result.value; }
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173/' });
await new Promise((resolve) => setTimeout(resolve, 1000));
await evaluate(`
  await fetch('/api/game/create', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scenarioId:1,playerFactionId:1}) });
  const started = await fetch('/api/game/battle/start', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({cityId:19}) });
  if (!started.ok) throw new Error(await started.text()); location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1800)); errors.length = 0;
const result = await evaluate(`
  const pause=(ms=200)=>new Promise(r=>setTimeout(r,ms));
  const canvas=document.querySelector('canvas'); if(!canvas) throw new Error('无战斗画布');
  const rect=canvas.getBoundingClientRect(), size=28, point=(q,r)=>({x:rect.left+50+size*(Math.sqrt(3)*q+Math.sqrt(3)/2*r),y:rect.top+50+size*1.5*r});
  const fire=(type,p)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:p.x,clientY:p.y,pointerId:1}));
  const click=(p)=>['pointerdown','mousedown','pointerup','mouseup','click'].forEach(t=>fire(t,p));
  let battle=await (await fetch('/api/game/battle')).json(); const unit=battle.units.find(u=>u.side==='attacker'); const origin={...unit.position}; click(point(origin.q,origin.r)); await pause();
  const range=await (await fetch('/api/game/battle/move-range/'+unit.id)).json(); if(!range.keys.length) throw new Error('移动范围为空');
  const [q,r]=range.keys[0].split(',').map(Number); const target=point(q,r); fire('pointermove',target); fire('mousemove',target); await pause(350);
  const summary=document.querySelector('[data-testid="move-path-summary"]')?.textContent; if(!summary?.includes('剩余')) throw new Error('悬停路径摘要缺失');
  click(target); await pause(1800); battle=await (await fetch('/api/game/battle')).json(); const moved=battle.units.find(u=>u.id===unit.id);
  if(moved.position.q!==q||moved.position.r!==r) throw new Error('动画后权威落子失败：目标'+q+','+r+' 实际'+moved.position.q+','+moved.position.r);
  const undo=document.querySelector('[data-testid="btn-battle-undo"]'); if(!undo||undo.disabled) throw new Error('撤销按钮不可用'); undo.click(); await pause(350);
  battle=await (await fetch('/api/game/battle')).json(); const restored=battle.units.find(u=>u.id===unit.id); if(restored.position.q!==origin.q||restored.position.r!==origin.r) throw new Error('撤销未恢复位置');

  // 再移动一次并结束行动：敌军结算完成后，旧移动不得在新回合重新变得可撤销。
  click(point(origin.q,origin.r)); await pause(250);
  const boundaryRange=await (await fetch('/api/game/battle/move-range/'+unit.id)).json(); if(!boundaryRange.keys.length) throw new Error('交权前第二次移动范围为空');
  const boundaryKey=boundaryRange.keys.includes(q+','+r)?q+','+r:boundaryRange.keys[0]; const [boundaryQ,boundaryR]=boundaryKey.split(',').map(Number);
  click(point(boundaryQ,boundaryR)); await pause(1800); battle=await (await fetch('/api/game/battle')).json();
  const boundaryMoved=battle.units.find(u=>u.id===unit.id); if(boundaryMoved.position.q!==boundaryQ||boundaryMoved.position.r!==boundaryR) throw new Error('交权前移动未落子');
  if(!document.querySelector('[data-testid="btn-battle-undo"]')) throw new Error('交权前撤销按钮未出现');
  const boundaryTurn=battle.turn; const finish=document.querySelector('[data-testid="btn-finish-player"]'); if(!finish) throw new Error('结束行动按钮缺失'); finish.click();
  const deadline=Date.now()+5000;
  do { await pause(150); battle=await (await fetch('/api/game/battle')).json(); } while(Date.now()<deadline && !(battle.phase==='player'&&battle.turn===boundaryTurn+1));
  if(battle.phase!=='player'||battle.turn!==boundaryTurn+1) throw new Error('未进入下一玩家回合：'+battle.phase+'/'+battle.turn);
  await pause(250); if(document.querySelector('[data-testid="btn-battle-undo"]')) throw new Error('新回合误显示旧移动撤销按钮');
  const beforeExpired={battle:JSON.stringify(battle),unit:battle.units.find(u=>u.id===unit.id)};
  const expiredResponse=await fetch('/api/game/battle/undo',{method:'POST'}); const expiredBody=await expiredResponse.json();
  if(expiredResponse.status!==400||expiredBody.error!=='UNDO_TURN_LOCKED') throw new Error('跨回合撤销未返回 UNDO_TURN_LOCKED：'+expiredResponse.status+'/'+expiredBody.error);
  const afterExpired=await (await fetch('/api/game/battle')).json(); if(JSON.stringify(afterExpired)!==beforeExpired.battle) throw new Error('跨回合撤销拒绝后状态发生变化');

  // 新回合产生的新移动仍可正常撤销，证明按钮不是被永久禁用。
  const freshOrigin={...afterExpired.units.find(u=>u.id===unit.id).position}; click(point(freshOrigin.q,freshOrigin.r)); await pause(250);
  const freshRange=await (await fetch('/api/game/battle/move-range/'+unit.id)).json(); if(!freshRange.keys.length) throw new Error('新回合移动范围为空');
  const [freshQ,freshR]=freshRange.keys[0].split(',').map(Number); click(point(freshQ,freshR)); await pause(1800);
  const freshUndo=document.querySelector('[data-testid="btn-battle-undo"]'); if(!freshUndo||freshUndo.disabled) throw new Error('新回合新移动后撤销按钮未恢复'); freshUndo.click(); await pause(350);
  const freshRestored=await (await fetch('/api/game/battle')).json(); const freshUnit=freshRestored.units.find(u=>u.id===unit.id);
  if(freshUnit.position.q!==freshOrigin.q||freshUnit.position.r!==freshOrigin.r) throw new Error('新回合撤销未恢复本回合起点');
  return {viewport:[innerWidth,innerHeight],pathSummary:summary,movedTo:[q,r],sameTurnRestored:[restored.position.q,restored.position.r],expiredError:expiredBody.error,nextTurn:battle.turn,freshMoveTo:[freshQ,freshR],freshRestored:[freshUnit.position.q,freshUnit.position.r],history:freshRestored.actionHistory?.length??0};
`);
ws.close(); if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`); console.log(JSON.stringify({ ...result, consoleErrors: 0 }, null, 2));
