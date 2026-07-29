// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P12 外交只读势力摘要浏览器验收。
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --window-size=1440,900 \
 *     --remote-debugging-port=9238 http://127.0.0.1:5173
 */
const cdpPort = process.env.CDP_PORT ?? '9238';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P12 Headless：未找到 Chrome page target');

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

await command('Runtime.enable');
await command('Emulation.setDeviceMetricsOverride', {
  width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
});
await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error('创建英雄集结曹操局失败：' + await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1400));

const result = await evaluate(`
  const pause = (ms = 220) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const state = async () => (await fetch('/api/game/state')).json();

  byTestId('command-domain-diplomacy').click();
  await pause();
  const drawer = byTestId('command-diplomacy-drawer');
  const select = byTestId('command-diplomacy-target');
  if (!drawer || !select) throw new Error('外交只读抽屉或势力选择缺失');
  if (select.options.length !== 3) throw new Error('英雄集结应显示3个存活目标');
  if (!drawer.innerText.includes('选择势力查看当前权威关系摘要')) throw new Error('势力摘要边界文案缺失');
  const enabledActions = [...drawer.querySelectorAll('button')].filter((button) =>
    !button.disabled && /进贡|献美|结盟|点化/.test(button.innerText));
  const forbiddenActions = enabledActions.filter((button) => /结盟|点化/.test(button.innerText));
  if (forbiddenActions.length !== 0) throw new Error('外交抽屉出现未排期的结盟/点化写按钮');

  const summaries = [];
  for (const option of [...select.options]) {
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await pause(80);
    const summary = byTestId('command-diplomacy-summary-' + option.value);
    if (!summary || !summary.innerText.includes('友好') || !summary.innerText.includes('君主') ||
        !summary.innerText.includes('都城') || !summary.innerText.includes('领土')) {
      throw new Error('势力摘要字段不完整：' + option.value);
    }
    summaries.push({ factionId: Number(option.value), text: summary.innerText });
  }

  // 旧入口继续是唯一写路径；确认进贡后，新抽屉重新打开必须读取同一权威友好值。
  const targetId = Number(select.options[0].value);
  const before = await state();
  const beforeLink = before.diplomacy.find((entry) =>
    (entry.factionA === before.playerFactionId && entry.factionB === targetId) ||
    (entry.factionB === before.playerFactionId && entry.factionA === targetId));
  byTestId('command-drawer-close').click();
  await pause();
  const oldTrigger = [...byTestId('left-panel').querySelectorAll('button')]
    .find((button) => button.innerText.trim().split('\\n')[0] === '外交');
  if (!oldTrigger) throw new Error('旧外交唯一写入口缺失');
  oldTrigger.click();
  await pause();
  const oldCard = byTestId('dip-faction-' + targetId);
  const tribute = [...oldCard.querySelectorAll('button')].find((button) => button.innerText.trim() === '进贡');
  if (!tribute) throw new Error('旧进贡按钮缺失');
  tribute.click();
  await pause();
  byTestId('command-confirm-submit').click();
  await pause(650);

  byTestId('command-domain-diplomacy').click();
  await pause();
  const reopenedSelect = byTestId('command-diplomacy-target');
  reopenedSelect.value = String(targetId);
  reopenedSelect.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();
  const after = await state();
  const afterLink = after.diplomacy.find((entry) =>
    (entry.factionA === after.playerFactionId && entry.factionB === targetId) ||
    (entry.factionB === after.playerFactionId && entry.factionA === targetId));
  const expectedFavor = Math.min(100, (beforeLink?.favorability ?? 0) + 15);
  const refreshed = byTestId('command-diplomacy-summary-' + targetId);
  if (afterLink?.favorability !== expectedFavor || !refreshed?.innerText.includes('友好\\n' + expectedFavor)) {
    throw new Error('旧入口进贡后新摘要未同源刷新');
  }

  return {
    viewport: '1440x900',
    targets: select.options.length,
    summariesChecked: summaries.length,
    laterNegotiationActions: enabledActions.length,
    authorityRefresh: '旧入口进贡后新摘要友好即时+' + (expectedFavor - (beforeLink?.favorability ?? 0)),
    oldDiplomacyEntry: '保留作迁移期同源对照（P13 已接进贡/献美）',
  };
`);

if (consoleErrors.length) throw new Error(`CMD-P12 Headless 控制台错误：${consoleErrors.join(' | ')}`);
console.log(JSON.stringify({ ...result, consoleErrors }, null, 2));
ws.close();
