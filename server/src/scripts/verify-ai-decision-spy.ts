// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P3 Session B · 整场 AI 谍报决策复现验证
 *
 * 推进 N=12 个月，前 6 月建立基线 + 保存 envelope，后 6 月记录每月谍报决策
 * 可观察指标（Intel agents 列表 + cityDefense 驻防）。读档恢复到第 6 月 + PRNG
 * 状态，重新推进 6 月，断言决策序列完全一致 + PRNG draws 计数一致——证明
 * AI 谍报决策（俘虏处置/寻访/训练/任务类型/目标城市）在读档后完全可预测。
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

interface IntelMetrics {
  agents: Array<{ id: string; factionId: number; status: string; agentKind: string | undefined }>;
  cityDefense: Array<{ cityId: number; stationAgentId: string | null }>;
  courtNetworkOpportunities: Array<{ cityId: number; opportunities: number }>;
}

function extractIntelMetrics(state: GameState): IntelMetrics {
  const intel = state.intel ?? { agents: {}, cityDefense: {}, cities: {} };
  return {
    agents: Object.values(intel.agents ?? {}).map((a) => ({
      id: a.id,
      factionId: a.factionId,
      status: String(a.status),
      agentKind: a.agentKind,
    })),
    cityDefense: Object.entries(intel.cityDefense ?? {}).map(([cid, def]) => ({
      cityId: Number(cid),
      stationAgentId: def?.stationAgentId ?? null,
    })),
    courtNetworkOpportunities: Object.values(state.cities).map((c) => ({
      cityId: c.id,
      opportunities: c.courtNetworkOpportunities ?? 0,
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

const expectedSequence: IntelMetrics[] = [];
for (let i = 0; i < 6; i += 1) {
  state = advanceTurn(state, runtimeRandom);
  expectedSequence.push(extractIntelMetrics(state));
}
const expectedFinalRng = getRuntimeRngState();

restoreGameFromEnvelope(save);
let replayState: GameState = getGame();
const replayStartRng = getRuntimeRngState();
assert(
  JSON.stringify(replayStartRng) === JSON.stringify(saveRng),
  '读档后 PRNG 状态恢复到第 6 月保存点',
);

const actualSequence: IntelMetrics[] = [];
for (let i = 0; i < 6; i += 1) {
  replayState = advanceTurn(replayState, runtimeRandom);
  actualSequence.push(extractIntelMetrics(replayState));
}
const actualFinalRng = getRuntimeRngState();

assert(
  JSON.stringify(actualSequence) === JSON.stringify(expectedSequence),
  '读档重放后 6 个月 AI 谍报决策序列完全一致（agents/cityDefense/courtNetworkOpportunities）',
);
assert(
  JSON.stringify(actualFinalRng) === JSON.stringify(expectedFinalRng),
  '读档重放后 PRNG 状态最终一致（draws 计数相同）',
);

const totalAgents = expectedSequence.reduce((sum, s) => sum + s.agents.length, 0);
assert(
  totalAgents > 0,
  `6 个月推进中应至少有 AI 谍报 agent 存在（总 agent 数 ${totalAgents}）`,
);

console.log(`AI decision spy verification passed: ${passed}/4`);
console.log(`  6 月决策序列：总 agent 数 ${totalAgents}`);
