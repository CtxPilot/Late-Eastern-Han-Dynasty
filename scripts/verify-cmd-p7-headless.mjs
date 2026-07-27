// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P7 人事名册只读抽屉，1440×900 浏览器验收。
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --window-size=1440,900 \
 *     --remote-debugging-port=9234 http://127.0.0.1:5173
 */
const cdpPort = process.env.CDP_PORT ?? '9234';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P7 Headless：未找到 Chrome page target');

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
await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 2, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error('创建190曹操局失败：' + await response.text());
  history.replaceState(null, '', '/');
  location.reload();
`);
await pause(1400);

const actual = await evaluate(`
  const pause = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  byTestId('command-domain-personnel').scrollIntoView({ block: 'end' });
  await pause();
  byTestId('command-domain-personnel').click();
  await pause();
  const drawer = byTestId('command-drawer');
  const roster = byTestId('command-personnel-roster');
  const scroll = byTestId('personnel-roster-scroll');
  if (!drawer || !roster || !scroll) throw new Error('人事名册抽屉未渲染');
  if (drawer.querySelector('[data-testid="btn-personnel-search"], [data-testid="btn-appoint"], [data-testid="btn-reward-beauty-stock"]')) {
    throw new Error('CMD-P7 意外复制了搜索/任命/赏赐写入口');
  }
  const rows = [...drawer.querySelectorAll('[data-testid^="command-personnel-officer-"]')];
  if (rows.length === 0) throw new Error('0-A真实名册为空');
  const keys = rows.map((row) => row.dataset.testid);
  if (new Set(keys).size !== keys.length) throw new Error('0-A真实名册存在重复key标识');
  const rects = rows.map((row) => row.getBoundingClientRect());
  if (rects.some((rect, index) => index > 0 && rect.top < rects[index - 1].bottom - 1)) throw new Error('0-A真实名册行重叠');

  const drawerBody = roster.parentElement;
  const outerBefore = drawerBody.scrollTop;
  scroll.scrollTop = scroll.scrollHeight;
  await pause();
  if (getComputedStyle(scroll).overflowY !== 'auto') throw new Error('名册列表未配置独立滚动');
  if (drawerBody.scrollTop !== outerBefore) throw new Error('名册滚动跳出了抽屉工作流');

  const scope = byTestId('personnel-roster-scope');
  scope.value = 'active';
  scope.dispatchEvent(new Event('change', { bubbles: true }));
  const query = byTestId('personnel-roster-query');
  const targetName = rows[0].querySelector('strong').innerText.trim();
  const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  inputSetter.call(query, targetName);
  query.dispatchEvent(new Event('input', { bubbles: true }));
  await pause();
  const filtered = [...drawer.querySelectorAll('[data-testid^="command-personnel-officer-"]')];
  if (filtered.length !== 1) throw new Error('名册筛选结果异常：' + filtered.length);
  const opener = filtered[0];
  opener.click();
  await pause();
  const detail = byTestId('officer-detail');
  if (!detail || detail.querySelectorAll('[role="tab"]').length !== 4) throw new Error('未复用四页签 OfficerDetail');
  detail.querySelector('button[aria-label="关闭"]').click();
  await pause();
  if (byTestId('officer-detail')) throw new Error('关闭详情后未返回名册');
  if (document.activeElement !== opener) throw new Error('返回名册后焦点未恢复到原人物');
  if (!byTestId('command-personnel-roster')) throw new Error('返回详情时离开人事工作流');
  return {
    count: rows.length,
    filtered: filtered.length,
    summary: byTestId('personnel-roster-summary').innerText.replace(/\\n/g, ' '),
    independentScroll: true,
    focusRestored: true,
  };
`);

async function benchmark(count) {
  await evaluate(`history.replaceState(null, '', '/?cmdP7RosterFixture=${count}'); location.reload();`);
  await pause(1200);
  return evaluate(`
    const waitForReact = async () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const candidate = document.querySelector('[data-testid="command-domain-personnel"]');
        if (candidate && Object.keys(candidate).some((key) => key.startsWith('__reactProps'))) return candidate;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      return null;
    };
    const trigger = await waitForReact();
    if (!trigger) throw new Error('合成夹具命令坞未就绪');
    trigger.scrollIntoView({ block: 'end' });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const started = performance.now();
    trigger.click();
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const elapsedMs = performance.now() - started;
    await new Promise((resolve) => setTimeout(resolve, 220));
    const rows = [...document.querySelectorAll('[data-testid^="command-personnel-officer-"]')];
    const ids = rows.map((row) => row.dataset.testid);
    if (rows.length !== ${count}) throw new Error('${count}条合成夹具渲染数量错误：' + rows.length);
    if (new Set(ids).size !== rows.length) throw new Error('${count}条合成夹具存在重复key标识');
    const scroll = document.querySelector('[data-testid="personnel-roster-scroll"]');
    scroll.scrollTop = scroll.scrollHeight;
    if (scroll.scrollHeight <= scroll.clientHeight || scroll.scrollTop <= 0) throw new Error('${count}条合成夹具未在名册区域独立滚动');
    const visible = rows.filter((row) => {
      const rect = row.getBoundingClientRect();
      const host = scroll.getBoundingClientRect();
      return rect.bottom > host.top && rect.top < host.bottom;
    });
    if (visible.some((row, index) => index > 0 && row.getBoundingClientRect().top < visible[index - 1].getBoundingClientRect().bottom - 1)) {
      throw new Error('${count}条合成夹具可视行重叠');
    }
    return {
      count: rows.length,
      elapsedMs: Number(elapsedMs.toFixed(2)),
      visibleRows: visible.length,
      scrollViewport: {
        top: Number(scroll.getBoundingClientRect().top.toFixed(1)),
        bottom: Number(scroll.getBoundingClientRect().bottom.toFixed(1)),
      },
    };
  `);
}

const synthetic100 = await benchmark(100);
const synthetic1000 = await benchmark(1000);
if (consoleErrors.length > 0) throw new Error(`浏览器控制台错误：${consoleErrors.join(' | ')}`);
ws.close();
console.log(JSON.stringify({ viewport: '1440x900', actual, synthetic100, synthetic1000, consoleErrors: 0 }, null, 2));
