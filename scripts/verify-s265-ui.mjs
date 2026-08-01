// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S12 数值消费 UI 冒烟（Session 265）：
 *  - 武将简册六维区块正常渲染（六维行齐全）
 *  - Lv1 武将不显示功绩属性加成「+N」（meritAttrBonusFor 返回 0）
 *  - 功绩等级区块（Lv/称号/带兵+）无回归
 *  - console error = 0
 * 前置：pnpm dev；Chrome 以 1440×900、CDP_PORT（默认 9239）启动并打开前端。
 * 运行：node scripts/verify-s265-ui.mjs
 */
const cdpPort = process.env.CDP_PORT ?? '9239';
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
await command('Page.enable');
await command('Page.navigate', { url: 'http://127.0.0.1:5173' });
await pause(1500);

await evaluate(`
  const created = await fetch('/api/game/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!created.ok) throw new Error(await created.text());
  location.reload();
`);
await pause(1600);

let assertions = 0;
function check(label, condition, detail = '') {
  if (!condition) throw new Error(`FAIL: ${label}${detail ? ' — ' + detail : ''}`);
  assertions += 1;
  console.log(`  ✓ ${label}`);
}

const result = await evaluate(`
  const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const all = (id) => document.querySelectorAll('[data-testid="' + id + '"]');
  for (let i = 0; i < 80 && !by('command-domain-personnel'); i += 1) await pause(50);
  if (!by('command-domain-personnel')) return { ok: false, reason: '命令坞未就绪' };

  by('command-domain-personnel').click(); await pause();
  if (!by('command-personnel-roster')) return { ok: false, reason: '人事名册未打开' };
  const rosterEntries = document.querySelectorAll('[data-testid^="command-personnel-officer-"]');
  if (!rosterEntries.length) return { ok: false, reason: '名册无人物' };
  let detail = null;
  for (const entry of rosterEntries) {
    entry.click(); await pause();
    const candidate = by('officer-detail');
    if (!candidate) continue;
    const text = candidate.innerText;
    if (/总兵力/.test(text)) { candidate.querySelector('[aria-label="关闭"]').click(); await pause(); continue; }
    detail = candidate;
    break;
  }
  if (!detail) return { ok: false, reason: '名册无可用非君主武将' };
  const detailText = detail.innerText;
  const sixDim = [...detail.querySelectorAll('h3')].some((h) => h.textContent === '六维');
  const dimLabels = ['统帅', '武力', '智力', '政治', '魅力', '体力']
    .filter((label) => detailText.includes(label)).length;
  const meritLine = /功绩 Lv\\d+/.test(detailText);
  const meritTitle = /Lv\\d+ · [\\u4e00-\\u9fa5]{2,4}/.test(detailText);
  const noAttrBonus = !/\\+\\d+/.test(detailText); // Lv1 武将不应出现绿色 +N 加成
  const noZeroTroop = !/带兵\\+0/.test(detailText); // Lv1 白身不渲染「带兵+0」
  const hasStatBars = [...detail.querySelectorAll('div')].filter((el) => /h-1\\.5/.test(el.className)).length >= 6;
  detail.querySelector('[aria-label="关闭"]').click(); await pause();
  return {
    ok: true,
    sixDim, dimLabels, meritLine, meritTitle, noAttrBonus, noZeroTroop, hasStatBars,
    excerpt: detailText.slice(0, 120),
  };
`);

if (!result.ok) throw new Error(`UI 冒烟失败: ${result.reason}`);
check('六维区块存在', result.sixDim, result.excerpt);
check('六维行齐全（统帅/武力/智力/政治/魅力/体力）', result.dimLabels === 6, `实际 ${result.dimLabels}`);
check('功绩 Lv 展示', result.meritLine);
check('功绩称号展示', result.meritTitle);
check('Lv1 无属性加成 +N', result.noAttrBonus, 'Lv1 不应出现功绩属性 +N');
check('Lv1 白身不渲染带兵+0', result.noZeroTroop);
check('六条属性进度条', result.hasStatBars);

await pause(300);
const realErrors = consoleErrors.filter((e) => !/favicon/i.test(e));
check('console error = 0', realErrors.length === 0, realErrors.join(' | '));

console.log(`\nS12 数值消费 UI 冒烟：${assertions} 项断言通过，console error=0`);
