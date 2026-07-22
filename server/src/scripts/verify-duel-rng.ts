// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { CURRENT_SAVE_SCHEMA_VERSION, type SaveEnvelopeV1 } from '@leh/shared';
import { createDuel, DEFAULT_DUEL_CONFIG, runDuelToCompletion } from '../battle/duel.js';
import { getRuntimeRngState, runtimeRandom } from '../runtime-rng.js';
import { createGame, getGame, restoreGameFromEnvelope } from '../services/game.js';

let passed = 0;
const assert = (condition: unknown, message: string): void => {
  if (!condition) throw new Error(message);
  passed += 1;
};

createGame(1, 1);
const state = getGame();
const challenger = state.officers[6];
const defender = state.officers[13] ?? Object.values(state.officers).find((o) => o.id !== challenger?.id && o.stats.war >= 50);
if (!challenger || !defender) throw new Error('单挑确定性验证缺少合法武将');

const save: SaveEnvelopeV1 = {
  schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  createdAt: '2026-07-22T13:00:00.000Z',
  updatedAt: '2026-07-22T13:00:00.000Z',
  scenarioId: state.scenarioId,
  rng: getRuntimeRngState(),
  snapshot: state,
};

const first = createDuel('rng-duel', challenger, defender, DEFAULT_DUEL_CONFIG, runtimeRandom);
const expected = runDuelToCompletion(first, challenger, defender, DEFAULT_DUEL_CONFIG, runtimeRandom);
const consumed = getRuntimeRngState().draws - save.rng.draws;
assert(consumed > 0, '完整单挑必须消费权威随机流');

restoreGameFromEnvelope(save);
const restoredFirst = createDuel('rng-duel', challenger, defender, DEFAULT_DUEL_CONFIG, runtimeRandom);
const actual = runDuelToCompletion(restoredFirst, challenger, defender, DEFAULT_DUEL_CONFIG, runtimeRandom);
assert(JSON.stringify(actual) === JSON.stringify(expected), '读档后单挑指令、隐藏属性判定与专属触发必须完全一致');
assert(getRuntimeRngState().draws === save.rng.draws + consumed, '读档后单挑 RNG 消费次数必须一致');

console.log(`duel deterministic continuation verification passed: ${passed}/3`);
