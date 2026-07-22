// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  Ideal,
  MaritalStatus,
  OfficerStatus,
  SerializableRng,
  canMarchAlongRoad,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { tickChildrenAppear } from '../engine/child.js';
import { marryFemale } from '../engine/personnel.js';
import { getRuntimeRngState, resetRuntimeRng } from '../runtime-rng.js';
import {
  createGame,
  doFollowCheck,
  doJoinFaction,
  getGame,
  restoreGameFromEnvelope,
} from '../services/game.js';
import { getStaticData } from '../data/loader.js';

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
  throw new Error('未找到满足家族随机夹具的种子');
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-22T18:00:00.000Z',
    updatedAt: '2026-07-22T18:00:00.000Z',
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
const ruler = initial.officers[playerFaction.rulerId];
const ownedCity = Object.values(initial.cities).find((city) => city.ruler === playerFaction.id);
const adjacentCity = ownedCity && Object.values(initial.cities).find(
  (city) => city.id !== ownedCity.id && canMarchAlongRoad(ownedCity.id, city.id),
);
const candidate = Object.values(initial.officers).find(
  (officer) => officer.id !== ruler.id && !Object.values(initial.factions).some((faction) => faction.rulerId === officer.id),
);
if (!ownedCity || !adjacentCity || !candidate) throw new Error('家族确定性验证缺少城市或候选武将');
const testOwnedCity = ownedCity;
const testAdjacentCity = adjacentCity;
const testCandidate = candidate as GameState['officers'][number];

function followState(mode: 'compatibility' | 'benevolence' | 'bloodline' | 'all'): GameState {
  const candidateIdeal = mode === 'benevolence' || mode === 'all' ? Ideal.BENEVOLENCE : Ideal.FAME;
  const rulerIdeal = mode === 'benevolence' || mode === 'all' ? Ideal.BENEVOLENCE : Ideal.HEGEMONY;
  const candidateCompatibility = mode === 'compatibility' || mode === 'all'
    ? ruler.hidden.compatibility
    : (ruler.hidden.compatibility + 40) % 150;
  const bloodline = mode === 'bloodline' || mode === 'all' ? [ruler.id] : [];
  return {
    ...initial,
    factions: Object.fromEntries(Object.entries(initial.factions).map(([id, faction]) => [
      id,
      { ...faction, isAlive: faction.id === playerFaction.id, officerIds: faction.officerIds.filter((x) => x !== testCandidate.id) },
    ])) as GameState['factions'],
    cities: Object.fromEntries(Object.entries(initial.cities).map(([id, city]) => [
      id,
      { ...city, officers: city.officers.filter((x) => x !== testCandidate.id) },
    ])) as GameState['cities'],
    officers: {
      ...initial.officers,
      [ruler.id]: { ...ruler, hidden: { ...ruler.hidden, ideal: rulerIdeal } },
      [testCandidate.id]: {
        ...testCandidate,
        faction: null,
        location: testAdjacentCity.id,
        loyalty: 0,
        status: OfficerStatus.FREE,
        hidden: {
          ...testCandidate.hidden,
          compatibility: candidateCompatibility,
          ideal: candidateIdeal,
          bloodline,
        },
      },
    },
  };
}

for (const [mode, rate, reason] of [
  ['compatibility', 0.2, '相性相近'],
  ['benevolence', 0.4, '理想一致'],
  ['bloodline', 0.5, '血亲召唤'],
] as const) {
  resetRuntimeRng(findSeed(([roll]) => roll < rate, 1));
  const save = envelopeFor(followState(mode));
  const result = verifyRoundTrip(save, doFollowCheck, `在野跟随-${reason}`, 1);
  assert(result.officers[testCandidate.id].faction === playerFaction.id, `${reason}路径必须投奔目标势力`);
  assert(result.actionLog[0]?.message.includes(reason) === true, `${reason}路径必须留下可解释日志`);
}

resetRuntimeRng(findSeed((rolls) => rolls.every((roll) => roll >= 0.5), 3));
const failedSave = envelopeFor(followState('all'));
const failed = verifyRoundTrip(failedSave, doFollowCheck, '在野跟随-三重失败', 3);
assert(failed.officers[testCandidate.id].faction == null, '三重失败后武将必须保持在野');

resetRuntimeRng(0x18_0001);
const directState = followState('compatibility');
const directSave = envelopeFor(directState);
const joined = verifyRoundTrip(
  directSave,
  () => doJoinFaction(testCandidate.id, playerFaction.id, testOwnedCity.id),
  '直接加入默认忠诚',
  1,
);
assert(joined.officers[testCandidate.id].loyalty >= 50 && joined.officers[testCandidate.id].loyalty <= 69, '默认忠诚必须由权威随机流生成 50~69');

const singleFemale = Object.values(initial.females).find(
  (female) => female.status === MaritalStatus.SINGLE || female.status === MaritalStatus.WIDOW,
);
const husband = Object.values(initial.officers).find(
  (officer) => officer.faction === playerFaction.id && officer.status === OfficerStatus.ACTIVE && officer.wifeId == null,
);
if (!singleFemale || !husband) throw new Error('家族确定性验证缺少可婚配对象');
if (husband.location == null) throw new Error('家族确定性验证的婚配对象缺少所在城市');
const testFemale = singleFemale as GameState['females'][number];
const testHusband = husband as GameState['officers'][number];
const marriageCityId = husband.location;
const marriageState: GameState = {
  ...initial,
  cities: {
    ...initial.cities,
    [marriageCityId]: { ...initial.cities[marriageCityId], gold: 10_000 },
  },
  females: {
    ...initial.females,
    [testFemale.id]: { ...testFemale, factionId: playerFaction.id, locationId: marriageCityId },
  },
};
resetRuntimeRng(0x18_0002);
const marriageSave = envelopeFor(marriageState);
restoreGameFromEnvelope(marriageSave);
const expectedMarriage = marryFemale(getGame(), testFemale.id, testHusband.id);
restoreGameFromEnvelope(marriageSave);
const married = marryFemale(getGame(), testFemale.id, testHusband.id);
assert(married.females[testFemale.id].husbandId === testHusband.id, '确定性赐婚必须建立夫妻关系');
assert(JSON.stringify(married) === JSON.stringify(expectedMarriage), '确定性赐婚读档后的结果必须一致');
assert(getRuntimeRngState().draws === marriageSave.rng.draws, '当前婚配没有成功率判定，不得消费随机数');

const childDef = getStaticData().children[0];
if (!childDef) throw new Error('家族确定性验证缺少子女定义');
const childState: GameState = {
  ...married,
  currentYear: childDef.appearYear,
  currentMonth: 1,
  enabledChildEventIds: [childDef.childId],
  officers: Object.fromEntries(Object.entries(married.officers).filter(([id]) => Number(id) !== childDef.childId)) as GameState['officers'],
};
resetRuntimeRng(0x18_0003);
const childSave = envelopeFor(childState);
restoreGameFromEnvelope(childSave);
const expectedChildResult = tickChildrenAppear(getGame(), [childDef]);
restoreGameFromEnvelope(childSave);
const childResult = tickChildrenAppear(getGame(), [childDef]);
assert(childResult.officers[childDef.childId]?.name === childDef.childName, '固定子女必须按登场年入库');
assert(JSON.stringify(childResult) === JSON.stringify(expectedChildResult), '固定子女读档后的登场结果必须一致');
assert(getRuntimeRngState().draws === childSave.rng.draws, '当前史实子女的出生、性别和属性均预定义，不得消费随机数');

const zhurongFemale = Object.values(initial.females).find((female) => female.name === '祝融');
const zhurongOfficer = getStaticData().officers.find((officer) => officer.name === '祝融');
assert(zhurongFemale?.canCommand === true, '祝融女角必须保留唯一可统兵标记');
assert(zhurongOfficer != null, '祝融必须存在于武将数据以支持出战特例');
assert(getRuntimeRngState().draws === childSave.rng.draws, '祝融特例是静态权限，不得消费随机数');

console.log(`family deterministic continuation verification passed: ${passed}/32`);
