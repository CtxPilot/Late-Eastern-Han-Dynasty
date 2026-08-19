// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 计谋主引擎 S17：L1 四计 + L2 十一计（主线③）
 * 设计真源 docs/04 §31
 */
import {
  DipRelation,
  PlotStage,
  PlotType,
  SpyStatus,
  controlsEmperor,
  findDiplomacy,
  isAllied,
  roadNeighbors,
  type GameState,
  type Officer,
  type Plot,
  type PlotCost,
} from '@leh/shared';
import { upsertDipFavor } from './spy.js';
import { grantMeritTo } from './meritGrant.js';

// 计谋成功功绩（docs/04 §6.1 军事条 计策+3~8；固定值 +5 不消耗权威 RNG，待平衡）
const MERIT_PLOT_SUCCESS = 5;

/** L2 并行上限（docs/04 §31.8） */
export const MAX_ACTIVE_L2_PLOTS = 2;
/** 釜底抽薪：首付 / 月付 / 分期月数 / 生效月数 */
export const UNDERMINE_UPFRONT_GOLD = 300;
export const UNDERMINE_MONTHLY_GOLD = 60;
export const UNDERMINE_INSTALLMENT_MONTHS = 6;
export const UNDERMINE_EFFECT_MONTHS = 6;
/** 行政→战场：该城出兵士气−15、粮耗×1.5 */
export const UNDERMINE_MORALE_PENALTY = 15;
export const UNDERMINE_FOOD_COST_MUL = 1.5;

/** 暗渡陈仓：金200；PREP 1 月 → ACTIVE 3 月；对暗渡城攻防×1.2 */
export const SECRET_CROSSING_GOLD = 200;
export const SECRET_CROSSING_PREP_MONTHS = 1;
export const SECRET_CROSSING_EFFECT_MONTHS = 3;
export const SECRET_CROSSING_BATTLE_MUL = 1.2;
/** 明修城吸引第三方进攻权重（同假情报诱饵量级） */
export const SECRET_CROSSING_FEINT_ATTACK_MUL = 2.2;

/** 树上开花：金150+粮100；ACTIVE 4 月；对敌显示兵力×2~3、AI 攻击权重×0.4 */
export const BLOSSOM_GOLD = 150;
export const BLOSSOM_FOOD = 100;
export const BLOSSOM_EFFECT_MONTHS = 4;
export const BLOSSOM_AI_ATTACK_MUL = 0.4;
/** 虚报倍数下界/上界（按城市 ID 确定性派生，不引入 RNG） */
export const BLOSSOM_TROOP_MUL_MIN = 2;
export const BLOSSOM_TROOP_MUL_MAX = 3;

/**
 * 指桑骂槐：金100；即时结算（Session 343）。
 * 忠诚偏低门槛与 S26 LOYALTY_SAFE 对齐（&lt;80）；需≥2 人；
 * 0-A：确定性成功（己方内务，无识破）；儆猴固定 −15；其余在职非君主 +5~8（权威 RNG）。
 */
export const KILL_CHICKEN_GOLD = 100;
export const KILL_CHICKEN_LOYALTY_THRESHOLD = 80;
export const KILL_CHICKEN_MIN_LOW = 2;
export const KILL_CHICKEN_VICTIM_DROP = 15;
export const KILL_CHICKEN_BOOST_MIN = 5;
export const KILL_CHICKEN_BOOST_MAX = 8;

/**
 * 趁火打劫：金150；目标势力同时与≥2家交战；即时 RESOLVED（Session 344）。
 * 0-A：确定性成功、无识破；效果 = 施计方对目标势力的自动战首击伤害×1.2。
 */
export const STRIKE_WHILE_HOT_GOLD = 150;
/** 目标需同时与多少家其他势力交战 */
export const STRIKE_WHILE_HOT_MIN_WARS = 2;
/** 首击伤害倍率（docs/04 §31.5：首次伤害+20%） */
export const STRIKE_WHILE_HOT_FIRST_HIT_MUL = 1.2;

/**
 * 调虎离山：金200 + 50/月×2（设计 2~4 月取下限）；敌城 detailed + 女间谍必派。
 * PREP 完投权威结算；成功则诱离守将至同势力他城（邻接优先），ACTIVE 4 月城防减半。
 * 效果结束或提前终止时，若原城仍属原势力则召回武将。
 */
export const LURE_TIGER_UPFRONT_GOLD = 200;
export const LURE_TIGER_MONTHLY_GOLD = 50;
export const LURE_TIGER_INSTALLMENT_MONTHS = 2;
export const LURE_TIGER_EFFECT_MONTHS = 4;
export const LURE_TIGER_WALL_MUL = 0.5;

/** 借刀杀人：金300；PREP 2 月；煽动窗口 ACTIVE 2 月 */
export const INSTIGATE_GOLD = 300;
export const INSTIGATE_PREP_MONTHS = 2;
export const INSTIGATE_EFFECT_MONTHS = 2;
export const INSTIGATE_AI_ATTACK_MUL = 5;

/** 秘密挖角：金 100~500 + 50/月×2 */
export const POACH_GOLD_MIN = 100;
export const POACH_GOLD_MAX = 500;
export const POACH_MONTHLY_GOLD = 50;
export const POACH_INSTALLMENT_MONTHS = 2;
export const POACH_TROOP_TAKE_MAX = 800;

/** 隔岸观火：金400 + 80/月×3；友好≥40 */
export const WATCH_FIRE_UPFRONT_GOLD = 400;
export const WATCH_FIRE_MONTHLY_GOLD = 80;
export const WATCH_FIRE_INSTALLMENT_MONTHS = 3;
export const WATCH_FIRE_MIN_FAVOR = 40;
export const WATCH_FIRE_MAX_ACTIVE_MONTHS = 12;

/** 偷梁换柱：金300；PREP 2 → ACTIVE 4；统率−10 */
export const SWAP_PILLAR_GOLD = 300;
export const SWAP_PILLAR_PREP_MONTHS = 2;
export const SWAP_PILLAR_EFFECT_MONTHS = 4;
export const SWAP_PILLAR_LEADERSHIP_PENALTY = 10;

/** 借尸还魂：金300；PREP 1 → ACTIVE 4；民心−5/月 */
export const EDICT_GOLD = 300;
export const EDICT_PREP_MONTHS = 1;
export const EDICT_EFFECT_MONTHS = 4;
export const EDICT_MORALE_DROP = 5;
export const EDICT_LOYALTY_DROP = 2;
export const EDICT_FORGE_DETECT_BONUS = 25;

/**
 * 计谋执行武将缺省解析：势力内 ACTIVE 非君主智最高者（军师类武将出谋）。
 */
function resolveCasterOfficer(state: GameState, factionId: number): number | undefined {
  const rulerId = state.factions[factionId]?.rulerId;
  const candidates = Object.values(state.officers)
    .filter(
      (o) =>
        o.faction === factionId &&
        o.status === 'active' &&
        o.id !== rulerId,
    )
    .sort((a, b) => b.stats.intelligence - a.stats.intelligence || a.id - b.id);
  return candidates[0]?.id;
}

const HONEY_TRAP_COST: PlotCost = {
  gold: 150,
  beauty: 2,
  requiresIntel: 'detailed',
};

const SOW_DISCORD_COST: PlotCost = {
  gold: 200,
  requiresIntel: 'surface',
};

/** 假情报：金 120 + 目标城 detailed */
const FALSE_INTEL_COST: PlotCost = {
  gold: 120,
  requiresIntel: 'detailed',
};

/** 空城疑兵：粮 150（从目标己方城扣） */
const EMPTY_FORT_COST: PlotCost = {
  gold: 0,
  food: 150,
};

/** 釜底抽薪：首付 300（分期 60/月 在 PREP 逐月扣） */
const UNDERMINE_COST: PlotCost = {
  gold: UNDERMINE_UPFRONT_GOLD,
  requiresIntel: 'detailed',
};

/** 暗渡陈仓：金 200；双城 surface 另在发起时校验 */
const SECRET_CROSSING_COST: PlotCost = {
  gold: SECRET_CROSSING_GOLD,
  requiresIntel: 'surface',
};

/** 树上开花：金 150 + 粮 100（己方城，无情报前置，Session 342 用户拍板放宽） */
const BLOSSOM_COST: PlotCost = {
  gold: BLOSSOM_GOLD,
  food: BLOSSOM_FOOD,
};

/** 指桑骂槐：金 100；无情报前置；即时结算 */
const KILL_CHICKEN_COST: PlotCost = {
  gold: KILL_CHICKEN_GOLD,
};

/** 趁火打劫：金 150；无情报前置；即时结算 */
const STRIKE_WHILE_HOT_COST: PlotCost = {
  gold: STRIKE_WHILE_HOT_GOLD,
};

const LURE_TIGER_COST: PlotCost = {
  gold: LURE_TIGER_UPFRONT_GOLD,
  requiresIntel: 'detailed',
};

const INSTIGATE_COST: PlotCost = {
  gold: INSTIGATE_GOLD,
  requiresIntel: 'detailed',
};

const WATCH_FIRE_COST: PlotCost = {
  gold: WATCH_FIRE_UPFRONT_GOLD,
};

const SWAP_PILLAR_COST: PlotCost = {
  gold: SWAP_PILLAR_GOLD,
  requiresIntel: 'detailed',
};

const EDICT_COST: PlotCost = {
  gold: EDICT_GOLD,
};

const PREP_MONTHS = 1;
/** 假情报 / 空城 生效持续月数 */
const EFFECT_MONTHS = 3;
const EXPOSED_MONTHS = 2;
const MAX_ACTIVE_PLOTS = 4;
/** 空城疑兵：兵力低于此视为寡兵 */
export const EMPTY_FORT_TROOP_MAX = 3500;

function isL2Plot(type: PlotType): boolean {
  return (
    type === PlotType.UNDERMINE ||
    type === PlotType.SECRET_CROSSING ||
    type === PlotType.BLOSSOM ||
    type === PlotType.KILL_CHICKEN ||
    type === PlotType.STRIKE_WHILE_HOT ||
    type === PlotType.LURE_TIGER ||
    type === PlotType.INSTIGATE ||
    type === PlotType.POACH ||
    type === PlotType.WATCH_FIRE ||
    type === PlotType.SWAP_PILLAR ||
    type === PlotType.EDICT
  );
}

export function poachGoldCost(officer: Officer): number {
  return Math.min(POACH_GOLD_MAX, Math.max(POACH_GOLD_MIN, 100 + officer.stats.leadership * 4));
}

/** 己方在职非君主、忠诚偏低的武将（按 id 升序，供 UI/发起校验） */
export function listKillChickenCandidates(
  state: GameState,
  factionId: number,
): Officer[] {
  const rulerId = state.factions[factionId]?.rulerId;
  return Object.values(state.officers)
    .filter(
      (o) =>
        o.faction === factionId &&
        String(o.status) === 'active' &&
        o.id !== rulerId &&
        o.loyalty < KILL_CHICKEN_LOYALTY_THRESHOLD,
    )
    .sort((a, b) => a.id - b.id);
}

/** 目标城可诱离的在职非君主守将（武力降序） */
export function listLureTigerCandidates(state: GameState, cityId: number): Officer[] {
  const city = state.cities[cityId];
  if (!city || city.ruler == null) return [];
  const rulerId = state.factions[city.ruler]?.rulerId;
  return city.officers
    .map((id) => state.officers[id])
    .filter((o): o is Officer =>
      !!o
      && o.faction === city.ruler
      && String(o.status) === 'active'
      && o.id !== rulerId,
    )
    .sort((a, b) => b.stats.war - a.stats.war || a.id - b.id);
}

/** 同势力他城；若有官道邻接则只返回邻接城 */
export function listLureTigerDestCities(state: GameState, fromCityId: number) {
  const city = state.cities[fromCityId];
  if (!city || city.ruler == null) return [];
  const same = Object.values(state.cities)
    .filter((c) => c.ruler === city.ruler && c.id !== fromCityId)
    .sort((a, b) => a.id - b.id);
  const neighbors = same.filter((c) => roadNeighbors(fromCityId).includes(c.id));
  return neighbors.length > 0 ? neighbors : same;
}

/** 目标城官道邻接、属于第三方（非施计方、非守城方）的源城 */
export function listInstigateSourceCities(
  state: GameState,
  targetCityId: number,
  casterFactionId: number,
) {
  const target = state.cities[targetCityId];
  if (!target || target.ruler == null) return [];
  return roadNeighbors(targetCityId)
    .map((id) => state.cities[id])
    .filter((c) =>
      !!c
      && c.ruler != null
      && c.ruler !== casterFactionId
      && c.ruler !== target.ruler
      && (state.factions[c.ruler]?.isAlive ?? false),
    )
    .sort((a, b) => a.id - b.id);
}

export function listPoachCandidates(state: GameState, cityId: number): Officer[] {
  const city = state.cities[cityId];
  if (!city || city.ruler == null) return [];
  const rulerId = state.factions[city.ruler]?.rulerId;
  const deployed = new Set(state.campaignArmies.flatMap((army) => [
    army.commanderId,
    ...army.subCommanderIds,
    ...(army.advisorId == null ? [] : [army.advisorId]),
    ...(army.subAdvisorId == null ? [] : [army.subAdvisorId]),
  ]));
  return city.officers
    .map((id) => state.officers[id])
    .filter((o): o is Officer =>
      !!o
      && o.faction === city.ruler
      && String(o.status) === 'active'
      && o.id !== rulerId
      && !deployed.has(o.id),
    )
    .sort((a, b) => a.loyalty - b.loyalty || a.id - b.id);
}

export function listWatchFirePartners(state: GameState, factionA: number, casterFactionId: number) {
  return Object.values(state.factions)
    .filter((f) => f.isAlive && f.id !== factionA && f.id !== casterFactionId)
    .filter((f) => {
      const link = findDiplomacy(state.diplomacy, factionA, f.id);
      return (link?.favorability ?? 0) >= WATCH_FIRE_MIN_FAVOR;
    })
    .sort((a, b) => a.id - b.id);
}

function relocateOfficer(
  cities: GameState['cities'],
  officers: GameState['officers'],
  officerId: number,
  toCityId: number,
): { cities: GameState['cities']; officers: GameState['officers'] } {
  const officer = officers[officerId];
  if (!officer) return { cities, officers };
  const fromId = officer.location;
  let nextCities = { ...cities };
  if (fromId != null && nextCities[fromId]) {
    const from = nextCities[fromId]!;
    nextCities[fromId] = {
      ...from,
      officers: from.officers.filter((id) => id !== officerId),
    };
  }
  const to = nextCities[toCityId];
  if (to && !to.officers.includes(officerId)) {
    nextCities[toCityId] = { ...to, officers: [...to.officers, officerId] };
  }
  return {
    cities: nextCities,
    officers: { ...officers, [officerId]: { ...officer, location: toCityId } },
  };
}

/** ACTIVE 结束/取消：原城仍属原势力则召回 */
function recallLureTigerOfficer(
  cities: GameState['cities'],
  officers: GameState['officers'],
  plot: Plot,
): { cities: GameState['cities']; officers: GameState['officers'] } {
  if (plot.targetOfficerId == null || plot.targetCityId == null || plot.targetFactionId == null) {
    return { cities, officers };
  }
  const origin = cities[plot.targetCityId];
  const officer = officers[plot.targetOfficerId];
  if (!origin || !officer) return { cities, officers };
  if (origin.ruler !== plot.targetFactionId) return { cities, officers };
  if (officer.faction !== plot.targetFactionId) return { cities, officers };
  if (officer.location === plot.targetCityId) return { cities, officers };
  return relocateOfficer(cities, officers, officer.id, plot.targetCityId);
}

function idlePlotAgent(
  intel: GameState['intel'],
  plot: Plot,
  cooldownMonths: number,
): GameState['intel'] {
  if (!plot.agentId || !intel?.agents?.[plot.agentId]) return intel;
  const agent = intel.agents[plot.agentId];
  if (agent.status === SpyStatus.CAPTIVE || agent.status === SpyStatus.DEAD) return intel;
  return {
    ...intel,
    agents: {
      ...intel.agents,
      [plot.agentId]: {
        ...agent,
        status: SpyStatus.IDLE,
        locationCityId: agent.homeCityId,
        cooldownMonths,
      },
    },
  };
}

function countActiveL2(plots: Plot[], factionId: number): number {
  return plots.filter(
    (p) =>
      p.casterFactionId === factionId &&
      p.stage !== PlotStage.RESOLVED &&
      (p.layer === 'strategic' || isL2Plot(p.type)),
  ).length;
}

/** 从施计方任意有金城扣月付；失败返回 null */
function payFactionGold(
  cities: GameState['cities'],
  factionId: number,
  amount: number,
): GameState['cities'] | null {
  if (amount <= 0) return cities;
  const payCity = Object.values(cities).find(
    (c) => c.ruler === factionId && c.gold >= amount,
  );
  if (!payCity) return null;
  return {
    ...cities,
    [payCity.id]: { ...payCity, gold: payCity.gold - amount },
  };
}

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<GameState> = {},
): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      { year: state.currentYear, month: state.currentMonth, type, message },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function getIntelDepth(state: GameState, cityId: number): 'none' | 'surface' | 'detailed' {
  const report = state.intel?.cities?.[cityId];
  if (!report) return 'none';
  return report.depth;
}

function plotTypeLabel(type: PlotType): string {
  switch (type) {
    case PlotType.HONEY_TRAP:
      return '美人计';
    case PlotType.SOW_DISCORD:
      return '离间计';
    case PlotType.FALSE_INTEL:
      return '假情报';
    case PlotType.EMPTY_FORT:
      return '空城疑兵';
    case PlotType.UNDERMINE:
      return '釜底抽薪';
    case PlotType.SECRET_CROSSING:
      return '暗渡陈仓';
    case PlotType.BLOSSOM:
      return '树上开花';
    case PlotType.KILL_CHICKEN:
      return '指桑骂槐';
    case PlotType.STRIKE_WHILE_HOT:
      return '趁火打劫';
    case PlotType.LURE_TIGER:
      return '调虎离山';
    case PlotType.INSTIGATE:
      return '借刀杀人';
    case PlotType.POACH:
      return '秘密挖角';
    case PlotType.WATCH_FIRE:
      return '隔岸观火';
    case PlotType.SWAP_PILLAR:
      return '偷梁换柱';
    case PlotType.EDICT:
      return '借尸还魂';
    default:
      return String(type);
  }
}

/**
 * 釜底抽薪战场联动：目标城 ACTIVE 成功生效中时，自该城出征军士气−15、粮耗×1.5
 */
export function getUndermineArmyModifiers(
  state: GameState,
  fromCityId: number,
): { moralePenalty: number; foodCostMul: number } | null {
  const hit = (state.plots ?? []).some(
    (p) =>
      p.type === PlotType.UNDERMINE &&
      p.stage === PlotStage.ACTIVE &&
      p.targetCityId === fromCityId &&
      p.result?.success === true &&
      !p.result?.detected,
  );
  if (!hit) return null;
  return {
    moralePenalty: UNDERMINE_MORALE_PENALTY,
    foodCostMul: UNDERMINE_FOOD_COST_MUL,
  };
}

/**
 * 暗渡陈仓战场联动：施计方对暗渡城出征时攻防 ×1.2
 */
export function getSecretCrossingBattleMul(
  state: GameState,
  attackerFactionId: number,
  targetCityId: number,
): number {
  const hit = (state.plots ?? []).some(
    (p) =>
      p.type === PlotType.SECRET_CROSSING &&
      p.stage === PlotStage.ACTIVE &&
      p.casterFactionId === attackerFactionId &&
      p.targetCityId === targetCityId &&
      p.result?.success === true &&
      !p.result?.detected,
  );
  return hit ? SECRET_CROSSING_BATTLE_MUL : 1;
}

/**
 * 明修城守军不得轻离：ACTIVE 暗渡陈仓的 feint 城禁止 AI 从此城出征
 */
export function isSecretCrossingGarrisonHold(state: GameState, cityId: number): boolean {
  return (state.plots ?? []).some(
    (p) =>
      p.type === PlotType.SECRET_CROSSING &&
      p.stage === PlotStage.ACTIVE &&
      p.feintCityId === cityId &&
      p.result?.success === true &&
      !p.result?.detected,
  );
}

/**
 * AI 攻城权重修正（1=中性；>1 更想打；<1 暂缓）
 * - 空城疑兵成功：×0.15
 * - 空城疑兵识破：×2.5
 * - 假情报诱饵（非施计方）：×2.2
 * - 暗渡陈仓明修城（非施计方）：×2.2
 * - 树上开花成功：×0.4
 */
export function getPlotAttackModifier(
  state: GameState,
  cityId: number,
  attackerFactionId: number,
): number {
  let mod = 1;
  for (const p of state.plots ?? []) {
    if (p.stage !== PlotStage.ACTIVE) continue;
    if (p.type === PlotType.EMPTY_FORT && p.targetCityId === cityId) {
      mod *= p.result?.inverted ? 2.5 : 0.15;
    } else if (p.type === PlotType.FALSE_INTEL && p.targetCityId === cityId) {
      if (p.casterFactionId !== attackerFactionId) {
        mod *= 2.2;
      }
    } else if (
      p.type === PlotType.SECRET_CROSSING &&
      p.feintCityId === cityId &&
      p.result?.success === true &&
      !p.result?.detected &&
      p.casterFactionId !== attackerFactionId
    ) {
      mod *= SECRET_CROSSING_FEINT_ATTACK_MUL;
    } else if (
      p.type === PlotType.BLOSSOM &&
      p.targetCityId === cityId &&
      p.result?.success === true &&
      !p.result?.detected
    ) {
      mod *= BLOSSOM_AI_ATTACK_MUL;
    } else if (
      p.type === PlotType.INSTIGATE &&
      p.stage === PlotStage.ACTIVE &&
      p.targetCityId === cityId &&
      p.secondaryFactionId === attackerFactionId &&
      p.result?.success === true &&
      !p.result?.detected
    ) {
      mod *= INSTIGATE_AI_ATTACK_MUL;
    }
  }
  return mod;
}

/**
 * 树上开花迷雾层兵力虚报：ACTIVE 成功未识破时，该城对敌显示兵力 ×2~3
 * （按城市 ID 奇偶确定性派生，不引入 RNG）；否则返回 1（真实兵力）。
 */
export function getBlossomTroopMul(state: GameState, cityId: number): number {
  const hit = (state.plots ?? []).some(
    (p) =>
      p.type === PlotType.BLOSSOM &&
      p.stage === PlotStage.ACTIVE &&
      p.targetCityId === cityId &&
      p.result?.success === true &&
      !p.result?.detected,
  );
  if (!hit) return 1;
  return cityId % 2 === 0 ? BLOSSOM_TROOP_MUL_MIN : BLOSSOM_TROOP_MUL_MAX;
}

/** 是否有对该城的空城威慑（成功未识破） */
export function isEmptyFortDeterring(state: GameState, cityId: number): boolean {
  return (state.plots ?? []).some(
    (p) =>
      p.stage === PlotStage.ACTIVE &&
      p.type === PlotType.EMPTY_FORT &&
      p.targetCityId === cityId &&
      !p.result?.inverted,
  );
}

/**
 * 目标势力当前同时与多少家其他势力处于战争（WAR）关系。
 * 交战真源 = diplomacy links 的 relation==='war'（isHostileOrAtWar 口径）。
 */
export function countWarsForFaction(
  state: GameState,
  factionId: number,
): number {
  return (state.diplomacy ?? []).filter(
    (l) =>
      (l.factionA === factionId || l.factionB === factionId) &&
      l.relation === DipRelation.WAR,
  ).length;
}

/**
 * 趁火打劫战场联动：施计方（attackerFactionId）对目标势力发起自动战时，
 * 若存在成功的趁火打劫 RESOLVED 记录且目标当前仍同时与≥2家交战 → 首击伤害×1.2；
 * 否则 1（目标已停战则效果自然消散，趁火打劫需"趁火"）。
 */
export function getStrikeWhileHotFirstHitMul(
  state: GameState,
  attackerFactionId: number,
  targetFactionId: number,
): number {
  const hit = (state.plots ?? []).some(
    (p) =>
      p.type === PlotType.STRIKE_WHILE_HOT &&
      p.stage === PlotStage.RESOLVED &&
      p.casterFactionId === attackerFactionId &&
      p.targetFactionId === targetFactionId &&
      p.result?.success === true &&
      !p.result?.detected,
  );
  if (!hit) return 1;
  return countWarsForFaction(state, targetFactionId) >= STRIKE_WHILE_HOT_MIN_WARS
    ? STRIKE_WHILE_HOT_FIRST_HIT_MUL
    : 1;
}

/**
 * 调虎离山战场联动：目标城 ACTIVE 且诱离成功 → 攻城 wallPenalty ×0.5。
 */
export function getLureTigerWallMul(state: GameState, cityId: number): number {
  const hit = (state.plots ?? []).some(
    (p) =>
      p.type === PlotType.LURE_TIGER &&
      p.stage === PlotStage.ACTIVE &&
      p.targetCityId === cityId &&
      p.result?.success === true &&
      !p.result?.detected,
  );
  return hit ? LURE_TIGER_WALL_MUL : 1;
}

export function isInstigateForcedAttack(
  state: GameState,
  attackerFactionId: number,
  targetCityId: number,
): boolean {
  return (state.plots ?? []).some(
    (p) =>
      p.type === PlotType.INSTIGATE &&
      p.stage === PlotStage.ACTIVE &&
      p.targetCityId === targetCityId &&
      p.secondaryFactionId === attackerFactionId &&
      p.result?.success === true &&
      !p.result?.detected,
  );
}

export function getSwapPillarLeadershipPenalty(state: GameState, cityId: number): number {
  const hit = (state.plots ?? []).some(
    (p) =>
      p.type === PlotType.SWAP_PILLAR &&
      p.stage === PlotStage.ACTIVE &&
      p.targetCityId === cityId &&
      p.result?.success === true &&
      !p.result?.detected,
  );
  return hit ? SWAP_PILLAR_LEADERSHIP_PENALTY : 0;
}

function setDipWar(
  diplomacy: GameState['diplomacy'],
  a: number,
  b: number,
): GameState['diplomacy'] {
  const existing = findDiplomacy(diplomacy, a, b);
  if (!existing) {
    return [
      ...diplomacy,
      { factionA: a, factionB: b, relation: DipRelation.WAR, favorability: -60 },
    ];
  }
  return diplomacy.map((l) => {
    const match =
      (l.factionA === a && l.factionB === b) ||
      (l.factionA === b && l.factionB === a);
    if (!match) return l;
    return {
      ...l,
      relation: DipRelation.WAR,
      favorability: Math.min(l.favorability, -60),
    };
  });
}

/**
 * 发起计谋
 */
export function launchPlot(
  state: GameState,
  opts: {
    type: PlotType;
    factionId?: number;
    targetFactionId?: number;
    targetCityId?: number;
    /** 暗渡陈仓：明修城；借刀杀人：第三方源城 */
    feintCityId?: number;
    /** 隔岸观火：第二势力；借刀杀人可省略（由源城派生） */
    secondaryFactionId?: number;
    targetOfficerId?: number;
    agentId?: string;
    casterOfficerId?: number;
  },
  rng: () => number,
): GameState {
  const fid = opts.factionId ?? state.playerFactionId;
  const faction = state.factions[fid];
  if (!faction) throw new Error('势力不存在');
  if (!faction.isAlive) throw new Error('势力已灭亡');

  const plots = state.plots ?? [];
  const active = plots.filter(
    (p) => p.casterFactionId === fid && p.stage !== PlotStage.RESOLVED,
  );
  if (active.length >= MAX_ACTIVE_PLOTS) {
    throw new Error(`进行中计谋已达上限 ${MAX_ACTIVE_PLOTS}`);
  }
  if (isL2Plot(opts.type) && countActiveL2(plots, fid) >= MAX_ACTIVE_L2_PLOTS) {
    throw new Error(`进行中战略计谋已达上限 ${MAX_ACTIVE_L2_PLOTS}`);
  }

  const type = opts.type;
  let cost: PlotCost;
  let targetFactionId: number | undefined = opts.targetFactionId;
  let targetCityId: number | undefined = opts.targetCityId;
  let feintCityId: number | undefined;
  let secondaryFactionId: number | undefined = opts.secondaryFactionId;
  let prepMonths = PREP_MONTHS;
  let layer: Plot['layer'] = 'tactical';
  let installments: Plot['installments'];
  let progress: number | undefined;
  let targetOfficerId = opts.targetOfficerId;

  if (type === PlotType.HONEY_TRAP) {
    cost = HONEY_TRAP_COST;
    if (targetCityId == null) throw new Error('美人计需指定目标城');
    const targetCity = state.cities[targetCityId];
    if (!targetCity) throw new Error('目标城不存在');
    if (targetCity.ruler == null) throw new Error('目标城无主，无法施展美人计');
    if (targetCity.ruler === fid) throw new Error('不能对己方城施展美人计');
    targetFactionId = targetCity.ruler;
  } else if (type === PlotType.SOW_DISCORD) {
    cost = SOW_DISCORD_COST;
    if (targetFactionId == null) throw new Error('离间计需指定目标势力');
    if (targetFactionId === fid) throw new Error('不能对自己施展离间计');
    const targetFac = state.factions[targetFactionId];
    if (!targetFac?.isAlive) throw new Error('目标势力不存在或已灭亡');
  } else if (type === PlotType.FALSE_INTEL) {
    cost = FALSE_INTEL_COST;
    if (targetCityId == null) throw new Error('假情报需指定目标城');
    const targetCity = state.cities[targetCityId];
    if (!targetCity) throw new Error('目标城不存在');
    if (targetCity.ruler == null) throw new Error('目标城无主');
    if (targetCity.ruler === fid) throw new Error('假情报须针对敌城');
    targetFactionId = targetCity.ruler;
  } else if (type === PlotType.EMPTY_FORT) {
    cost = EMPTY_FORT_COST;
    if (targetCityId == null) throw new Error('空城疑兵需指定己方城');
    const targetCity = state.cities[targetCityId];
    if (!targetCity) throw new Error('目标城不存在');
    if (targetCity.ruler !== fid) throw new Error('空城疑兵只能用于己方城');
    if (targetCity.troops >= EMPTY_FORT_TROOP_MAX) {
      throw new Error(
        `${targetCity.name} 兵力偏多（需 < ${EMPTY_FORT_TROOP_MAX}，当前 ${targetCity.troops}）`,
      );
    }
    if (targetCity.food < (cost.food ?? 0)) {
      throw new Error(`${targetCity.name} 粮草不足（需 ${cost.food}）`);
    }
    targetFactionId = undefined;
  } else if (type === PlotType.UNDERMINE) {
    cost = UNDERMINE_COST;
    layer = 'strategic';
    prepMonths = UNDERMINE_INSTALLMENT_MONTHS;
    progress = 0;
    installments = {
      goldPerMonth: UNDERMINE_MONTHLY_GOLD,
      months: UNDERMINE_INSTALLMENT_MONTHS,
      paidMonths: 0,
    };
    if (targetCityId == null) throw new Error('釜底抽薪需指定目标城');
    const targetCity = state.cities[targetCityId];
    if (!targetCity) throw new Error('目标城不存在');
    if (targetCity.ruler == null) throw new Error('目标城无主');
    if (targetCity.ruler === fid) throw new Error('釜底抽薪须针对敌城');
    targetFactionId = targetCity.ruler;
  } else if (type === PlotType.SECRET_CROSSING) {
    cost = SECRET_CROSSING_COST;
    layer = 'strategic';
    prepMonths = SECRET_CROSSING_PREP_MONTHS;
    progress = 0;
    if (targetCityId == null) throw new Error('暗渡陈仓需指定暗渡城');
    if (opts.feintCityId == null) throw new Error('暗渡陈仓需指定明修城');
    if (opts.feintCityId === targetCityId) throw new Error('明修城与暗渡城不可相同');
    const secretCity = state.cities[targetCityId];
    const feintCity = state.cities[opts.feintCityId];
    if (!secretCity || !feintCity) throw new Error('目标城不存在');
    if (secretCity.ruler == null || feintCity.ruler == null) throw new Error('目标城无主');
    if (secretCity.ruler === fid || feintCity.ruler === fid) {
      throw new Error('暗渡陈仓须针对两座敌城');
    }
    if (!roadNeighbors(targetCityId).includes(opts.feintCityId)) {
      throw new Error('明修城与暗渡城须官道邻接');
    }
    const secretDepth = getIntelDepth(state, targetCityId);
    const feintDepth = getIntelDepth(state, opts.feintCityId);
    if (secretDepth === 'none' || feintDepth === 'none') {
      throw new Error('需先对明修城与暗渡城取得至少 surface 情报');
    }
    feintCityId = opts.feintCityId;
    targetFactionId = secretCity.ruler;
  } else if (type === PlotType.BLOSSOM) {
    cost = BLOSSOM_COST;
    layer = 'strategic';
    prepMonths = PREP_MONTHS;
    progress = 0;
    if (targetCityId == null) throw new Error('树上开花需指定己方城');
    const targetCity = state.cities[targetCityId];
    if (!targetCity) throw new Error('目标城不存在');
    if (targetCity.ruler !== fid) throw new Error('树上开花只能用于己方城');
    if (targetCity.food < (cost.food ?? 0)) {
      throw new Error(`${targetCity.name} 粮草不足（需 ${cost.food}）`);
    }
    targetFactionId = undefined;
  } else if (type === PlotType.KILL_CHICKEN) {
    cost = KILL_CHICKEN_COST;
    layer = 'strategic';
    prepMonths = 0;
    const candidates = listKillChickenCandidates(state, fid);
    if (candidates.length < KILL_CHICKEN_MIN_LOW) {
      throw new Error(
        `指桑骂槐需己方至少 ${KILL_CHICKEN_MIN_LOW} 名忠诚偏低（<${KILL_CHICKEN_LOYALTY_THRESHOLD}）的在职武将`,
      );
    }
    if (opts.targetOfficerId != null) {
      const chosen = candidates.find((o) => o.id === opts.targetOfficerId);
      if (!chosen) {
        throw new Error('儆猴目标须为己方忠诚偏低的在职武将');
      }
    }
    targetFactionId = undefined;
    targetCityId = undefined;
  } else if (type === PlotType.STRIKE_WHILE_HOT) {
    cost = STRIKE_WHILE_HOT_COST;
    layer = 'strategic';
    prepMonths = 0;
    if (targetFactionId == null) throw new Error('趁火打劫需指定目标势力');
    if (targetFactionId === fid) throw new Error('不能对自己施展趁火打劫');
    const targetFac = state.factions[targetFactionId];
    if (!targetFac?.isAlive) throw new Error('目标势力不存在或已灭亡');
    if (countWarsForFaction(state, targetFactionId) < STRIKE_WHILE_HOT_MIN_WARS) {
      throw new Error(
        `趁火打劫需目标同时与≥${STRIKE_WHILE_HOT_MIN_WARS}家势力交战（当前 ${countWarsForFaction(state, targetFactionId)} 家）`,
      );
    }
    targetCityId = undefined;
  } else if (type === PlotType.LURE_TIGER) {
    cost = LURE_TIGER_COST;
    layer = 'strategic';
    prepMonths = LURE_TIGER_INSTALLMENT_MONTHS;
    progress = 0;
    installments = {
      goldPerMonth: LURE_TIGER_MONTHLY_GOLD,
      months: LURE_TIGER_INSTALLMENT_MONTHS,
      paidMonths: 0,
    };
    if (targetCityId == null) throw new Error('调虎离山需指定目标城');
    const targetCity = state.cities[targetCityId];
    if (!targetCity) throw new Error('目标城不存在');
    if (targetCity.ruler == null) throw new Error('目标城无主');
    if (targetCity.ruler === fid) throw new Error('调虎离山须针对敌城');
    if (opts.agentId == null) throw new Error('调虎离山必须派遣女间谍');
    const candidates = listLureTigerCandidates(state, targetCityId);
    if (candidates.length === 0) {
      throw new Error(`${targetCity.name} 无可诱离的守将（需在职非君主）`);
    }
    if (listLureTigerDestCities(state, targetCityId).length === 0) {
      throw new Error(`${targetCity.name} 所属势力仅一座城，无法诱离`);
    }
    if (targetOfficerId != null) {
      const chosen = candidates.find((o) => o.id === targetOfficerId);
      if (!chosen) throw new Error('诱离目标须为该城在职非君主守将');
    } else {
      targetOfficerId = candidates[0]!.id;
    }
    targetFactionId = targetCity.ruler;
  } else if (type === PlotType.INSTIGATE) {
    cost = INSTIGATE_COST;
    layer = 'strategic';
    prepMonths = INSTIGATE_PREP_MONTHS;
    progress = 0;
    if (targetCityId == null) throw new Error('借刀杀人需指定目标城');
    const targetCity = state.cities[targetCityId];
    if (!targetCity) throw new Error('目标城不存在');
    if (targetCity.ruler == null) throw new Error('目标城无主');
    if (targetCity.ruler === fid) throw new Error('借刀杀人须针对敌城');
    if (opts.agentId == null) throw new Error('借刀杀人必须派遣女间谍');
    const sources = listInstigateSourceCities(state, targetCityId, fid);
    if (sources.length === 0) {
      throw new Error(`${targetCity.name} 无邻接第三方势力可煽动`);
    }
    if (opts.feintCityId == null) throw new Error('借刀杀人需指定第三方源城');
    const source = sources.find((c) => c.id === opts.feintCityId);
    if (!source) throw new Error('第三方源城须与目标城官道邻接且属第三方');
    feintCityId = source.id;
    secondaryFactionId = source.ruler!;
    targetFactionId = targetCity.ruler;
  } else if (type === PlotType.POACH) {
    layer = 'strategic';
    prepMonths = POACH_INSTALLMENT_MONTHS;
    progress = 0;
    installments = {
      goldPerMonth: POACH_MONTHLY_GOLD,
      months: POACH_INSTALLMENT_MONTHS,
      paidMonths: 0,
    };
    if (targetCityId == null) throw new Error('秘密挖角需指定目标城');
    const targetCity = state.cities[targetCityId];
    if (!targetCity) throw new Error('目标城不存在');
    if (targetCity.ruler == null) throw new Error('目标城无主');
    if (targetCity.ruler === fid) throw new Error('秘密挖角须针对敌城');
    const candidates = listPoachCandidates(state, targetCityId);
    if (candidates.length === 0) {
      throw new Error(`${targetCity.name} 无可挖角武将（需在职非君主且未出征）`);
    }
    if (targetOfficerId == null) throw new Error('秘密挖角必须指定目标武将');
    const chosen = candidates.find((o) => o.id === targetOfficerId);
    if (!chosen) throw new Error('挖角目标须为该城在职非君主且未出征');
    cost = { gold: poachGoldCost(chosen), requiresIntel: 'detailed' };
    targetFactionId = targetCity.ruler;
  } else if (type === PlotType.WATCH_FIRE) {
    cost = WATCH_FIRE_COST;
    layer = 'strategic';
    prepMonths = WATCH_FIRE_INSTALLMENT_MONTHS;
    progress = 0;
    installments = {
      goldPerMonth: WATCH_FIRE_MONTHLY_GOLD,
      months: WATCH_FIRE_INSTALLMENT_MONTHS,
      paidMonths: 0,
    };
    if (targetFactionId == null || secondaryFactionId == null) {
      throw new Error('隔岸观火需指定两家目标势力');
    }
    if (targetFactionId === fid || secondaryFactionId === fid) {
      throw new Error('隔岸观火须针对两家其他势力');
    }
    if (targetFactionId === secondaryFactionId) throw new Error('隔岸观火两势力不可相同');
    const fa = state.factions[targetFactionId];
    const fb = state.factions[secondaryFactionId];
    if (!fa?.isAlive || !fb?.isAlive) throw new Error('目标势力不存在或已灭亡');
    const link = findDiplomacy(state.diplomacy, targetFactionId, secondaryFactionId);
    if ((link?.favorability ?? 0) < WATCH_FIRE_MIN_FAVOR) {
      throw new Error(`隔岸观火需两势力友好≥${WATCH_FIRE_MIN_FAVOR}（当前 ${link?.favorability ?? 0}）`);
    }
    targetCityId = undefined;
  } else if (type === PlotType.SWAP_PILLAR) {
    cost = SWAP_PILLAR_COST;
    layer = 'strategic';
    prepMonths = SWAP_PILLAR_PREP_MONTHS;
    progress = 0;
    if (targetCityId == null) throw new Error('偷梁换柱需指定目标城');
    const targetCity = state.cities[targetCityId];
    if (!targetCity) throw new Error('目标城不存在');
    if (targetCity.ruler == null) throw new Error('目标城无主');
    if (targetCity.ruler === fid) throw new Error('偷梁换柱须针对敌城');
    if (opts.agentId == null) throw new Error('偷梁换柱须派遣密探作为反间');
    targetFactionId = targetCity.ruler;
  } else if (type === PlotType.EDICT) {
    cost = EDICT_COST;
    layer = 'strategic';
    prepMonths = EDICT_PREP_MONTHS;
    progress = 0;
    if (targetFactionId == null) throw new Error('借尸还魂需指定目标势力');
    if (targetFactionId === fid) throw new Error('不能对自己施展借尸还魂');
    const targetFac = state.factions[targetFactionId];
    if (!targetFac?.isAlive) throw new Error('目标势力不存在或已灭亡');
    targetCityId = undefined;
  } else {
    throw new Error(`计谋类型 ${type} 暂未实现`);
  }

  // 扣金（空城疑兵金=0 可跳过）
  let cities = { ...state.cities };
  if (cost.gold > 0) {
    const payCity = Object.values(state.cities).find(
      (c) => c.ruler === fid && c.gold >= cost.gold,
    );
    if (!payCity) throw new Error(`金钱不足（需 ${cost.gold}）`);
    cities = {
      ...cities,
      [payCity.id]: { ...payCity, gold: payCity.gold - cost.gold },
    };
  }

  // 扣粮（空城疑兵从目标城）
  if (cost.food && targetCityId != null) {
    const c = cities[targetCityId];
    if (!c || c.food < cost.food) {
      throw new Error(`粮草不足（需 ${cost.food}）`);
    }
    cities = {
      ...cities,
      [targetCityId]: { ...c, food: c.food - cost.food },
    };
  }

  const factions = { ...state.factions };
  if (cost.beauty) {
    if ((faction.courtNetwork ?? 0) < cost.beauty) {
      throw new Error(`宫廷人脉不足（需 ${cost.beauty}）`);
    }
    factions[fid] = {
      ...faction,
      courtNetwork: (faction.courtNetwork ?? 0) - cost.beauty,
    };
  }

  // 情报前置（暗渡陈仓双城已在分支内校验）
  if (cost.requiresIntel && targetCityId != null && type !== PlotType.SECRET_CROSSING) {
    const depth = getIntelDepth(state, targetCityId);
    if (cost.requiresIntel === 'detailed' && depth !== 'detailed') {
      throw new Error('需先对目标城探秘获得 detailed 情报');
    }
    if (cost.requiresIntel === 'surface' && depth === 'none') {
      throw new Error('需先对目标城侦查获得至少 surface 情报');
    }
  }

  // 特工（美人计可选女间谍；调虎离山/借刀杀人必派女间谍；偷梁换柱任意密探=反间）
  if (opts.agentId) {
    const allowedAgent =
      type === PlotType.HONEY_TRAP
      || type === PlotType.LURE_TIGER
      || type === PlotType.INSTIGATE
      || type === PlotType.SWAP_PILLAR;
    if (!allowedAgent) {
      throw new Error('该计谋不可派遣特工');
    }
    const agent = state.intel?.agents?.[opts.agentId];
    if (!agent || agent.factionId !== fid) throw new Error('特工不存在');
    if (type !== PlotType.SWAP_PILLAR && agent.agentKind !== 'female') {
      throw new Error('须派遣女间谍');
    }
    if (agent.status !== SpyStatus.IDLE || agent.cooldownMonths > 0) {
      throw new Error('特工非空闲或冷却中');
    }
  } else if (type === PlotType.LURE_TIGER) {
    throw new Error('调虎离山必须派遣女间谍');
  } else if (type === PlotType.INSTIGATE) {
    throw new Error('借刀杀人必须派遣女间谍');
  } else if (type === PlotType.SWAP_PILLAR) {
    throw new Error('偷梁换柱须派遣密探作为反间');
  }

  if (type === PlotType.SOW_DISCORD && targetFactionId != null) {
    if (isAllied(state.diplomacy, fid, targetFactionId)) {
      throw new Error('不能对盟友施展离间计');
    }
  }

  let intel = state.intel;
  if (opts.agentId && intel?.agents) {
    const agent = intel.agents[opts.agentId];
    if (agent) {
      intel = {
        ...intel,
        agents: {
          ...intel.agents,
          [opts.agentId]: { ...agent, status: SpyStatus.DEPLOYED },
        },
      };
    }
  }

  const plotId = `plot-${fid}-${Math.floor(rng() * 0x1_0000_0000).toString(36)}-${plots.length + 1}`;

  // —— L2 指桑骂槐：即时结算（无 PREP/ACTIVE） ——
  if (type === PlotType.KILL_CHICKEN) {
    const candidates = listKillChickenCandidates(state, fid);
    let victim: Officer;
    if (opts.targetOfficerId != null) {
      victim = candidates.find((o) => o.id === opts.targetOfficerId)!;
    } else {
      victim = candidates[Math.floor(rng() * candidates.length)]!;
    }

    const rulerId = faction.rulerId;
    let officers = { ...state.officers };
    const beforeVictim = victim.loyalty;
    officers[victim.id] = {
      ...victim,
      loyalty: Math.max(0, victim.loyalty - KILL_CHICKEN_VICTIM_DROP),
    };

    const boosted: Array<{ name: string; delta: number }> = [];
    const others = Object.values(state.officers)
      .filter(
        (o) =>
          o.faction === fid &&
          String(o.status) === 'active' &&
          o.id !== rulerId &&
          o.id !== victim.id,
      )
      .sort((a, b) => a.id - b.id);
    for (const o of others) {
      const delta =
        KILL_CHICKEN_BOOST_MIN +
        Math.floor(
          rng() * (KILL_CHICKEN_BOOST_MAX - KILL_CHICKEN_BOOST_MIN + 1),
        );
      const nextLoyalty = Math.min(100, o.loyalty + delta);
      const applied = nextLoyalty - o.loyalty;
      officers[o.id] = { ...o, loyalty: nextLoyalty };
      if (applied > 0) boosted.push({ name: o.name, delta: applied });
    }

    const message = `指桑骂槐成功：儆 ${victim.name} 忠诚 ${beforeVictim}→${officers[victim.id]!.loyalty}（−${KILL_CHICKEN_VICTIM_DROP}）；其余 ${boosted.length} 将忠诚+${KILL_CHICKEN_BOOST_MIN}~${KILL_CHICKEN_BOOST_MAX}`;
    const newPlot: Plot = {
      id: plotId,
      type,
      casterFactionId: fid,
      casterOfficerId: opts.casterOfficerId ?? resolveCasterOfficer(state, fid),
      targetOfficerId: victim.id,
      stage: PlotStage.RESOLVED,
      monthsLeft: 0,
      cost,
      result: { success: true, detected: false, message },
      year: state.currentYear,
      month: state.currentMonth,
      layer: 'strategic',
    };

    let nextState = pushLog(
      state,
      'plot_launch',
      `${faction.name} 发起指桑骂槐（即时，耗 ${cost.gold}金）`,
      { cities, factions, intel, officers, plots: [...plots, newPlot] },
    );
    nextState = pushLog(nextState, 'plot_resolve', message);
    if (newPlot.casterOfficerId != null) {
      nextState = grantMeritTo(
        nextState,
        newPlot.casterOfficerId,
        MERIT_PLOT_SUCCESS,
      );
    }
    return nextState;
  }

  // —— L2 趁火打劫：即时结算（无 PREP/ACTIVE；效果 = 对该势力自动战首击×1.2） ——
  if (type === PlotType.STRIKE_WHILE_HOT) {
    const targetFac = state.factions[targetFactionId!];
    const wars = countWarsForFaction(state, targetFactionId!);
    const newPlot: Plot = {
      id: plotId,
      type,
      casterFactionId: fid,
      casterOfficerId: opts.casterOfficerId ?? resolveCasterOfficer(state, fid),
      targetFactionId,
      stage: PlotStage.RESOLVED,
      monthsLeft: 0,
      cost,
      result: {
        success: true,
        detected: false,
        message: `趁火打劫成功：${targetFac?.name ?? '目标'}正同时与 ${wars} 家交战，可趁乱首击（伤害×${STRIKE_WHILE_HOT_FIRST_HIT_MUL}）`,
      },
      year: state.currentYear,
      month: state.currentMonth,
      layer: 'strategic',
    };

    let nextState = pushLog(
      state,
      'plot_launch',
      `${faction.name} 发起趁火打劫（即时，耗 ${cost.gold}金）`,
      { cities, factions, intel, plots: [...plots, newPlot] },
    );
    nextState = pushLog(nextState, 'plot_resolve', newPlot.result!.message);
    if (newPlot.casterOfficerId != null) {
      nextState = grantMeritTo(
        nextState,
        newPlot.casterOfficerId,
        MERIT_PLOT_SUCCESS,
      );
    }
    return nextState;
  }

  const newPlot: Plot = {
    id: plotId,
    type,
    casterFactionId: fid,
    casterOfficerId: opts.casterOfficerId ?? resolveCasterOfficer(state, fid),
    targetFactionId,
    targetCityId,
    feintCityId,
    secondaryFactionId,
    targetOfficerId,
    agentId: opts.agentId,
    stage: PlotStage.PREP,
    monthsLeft: prepMonths,
    cost,
    year: state.currentYear,
    month: state.currentMonth,
    layer,
    progress,
    installments,
  };

  const typeLabel = plotTypeLabel(type);
  const targetName =
    type === PlotType.SECRET_CROSSING && targetCityId != null && feintCityId != null
      ? `明修${state.cities[feintCityId]?.name ?? feintCityId}/暗渡${state.cities[targetCityId]?.name ?? targetCityId}`
      : type === PlotType.EMPTY_FORT && targetCityId != null
        ? state.cities[targetCityId]?.name ?? '目标'
        : targetFactionId != null
          ? state.factions[targetFactionId]?.name ?? '目标'
          : state.cities[targetCityId!]?.name ?? '目标';

  const costParts: string[] = [];
  if (cost.gold > 0) costParts.push(`${cost.gold}金`);
  if (cost.food) costParts.push(`${cost.food}粮`);
  if (cost.beauty) costParts.push(`${cost.beauty}美女`);
  if (installments) {
    costParts.push(`另分期 ${installments.goldPerMonth}金×${installments.months}月`);
  }

  return pushLog(
    state,
    'plot_launch',
    `${faction.name} 发起${typeLabel}→${targetName}（准备 ${prepMonths} 月，耗 ${costParts.join('/') || '无'}）`,
    { cities, factions, intel, plots: [...plots, newPlot] },
  );
}

/**
 * 每月推进计谋：准备期倒计时 → 结算；ACTIVE 效果倒计时
 */
export function tickPlotsMonth(state: GameState, rng: () => number): GameState {
  const plots = state.plots ?? [];
  if (plots.length === 0) return state;

  let s = state;
  const nextPlots: Plot[] = [];
  let cities = { ...s.cities };
  let officers = { ...s.officers };
  let diplomacy = s.diplomacy;
  let factions = { ...s.factions };
  let intel = s.intel;
  const messages: string[] = [];

  for (const plot of plots) {
    if (plot.stage === PlotStage.RESOLVED) {
      nextPlots.push(plot);
      continue;
    }

    // ACTIVE：效果持续倒计时
    if (plot.stage === PlotStage.ACTIVE) {
      // 釜底抽薪生效期：每月商业 −10~20、金库流失 5~10%
      if (plot.type === PlotType.UNDERMINE && plot.targetCityId != null && plot.result?.success) {
        const city = cities[plot.targetCityId];
        if (city) {
          const commerceDrop = 10 + Math.floor(rng() * 11);
          const drainPct = 0.05 + rng() * 0.05;
          const goldDrain = Math.floor(city.gold * drainPct);
          cities = {
            ...cities,
            [city.id]: {
              ...city,
              gold: Math.max(0, city.gold - goldDrain),
              stats: {
                ...city.stats,
                commerce: Math.max(0, city.stats.commerce - commerceDrop),
              },
            },
          };
          messages.push(
            `${factions[plot.casterFactionId]?.name ?? `势力${plot.casterFactionId}`}：釜底抽薪耗蚀 ${city.name}（商−${commerceDrop}，金−${goldDrain}）`,
          );
        }
      }

      if (plot.type === PlotType.WATCH_FIRE && plot.result?.success && plot.targetFactionId != null && plot.secondaryFactionId != null) {
        const drop = 8 + Math.floor(rng() * 8);
        diplomacy = upsertDipFavor(
          { ...s, diplomacy, cities, officers, factions, intel },
          plot.targetFactionId,
          plot.secondaryFactionId,
          -drop,
        );
        const link = findDiplomacy(diplomacy, plot.targetFactionId, plot.secondaryFactionId);
        const aName = factions[plot.targetFactionId]?.name ?? '甲';
        const bName = factions[plot.secondaryFactionId]?.name ?? '乙';
        messages.push(
          `${factions[plot.casterFactionId]?.name ?? `势力${plot.casterFactionId}`}：隔岸观火 ${aName}↔${bName} 友好−${drop}（现 ${link?.favorability ?? 0}）`,
        );
        if (link?.relation === DipRelation.WAR || (link?.favorability ?? 0) <= -60) {
          diplomacy = setDipWar(diplomacy, plot.targetFactionId, plot.secondaryFactionId);
          nextPlots.push({
            ...plot,
            monthsLeft: 0,
            stage: PlotStage.RESOLVED,
            result: {
              success: true,
              detected: false,
              message: `隔岸观火：${aName} 与 ${bName} 爆发战争`,
            },
          });
          messages.push(`${aName} 与 ${bName} 因隔岸观火开战`);
          continue;
        }
      }

      if (plot.type === PlotType.EDICT && plot.result?.success && plot.targetFactionId != null) {
        const targetFid = plot.targetFactionId;
        for (const city of Object.values(cities)) {
          if (city.ruler !== targetFid) continue;
          cities = {
            ...cities,
            [city.id]: {
              ...city,
              stats: {
                ...city.stats,
                morale: Math.max(0, city.stats.morale - EDICT_MORALE_DROP),
              },
            },
          };
        }
        for (const o of Object.values(officers)) {
          if (o.faction !== targetFid || String(o.status) !== 'active') continue;
          if (o.id === factions[targetFid]?.rulerId) continue;
          officers = {
            ...officers,
            [o.id]: { ...o, loyalty: Math.max(0, o.loyalty - EDICT_LOYALTY_DROP) },
          };
        }
        messages.push(
          `${factions[plot.casterFactionId]?.name ?? `势力${plot.casterFactionId}`}：借尸还魂耗蚀 ${factions[targetFid]?.name ?? '目标'}（民心−${EDICT_MORALE_DROP}、将忠−${EDICT_LOYALTY_DROP}）`,
        );
      }

      const left = plot.monthsLeft - 1;
      if (left <= 0) {
        if (plot.type === PlotType.LURE_TIGER && plot.result?.success) {
          const recalled = recallLureTigerOfficer(cities, officers, plot);
          cities = recalled.cities;
          officers = recalled.officers;
        }
        nextPlots.push({
          ...plot,
          monthsLeft: 0,
          stage: PlotStage.RESOLVED,
          result: {
            success: plot.result?.success ?? true,
            detected: plot.result?.detected ?? false,
            inverted: plot.result?.inverted,
            message: `${plot.result?.message ?? plotTypeLabel(plot.type)}（效果结束）`,
          },
        });
        messages.push(`${factions[plot.casterFactionId]?.name ?? `势力${plot.casterFactionId}`}：${plotTypeLabel(plot.type)}效果结束`);
      } else {
        nextPlots.push({ ...plot, monthsLeft: left });
      }
      continue;
    }

    // PREP：L2 分期逐月扣金并推进进度
    if (
      (plot.type === PlotType.UNDERMINE
        || plot.type === PlotType.LURE_TIGER
        || plot.type === PlotType.POACH
        || plot.type === PlotType.WATCH_FIRE)
      && plot.installments
    ) {
      const monthly = plot.installments.goldPerMonth;
      const paid = payFactionGold(cities, plot.casterFactionId, monthly);
      if (!paid) {
        intel = idlePlotAgent(intel, plot, 0);
        nextPlots.push({
          ...plot,
          monthsLeft: 0,
          stage: PlotStage.RESOLVED,
          progress: plot.progress ?? 0,
          result: {
            success: false,
            detected: false,
            message: `${plotTypeLabel(plot.type)}因金不足中止（已投 ${plot.installments.paidMonths} 期）`,
          },
        });
        messages.push(
          `${factions[plot.casterFactionId]?.name ?? `势力${plot.casterFactionId}`}：${plotTypeLabel(plot.type)}因金不足中止`,
        );
        continue;
      }
      cities = paid;
      const paidMonths = plot.installments.paidMonths + 1;
      const progress = Math.min(100, Math.round((paidMonths / plot.installments.months) * 100));
      const monthsLeft = plot.monthsLeft - 1;
      const advanced: Plot = {
        ...plot,
        monthsLeft: Math.max(0, monthsLeft),
        progress,
        installments: { ...plot.installments, paidMonths },
      };
      if (monthsLeft > 0) {
        nextPlots.push(advanced);
        continue;
      }
      // 分期完投 → 结算
      const result = resolvePlot(s, advanced, cities, officers, diplomacy, factions, intel, rng);
      cities = result.cities;
      officers = result.officers;
      diplomacy = result.diplomacy;
      factions = result.factions;
      intel = result.intel;
      if (result.success && advanced.casterOfficerId != null) {
        officers = grantMeritTo({ ...s, officers }, advanced.casterOfficerId, MERIT_PLOT_SUCCESS).officers;
      }
      messages.push(`${factions[advanced.casterFactionId]?.name ?? `势力${advanced.casterFactionId}`}：${result.message}`);
      if (result.enterActive) {
        nextPlots.push({
          ...advanced,
          monthsLeft: result.activeMonths,
          stage: PlotStage.ACTIVE,
          progress: 100,
          result: {
            success: result.success,
            detected: result.detected,
            inverted: result.inverted,
            message: result.message,
          },
        });
      } else {
        nextPlots.push({
          ...advanced,
          monthsLeft: 0,
          stage: PlotStage.RESOLVED,
          progress: 100,
          result: {
            success: result.success,
            detected: result.detected,
            inverted: result.inverted,
            message: result.message,
          },
        });
      }
      continue;
    }

    // PREP（L1）
    const monthsLeft = plot.monthsLeft - 1;
    if (monthsLeft > 0) {
      nextPlots.push({ ...plot, monthsLeft });
      continue;
    }

    const result = resolvePlot(s, plot, cities, officers, diplomacy, factions, intel, rng);
    cities = result.cities;
    officers = result.officers;
    diplomacy = result.diplomacy;
    factions = result.factions;
    intel = result.intel;
    // 军事功绩：计谋成功 +5（执行武将 casterOfficerId，君主不发守卫在 grantMeritTo 内）
    if (result.success && plot.casterOfficerId != null) {
      officers = grantMeritTo({ ...s, officers }, plot.casterOfficerId, MERIT_PLOT_SUCCESS).officers;
    }
    messages.push(`${factions[plot.casterFactionId]?.name ?? `势力${plot.casterFactionId}`}：${result.message}`);

    if (result.enterActive) {
      nextPlots.push({
        ...plot,
        monthsLeft: result.activeMonths,
        stage: PlotStage.ACTIVE,
        progress: plot.layer === 'strategic' ? 100 : plot.progress,
        result: {
          success: result.success,
          detected: result.detected,
          inverted: result.inverted,
          message: result.message,
        },
      });
    } else {
      nextPlots.push({
        ...plot,
        monthsLeft: 0,
        stage: PlotStage.RESOLVED,
        progress: plot.layer === 'strategic' ? 100 : plot.progress,
        result: {
          success: result.success,
          detected: result.detected,
          inverted: result.inverted,
          message: result.message,
        },
      });
    }
  }

  s = { ...s, cities, officers, diplomacy, factions, intel, plots: nextPlots };

  if (messages.length > 0) {
    s = pushLog(s, 'plot_resolve', `【计谋】${messages.join('；')}`);
  }

  return s;
}

function resolvePlot(
  state: GameState,
  plot: Plot,
  cities: GameState['cities'],
  officers: GameState['officers'],
  diplomacy: GameState['diplomacy'],
  factions: GameState['factions'],
  intel: GameState['intel'],
  rng: () => number,
): {
  cities: GameState['cities'];
  officers: GameState['officers'];
  diplomacy: GameState['diplomacy'];
  factions: GameState['factions'];
  intel: GameState['intel'];
  message: string;
  success: boolean;
  detected: boolean;
  inverted?: boolean;
  enterActive: boolean;
  activeMonths: number;
} {
  const fid = plot.casterFactionId;

  let successChance = 45;
  let detectChance = 20;

  const hasFemaleSpy = plot.agentId && intel?.agents?.[plot.agentId]?.agentKind === 'female';
  const isL2 = isL2Plot(plot.type);

  if (isL2) {
    // docs/04 §31.8 L2：基础 35 + 每期 +5 + detailed +10；识破基础 25
    // 无分期的 L2（暗渡陈仓）完投 prep 计 1 期
    const periods = plot.installments?.paidMonths ?? 1;
    successChance = 35 + periods * 5;
    detectChance = 25;
    if (hasFemaleSpy) {
      successChance += 15;
      detectChance += 10;
    }
    if (plot.targetCityId != null) {
      const depth = getIntelDepth({ ...state, intel }, plot.targetCityId);
      if (depth === 'detailed') successChance += 10;
    }
    if (plot.type === PlotType.EDICT && !controlsEmperor(state, fid)) {
      detectChance += EDICT_FORGE_DETECT_BONUS;
    }
    if (plot.type === PlotType.EDICT && controlsEmperor(state, fid)) {
      successChance += 10;
    }
  } else {
    if (hasFemaleSpy) {
      successChance += 20;
      detectChance += 10;
    }

    if (plot.targetCityId != null) {
      const depth = getIntelDepth({ ...state, intel }, plot.targetCityId);
      if (depth === 'detailed') successChance += 15;
    }
  }

  if (plot.targetCityId != null) {
    const defense = intel?.cityDefense?.[plot.targetCityId];
    if (defense && defense.level > 0) {
      const perLevel = isL2 ? 10 : 8;
      detectChance += defense.level * perLevel;
      successChance -= defense.level * perLevel;
    }
  }

  // 空城疑兵：己方城无外来反间，成功率略高
  if (plot.type === PlotType.EMPTY_FORT) {
    successChance = Math.max(successChance, 55);
    detectChance = Math.min(detectChance, 35);
  }
  // 假情报：有 detailed 时已 +15
  if (plot.type === PlotType.FALSE_INTEL) {
    successChance = Math.max(successChance, 50);
  }

  successChance = Math.max(isL2 ? 10 : 10, Math.min(85, successChance));
  detectChance = Math.max(isL2 ? 10 : 5, Math.min(isL2 ? 85 : 75, detectChance));

  const success = rng() * 100 < successChance;
  const detected = rng() * 100 < detectChance;

  let message = '';
  let nextDiplomacy = diplomacy;
  let nextOfficers = officers;
  let nextCities = cities;
  let nextIntel = intel;
  let inverted = false;
  let enterActive = false;
  let activeMonths = 0;

  const targetFacName =
    plot.targetFactionId != null
      ? factions[plot.targetFactionId]?.name ?? '目标'
      : '目标';
  const cityName =
    plot.targetCityId != null
      ? cities[plot.targetCityId]?.name ?? '目标城'
      : '目标城';

  // —— 假情报 ——
  if (plot.type === PlotType.FALSE_INTEL) {
    if (success && !detected) {
      enterActive = true;
      activeMonths = EFFECT_MONTHS;
      message = `假情报成功：敌方将优先觊觎 ${cityName}（${EFFECT_MONTHS} 月）`;
    } else if (detected) {
      // 识破无效：无外交惩罚、无效果
      message = `假情报被识破，归于无效（对 ${cityName}）`;
    } else {
      message = `假情报失败（${cityName}）`;
    }
  }
  // —— 空城疑兵 ——
  else if (plot.type === PlotType.EMPTY_FORT) {
    if (detected) {
      inverted = true;
      enterActive = true;
      activeMonths = EXPOSED_MONTHS;
      message = `空城疑兵被识破：${cityName} 反成敌军优先目标（${EXPOSED_MONTHS} 月）`;
    } else if (success) {
      enterActive = true;
      activeMonths = EFFECT_MONTHS;
      message = `空城疑兵成功：${cityName} 暂缓被攻（${EFFECT_MONTHS} 月）`;
    } else {
      message = `空城疑兵失败（${cityName}）`;
    }
  }
  // —— L2 釜底抽薪 ——
  else if (plot.type === PlotType.UNDERMINE) {
    if (success && !detected) {
      enterActive = true;
      activeMonths = UNDERMINE_EFFECT_MONTHS;
      message = `釜底抽薪成功：${cityName} 将持续 ${UNDERMINE_EFFECT_MONTHS} 月遭经济破坏（出兵士气−${UNDERMINE_MORALE_PENALTY}、粮耗×${UNDERMINE_FOOD_COST_MUL}）`;
    } else if (detected) {
      message = `釜底抽薪被识破（对 ${cityName}）`;
    } else {
      message = `釜底抽薪失败（${cityName}）`;
    }
  }
  // —— L2 暗渡陈仓 ——
  else if (plot.type === PlotType.SECRET_CROSSING) {
    const feintName =
      plot.feintCityId != null ? cities[plot.feintCityId]?.name ?? '明修城' : '明修城';
    if (success && !detected) {
      enterActive = true;
      activeMonths = SECRET_CROSSING_EFFECT_MONTHS;
      message = `暗渡陈仓成功：明修 ${feintName} 牵制守备，对暗渡 ${cityName} 出征攻防×${SECRET_CROSSING_BATTLE_MUL}（${SECRET_CROSSING_EFFECT_MONTHS} 月）`;
    } else if (detected) {
      message = `暗渡陈仓被识破（明修 ${feintName} / 暗渡 ${cityName}）`;
    } else {
      message = `暗渡陈仓失败（${cityName}）`;
    }
  }
  // —— L2 树上开花 ——
  else if (plot.type === PlotType.BLOSSOM) {
    if (success && !detected) {
      enterActive = true;
      activeMonths = BLOSSOM_EFFECT_MONTHS;
      const troopMul =
        plot.targetCityId != null && plot.targetCityId % 2 === 0
          ? BLOSSOM_TROOP_MUL_MIN
          : BLOSSOM_TROOP_MUL_MAX;
      message = `树上开花成功：${cityName} 对敌显示兵力×${troopMul}，AI 暂缓来攻（${BLOSSOM_EFFECT_MONTHS} 月）`;
    } else if (detected) {
      message = `树上开花被识破（${cityName}）`;
    } else {
      message = `树上开花失败（${cityName}）`;
    }
  }
  // —— L2 调虎离山 ——
  else if (plot.type === PlotType.LURE_TIGER) {
    const dests = listLureTigerDestCities({ ...state, cities: nextCities, officers: nextOfficers }, plot.targetCityId!);
    const tigerId = plot.targetOfficerId;
    const tiger = tigerId != null ? nextOfficers[tigerId] : undefined;
    const stillInCity =
      tiger != null
      && plot.targetCityId != null
      && (tiger.location === plot.targetCityId
        || nextCities[plot.targetCityId]?.officers.includes(tiger.id));
    if (success && !detected && tiger && stillInCity && dests.length > 0) {
      const dest = dests[Math.floor(rng() * dests.length)]!;
      const moved = relocateOfficer(nextCities, nextOfficers, tiger.id, dest.id);
      nextCities = moved.cities;
      nextOfficers = moved.officers;
      enterActive = true;
      activeMonths = LURE_TIGER_EFFECT_MONTHS;
      message = `调虎离山成功：${tiger.name} 被诱往 ${dest.name}，${cityName} 城防减半（${LURE_TIGER_EFFECT_MONTHS} 月）`;
    } else if (detected) {
      message = `调虎离山被识破（对 ${cityName}）`;
    } else if (!stillInCity) {
      message = `调虎离山失败：目标已不在 ${cityName}`;
    } else if (dests.length === 0) {
      message = `调虎离山失败：${cityName} 已无他城可诱往`;
    } else {
      message = `调虎离山失败（${cityName}）`;
    }
  }
  // —— L2 借刀杀人 ——
  else if (plot.type === PlotType.INSTIGATE) {
    const thirdName =
      plot.secondaryFactionId != null
        ? factions[plot.secondaryFactionId]?.name ?? '第三方'
        : '第三方';
    const sourceName =
      plot.feintCityId != null ? cities[plot.feintCityId]?.name ?? '源城' : '源城';
    if (success && !detected && plot.secondaryFactionId != null && plot.targetFactionId != null) {
      nextDiplomacy = setDipWar(nextDiplomacy, plot.secondaryFactionId, plot.targetFactionId);
      enterActive = true;
      activeMonths = INSTIGATE_EFFECT_MONTHS;
      message = `借刀杀人成功：煽动 ${thirdName} 自 ${sourceName} 攻 ${cityName}（宣战，${INSTIGATE_EFFECT_MONTHS} 月内必攻）`;
    } else if (detected) {
      message = `借刀杀人被识破（对 ${cityName}）`;
    } else {
      message = `借刀杀人失败（${cityName}）`;
    }
  }
  // —— L2 秘密挖角 ——
  else if (plot.type === PlotType.POACH) {
    const victim = plot.targetOfficerId != null ? nextOfficers[plot.targetOfficerId] : undefined;
    const home = Object.values(nextCities).find((c) => c.ruler === fid && c.isCapital)
      ?? Object.values(nextCities).find((c) => c.ruler === fid);
    const stillThere =
      victim != null
      && plot.targetCityId != null
      && victim.faction === plot.targetFactionId
      && (victim.location === plot.targetCityId || nextCities[plot.targetCityId]?.officers.includes(victim.id));
    if (success && !detected && victim && stillThere && home) {
      const fromCity = plot.targetCityId != null ? nextCities[plot.targetCityId] : undefined;
      const take = fromCity
        ? Math.min(POACH_TROOP_TAKE_MAX, Math.floor(fromCity.troops * 0.1))
        : 0;
      if (fromCity && take > 0) {
        nextCities = {
          ...nextCities,
          [fromCity.id]: { ...fromCity, troops: fromCity.troops - take },
        };
      }
      const dest = nextCities[home.id]!;
      nextCities = {
        ...nextCities,
        [home.id]: { ...dest, troops: dest.troops + take, officers: dest.officers.includes(victim.id) ? dest.officers : [...dest.officers, victim.id] },
      };
      if (plot.targetCityId != null && nextCities[plot.targetCityId]) {
        const origin = nextCities[plot.targetCityId]!;
        nextCities = {
          ...nextCities,
          [origin.id]: { ...origin, officers: origin.officers.filter((id) => id !== victim.id) },
        };
      }
      nextOfficers = {
        ...nextOfficers,
        [victim.id]: {
          ...victim,
          faction: fid,
          location: home.id,
          loyalty: 60,
        },
      };
      message = `秘密挖角成功：${victim.name} 投奔，带走 ${take} 兵入 ${home.name}`;
    } else if (detected) {
      message = `秘密挖角被识破（${victim?.name ?? cityName}）`;
    } else {
      message = `秘密挖角失败（${victim?.name ?? cityName}）`;
    }
  }
  // —— L2 隔岸观火 ——
  else if (plot.type === PlotType.WATCH_FIRE) {
    const aName = plot.targetFactionId != null ? factions[plot.targetFactionId]?.name ?? '甲' : '甲';
    const bName = plot.secondaryFactionId != null ? factions[plot.secondaryFactionId]?.name ?? '乙' : '乙';
    if (success && !detected) {
      enterActive = true;
      activeMonths = WATCH_FIRE_MAX_ACTIVE_MONTHS;
      message = `隔岸观火成功：开始离间 ${aName} 与 ${bName}`;
    } else if (detected) {
      message = `隔岸观火被识破（${aName}/${bName}）`;
    } else {
      message = `隔岸观火失败（${aName}/${bName}）`;
    }
  }
  // —— L2 偷梁换柱 ——
  else if (plot.type === PlotType.SWAP_PILLAR) {
    const city = plot.targetCityId != null ? nextCities[plot.targetCityId] : undefined;
    const rulerId = city?.ruler != null ? factions[city.ruler]?.rulerId : undefined;
    const inCity = (city?.officers ?? [])
      .map((id) => nextOfficers[id])
      .filter((o): o is Officer =>
        !!o && o.faction === city?.ruler && String(o.status) === 'active' && o.id !== rulerId,
      )
      .sort((a, b) => b.stats.leadership - a.stats.leadership || a.id - b.id);
    const others = city?.ruler != null
      ? Object.values(nextCities).filter((c) => c.ruler === city.ruler && c.id !== city.id)
      : [];
    let weak: Officer | undefined;
    let weakCityId: number | undefined;
    for (const oc of others.sort((a, b) => a.id - b.id)) {
      const pool = oc.officers
        .map((id) => nextOfficers[id])
        .filter((o): o is Officer =>
          !!o && o.faction === oc.ruler && String(o.status) === 'active' && o.id !== rulerId,
        )
        .sort((a, b) => a.stats.leadership - b.stats.leadership || a.id - b.id);
      if (pool[0]) {
        weak = pool[0];
        weakCityId = oc.id;
        break;
      }
    }
    const ace = inCity[0];
    if (success && !detected && ace && city) {
      if (weak && weakCityId != null) {
        const movedAce = relocateOfficer(nextCities, nextOfficers, ace.id, weakCityId);
        const movedWeak = relocateOfficer(movedAce.cities, movedAce.officers, weak.id, city.id);
        nextCities = movedWeak.cities;
        nextOfficers = movedWeak.officers;
        message = `偷梁换柱成功：${ace.name} 调离 ${cityName}，${weak.name} 上位（统率−${SWAP_PILLAR_LEADERSHIP_PENALTY}，${SWAP_PILLAR_EFFECT_MONTHS} 月）`;
      } else {
        message = `偷梁换柱成功：${cityName} 守军统率−${SWAP_PILLAR_LEADERSHIP_PENALTY}（${SWAP_PILLAR_EFFECT_MONTHS} 月；无他城可对调）`;
      }
      enterActive = true;
      activeMonths = SWAP_PILLAR_EFFECT_MONTHS;
    } else if (detected) {
      message = `偷梁换柱被识破（对 ${cityName}）`;
    } else {
      message = `偷梁换柱失败（${cityName}）`;
    }
  }
  // —— L2 借尸还魂 ——
  else if (plot.type === PlotType.EDICT) {
    const hasEmperor = controlsEmperor(state, fid);
    if (success && !detected) {
      enterActive = true;
      activeMonths = EDICT_EFFECT_MONTHS;
      message = hasEmperor
        ? `借尸还魂成功：以天子名义诋毁 ${targetFacName}（民心月降−${EDICT_MORALE_DROP}，${EDICT_EFFECT_MONTHS} 月）`
        : `借尸还魂成功：伪造诏令诋毁 ${targetFacName}（民心月降−${EDICT_MORALE_DROP}，${EDICT_EFFECT_MONTHS} 月）`;
    } else if (detected) {
      message = hasEmperor
        ? `借尸还魂被识破（对 ${targetFacName}）`
        : `伪造诏令被揭穿（对 ${targetFacName}）`;
    } else {
      message = `借尸还魂失败（${targetFacName}）`;
    }
  }
  // —— 美人计 / 离间（即时结算） ——
  else if (success) {
    if (plot.type === PlotType.HONEY_TRAP) {
      const targetCity = plot.targetCityId != null ? cities[plot.targetCityId] : null;
      const targetFid = plot.targetFactionId;

      if (targetCity && targetFid != null) {
        const inCity = Object.values(nextOfficers).filter(
          (o) =>
            o.faction === targetFid &&
            o.location === plot.targetCityId &&
            String(o.status) === 'active',
        );
        if (inCity.length > 0) {
          const victim =
            plot.targetOfficerId != null && nextOfficers[plot.targetOfficerId]
              ? nextOfficers[plot.targetOfficerId]
              : inCity[Math.floor(rng() * inCity.length)];
          const drop = 25 + Math.floor(rng() * 20) + (hasFemaleSpy ? 15 : 0);
          nextOfficers = {
            ...nextOfficers,
            [victim.id]: {
              ...victim,
              loyalty: Math.max(0, victim.loyalty - drop),
            },
          };
          message = `美人计成功：${targetFacName} 武将 ${victim.name} 忠诚 −${drop}`;
        } else {
          const drop = 10 + Math.floor(rng() * 15);
          const others = Object.values(factions).filter(
            (f) => f.id !== fid && f.id !== targetFid && f.isAlive,
          );
          if (others.length > 0) {
            const third = others[Math.floor(rng() * others.length)];
            nextDiplomacy = upsertDipFavor(
              { ...state, diplomacy: nextDiplomacy },
              targetFid,
              third.id,
              -drop,
            );
            message = `美人计成功：${targetFacName} 对 ${third.name} 友好 −${drop}`;
          } else {
            message = '美人计成功（无将可惑，无第三方可离间）';
          }
        }
      }
    } else if (plot.type === PlotType.SOW_DISCORD) {
      const targetFid = plot.targetFactionId!;
      const others = Object.values(factions).filter(
        (f) => f.id !== fid && f.id !== targetFid && f.isAlive,
      );
      // B1: 用当前 diplomacy（含本轮前序计谋修改）而非 state.diplomacy（tick 开头快照）
      const withRelation = others.filter((f) =>
        findDiplomacy(diplomacy, targetFid, f.id),
      );
      const pool = withRelation.length > 0 ? withRelation : others;
      if (pool.length > 0) {
        const third = pool[Math.floor(rng() * pool.length)];
        const drop = 15 + Math.floor(rng() * 15) + (hasFemaleSpy ? 10 : 0);
        nextDiplomacy = upsertDipFavor(
          { ...state, diplomacy: nextDiplomacy },
          targetFid,
          third.id,
          -drop,
        );
        message = `离间计成功：${targetFacName} 与 ${third.name} 友好 −${drop}`;
      } else {
        message = '离间计成功（无第三方可离间）';
      }
    }
  } else {
    message =
      plot.type === PlotType.HONEY_TRAP
        ? '美人计失败'
        : plot.type === PlotType.SOW_DISCORD
          ? '离间计失败'
          : `${plotTypeLabel(plot.type)}失败`;
  }

  // 识破外交惩罚（假情报识破无效；空城识破已用 inverted）
  if (
    detected &&
    plot.type !== PlotType.FALSE_INTEL &&
    plot.type !== PlotType.EMPTY_FORT
  ) {
    let detectedMsg = '行动暴露';
    if (plot.targetFactionId != null) {
      const favorHit = isL2
        ? -(25 + Math.floor(rng() * 26))
        : hasFemaleSpy
          ? -30
          : -15;
      nextDiplomacy = upsertDipFavor(
        { ...state, diplomacy: nextDiplomacy },
        fid,
        plot.targetFactionId,
        favorHit,
      );
      detectedMsg = `${targetFacName} 识破计谋（友好${favorHit}）`;
    }
    message += `；${detectedMsg}`;
  }

  // 女间谍回收
  if (plot.agentId && nextIntel?.agents?.[plot.agentId]) {
    const agent = nextIntel.agents[plot.agentId];
    if (detected && !success && rng() < 0.4 && plot.targetFactionId != null) {
      nextIntel = {
        ...nextIntel,
        agents: {
          ...nextIntel.agents,
          [plot.agentId]: {
            ...agent,
            status: SpyStatus.CAPTIVE,
            locationCityId: plot.targetCityId ?? agent.locationCityId,
            captiveByFactionId: plot.targetFactionId,
            cooldownMonths: 0,
          },
        },
      };
      message += `；女间谍 ${agent.name} 被捕`;
    } else {
      nextIntel = {
        ...nextIntel,
        agents: {
          ...nextIntel.agents,
          [plot.agentId]: {
            ...agent,
            status: SpyStatus.IDLE,
            locationCityId: agent.homeCityId,
            cooldownMonths: detected ? 2 : 1,
          },
        },
      };
    }
  }

  return {
    cities: nextCities,
    officers: nextOfficers,
    diplomacy: nextDiplomacy,
    factions,
    intel: nextIntel,
    message,
    success,
    detected,
    inverted: inverted || undefined,
    enterActive,
    activeMonths,
  };
}

/**
 * 提前终止 L2 计谋（沉没成本不返还）。L1 不可取消。
 */
export function cancelPlot(state: GameState, plotId: string, factionId?: number): GameState {
  const fid = factionId ?? state.playerFactionId;
  const plots = state.plots ?? [];
  const idx = plots.findIndex((p) => p.id === plotId);
  if (idx < 0) throw new Error('计谋不存在');
  const plot = plots[idx]!;
  if (plot.casterFactionId !== fid) throw new Error('只能终止己方计谋');
  if (!isL2Plot(plot.type) && plot.layer !== 'strategic') {
    throw new Error('仅战略计谋（L2）可提前终止');
  }
  if (plot.stage === PlotStage.RESOLVED) throw new Error('计谋已结束');

  const nextPlots = [...plots];
  let nextCities = state.cities;
  let nextOfficers = state.officers;
  let nextIntel = idlePlotAgent(state.intel, plot, 0);
  if (plot.type === PlotType.LURE_TIGER && plot.stage === PlotStage.ACTIVE && plot.result?.success) {
    const recalled = recallLureTigerOfficer(nextCities, nextOfficers, plot);
    nextCities = recalled.cities;
    nextOfficers = recalled.officers;
  }
  nextPlots[idx] = {
    ...plot,
    monthsLeft: 0,
    stage: PlotStage.RESOLVED,
    result: {
      success: false,
      detected: false,
      message: `${plotTypeLabel(plot.type)}已提前终止（沉没成本不返还）`,
    },
  };

  return pushLog(
    state,
    'plot_cancel',
    `${state.factions[fid]?.name ?? `势力${fid}`} 提前终止${plotTypeLabel(plot.type)}`,
    { plots: nextPlots, cities: nextCities, officers: nextOfficers, intel: nextIntel },
  );
}
