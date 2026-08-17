// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 计谋主引擎 S17：L1 美人计/离间/假情报/空城 + L2 釜底抽薪 / 暗渡陈仓
 * 设计真源 docs/04 §31
 */
import {
  PlotStage,
  PlotType,
  SpyStatus,
  findDiplomacy,
  isAllied,
  roadNeighbors,
  type GameState,
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
    type === PlotType.BLOSSOM
  );
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
 * 发起计谋
 */
export function launchPlot(
  state: GameState,
  opts: {
    type: PlotType;
    factionId?: number;
    targetFactionId?: number;
    targetCityId?: number;
    /** 暗渡陈仓：明修城 */
    feintCityId?: number;
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
  let prepMonths = PREP_MONTHS;
  let layer: Plot['layer'] = 'tactical';
  let installments: Plot['installments'];
  let progress: number | undefined;

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

  // 女间谍（仅美人计）
  if (opts.agentId) {
    if (type !== PlotType.HONEY_TRAP) {
      throw new Error('仅美人计可派女间谍');
    }
    const agent = state.intel?.agents?.[opts.agentId];
    if (!agent || agent.factionId !== fid) throw new Error('特工不存在');
    if (agent.agentKind !== 'female') throw new Error('美人计仅可派女间谍');
    if (agent.status !== 'idle' || agent.cooldownMonths > 0) {
      throw new Error('特工非空闲或冷却中');
    }
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
  const newPlot: Plot = {
    id: plotId,
    type,
    casterFactionId: fid,
    casterOfficerId: opts.casterOfficerId ?? resolveCasterOfficer(state, fid),
    targetFactionId,
    targetCityId,
    feintCityId,
    targetOfficerId: opts.targetOfficerId,
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

      const left = plot.monthsLeft - 1;
      if (left <= 0) {
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
    if (plot.type === PlotType.UNDERMINE && plot.installments) {
      const monthly = plot.installments.goldPerMonth;
      const paid = payFactionGold(cities, plot.casterFactionId, monthly);
      if (!paid) {
        nextPlots.push({
          ...plot,
          monthsLeft: 0,
          stage: PlotStage.RESOLVED,
          progress: plot.progress ?? 0,
          result: {
            success: false,
            detected: false,
            message: `釜底抽薪因金不足中止（已投 ${plot.installments.paidMonths} 期）`,
          },
        });
        messages.push(
          `${factions[plot.casterFactionId]?.name ?? `势力${plot.casterFactionId}`}：釜底抽薪因金不足中止`,
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
    cities,
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
    { plots: nextPlots },
  );
}
