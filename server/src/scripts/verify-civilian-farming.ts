// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 主线③ · 民屯田月结冒烟（Session 339）
 * 运行: pnpm verify-civilian-farming
 */
import {
  Season,
  civilianFarmingFoodProduced,
  maxCivilianFarmingHouseholds,
  quarterKey,
} from '@leh/shared';
import { setCivilianFarming } from '../engine/civil.js';
import { settleCityMonthDetailed } from '../engine/turn.js';
import { createGame, getGame } from '../services/game.js';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log('Civilian farming verify');

createGame(1, 1);
let state = getGame();
const city = Object.values(state.cities).find((c) => c.ruler === state.playerFactionId);
assert(!!city, '存在己方城');
if (!city) {
  process.exit(1);
}

const max = maxCivilianFarmingHouseholds(city);
assert(max > 0, `民屯上限 > 0（${max}）`);

const assign = Math.min(500, max);
state = setCivilianFarming(state, city.id, assign);
const assigned = state.cities[city.id]!;
assert((assigned.civilianFarmingHouseholds ?? 0) === assign, `分配 ${assign} 户`);
assert(
  assigned.civilianFarmingAssignQuarter === quarterKey(state.currentYear, state.currentMonth),
  '写入季度戳',
);

let blocked = false;
try {
  setCivilianFarming(state, city.id, Math.max(0, assign - 1));
} catch {
  blocked = true;
}
assert(blocked, '同季二次调整被拒绝');

const expectedExtra = civilianFarmingFoodProduced(assign, state.season, city.province);
// 将 farm 归零以隔离民屯产粮（劳力扣减会间接影响农产）
const baselineCity = {
  ...assigned,
  civilianFarmingHouseholds: 0,
  stats: { ...assigned.stats, farm: 0 },
};
const withFarmCity = {
  ...assigned,
  stats: { ...assigned.stats, farm: 0 },
};
const baseSettle = settleCityMonthDetailed(baselineCity, state.season as Season);
const farmSettle = settleCityMonthDetailed(withFarmCity, state.season as Season);
const delta = farmSettle.city.food - baseSettle.city.food;
assert(delta === expectedExtra, `月结民屯产粮差 = ${expectedExtra}（实际 ${delta}）`);

state = setCivilianFarming(
  {
    ...state,
    currentMonth: state.currentMonth >= 10 ? 1 : state.currentMonth + 3,
    currentYear: state.currentMonth >= 10 ? state.currentYear + 1 : state.currentYear,
  },
  city.id,
  0,
);
assert((state.cities[city.id]!.civilianFarmingHouseholds ?? -1) === 0, '跨季可停办民屯');

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
