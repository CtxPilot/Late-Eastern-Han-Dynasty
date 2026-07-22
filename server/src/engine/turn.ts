// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 回合引擎：年月/季节、人口生育衰老、按结构产粮耗粮、商业、AI
 */
import {
  Season,
  ageDemographicsTick,
  cityFoodNeed,
  ensureDemographics,
  laborForce,
  pruneExpiredIntel,
  withSyncedPopulation,
  type City,
  type CityDemographics,
  type GameState,
} from '@leh/shared';
import { runAllAiTurns } from './ai.js';
import { runAiMilitary } from './aiMilitary.js';
import { runAllAiIntel } from './spyAi.js';
import { tickSpyMonth } from './spy.js';
import { tickPlotsMonth } from './plot.js';
import { runAllAiPlots } from './plotAi.js';
import { tickFollowCheck } from './family.js';
import { tickChildrenAppear } from './child.js';
import { tickEvents } from './event.js';
import { syncFactionResources } from './economy.js';

export function monthToSeason(month: number): Season {
  return Math.floor((month - 1) / 3) as Season;
}

function sumSafe(d: CityDemographics): number {
  return d.adultMale + d.adultFemale + d.child + d.elder;
}

/** 饥荒死亡权重：老 > 童 > 女 > 男 */
function applyFamineDeaths(d: CityDemographics, deaths: number): CityDemographics {
  let left = deaths;
  const take = (want: number, pool: number) => {
    const x = Math.min(left, pool, want);
    left -= x;
    return pool - x;
  };
  let { elder, child, adultFemale, adultMale } = d;
  elder = take(Math.ceil(deaths * 0.4), elder);
  child = take(Math.ceil(deaths * 0.35), child);
  adultFemale = take(Math.ceil(deaths * 0.15), adultFemale);
  adultMale = take(left, adultMale);
  return { adultMale, adultFemale, child, elder };
}

/** 一城月结：自然人口 → 产耗粮 */
function settleCityMonthDetailed(
  city: City,
  season: Season,
): {
  city: City;
  famineNote?: string;
  births: number;
  childToAdult: number;
  elderDeaths: number;
} {
  let d = ensureDemographics(city);
  const provisionalNeed = cityFoodNeed({ ...city, demographics: d }, season);
  const foodRatio =
    provisionalNeed <= 0 ? 1 : Math.min(2, Math.max(0.25, city.food / provisionalNeed));

  const age = ageDemographicsTick(d, {
    season,
    morale: city.stats.morale ?? 70,
    foodRatio,
    maxPopulation: city.maxPopulation,
  });
  d = age.next;

  const labor = laborForce(d);
  const laborFactor = Math.min(1.4, 0.4 + labor / Math.max(sumSafe(d), 1));
  const foodMul =
    season === Season.WINTER ? 0.7 : season === Season.AUTUMN ? 1.25 : season === Season.SPRING ? 1.1 : 1;
  const goldMul = season === Season.WINTER ? 1.1 : season === Season.SUMMER ? 1.1 : 1;

  const foodProduced = Math.floor(city.stats.farm * 3.2 * laborFactor * foodMul);
  const adultShare = (d.adultMale + d.adultFemale) / Math.max(sumSafe(d), 1);
  const goldProduced = Math.floor((city.stats.commerce / 9) * (0.7 + adultShare) * goldMul);

  const need = cityFoodNeed({ ...city, demographics: d, troops: city.troops }, season);
  let food = city.food + foodProduced - need;
  let famineNote: string | undefined;
  let morale = city.stats.morale ?? 70;
  let elderDeaths = age.deaths.elder;

  if (food < 0) {
    const deficit = -food;
    food = 0;
    const deaths = Math.min(sumSafe(d) - 50, Math.max(10, Math.floor(deficit / 2)));
    const beforeElder = d.elder;
    d = applyFamineDeaths(d, Math.max(0, deaths));
    elderDeaths += Math.max(0, beforeElder - d.elder);
    morale = Math.max(0, morale - 5);
    famineNote = `${city.name}缺粮，饿殍约${deaths}（耗粮需求${need}）`;
  }

  const next = withSyncedPopulation(
    {
      ...city,
      demographics: d,
      population: city.population,
      food,
      gold: city.gold + goldProduced,
      stats: { ...city.stats, morale },
    },
    d,
  );

  return {
    city: next,
    famineNote,
    births: age.births,
    childToAdult: age.childToAdult,
    elderDeaths,
  };
}

export function advanceTurn(state: GameState, rng: () => number): GameState {
  let { currentYear, currentMonth } = state;
  currentMonth += 1;
  if (currentMonth > 12) {
    currentMonth = 1;
    currentYear += 1;
  }
  const season = monthToSeason(currentMonth);
  const seasonNames = ['春', '夏', '秋', '冬'] as const;
  const seasonLabel = seasonNames[season] ?? '';

  const cities: GameState['cities'] = { ...state.cities };
  const famineNotes: string[] = [];
  let playerFoodNeed = 0;
  let playerFoodProd = 0;
  let playerBirths = 0;
  let playerElderDeaths = 0;
  let playerToAdult = 0;

  for (const city of Object.values(state.cities)) {
    const beforeFood = city.food;
    const result = settleCityMonthDetailed(city, season);
    cities[city.id] = result.city;
    if (result.famineNote) famineNotes.push(result.famineNote);

    if (city.ruler === state.playerFactionId) {
      const need = cityFoodNeed(result.city, season);
      playerFoodNeed += need;
      playerFoodProd += result.city.food - beforeFood + need;
      playerBirths += result.births;
      playerElderDeaths += result.elderDeaths;
      playerToAdult += result.childToAdult;
    }
  }

  // 城池金粮为真源：全势力同步缓存（含 AI 城成长前基线）
  let factions = syncFactionResources({ ...state, cities }).factions;

  const ai = runAllAiTurns({ ...state, cities, factions, currentYear, currentMonth, season });
  // Use ai result as base so any future AI modifications to officers/diplomacy/intel
  // are preserved instead of silently discarded.
  // AI 改城池后再次全量同步，避免 faction.gold 与城池脱节
  let afterAi: GameState = {
    ...state,
    ...ai,
    currentYear,
    currentMonth,
    season,
  };
  afterAi = syncFactionResources(afterAi);

  const ecoMsg =
    playerFoodNeed > 0
      ? `${currentYear}年${currentMonth}月（${seasonLabel}）— 回合结束（耗粮约${playerFoodNeed}，产粮约${Math.max(0, Math.floor(playerFoodProd))}；新生${playerBirths}，成丁${playerToAdult}，老故${playerElderDeaths}）`
      : `${currentYear}年${currentMonth}月（${seasonLabel}）— 回合结束`;

  let nextState: GameState = afterAi;
  // 谍报：冷却 → AI 谍报 → 清理过期报告
  nextState = tickSpyMonth(nextState);
  nextState = runAllAiIntel(nextState, rng);
  const intel = pruneExpiredIntel(nextState);
  nextState = { ...nextState, intel };
  // 计谋 S17：AI 发起 → 月度推进（准备→结算/ACTIVE）
  nextState = runAllAiPlots(nextState, rng);
  nextState = tickPlotsMonth(nextState, rng);
  // AI 军事：读取假情报/空城权重后最简袭扰
  nextState = runAiMilitary(nextState);
  // 家族跟随 S18：在野武将自动投奔检定
  nextState = tickFollowCheck(nextState, rng);
  // 子女 S18：每年 1 月 appearYear 登场
  nextState = tickChildrenAppear(nextState);
  // 事件 S14：自动触发无选项事件
  nextState = tickEvents(nextState);
  // 月度系统可能扣城金/粮 → 回合末再同步势力缓存
  nextState = syncFactionResources(nextState);

  return {
    ...nextState,
    actionLog: [
      {
        year: currentYear,
        month: currentMonth,
        type: 'end_turn',
        message: ecoMsg,
      },
      ...famineNotes.slice(0, 8).map((message) => ({
        year: currentYear,
        month: currentMonth,
        type: 'famine',
        message,
      })),
      ...ai.decisions.map((d) => ({
        year: currentYear,
        month: currentMonth,
        type: 'ai_placeholder',
        message: d.message,
      })),
      ...state.actionLog,
    ].slice(0, 80),
  };
}
