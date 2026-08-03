// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** S16：真实 Chrome 验收 XDG 存档槽位 UI。需 dev + Chrome CDP。 */
const port = process.env.CDP_PORT ?? '9222';
const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const target = targets.find((item) => item.type === 'page');
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
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const click = async (testid) => {
  const point = await evaluate(`const el=document.querySelector('[data-testid="${testid}"]'); if(!el) throw Error('未找到 ${testid}'); const r=el.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};`);
  await command('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await command('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await wait(350);
};
await evaluate(`location.href='http://localhost:5173/';`);
await wait(500);
await evaluate(`const r=await fetch('/api/game/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenarioId:1,playerFactionId:1})}); if(!r.ok) throw Error(await r.text()); location.reload();`);
await wait(900);
await click('btn-save-slots');
if (!(await evaluate(`return Boolean(document.querySelector('[data-testid="save-slots-panel"]'))`))) throw new Error('槽位面板未打开');
await evaluate(`window.confirm=()=>true; const input=document.querySelector('[data-testid="save-slot-name"]'); const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; setter.call(input,'ui-check'); input.dispatchEvent(new Event('input',{bubbles:true}));`);
await click('btn-save-slot');
await wait(500);
if (!(await evaluate(`return Boolean(document.querySelector('[data-testid="btn-load-slot-ui-check"]'))`))) throw new Error('保存后槽位列表未刷新');
await click('btn-load-slot-ui-check');
const state = await evaluate(`const r=await fetch('/api/game/state'); if(!r.ok) throw Error(await r.text()); return await r.json();`);
if (state?.currentYear !== 190 || state?.currentMonth !== 1) throw new Error('读取槽位后游戏状态不正确');
if (errors.length) throw new Error(`console errors: ${errors.join(' | ')}`);
console.log(JSON.stringify({ panel: true, save: true, load: true, restored: '190-01', consoleErrors: 0 }));
ws.close();
