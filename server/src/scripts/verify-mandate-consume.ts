// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S26 天命/人心效果消费冒烟（Session 338）：
 *   1. 天命外交修正进入 calculateAllianceChance.mandateModifier
 *   2. 人心募兵修正改变征兵量（固定 RNG）
 *   3. 人心叛逃检定在极低人心下可触发忠诚下降
 *
 * 运行: pnpm verify-mandate-consume
 */
import {
  OfficerStatus,
  DipRelation,
  calculateAllianceChance,
  computeMandate,
  computePopularWill,
  mandateDiplomacyModifier,
  popularWillRecruitModifier,
  type GameState,
  type Officer,
} from '@leh/shared';
import { conscript } from '../engine/civil.js';
import { tickPopularWillDesertion } from '../engine/mandateEffects.js';
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

console.log('S26 mandate/popular consume verify');

createGame(1, 1);
let state = getGame();
const player = state.factions[state.playerFactionId]!;
const mandate = computeMandate(player, state);
const expectedMandatePts = Math.round(mandateDiplomacyModifier(mandate) * 100);
const allyTarget = Object.values(state.factions).find(
  (f) => f.id !== state.playerFactionId && f.isAlive,
);
assert(!!allyTarget, '存在可结盟目标势力');
if (allyTarget) {
  // 抬高友好以便公式可读
  state = {
    ...state,
    diplomacy: state.diplomacy.map((link) =>
      (link.factionA === state.playerFactionId && link.factionB === allyTarget.id) ||
      (link.factionA === allyTarget.id && link.factionB === state.playerFactionId)
        ? { ...link, favorability: 40, relation: DipRelation.FRIENDLY }
        : link,
    ),
  };
  const breakdown = calculateAllianceChance(state, allyTarget.id);
  assert(breakdown.mandateModifier === expectedMandatePts, `mandateModifier=${expectedMandatePts}（实际 ${breakdown.mandateModifier}）`);
  assert(
    breakdown.chance ===
      Math.min(
        90,
        Math.max(
          5,
          35 +
            breakdown.favorability * 0.35 +
            breakdown.envoyCharisma * 0.15 +
            breakdown.commonEnemyModifier +
            breakdown.treatyModifier +
            breakdown.hegemonyModifier +
            breakdown.eloquenceModifier +
            breakdown.mandateModifier,
        ),
      ),
    '结盟 chance 含天命逐项相加',
  );
}

createGame(1, 1);
state = getGame();
const city = Object.values(state.cities).find(
  (c) => c.ruler === state.playerFactionId && c.gold >= 80 && c.food >= 120,
)!;
const pw = computePopularWill(state.factions[state.playerFactionId]!, state);
const recruitMod = popularWillRecruitModifier(pw);

// 强制人心极高：抬高忠诚与民心
const highState: GameState = {
  ...state,
  officers: Object.fromEntries(
    Object.entries(state.officers).map(([id, o]) => [
      id,
      o.faction === state.playerFactionId ? { ...o, loyalty: 95 } : o,
    ]),
  ),
  cities: Object.fromEntries(
    Object.entries(state.cities).map(([id, c]) => [
      id,
      c.ruler === state.playerFactionId
        ? { ...c, stats: { ...c.stats, morale: 95 }, gold: Math.max(c.gold, 200), food: Math.max(c.food, 400) }
        : c,
    ]),
  ),
};
const highCity = highState.cities[city.id];
const highAfter = conscript(highState, highCity.id, () => 0);
const highGain = highAfter.cities[highCity.id].troops - highCity.troops;

const lowState: GameState = {
  ...state,
  officers: Object.fromEntries(
    Object.entries(state.officers).map(([id, o]) => [
      id,
      o.faction === state.playerFactionId ? { ...o, loyalty: 10 } : o,
    ]),
  ),
  cities: Object.fromEntries(
    Object.entries(state.cities).map(([id, c]) => [
      id,
      c.ruler === state.playerFactionId
        ? { ...c, stats: { ...c.stats, morale: 10 }, gold: Math.max(c.gold, 200), food: Math.max(c.food, 400) }
        : c,
    ]),
  ),
};
const lowCity = lowState.cities[city.id];
const lowAfter = conscript(lowState, lowCity.id, () => 0);
const lowGain = lowAfter.cities[lowCity.id].troops - lowCity.troops;
assert(highGain > lowGain, `高人心征兵 ${highGain} > 低人心 ${lowGain}（基线修正 ${recruitMod}）`);

// 叛逃：构造极低人心 + 低忠诚武将，rng 恒 0 必中
createGame(1, 1);
state = getGame();
const victim = Object.values(state.officers).find(
  (o) =>
    o.faction === state.playerFactionId &&
    o.status === OfficerStatus.ACTIVE &&
    state.factions[state.playerFactionId]?.rulerId !== o.id,
) as Officer;
assert(!!victim, '找到非君主受害武将');
state = {
  ...state,
  officers: {
    ...state.officers,
    [victim.id]: { ...victim, loyalty: 30 },
  },
  cities: Object.fromEntries(
    Object.entries(state.cities).map(([id, c]) => [
      id,
      c.ruler === state.playerFactionId ? { ...c, stats: { ...c.stats, morale: 5 } } : c,
    ]),
  ),
};
const deserted = tickPopularWillDesertion(state, () => 0);
const afterVictim = deserted.officers[victim.id];
assert(afterVictim.loyalty < 30, `叛逃检定降低忠诚（${afterVictim.loyalty}）`);
assert(
  deserted.actionLog.some((l) => l.type === 'popular_will'),
  '叛逃/忠诚下降写入 popular_will 日志',
);

console.log(`结果: ${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
