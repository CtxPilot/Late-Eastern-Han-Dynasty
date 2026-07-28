// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * HC-P1 browser acceptance.
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --remote-debugging-port=9237 http://127.0.0.1:5173
 */
const cdpPort = process.env.CDP_PORT ?? '9237';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('HC-P1 Headless：未找到 Chrome page target');

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

const result = await evaluate(`
  const json = async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(url + ': ' + await response.text());
    return response.json();
  };
  const post = (url, body) => json(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body == null ? undefined : JSON.stringify(body),
  });
  await post('/api/game/create', { scenarioId: 1, playerFactionId: 1 });
  await post('/api/game/hegemony/establish');
  for (let month = 0; month < 12; month += 1) {
    for (;;) {
      const response = await fetch('/api/game/end-turn', { method: 'POST' });
      if (response.ok) break;
      const game = await json('/api/game/state');
      const pending = game.pendingEvents?.[0];
      if (!pending) throw new Error('推进月份失败：' + await response.text());
      await post('/api/game/event/choose', { eventId: pending.eventId, choiceIndex: 0 });
    }
  }
  const requirements = await json('/api/game/hegemony/king-requirements');
  if (!requirements.allPassed) throw new Error('12月后称王门槛未满足');
  location.reload();
`);
await pause(1600);

const browserResult = await evaluate(`
  const pause = (ms = 160) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const json = async (url, init) => {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(url + ': ' + await response.text());
    return response.json();
  };
  const post = (url, body) => json(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  for (let i = 0; i < 60 && !by('command-domain-court'); i += 1) await pause(50);
  if ([...document.querySelectorAll('button')].some((button) => button.innerText.trim() === '君主')) {
    throw new Error('旧君主入口仍存在');
  }
  by('command-domain-court').click(); await pause();
  const progress = by('command-court-stage-progress')?.innerText ?? '';
  if (!progress.includes('12/12') || !progress.includes('17/8')) throw new Error('称王进度未反映12月与规模门槛');
  const select = by('command-court-kingdom-name');
  const option = [...select.options].find((item) => item.value && !item.disabled);
  select.value = option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  const review = by('command-court-proclaim-king-review');
  if (review.disabled) throw new Error('满足门槛后称王仍禁用');
  review.click(); await pause();
  const confirmText = by('command-confirm-dialog')?.innerText ?? '';
  if (!confirmText.includes('不可撤销') || !confirmText.includes('皇权 80')) throw new Error('称王重大终审语义缺失');
  by('command-confirm-submit').click(); await pause(600);
  let game = await json('/api/game/state');
  if (game.factions[1].politicalStage !== 'king') throw new Error('称王提交未生效');

  await post('/api/game/personnel/appoint', {
    officerId: 1, track: 'hegemony', position: 'kingdomChancellor',
  });
  await post('/api/game/court/grant-nobility', {
    officerId: 8, targetRank: 'guanneiMarquis',
  });
  const favorBefore = game.diplomacy.find((link) =>
    (link.factionA === 1 && link.factionB === 2) || (link.factionA === 2 && link.factionB === 1)
  )?.favorability ?? 0;
  game = await post('/api/game/diplomacy/tribute', { targetFactionId: 2 });
  const favorAfter = game.diplomacy.find((link) =>
    (link.factionA === 1 && link.factionB === 2) || (link.factionA === 2 && link.factionB === 1)
  )?.favorability ?? 0;
  if (game.officers[1].hegemonyPosition !== 'kingdomChancellor') throw new Error('王国相任命未生效');
  if (game.officers[8].nobilityRank !== 'guanneiMarquis') throw new Error('王命封爵未生效');
  if (favorAfter - favorBefore !== 18) throw new Error('king 外交 ×1.2 未生效');
  location.reload();
  return { kingdomName: game.factions[1].kingdomName, favorGain: favorAfter - favorBefore };
`);
await pause(1400);

const finalUi = await evaluate(`
  const pause = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  for (let i = 0; i < 60 && !by('command-domain-court'); i += 1) await pause();
  by('command-domain-court').click(); await pause(200);
  const text = by('court-command-content')?.innerText ?? '';
  return {
    kingStageVisible: text.includes('王国') && text.includes('王国相'),
    grantedRankVisible: text.includes('关内侯'),
    legacyMonarchButtons: [...document.querySelectorAll('button')].filter((button) => button.innerText.trim() === '君主').length,
  };
`);
if (!finalUi.kingStageVisible || !finalUi.grantedRankVisible || finalUi.legacyMonarchButtons !== 0) {
  throw new Error('称王后朝廷 UI 刷新或旧入口断言失败');
}
if (consoleErrors.length) throw new Error('浏览器 console error：' + consoleErrors.join(' | '));
console.log(JSON.stringify({
  viewport: '1440x900',
  twelveMonthFlow: true,
  proclaimKingThroughMajorReview: true,
  kingdomAppointment: true,
  nobilityGrant: true,
  ...browserResult,
  ...finalUi,
  consoleErrors: 0,
}, null, 2));
ws.close();
