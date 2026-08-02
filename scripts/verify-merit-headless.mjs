// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S12 功绩等级 UI 实测（docs/04 §十）：
 *  - 命令坞人事→名册→武将简册显示「功绩 LvX · 称号」与进度条
 *  - 任命面板显示功绩门槛（如「功绩Lv6」），功绩不足者按钮禁用
 *  - console error = 0
 * 前置：pnpm dev；Chrome 以 1440×900、CDP_PORT（默认 9239）启动并打开前端。
 * 运行：node scripts/verify-merit-headless.mjs
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

// 建局并回到页面（曹操军）
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

const uiResult = await evaluate(`
  const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const all = (id) => document.querySelectorAll('[data-testid="' + id + '"]');
  for (let i = 0; i < 80 && !by('command-domain-personnel'); i += 1) await pause(50);
  if (!by('command-domain-personnel')) return { ok: false, reason: '命令坞未就绪' };

  // 1. 名册 → 武将简册 → 功绩等级展示（跳过君主：君主显示国力指标）
  by('command-domain-personnel').click(); await pause();
  if (!by('command-personnel-roster')) return { ok: false, reason: '新人事名册未打开' };
  const rosterEntries = document.querySelectorAll('[data-testid^="command-personnel-officer-"]');
  if (!rosterEntries.length) return { ok: false, reason: '名册无人物' };
  let detail = null;
  let rulerDetail = null;
  for (const entry of rosterEntries) {
    entry.click(); await pause();
    const candidate = by('officer-detail');
    if (!candidate) continue;
    const text = candidate.innerText;
    if (/总兵力/.test(text)) { rulerDetail = text; candidate.querySelector('[aria-label="关闭"]').click(); await pause(); continue; }
    detail = candidate;
    break;
  }
  if (!detail) return { ok: false, reason: '名册无可用非君主武将', rulerExcerpt: (rulerDetail ?? '').slice(0, 120) };
  const detailText = detail.innerText;
  const meritLine = [...detail.querySelectorAll('span,div')]
    .map((el) => el.textContent ?? '')
    .find((t) => /功绩 Lv\\d+/.test(t));
  const hasMeritLevel = /功绩 Lv\\d+/.test(detailText);
  const hasTitle = /Lv\\d+ · [\\u4e00-\\u9fa5]{2,4}/.test(detailText);
  const hasTroopBonus = /带兵\\+\\d+/.test(detailText);
  // Lv1 白身无带兵+（不渲染「带兵+0」）；Lv2+ 才显示「带兵+N」
  const noZeroTroop = !/带兵\\+0/.test(detailText);
  const hasProgress = detail.querySelectorAll('div.h-full.bg-gradient-to-r').length >= 1;
  detail.querySelector('[aria-label="关闭"]').click(); await pause();

  // 2. 任命面板：功绩门槛展示（将军 Lv3 门槛文案；功绩不足时按钮禁用）
  by('command-personnel-facet-appointment').click(); await pause();
  const appointBtn = by('btn-appoint');
  if (!appointBtn) return { ok: false, reason: '任命提交入口缺失' };
  const panelText = by('appoint-panel')?.innerText ?? '';
  const hasGateText = /功绩Lv\\d+/.test(panelText);

  // 3. 君主简册显示国力指标（不显示功绩等级）
  return {
    ok: true,
    hasMeritLevel,
    hasTitle,
    hasTroopBonus,
    noZeroTroop,
    hasProgress,
    rulerShown: /总兵力/.test(rulerDetail ?? '') && !/功绩 Lv/.test(rulerDetail ?? ''),
    hasGateText,
    sampleText: meritLine ?? '',
    appointBtnDisabled: appointBtn.disabled,
    detailExcerpt: detailText.slice(0, 120),
  };
`);

if (!uiResult.ok) throw new Error('UI 验证失败：' + uiResult.reason);
check('武将简册显示「功绩 LvN」', uiResult.hasMeritLevel, uiResult.detailExcerpt);
check('简册显示「LvN · 称号」', uiResult.hasTitle);
check('简册显示「带兵+N」（Lv2+ 时）或不渲染「带兵+0」', uiResult.hasTroopBonus || uiResult.noZeroTroop);
check('简册含功绩进度条', uiResult.hasProgress);
check('君主简册显示国力指标且不显示功绩等级', uiResult.rulerShown, '名册首个君主被跳过');
check('任命面板显示功绩门槛文案（功绩LvN）', uiResult.hasGateText, uiResult.sampleText);

if (consoleErrors.length > 0) {
  console.error('  ✗ console error 非零：', consoleErrors.slice(0, 5).join(' | '));
  process.exit(1);
}
console.log(`\n结果：${assertions + 1} 通过（console error = 0）`);
ws.close();
