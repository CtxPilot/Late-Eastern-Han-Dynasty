// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// Session 485：百城地缘战略卡片与宏观沙盘联动 UI 冒烟（?offline=1，Chrome CDP 9242）。
// 前置：pnpm --filter @leh/client dev；无头 Chrome --remote-debugging-port=9242。
const cdpPort = '9242';
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
const cmd = (method, params = {}) => new Promise((res) => {
  const id = ++nextId;
  pendingMap.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await cmd('Runtime.evaluate', {
    expression: `(async()=>{${expression}})()`,
    awaitPromise: true,
    returnByValue: true,
  });
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
let pass = 0;
let fail = 0;
const assert = (c, msg) => {
  if (c) {
    pass++;
    console.log('  ✓ ' + msg);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
};
const dismissEvents = async () => {
  for (let i = 0; i < 6; i++) {
    if (!(await evaluate(`return !!document.querySelector('[data-testid="event-dialog-overlay"]')`))) return;
    await evaluate(`return (document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true`);
    await pause(400);
  }
};

await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
const targetUrl = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/?offline=1';
await cmd('Page.navigate', { url: targetUrl });
await pause(2500);

assert(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`), '进入剧本选择');
assert(await clickByText('button', '群雄讨董'), '选择剧本：群雄讨董（106 城全割据）');
await pause(600);
assert(await clickByText('button', '曹操'), '选择势力：曹操');
await pause(400);
assert(await clickByText('button', '进入剧本'), '点击进入剧本');
assert(
  await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`, 25000),
  '世界屏：战略卡片容器',
);
await dismissEvents();

assert(
  await evaluate(`return !!document.querySelector('[data-testid="geo-realm-summary"]')`),
  '天下形势：地缘大势总览可见',
);
const realmText = await evaluate(
  `return document.querySelector('[data-testid="geo-realm-summary"]')?.textContent ?? ''`,
);
assert(realmText.includes('天下要冲'), '地缘总览标题含「天下要冲」');
assert(realmText.includes('百城沙盘'), '地缘总览标题含「百城沙盘」');
assert(realmText.includes('敌踞名关'), '地缘总览展示敌踞名关指标');
assert(realmText.includes('敌关封锁官道'), '地缘总览展示敌关封锁官道指标');
assert(realmText.includes('临敌郡国'), '地缘总览展示临敌郡国指标');
assert(realmText.includes('边患最剧'), '地缘总览展示边患指标');

const nodeCount = await evaluate(
  `return document.querySelectorAll('[data-testid^="geo-node-"]').length`,
);
assert(nodeCount >= 4, `天下要冲战略节点可见（${nodeCount} 个）`);

const firstNode = await evaluate(`return (() => {
  const el = document.querySelector('[data-testid^="geo-node-"]');
  if (!el) return null;
  el.click();
  return el.getAttribute('data-testid');
})();`);
assert(typeof firstNode === 'string', '点击天下要冲节点可下钻州部');
await pause(600);

assert(
  await waitFor(`return !!document.querySelector('[data-testid="strategic-city-grid"]')`),
  '下钻后州部城池卡片网格可见',
);
const geoCardCount = await evaluate(
  `return document.querySelectorAll('[data-testid^="geo-card-"]').length`,
);
assert(geoCardCount > 0, `州部城卡展示地缘徽记（${geoCardCount} 张）`);
const firstGeoCardText = await evaluate(
  `return document.querySelector('[data-testid^="geo-card-"]')?.textContent ?? ''`,
);
assert(
  /京畿重镇|锁钥要冲|通衢枢纽|边陲前线|腹地安稳|偏远僻壤/.test(firstGeoCardText),
  '城卡地缘徽记包含战略层级',
);
assert(
  /临敌|警讯|安宁/.test(firstGeoCardText),
  '城卡地缘徽记包含临敌态势',
);

// 选中节点对应城池，验证右侧地缘战略分面
const nodeCityId = firstNode?.replace('geo-node-', '');
assert(nodeCityId != null, '天下要冲节点携带城池 id');
assert(
  await evaluate(`return !!document.querySelector('[data-testid="strategic-city-${nodeCityId}"]')`),
  '节点所属城池在州部城卡网格中可定位',
);
await evaluate(`return document.querySelector('[data-testid="strategic-city-${nodeCityId}"]')?.click() ?? true`);
await pause(500);
assert(
  await waitFor(`return !!document.querySelector('[data-testid="city-panel"]')`),
  '选中城池后右侧郡邑详情可见',
);
assert(await clickByText('[data-testid="right-panel"] button', '地缘战略'), '展开右侧「地缘战略」分面');
assert(
  await waitFor(`return !!document.querySelector('[data-testid="geo-profile"]')`),
  '右侧地缘战略分面渲染 geo-profile',
);
const profileText = await evaluate(
  `return document.querySelector('[data-testid="geo-profile"]')?.textContent ?? ''`,
);
assert(profileText.includes('地缘层级'), '地缘分面展示地缘层级');
assert(profileText.includes('临敌态势'), '地缘分面展示临敌态势');
assert(profileText.includes('邻境'), '地缘分面展示邻境敌我中立计数');
assert(profileText.includes('商路'), '地缘分面展示商路联动');

assert(consoleErrors.length === 0, `浏览器 console error 为 0（实际 ${consoleErrors.length}）`);
if (consoleErrors.length > 0) console.error(consoleErrors.join('\n'));

console.log(`\nSession 485 地缘战略 UI：${pass} 通过 / ${fail} 失败`);
ws.close();
if (fail > 0) process.exit(1);
