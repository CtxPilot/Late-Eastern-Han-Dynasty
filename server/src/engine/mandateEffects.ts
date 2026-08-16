// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S26 人心叛逃月度检定（Session 338）
 * 基础 2% × (1 + popularWillDesertionModifier)；命中则忠诚−8，≤20 则叛逃在野。
 * 君主与忠诚≥80 者豁免。不新增 RNG 源，由 advanceTurn 注入权威 rng。
 */
import {
  OfficerStatus,
  computePopularWill,
  popularWillDesertionModifier,
  type GameState,
} from '@leh/shared';

const BASE_DESERT_CHANCE = 0.02;
const LOYALTY_DROP = 8;
const DESERT_THRESHOLD = 20;
const LOYALTY_SAFE = 80;

export function tickPopularWillDesertion(
  state: GameState,
  rng: () => number,
): GameState {
  let officers = { ...state.officers };
  const narratives: string[] = [];

  for (const faction of Object.values(state.factions)) {
    if (!faction.isAlive) continue;
    const pw = computePopularWill(faction, state);
    const mod = popularWillDesertionModifier(pw);
    const chance = Math.max(0, BASE_DESERT_CHANCE * (1 + mod));
    if (chance <= 0) continue;

    for (const o of Object.values(state.officers)) {
      if (o.faction !== faction.id) continue;
      if (o.status !== OfficerStatus.ACTIVE) continue;
      if (faction.rulerId === o.id) continue;
      if (o.loyalty >= LOYALTY_SAFE) continue;

      if (rng() >= chance) continue;

      const nextLoyalty = Math.max(0, o.loyalty - LOYALTY_DROP);
      if (nextLoyalty <= DESERT_THRESHOLD) {
        officers[o.id] = {
          ...o,
          loyalty: nextLoyalty,
          faction: null,
          status: OfficerStatus.FREE,
          civilPosition: o.civilPosition,
          localPosition: o.localPosition,
          militaryPosition: o.militaryPosition,
        };
        // 从所在城 officers 列表移除在下方统一处理
        narratives.push(`${o.name}因人心不附叛逃（忠诚${o.loyalty}→${nextLoyalty}）`);
      } else {
        officers[o.id] = { ...o, loyalty: nextLoyalty };
        narratives.push(`${o.name}因人心浮动忠诚下降（${o.loyalty}→${nextLoyalty}）`);
      }
    }
  }

  if (narratives.length === 0) return state;

  let cities = { ...state.cities };
  for (const o of Object.values(officers)) {
    if (o.status !== OfficerStatus.FREE || o.location == null) continue;
    const city = cities[o.location];
    if (!city?.officers.includes(o.id)) continue;
    // 仅当该武将刚变为 FREE 且仍挂在城列表时清理
    const prev = state.officers[o.id];
    if (prev?.faction != null && o.faction == null) {
      cities[o.location] = {
        ...city,
        officers: city.officers.filter((id) => id !== o.id),
      };
    }
  }

  return {
    ...state,
    officers,
    cities,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type: 'popular_will',
        message: narratives.slice(0, 6).join('；'),
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}
