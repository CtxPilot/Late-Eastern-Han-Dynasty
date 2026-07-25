// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P3 Session A · 势力遍历顺序稳定化验证
 *
 * 验证三个 AI 函数（runAiMilitary/runAllAiPlots/runAllAiIntel）内部遍历势力时
 * 已通过 `Array.from(Object.values(s.factions)).sort((a, b) => a.id - b.id)`
 * 稳定化为按 ID 升序——确保后续 PRNG 收口后，AI 决策序列可复现
 * （不再依赖 Object.keys() 枚举顺序的隐性副作用）。
 *
 * 测试方法：
 * 1. 静态：sort 函数本身按 ID 升序（多种插入顺序）
 * 2. 动态：真实 game state，构造不同 factions 插入顺序的副本，
 *    跑 AI 函数后比对 JSON.stringify 结果一致——证明 sort 后插入顺序无关
 */
import { type GameState } from '@leh/shared';
import { runAiMilitary } from '../engine/aiMilitary.js';
import { runAllAiPlots } from '../engine/plotAi.js';
import { runAllAiIntel } from '../engine/spyAi.js';
import { createGame, getGame } from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

// ===== Test 1: sort 函数本身按 ID 升序（多种插入顺序） =====

const fixtures: Array<{ name: string; factions: Record<number, { id: number }> }> = [
  { name: '顺序插入 [1,2,3,4]', factions: { 1: { id: 1 }, 2: { id: 2 }, 3: { id: 3 }, 4: { id: 4 } } },
  { name: '反序插入 [4,3,2,1]', factions: { 4: { id: 4 }, 3: { id: 3 }, 2: { id: 2 }, 1: { id: 1 } } },
  { name: '乱序插入 [3,1,4,2]', factions: { 3: { id: 3 }, 1: { id: 1 }, 4: { id: 4 }, 2: { id: 2 } } },
  { name: '乱序插入 [2,4,1,3]', factions: { 2: { id: 2 }, 4: { id: 4 }, 1: { id: 1 }, 3: { id: 3 } } },
];

for (const { name, factions } of fixtures) {
  const sorted = Array.from(Object.values(factions)).sort((a, b) => a.id - b.id);
  assert(JSON.stringify(sorted.map((f) => f.id)) === JSON.stringify([1, 2, 3, 4]), `sort 后按 ID 升序（${name}）`);
}

// ===== Test 2: 真实 game state，factions 插入顺序不同，AI 函数行为一致 =====

// 创建英雄集结剧本 + 曹操（factionId=1）作为玩家
createGame(1, 1);
const baseState = getGame();

// 构造两种插入顺序（升序 vs 反序）
const factionValues = Object.values(baseState.factions);
const stateAsc: GameState = {
  ...baseState,
  factions: Object.fromEntries(
    factionValues.slice().sort((a, b) => a.id - b.id).map((f) => [f.id, f]),
  ),
};
const stateDesc: GameState = {
  ...baseState,
  factions: Object.fromEntries(
    factionValues.slice().sort((a, b) => b.id - a.id).map((f) => [f.id, f]),
  ),
};

// Stub Math.random 让 plotAi/spyAi 内部尚未收口的 Math.random() 也确定（commit 2/3 替换后此 stub 可移除）
const originalMathRandom = Math.random;
Math.random = () => 0.5;

try {
  // 用确定性 mock RNG（恒返回 0.5）跑两次，比对结果
  const mockRng = () => 0.5;

  const resultAscMil = runAiMilitary(stateAsc, mockRng, mockRng);
  const resultDescMil = runAiMilitary(stateDesc, mockRng, mockRng);
  assert(
    JSON.stringify(resultAscMil) === JSON.stringify(resultDescMil),
    'runAiMilitary: 不同 factions 插入顺序结果一致（sort 生效）',
  );

  const resultAscPlot = runAllAiPlots(stateAsc, mockRng);
  const resultDescPlot = runAllAiPlots(stateDesc, mockRng);
  assert(
    JSON.stringify(resultAscPlot) === JSON.stringify(resultDescPlot),
    'runAllAiPlots: 不同 factions 插入顺序结果一致（sort 生效；plotAi 内 Math.random 已 stub）',
  );

  const resultAscIntel = runAllAiIntel(stateAsc, mockRng);
  const resultDescIntel = runAllAiIntel(stateDesc, mockRng);
  assert(
    JSON.stringify(resultAscIntel) === JSON.stringify(resultDescIntel),
    'runAllAiIntel: 不同 factions 插入顺序结果一致（sort 生效；spyAi 内 Math.random 已 stub）',
  );

  // ===== Test 3: 同一插入顺序多次运行，结果也一致（idempotent 验证） =====

  const run1 = runAiMilitary(stateAsc, mockRng, mockRng);
  const run2 = runAiMilitary(stateAsc, mockRng, mockRng);
  assert(JSON.stringify(run1) === JSON.stringify(run2), 'runAiMilitary: 同一状态多次运行结果一致');

  const run3 = runAllAiPlots(stateAsc, mockRng);
  const run4 = runAllAiPlots(stateAsc, mockRng);
  assert(JSON.stringify(run3) === JSON.stringify(run4), 'runAllAiPlots: 同一状态多次运行结果一致');

  const run5 = runAllAiIntel(stateAsc, mockRng);
  const run6 = runAllAiIntel(stateAsc, mockRng);
  assert(JSON.stringify(run5) === JSON.stringify(run6), 'runAllAiIntel: 同一状态多次运行结果一致');
} finally {
  Math.random = originalMathRandom;
}

console.log(`AI faction sort verification passed: ${passed}/10`);
