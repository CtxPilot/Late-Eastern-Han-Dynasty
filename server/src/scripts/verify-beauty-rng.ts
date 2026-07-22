// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  OfficerStatus,
  SerializableRng,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { lootBeautyOnCapture, rewardBeautyStock } from '../engine/beauty.js';
import { getRuntimeRngState, resetRuntimeRng, runtimeRandom } from '../runtime-rng.js';
import {
  createGame,
  doSeekBeauty,
  getGame,
  restoreGameFromEnvelope,
} from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function findSeed(predicate: (values: number[]) => boolean, drawCount: number): number {
  for (let seed = 1; seed < 100_000; seed += 1) {
    const rng = new SerializableRng(seed);
    const values = Array.from({ length: drawCount }, () => rng.next());
    if (predicate(values)) return seed;
  }
  throw new Error('未找到满足美女资源随机夹具的种子');
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-22T20:00:00.000Z',
    updatedAt: '2026-07-22T20:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function verifyRoundTrip(
  save: SaveEnvelopeV1,
  run: () => GameState,
  label: string,
  expectedDraws: number,
): GameState {
  restoreGameFromEnvelope(save);
  const expected = run();
  assert(getRuntimeRngState().draws === save.rng.draws + expectedDraws, `${label}首次消费次数错误`);

  restoreGameFromEnvelope(save);
  const actual = run();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}读档后的完整结果必须一致`);
  assert(getRuntimeRngState().draws === save.rng.draws + expectedDraws, `${label}读档后的消费次数必须一致`);
  return actual;
}

createGame(1, 1);
const initial = getGame();
const playerFaction = initial.factions[initial.playerFactionId];
const ownedCity = Object.values(initial.cities).find((city) => city.ruler === playerFaction.id);
const targetCity = Object.values(initial.cities).find((city) => city.ruler !== playerFaction.id);
const activeOfficer = Object.values(initial.officers).find(
  (officer) => officer.faction === playerFaction.id && officer.status === OfficerStatus.ACTIVE,
);
if (!ownedCity || !targetCity || !activeOfficer) throw new Error('S09 确定性验证缺少城市或己方武将');

const seekState: GameState = {
  ...initial,
  cities: {
    ...initial.cities,
    [ownedCity.id]: { ...ownedCity, gold: 10_000, beautySeekLeft: 5 },
  },
};

resetRuntimeRng(findSeed(([roll]) => roll < 0.01, 1));
const seekSuccessSave = envelopeFor(seekState);
const seekSuccess = verifyRoundTrip(
  seekSuccessSave,
  () => doSeekBeauty(ownedCity.id),
  '寻访成功',
  1,
);
assert(seekSuccess.factions[playerFaction.id].beautyStock === (playerFaction.beautyStock ?? 0) + 1, '寻访成功必须增加库存');
assert(seekSuccess.cities[ownedCity.id].beautySeekLeft === 4, '寻访成功必须扣除一次可寻次数');

resetRuntimeRng(findSeed(([roll]) => roll > 0.99, 1));
const seekFailSave = envelopeFor(seekState);
const seekFail = verifyRoundTrip(seekFailSave, () => doSeekBeauty(ownedCity.id), '寻访失败', 1);
assert(seekFail.factions[playerFaction.id].beautyStock === (playerFaction.beautyStock ?? 0), '寻访失败不得增加库存');
assert(seekFail.cities[ownedCity.id].beautySeekLeft === 5, '寻访失败不得扣除可寻次数');

const lootState: GameState = {
  ...initial,
  cities: {
    ...initial.cities,
    [targetCity.id]: { ...targetCity, beautySeekLeft: 10 },
  },
};
resetRuntimeRng(0x09_0001);
const lootSave = envelopeFor(lootState);
const loot = verifyRoundTrip(
  lootSave,
  () => lootBeautyOnCapture(getGame(), targetCity.id, playerFaction.id, runtimeRandom),
  '占城抢夺',
  2,
);
const gained = (loot.factions[playerFaction.id].beautyStock ?? 0) - (playerFaction.beautyStock ?? 0);
assert(gained >= 2 && gained <= 4, '占城抢夺库存增量必须位于 2~4');
assert(loot.cities[targetCity.id].beautySeekLeft === 10 - gained, '抢夺所得与城市可寻次数扣减必须一致');
assert(loot.cities[targetCity.id].stats.morale < targetCity.stats.morale, '抢夺必须降低民忠');

const emptyLootState: GameState = {
  ...initial,
  cities: {
    ...initial.cities,
    [targetCity.id]: { ...targetCity, beautySeekLeft: 0 },
  },
};
resetRuntimeRng(0x09_0002);
const emptyLootSave = envelopeFor(emptyLootState);
const emptyLoot = verifyRoundTrip(
  emptyLootSave,
  () => lootBeautyOnCapture(getGame(), targetCity.id, playerFaction.id, runtimeRandom),
  '无可寻资源占城',
  0,
);
assert(emptyLoot.cities[targetCity.id].stats.morale < targetCity.stats.morale, '无库存可抢时仍应保留劫掠民忠损失');

const rewardState: GameState = {
  ...initial,
  factions: {
    ...initial.factions,
    [playerFaction.id]: { ...playerFaction, beautyStock: 3 },
  },
  officers: {
    ...initial.officers,
    [activeOfficer.id]: { ...activeOfficer, loyalty: 50 },
  },
};
resetRuntimeRng(0x09_0003);
const rewardSave = envelopeFor(rewardState);
const reward = verifyRoundTrip(
  rewardSave,
  () => rewardBeautyStock(getGame(), activeOfficer.id, 2),
  '赏赐库存',
  0,
);
assert(reward.factions[playerFaction.id].beautyStock === 1, '赏赐必须按指定数量扣库存');
assert(reward.officers[activeOfficer.id].loyalty > 50, '赏赐必须确定性增加忠诚');

console.log(`beauty deterministic continuation verification passed: ${passed}/25`);
