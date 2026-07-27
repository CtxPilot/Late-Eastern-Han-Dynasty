// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P6 旧人事入口浏览器基线。
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --window-size=1440,900 \
 *     --remote-debugging-port=9234 http://127.0.0.1:5173
 *
 * Optional:
 *   CDP_PORT=9234 node scripts/verify-cmd-p6-headless.mjs
 */
const cdpPort = process.env.CDP_PORT ?? '9234';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P6 Headless：未找到 Chrome page target');

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
await new Promise((resolve) => {
  ws.onopen = resolve;
});

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

await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 2, playerFactionId: 4 }),
  });
  if (!response.ok) throw new Error('创建190董卓局失败：' + await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1400));

const result = await evaluate(`
  const pause = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const exactButton = (text) => [...document.querySelectorAll('button')]
    .find((button) => button.innerText.trim() === text);
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
  const state = async () => {
    const response = await fetch('/api/game/state');
    if (!response.ok) throw new Error('读取权威状态失败：' + await response.text());
    return response.json();
  };
  const snapshot = (game) => JSON.stringify({
    factions: game.factions,
    officers: game.officers,
    cities: game.cities,
    actionLog: game.actionLog,
    rng: game.rng,
  });
  const cancelAndAssert = async (before, label) => {
    const cancel = byTestId('command-confirm-cancel');
    if (!cancel) throw new Error(label + '取消按钮缺失');
    cancel.click();
    await pause();
    const after = await state();
    if (snapshot(after) !== snapshot(before)) throw new Error(label + '取消后权威状态变化');
  };
  const submit = async () => {
    const button = byTestId('command-confirm-submit');
    if (!button || button.disabled) throw new Error('终审提交按钮缺失或禁用');
    button.click();
    await pause(650);
  };
  const choose = (select, value) => {
    select.value = String(value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const openPersonnel = async () => {
    const trigger = [...document.querySelectorAll('button')]
      .find((button) => button.innerText.trim().startsWith('人事'));
    if (!trigger) throw new Error('旧人事手风琴入口缺失');
    if (trigger.getAttribute('aria-expanded') !== 'true') trigger.click();
    await pause();
    if (!byTestId('personnel-panel') || !byTestId('appoint-panel') || !byTestId('beauty-panel')) {
      throw new Error('旧人事四段内容未完整渲染');
    }
  };

  await openPersonnel();
  const roster = byTestId('officer-roster-panel');
  const beauty = byTestId('beauty-panel');
  const scrollParent = [...roster.parentElement.parentElement.parentElement.parentElement.parentElement.querySelectorAll('*')]
    .find((node) => node.scrollHeight > node.clientHeight + 100 && getComputedStyle(node).overflowY !== 'visible');
  if (!scrollParent) throw new Error('未找到旧人事纵向滚动容器');
  roster.scrollIntoView({ block: 'start' });
  await pause();
  const topVisible = roster.getBoundingClientRect().top >= 0 && roster.getBoundingClientRect().top < 900;
  beauty.scrollIntoView({ block: 'end' });
  await pause();
  const bottomRect = beauty.getBoundingClientRect();
  const bottomVisible = bottomRect.bottom > 0 && bottomRect.bottom <= 900;
  if (!topVisible || !bottomVisible || scrollParent.scrollTop <= 0) {
    throw new Error('1440×900 顶部/底部滚动基线失败');
  }

  // 搜索：取消 + 确认。
  let before = await state();
  byTestId('btn-personnel-search').click();
  await pause();
  if (!byTestId('command-confirm-dialog')?.innerText.includes('确认搜索人才')) throw new Error('搜索终审标题错误');
  await cancelAndAssert(before, '搜索');
  byTestId('btn-personnel-search').click();
  await pause();
  const searchCityName = byTestId('personnel-panel').innerText.match(/城：([^\\s]+)/)?.[1];
  await submit();
  let after = await state();
  const searchCityBefore = Object.values(before.cities).find((city) => city.name === searchCityName);
  if (!searchCityBefore || after.cities[searchCityBefore.id].gold !== searchCityBefore.gold - 80) throw new Error('搜索未权威扣金80');
  if (after.actionLog[0]?.type !== 'personnel_search') throw new Error('搜索权威日志缺失');

  // 当前两个 0-A 剧本初始均无 FREE 武将；明确断言不可提交空状态。
  const recruitButton = document.querySelector('[data-testid^="btn-recruit-"]');
  if (recruitButton || !byTestId('personnel-panel').innerText.includes('暂无在野武将')) {
    throw new Error('登用初始空状态与当前0-A基线不符');
  }
  const playerFactionId = after.playerFactionId;

  // 先开霸府，使四条任命轨道都可覆盖。
  if ((after.factions[playerFactionId].politicalStage ?? 'vassal') === 'vassal') {
    byTestId('command-domain-court').click();
    await pause();
    byTestId('command-court-establish-hegemony').click();
    await pause();
    await submit();
  }
  await openPersonnel();

  const appointed = {};
  const tracks = ['military', 'local', 'civil', 'hegemony'];
  for (const track of tracks) {
    const trackButton = byTestId('appoint-track-' + track);
    if (!trackButton) throw new Error('任命轨道缺失：' + track);
    trackButton.click();
    await pause();
    const officerSelect = byTestId('appoint-officer');
    const positionSelect = byTestId('appoint-position');
    const appointButton = byTestId('btn-appoint');
    let found = false;
    for (const officerOption of [...officerSelect.options].filter((option) => option.value)) {
      choose(officerSelect, officerOption.value);
      await pause(30);
      for (const positionOption of [...positionSelect.options].filter((option) => option.value !== 'none')) {
        choose(positionSelect, positionOption.value);
        await pause(30);
        if (!appointButton.disabled) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (!found) throw new Error('找不到可提交的任命组合：' + track);
    const officerId = Number(officerSelect.value);
    const position = positionSelect.value;
    before = await state();
    appointButton.click();
    await pause();
    if (!byTestId('command-confirm-dialog')?.innerText.includes('确认任命')) throw new Error(track + '任命终审标题错误');
    await cancelAndAssert(before, track + '任命');
    byTestId('btn-appoint').click();
    await pause();
    await submit();
    after = await state();
    const field = track === 'civil' ? 'civilPosition' : track === 'local' ? 'localPosition' : track === 'military' ? 'militaryPosition' : 'hegemonyPosition';
    if (after.officers[officerId]?.[field] !== position || after.actionLog[0]?.type !== 'appoint') {
      throw new Error(track + '任命权威状态未生效');
    }
    appointed[track] = { officerId, position };
  }

  // 美女库存赏赐：确保库存后做取消 + 确认。
  let current = await state();
  if ((current.factions[playerFactionId].beautyStock ?? 0) < 1) {
    const city = Object.values(current.cities).find((entry) => entry.ruler === playerFactionId && entry.gold >= 140 && (entry.beautySeekLeft ?? 0) >= 1);
    if (!city) throw new Error('无法建立美女库存基线');
    await api('/civil/seek-beauty', { cityId: city.id });
    // 再通过既有搜索 action 拉回完整权威快照，避免测试直接接触 Zustand 内部。
    const syncSearch = byTestId('btn-personnel-search');
    if (!syncSearch || syncSearch.disabled) throw new Error('无法用既有人事 action 同步寻访后的权威快照');
    syncSearch.click();
    await pause();
    await submit();
    current = await state();
    if ((current.factions[playerFactionId].beautyStock ?? 0) < 1) throw new Error('内政寻访未权威增加美女库存');
    await openPersonnel();
  }
  const beautySelect = byTestId('beauty-stock-officer');
  const beautyOption = [...beautySelect.options].find((option) => option.value);
  if (!beautyOption) throw new Error('美女赏赐候选缺失');
  choose(beautySelect, beautyOption.value);
  before = await state();
  byTestId('btn-reward-beauty-stock').click();
  await pause();
  if (!byTestId('command-confirm-dialog')?.innerText.includes('确认赏赐美人')) throw new Error('美女赏赐终审标题错误');
  await cancelAndAssert(before, '美女赏赐');
  byTestId('btn-reward-beauty-stock').click();
  await pause();
  await submit();
  after = await state();
  const beautyOfficerId = Number(beautyOption.value);
  if ((after.factions[playerFactionId].beautyStock ?? 0) !== (before.factions[playerFactionId].beautyStock ?? 0) - 1) throw new Error('美女赏赐未扣库存1');
  if (after.officers[beautyOfficerId].loyalty !== Math.min(100, before.officers[beautyOfficerId].loyalty + 12)) throw new Error('美女赏赐忠诚结算错误');
  if (after.actionLog[0]?.type !== 'beauty_reward') throw new Error('美女赏赐权威日志缺失');

  // 错误展示：任命终审打开后，权威 API 先完成同一任命，再提交同一草稿。
  const stale = appointed.military;
  const officerSelect = byTestId('appoint-officer');
  byTestId('appoint-track-military').click();
  await pause();
  choose(officerSelect, stale.officerId);
  await pause();
  choose(byTestId('appoint-position'), stale.position);
  await pause();
  // 先解职，打开“任命”终审，再由 API 抢先完成，制造服务端重复任命错误。
  await api('/personnel/appoint', { officerId: stale.officerId, track: 'military', position: 'none' });
  byTestId('appoint-track-military').click();
  await pause();
  choose(byTestId('appoint-officer'), stale.officerId);
  await pause();
  choose(byTestId('appoint-position'), stale.position);
  await pause();
  byTestId('btn-appoint').click();
  await pause();
  await api('/personnel/appoint', { officerId: stale.officerId, track: 'military', position: stale.position });
  await submit();
  const appointError = byTestId('command-confirm-dialog')?.innerText ?? '';
  if (!appointError.includes('已是该武官职')) throw new Error('任命服务端错误未展示在终审');
  byTestId('command-confirm-cancel').click();
  await pause();

  return {
    viewport: '1440x900',
    rosterTopVisible: topVisible,
    beautyBottomVisible: bottomVisible,
    scrollTopAfterBottom: scrollParent.scrollTop,
    search: '取消不变；确认扣金80并写 personnel_search',
    recruit: '当前0-A初始无FREE武将，明确断言“暂无在野武将”且提交按钮为0；提交结算由 verify-personnel-rng 覆盖',
    appointments: appointed,
    beautyReward: '取消不变；确认库存-1、忠诚+12并写 beauty_reward',
    errors: {
      appoint: '服务端重复任命错误已在终审展示',
      recruit: '当前0-A初始空状态已展示；权威失败分支由 verify-personnel-rng 覆盖',
      disabledDrafts: '未选武将/目标或资源不足时按钮禁用',
    },
  };
`);

if (consoleErrors.length) {
  throw new Error(`CMD-P6 Headless 控制台错误：${consoleErrors.join(' | ')}`);
}
console.log(JSON.stringify({ ...result, consoleErrors }, null, 2));
ws.close();
