// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S13 宝物系统 UI 冒烟（Session 266）：
 *  - 武将简册 → 装备 tab：5 槽展示、曹操装备倚天剑
 *  - 六维区块显示装备加成「装+N」
 *  - 势力库存展示；君主隐藏卸下/赏赐控件
 *  - 赏赐流程（非君主武将荀彧）：选库存宝物 → 赏赐并装备 → 装备同步 → 卸下
 *  - console error = 0
 * 前置：pnpm dev；Chrome 以 1440×900、CDP_PORT（默认 9239）启动并打开前端。
 * 运行：node scripts/verify-s266-ui.mjs
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

// 第一步：曹操（id=1，君主）装备展示
const caoResult = await evaluate(`
  const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  for (let i = 0; i < 80 && !by('command-domain-personnel'); i += 1) await pause(50);
  if (!by('command-domain-personnel')) return { ok: false, reason: '命令坞未就绪' };

  by('command-domain-personnel').click(); await pause();
  if (!by('command-personnel-roster')) return { ok: false, reason: '人事名册未打开' };

  const caoBtn = by('command-personnel-officer-1');
  if (!caoBtn) return { ok: false, reason: '名册无曹操' };
  caoBtn.click(); await pause();
  const detail = by('officer-detail');
  if (!detail) return { ok: false, reason: '简册未打开' };

  const equipTab = by('officer-tab-equipment');
  if (!equipTab) return { ok: false, reason: '装备 tab 缺失' };
  equipTab.click(); await pause();

  const text = detail.innerText;
  const hasSword = text.includes('倚天剑');
  const hasSlotLabels = ['主武器', '副武器', '铠甲', '坐骑', '兵书']
    .filter((label) => text.includes(label)).length;
  const hasInventory = text.includes('势力库存');
  const hasAuthority = text.includes('权威');
  const hasWar = /武 \\+8/.test(text);
  // 君主应隐藏卸下/赏赐按钮
  const hasUnequipBtn = detail.querySelector('[data-testid^="btn-unequip-"]') != null;
  const hasGrantBtn = by('btn-grant-item') != null;
  detail.querySelector('[aria-label="关闭"]').click(); await pause();
  return {
    ok: true,
    hasSword, hasSlotLabels, hasInventory, hasAuthority, hasWar, hasUnequipBtn, hasGrantBtn,
    excerpt: text.slice(0, 200),
  };
`);

if (!caoResult.ok) throw new Error(`曹操装备展示失败: ${caoResult.reason}`);
check('装备 tab 存在', true);
check('曹操装备倚天剑', caoResult.hasSword, caoResult.excerpt);
check('5 槽标签齐全', caoResult.hasSlotLabels === 5, `实际 ${caoResult.hasSlotLabels}`);
check('势力库存区块存在', caoResult.hasInventory);
check('倚天剑权威+5 效果展示', caoResult.hasAuthority);
check('倚天剑武力+8 属性展示', caoResult.hasWar);
check('君主隐藏卸下按钮', !caoResult.hasUnequipBtn);
check('君主隐藏赏赐按钮', !caoResult.hasGrantBtn);

// 第二步：六维装备加成（曹操武力 72+8=80 显示 装+8）
const attrResult = await evaluate(`
  const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const caoBtn = by('command-personnel-officer-1');
  if (!caoBtn) return { ok: false, reason: '名册无曹操' };
  caoBtn.click(); await pause();
  const detail = by('officer-detail');
  if (!detail) return { ok: false, reason: '简册未打开' };
  // 切回属性 tab 检查六维
  const statsTab = by('officer-tab-stats');
  if (statsTab) statsTab.click(); await pause();
  const text = detail.innerText;
  const hasEquipBonus = text.includes('装+8');
  detail.querySelector('[aria-label="关闭"]').click(); await pause();
  return { ok: true, hasEquipBonus, excerpt: text.slice(0, 200) };
`);
if (!attrResult.ok) throw new Error(`六维装备加成失败: ${attrResult.reason}`);
check('六维显示装备加成 装+8', attrResult.hasEquipBonus, attrResult.excerpt);

// 第三步：赏赐流程——绝影（id=12）赏赐给荀彧（id=8），验证装备同步
const grantResult = await evaluate(`
  const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const xunyuBtn = by('command-personnel-officer-8');
  if (!xunyuBtn) return { ok: false, reason: '名册无荀彧' };
  xunyuBtn.click(); await pause();
  const detail = by('officer-detail');
  if (!detail) return { ok: false, reason: '简册未打开' };
  by('officer-tab-equipment').click(); await pause();

  const select = by('item-inventory-select');
  if (!select) return { ok: false, reason: '库存选择器缺失' };
  const options = [...select.options].filter((o) => o.value !== '');
  if (options.length === 0) return { ok: false, reason: '库存为空无可赏赐宝物' };
  const chosen = options[0].textContent;
  // React 受控 select：用原生 value setter 触发 change
  const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  valueSetter.call(select, options[0].value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();

  const grantBtn = by('btn-grant-item');
  if (!grantBtn) return { ok: false, reason: '赏赐按钮缺失' };
  // 记录按钮是否可用（React 受控 select 的 selectedItemId 是否已更新）
  const btnDisabledBefore = grantBtn.disabled;
  if (grantBtn.disabled) {
    // 用原生 setter 后可能 React 未重渲染，等待一帧再试
    await pause(300);
  }
  if (!grantBtn.disabled) {
    grantBtn.click();
    await pause(600);
  }
  // store 更新可能触发 OfficerDetail 重挂载，重新查询最新节点
  const latestDetail = by('officer-detail') ?? detail;
  const afterText = latestDetail.innerText;
  // 检查服务端真实状态（点击后是否真的装备）
  let serverEquip = 'N/A';
  try {
    const serverState = await (await fetch('/api/game/state')).json();
    serverEquip = JSON.stringify(serverState.officers[8]?.equipment ?? {});
  } catch {
    /* ignore */
  }
  const hasChosen = afterText.includes(chosen.split('×')[0].trim());
  const hasUnequip = latestDetail.querySelector('[data-testid^="btn-unequip-"]') != null;
  latestDetail.querySelector('[aria-label="关闭"]')?.click(); await pause();
  return { ok: true, hasChosen, hasUnequip, chosen, btnDisabledBefore, serverEquip, excerpt: afterText.slice(0, 200) };
`);

if (!grantResult.ok) throw new Error(`赏赐流程失败: ${grantResult.reason}`);
check(`库存有宝物可选（${grantResult.chosen}）`, grantResult.chosen != null && grantResult.chosen !== '');
check(`赏赐按钮初始可用（selectedItemId 已更新）`, grantResult.btnDisabledBefore === false, `disabled=${grantResult.btnDisabledBefore}`);
check(`赏赐后服务端装备（${grantResult.serverEquip}）`, grantResult.serverEquip !== 'N/A' && grantResult.serverEquip !== '{}');
check(`赏赐后装备区显示宝物（${grantResult.chosen}）`, grantResult.hasChosen, grantResult.excerpt);
check('赏赐后出现卸下按钮（宝物已装备）', grantResult.hasUnequip);

// 第四步：卸下——装备的宝物卸下回库存
const unequipResult = await evaluate(`
  const pause = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));
  const by = (id) => document.querySelector('[data-testid="' + id + '"]');
  const xunyuBtn = by('command-personnel-officer-8');
  if (!xunyuBtn) return { ok: false, reason: '名册无荀彧' };
  xunyuBtn.click(); await pause();
  const detail = by('officer-detail');
  if (!detail) return { ok: false, reason: '简册未打开' };
  by('officer-tab-equipment').click(); await pause();
  const unequipBtn = detail.querySelector('[data-testid^="btn-unequip-"]');
  if (!unequipBtn) return { ok: false, reason: '无卸下按钮' };
  const itemId = unequipBtn.getAttribute('data-testid').replace('btn-unequip-', '');
  unequipBtn.click(); await pause(600);
  // store 更新可能触发重挂载，重新查询
  const latestDetail = by('officer-detail') ?? detail;
  const text = latestDetail.innerText;
  const slotEmpty = text.includes('未装备');
  const itemGone = latestDetail.querySelector('[data-testid^="btn-unequip-"]') == null;
  latestDetail.querySelector('[aria-label="关闭"]')?.click(); await pause();
  return { ok: true, slotEmpty, itemGone, itemId, excerpt: text.slice(0, 200) };
`);
if (!unequipResult.ok) throw new Error(`卸下流程失败: ${unequipResult.reason}`);
check(`卸下宝物 ${unequipResult.itemId} 后槽位为空`, unequipResult.slotEmpty, unequipResult.excerpt);
check('卸下后无卸下按钮', unequipResult.itemGone);

await pause(300);
const realErrors = consoleErrors.filter((e) => !/favicon/i.test(e));
check('console error = 0', realErrors.length === 0, realErrors.join(' | '));

console.log(`\nS13 宝物 UI 冒烟：${assertions} 项断言通过，console error=0`);
