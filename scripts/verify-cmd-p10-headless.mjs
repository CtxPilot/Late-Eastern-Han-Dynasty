// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P10 人事域原子切换验收。
 * 前置：pnpm dev；Chrome 以 1440×900、指定 CDP_PORT 启动并打开前端。
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P10 Headless：未找到 Chrome page target');

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
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await evaluate(`
  const created = await fetch('/api/game/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!created.ok) throw new Error(await created.text());
  const hegemony = await fetch('/api/game/hegemony/establish', { method: 'POST' });
  if (!hegemony.ok) throw new Error('开府夹具失败：' + await hegemony.text());
  location.reload();
`);
await pause(1400);

const result = await evaluate(`
  const pause = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const all = (id) => document.querySelectorAll('[data-testid="' + id + '"]');
  const state = async () => (await fetch('/api/game/state')).json();
  const choose = (select, value) => {
    select.value = String(value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  for (let i = 0; i < 60 && !by('command-domain-personnel'); i += 1) await pause(50);
  if (!by('command-domain-personnel')) throw new Error('命令坞未就绪');

  const leftPanel = by('left-panel');
  const oldPersonnelTriggers = [...leftPanel.querySelectorAll('button')]
    .filter((button) => button.innerText.trim().startsWith('人事'));
  const legacyTestIds = ['personnel-panel', 'officer-roster-panel', 'appoint-panel', 'beauty-panel'];
  const legacyDomCount = oldPersonnelTriggers.length
    + legacyTestIds.reduce((sum, id) => sum + all(id).length, 0);
  if (legacyDomCount !== 0) throw new Error('旧人事 DOM 未物理删除：' + legacyDomCount);

  by('command-domain-personnel').click(); await pause();
  if (!by('command-personnel-roster')) throw new Error('新人事名册未打开');
  const rosterEntries = document.querySelectorAll('[data-testid^="command-personnel-officer-"]');
  if (!rosterEntries.length) throw new Error('新人事名册无人物');
  rosterEntries[0].click(); await pause();
  if (!by('officer-detail')) throw new Error('名册→人物简册失败');
  by('officer-detail').querySelector('[aria-label="关闭"]').click(); await pause();

  by('command-personnel-facet-recruitment').click(); await pause();
  if (all('command-recruit-search').length !== 1) throw new Error('搜索提交入口不是唯一一份');
  const beforeSearch = await state();
  by('command-recruit-search').click(); await pause();
  if (!by('command-confirm-dialog')?.innerText.includes('确认搜索人才')) throw new Error('搜索未进入终审');
  by('command-confirm-cancel').click(); await pause();
  const afterCancel = await state();
  if (JSON.stringify(beforeSearch.actionLog) !== JSON.stringify(afterCancel.actionLog)) {
    throw new Error('搜索取消改变权威状态');
  }
  by('command-recruit-search').click(); await pause();
  by('command-confirm-submit').click(); await pause(550);
  const afterSearch = await state();
  if (afterSearch.actionLog[0]?.type !== 'personnel_search') throw new Error('新人事搜索未提交权威 action');
  const recruitEmpty = by('command-recruit-free-count').innerText.trim() === '0 人'
    && document.querySelectorAll('[data-testid^="command-recruit-officer-"]').length === 0;
  if (!recruitEmpty) throw new Error('招贤空状态不符合0-A基线');

  by('command-personnel-facet-appointment').click(); await pause();
  if (all('btn-appoint').length !== 1) throw new Error('任官提交入口不是唯一一份');
  by('appoint-track-military').click(); await pause();
  const officerSelect = by('appoint-officer');
  const positionSelect = by('appoint-position');
  let found = false;
  for (const officer of [...officerSelect.options].filter((option) => option.value)) {
    choose(officerSelect, officer.value); await pause(20);
    for (const position of [...positionSelect.options].filter((option) => option.value !== 'none')) {
      choose(positionSelect, position.value); await pause(20);
      if (!by('btn-appoint').disabled) { found = true; break; }
    }
    if (found) break;
  }
  if (!found) throw new Error('找不到可提交的武官任命组合');
  by('btn-appoint').click(); await pause();
  if (!by('command-confirm-dialog')?.innerText.includes('确认任命')) throw new Error('任官未进入终审');
  by('command-confirm-submit').click(); await pause(550);
  if ((await state()).actionLog[0]?.type !== 'appoint') throw new Error('新人事任官未提交权威 action');

  by('command-personnel-facet-reward').click(); await pause();
  if (all('btn-reward-beauty-stock').length !== 1) throw new Error('赏罚提交入口不是唯一一份');
  const rewardEntryCount = all('btn-reward-beauty-stock').length;
  if ([...by('command-personnel-reward').querySelectorAll('button')]
    .some((button) => /没收|俘虏录用/.test(button.innerText))) throw new Error('出现未实装假按钮');

  by('command-domain-court').click(); await pause();
  by('command-court-open-personnel').click(); await pause();
  if (!by('command-personnel-appointment')) throw new Error('朝廷→人事任官往返失败');
  if (!by('appoint-track-hegemony')?.className.includes('border-amber-600')) {
    throw new Error('朝廷导航未携带朝职轨道意图');
  }
  if (all('btn-appoint').length !== 1) throw new Error('跨域往返后任官逻辑发生复制');

  return {
    legacyPersonnelDom: legacyDomCount,
    rosterDetail: true,
    search: '取消不变；确认写 personnel_search',
    recruitEmpty,
    appointment: '确认写 appoint',
    rewardEntryCount,
    courtRoundTrip: '人事·任官·朝职',
  };
`);
if (consoleErrors.length) throw new Error(`CMD-P10 Headless 控制台错误：${consoleErrors.join(' | ')}`);
console.log(JSON.stringify({ viewport: '1440x900', ...result, consoleErrors: 0 }, null, 2));
ws.close();
