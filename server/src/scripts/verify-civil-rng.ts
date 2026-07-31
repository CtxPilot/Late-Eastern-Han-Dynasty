// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { CURRENT_SAVE_SCHEMA_VERSION, type GameState, type SaveEnvelopeV1 } from '@leh/shared';
import { getRuntimeRngState } from '../runtime-rng.js';
import {
  createGame, doConscript, doRelief, doTrain, getGame, restoreGameFromEnvelope,
} from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function runCivilSequence(cityId: number) {
  const rolls: { action: string; gain: number; draws: number }[] = [];
  let before = getGame().cities[cityId]!;
  doConscript(cityId);
  let after = getGame().cities[cityId]!;
  rolls.push({ action: 'conscript', gain: after.troops - before.troops, draws: getRuntimeRngState().draws });
  before = after;
  doRelief(cityId);
  after = getGame().cities[cityId]!;
  rolls.push({ action: 'relief', gain: after.stats.morale - before.stats.morale, draws: getRuntimeRngState().draws });
  before = after;
  doTrain(cityId);
  after = getGame().cities[cityId]!;
  rolls.push({ action: 'train', gain: after.troopsMorale - before.troopsMorale, draws: getRuntimeRngState().draws });
  return rolls;
}

createGame(1, 1);
const initial = getGame();
const city = Object.values(initial.cities).find((candidate) => candidate.ruler === initial.playerFactionId);
if (!city) throw new Error('内政确定性验证缺少己方城市');
const prepared: GameState = {
  ...initial,
  cities: {
    ...initial.cities,
    [city.id]: {
      ...city,
      gold: Math.max(city.gold, 5_000),
      food: Math.max(city.food, 5_000),
      troops: Math.max(city.troops, 2_000),
      troopsMorale: 50,
      stats: { ...city.stats, morale: 50 },
    },
  },
};
const save: SaveEnvelopeV1 = {
  schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
  createdAt: '2026-07-22T14:00:00.000Z',
  updatedAt: '2026-07-22T14:00:00.000Z',
  scenarioId: prepared.scenarioId,
  rng: getRuntimeRngState(),
  snapshot: prepared,
};
restoreGameFromEnvelope(save);
const expected = runCivilSequence(city.id);
const expectedCity = getGame().cities[city.id];
const consumed = getRuntimeRngState().draws - save.rng.draws;
assert(expected[0]!.gain >= 300 && expected[0]!.gain <= 500, '征兵随机增益合法');
assert(expected[1]!.gain >= 8 && expected[1]!.gain <= 12, '施米随机增益合法');
assert(expected[2]!.gain >= 5 && expected[2]!.gain <= 10, '训练随机增益合法');
assert(consumed === 3, '三条即时路径各消费一次权威随机数');
restoreGameFromEnvelope(save);
const actual = runCivilSequence(city.id);
assert(JSON.stringify(actual) === JSON.stringify(expected), '读档后即时内政随机序列一致');
assert(JSON.stringify(getGame().cities[city.id]) === JSON.stringify(expectedCity), '读档后最终城市一致');
assert(getRuntimeRngState().draws === save.rng.draws + consumed, 'RNG消费计数一致');
assert(actual.every((roll, index) => roll.draws === save.rng.draws + index + 1), 'RNG顺序一致');
assert(actual.length === 3, '持续开发退出随机即时链');
console.log(`civil deterministic continuation verification passed: ${passed}/9`);
