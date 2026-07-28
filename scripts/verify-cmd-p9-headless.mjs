// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

const cdpPort = process.env.CDP_PORT ?? '9236';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P9 Headless：未找到 Chrome page target');
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
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error(await response.text());
  const hegemony = await fetch('/api/game/hegemony/establish', { method: 'POST' });
  if (!hegemony.ok) throw new Error('开府夹具失败：' + await hegemony.text());
  location.reload();
`);
await pause(1400);

const result = await evaluate(`
  const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const state = async () => (await fetch('/api/game/state')).json();
  let court = null;
  for (let i = 0; i < 60 && !court; i += 1) { court = by('command-domain-court'); if (!court) await pause(50); }
  if (!court) throw new Error('命令坞未就绪');
  court.scrollIntoView({ block: 'end' }); court.click(); await pause();
  const jump = by('command-court-open-personnel');
  if (!jump) throw new Error('朝廷→人事正式入口缺失');
  jump.click(); await pause();
  if (!by('command-personnel-appointment')) throw new Error('未直接定位任官分面');
  if (!by('appoint-track-hegemony') || !by('appoint-track-hegemony').className.includes('border-amber-600')) {
    throw new Error('跨域导航未预选朝职轨道');
  }
  if (document.querySelectorAll('[data-testid="btn-appoint"]').length !== 1) {
    throw new Error('当前展开上下文只能存在一份任命提交逻辑');
  }

  by('appoint-track-military').click(); await pause();
  const officerSelect = by('command-personnel-appointment').querySelector('[data-testid="appoint-officer"]');
  const candidate = [...officerSelect.options].find((option) => option.value);
  officerSelect.value = candidate.value;
  officerSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  const before = await state();
  const review = by('command-personnel-appointment').querySelector('[data-testid="btn-appoint"]');
  if (review.disabled) throw new Error('合格任官草稿不可送审');
  review.click(); await pause();
  if (!by('command-confirm-dialog')?.innerText.includes('确认任命')) throw new Error('任官未进入统一终审');
  by('command-confirm-cancel').click(); await pause();
  const afterCancel = await state();
  if (JSON.stringify(before.officers) !== JSON.stringify(afterCancel.officers)) throw new Error('任官取消改变权威状态');
  review.click(); await pause(); by('command-confirm-submit').click(); await pause(500);
  const afterAppoint = await state();
  if (afterAppoint.actionLog[0]?.type !== 'appoint') throw new Error('任官未复用权威 appoint 引擎');

  by('command-personnel-facet-reward').click(); await pause();
  if (!by('command-personnel-reward')) throw new Error('赏罚分面未打开');
  if (!by('command-personnel-reward').innerText.includes('没收、俘虏录用尚在设计中')) throw new Error('未实装赏罚边界缺失');
  if ([...by('command-personnel-reward').querySelectorAll('button')].some((button) => /没收|俘虏录用/.test(button.innerText))) {
    throw new Error('出现未实装赏罚假按钮');
  }
  return {
    crossDrawerIntent: '人事·任官·朝职',
    appointmentCancelPreservedAuthority: true,
    appointmentCommittedThrough: 'appoint',
    rewardFacet: true,
    unimplementedActionsHaveNoButtons: true,
    consoleErrors: ${JSON.stringify(consoleErrors)}.length,
  };
`);
result.consoleErrors = consoleErrors.length;
if (consoleErrors.length) throw new Error('浏览器 console error：' + consoleErrors.join(' | '));
console.log(JSON.stringify({ viewport: '1440x900', ...result }, null, 2));
ws.close();
