// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P1-09 AI 基础框架。
 * P1-1（Session 408，`docs/40-game-evaluation.md`）：内政从占位升级为三规则启发式——
 *   ① 缺粮屯田（food < troops×4 → farm+6，且本月不征兵）；
 *   ② 低金经商（gold < 600 → commerce+6）；
 *   ③ 低民心巡安（stats.morale < 55 → morale+3，且本月不征兵）；
 *   其余维持均衡农商（farm+2/commerce+2）与条件征兵（粮足民安才征，≤40 男成）。
 * 全部为确定性阈值判断，不消费权威 RNG（回放序不受影响）；正式权重/性格/难度仍属 Phase 5。
 */
import {
  ensureDemographics,
  maxConscriptable,
  withSyncedPopulation,
  type City,
  type Faction,
  type GameState,
} from '@leh/shared';

export interface AiDecision {
  factionId: number;
  kind: 'civil_heuristic' | 'idle';
  message: string;
  /** 三规则命中城数（供日志与测试观察） */
  farmCount?: number;
  commerceCount?: number;
  patrolCount?: number;
}

export interface AiContext {
  state: GameState;
  faction: Faction;
}

const FOOD_SCARCE_RATIO = 4;
const GOLD_POOR = 600;
const MORALE_LOW = 55;

/** 三规则启发式的单城判定（导出供单测与后续人格化扩展）。 */
export function decideCityRule(city: City): 'farm' | 'commerce' | 'patrol' | 'balanced' {
  if (city.food < city.troops * FOOD_SCARCE_RATIO) return 'farm';
  if (city.gold < GOLD_POOR) return 'commerce';
  if (city.stats.morale < MORALE_LOW) return 'patrol';
  return 'balanced';
}

/** 每回合对非玩家存活势力调用一次：汇总三规则命中情况形成决策叙事。 */
export function decideAiTurn(ctx: AiContext): AiDecision {
  const { state, faction } = ctx;
  const farm: string[] = [];
  const commerce: string[] = [];
  const patrol: string[] = [];
  let balanced = 0;
  for (const c of Object.values(state.cities)) {
    if (c.ruler !== faction.id) continue;
    const rule = decideCityRule(c);
    if (rule === 'farm') farm.push(c.name);
    else if (rule === 'commerce') commerce.push(c.name);
    else if (rule === 'patrol') patrol.push(c.name);
    else balanced += 1;
  }
  const parts: string[] = [];
  if (farm.length > 0) parts.push(`缺粮屯田×${farm.length}（${farm.slice(0, 3).join('、')}）`);
  if (commerce.length > 0) parts.push(`低金经商×${commerce.length}（${commerce.slice(0, 3).join('、')}）`);
  if (patrol.length > 0) parts.push(`低民心巡安×${patrol.length}（${patrol.slice(0, 3).join('、')}）`);
  if (balanced > 0) parts.push(`农商均衡×${balanced}`);
  if (parts.length === 0) return { factionId: faction.id, kind: 'idle', message: `${faction.name}无所事事` };
  return {
    factionId: faction.id,
    kind: 'civil_heuristic',
    message: `${faction.name}内政：${parts.join(' · ')}`,
    farmCount: farm.length,
    commerceCount: commerce.length,
    patrolCount: patrol.length,
  };
}

/** 给 AI 城池按三规则经营；征兵仅在粮足且民安时进行。 */
export function applyAiCityGrowth(state: GameState, factionId: number): GameState['cities'] {
  const cities = { ...state.cities };
  for (const c of Object.values(cities)) {
    if (c.ruler !== factionId) continue;
    const rule = decideCityRule(c);
    const demo = ensureDemographics(c);
    const conscriptAllowed = rule !== 'farm' && rule !== 'patrol';
    const recruit = conscriptAllowed ? Math.min(40, maxConscriptable(demo)) : 0;
    const nextDemo = { ...demo, adultMale: demo.adultMale - recruit };
    const stats = { ...c.stats };
    if (rule === 'farm') {
      stats.farm = Math.min(999, stats.farm + 6);
    } else if (rule === 'commerce') {
      stats.commerce = Math.min(999, stats.commerce + 6);
    } else if (rule === 'patrol') {
      stats.morale = Math.min(100, stats.morale + 3);
      stats.farm = Math.min(999, stats.farm + 1);
      stats.commerce = Math.min(999, stats.commerce + 1);
    } else {
      stats.farm = Math.min(999, stats.farm + 2);
      stats.commerce = Math.min(999, stats.commerce + 2);
    }
    cities[c.id] = withSyncedPopulation(
      {
        ...c,
        gold: c.gold + 30,
        food: c.food + 40,
        stats,
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
