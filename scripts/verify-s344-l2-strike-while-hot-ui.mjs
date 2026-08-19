// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 344：L2 趁火打劫 UI 走通（计略抽屉 → 即时结算）。 */
const cdpPort = process.env.CDP_PORT ?? '9241';
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
  const result = await command('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  if (result.result?.exceptionDetails) throw new Error(result.result.exceptionDetails.exception?.description ?? result.result.exceptionDetails.text);
  return result.result.result.value;
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  ✓ ${msg}`); } else { fail++; console.error(`  ✗ ${msg}`); }
}

await command('Runtime.enable');
await command('Page.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await command('Page.navigate', { url: 'http://127.0.0.1:5173' });
await pause(1200);

// 场景2（关东义兵）：势力4 同时与 1/2/3 交战
const createOk = await evaluate(`
  const response = await fetch('/api/game/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenarioId: 2, playerFactionId: 1 }) });
  if (!response.ok) throw new Error(await response.text());
  location.reload();
  return true;
`);
assert(createOk, '创建场景2（关东义兵）');
await pause(1500);

// 打开计略域
await evaluate(`document.querySelector('[data-testid="command-domain-strategy"]')?.click(); return true;`);
const drawerOpen = await evaluate(`
  for (let i = 0; i < 20; i++) {
    if (document.querySelector('[data-testid="command-strategy-drawer"]')) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
`);
assert(drawerOpen, '计略抽屉打开');

// 态势页：趁火打劫候选列出势力4（交战3家）
const faction4Candidate = await evaluate(`
  const text = document.querySelector('[data-testid="command-strategy-situation"]')?.textContent ?? '';
  return text.includes('董卓') && text.includes('交战3家');
`);
assert(faction4Candidate, '态势页候选含 董卓（交战3家）');

// 切到"施计"页并选趁火打劫
await evaluate(`document.querySelector('[data-testid="command-strategy-facet-launch"]')?.click(); return true;`);
await pause(400);
const typeSelect = await evaluate(`
  const sel = document.querySelector('[data-testid="command-strategy-plot-type"]');
  if (!sel) return null;
  const opt = [...sel.options].find((o) => o.value === 'strikeWhileHot');
  return opt ? opt.value : null;
`);
assert(typeSelect === 'strikeWhileHot', '下拉含趁火打劫（strikeWhileHot）');
await evaluate(`
  const sel = document.querySelector('[data-testid="command-strategy-plot-type"]');
  sel.value = 'strikeWhileHot';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
`);
await pause(300);

// 目标势力下拉出现且候选仅剩多线交战者
const targetOptions = await evaluate(`
  const sel = document.querySelector('[data-testid="command-strategy-target-faction"]');
  return sel ? [...sel.options].map((o) => o.textContent) : null;
`);
assert(targetOptions?.some((t) => t.includes('董卓') && t.includes('交战3家')), '目标势力下拉含 董卓（交战3家）');

// 未选目标时：提交按钮应被禁用（launchReason 非空）
const submitDisabledBefore = await evaluate(`
  const btn = document.querySelector('[data-testid="command-strategy-launch-submit"]');
  const reason = document.querySelector('[data-testid="command-strategy-launch-reason"]')?.textContent ?? '';
  return { disabled: btn?.disabled ?? null, reason };
`);
assert(submitDisabledBefore.disabled === true, `未选目标时终审提交禁用（理由：${submitDisabledBefore.reason}）`);

// 选择势力4 后提交成功
const goldBefore = await evaluate(`
  const state = await (await fetch('/api/game/state')).json();
  return Object.values(state.cities).filter((c) => c.ruler === 1).reduce((s, c) => s + c.gold, 0);
`);
await evaluate(`
  const sel = document.querySelector('[data-testid="command-strategy-target-faction"]');
  sel.value = '4';
  sel.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
`);
await pause(300);
const submitOk = await evaluate(`
  const btn = document.querySelector('[data-testid="command-strategy-launch-submit"]');
  btn.click();
  return true;
`);
await pause(300);
const dialogInfo = await evaluate(`
  const dialog = document.querySelector('[data-testid="command-confirm-dialog"]');
  if (!dialog) return null;
  const submit = document.querySelector('[data-testid="command-confirm-submit"]');
  return { open: true, disabled: submit?.disabled ?? null, text: dialog.textContent ?? '' };
`);
assert(dialogInfo?.open === true, '终审确认框出现');
assert(dialogInfo?.text.includes('趁火打劫'), '确认框标题含趁火打劫');
assert(dialogInfo?.disabled === false, '选好目标后终审提交可用');
await evaluate(`document.querySelector('[data-testid="command-confirm-submit"]')?.click(); return true;`);
await pause(800);

// 验证服务端：RESOLVED + 扣金 150 + 日志
const stateCheck = await evaluate(`
  const state = await (await fetch('/api/game/state')).json();
  const plot = (state.plots ?? []).find((p) => p.type === 'strikeWhileHot');
  const gold = Object.values(state.cities).filter((c) => c.ruler === 1).reduce((s, c) => s + c.gold, 0);
  return {
    hasPlot: !!plot,
    stage: plot?.stage,
    layer: plot?.layer,
    targetFactionId: plot?.targetFactionId,
    success: plot?.result?.success,
    detected: plot?.result?.detected,
    goldDelta: ${goldBefore} - gold,
    logged: (state.actionLog ?? []).some((e) => e.message?.includes('趁火打劫')),
  };
`);
assert(stateCheck.hasPlot, '计谋记录存在');
assert(stateCheck.stage === 'resolved', '即时 RESOLVED');
assert(stateCheck.layer === 'strategic', 'layer=strategic');
assert(stateCheck.targetFactionId === 4, 'targetFactionId=4（董卓）');
assert(stateCheck.success === true && stateCheck.detected === false, 'success 且无识破');
assert(stateCheck.goldDelta === 150, `扣金 150（实际 ${stateCheck.goldDelta}）`);
assert(stateCheck.logged, 'actionLog 含趁火打劫结算');

// 进行中页应显示已结算记录
await evaluate(`document.querySelector('[data-testid="command-strategy-facet-ongoing"]')?.click(); return true;`);
const ongoingText = await evaluate(`
  for (let i = 0; i < 20; i++) {
    const el = document.querySelector('[data-testid="command-strategy-ongoing"]');
    if (el && el.textContent.length > 0) return el.textContent;
    await new Promise((r) => setTimeout(r, 100));
  }
  return document.querySelector('[data-testid="command-strategy-ongoing"]')?.textContent ?? '';
`);
assert(ongoingText.includes('趁火打劫'), '进行中页展示趁火打劫记录');

// 反向用例：不可对自己施展（通过 API 直测）
const selfReject = await evaluate(`
  const response = await fetch('/api/game/plot/launch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'strikeWhileHot', targetFactionId: 1 }) });
  const text = await response.text();
  return { status: response.status, text };
`);
assert(selfReject.status >= 400 && selfReject.text.includes('自己'), '对自己施展被拒');

const errors = consoleErrors.filter((e) => !e.includes('favicon'));
assert(errors.length === 0, `console 无错误（${errors.length ? errors.join(' | ') : ''}）`);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);