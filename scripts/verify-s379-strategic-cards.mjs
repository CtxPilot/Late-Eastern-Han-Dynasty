// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

// Session 379：战略卡片世界屏冒烟（?offline=1，Chrome CDP 9242）。
// 前置：pnpm --filter @leh/client dev；无需后端。
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
  for (let i = 0; i < 5; i++) {
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
assert(await clickByText('button', '英雄集结'), '选择剧本：英雄集结');
await pause(500);
assert(await clickByText('button', '曹操'), '选择势力：曹操军');
await pause(400);
assert(await clickByText('button', '进入剧本'), '点击进入剧本');
assert(await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`, 20000), '世界屏：战略卡片容器');
await dismissEvents();

assert(
  !(await evaluate(`return !!document.querySelector('[data-testid="map-canvas"]')`)),
  '无 map-canvas（大地图已退出世界屏）',
);
assert(
  await evaluate(`return !!document.querySelector('[data-testid="strategic-province-grid"]')`),
  '天下形势：州卡片网格可见',
);
assert(
  await evaluate(`return (document.querySelector('[data-testid="strategic-world-view"]')?.textContent ?? '').includes('天下形势')`),
  '标题含「天下形势」',
);

assert(await clickByText('button', '荆州'), '点击州卡：荆州');
assert(
  await waitFor(`return !!document.querySelector('[data-testid="strategic-city-grid"]')`),
  '荆州：城卡片网格',
);
assert(
  await evaluate(`return !!document.querySelector('[data-testid="province-topology"]')`),
  '荆州：官道拓扑图',
);
assert(
  await evaluate(`return !!document.querySelector('[data-testid="commandery-topology-overlay"]')`),
  '荆州：南郡县拓扑叠加',
);
assert(
  await evaluate(`return !!document.querySelector('[data-testid="strategic-back-realm"]')`),
  '返回天下按钮可见',
);

// 点江陵（南郡治所，曹操剧本下可能非己方；仍应写 selectedCityId）
const jinglingClicked = await evaluate(`return (() => {
  const btn = document.querySelector('[data-testid="strategic-city-14"]')
    || [...document.querySelectorAll('[data-testid^="strategic-city-"]')].find((b) => (b.textContent ?? '').includes('江陵'));
  if (!btn) return false;
  btn.click();
  return true;
})();`);
assert(jinglingClicked, '点击城卡（江陵或首城）');
await pause(400);
assert(
  await evaluate(`return !!document.querySelector('[data-testid="city-panel"]')`),
  'RightPanel 城池详情刷新',
);

// 左栏己方城：切州并选城
assert(
  await evaluate(`return (() => {
    const citiesAcc = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('己方城池'));
    citiesAcc?.click();
    return true;
  })();`),
  '展开左栏己方城池',
);
await pause(300);
const leftCityOk = await evaluate(`return (() => {
  const panel = document.querySelector('[data-testid="left-panel"]');
  const btn = panel && [...panel.querySelectorAll('button')].find((b) => {
    const t = b.textContent ?? '';
    return t.includes('农') && t.includes('兵') && !t.includes('己方城池');
  });
  if (!btn) return false;
  btn.click();
  return true;
})();`);
assert(leftCityOk, '左栏点己方城 → 战略屏定位');
await pause(500);
assert(
  await evaluate(`return !!document.querySelector('[data-testid="strategic-city-grid"]') || !!document.querySelector('[data-testid="city-panel"]')`),
  '左栏选城后详情/城网格仍可用',
);

// 命令坞仍在
assert(
  await evaluate(`return !!document.querySelector('[data-testid="command-domain-civil"]')`),
  '命令坞内政域入口仍在',
);

// 结束回合
const readMonth = `return ((document.querySelector('[data-testid="top-bar"]')?.textContent ?? '').match(/\\d+年[^月]*?(\\d+)月/) ?? ['',''])[1]`;
const monthBefore = String(await evaluate(readMonth));
await evaluate(`return (() => { document.querySelector('[data-testid="btn-end-turn"]')?.click(); return true; })();`);
let advanced = false;
for (let i = 0; i < 30; i++) {
  await dismissEvents();
  const m = String(await evaluate(readMonth));
  if (m && m !== monthBefore) {
    advanced = true;
    break;
  }
  await pause(500);
}
assert(advanced, `结束回合推进月份（${monthBefore}月 → 次月）`);

const nonNetErrors = consoleErrors.filter(
  (e) => !/Failed to fetch|NetworkError|ERR_CONNECTION|\/api\//i.test(String(e)),
);
assert(nonNetErrors.length === 0, `无非网络 console error（${nonNetErrors.length}）`);

console.log(`\nSession 379 strategic cards: ${pass} passed, ${fail} failed`);
ws.close();
if (fail > 0) process.exit(1);
process.exit(0);
