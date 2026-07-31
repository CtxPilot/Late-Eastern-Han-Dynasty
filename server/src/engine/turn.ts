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
  isCountyPathBlockedBy,
  monthlyArmyFoodCost,
  resolveArmyCountyNodeId,
  shortestCountyPath,
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
import { tickImperialAuthorityQuarter } from './hegemony.js';
import { tickDevelopmentProject } from './civil.js';

export function monthToSeason(month: number): Season {
  return Math.floor((month - 1) / 3) as Season;
}

export interface TurnCalendar {
  year: number;
  month: number;
  season: Season;
  isQuarterStart: boolean;
  isYearStart: boolean;
}

/** S01 时间真源：每次推进恰好一个月；季度从 1/4/7/10 月开始。 */
export function advanceCalendar(currentYear: number, currentMonth: number): TurnCalendar {
  if (!Number.isInteger(currentYear) || !Number.isInteger(currentMonth) || currentMonth < 1 || currentMonth > 12) {
    throw new Error('无效的游戏年月');
  }

  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
  const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
  return {
    year: nextYear,
    month: nextMonth,
    season: monthToSeason(nextMonth),
    isQuarterStart: nextMonth === 1 || nextMonth === 4 || nextMonth === 7 || nextMonth === 10,
    isYearStart: nextMonth === 1,
  };
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
export function settleCityMonthDetailed(
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
  const calendar = advanceCalendar(state.currentYear, state.currentMonth);
  const {
    year: currentYear,
    month: currentMonth,
    season,
    isQuarterStart,
    isYearStart,
  } = calendar;
  const seasonNames = ['春', '夏', '秋', '冬'] as const;
  const seasonLabel = seasonNames[season] ?? '';

  const cities: GameState['cities'] = { ...state.cities };
  const famineNotes: string[] = [];
  const developmentNotes: string[] = [];
  let playerProjectCost = 0;
  let playerAdministrativeCost = 0;
  let playerFoodNeed = 0;
  let playerFoodProd = 0;
  let playerBirths = 0;
  let playerElderDeaths = 0;
  let playerToAdult = 0;

  const administrationOrdinals = new Map<number, number>();
  for (const city of Object.values(state.cities).sort((a, b) => a.id - b.id)) {
    const ordinal = city.ruler == null ? 0 : (administrationOrdinals.get(city.ruler) ?? 0);
    if (city.ruler != null) administrationOrdinals.set(city.ruler, ordinal + 1);
    const administrativeCost = ordinal * 5;
    const afterAdministration = { ...city, gold: Math.max(0, city.gold - administrativeCost) };
    const projectResult = tickDevelopmentProject(state, afterAdministration);
    if (projectResult.note) developmentNotes.push(projectResult.note);
    const projectCost = Math.max(0, afterAdministration.gold - projectResult.city.gold);
    const beforeFood = city.food;
    const result = settleCityMonthDetailed(projectResult.city, season);
    cities[city.id] = result.city;
    if (result.famineNote) famineNotes.push(result.famineNote);

    if (city.ruler === state.playerFactionId) {
      playerProjectCost += projectCost;
      playerAdministrativeCost += Math.min(city.gold, administrativeCost);
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
  // 显式取 ai.factions/ai.cities，不 spread 整个 ai 对象——避免 ai.decisions
  // （临时日志字段，line 260 已转成 actionLog 条目）泄漏进 GameState，
  // 否则 GameStateSchema strict 校验会在 restoreGameFromEnvelope 时拒绝。
  // 未来 ai 若扩展返回 officers/diplomacy/intel 等字段，在此显式追加。
  let afterAi: GameState = {
    ...state,
    factions: ai.factions,
    cities: ai.cities,
    currentYear,
    currentMonth,
    season,
  };
  afterAi = syncFactionResources(afterAi);

  const ecoMsg =
    playerFoodNeed > 0
      ? `${currentYear}年${currentMonth}月（${seasonLabel}）— 回合结束（耗粮约${playerFoodNeed}，产粮约${Math.max(0, Math.floor(playerFoodProd))}；项目${playerProjectCost}金，行政${playerAdministrativeCost}金；新生${playerBirths}，成丁${playerToAdult}，老故${playerElderDeaths}）`
      : `${currentYear}年${currentMonth}月（${seasonLabel}）— 回合结束`;

  let nextState: GameState = afterAi;
  // 谍报：冷却 → AI 谍报 → 清理过期报告
  nextState = tickSpyMonth(nextState);
  nextState = runAllAiIntel(nextState, rng, rng);
  const intel = pruneExpiredIntel(nextState);
  nextState = { ...nextState, intel };
  // 计谋 S17：AI 发起 → 月度推进（准备→结算/ACTIVE）
  nextState = runAllAiPlots(nextState, rng, rng);
  nextState = tickPlotsMonth(nextState, rng);
  // AI 军事：外交过滤 + CampaignArmy 出征/结算；决策与结算共用权威 PRNG。
  nextState = runAiMilitary(nextState, rng, rng);
  // 家族跟随 S18：在野武将自动投奔检定
  nextState = tickFollowCheck(nextState, rng);
  // 子女 S18：每年 1 月 appearYear 登场
  nextState = tickChildrenAppear(nextState);
  // 事件 S14：自动触发无选项事件
  nextState = tickEvents(nextState);
  // 月度系统可能扣城金/粮 → 回合末再同步势力缓存
  nextState = syncFactionResources(nextState);
  if (isQuarterStart) nextState = tickImperialAuthorityQuarter(nextState);
  // 行动次数月度重置（Session 186）：独立于体力，每月回满上限（默认 1，未来加成来源实装后改为各自上限）。
  nextState = {
    ...nextState,
    factions: Object.fromEntries(
      Object.entries(nextState.factions).map(([id, faction]) => [
        id,
        (faction.politicalStage ?? 'vassal') === 'vassal'
          ? faction
          : {
              ...faction,
              politicalStageAgeMonths: (faction.politicalStageAgeMonths ?? 0) + 1,
            },
      ]),
    ),
    officers: Object.fromEntries(
      Object.entries(nextState.officers).map(([id, o]) => [
        id,
        { ...o, actionsPerMonth: 1 },
      ]),
    ),
  };

  return {
    ...nextState,
    actionLog: [
      {
        year: currentYear,
        month: currentMonth,
        type: 'end_turn',
        message: ecoMsg,
      },
      ...(isQuarterStart
        ? [{
            year: currentYear,
            month: currentMonth,
            type: 'quarter_start',
            message: `${currentYear}年${currentMonth}月 — ${seasonLabel}季开始`,
          }]
        : []),
      ...(isYearStart
        ? [{
            year: currentYear,
            month: currentMonth,
            type: 'year_start',
            message: `${currentYear}年开始`,
          }]
        : []),
      ...famineNotes.slice(0, 8).map((message) => ({
        year: currentYear,
        month: currentMonth,
        type: 'famine',
        message,
      })),
      ...developmentNotes.slice(0, 8).map((message) => ({
        year: currentYear,
        month: currentMonth,
        type: 'development_project',
        message,
      })),
      ...ai.decisions.map((d) => ({
        year: currentYear,
        month: currentMonth,
        type: 'ai_placeholder',
        message: d.message,
      })),
      ...nextState.actionLog,
    ].slice(0, 80),
  };
}

/**
 * BF-P2 Q9 + BF-P5：郡域战场实例月度 tick。
 *
 * 在 endTurn 里于 tickCampaignMarch/tickCampaignGarrison 之后调用，处理：
 * 1. 驻军消耗：已占领县 controlTurns++；若 garrison==0 则掉控制（rulerFactionId=null）。
 * 2. 补给线切断（BF-P5 真实路径判定）：逐支守方 Army 经 shared/army-county-mapping
 *    定位 countyId，补给线 = seat → Army 当前县 最短路径；路径经过攻方控制县 →
 *    该 Army 粮耗×2 + 士气-5。未定位在郡域内的守方 Army 不受影响。
 */
export function tickBattlefieldInstance(state: GameState): GameState {
  const inst = state.activeBattlefieldInstance;
  if (!inst) return state;

  const seat = inst.nodeStates.find((n) => n.nodeId === inst.targetSeatNodeId);
  const defenderFactionId = seat?.rulerFactionId ?? null;
  const attackerFactionId = state.playerFactionId;

  let nodeStatesChanged = false;
  const newNodeStates = inst.nodeStates.map((node) => {
    if (node.rulerFactionId != null) {
      const controlTurns = node.controlTurns + 1;
      if (node.garrison === 0) {
        nodeStatesChanged = true;
        return { ...node, rulerFactionId: null, controlTurns: 0 };
      }
      nodeStatesChanged = true;
      return { ...node, controlTurns };
    }
    return node;
  });

  // BF-P5 补给线真实路径判定（替换 BF-P2 的"占领任意首批县→守方全军士气-5"全局简化）：
  // 逐支守方 Army 解析 countyId 定位，补给线 = seat(守方边界入口) → Army 当前县 最短路径；
  // 路径经过攻方控制县 → 该 Army 粮耗×2 + 士气-5。未定位在郡域内的守方 Army 不受影响。
  let campaignArmiesChanged = false;
  let newCampaignArmies = state.campaignArmies;
  const supplyCutMessages: string[] = [];
  if (defenderFactionId != null) {
    newCampaignArmies = state.campaignArmies.map((army) => {
      if (army.factionId !== defenderFactionId) return army;
      const countyNodeId = resolveArmyCountyNodeId(inst, army.id);
      if (!countyNodeId) return army;
      const supplyPath = shortestCountyPath(inst, inst.targetSeatNodeId, countyNodeId);
      if (!supplyPath || !isCountyPathBlockedBy(inst, supplyPath, attackerFactionId)) return army;
      campaignArmiesChanged = true;
      const foodPenalty = monthlyArmyFoodCost(army.troops) * 2;
      supplyCutMessages.push(`${army.name}（${countyNodeId}）补给线被切断`);
      return {
        ...army,
        morale: Math.max(0, army.morale - 5),
        food: Math.max(0, army.food - foodPenalty),
      };
    });
  }

  if (!nodeStatesChanged && !campaignArmiesChanged) return state;

  let next: GameState = state;
  if (nodeStatesChanged) {
    next = { ...next, activeBattlefieldInstance: { ...inst, nodeStates: newNodeStates } };
  }
  if (campaignArmiesChanged) {
    next = { ...next, campaignArmies: newCampaignArmies };
    next = {
      ...next,
      actionLog: [{
        year: state.currentYear,
        month: state.currentMonth,
        type: 'battlefield',
        message: `${supplyCutMessages.join('；')}，粮耗×2 士气-5`,
      }, ...next.actionLog].slice(0, 80),
    };
  }

  return next;
}
