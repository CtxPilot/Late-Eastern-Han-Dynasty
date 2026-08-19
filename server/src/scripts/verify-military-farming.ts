// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 军屯田月结冒烟（Session 345 · docs/05 §5.8.1）
 * 运行: pnpm verify-military-farming
 */
import {
  Season,
  militaryFarmingFoodProduced,
  militaryFarmingSeasonMul,
  quarterKey,
} from '@leh/shared';
import { setMilitaryFarming, militaryFarmingMonthlyFood } from '../engine/civil.js';
import { settleCityMonthDetailed } from '../engine/turn.js';
import { advanceTurn } from '../engine/turn.js';
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

console.log('Military farming verify');

createGame(1, 1);
let state = getGame();
const city = Object.values(state.cities).find((c) => c.ruler === state.playerFactionId);
assert(!!city, '存在己方城');
if (!city) {
  process.exit(1);
}

assert(city.troops > 0, `驻军 > 0（${city.troops}）`);

// 1) 纯函数产粮公式
const expected = Math.floor(city.troops * (city.stats.farm / 100) * militaryFarmingSeasonMul(state.season) * 0.5);
assert(
  militaryFarmingFoodProduced(city.troops, city.stats.farm, state.season) === expected,
  `产粮公式与季节倍率一致（${expected}）`,
);

// 2) 开启军屯
state = setMilitaryFarming(state, city.id, true);
const enabled = state.cities[city.id]!;
assert(enabled.militaryFarming === true, '军屯已开启');
assert(
  enabled.militaryFarmingAssignQuarter === quarterKey(state.currentYear, state.currentMonth),
  '写入季度戳',
);

// 3) 同季二次切换被拒绝
let blocked = false;
try {
  setMilitaryFarming(state, city.id, false);
} catch {
  blocked = true;
}
assert(blocked, '同季二次切换被拒绝');

// 4) 前置检查：无驻军不可开屯（切到其他城验证）
const otherCity = Object.values(state.cities).find(
  (c) => c.ruler === state.playerFactionId && c.id !== city.id,
);
if (otherCity) {
  const zeroTroops = { ...otherCity, troops: 0 } as typeof otherCity;
  const fakeState = { ...state, cities: { ...state.cities, [otherCity.id]: zeroTroops } };
  let rejected = false;
  try {
    setMilitaryFarming(fakeState, otherCity.id, true);
  } catch {
    rejected = true;
  }
  assert(rejected, '无驻军城市拒绝开屯');
}

// 5) 月结产粮接入
const beforeFood = enabled.food;
const result = settleCityMonthDetailed(enabled, state.season);
const gained = result.city.food - beforeFood;
assert(
  gained >= militaryFarmingMonthlyFood(enabled, state.season),
  `月结含军屯产粮（至少 +${militaryFarmingMonthlyFood(enabled, state.season)}，实际 +${gained}）`,
);

// 6) 季度首月扣驻军士气：把当前月设为 12，推进后下月=季度首月（isQuarterStart）
const startOfQuarter = { ...enabled, troopsMorale: 80 };
const moraleState = {
  ...state,
  currentMonth: 12,
  cities: { ...state.cities, [city.id]: startOfQuarter },
} as typeof state;
// 强制推进到季度首月：190-01 已是季度首月
const advanced = advanceTurn(moraleState, () => 0.5);
const afterMorale = advanced.cities[city.id]!.troopsMorale;
assert(afterMorale === 80 - 3, `季度首月扣士气 3（${80}→${afterMorale}）`);

// 7) 关闭军屯（跨季后可切回）
const nextQuarterState = {
  ...state,
  currentMonth: 5,
  currentYear: state.currentYear,
} as typeof state;
const closedState = setMilitaryFarming(nextQuarterState, city.id, false);
assert(closedState.cities[city.id]!.militaryFarming === false, '跨季可关闭军屯');
assert(
  militaryFarmingMonthlyFood(closedState.cities[city.id]!, Season.SUMMER) === 0,
  '关闭后月结不再产粮',
);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
