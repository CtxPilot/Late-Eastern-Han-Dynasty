// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * CMD-P4 browser acceptance.
 *
 * Prerequisites:
 *   pnpm dev
 *   google-chrome --headless=new --remote-debugging-port=9234 http://127.0.0.1:5173
 *
 * Optional:
 *   CDP_PORT=9234 node scripts/verify-cmd-p4-headless.mjs
 */
const cdpPort = process.env.CDP_PORT ?? '9234';
const targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = targets.find((target) => target.type === 'page');
if (!page) throw new Error('CMD-P4 Headless：未找到 Chrome page target');

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
await new Promise((resolve) => {
  ws.onopen = resolve;
});

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
await new Promise((resolve) => setTimeout(resolve, 700));
await evaluate(`
  const response = await fetch('/api/game/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenarioId: 1, playerFactionId: 1 }),
  });
  if (!response.ok) throw new Error('创建英雄集结曹操局失败：' + await response.text());
  location.reload();
`);
await new Promise((resolve) => setTimeout(resolve, 1300));

const result = await evaluate(`
  const pause = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
  const byTestId = (id) => document.querySelector('[data-testid="' + id + '"]');
  const exactButton = (text) => [...document.querySelectorAll('button')]
    .find((button) => button.innerText.trim() === text);
  const state = async () => {
    const response = await fetch('/api/game/state');
    if (!response.ok) throw new Error('读取权威状态失败：' + await response.text());
    return response.json();
  };

  const legacyMonarchBefore = exactButton('君主');
  const legacyDecreeCountBefore = document.querySelectorAll('[data-testid^="btn-false-decree-"]').length;
  if (legacyMonarchBefore || legacyDecreeCountBefore !== 0) {
    throw new Error('旧君主写入口仍存在于 DOM');
  }

  const courtTrigger = byTestId('command-domain-court');
  if (!courtTrigger) throw new Error('新朝廷命令坞入口缺失');
  courtTrigger.click();
  await pause();

  const courtTextBefore = byTestId('court-command-content')?.innerText ?? '';
  for (const required of ['君主与政统', '汉帝所在', '本势力控制', '皇权', '伪诏冷却', '霸府官制']) {
    if (!courtTextBefore.includes(required)) throw new Error('朝廷抽屉缺少：' + required);
  }

  const establish = byTestId('command-court-establish-hegemony');
  if (!establish || establish.disabled) throw new Error('新入口开霸府不可用');
  establish.click();
  await pause();
  const establishReview = byTestId('command-confirm-dialog')?.innerText ?? '';
  if (!establishReview.includes('诸侯 → 霸府') || !establishReview.includes('皇权 100')) {
    throw new Error('开霸府终审内容不完整');
  }
  byTestId('command-confirm-cancel').click();
  await pause();
  const afterEstablishCancel = await state();
  if ((afterEstablishCancel.factions[1].politicalStage ?? 'vassal') !== 'vassal') {
    throw new Error('取消开霸府后权威状态发生变化');
  }

  byTestId('command-court-establish-hegemony').click();
  await pause();
  byTestId('command-confirm-submit').click();
  await pause(700);
  const afterEstablish = await state();
  if (afterEstablish.factions[1].politicalStage !== 'hegemon') throw new Error('开霸府未进入 hegemon');
  if (afterEstablish.factions[1].imperialAuthority !== 100) throw new Error('开霸府后皇权不是 100');

  const select = byTestId('command-court-false-decree-target');
  if (!select) throw new Error('伪诏目标选择器缺失');
  const option = [...select.options].find((entry) => entry.value && !entry.text.includes('已交战'));
  if (!option) throw new Error('没有可用的伪诏目标，测试不得跳过');
  const targetLabel = option.text;
  select.value = option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
  await pause();

  const review = byTestId('command-court-false-decree-review');
  if (!review || review.disabled) throw new Error('伪诏送审入口不可用');
  review.click();
  await pause();
  const decreeReview = byTestId('command-confirm-dialog')?.innerText ?? '';
  if (!decreeReview.includes('皇权 40') || !decreeReview.includes('8 季')) {
    throw new Error('伪诏终审内容不完整');
  }
  byTestId('command-confirm-cancel').click();
  await pause();
  const afterDecreeCancel = await state();
  if (afterDecreeCancel.factions[1].imperialAuthority !== 100) {
    throw new Error('取消伪诏后皇权发生变化');
  }

  byTestId('command-court-false-decree-review').click();
  await pause();
  byTestId('command-confirm-submit').click();
  await pause(700);
  const afterDecree = await state();
  const targetId = Number(option.value);
  const relation = afterDecree.diplomacy.find(
    (item) => (item.factionA === 1 && item.factionB === targetId)
      || (item.factionA === targetId && item.factionB === 1),
  )?.relation;
  if (afterDecree.factions[1].imperialAuthority !== 60) throw new Error('伪诏后皇权不是 60');
  if (afterDecree.factions[1].imperialDecreeCooldown !== 8) throw new Error('伪诏后冷却不是 8 季');
  if (relation !== 'war') throw new Error('伪诏后外交关系不是 war');

  const courtTextAfter = byTestId('court-command-content')?.innerText ?? '';
  if (!courtTextAfter.includes('皇权') || !courtTextAfter.includes('8季')) {
    throw new Error('权威状态未即时回显到朝廷抽屉');
  }

  byTestId('command-court-open-personnel').click();
  await pause();
  const personnelOpen = [...document.querySelectorAll('button')]
    .find((button) => button.innerText.trim().startsWith('人事'))
    ?.getAttribute('aria-expanded') === 'true';
  if (!personnelOpen) throw new Error('霸府官制跳转未打开既有人事任命入口');

  const legacyMonarchAfter = exactButton('君主');
  const legacyDecreeCountAfter = document.querySelectorAll('[data-testid^="btn-false-decree-"]').length;
  if (legacyMonarchAfter || legacyDecreeCountAfter !== 0) {
    throw new Error('完成流程后旧君主写入口重新出现');
  }

  return {
    oldMonarchAbsent: legacyMonarchBefore == null && legacyMonarchAfter == null,
    oldDecreeButtons: legacyDecreeCountAfter,
    courtFeaturesPresent: true,
    establishCancelPreserved: true,
    establishedStage: afterEstablish.factions[1].politicalStage,
    authorityAfterEstablish: afterEstablish.factions[1].imperialAuthority,
    decreeTarget: targetLabel,
    decreeCancelPreserved: true,
    authorityAfterDecree: afterDecree.factions[1].imperialAuthority,
    cooldownAfterDecree: afterDecree.factions[1].imperialDecreeCooldown,
    relationAfterDecree: relation,
    personnelJump: personnelOpen,
  };
`);

if (consoleErrors.length) {
  throw new Error(`CMD-P4 Headless 控制台错误：${consoleErrors.join(' | ')}`);
}
console.log(JSON.stringify({ ...result, consoleErrors }, null, 2));
ws.close();
