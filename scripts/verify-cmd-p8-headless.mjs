// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P8 招贤写流程迁移，1440×900 浏览器验收。
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --window-size=1440,900 \
 *     --remote-debugging-port=9236 http://127.0.0.1:5174
 */
const cdpPort = process.env.CDP_PORT ?? '9236';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P8 Headless：未找到 Chrome page target');

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

async function createGame() {
  await evaluate(`
    const response = await fetch('/api/game/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenarioId: 2, playerFactionId: 1 }),
    });
    if (!response.ok) throw new Error('创建190曹操局失败：' + await response.text());
    history.replaceState(null, '', '/');
    location.reload();
  `);
  await pause(1400);
}

await createGame();
const result = await evaluate(`
  const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const state = async () => {
    const response = await fetch('/api/game/state');
    if (!response.ok) throw new Error('读取权威状态失败：' + await response.text());
    return response.json();
  };
  const api = async (path, body = {}) => {
    const response = await fetch('/api/game' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(path + '：' + (payload.error ?? response.status));
    return payload;
  };
  const snapshot = (game) => JSON.stringify({
    cities: game.cities, officers: game.officers, actionLog: game.actionLog, rng: game.rng,
  });
  const openRecruitment = async () => {
    let domain = null;
    for (let attempt = 0; attempt < 60 && !domain; attempt += 1) {
      domain = byTestId('command-domain-personnel');
      if (!domain) await pause(50);
    }
    if (!domain) throw new Error('命令坞未就绪：' + location.href + ' / ' + document.body.innerText.slice(0, 300));
    domain.scrollIntoView({ block: 'end' });
    await pause();
    if (domain.getAttribute('aria-expanded') !== 'true') domain.click();
    await pause();
    byTestId('command-personnel-facet-recruitment').click();
    await pause();
    if (!byTestId('command-personnel-recruitment')) throw new Error('招贤分面未打开');
  };
  const legacyTrigger = [...document.querySelectorAll('button')]
    .find((button) => !button.dataset.testid && button.innerText.trim().startsWith('人事') && button.hasAttribute('aria-expanded'));
  if (!legacyTrigger) throw new Error('旧人事手风琴触发器缺失');
  if (legacyTrigger.getAttribute('aria-expanded') !== 'true') legacyTrigger.click();
  await pause();
  await openRecruitment();

  // 过渡期同源：旧/新搜索入口各一，二者仍调用同一 store/API；任官/赏罚未误迁。
  if (document.querySelectorAll('[data-testid="btn-personnel-search"]').length !== 1) throw new Error('旧搜索入口未保留为过渡对照');
  if (document.querySelectorAll('[data-testid="command-recruit-search"]').length !== 1) throw new Error('新搜索入口数量错误');
  if (byTestId('command-personnel-drawer').querySelector('[data-testid="btn-appoint"], [data-testid="btn-reward-beauty-stock"]')) {
    throw new Error('CMD-P8 意外迁入任官/赏罚');
  }

  // 初始真实数据无在野候选：明确空状态和禁用原因。
  if (!byTestId('command-recruit-disabled-reason')?.innerText.includes('暂无在野武将')) throw new Error('无在野候选禁用原因缺失');
  if (document.querySelector('[data-testid^="command-recruit-officer-"]')) throw new Error('无候选时出现登用按钮');

  // 搜索取消：权威不变，城市草稿/招贤分面保留。
  const citySelect = byTestId('command-recruit-search-city');
  const preferredCity = citySelect.value;
  const options = [...citySelect.options];
  const chosen = options.find((option) => option.value && Number(option.value) !== Number(citySelect.value)) ?? options.find((option) => option.value);
  if (!chosen) throw new Error('无搜索城市草稿候选');
  citySelect.value = chosen.value;
  citySelect.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  const draftCity = citySelect.value;
  let before = await state();
  byTestId('command-recruit-search').click();
  await pause();
  if (!byTestId('command-confirm-dialog')?.innerText.includes('确认搜索人才')) throw new Error('新搜索终审标题错误');
  byTestId('command-confirm-cancel').click();
  await pause();
  if (snapshot(await state()) !== snapshot(before)) throw new Error('搜索取消改变权威状态');
  if (byTestId('command-recruit-search-city').value !== draftCity || !byTestId('command-personnel-recruitment')) throw new Error('搜索取消未保留草稿/分面');

  // 搜索成功提交：权威扣金、写日志，成功后终审清除。
  byTestId('command-recruit-search').click();
  await pause();
  byTestId('command-confirm-submit').click();
  await pause(700);
  let after = await state();
  if (byTestId('command-confirm-dialog')) throw new Error('搜索成功后终审未清除');
  if (byTestId('command-recruit-search-city').value !== preferredCity) throw new Error('搜索成功后城市草稿未清除并回落默认城');
  if (after.cities[Number(draftCity)].gold !== before.cities[Number(draftCity)].gold - 80) throw new Error('新搜索未按同源API扣金80');
  if (after.actionLog[0]?.type !== 'personnel_search') throw new Error('新搜索权威日志缺失');

  return {
    legacySearchEntries: 1,
    newSearchEntries: 1,
    noCandidateGate: true,
    drainedCityId: Number(draftCity),
    cancelPreservedDraft: true,
    successClearedDraft: true,
    searchCommitted: '扣金80并写 personnel_search，成功清除终审',
  };
`);
console.log('CMD-P8 phase: search flow complete');
let drainState = await evaluate(`return await (await fetch('/api/game/state')).json();`);
while (drainState.cities[result.drainedCityId].gold >= 80) {
  drainState = await evaluate(`
    const response = await fetch('/api/game/personnel/search', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cityId: ${result.drainedCityId} }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
  `);
}
await evaluate(`location.reload();`);
await pause(1200);
const insufficientGoldGate = await evaluate(`
  const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  let domain = null;
  for (let attempt = 0; attempt < 60 && !domain; attempt += 1) {
    domain = byTestId('command-domain-personnel');
    if (!domain) await pause(50);
  }
  if (!domain) throw new Error('资源禁用局命令坞未就绪');
  domain.scrollIntoView({ block: 'end' });
  await pause();
  domain.click();
  await pause();
  byTestId('command-personnel-facet-recruitment').click();
  await pause();
  const select = byTestId('command-recruit-search-city');
  select.value = String(${result.drainedCityId});
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  if (!byTestId('command-recruit-search-disabled-reason')?.innerText.includes('金钱不足') || !byTestId('command-recruit-search').disabled) {
    throw new Error('资源不足禁用原因/按钮状态错误');
  }
  return true;
`);
result.insufficientGoldGate = insufficientGoldGate;
delete result.drainedCityId;
console.log('CMD-P8 phase: disabled gates complete');
await evaluate(`history.replaceState(null, '', '/?cmdP8RecruitmentFixture=no-executor'); location.reload();`);
await pause(1200);
result.noExecutorGate = await evaluate(`
  const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  let domain = null;
  for (let attempt = 0; attempt < 60 && !domain; attempt += 1) {
    domain = byTestId('command-domain-personnel');
    if (!domain) await pause(50);
  }
  if (!domain) throw new Error('无执行者夹具命令坞未就绪');
  domain.scrollIntoView({ block: 'end' });
  await pause();
  domain.click();
  await pause();
  byTestId('command-personnel-facet-recruitment').click();
  await pause();
  const reason = byTestId('command-recruit-search-disabled-reason')?.innerText ?? '';
  if (!reason.includes('无可用搜索武将') || !byTestId('command-recruit-search').disabled) {
    throw new Error('DEV-only 无执行者夹具未展示禁用原因：' + reason);
  }
  return true;
`);
console.log('CMD-P8 phase: no-executor fixture complete');

// 建立真实在野候选，验证登用取消、成功提交。
await createGame();
const releasedForSuccess = await evaluate(`
  const game = await (await fetch('/api/game/state')).json();
  const rulerId = game.factions[game.playerFactionId].rulerId;
  const released = Object.values(game.officers).find((officer) => officer.faction === game.playerFactionId && officer.id !== rulerId);
  if (!released) throw new Error('无可释放的登用测试人物');
  const response = await fetch('/api/game/personnel/release-officer', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officerId: released.id }),
  });
  if (!response.ok) throw new Error(await response.text());
  return released.id;
`);
await evaluate(`location.reload();`);
await pause(1200);
const recruit = await evaluate(`
  const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const getState = async () => (await fetch('/api/game/state')).json();
  const post = async (path, body) => {
    const response = await fetch('/api/game' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? path);
    return payload;
  };
  let game = await getState();
  const released = game.officers[${releasedForSuccess}];
  let domain = null;
  for (let attempt = 0; attempt < 60 && !domain; attempt += 1) {
    domain = byTestId('command-domain-personnel');
    if (!domain) await pause(50);
  }
  if (!domain) throw new Error('登用成功局命令坞未就绪');
  domain.scrollIntoView({ block: 'end' });
  await pause();
  domain.click();
  await pause();
  byTestId('command-personnel-facet-recruitment').click();
  await pause();
  const recruitButton = byTestId('command-recruit-officer-' + released.id);
  if (!recruitButton || recruitButton.disabled) throw new Error('真实在野候选未形成可提交登用');
  recruitButton.click();
  await pause();
  const title = byTestId('command-confirm-dialog')?.innerText;
  if (!title?.includes('确认登用') || !title.includes(released.name) || !title.includes('成功率')) throw new Error('登用终审信息不完整');
  const beforeCancel = await getState();
  byTestId('command-confirm-cancel').click();
  await pause();
  if (JSON.stringify(await getState()) !== JSON.stringify(beforeCancel)) throw new Error('登用取消改变权威状态');
  if (!byTestId('command-recruit-officer-' + released.id)) throw new Error('登用取消未保留候选草稿上下文');
  byTestId('command-recruit-officer-' + released.id).click();
  await pause();
  byTestId('command-confirm-submit').click();
  await pause(700);
  game = await getState();
  if (byTestId('command-confirm-dialog')) throw new Error('登用请求成功后终审未清除');
  if (game.actionLog[0]?.type !== 'personnel_recruit') throw new Error('登用未写同源权威日志');
  if (game.officers[released.id]?.faction !== game.playerFactionId || game.officers[released.id]?.status !== 'active') {
    throw new Error('固定种子登用未真实成功加入玩家势力');
  }
  return { officerId: released.id, cancelPreservedCandidate: true, requestAccepted: true, result: game.actionLog[0].message };
`);
console.log('CMD-P8 phase: recruit success flow complete');

// 过期候选失败：外部权威状态改变后，旧草稿提交由服务端拒绝，终审保留并展示错误。
await createGame();
const releasedForFailure = await evaluate(`
  const game = await (await fetch('/api/game/state')).json();
  const rulerId = game.factions[game.playerFactionId].rulerId;
  const released = Object.values(game.officers).find((officer) => officer.faction === game.playerFactionId && officer.id !== rulerId);
  if (!released) throw new Error('无可释放的过期候选测试人物');
  const response = await fetch('/api/game/personnel/release-officer', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ officerId: released.id }),
  });
  if (!response.ok) throw new Error(await response.text());
  return released.id;
`);
await evaluate(`location.reload();`);
await pause(1200);
const failure = await evaluate(`
  const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const post = async (path, body) => {
    const response = await fetch('/api/game' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? path);
    return payload;
  };
  const game = await (await fetch('/api/game/state')).json();
  const released = game.officers[${releasedForFailure}];
  let domain = null;
  for (let attempt = 0; attempt < 60 && !domain; attempt += 1) {
    domain = byTestId('command-domain-personnel');
    if (!domain) await pause(50);
  }
  if (!domain) throw new Error('登用失败局命令坞未就绪');
  domain.scrollIntoView({ block: 'end' });
  await pause();
  domain.click();
  await pause();
  byTestId('command-personnel-facet-recruitment').click();
  await pause();
  byTestId('command-recruit-officer-' + released.id).click();
  await pause();
  await post('/personnel/join-faction', { officerId: released.id, factionId: game.playerFactionId });
  byTestId('command-confirm-submit').click();
  await pause(700);
  const error = byTestId('command-confirm-error')?.innerText ?? '';
  if (!byTestId('command-confirm-dialog') || !error.includes('已有所属势力')) throw new Error('过期候选失败未保留终审/展示服务端错误：' + error);
  return { staleDraftRetained: true, error };
`);
console.log('CMD-P8 phase: stale failure flow complete');

if (consoleErrors.length > 0) throw new Error(`浏览器控制台错误：${consoleErrors.join(' | ')}`);
ws.close();
console.log(JSON.stringify({ viewport: '1440x900', search: result, recruit, failure, consoleErrors: 0 }, null, 2));
