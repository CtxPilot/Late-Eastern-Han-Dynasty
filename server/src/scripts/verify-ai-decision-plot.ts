// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P3 Session B · 整场 AI 计谋决策复现验证
 *
 * 推进 N=12 个月，前 6 月建立基线 + 保存 envelope，后 6 月记录每月计谋决策
 * 可观察指标（Plot 列表 + ai_civil actionLog）。读档恢复到第 6 月 + PRNG
 * 状态，重新推进 6 月，断言决策序列完全一致 + PRNG draws 计数一致——证明
 * AI 计谋决策（是否行动/计谋类型/目标势力）在读档后完全可预测。
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

interface PlotMetrics {
  plots: Array<{ id: string; type: string; stage: string; casterFactionId: number; targetFactionId?: number; targetCityId?: number }>;
  aiPlaceholderLogs: Array<{ type: string; message: string; year: number; month: number }>;
}

function extractPlotMetrics(state: GameState): PlotMetrics {
  return {
    plots: (state.plots ?? []).map((p) => ({
      id: p.id,
      type: String(p.type),
      stage: String(p.stage),
      casterFactionId: p.casterFactionId,
      targetFactionId: p.targetFactionId,
      targetCityId: p.targetCityId,
    })),
    aiPlaceholderLogs: state.actionLog
      .filter((l) => l.type === 'ai_civil')
      .map((l) => ({ type: l.type, message: l.message, year: l.year, month: l.month })),
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

const expectedSequence: PlotMetrics[] = [];
for (let i = 0; i < 6; i += 1) {
  state = advanceTurn(state, runtimeRandom);
  expectedSequence.push(extractPlotMetrics(state));
}
const expectedFinalRng = getRuntimeRngState();

restoreGameFromEnvelope(save);
let replayState: GameState = getGame();
const replayStartRng = getRuntimeRngState();
assert(
  JSON.stringify(replayStartRng) === JSON.stringify(saveRng),
  '读档后 PRNG 状态恢复到第 6 月保存点',
);

const actualSequence: PlotMetrics[] = [];
for (let i = 0; i < 6; i += 1) {
  replayState = advanceTurn(replayState, runtimeRandom);
  actualSequence.push(extractPlotMetrics(replayState));
}
const actualFinalRng = getRuntimeRngState();

assert(
  JSON.stringify(actualSequence) === JSON.stringify(expectedSequence),
  '读档重放后 6 个月 AI 计谋决策序列完全一致（Plot 列表/ai_civil 日志）',
);
assert(
  JSON.stringify(actualFinalRng) === JSON.stringify(expectedFinalRng),
  '读档重放后 PRNG 状态最终一致（draws 计数相同）',
);

const totalPlots = expectedSequence.reduce((sum, s) => sum + s.plots.length, 0);
const totalPlaceholderLogs = expectedSequence.reduce((sum, s) => sum + s.aiPlaceholderLogs.length, 0);
assert(
  totalPlots > 0 || totalPlaceholderLogs > 0,
  `6 个月推进中应至少有一次 AI 计谋/内政决策发生（总 Plot 数 ${totalPlots}，总 ai_civil 日志 ${totalPlaceholderLogs}）`,
);

console.log(`AI decision plot verification passed: ${passed}/4`);
console.log(`  6 月决策序列：总 Plot 数 ${totalPlots}，总 ai_civil 日志 ${totalPlaceholderLogs}`);
