// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 375：离线覆盖扩充 II——读链与轻写链端到端验收（?offline=1，Chrome CDP 9242）。
 *
 * 前置：pnpm --filter @leh/client dev（vite:5173，无需后端）+ headless Chrome（CDP 9242）。
 *
 * 真实点击链：
 *  1. 势力总览抽屉（getFactionOverview：天命/人心/声望字段渲染）；
 *  2. 左栏总军师：任命（grandStrategistAppoint）→ 切换态势（grandStrategistSwitch）
 *     → 加成面板（grandStrategistStatus 经 store refresh）→ 解职（grandStrategistDismiss）；
 *  3. 人事名册 → 曹操详情 → 关系 tab（getOfficerRelations 渲染正史/演义关系行）；
 *  4. 技能 tab：getSkillTrees + getOfficerSkillState 渲染 → 升级节点（upgradeSkillNode，
 *     已用点数增加）→ 重置（resetSkillTree，已用归零）；
 *  5. 断言全程零 /api/ 在线回退（XHR 钩子）+ 无未处理拒绝 + 控制台无非网络错误。
 *
 * 边界：campaignNodes / upgradeTrait 无 UI 入口，handler 仅镜像审查+类型覆盖，不在本脚本断言。
 */
const cdpPort = process.env.CDP_PORT ?? '9242';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('未找到 Chrome page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pendingMap = new Map();
const consoleErrors = [];
let nextId = 0;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Page.javascriptDialogOpening') {
    void cmd('Page.handleJavaScriptDialog', { accept: true });
    return;
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  pendingMap.get(m.id)?.(m);
};
await new Promise((r) => { ws.onopen = r; });
const cmd = (method, params = {}) => new Promise((res) => { const id = ++nextId; pendingMap.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => {
  const result = await cmd('Runtime.evaluate', { expression: `(async()=>{${expression}})()`, awaitPromise: true, returnByValue: true });
  const exc = result.result?.exceptionDetails;
  if (exc) throw new Error(exc.exception?.description ?? exc.text);
  return result.result.result.value;
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(expr, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await evaluate(expr)) return true;
    await pause(250);
  }
  return false;
}
async function clickByText(selector, text, timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const ok = await evaluate(`return (() => {
      const btn = [...document.querySelectorAll('${selector}')].find((b) => (b.textContent ?? '').includes('${text}'));
      if (!btn) return false; btn.click(); return true;
    })();`);
    if (ok) return true;
    await pause(250);
  }
  return false;
}
let pass = 0, fail = 0;
const assert = (c, msg) => { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.error(`  ✗ ${msg}`); } };
const dismissEvents = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await evaluate(`return !!document.querySelector('[data-testid="event-dialog-overlay"]')`))) return;
    await evaluate(`return (document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true`);
    await pause(400);
  }
};

await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__errs = [];
    window.__xhrUrls = [];
    window.addEventListener('unhandledrejection', function(e){ window.__errs.push(String((e.reason && e.reason.message) || e.reason)); });
    (function(){
      const origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url){
        if (String(url).includes('/api/')) window.__xhrUrls.push(String(url));
        return origOpen.call(this, method, url);
      };
    })();
  `,
});
await cmd('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const targetUrl = process.env.SMOKE_URL ?? 'http://localhost:5173/?offline=1';
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);

assert(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`), '离线 boot：剧本选择就绪');
assert(await clickByText('button', '英雄集结'), '选择剧本：英雄集结');
await pause(500);
assert(await clickByText('button', '曹操'), '选择势力：曹操军');
await pause(400);
assert(await clickByText('button', '进入剧本'), '点击进入剧本');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-domain-civil"]')`, 20000), '世界屏渲染');
await dismissEvents();

// ====== 势力总览（getFactionOverview） ======
assert(await evaluate(`return (() => { document.querySelector('[data-testid="command-domain-faction"]')?.click(); return true; })();`), '打开命令坞「势力」域');
assert(await waitFor(`return document.body.innerText.includes('天命值') && document.body.innerText.includes('人心值') && document.body.innerText.includes('声望')`, 10000), '势力总览渲染天命/人心/声望（离线 getFactionOverview）');
await evaluate(`return (() => { document.querySelector('[data-testid="command-drawer-close"], [aria-label*="关闭"]')?.click(); return true; })();`);
await pause(400);

// ====== 总军师（appoint / switch / status / dismiss） ======
assert(await clickByText('button', '总军师'), '展开左栏「总军师」折叠区');
assert(await waitFor(`return document.body.innerText.includes('未任命总军师') || document.body.innerText.includes('态势切换') || document.body.innerText.includes('当前加成')`, 8000), '总军师面板渲染（status 拉取完成）');
if (!(await evaluate(`return document.body.innerText.includes('未任命总军师')`))) {
  // 已有总军师的存档残留时先解职，保证从零走全链
  assert(await clickByText('button', '解职总军师'), '先解职既有总军师（回到未任命基线）');
  await pause(600);
}
assert(await clickByText('button', '任命总军师'), '展开候选人列表');
const appointed = await evaluate(`return (() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /智\\s*(8[5-9]|9\\d)/.test(b.textContent ?? '') && b.textContent.includes('智'));
  if (!btn) return null;
  const name = (btn.querySelector('span') ?? btn).textContent.trim();
  btn.click();
  return name;
})()`);
assert(Boolean(appointed), `任命候选人（${appointed ?? '无候选'}）`);
assert(await waitFor(`return !document.body.innerText.includes('未任命总军师')`, 8000), '任命生效（面板切换为在任视图）');
// 引擎规则：态势每季仅可切换一次，新任命当季点击必被权威侧冷却拒绝（在线同构）。
await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '防守'); b?.click(); return true; })();`);
assert(await waitFor(`return document.body.innerText.includes('态势切换冷却中')`, 8000), '当季切换被冷却拒绝（grandStrategistSwitch 权威校验往返）');
assert(await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('解职总军师')); b?.click(); return true; })();`), '解职总军师（confirm 自动接受）');
assert(await waitFor(`return document.body.innerText.includes('未任命总军师')`, 8000), '解职生效（回未任命态）');

// ====== 人事名册 → OfficerDetail 关系 / 技能 ======
assert(await evaluate(`return (() => { document.querySelector('[data-testid="command-domain-personnel"]')?.click(); return true; })();`), '打开命令坞「人事」域');
assert(await waitFor(`return !!document.querySelector('[data-testid="command-personnel-roster"]')`, 10000), '名册分面渲染');
const caoBtn = `[...document.querySelectorAll('[data-testid^="command-personnel-officer-"]')].find((b) => (b.textContent ?? '').includes('曹操'))`;
assert(await evaluate(`return (() => { const b = ${caoBtn}; if (!b) return false; b.click(); return true; })();`), '点击名册中的曹操');
assert(await waitFor(`return !!document.querySelector('[data-testid="officer-detail"]')`, 10000), 'OfficerDetail 弹窗渲染');

// 关系网（getOfficerRelations）
assert(await evaluate(`return (() => { document.querySelector('[data-testid="officer-tab-relations"]')?.click(); return true; })();`), '切到「关系」tab');
assert(await waitFor(`return document.body.innerText.includes('社交关系')`, 10000), '关系列表拉取完成');
const relCount = await evaluate(`return [...document.querySelectorAll('[role="dialog"] span')].filter((s) => s.textContent === '正史' || s.textContent === '演义').length`);
assert(relCount > 0, `关系行渲染（${relCount} 行来源标签，含亲和价值）`);

// 技能树（getSkillTrees + getOfficerSkillState + upgradeSkillNode + resetSkillTree）
assert(await evaluate(`return (() => { document.querySelector('[data-testid="officer-tab-skills"]')?.click(); return true; })();`), '切到「技能」tab');
assert(await waitFor(`return document.body.innerText.includes('已用')`, 12000), '技能树与点数渲染（静态目录经虚拟模块注入）');
const usedBefore = Number(await evaluate(`return Number((document.body.innerText.match(/已用\\s*(\\d+)/) ?? [])[1] ?? -1)`));
assert(usedBefore >= 0, `读取技能点基线（已用 ${usedBefore}）`);
const upgraded = await evaluate(`return (async () => {
  const btn = [...document.querySelectorAll('[role="dialog"] button')].find((b) => /^\\+\\d+$/.test((b.textContent ?? '').trim()));
  if (!btn) return false;
  btn.click();
  await new Promise((r) => setTimeout(r, 600));
  return true;
})()`);
assert(upgraded, '点击首个可升级技能节点「+N」（upgradeSkillNode）');
assert(await waitFor(`return Number((document.body.innerText.match(/已用\\s*(\\d+)/) ?? [])[1] ?? -1) === ${usedBefore + 1}`, 10000), `加点同步（已用 ${usedBefore} → ${usedBefore + 1}）`);
assert(await evaluate(`return (() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '重置'); b?.click(); return true; })();`), '点击「重置」（resetSkillTree）');
assert(await waitFor(`return Number((document.body.innerText.match(/已用\\s*(\\d+)/) ?? [])[1] ?? -1) === 0`, 10000), '重置后技能点归零（skills 回静态基线）');

// 收尾
await evaluate(`return (() => { document.querySelectorAll('[aria-label*="关闭"]').forEach((b) => b.click()); return true; })();`);
const xhrCalls = await evaluate(`return (window.__xhrUrls || []).length`);
assert(xhrCalls === 0, `零在线回退（/api/ 调用数 = ${xhrCalls}）`);
const errs = await evaluate(`return (window.__errs || []).join(' | ')`);
assert(!errs, `无未处理拒绝（${errs || '无'}）`);
const realErrors = consoleErrors.filter((t) => !/net::ERR|Failed to fetch|WebSocket|favicon/i.test(t));
assert(realErrors.length === 0, `控制台无非网络错误（${realErrors.length}）${realErrors[0] ? ': ' + realErrors[0].slice(0, 160) : ''}`);

console.log(`\n${pass} passed, ${fail} failed`);
ws.close();
process.exit(fail > 0 ? 1 : 0);
