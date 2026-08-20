// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  relationPairKey,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
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
const officerId = city.officers[0];
if (officerId == null) throw new Error('内政确定性验证缺少城主');
const playerFaction = initial.factions[initial.playerFactionId];
if (!playerFaction) throw new Error('内政确定性验证缺少玩家势力');

// 这里只测 RNG 序列，隔离已接入的 S25-S27 内政效率、人心与技能加成。
// 把玩家城市、武将与运行时亲和统一到无修正区间，避免合法随机范围随静态
// 剧本规模/关系数据漂移；同时保留原势力清单，令读档 Schema 仍是完整闭环。
const playerCityIds = new Set(playerFaction.cityIds);
const playerOfficerIds = new Set(playerFaction.officerIds);
const relationAffinities = { ...(initial.relationAffinities ?? {}) };
for (let i = 0; i < playerFaction.officerIds.length; i += 1) {
  for (let j = i + 1; j < playerFaction.officerIds.length; j += 1) {
    relationAffinities[relationPairKey(playerFaction.officerIds[i]!, playerFaction.officerIds[j]!)] = 0;
  }
}
const prepared: GameState = {
  ...initial,
  cities: Object.fromEntries(Object.values(initial.cities).map((candidate) => {
    if (!playerCityIds.has(candidate.id)) return [candidate.id, candidate];
    return [candidate.id, {
      ...candidate,
      stats: { ...candidate.stats, farm: 0, morale: 20 },
      ...(candidate.id === city.id
        ? {
          gold: Math.max(candidate.gold, 5_000),
          food: Math.max(candidate.food, 5_000),
          troops: Math.max(candidate.troops, 2_000),
          troopsMorale: 50,
        }
        : {}),
    }];
  })),
  officers: Object.fromEntries(Object.values(initial.officers).map((officer) => [
    officer.id,
    playerOfficerIds.has(officer.id)
      ? {
        ...officer,
        loyalty: 100,
        skills: [],
        merit: 0,
        meritPath: 'neutral',
      }
      : officer,
  ])),
  relationAffinities,
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
