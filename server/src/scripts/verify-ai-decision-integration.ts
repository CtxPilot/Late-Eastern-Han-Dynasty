// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P3 Session B · 整场 AI 决策复现整合验证
 *
 * 推进 N=24 个月（两年），前 12 月建立基线 + 保存 envelope，后 12 月记录每月
 * 完整 GameState 关键指标（军事+计谋+谍报三者交织）。读档恢复到第 12 月 +
 * PRNG 状态，重新推进 12 月，断言整场决策序列完全一致 + PRNG 状态最终一致
 * ——证明 AI 整场决策（军事/计谋/谍报三者交织）在读档后完全可预测。
 *
 * 与 verify-ai-decision-military/plot/spy 的区别：本脚本推进 24 月（更长），
 * 记录三者交织的完整指标，是 BF-P3 AI 决策 RNG 收口的端到端验收。
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

interface IntegrationMetrics {
  year: number;
  month: number;
  armies: number;
  plots: number;
  agents: number;
  warReports: number;
  aiPlaceholderLogs: number;
  cityRulers: Array<{ id: number; ruler: number | null }>;
}

function extractIntegrationMetrics(state: GameState): IntegrationMetrics {
  return {
    year: state.currentYear,
    month: state.currentMonth,
    armies: state.campaignArmies.length,
    plots: (state.plots ?? []).length,
    agents: Object.values(state.intel?.agents ?? {}).length,
    warReports: state.actionLog.filter((l) => l.type === 'ai_war_report' || l.type === 'ai_battle_report').length,
    aiPlaceholderLogs: state.actionLog.filter((l) => l.type === 'ai_placeholder').length,
    cityRulers: Object.values(state.cities).map((c) => ({ id: c.id, ruler: c.ruler })),
  };
}

createGame(1, 1);
resetRuntimeRng(0x1234_5678);
let state: GameState = getGame();

for (let i = 0; i < 12; i += 1) {
  state = advanceTurn(state, runtimeRandom);
}

const save = envelopeFor(state);
const saveRng = getRuntimeRngState();

const expectedSequence: IntegrationMetrics[] = [];
for (let i = 0; i < 12; i += 1) {
  state = advanceTurn(state, runtimeRandom);
  expectedSequence.push(extractIntegrationMetrics(state));
}
const expectedFinalRng = getRuntimeRngState();

restoreGameFromEnvelope(save);
let replayState: GameState = getGame();
const replayStartRng = getRuntimeRngState();
assert(
  JSON.stringify(replayStartRng) === JSON.stringify(saveRng),
  '读档后 PRNG 状态恢复到第 12 月保存点',
);

const actualSequence: IntegrationMetrics[] = [];
for (let i = 0; i < 12; i += 1) {
  replayState = advanceTurn(replayState, runtimeRandom);
  actualSequence.push(extractIntegrationMetrics(replayState));
}
const actualFinalRng = getRuntimeRngState();

assert(
  JSON.stringify(actualSequence) === JSON.stringify(expectedSequence),
  '读档重放后 12 个月 AI 整场决策序列完全一致（军事+计谋+谍报三者交织）',
);
assert(
  JSON.stringify(actualFinalRng) === JSON.stringify(expectedFinalRng),
  '读档重放后 PRNG 状态最终一致（draws 计数相同）',
);

const totalArmies = expectedSequence.reduce((sum, s) => sum + s.armies, 0);
const totalPlots = expectedSequence.reduce((sum, s) => sum + s.plots, 0);
const totalAgents = expectedSequence.reduce((sum, s) => sum + s.agents, 0);
assert(
  totalArmies > 0 || totalPlots > 0 || totalAgents > 0,
  `12 个月推进中应至少有 AI 决策发生（总 Army ${totalArmies}，总 Plot ${totalPlots}，总 agent ${totalAgents}）`,
);

console.log(`AI decision integration verification passed: ${passed}/4`);
console.log(`  12 月决策序列：总 Army ${totalArmies}，总 Plot ${totalPlots}，总 agent ${totalAgents}`);
