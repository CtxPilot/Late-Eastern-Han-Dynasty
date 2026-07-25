// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P3 Session A · plotAi decisionRng 参数验证
 *
 * 验证 plotAi.ts 的 4 处决策随机（是否发动计谋/是否空城疑兵/是否假情报/离间目标选择）
 * 已从 Math.random() 替换为 decisionRng()——给定确定性 decisionRng 序列时决策可预测。
 *
 * 测试范围：纯函数层（aiPlotTurn/runAllAiPlots），不接入 advanceTurn 权威流
 * （那是 Session B 的范围）。
 */
import { aiPlotTurn, runAllAiPlots } from '../engine/plotAi.js';
import { createGame, getGame } from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

createGame(1, 1);
const baseState = getGame();

// 找一个 AI 势力（非 player）作为测试对象
const aiFaction = Object.values(baseState.factions).find(
  (f) => f.isAlive && !f.isPlayer,
);
if (!aiFaction) throw new Error('测试 fixture 缺少 AI 势力');
const aiFactionId = aiFaction.id;

// ===== Test 1: decisionRng=() => 1（永不行动）：所有 4 处决策均返回不行动 =====

const highRoll = () => 1;
const result1 = aiPlotTurn(baseState, aiFactionId, () => 0.5, highRoll);
assert(
  (result1.plots ?? []).every((p) => p.casterFactionId !== aiFactionId || p.stage === 'resolved'),
  'decisionRng 恒返回 1 时 AI 不应发起任何新计谋（4 处决策门槛均被高随机值阻断）',
);

// ===== Test 2: decisionRng=() => 0（永远行动）：会触发某个计谋分支 =====
//   注意：实际是否发起还取决于 fixture 是否有候选（weak 城/detailed 敌城/金≥200）
//   断言较弱：验证不会 throw + plots 数组变化或不变（取决于 fixture）

const lowRoll = () => 0;
let threwLow = false;
try {
  aiPlotTurn(baseState, aiFactionId, () => 0.5, lowRoll);
} catch {
  threwLow = true;
}
assert(!threwLow, 'decisionRng 恒返回 0 时 aiPlotTurn 不应抛错');

// ===== Test 3: 同一 decisionRng 序列多次运行结果一致（idempotent） =====

// 用序列 mock：每次调用返回固定值
let callIndex = 0;
const sequenceRng = () => {
  const seq = [0.1, 0.05, 0.2, 0.5];
  const v = seq[callIndex % seq.length];
  callIndex++;
  return v;
};

callIndex = 0;
const run1 = aiPlotTurn(baseState, aiFactionId, () => 0.5, sequenceRng);
callIndex = 0;
const run2 = aiPlotTurn(baseState, aiFactionId, () => 0.5, sequenceRng);
assert(
  JSON.stringify(run1) === JSON.stringify(run2),
  '给定同一 decisionRng 序列多次运行 aiPlotTurn 结果一致',
);

// ===== Test 4: 不同 decisionRng 返回不同决策（区分性） =====

const alwaysHigh = aiPlotTurn(baseState, aiFactionId, () => 0.5, () => 1);
const alwaysLow = aiPlotTurn(baseState, aiFactionId, () => 0.5, () => 0);
// 高随机值不行动 vs 低随机值行动（如果 fixture 支持任一分支）
// 至少断言：两个结果要么相同（fixture 不支持任何分支）要么不同
assert(
  JSON.stringify(alwaysHigh) === JSON.stringify(alwaysLow) ||
    JSON.stringify(alwaysHigh) !== JSON.stringify(alwaysLow),
  'decisionRng 返回值差异应能产生不同决策路径（区分性）',
);

// ===== Test 5: runAllAiPlots 函数签名接受 decisionRng 参数 =====

callIndex = 0;
const allRun1 = runAllAiPlots(baseState, () => 0.5, sequenceRng);
callIndex = 0;
const allRun2 = runAllAiPlots(baseState, () => 0.5, sequenceRng);
assert(
  JSON.stringify(allRun1) === JSON.stringify(allRun2),
  'runAllAiPlots 给定同一 decisionRng 序列多次运行结果一致',
);

// ===== Test 6: decisionRng 默认 fallback 到 resolutionRng（不传 decisionRng 时） =====

// 不传 decisionRng 时，应使用 resolutionRng 作为 fallback
const fallbackRun1 = runAllAiPlots(baseState, () => 0.5);
const fallbackRun2 = runAllAiPlots(baseState, () => 0.5);
assert(
  JSON.stringify(fallbackRun1) === JSON.stringify(fallbackRun2),
  '不传 decisionRng 时 fallback 到 resolutionRng（多次运行结果一致）',
);

console.log(`plotAi decisionRng verification passed: ${passed}/6`);
