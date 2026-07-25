// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P3 Session B · 整场 AI 军事决策复现验证
 *
 * 推进 N=12 个月，前 6 月建立基线 + 保存 envelope，后 6 月记录每月军事决策
 * 可观察指标（CampaignArmy 列表 + ai_war_report/ai_battle_report 战报）。
 * 读档恢复到第 6 月 + PRNG 状态，重新推进 6 月，断言决策序列完全一致 +
 * PRNG draws 计数一致——证明 AI 决策（是否出征/是否袭扰/目标选择）在
 * 读档后完全可预测。
 *
 * 与 verify-ai-military-rng.ts 的区别：后者验证单次袭扰伤亡幅度复现（5/5），
 * 本脚本验证整场 6 个月决策序列复现（不只数值，连"AI 选择打哪里"都可预测）。
 */
import { CURRENT_SAVE_SCHEMA_VERSION, type GameState, type SaveEnvelopeV1 } from '@leh/shared';
import { advanceTurn } from '../engine/turn.js';
import { getRuntimeRngState, resetRuntimeRng, runtimeRandom } from '../runtime-rng.js';
import { createGame, getGame, restoreGameFromEnvelope } from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-25T12:00:00.000Z',
    updatedAt: '2026-07-25T12:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

interface MilitaryMetrics {
  armies: Array<{ id: string; factionId: number; phase: string; troops: number; currentNodeId: number; targetNodeId?: number }>;
  warReports: Array<{ type: string; message: string; year: number; month: number }>;
  cityRulers: Array<{ id: number; ruler: number | null; troops: number }>;
}

function extractMilitaryMetrics(state: GameState): MilitaryMetrics {
  return {
    armies: state.campaignArmies.map((a) => ({
      id: a.id,
      factionId: a.factionId,
      phase: a.phase,
      troops: a.troops,
      currentNodeId: a.currentNodeId,
      targetNodeId: a.targetNodeId,
    })),
    warReports: state.actionLog
      .filter((l) => l.type === 'ai_war_report' || l.type === 'ai_battle_report')
      .map((l) => ({ type: l.type, message: l.message, year: l.year, month: l.month })),
    cityRulers: Object.values(state.cities).map((c) => ({
      id: c.id,
      ruler: c.ruler,
      troops: c.troops,
    })),
  };
}

createGame(1, 1);
resetRuntimeRng(0x1234_5678);
let state: GameState = getGame();

for (let i = 0; i < 6; i += 1) {
  state = advanceTurn(state, runtimeRandom);
}

const save = envelopeFor(state);
const saveRng = getRuntimeRngState();

const expectedSequence: MilitaryMetrics[] = [];
for (let i = 0; i < 6; i += 1) {
  state = advanceTurn(state, runtimeRandom);
  expectedSequence.push(extractMilitaryMetrics(state));
}
const expectedFinalRng = getRuntimeRngState();

restoreGameFromEnvelope(save);
let replayState: GameState = getGame();
const replayStartRng = getRuntimeRngState();
assert(
  JSON.stringify(replayStartRng) === JSON.stringify(saveRng),
  '读档后 PRNG 状态恢复到第 6 月保存点',
);

const actualSequence: MilitaryMetrics[] = [];
for (let i = 0; i < 6; i += 1) {
  replayState = advanceTurn(replayState, runtimeRandom);
  actualSequence.push(extractMilitaryMetrics(replayState));
}
const actualFinalRng = getRuntimeRngState();

assert(
  JSON.stringify(actualSequence) === JSON.stringify(expectedSequence),
  '读档重放后 6 个月 AI 军事决策序列完全一致（CampaignArmy/战报/城池统治者）',
);
assert(
  JSON.stringify(actualFinalRng) === JSON.stringify(expectedFinalRng),
  '读档重放后 PRNG 状态最终一致（draws 计数相同）',
);

const totalArmies = expectedSequence.reduce((sum, s) => sum + s.armies.length, 0);
const totalReports = expectedSequence.reduce((sum, s) => sum + s.warReports.length, 0);
assert(
  totalArmies > 0 || totalReports > 0,
  `6 个月推进中应至少有一次 AI 军事决策发生（总 Army 数 ${totalArmies}，总战报数 ${totalReports}）`,
);

console.log(`AI decision military verification passed: ${passed}/4`);
console.log(`  6 月决策序列：总 Army 数 ${totalArmies}，总战报数 ${totalReports}`);
