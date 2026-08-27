// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot
// Capture README feature screenshots (offline strategic UI + officer dossier).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docs/screenshots');
mkdirSync(outDir, { recursive: true });

const cdpPort = '9242';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('未找到 Chrome page target');
const ws = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 0;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.method === 'Page.javascriptDialogOpening') {
    void cmd('Page.handleJavaScriptDialog', { accept: true });
    return;
  }
  pending.get(m.id)?.(m);
};
await new Promise((r) => { ws.onopen = r; });
const cmd = (method, params = {}) => new Promise((res) => {
  const id = ++nextId;
  pending.set(id, res);
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
async function waitFor(expr, timeoutMs = 20000) {
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
async function dismissEvents() {
  for (let i = 0; i < 6; i++) {
    if (!(await evaluate(`return !!document.querySelector('[data-testid="event-dialog-overlay"]')`))) return;
    await evaluate(`return (document.querySelector('[data-testid="event-choice-0"]') || document.querySelector('[data-testid="event-continue"]'))?.click() ?? true`);
    await pause(350);
  }
}
async function shot(name) {
  const r = await cmd('Page.captureScreenshot', { format: 'png', fromSurface: true });
  const path = join(outDir, name);
  writeFileSync(path, Buffer.from(r.result.data, 'base64'));
  console.log('wrote', path);
}

await cmd('Runtime.enable');
await cmd('Page.enable');
await cmd('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await cmd('Page.navigate', { url: 'http://127.0.0.1:5173/?offline=1' });
await pause(2500);

if (!(await waitFor(`return !!document.querySelector('[data-testid="scenario-content-notice"]')`))) {
  throw new Error('未进入剧本选择');
}
await clickByText('button', '英雄集结');
await pause(400);
await clickByText('button', '曹操');
await pause(300);
await clickByText('button', '进入剧本');
if (!(await waitFor(`return !!document.querySelector('[data-testid="strategic-world-view"]')`))) {
  throw new Error('未进入战略卡片世界屏');
}
await dismissEvents();
await pause(600);
await shot('leh-strategic-realm.png');

await clickByText('button', '荆州');
await waitFor(`return !!document.querySelector('[data-testid="strategic-city-grid"]')`);
await pause(400);
await shot('leh-strategic-province.png');

// 打开人事名册 / 武将详情（命令坞）
await evaluate(`return document.querySelector('[data-testid="command-domain-personnel"]')?.click() ?? false`);
await pause(500);
const openedOfficer = await evaluate(`return (() => {
  const rows = [...document.querySelectorAll('button, [role="button"], a, tr')];
  const hit = rows.find((el) => (el.textContent ?? '').includes('曹操'));
  if (!hit) return false;
  hit.click();
  return true;
})();`);
await pause(800);
if (openedOfficer) {
  await shot('leh-officer-dossier.png');
} else {
  // 退回城详情：点己方城
  await evaluate(`return document.querySelector('[data-testid="strategic-back-realm"]')?.click() ?? true`);
  await pause(300);
  await evaluate(`return (() => {
    const citiesAcc = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('己方城池'));
    citiesAcc?.click();
    return true;
  })();`);
  await pause(300);
  await evaluate(`return (() => {
    const panel = document.querySelector('[data-testid="left-panel"]');
    const btn = panel && [...panel.querySelectorAll('button')].find((b) => {
      const t = b.textContent ?? '';
      return t.includes('农') && t.includes('兵') && !t.includes('己方城池');
    });
    btn?.click();
    return !!btn;
  })();`);
  await pause(500);
  await shot('leh-officer-dossier.png'); // fallback: city/world with panels — rename later if needed
}

ws.close();
process.exit(0);
