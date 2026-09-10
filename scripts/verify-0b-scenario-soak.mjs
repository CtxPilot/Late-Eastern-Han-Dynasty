// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// 0-B 剧本十年 soak UI 预检（Session 442）。
// 目的：0-B 历史剧本（scenarios 3~9）此前从未浏览器点击验收，本脚本以无头浏览器
//   对「选剧本→选非推荐势力→进入→世界屏→连续 120 回合」做长程冒烟，收集
//   stall（回合未推进）/阻断（非对话框阻塞）/console error/未捕获异常。
// 前置：pnpm --filter @leh/shared build && pnpm dev（vite:5173）
//   + headless Chrome：google-chrome --headless=new --window-size=1440,900 \
//     --remote-debugging-port=9242 --user-data-dir=/tmp/leh-chrome-9242 about:blank
// 组合默认 `剧本:势力`，可在环境变量覆盖：SOAK_COMBOS=7:4,3:2,6:4,8:1,9:3、SOAK_TURNS、CDP_PORT、BASE_URL。
// 退出码：任一组合出现 stall/阻断/console error/异常 → 1。
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

const cdpPort = process.env.CDP_PORT ?? '9242';
const base = process.env.BASE_URL ?? 'http://127.0.0.1:5173/?offline=1';
const shotsDir = process.env.SOAK_SHOTS_DIR ?? '/tmp/leh-shots';
const TURNS = Number(process.env.SOAK_TURNS ?? 120);
const combos = (process.env.SOAK_COMBOS ?? '7:4,3:2,6:4,8:1,9:3').split(',').map((s) => {
  const [sid, fid] = s.split(':');
  return { sid: Number(sid), fid: Number(fid) };
});
mkdirSync(shotsDir, { recursive: true });

const scenariosRaw = JSON.parse(readFileSync(new URL('../server/src/data/scenarios.json', import.meta.url), 'utf8'));
const scenarios = Array.isArray(scenariosRaw) ? scenariosRaw : scenariosRaw.scenarios;

const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('未找到 Chrome page target（CDP ' + cdpPort + '）');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
let consoleErrors = [];
let exceptions = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Page.javascriptDialogOpening') { void cmd('Page.handleJavaScriptDialog', { accept: true }); return; }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; exceptions.push(d.exception?.description ?? d.text ?? 'exc'); }
  pending.get(m.id)?.(m);
};
await new Promise((r) => { ws.onopen = r; });
const cmd = (method, params = {}) => new Promise((res) => { const id = ++nextId; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const r = await cmd('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  const exc = r.result?.exceptionDetails;
  if (exc) throw new Error(exc.exception?.description ?? exc.text);
  return r.result.result.value;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, timeoutMs = 25000) { const s = Date.now(); while (Date.now() - s < timeoutMs) { if (await evaluate(expr)) return true; await pause(200); } return false; }
async function shot(name) { const r = await cmd('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${shotsDir}/${name}.png`, Buffer.from(r.result.data, 'base64')); }
const dateText = () => evaluate(`return document.querySelector('[data-testid="top-bar"]')?.textContent?.match(/(-?\\d+)年\\s*\\S*?(\\d+)月/)?.[0] ?? '';`);
const btnText = () => evaluate(`return document.querySelector('[data-testid="btn-end-turn"]')?.textContent?.trim() ?? '';`);
async function clearBlockers() {
  let acted = false;
  for (let i = 0; i < 10; i++) {
    const state = await evaluate(`return { ev: !!document.querySelector('[data-testid="event-dialog-overlay"]'), fam: !!document.querySelector('[data-testid="family-treatment-dialog-overlay"]') };`);
    if (!state.ev && !state.fam) break;
    if (state.ev) await evaluate(`return (document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true`);
    if (state.fam) await evaluate(`return (document.querySelector('[data-testid="family-treatment-neutral"]')||document.querySelector('[data-testid="family-treatment-kindness"]'))?.click() ?? true`);
    acted = true; await pause(350);
  }
  return acted;
}

await cmd('Runtime.enable'); await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

async function runCombo({ sid, fid }) {
  const S = scenarios.find((s) => s.id === sid);
  const fac = S.factionSetups.find((f) => f.id === fid);
  const label = `s${sid}-f${fid}`;
  consoleErrors = []; exceptions = [];
  await cmd('Page.navigate', { url: base });
  await pause(2500);
  if (!(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`))) {
    return { label, scenario: S.name, faction: fac?.name, ok: false, error: '未进入剧本选择屏' };
  }
  await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>[...x.querySelectorAll('h2')].some(h=>h.textContent===${JSON.stringify(S.name)})); b?.click(); return !!b; })();`);
  await pause(600);
  const facClicked = await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>[...x.querySelectorAll('strong')].some(t=>t.textContent===${JSON.stringify(fac.name)})); b?.click(); return !!b; })();`);
  if (!facClicked) return { label, scenario: S.name, faction: fac.name, ok: false, error: '未找到势力按钮' };
  await pause(400);
  await evaluate(`return (() => { const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('进入剧本')); b?.click(); return !!b; })();`);
  if (!(await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`, 25000))) {
    await shot(`${label}-bootfail`);
    return { label, scenario: S.name, faction: fac.name, ok: false, error: '世界屏未载入' };
  }
  await clearBlockers();
  const startDate = await dateText();

  const turns = []; const stalls = []; let blocked = null;
  for (let i = 1; i <= TURNS; i++) {
    await clearBlockers();
    let bt = await btnText();
    if (bt && bt !== '结束回合') {
      await clearBlockers();
      bt = await btnText();
      if (bt !== '结束回合') { blocked = { turn: i, date: await dateText(), button: bt }; await shot(`${label}-blocked-${i}`); break; }
    }
    const before = await dateText();
    const t0 = Date.now();
    await evaluate(`return (() => { const b=document.querySelector('[data-testid="btn-end-turn"]'); if(!b||b.disabled) return false; b.click(); return true; })();`);
    let ok = false; const deadline = Date.now() + 60000;
    while (Date.now() < deadline) {
      await clearBlockers();
      const st = await evaluate(`return (() => { const b=document.querySelector('[data-testid="btn-end-turn"]'); return { enabled: b && !b.disabled, overlay: !!document.querySelector('[data-testid="turn-progress-overlay"]') }; })();`);
      if (st.enabled && !st.overlay && (await dateText()) !== before) { ok = true; break; }
      await pause(200);
    }
    const dt = Date.now() - t0; await pause(150);
    const after = await dateText();
    turns.push({ turn: i, before, after, ms: dt, advanced: before !== after });
    if (!ok) { stalls.push({ turn: i, before, after, ms: dt }); await shot(`${label}-stall-${i}`); }
  }
  await shot(`${label}-final`);
  const advanced = turns.filter((t) => t.advanced);
  const msList = advanced.map((t) => t.ms).sort((a, b) => a - b);
  const median = msList.length ? msList[Math.floor(msList.length / 2)] : 0;
  const maxTurn = turns.reduce((a, b) => (b.ms > a.ms ? b : a), turns[0] ?? { ms: 0 });
  const realErrors = consoleErrors.filter((m) => !m.includes('favicon') && !m.includes('/api/'));
  const endDate = await dateText();
  const ok = advanced.length === TURNS && stalls.length === 0 && !blocked && realErrors.length === 0 && exceptions.length === 0;
  const rec = { label, scenario: S.name, faction: fac.name, startDate, endDate, turns, stalls, blocked, median, maxTurn, realErrors, exceptions, ok };
  writeFileSync(`${shotsDir}/soak-${label}.json`, JSON.stringify(rec, null, 2));
  console.log(`${ok ? '✓' : '✗'} [${label}] ${S.name} / ${fac.name} — ${advanced.length}/${TURNS}（${startDate}→${endDate}）；中位 ${median}ms/最大 ${maxTurn?.ms}ms；err ${realErrors.length}；异常 ${exceptions.length}${blocked ? `；阻断@${blocked.turn}「${blocked.button}」` : ''}${stalls.length ? `；stall ${stalls.length}` : ''}`);
  if (realErrors.length) console.log('   errors:', realErrors.slice(0, 3));
  if (exceptions.length) console.log('   exc:', exceptions.slice(0, 3));
  return rec;
}

const results = [];
for (const combo of combos) results.push(await runCombo(combo));
const bad = results.filter((r) => !r.ok);
console.log(`\n0-B 剧本十年 soak：${results.length - bad.length}/${results.length} 通过（每组合 ${TURNS} 回合）；截图/JSON → ${shotsDir}`);
process.exit(bad.length === 0 ? 0 : 1);
