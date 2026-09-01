// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 421 S2：委任区内政 AI（docs/04 §39 + docs/42 D6 内政半）。
 * 引擎级确定性验收：方针晋升/三规则病症驱动/效率折损/未委任城零影响/双局零 RNG。
 */
import {
  CivilPosition,
  DelegationPolicy,
  GameStateSchema,
  OfficerStatus,
  delegationEfficiency,
  delegationSeasonKey,
  type GameState,
} from '@leh/shared';
import {
  applyPendingPolicies,
  createDelegationRegion,
  runDelegationCivilTurns,
} from '../engine/delegation.js';
import { advanceTurn } from '../engine/turn.js';
import { createGame, getGame } from '../services/game.js';
import { resetRuntimeRng, runtimeRandom } from '../runtime-rng.js';

let pass = 0;
let fail = 0;
function assert(condition: boolean, message: string): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${message}`);
  } else {
    fail++;
    console.error(`  ✗ ${message}`);
  }
}

console.log('Delegation civil AI verify (S2)');

// ====== D4 效率公式 ======
assert(
  delegationEfficiency(70, 60, DelegationPolicy.BALANCED) === 0.6 + 0.07 + 0.06 + 0,
  'D4 效率 0.6+统/1000+政/1000+方针系数（balanced）',
);
assert(
  delegationEfficiency(90, 80, DelegationPolicy.OFFENSIVE) === 0.6 + 0.09 + 0.08 + 0.1,
  'D4 效率含方针系数（offensive +0.1）',
);

// ====== 布景：建一个两城发展区（含一座缺粮城触发三规则） ======
createGame(1, 1);
const base = getGame();
const faction = base.factions[base.playerFactionId];
const ownCities = Object.values(base.cities).filter((city) => city.ruler === base.playerFactionId);
const regionCityIds = ownCities.filter((city) => city.id !== faction.capitalCityId).slice(0, 2).map((city) => city.id);
const [cityA, cityB] = regionCityIds;
const candidates = Object.values(base.officers)
  .filter((officer) => officer.faction === base.playerFactionId && officer.id !== faction.rulerId)
  .sort((a, b) => a.id - b.id);
const governorId = candidates[0]!.id;
assert(candidates.length > 0 && regionCityIds.length === 2, '布景：候选都督与两座可划城');

function promoteGovernor(state: GameState, officerId: number, cityId: number): GameState {
  const officer = state.officers[officerId];
  const oldCityId = officer.location;
  const cities = { ...state.cities };
  if (oldCityId != null && cities[oldCityId]) {
    cities[oldCityId] = {
      ...cities[oldCityId]!,
      officers: cities[oldCityId]!.officers.filter((id) => id !== officerId),
    };
  }
  if (cities[cityId]) {
    cities[cityId] = {
      ...cities[cityId]!,
      officers: cities[cityId]!.officers.includes(officerId)
        ? cities[cityId]!.officers
        : [...cities[cityId]!.officers, officerId],
    };
  }
  return {
    ...state,
    cities,
    officers: {
      ...state.officers,
      [officerId]: {
        ...officer,
        status: OfficerStatus.ACTIVE,
        loyalty: 95,
        civilPosition: CivilPosition.GOVERNOR,
        location: cityId,
      },
    },
  };
}

let state: GameState = promoteGovernor(base, governorId, cityA);
state = createDelegationRegion(state, {
  cityIds: regionCityIds,
  governorId,
  policy: DelegationPolicy.DEVELOPMENT as DelegationPolicy,
});
const startFarm = state.cities[cityA]!.stats.farm;
assert(GameStateSchema.safeParse(state).success, '布景（建区）过完整 Schema');

// 触发缺粮：cityA 粮压到 troops×4 以下（三规则→farm）；cityB 喂饱走方针 fallback
const scarceA: GameState = {
  ...state,
  cities: {
    ...state.cities,
    [cityA]: { ...state.cities[cityA]!, food: state.cities[cityA]!.troops * 2 },
    [cityB]: { ...state.cities[cityB]!, food: Math.max(state.cities[cityB]!.food, state.cities[cityB]!.troops * 10), gold: Math.max(state.cities[cityB]!.gold, 2000), stats: { ...state.cities[cityB]!.stats, morale: 100 } },
  },
};
const scarceRun = runDelegationCivilTurns(scarceA);
assert(
  scarceRun.cities[cityA]!.stats.farm > startFarm,
  `缺粮城触发屯田规则（farm ${startFarm}→${scarceRun.cities[cityA]!.stats.farm}）`,
);
// 缺粮时三规则 farm：不征兵
assert(
  scarceRun.cities[cityA]!.troops === state.cities[cityA]!.troops,
  '缺粮月不征兵（三规则门禁）',
);
assert(
  scarceRun.cities[cityB]!.stats.farm > state.cities[cityB]!.stats.farm,
  '非缺粮城按发展方针垦田（fallback farm+6×eff）',
);
const gov = state.officers[governorId]!;
const devExpected = Math.floor(6 * delegationEfficiency(gov.stats.leadership, gov.stats.politics, DelegationPolicy.DEVELOPMENT));
assert(
  scarceRun.cities[cityB]!.stats.farm === Math.min(999, state.cities[cityB]!.stats.farm + devExpected),
  `发展方针精确：农业 +floor(6×eff)=${devExpected}（都督统${gov.stats.leadership}政${gov.stats.politics}；B 城非缺粮非低金非低民心走 fallback）`,
);
assert(GameStateSchema.safeParse(scarceRun).success, '委任内政后过完整 Schema');

// 未委任城不受影响
const untouched = Object.values(ownCities).find((city) => !regionCityIds.includes(city.id));
assert(
  untouched != null &&
    scarceRun.cities[untouched.id]!.stats.farm === state.cities[untouched.id]!.stats.farm &&
    scarceRun.cities[untouched.id]!.stats.commerce === state.cities[untouched.id]!.stats.commerce,
  '未委任城零影响',
);

// ====== D5 方针季度晋升 ======
const year = state.currentYear;
const month = state.currentMonth;
const sameKey: GameState = { ...state, currentMonth: month };
const switched = { ...sameKey, factions: { ...sameKey.factions, [sameKey.playerFactionId]: { ...sameKey.factions[sameKey.playerFactionId]!, delegationRegions: [{ ...(sameKey.factions[sameKey.playerFactionId]!.delegationRegions ?? [])[0]!, policy: DelegationPolicy.DEVELOPMENT as DelegationPolicy, pendingPolicy: DelegationPolicy.OFFENSIVE as DelegationPolicy, policyChangedSeasonKey: delegationSeasonKey(year, month) }] } } };
const sameQuarter = applyPendingPolicies(switched);
assert(
  sameQuarter.factions[sameQuarter.playerFactionId]!.delegationRegions![0]!.pendingPolicy != null,
  '同季不晋升（pendingPolicy 保留）',
);
const nextQuarter = applyPendingPolicies({ ...switched, currentMonth: month + 3 });
assert(
  nextQuarter.factions[nextQuarter.playerFactionId]!.delegationRegions![0]!.policy === DelegationPolicy.OFFENSIVE &&
    nextQuarter.factions[nextQuarter.playerFactionId]!.delegationRegions![0]!.pendingPolicy == null,
  '跨季后方针晋升且清空 pendingPolicy',
);

// ====== 双局 24 月零 RNG 确定性 ======
function run24(state0: GameState): GameState {
  let s = state0;
  for (let i = 0; i < 24; i++) {
    resetRuntimeRng(0x12345678);
    s = advanceTurn({ ...s, currentMonth: s.currentMonth }, runtimeRandom);
  }
  return s;
}
const runA = run24(state);
const runB = run24(state);
assert(
  JSON.stringify(runA.cities) === JSON.stringify(runB.cities) &&
    JSON.stringify(runA.factions) === JSON.stringify(runB.factions),
  '双局 24 月逐字节一致（委任内政零 RNG）',
);

// 委任区内政日志存在
assert(
  runA.actionLog.some((entry) => entry.type === 'deleg_civil'),
  '月结产生 deleg_civil 日志',
);
assert(
  runA.actionLog.some((entry) => entry.type === 'end_turn'),
  'end_turn 日志共存',
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
