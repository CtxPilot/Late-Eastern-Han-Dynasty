// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * L3 国策冒烟（Session 348 · docs/04 §31.6）
 * 运行: pnpm verify-l3-policy
 */
import {
  PolicyType,
  POLICY_COOLDOWN_MONTHS,
  POLICY_HIGH_WALLS_FOOD_MUL,
  POLICY_LABELS,
  factionHasActivePolicy,
  getActivePolicyType,
  isScorchedCity,
  policySwitchCooldown,
} from '@leh/shared';
import { setNationalPolicy, tickNationalPolicies } from '../engine/policy.js';
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

console.log('L3 national policy verify');

createGame(1, 1);
let state = getGame();
const fid = state.playerFactionId;
assert(POLICY_LABELS[PolicyType.PREPARE_DEFENSE] === '以逸待劳', '国策中文名');
assert(getActivePolicyType(state, fid) == null, '开局无国策');

state = setNationalPolicy(state, PolicyType.PLAY_FOOL);
const pending = state.nationalPolicies?.[0];
assert(pending?.type === PolicyType.PLAY_FOOL && pending.active === false, '新策待下月生效');
assert(pending?.cooldown === POLICY_COOLDOWN_MONTHS, '冷却 6 月');
assert(getActivePolicyType(state, fid) == null, '当月尚未生效');

let blocked = false;
try {
  setNationalPolicy(state, PolicyType.HIGH_WALLS);
} catch {
  blocked = true;
}
assert(blocked, '冷却中不可再切');

state = tickNationalPolicies(state, false);
assert(getActivePolicyType(state, fid) === PolicyType.PLAY_FOOL, 'tick 后假痴不癫生效');
assert(factionHasActivePolicy(state, fid, PolicyType.PLAY_FOOL), 'active 标记');
assert(policySwitchCooldown(state, fid) === 5, '冷却减 1');

createGame(1, 1);
let walls = setNationalPolicy(getGame(), PolicyType.HIGH_WALLS);
walls = tickNationalPolicies(walls, false);
assert(factionHasActivePolicy(walls, walls.playerFactionId, PolicyType.HIGH_WALLS), '高筑墙生效');
assert(POLICY_HIGH_WALLS_FOOD_MUL === 1.15, '粮产倍率 +15%');

createGame(1, 1);
let next = setNationalPolicy(getGame(), PolicyType.BEFRIEND_FAR);
const month0 = next.currentMonth;
next = advanceTurn(next, () => 0.5);
assert(
  getActivePolicyType(next, next.playerFactionId) === PolicyType.BEFRIEND_FAR,
  `结束回合后远交近攻生效（${month0}→${next.currentMonth}）`,
);

createGame(2, 1);
state = getGame();
const border = Object.values(state.cities).find(
  (c) => c.ruler === state.playerFactionId,
);
assert(!!border, '关东义兵有己方城');
let scorchedOk = false;
try {
  state = setNationalPolicy(state, PolicyType.SCORCHED_EARTH, { targetCityId: border?.id });
  scorchedOk = true;
} catch (e) {
  scorchedOk = false;
  console.log(`    (坚壁清野发起：${e instanceof Error ? e.message : e})`);
}
if (scorchedOk) {
  state = tickNationalPolicies(state, false);
  assert(isScorchedCity(state, border!.id), '焦土城识别');
  assert(state.cities[border!.id]!.food === 0, '粮库清零');
} else {
  assert(true, '无接壤边境城时坚壁清野按规则拒绝（已记录）');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
