// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P1-09 AI 基础框架（占位）
 * 正式权重/性格/难度属 Phase 5；此处仅提供可扩展接口与规则占位。
 */
import {
  ensureDemographics,
  maxConscriptable,
  withSyncedPopulation,
  type Faction,
  type GameState,
} from '@leh/shared';

export interface AiDecision {
  factionId: number;
  kind: 'civil_placeholder' | 'idle';
  message: string;
  goldDelta?: number;
  foodDelta?: number;
}

export interface AiContext {
  state: GameState;
  faction: Faction;
}

/** 每回合对非玩家存活势力调用一次 */
export function decideAiTurn(ctx: AiContext): AiDecision {
  const { state, faction } = ctx;
  // Demo：对 AI 自有城做轻量农商成长 + 势力金粮
  let farmTouched = 0;
  for (const c of Object.values(state.cities)) {
    if (c.ruler !== faction.id) continue;
    // 直接改引用前的副本由 runAllAiTurns 处理 cities 时合并
    farmTouched += 1;
  }
  const cityN = Math.max(1, farmTouched);
  return {
    factionId: faction.id,
    kind: 'civil_placeholder',
    message: `${faction.name}经营了${cityN}座城（Demo AI）`,
    goldDelta: 40 + cityN * 15,
    foodDelta: 60 + cityN * 20,
  };
}

/** 给 AI 城池做轻微农商；少量征兵从男成出 */
export function applyAiCityGrowth(state: GameState, factionId: number): GameState['cities'] {
  const cities = { ...state.cities };
  for (const c of Object.values(cities)) {
    if (c.ruler !== factionId) continue;
    const demo = ensureDemographics(c);
    const recruit = Math.min(40, maxConscriptable(demo));
    const nextDemo = { ...demo, adultMale: demo.adultMale - recruit };
    cities[c.id] = withSyncedPopulation(
      {
        ...c,
        gold: c.gold + 30,
        food: c.food + 40,
        stats: {
          ...c.stats,
          farm: Math.min(999, c.stats.farm + 2),
          commerce: Math.min(999, c.stats.commerce + 2),
        },
        troops: c.troops + recruit,
        demographics: nextDemo,
        population: c.population,
      },
      nextDemo,
    );
  }
  return cities;
}

export function runAllAiTurns(state: GameState): {
  factions: GameState['factions'];
  cities: GameState['cities'];
  decisions: AiDecision[];
} {
  const factions = { ...state.factions };
  let cities = { ...state.cities };
  const decisions: AiDecision[] = [];

  for (const f of Object.values(factions)) {
    if (!f.isAlive || f.isPlayer) continue;
    const d = decideAiTurn({ state: { ...state, cities, factions }, faction: f });
    decisions.push(d);
    cities = applyAiCityGrowth({ ...state, cities }, f.id);
    // 金粮以城池为准；不在此叠加 faction 缓存（由 turn.syncFactionResources 汇总）
    factions[f.id] = { ...f };
  }

  return { factions, cities, decisions };
}
