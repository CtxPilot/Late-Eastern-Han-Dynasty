// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** FM-P4 战报解释 UI：浏览器实际进入六角战场并检查解释面板。需 dev + CDP。 */
const port = process.env.CDP_PORT ?? '9222';
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = targets.find((item) => item.type === 'page' && item.url.startsWith('http://127.0.0.1:5173')) ?? targets.find((item) => item.type === 'page');
if (!target) throw new Error('未找到 Chrome page target');
const ws = new WebSocket(target.webSocketDebuggerUrl); const pending = new Map(); const errors = []; let id = 0;
ws.onmessage = (event) => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((arg) => arg.value ?? arg.description).join(' ')); pending.get(msg.id)?.(msg); };
await new Promise((resolve) => { ws.onopen = resolve; });
const command = (method, params = {}) => new Promise((resolve) => { const next = ++id; pending.set(next, resolve); ws.send(JSON.stringify({ id: next, method, params })); });
const evaluate = async (source) => { const out = await command('Runtime.evaluate', { expression: `(async()=>{${source}})()`, awaitPromise: true, returnByValue: true }); if (out.result?.exceptionDetails) throw new Error(out.result.exceptionDetails.exception?.description ?? out.result.exceptionDetails.text); return out.result.result.value; };
await command('Runtime.enable'); await command('Page.navigate', { url: 'http://127.0.0.1:5173/' }); await new Promise((resolve) => setTimeout(resolve, 800));
await evaluate(`const created=await fetch('/api/game/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenarioId:1,playerFactionId:1})}); if(!created.ok) throw Error(await created.text()); const started=await fetch('/api/game/battle/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cityId:19})}); if(!started.ok) throw Error(await started.text()); location.reload();`);
for (let i = 0; i < 60; i += 1) {
  if (await evaluate(`return Boolean(document.querySelector('[data-testid="battle-report"]'));`)) break;
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (i === 59) throw new Error(JSON.stringify(await evaluate(`return {url:location.href, ready:document.readyState, html:document.documentElement?.outerHTML?.slice(0, 500) ?? ''};`)));
}
const clickButton = async (testid) => {
  const point = await evaluate(`const el=document.querySelector('[data-testid="${testid}"]'); if(!el) throw Error('未找到 ${testid}'); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 250));
};
const clickHex = async (q, r) => {
  const point = await evaluate(`const c=document.querySelector('canvas'); if(!c) throw Error('未找到六角战场 canvas'); const rect=c.getBoundingClientRect(); const size=28; return {x:rect.left+50+size*(Math.sqrt(3)*${q}+(Math.sqrt(3)/2)*${r}),y:rect.top+50+size*(1.5*${r})};`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 350));
};
const battleState = () => evaluate(`const r=await fetch('/api/game/battle'); if(!r.ok) throw Error(await r.text()); return await r.json();`);
const distance = (a, b) => (Math.abs(a.q-b.q)+Math.abs(a.q+a.r-b.q-b.r)+Math.abs(a.r-b.r))/2;

await clickButton('btn-select-attacker');
await new Promise((resolve) => setTimeout(resolve, 900));
await clickButton('btn-battle-formation');
await new Promise((resolve) => setTimeout(resolve, 300));
const formationButtons = await evaluate(`return Array.from(document.querySelectorAll('[data-testid^="battle-formation-"]')).filter((el)=>!el.disabled).map((el)=>el.dataset.testid);`);
if (!formationButtons.length) throw Error('当前主将没有可用变阵按钮');
let afterFormation = await battleState();
for (const formationButton of formationButtons) {
  await clickButton(formationButton);
  await new Promise((resolve) => setTimeout(resolve, 900));
  afterFormation = await battleState();
  if (afterFormation.log.some((entry) => entry.explanation?.kind === 'formation')) break;
  if (formationButton !== formationButtons.at(-1)) { await clickButton('btn-battle-formation'); await new Promise((resolve) => setTimeout(resolve, 250)); }
}
if (!afterFormation.log.some((entry) => entry.explanation?.kind === 'formation')) throw Error(JSON.stringify({ phase: afterFormation.phase, points: afterFormation.tacticalPoints, log: afterFormation.log, error: await evaluate(`return document.querySelector('[data-testid="battle-report-error"]')?.textContent ?? null;`), buttons: await evaluate(`return Array.from(document.querySelectorAll('button')).map((el)=>({id:el.dataset.testid,text:el.textContent,disabled:el.disabled})).filter((x)=>x.id||x.text.includes('变阵'));`) }));
await clickButton('btn-finish-player');

let attackSeen = false;
for (let attempt = 0; attempt < 24 && !attackSeen; attempt += 1) {
  let current = await battleState();
  if (current.phase === 'over') throw Error('变阵→攻击链在攻击前提前结束');
  if (current.phase === 'enemy') { await new Promise((resolve) => setTimeout(resolve, 800)); continue; }
  const atk = current.units.find((unit) => unit.side === 'attacker' && !unit.isDestroyed && unit.troopCount > 0);
  const def = current.units.find((unit) => unit.side === 'defender' && !unit.isDestroyed && unit.troopCount > 0);
  if (!atk || !def) throw Error('攻击链缺少存活单位');
  await clickHex(atk.position.q, atk.position.r);
  current = await battleState();
  const liveAtk = current.units.find((unit) => unit.id === atk.id);
  const liveDef = current.units.find((unit) => unit.id === def.id);
  if (!liveAtk || !liveDef) throw Error('攻击链单位状态丢失');
  if (distance(liveAtk.position, liveDef.position) <= 1) {
    await clickHex(liveDef.position.q, liveDef.position.r);
    current = await battleState();
    attackSeen = current.log.some((entry) => entry.explanation?.kind === 'attack');
    continue;
  }
  const range = await evaluate(`const r=await fetch('/api/game/battle/move-range/${atk.id}'); if(!r.ok) throw Error(await r.text()); return (await r.json()).keys;`);
  const next = range.map((key) => { const [q, r] = key.split(',').map(Number); return { q, r, d: Math.abs(q-liveDef.position.q)+Math.abs(r-liveDef.position.r) }; }).sort((a,b)=>a.d-b.d)[0];
  if (!next) throw Error('攻击链找不到可移动六角');
  await clickHex(next.q, next.r);
  await clickButton('btn-finish-player');
}
if (!attackSeen) throw Error('变阵后未完成一次六角攻击');
const result = await evaluate(`const panel=document.querySelector('[data-testid="battle-report"]'); if(!panel) throw Error('战报解释面板未呈现'); const text=panel.innerText; return { panel:text.includes('战报·阵型解释'), formation:text.includes('变阵：'), attack:text.includes('阵型贡献：'), viewport:[innerWidth,innerHeight] };`);
if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`);
console.log(JSON.stringify({ ...result, consoleErrors: 0 }));
ws.close();
