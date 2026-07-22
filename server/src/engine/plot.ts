// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 计谋主引擎 S17：美人计 / 离间计 / 假情报 / 空城疑兵
 * 设计真源 docs/04 §31
 */
import {
  PlotStage,
  PlotType,
  SpyStatus,
  findDiplomacy,
  isAllied,
  type GameState,
  type Plot,
  type PlotCost,
} from '@leh/shared';
import { upsertDipFavor } from './spy.js';

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

const PREP_MONTHS = 1;
/** 假情报 / 空城 生效持续月数 */
const EFFECT_MONTHS = 3;
const EXPOSED_MONTHS = 2;
const MAX_ACTIVE_PLOTS = 4;
/** 空城疑兵：兵力低于此视为寡兵 */
export const EMPTY_FORT_TROOP_MAX = 3500;

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
    default:
      return String(type);
  }
}

/**
 * AI 攻城权重修正（1=中性；>1 更想打；<1 暂缓）
 * - 空城疑兵成功：×0.15
 * - 空城疑兵识破：×2.5
 * - 假情报诱饵（非施计方）：×2.2
 */
export function getPlotAttackModifier(
  state: GameState,
  cityId: number,
  attackerFactionId: number,
): number {
  let mod = 1;
  for (const p of state.plots ?? []) {
    if (p.stage !== PlotStage.ACTIVE) continue;
    if (p.targetCityId !== cityId) continue;
    if (p.type === PlotType.EMPTY_FORT) {
      mod *= p.result?.inverted ? 2.5 : 0.15;
    } else if (p.type === PlotType.FALSE_INTEL) {
      if (p.casterFactionId !== attackerFactionId) {
        mod *= 2.2;
      }
    }
  }
  return mod;
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
    targetOfficerId?: number;
    agentId?: string;
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

  const type = opts.type;
  let cost: PlotCost;
  let targetFactionId: number | undefined = opts.targetFactionId;
  let targetCityId: number | undefined = opts.targetCityId;

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
    if ((faction.beautyStock ?? 0) < cost.beauty) {
      throw new Error(`美女资源不足（需 ${cost.beauty}）`);
    }
    factions[fid] = {
      ...faction,
      beautyStock: (faction.beautyStock ?? 0) - cost.beauty,
    };
  }

  // 情报前置
  if (cost.requiresIntel && targetCityId != null) {
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
    targetFactionId,
    targetCityId,
    targetOfficerId: opts.targetOfficerId,
    agentId: opts.agentId,
    stage: PlotStage.PREP,
    monthsLeft: PREP_MONTHS,
    cost,
    year: state.currentYear,
    month: state.currentMonth,
  };

  const typeLabel = plotTypeLabel(type);
  const targetName =
    type === PlotType.EMPTY_FORT && targetCityId != null
      ? state.cities[targetCityId]?.name ?? '目标'
      : targetFactionId != null
        ? state.factions[targetFactionId]?.name ?? '目标'
        : state.cities[targetCityId!]?.name ?? '目标';

  const costParts: string[] = [];
  if (cost.gold > 0) costParts.push(`${cost.gold}金`);
  if (cost.food) costParts.push(`${cost.food}粮`);
  if (cost.beauty) costParts.push(`${cost.beauty}美女`);

  return pushLog(
    state,
    'plot_launch',
    `${faction.name} 发起${typeLabel}→${targetName}（准备 ${PREP_MONTHS} 月，耗 ${costParts.join('/') || '无'}）`,
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
        messages.push(`${plotTypeLabel(plot.type)}效果结束`);
      } else {
        nextPlots.push({ ...plot, monthsLeft: left });
      }
      continue;
    }

    // PREP
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
    messages.push(result.message);

    if (result.enterActive) {
      nextPlots.push({
        ...plot,
        monthsLeft: result.activeMonths,
        stage: PlotStage.ACTIVE,
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
  if (hasFemaleSpy) {
    successChance += 20;
    detectChance += 10;
  }

  if (plot.targetCityId != null) {
    const depth = getIntelDepth({ ...state, intel }, plot.targetCityId);
    if (depth === 'detailed') successChance += 15;
  }

  if (plot.targetCityId != null) {
    const defense = intel?.cityDefense?.[plot.targetCityId];
    if (defense && defense.level > 0) {
      detectChance += defense.level * 8;
      successChance -= defense.level * 8;
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

  successChance = Math.max(10, Math.min(85, successChance));
  detectChance = Math.max(5, Math.min(75, detectChance));

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
      const favorHit = hasFemaleSpy ? -30 : -15;
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
