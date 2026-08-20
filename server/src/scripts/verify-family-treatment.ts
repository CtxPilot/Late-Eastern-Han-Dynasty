// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 351：家属质任处置规则与季度余波冒烟。 */
import {
  FAMILY_CAPTURE_MORALE_HIT,
  FAMILY_KINDNESS_CITY_MORALE,
  FAMILY_KINDNESS_MORALE_PER_QUARTER,
  FAMILY_REPRESSION_CITY_MORALE,
  GameStateSchema,
  buildPendingFamilyTreatment,
  familyRepressionAttackMultiplier,
  familyTreatmentRevoltMultiplier,
  type GameState,
} from '@leh/shared';
import { resolveFamilyTreatment, tickFamilyTreatment } from '../engine/hostageFamilies.js';
import { createGame, getGame } from '../services/game.js';

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

console.log('Family treatment verify');
createGame(1, 1);
const base = getGame();
const playerCity = Object.values(base.cities).find((city) => city.ruler === base.playerFactionId);
const enemyCity = Object.values(base.cities).find(
  (city) => city.ruler != null && city.ruler !== base.playerFactionId,
);
assert(!!playerCity && !!enemyCity, '找到玩家城与旧主城');
if (!playerCity || !enemyCity) process.exit(1);

const previousFactionId = enemyCity.ruler!;
const prepared: GameState = {
  ...base,
  currentYear: 190,
  currentMonth: 1,
  pendingFamilyTreatment: {
    cityId: playerCity.id,
    previousFactionId,
    familyCount: 24,
    affectedCityIds: [enemyCity.id],
  },
  cities: {
    ...base.cities,
    [playerCity.id]: {
      ...playerCity,
      stats: { ...playerCity.stats, morale: 70 },
    },
    [enemyCity.id]: {
      ...enemyCity,
      troopsMorale: 70,
    },
  },
};
assert(GameStateSchema.safeParse(prepared).success, '待决家属处置状态通过完整存档 Schema');

const pendingFromFamilies = buildPendingFamilyTreatment(
  {
    ...prepared,
    pendingFamilyTreatment: null,
    cities: {
      ...prepared.cities,
      [enemyCity.id]: { ...prepared.cities[enemyCity.id]!, garrisonFamilies: 24 },
    },
  },
  enemyCity.id,
  previousFactionId,
);
assert(pendingFromFamilies?.familyCount === 24, '按实际家属数量生成待决项');
assert(pendingFromFamilies?.affectedCityIds.includes(enemyCity.id) === false, '失陷城本身不重复计入受冲击城清单');

const kindness = resolveFamilyTreatment(prepared, 'kindness');
assert(kindness.pendingFamilyTreatment === null, '善待后清除待决项');
assert(kindness.cities[playerCity.id]!.stats.morale === 70 + FAMILY_KINDNESS_CITY_MORALE, '善待使新占城民心 +10');
assert(kindness.cities[playerCity.id]!.familyTreatment?.expiresQuarter === 763, '善待余波持续三季');
assert(familyTreatmentRevoltMultiplier('kindness') === 0.7, '善待叛乱倍率 ×0.7');

const quarterOne = tickFamilyTreatment({
  ...kindness,
  currentMonth: 4,
});
assert(quarterOne.cities[enemyCity.id]!.troopsMorale === 70 - FAMILY_KINDNESS_MORALE_PER_QUARTER, '善待第一季使旧主驻军士气 −5');
const quarterTwo = tickFamilyTreatment({ ...quarterOne, currentMonth: 7 });
const quarterThree = tickFamilyTreatment({ ...quarterTwo, currentMonth: 10 });
assert(quarterThree.cities[enemyCity.id]!.troopsMorale === 70 - FAMILY_KINDNESS_MORALE_PER_QUARTER * 3, '善待三季余波累计 −15');
const expired = tickFamilyTreatment({ ...quarterThree, currentYear: 191, currentMonth: 1 });
assert(expired.cities[playerCity.id]!.familyTreatment == null, '三季后清除善待状态');

const repression = resolveFamilyTreatment(prepared, 'repression');
assert(repression.cities[playerCity.id]!.stats.morale === 70 - FAMILY_REPRESSION_CITY_MORALE, '镇压使新占城民心 −20');
assert(familyRepressionAttackMultiplier(repression.cities[playerCity.id], previousFactionId) === 1.1, '镇压使旧主攻城战力 ×1.1');
assert(familyTreatmentRevoltMultiplier('repression') === 1.5, '镇压叛乱倍率 ×1.5');
assert(FAMILY_CAPTURE_MORALE_HIT === 40, '失陷基础士气冲击保持 −40');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
