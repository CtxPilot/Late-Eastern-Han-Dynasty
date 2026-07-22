// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { getRuntimeRngState } from '../runtime-rng.js';
import {
  createGame,
  doConscript,
  doDevelop,
  doDevelopFarm,
  doRelief,
  doTrain,
  getGame,
  restoreGameFromEnvelope,
} from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

interface CivilRoll {
  action: 'farm' | 'commerce' | 'wall' | 'conscript' | 'relief' | 'train';
  gain: number;
  draws: number;
}

function runCivilSequence(cityId: number): CivilRoll[] {
  const rolls: CivilRoll[] = [];
  let before = getGame().cities[cityId];

  doDevelopFarm(cityId);
  let after = getGame().cities[cityId];
  rolls.push({ action: 'farm', gain: after.stats.farm - before.stats.farm, draws: getRuntimeRngState().draws });

  before = after;
  doDevelop(cityId, 'commerce');
  after = getGame().cities[cityId];
  rolls.push({ action: 'commerce', gain: after.stats.commerce - before.stats.commerce, draws: getRuntimeRngState().draws });

  before = after;
  doDevelop(cityId, 'wall');
  after = getGame().cities[cityId];
  rolls.push({ action: 'wall', gain: after.stats.wall - before.stats.wall, draws: getRuntimeRngState().draws });

  before = after;
  doConscript(cityId);
  after = getGame().cities[cityId];
  rolls.push({ action: 'conscript', gain: after.troops - before.troops, draws: getRuntimeRngState().draws });

  before = after;
  doRelief(cityId);
  after = getGame().cities[cityId];
  rolls.push({ action: 'relief', gain: (after.stats.morale ?? 0) - (before.stats.morale ?? 0), draws: getRuntimeRngState().draws });

  before = after;
  doTrain(cityId);
  after = getGame().cities[cityId];
  rolls.push({ action: 'train', gain: (after.troopsMorale ?? 0) - (before.troopsMorale ?? 0), draws: getRuntimeRngState().draws });

  return rolls;
}

createGame(1, 1);
const initial = getGame();
const city = Object.values(initial.cities).find((candidate) => candidate.ruler === initial.playerFactionId);
if (!city) throw new Error('内政确定性验证缺少己方城市');

const preparedCity = {
  ...city,
  gold: Math.max(city.gold, 5_000),
  food: Math.max(city.food, 5_000),
  troops: Math.max(city.troops, 2_000),
  troopsMorale: 50,
  stats: {
    ...city.stats,
    farm: 100,
    commerce: 100,
    wall: 100,
    morale: 50,
  },
};
const prepared: GameState = {
  ...initial,
  cities: { ...initial.cities, [city.id]: preparedCity },
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

assert(expected[0]?.gain >= 20 && expected[0].gain <= 30, '农业开发应覆盖 20~30 的权威随机增益');
assert(expected[1]?.gain >= 18 && expected[1].gain <= 28, '商业开发应覆盖 18~28 的权威随机增益');
assert(expected[2]?.gain >= 15 && expected[2].gain <= 25, '城防开发应覆盖 15~25 的权威随机增益');
assert(expected[3]?.gain >= 300 && expected[3].gain <= 500, '征兵应消费权威随机流并获得合法兵力');
assert(expected[4]?.gain >= 8 && expected[4].gain <= 12, '施米应覆盖 8~12 的权威随机增益');
assert(expected[5]?.gain >= 5 && expected[5].gain <= 10, '训练应覆盖 5~10 的权威随机增益');
assert(expected.length === 6, '现有 S03 六条随机路径必须全部执行');
assert(consumed === 6, '现有 S03 六条随机路径应各消费一次权威随机数');

restoreGameFromEnvelope(save);
const actual = runCivilSequence(city.id);
const actualCity = getGame().cities[city.id];
assert(JSON.stringify(actual) === JSON.stringify(expected), '读档后六条内政随机结果序列必须完全一致');
assert(JSON.stringify(actualCity) === JSON.stringify(expectedCity), '读档后内政最终城市状态必须完全一致');
assert(getRuntimeRngState().draws === save.rng.draws + consumed, '读档后内政 RNG 消费次数必须一致');
assert(actual.every((roll, index) => roll.draws === save.rng.draws + index + 1), '每条内政指令必须按固定顺序消费单一权威随机流');

console.log(`civil deterministic continuation verification passed: ${passed}/12`);
