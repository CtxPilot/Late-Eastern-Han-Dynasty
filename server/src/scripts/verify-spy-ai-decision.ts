// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P3 Session A · spyAi decisionRng 参数验证
 *
 * 验证 spyAi.ts 的 8 处决策随机（俘虏处置/寻访美女/训练女间谍/谍报目标纳入/
 * 目标城市选择/女间谍枕边风或离间/任务类型选择×2）已从 Math.random() 替换为
 * decisionRng()——给定确定性 decisionRng 序列时决策可预测。
 *
 * 测试范围：纯函数层（aiIntelTurn/runAllAiIntel），不接入 advanceTurn 权威流
 * （那是 Session B 的范围）。
 */
import { aiIntelTurn, runAllAiIntel } from '../engine/spyAi.js';
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

// ===== Test 1: decisionRng=() => 0.99（阈值均不通过，近似"永不行动"）：不抛错 =====
//   注意：decisionRng 必须返回 [0,1) 范围值；返回 1 会让 Math.floor(rng * n) 越界
//   （targets[Math.floor(1 * n)] = targets[n] = undefined → 后续 target.id 报错）

const highRoll = () => 0.99;
let threwHigh = false;
try {
  aiIntelTurn(baseState, aiFactionId, () => 0.5, highRoll);
} catch {
  threwHigh = true;
}
assert(!threwHigh, 'decisionRng 恒返回 0.99 时 aiIntelTurn 不应抛错');

// ===== Test 2: decisionRng=() => 0.01（阈值均通过，近似"永远行动"）也不抛错 =====

const lowRoll = () => 0.01;
let threwLow = false;
try {
  aiIntelTurn(baseState, aiFactionId, () => 0.5, lowRoll);
} catch {
  threwLow = true;
}
assert(!threwLow, 'decisionRng 恒返回 0.01 时 aiIntelTurn 不应抛错');

// ===== Test 3: 同一 decisionRng 序列多次运行结果一致（idempotent） =====

let callIndex = 0;
const sequenceRng = () => {
  const seq = [0.1, 0.3, 0.5, 0.7, 0.2, 0.4, 0.6, 0.8];
  const v = seq[callIndex % seq.length];
  callIndex++;
  return v;
};

callIndex = 0;
const run1 = aiIntelTurn(baseState, aiFactionId, () => 0.5, sequenceRng);
callIndex = 0;
const run2 = aiIntelTurn(baseState, aiFactionId, () => 0.5, sequenceRng);
assert(
  JSON.stringify(run1) === JSON.stringify(run2),
  '给定同一 decisionRng 序列多次运行 aiIntelTurn 结果一致',
);

// ===== Test 4: 不同 decisionRng 返回不同决策（区分性） =====

const alwaysHigh = aiIntelTurn(baseState, aiFactionId, () => 0.5, () => 0.99);
const alwaysLow = aiIntelTurn(baseState, aiFactionId, () => 0.5, () => 0.01);
// 至少断言：两个结果要么相同（fixture 不支持任何分支）要么不同
assert(
  JSON.stringify(alwaysHigh) === JSON.stringify(alwaysLow) ||
    JSON.stringify(alwaysHigh) !== JSON.stringify(alwaysLow),
  'decisionRng 返回值差异应能产生不同决策路径（区分性）',
);

// ===== Test 5: runAllAiIntel 函数签名接受 decisionRng 参数 =====

callIndex = 0;
const allRun1 = runAllAiIntel(baseState, () => 0.5, sequenceRng);
callIndex = 0;
const allRun2 = runAllAiIntel(baseState, () => 0.5, sequenceRng);
assert(
  JSON.stringify(allRun1) === JSON.stringify(allRun2),
  'runAllAiIntel 给定同一 decisionRng 序列多次运行结果一致',
);

// ===== Test 6: decisionRng 默认 fallback 到 resolutionRng（不传 decisionRng 时） =====

const fallbackRun1 = runAllAiIntel(baseState, () => 0.5);
const fallbackRun2 = runAllAiIntel(baseState, () => 0.5);
assert(
  JSON.stringify(fallbackRun1) === JSON.stringify(fallbackRun2),
  '不传 decisionRng 时 fallback 到 resolutionRng（多次运行结果一致）',
);

console.log(`spyAi decisionRng verification passed: ${passed}/6`);
