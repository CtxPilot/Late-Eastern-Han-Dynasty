// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  MilitaryPosition,
  OfficerStatus,
  SerializableRng,
  canMarchAlongRoad,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { calcRecruitChance, listFreeOfficers } from '../engine/personnel.js';
import { getRuntimeRngState, resetRuntimeRng } from '../runtime-rng.js';
import {
  createGame,
  doAppoint,
  doRecruitOfficer,
  doSearchTalent,
  getGame,
  restoreGameFromEnvelope,
} from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function findSeed(predicate: (values: number[]) => boolean, drawCount = 3): number {
  for (let seed = 1; seed < 100_000; seed += 1) {
    const rng = new SerializableRng(seed);
    const values = Array.from({ length: drawCount }, () => rng.next());
    if (predicate(values)) return seed;
  }
  throw new Error('未找到满足人事随机夹具的种子');
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-22T16:00:00.000Z',
    updatedAt: '2026-07-22T16:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function verifyRoundTrip(
  save: SaveEnvelopeV1,
  run: () => GameState,
  label: string,
): { result: GameState; consumed: number } {
  restoreGameFromEnvelope(save);
  const expected = run();
  const consumed = getRuntimeRngState().draws - save.rng.draws;
  assert(consumed > 0, `${label}必须消费权威随机流`);

  restoreGameFromEnvelope(save);
  const actual = run();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}读档后的完整结果必须一致`);
  assert(getRuntimeRngState().draws === save.rng.draws + consumed, `${label}读档后的 RNG 消费次数必须一致`);
  return { result: actual, consumed };
}

createGame(1, 1);
const initial = getGame();
const city = Object.values(initial.cities).find((candidate) => candidate.ruler === initial.playerFactionId);
const existingFree = listFreeOfficers(initial)[0];
const target = existingFree ?? Object.values(initial.officers).find(
  (officer) =>
    officer.faction !== initial.playerFactionId &&
    officer.status === OfficerStatus.ACTIVE &&
    initial.factions[officer.faction ?? -1]?.rulerId !== officer.id,
);
if (!city || !target) throw new Error('人事确定性验证缺少己方城市或在野武将');

const searcher = Object.values(initial.officers)
  .filter((officer) => officer.faction === initial.playerFactionId && officer.status === OfficerStatus.ACTIVE)
  .sort((a, b) => b.stats.intelligence + b.stats.charisma - a.stats.intelligence - a.stats.charisma)[0];
if (!searcher) throw new Error('人事确定性验证缺少搜索者');
const searchRate = Math.max(0.15, Math.min(0.85, searcher.stats.intelligence / 150 + searcher.stats.charisma / 200));

const prepared: GameState = {
  ...initial,
  cities: Object.fromEntries(
    Object.entries(initial.cities).map(([id, candidate]) => [
      id,
      candidate.id === city.id
        ? { ...candidate, gold: 10_000, food: 10_000, officers: candidate.officers.filter((officerId) => officerId !== target.id) }
        : { ...candidate, officers: candidate.officers.filter((officerId) => officerId !== target.id) },
    ]),
  ) as GameState['cities'],
  factions: Object.fromEntries(
    Object.entries(initial.factions).map(([id, faction]) => [
      id,
      { ...faction, officerIds: faction.officerIds.filter((officerId) => officerId !== target.id) },
    ]),
  ) as GameState['factions'],
  officers: {
    ...initial.officers,
    [target.id]: {
      ...target,
      faction: null,
      status: OfficerStatus.FREE,
      location: city.id,
    },
  },
};

resetRuntimeRng(findSeed(([success, result]) => success <= searchRate && result < 0.7));
const found = verifyRoundTrip(envelopeFor(prepared), () => doSearchTalent(city.id), '搜索发现武将');
assert(found.result.actionLog[0]?.message.includes('寻得在野') === true, '搜索必须覆盖发现武将路径');
assert(found.consumed === 3, '发现武将路径应固定消费判定、结果与候选选择三次随机数');

resetRuntimeRng(findSeed(([success]) => success > searchRate, 1));
const missed = verifyRoundTrip(envelopeFor(prepared), () => doSearchTalent(city.id), '搜索失败');
assert(missed.result.actionLog[0]?.message.includes('搜索无果') === true, '搜索必须覆盖失败路径');
assert(missed.consumed === 1, '搜索失败路径应只消费一次成功率判定');

const remoteCity = Object.values(prepared.cities).find(
  (candidate) => candidate.id !== city.id && !canMarchAlongRoad(candidate.id, city.id),
);
if (!remoteCity) throw new Error('人事确定性验证缺少非邻接城市');
const noFreeOfficers = Object.fromEntries(
  Object.entries(prepared.officers).map(([id, officer]) => [
    id,
    officer.status === OfficerStatus.FREE ? { ...officer, location: remoteCity.id } : officer,
  ]),
) as GameState['officers'];
const noFree: GameState = { ...prepared, officers: noFreeOfficers };

resetRuntimeRng(findSeed(([success, result]) => success <= searchRate && result >= 0.15 && result < 0.35));
const gold = verifyRoundTrip(envelopeFor(noFree), () => doSearchTalent(city.id), '搜索资财');
assert(gold.result.actionLog[0]?.message.includes('搜得资财') === true, '搜索必须覆盖随机资财路径');
assert(gold.consumed === 3, '搜索资财路径应固定消费三次随机数');

resetRuntimeRng(findSeed(([success, result]) => success <= searchRate && result >= 0.35 && result < 0.5));
const food = verifyRoundTrip(envelopeFor(noFree), () => doSearchTalent(city.id), '搜索粮草');
assert(food.result.actionLog[0]?.message.includes('搜得粮草') === true, '搜索必须覆盖随机粮草路径');
assert(food.consumed === 3, '搜索粮草路径应固定消费三次随机数');

const recruiter = prepared.officers[prepared.factions[prepared.playerFactionId].rulerId];
if (!recruiter) throw new Error('人事确定性验证缺少君主说客');
const recruitChance = calcRecruitChance(recruiter, prepared.officers[target.id]);

resetRuntimeRng(findSeed(([roll]) => roll * 100 < recruitChance, 1));
const recruited = verifyRoundTrip(
  envelopeFor(prepared),
  () => doRecruitOfficer(target.id, recruiter.id),
  '登用成功',
);
assert(recruited.result.officers[target.id].faction === prepared.playerFactionId, '登用必须覆盖成功入势力路径');
assert(recruited.consumed === 1, '登用成功路径应只消费一次成功率判定');

resetRuntimeRng(findSeed(([roll]) => roll * 100 >= recruitChance, 1));
const rejected = verifyRoundTrip(
  envelopeFor(prepared),
  () => doRecruitOfficer(target.id, recruiter.id),
  '登用失败',
);
assert(rejected.result.officers[target.id].faction == null, '登用必须覆盖失败留在野路径');
assert(rejected.consumed === 1, '登用失败路径应只消费一次成功率判定');

const appointee = Object.values(prepared.officers).find(
  (officer) =>
    officer.faction === prepared.playerFactionId &&
    officer.status === OfficerStatus.ACTIVE &&
    officer.militaryPosition !== MilitaryPosition.CAPTAIN &&
    officer.stats.leadership >= 30 &&
    officer.stats.war >= 30,
);
if (!appointee) throw new Error('人事确定性验证缺少可任军候武将');
resetRuntimeRng(0x11_0001);
const appointSave = envelopeFor(prepared);
restoreGameFromEnvelope(appointSave);
const appointed = doAppoint(appointee.id, 'military', MilitaryPosition.CAPTAIN);
assert(appointed.officers[appointee.id].militaryPosition === MilitaryPosition.CAPTAIN, '任命确定路径必须可正常完成');
assert(getRuntimeRngState().draws === appointSave.rng.draws, '现有任命流程不得消费随机数');

console.log(`personnel deterministic continuation verification passed: ${passed}/32`);
