// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 Session 401 · 工艺→征兵士气（征兵质量 0-A 代理）验收。
 * 运行：pnpm verify-craft-conscript
 */
import { craftConscriptMoraleBonus } from '@leh/shared';
import { createGame, getGame } from '../services/game.js';
import { conscript } from '../engine/civil.js';

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

console.log('Craft conscript morale consume verify');

createGame(1, 1);
const initial = getGame();
const fid = initial.playerFactionId;
const city = Object.values(initial.cities).find((c) => c.ruler === fid);
assert(!!city, '存在己方城');
if (!city) process.exit(1);

assert(craftConscriptMoraleBonus(0) === 0, '工艺 0 → 士气 +0');
assert(craftConscriptMoraleBonus(100) === 2, '工艺 Lv1 → 士气 +2');
assert(craftConscriptMoraleBonus(500) === 6, '工艺 Lv3 → 士气 +6');
assert(craftConscriptMoraleBonus(900) === 10, '工艺 Lv5 → 士气 +10');

const craftValue = 500;
const expectedBonus = craftConscriptMoraleBonus(craftValue);
const prevMorale = 60;

let state = {
  ...initial,
  cities: {
    ...initial.cities,
    [city.id]: {
      ...city,
      gold: Math.max(city.gold, 200),
      food: Math.max(city.food, 500),
      troops: Math.max(city.troops, 200),
      troopsMorale: prevMorale,
      stats: { ...city.stats, craft: craftValue, morale: 70 },
      demographics: {
        ...city.demographics,
        adultMale: Math.max(city.demographics.adultMale, 2000),
      },
    },
  },
};

const before = state.cities[city.id]!;
state = conscript(state, city.id, () => 0.5);
const after = state.cities[city.id]!;

assert(after.troops > before.troops, '征兵增加兵力');
assert(
  after.troopsMorale === Math.min(100, prevMorale + expectedBonus),
  `征兵后士气 = ${prevMorale}+${expectedBonus}（实得 ${after.troopsMorale}）`,
);
assert(
  (after.stats.morale ?? 0) === Math.max(0, (before.stats.morale ?? 70) - 2),
  '民心仍 −2（与工艺无关）',
);

const log = state.actionLog[0]?.message ?? '';
assert(log.includes('工艺精装士气+6'), `行动日志含工艺精装（实得：${log}）`);

// 无工艺时不抬士气
state = {
  ...initial,
  cities: {
    ...initial.cities,
    [city.id]: {
      ...city,
      gold: Math.max(city.gold, 200),
      food: Math.max(city.food, 500),
      troops: Math.max(city.troops, 200),
      troopsMorale: 55,
      stats: { ...city.stats, craft: 0, morale: 70 },
      demographics: {
        ...city.demographics,
        adultMale: Math.max(city.demographics.adultMale, 2000),
      },
    },
  },
};
state = conscript(state, city.id, () => 0.5);
assert(state.cities[city.id]!.troopsMorale === 55, '工艺 0 时征兵不改部队士气');
assert(!(state.actionLog[0]?.message ?? '').includes('工艺精装'), '无工艺时日志无精装注记');

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
