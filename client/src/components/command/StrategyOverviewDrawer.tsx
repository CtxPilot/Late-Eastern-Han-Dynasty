// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import {
  PlotStage,
  PlotType,
  SpyStatus,
  findDiplomacy,
  isAllied,
  roadNeighbors,
  type GameState,
  type Plot,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { getFactionResourceTotals } from '../../utils/factionResources';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import type { CommandShellAction } from './commandShellState';

const MAX_ACTIVE_PLOTS = 4;
const MAX_ACTIVE_L2 = 2;

const PLOT_LABEL: Record<PlotType, string> = {
  [PlotType.HONEY_TRAP]: '美人计',
  [PlotType.SOW_DISCORD]: '离间计',
  [PlotType.FALSE_INTEL]: '假情报',
  [PlotType.EMPTY_FORT]: '空城疑兵',
  [PlotType.UNDERMINE]: '釜底抽薪',
  [PlotType.SECRET_CROSSING]: '暗渡陈仓',
  [PlotType.BLOSSOM]: '树上开花',
  [PlotType.KILL_CHICKEN]: '指桑骂槐',
  [PlotType.STRIKE_WHILE_HOT]: '趁火打劫',
  [PlotType.LURE_TIGER]: '调虎离山',
  [PlotType.INSTIGATE]: '借刀杀人',
  [PlotType.POACH]: '秘密挖角',
  [PlotType.WATCH_FIRE]: '隔岸观火',
  [PlotType.SWAP_PILLAR]: '偷梁换柱',
  [PlotType.EDICT]: '借尸还魂',
};

const STAGE_LABEL: Record<PlotStage, string> = {
  [PlotStage.PREP]: '准备中',
  [PlotStage.ACTIVE]: '生效中',
  [PlotStage.RESOLVED]: '已结算',
};

const PLOT_COST: Record<PlotType, string> = {
  [PlotType.HONEY_TRAP]: '宫廷人脉 2、金 150',
  [PlotType.SOW_DISCORD]: '金 200',
  [PlotType.FALSE_INTEL]: '金 120',
  [PlotType.EMPTY_FORT]: '目标城粮 150',
  [PlotType.UNDERMINE]: '金 300 + 60/月×6',
  [PlotType.SECRET_CROSSING]: '金 200（两邻接敌城 surface）',
  [PlotType.BLOSSOM]: '金 150 + 目标城粮 100',
  [PlotType.KILL_CHICKEN]: '金 100（己方低忠诚≥2）',
  [PlotType.STRIKE_WHILE_HOT]: '金 150（目标同时交战≥2）',
  [PlotType.LURE_TIGER]: '金 200 + 50/月×2（探秘+女间谍）',
  [PlotType.INSTIGATE]: '金 300（探秘+女间谍+邻接第三方）',
  [PlotType.POACH]: '金 100~500 + 50/月×2（探秘敌将）',
  [PlotType.WATCH_FIRE]: '金 400 + 80/月×3（两势力友好≥40）',
  [PlotType.SWAP_PILLAR]: '金 300（探秘+密探反间）',
  [PlotType.EDICT]: '金 300（目标势力）',
};

/** 与服务端 KILL_CHICKEN_LOYALTY_THRESHOLD 对齐 */
const KILL_CHICKEN_LOYALTY_THRESHOLD = 80;
const KILL_CHICKEN_MIN_LOW = 2;

/** 与服务端 STRIKE_WHILE_HOT_MIN_WARS 对齐 */
const STRIKE_WHILE_HOT_MIN_WARS = 2;

function isL2Type(type: PlotType): boolean {
  return (
    type === PlotType.UNDERMINE
    || type === PlotType.SECRET_CROSSING
    || type === PlotType.BLOSSOM
    || type === PlotType.KILL_CHICKEN
    || type === PlotType.STRIKE_WHILE_HOT
    || type === PlotType.LURE_TIGER
    || type === PlotType.INSTIGATE
    || type === PlotType.POACH
    || type === PlotType.WATCH_FIRE
    || type === PlotType.SWAP_PILLAR
    || type === PlotType.EDICT
  );
}

/** 目标势力当前同时交战的势力数（WAR 关系，服务端权威口径） */
function countWarsForFaction(game: GameState, factionId: number): number {
  return (game.diplomacy ?? []).filter(
    (link) =>
      (link.factionA === factionId || link.factionB === factionId)
      && link.relation === 'war',
  ).length;
}

export type StrategyLaunchDraft = {
  type: PlotType;
  targetCityId: number | null;
  /** 暗渡陈仓：明修城 */
  feintCityId: number | null;
  targetFactionId: number | null;
  agentId: string | null;
  /** 指桑骂槐：可选儆猴目标；秘密挖角：必选 */
  targetOfficerId: number | null;
  /** 隔岸观火：第二势力 */
  secondaryFactionId?: number | null;
};

export function validateStrategyLaunch(
  game: GameState,
  draft: StrategyLaunchDraft,
): string | null {
  const factionId = game.playerFactionId;
  const ownCities = Object.values(game.cities).filter((city) => city.ruler === factionId);
  const activeCount = (game.plots ?? []).filter(
    (plot) => plot.casterFactionId === factionId && plot.stage !== PlotStage.RESOLVED,
  ).length;
  const canPayGold = (cost: number) => ownCities.some((city) => city.gold >= cost);
  if (activeCount >= MAX_ACTIVE_PLOTS) return `进行中计谋已达上限 ${MAX_ACTIVE_PLOTS}。`;
  const l2Active = (game.plots ?? []).filter(
    (plot) =>
      plot.casterFactionId === factionId
      && plot.stage !== PlotStage.RESOLVED
      && (plot.layer === 'strategic' || isL2Type(plot.type)),
  ).length;
  if (isL2Type(draft.type) && l2Active >= MAX_ACTIVE_L2) {
    return `进行中战略计谋已达上限 ${MAX_ACTIVE_L2}。`;
  }

  if (draft.type === PlotType.SOW_DISCORD) {
    const target = draft.targetFactionId == null ? null : game.factions[draft.targetFactionId];
    if (!target || !target.isAlive || target.id === factionId) return '请选择仍存续的敌对势力。';
    if (isAllied(game.diplomacy, factionId, target.id)) return '不能对盟友施展离间计。';
    if (!canPayGold(200)) return '没有己方城池能够支付金 200。';
    return null;
  }

  if (draft.type === PlotType.SECRET_CROSSING) {
    const secret = draft.targetCityId == null ? null : game.cities[draft.targetCityId];
    const feint = draft.feintCityId == null ? null : game.cities[draft.feintCityId];
    if (!secret || !feint) return '请选择邻接的明修城与暗渡城。';
    if (secret.id === feint.id) return '明修城与暗渡城不可相同。';
    if (secret.ruler == null || secret.ruler === factionId || feint.ruler == null || feint.ruler === factionId) {
      return '明修城与暗渡城均须为敌城。';
    }
    if (!roadNeighbors(secret.id).includes(feint.id)) return '明修城与暗渡城须官道邻接。';
    const secretDepth = game.intel?.cities?.[secret.id]?.depth;
    const feintDepth = game.intel?.cities?.[feint.id]?.depth;
    if (secretDepth == null || feintDepth == null) {
      return '需先对两城取得至少 surface 情报。';
    }
    if (!canPayGold(200)) return '没有己方城池能够支付金 200。';
    return null;
  }

  if (draft.type === PlotType.KILL_CHICKEN) {
    const rulerId = game.factions[factionId]?.rulerId;
    const low = Object.values(game.officers ?? {}).filter(
      (o) =>
        o.faction === factionId
        && String(o.status) === 'active'
        && o.id !== rulerId
        && o.loyalty < KILL_CHICKEN_LOYALTY_THRESHOLD,
    );
    if (low.length < KILL_CHICKEN_MIN_LOW) {
      return `需至少 ${KILL_CHICKEN_MIN_LOW} 名忠诚＜${KILL_CHICKEN_LOYALTY_THRESHOLD} 的在职武将。`;
    }
    if (draft.targetOfficerId != null && !low.some((o) => o.id === draft.targetOfficerId)) {
      return '儆猴目标须为己方忠诚偏低的在职武将。';
    }
    if (!canPayGold(100)) return '没有己方城池能够支付金 100。';
    return null;
  }

  if (draft.type === PlotType.STRIKE_WHILE_HOT) {
    const target = draft.targetFactionId == null ? null : game.factions[draft.targetFactionId];
    if (!target || !target.isAlive || target.id === factionId) return '请选择仍存续的敌对方势力。';
    const wars = countWarsForFaction(game, target.id);
    if (wars < STRIKE_WHILE_HOT_MIN_WARS) {
      return `趁火打劫需目标同时与≥${STRIKE_WHILE_HOT_MIN_WARS}家势力交战（当前 ${wars} 家）。`;
    }
    if (!canPayGold(150)) return '没有己方城池能够支付金 150。';
    return null;
  }

  if (draft.type === PlotType.LURE_TIGER) {
    const target = draft.targetCityId == null ? null : game.cities[draft.targetCityId];
    if (!target || target.ruler == null || target.ruler === factionId) return '请选择已获探秘情报的敌城。';
    if (game.intel?.cities?.[target.id]?.depth !== 'detailed') {
      return '需先对目标城探秘，取得 detailed 情报。';
    }
    const destCount = Object.values(game.cities).filter(
      (city) => city.ruler === target.ruler && city.id !== target.id,
    ).length;
    if (destCount === 0) return `${target.name} 所属势力仅一座城，无法诱离。`;
    const rulerId = game.factions[target.ruler]?.rulerId;
    const tigers = (target.officers ?? [])
      .map((id) => game.officers[id])
      .filter((o) =>
        o
        && o.faction === target.ruler
        && String(o.status) === 'active'
        && o.id !== rulerId,
      );
    if (tigers.length === 0) return `${target.name} 无可诱离的守将。`;
    if (draft.targetOfficerId != null && !tigers.some((o) => o.id === draft.targetOfficerId)) {
      return '诱离目标须为该城在职非君主守将。';
    }
    if (!draft.agentId) return '调虎离山必须派遣空闲女间谍。';
    const agent = game.intel?.agents?.[draft.agentId];
    if (
      !agent
      || agent.factionId !== factionId
      || agent.agentKind !== 'female'
      || agent.status !== SpyStatus.IDLE
      || agent.cooldownMonths > 0
    ) return '所选女间谍已不再空闲，请返回修改。';
    if (!canPayGold(200)) return '没有己方城池能够支付金 200。';
    return null;
  }

  if (draft.type === PlotType.INSTIGATE) {
    const target = draft.targetCityId == null ? null : game.cities[draft.targetCityId];
    if (!target || target.ruler == null || target.ruler === factionId) return '请选择已获探秘情报的敌城。';
    if (game.intel?.cities?.[target.id]?.depth !== 'detailed') {
      return '需先对目标城探秘，取得 detailed 情报。';
    }
    if (!draft.agentId) return '借刀杀人必须派遣空闲女间谍。';
    const agent = game.intel?.agents?.[draft.agentId];
    if (
      !agent
      || agent.factionId !== factionId
      || agent.agentKind !== 'female'
      || agent.status !== SpyStatus.IDLE
      || agent.cooldownMonths > 0
    ) return '所选女间谍已不再空闲，请返回修改。';
    if (draft.feintCityId == null) return '请选择邻接的第三方源城。';
    const source = game.cities[draft.feintCityId];
    if (
      !source
      || source.ruler == null
      || source.ruler === factionId
      || source.ruler === target.ruler
      || !roadNeighbors(target.id).includes(source.id)
    ) return '第三方源城须与目标城官道邻接且属第三方。';
    if (!canPayGold(300)) return '没有己方城池能够支付金 300。';
    return null;
  }

  if (draft.type === PlotType.POACH) {
    const target = draft.targetCityId == null ? null : game.cities[draft.targetCityId];
    if (!target || target.ruler == null || target.ruler === factionId) return '请选择已获探秘情报的敌城。';
    if (game.intel?.cities?.[target.id]?.depth !== 'detailed') {
      return '需先对目标城探秘，取得 detailed 情报。';
    }
    const rulerId = target.ruler != null ? game.factions[target.ruler]?.rulerId : undefined;
    const deployed = new Set((game.campaignArmies ?? []).flatMap((army) => [
      army.commanderId,
      ...army.subCommanderIds,
      ...(army.advisorId == null ? [] : [army.advisorId]),
      ...(army.subAdvisorId == null ? [] : [army.subAdvisorId]),
    ]));
    const cands = (target.officers ?? [])
      .map((id) => game.officers[id])
      .filter((o) =>
        o
        && o.faction === target.ruler
        && String(o.status) === 'active'
        && o.id !== rulerId
        && !deployed.has(o.id),
      );
    if (cands.length === 0) return `${target.name} 无可挖角武将。`;
    if (draft.targetOfficerId == null || !cands.some((o) => o.id === draft.targetOfficerId)) {
      return '请选择该城在职非君主武将。';
    }
    const gold = Math.min(500, Math.max(100, 100 + (cands.find((o) => o.id === draft.targetOfficerId)?.stats.leadership ?? 50) * 4));
    if (!canPayGold(gold)) return `没有己方城池能够支付金 ${gold}。`;
    return null;
  }

  if (draft.type === PlotType.WATCH_FIRE) {
    const a = draft.targetFactionId == null ? null : game.factions[draft.targetFactionId];
    const b = draft.secondaryFactionId == null ? null : game.factions[draft.secondaryFactionId];
    if (!a || !b || !a.isAlive || !b.isAlive) return '请选择两家仍存续的其他势力。';
    if (a.id === factionId || b.id === factionId) return '隔岸观火须针对两家其他势力。';
    if (a.id === b.id) return '两家势力不可相同。';
    const favor = findDiplomacy(game.diplomacy, a.id, b.id)?.favorability ?? 0;
    if (favor < 40) return `两势力友好须≥40（当前 ${favor}）。`;
    if (!canPayGold(400)) return '没有己方城池能够支付金 400。';
    return null;
  }

  if (draft.type === PlotType.SWAP_PILLAR) {
    const target = draft.targetCityId == null ? null : game.cities[draft.targetCityId];
    if (!target || target.ruler == null || target.ruler === factionId) return '请选择已获探秘情报的敌城。';
    if (game.intel?.cities?.[target.id]?.depth !== 'detailed') {
      return '需先对目标城探秘，取得 detailed 情报。';
    }
    if (!draft.agentId) return '偷梁换柱须派遣空闲密探作为反间。';
    const agent = game.intel?.agents?.[draft.agentId];
    if (
      !agent
      || agent.factionId !== factionId
      || agent.status !== SpyStatus.IDLE
      || agent.cooldownMonths > 0
    ) return '所选密探已不再空闲，请返回修改。';
    if (!canPayGold(300)) return '没有己方城池能够支付金 300。';
    return null;
  }

  if (draft.type === PlotType.EDICT) {
    const target = draft.targetFactionId == null ? null : game.factions[draft.targetFactionId];
    if (!target || !target.isAlive || target.id === factionId) return '请选择仍存续的敌对势力。';
    if (!canPayGold(300)) return '没有己方城池能够支付金 300。';
    return null;
  }

  const target = draft.targetCityId == null ? null : game.cities[draft.targetCityId];
  if (!target) {
    return draft.type === PlotType.EMPTY_FORT || draft.type === PlotType.BLOSSOM
      ? '请选择符合条件的己方城。'
      : '请选择已获探秘情报的敌城。';
  }
  if (draft.type === PlotType.EMPTY_FORT) {
    if (target.ruler !== factionId || target.troops >= 3500 || target.food < 150) {
      return '空城疑兵目标需为己方城，且兵力＜3500、粮≥150。';
    }
    return null;
  }
  if (draft.type === PlotType.BLOSSOM) {
    if (target.ruler !== factionId || target.food < 100) {
      return '树上开花目标需为己方城，且粮≥100。';
    }
    if (!canPayGold(150)) return '没有己方城池能够支付金 150。';
    return null;
  }
  if (target.ruler == null || target.ruler === factionId) return '计谋目标必须是敌方城池。';
  if (game.intel?.cities?.[target.id]?.depth !== 'detailed') {
    return '需先对目标城探秘，取得 detailed 情报。';
  }
  if (draft.type === PlotType.FALSE_INTEL) {
    return canPayGold(120) ? null : '没有己方城池能够支付金 120。';
  }
  if (draft.type === PlotType.UNDERMINE) {
    return canPayGold(300) ? null : '没有己方城池能够支付金 300。';
  }
  if ((game.factions[factionId]?.courtNetwork ?? 0) < 2) return '宫廷人脉不足（需 2）。';
  if (!canPayGold(150)) return '没有己方城池能够支付金 150。';
  if (draft.agentId) {
    const agent = game.intel?.agents?.[draft.agentId];
    if (
      !agent
      || agent.factionId !== factionId
      || agent.agentKind !== 'female'
      || agent.status !== SpyStatus.IDLE
      || agent.cooldownMonths > 0
    ) return '所选女间谍已不再空闲，请返回修改。';
  }
  return null;
}

export type StrategyPlotSummary = {
  id: string;
  type: PlotType;
  label: string;
  stage: PlotStage;
  stageLabel: string;
  target: string;
  monthsLeft: number;
  message: string | null;
  detected: boolean;
  progress: number | null;
  cancellable: boolean;
};

export type StrategyOverview = {
  activeCount: number;
  maxActive: number;
  totalGold: number;
  totalFood: number;
  courtNetwork: number;
  detailedEnemyCities: string[];
  idleFemaleAgents: string[];
  emptyFortCandidates: string[];
  blossomCandidates: string[];
  killChickenCandidates: string[];
  strikeWhileHotFactions: string[];
  lureTigerCities: string[];
  instigateCities: string[];
  watchFirePairs: string[];
  plots: StrategyPlotSummary[];
};

function getPlotTarget(game: GameState, plot: Plot): string {
  if (plot.type === PlotType.SECRET_CROSSING && plot.targetCityId != null) {
    const secret = game.cities[plot.targetCityId]?.name ?? '暗渡';
    const feint = plot.feintCityId != null ? game.cities[plot.feintCityId]?.name ?? '明修' : '明修';
    return `明修${feint}/暗渡${secret}`;
  }
  if (plot.type === PlotType.WATCH_FIRE) {
    const a = plot.targetFactionId != null ? game.factions[plot.targetFactionId]?.name ?? '甲' : '甲';
    const b = plot.secondaryFactionId != null ? game.factions[plot.secondaryFactionId]?.name ?? '乙' : '乙';
    return `${a}↔${b}`;
  }
  if (plot.type === PlotType.INSTIGATE && plot.targetCityId != null) {
    const city = game.cities[plot.targetCityId]?.name ?? '目标城';
    const third = plot.secondaryFactionId != null ? game.factions[plot.secondaryFactionId]?.name ?? '第三方' : '第三方';
    return `${third}攻${city}`;
  }
  if (plot.type === PlotType.KILL_CHICKEN && plot.targetOfficerId != null) {
    return game.officers[plot.targetOfficerId]?.name ?? '己方武将';
  }
  if (plot.targetCityId != null) return game.cities[plot.targetCityId]?.name ?? '未知城池';
  if (plot.targetFactionId != null) return game.factions[plot.targetFactionId]?.name ?? '未知势力';
  return '—';
}

export function buildStrategyOverview(game: GameState): StrategyOverview {
  const resources = getFactionResourceTotals(game, game.playerFactionId);
  const playerPlots = (game.plots ?? [])
    .filter((plot) => plot.casterFactionId === game.playerFactionId)
    .sort((a, b) => b.year - a.year || b.month - a.month || a.id.localeCompare(b.id));
  const detailedEnemyCities = Object.values(game.cities)
    .filter((city) =>
      city.ruler != null
      && city.ruler !== game.playerFactionId
      && game.intel?.cities?.[city.id]?.depth === 'detailed')
    .sort((a, b) => a.id - b.id)
    .map((city) => city.name);
  const idleFemaleAgents = Object.values(game.intel?.agents ?? {})
    .filter((agent) =>
      agent.factionId === game.playerFactionId
      && agent.agentKind === 'female'
      && agent.status === SpyStatus.IDLE
      && agent.cooldownMonths <= 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((agent) => agent.name);
  const emptyFortCandidates = Object.values(game.cities)
    .filter((city) =>
      city.ruler === game.playerFactionId
      && city.troops < 3500
      && city.food >= 150)
    .sort((a, b) => a.troops - b.troops || a.id - b.id)
    .map((city) => city.name);
  const blossomCandidates = Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId && city.food >= 100)
    .sort((a, b) => a.id - b.id)
    .map((city) => city.name);
  const rulerId = game.factions[game.playerFactionId]?.rulerId;
  const killChickenCandidates = Object.values(game.officers ?? {})
    .filter(
      (o) =>
        o.faction === game.playerFactionId
        && String(o.status) === 'active'
        && o.id !== rulerId
        && o.loyalty < KILL_CHICKEN_LOYALTY_THRESHOLD,
    )
    .sort((a, b) => a.loyalty - b.loyalty || a.id - b.id)
    .map((o) => `${o.name}（忠${o.loyalty}）`);
  const strikeWhileHotFactionNames = Object.values(game.factions)
    .filter(
      (f) =>
        f.id !== game.playerFactionId
        && f.isAlive
        && countWarsForFaction(game, f.id) >= STRIKE_WHILE_HOT_MIN_WARS,
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((f) => `${f.name}（交战${countWarsForFaction(game, f.id)}家）`);
  const lureTigerCities = Object.values(game.cities)
    .filter((city) => {
      if (city.ruler == null || city.ruler === game.playerFactionId) return false;
      if (game.intel?.cities?.[city.id]?.depth !== 'detailed') return false;
      const dests = Object.values(game.cities).some((c) => c.ruler === city.ruler && c.id !== city.id);
      if (!dests) return false;
      const rulerId = game.factions[city.ruler]?.rulerId;
      return (city.officers ?? []).some((id) => {
        const o = game.officers[id];
        return o && o.faction === city.ruler && String(o.status) === 'active' && o.id !== rulerId;
      });
    })
    .sort((a, b) => a.id - b.id)
    .map((city) => city.name);

  const instigateCities = Object.values(game.cities)
    .filter((city) => {
      if (city.ruler == null || city.ruler === game.playerFactionId) return false;
      if (game.intel?.cities?.[city.id]?.depth !== 'detailed') return false;
      return roadNeighbors(city.id).some((nid) => {
        const n = game.cities[nid];
        return n && n.ruler != null && n.ruler !== game.playerFactionId && n.ruler !== city.ruler;
      });
    })
    .sort((a, b) => a.id - b.id)
    .map((city) => city.name);

  const watchFirePairs: string[] = [];
  const alive = Object.values(game.factions).filter((f) => f.isAlive && f.id !== game.playerFactionId);
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const favor = findDiplomacy(game.diplomacy, alive[i]!.id, alive[j]!.id)?.favorability ?? 0;
      if (favor >= 40) watchFirePairs.push(`${alive[i]!.name}↔${alive[j]!.name}（友${favor}）`);
    }
  }

  return {
    activeCount: playerPlots.filter((plot) => plot.stage !== PlotStage.RESOLVED).length,
    maxActive: MAX_ACTIVE_PLOTS,
    totalGold: resources.gold,
    totalFood: resources.food,
    courtNetwork: game.factions[game.playerFactionId]?.courtNetwork ?? 0,
    detailedEnemyCities,
    idleFemaleAgents,
    emptyFortCandidates,
    blossomCandidates,
    killChickenCandidates,
    strikeWhileHotFactions: strikeWhileHotFactionNames,
    lureTigerCities,
    instigateCities,
    watchFirePairs,
    plots: playerPlots.map((plot) => ({
      id: plot.id,
      type: plot.type,
      label: PLOT_LABEL[plot.type] ?? plot.type,
      stage: plot.stage,
      stageLabel: STAGE_LABEL[plot.stage],
      target: getPlotTarget(game, plot),
      monthsLeft: plot.monthsLeft,
      message: plot.result?.message ?? null,
      detected: plot.result?.detected ?? false,
      progress: plot.progress ?? null,
      cancellable:
        plot.stage !== PlotStage.RESOLVED
        && (plot.layer === 'strategic' || isL2Type(plot.type)),
    })),
  };
}

type StrategyFacet = 'situation' | 'launch' | 'ongoing';

const FACETS: readonly { id: StrategyFacet; label: string }[] = [
  { id: 'situation', label: '态势' },
  { id: 'launch', label: '发起' },
  { id: 'ongoing', label: '进行中' },
];

export function StrategyOverviewDrawer({
  dispatch,
}: {
  dispatch: React.Dispatch<CommandShellAction>;
}) {
  const game = useGameStore((state) => state.game);
  const launchPlot = useGameStore((state) => state.launchPlot);
  const cancelPlot = useGameStore((state) => state.cancelPlot);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const [facet, setFacet] = useState<StrategyFacet>('situation');
  const [draft, setDraft] = useState<StrategyLaunchDraft>({
    type: PlotType.HONEY_TRAP,
    targetCityId: null,
    feintCityId: null,
    targetFactionId: null,
    agentId: null,
    targetOfficerId: null,
    secondaryFactionId: null,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const overview = useMemo(() => game ? buildStrategyOverview(game) : null, [game]);

  if (!game || !overview) return <p data-testid="command-strategy-empty">尚未载入剧本。</p>;
  const enemyCities = Object.values(game.cities)
    .filter((city) => city.ruler != null && city.ruler !== game.playerFactionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const weakCities = Object.values(game.cities)
    .filter((city) =>
      city.ruler === game.playerFactionId && city.troops < 3500 && city.food >= 150)
    .sort((a, b) => a.troops - b.troops || a.id - b.id);
  const blossomCities = Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId && city.food >= 100)
    .sort((a, b) => a.id - b.id);
  const killChickenOfficers = Object.values(game.officers ?? {})
    .filter(
      (o) =>
        o.faction === game.playerFactionId
        && String(o.status) === 'active'
        && o.id !== game.factions[game.playerFactionId]?.rulerId
        && o.loyalty < KILL_CHICKEN_LOYALTY_THRESHOLD,
    )
    .sort((a, b) => a.loyalty - b.loyalty || a.id - b.id);
  const enemyFactions = Object.values(game.factions)
    .filter((faction) =>
      faction.id !== game.playerFactionId
      && faction.isAlive
      && !isAllied(game.diplomacy, game.playerFactionId, faction.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const strikeWhileHotFactions = enemyFactions.filter(
    (faction) => countWarsForFaction(game, faction.id) >= STRIKE_WHILE_HOT_MIN_WARS,
  );
  const femaleAgents = Object.values(game.intel?.agents ?? {})
    .filter((agent) =>
      agent.factionId === game.playerFactionId
      && agent.agentKind === 'female'
      && agent.status === SpyStatus.IDLE
      && agent.cooldownMonths <= 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const isCityTarget =
    draft.type !== PlotType.SOW_DISCORD
    && draft.type !== PlotType.KILL_CHICKEN
    && draft.type !== PlotType.STRIKE_WHILE_HOT
    && draft.type !== PlotType.WATCH_FIRE
    && draft.type !== PlotType.EDICT;
  const isHoney = draft.type === PlotType.HONEY_TRAP;
  const isEmpty = draft.type === PlotType.EMPTY_FORT;
  const isSecretCrossing = draft.type === PlotType.SECRET_CROSSING;
  const isBlossom = draft.type === PlotType.BLOSSOM;
  const isKillChicken = draft.type === PlotType.KILL_CHICKEN;
  const isStrikeWhileHot = draft.type === PlotType.STRIKE_WHILE_HOT;
  const isLureTiger = draft.type === PlotType.LURE_TIGER;
  const isInstigate = draft.type === PlotType.INSTIGATE;
  const isPoach = draft.type === PlotType.POACH;
  const isWatchFire = draft.type === PlotType.WATCH_FIRE;
  const isSwapPillar = draft.type === PlotType.SWAP_PILLAR;
  const isEdict = draft.type === PlotType.EDICT;
  const lureCity = isLureTiger && draft.targetCityId != null ? game.cities[draft.targetCityId] : null;
  const lureRulerId = lureCity?.ruler != null ? game.factions[lureCity.ruler]?.rulerId : undefined;
  const lureOfficers = (lureCity?.officers ?? [])
    .map((id) => game.officers[id])
    .filter((o) =>
      o
      && lureCity
      && o.faction === lureCity.ruler
      && String(o.status) === 'active'
      && o.id !== lureRulerId,
    )
    .sort((a, b) => b.stats.war - a.stats.war || a.id - b.id);
  const instigateSources = (draft.targetCityId != null ? roadNeighbors(draft.targetCityId) : [])
    .map((id) => game.cities[id])
    .filter((c) => {
      const target = draft.targetCityId != null ? game.cities[draft.targetCityId] : null;
      return !!c && c.ruler != null && c.ruler !== game.playerFactionId && c.ruler !== target?.ruler;
    });
  const poachCity = isPoach && draft.targetCityId != null ? game.cities[draft.targetCityId] : null;
  const poachRulerId = poachCity?.ruler != null ? game.factions[poachCity.ruler]?.rulerId : undefined;
  const poachOfficers = (poachCity?.officers ?? [])
    .map((id) => game.officers[id])
    .filter((o) =>
      o && poachCity && o.faction === poachCity.ruler && String(o.status) === 'active' && o.id !== poachRulerId,
    )
    .sort((a, b) => a.loyalty - b.loyalty || a.id - b.id);
  const idleAgents = Object.values(game.intel?.agents ?? {})
    .filter((agent) =>
      agent.factionId === game.playerFactionId
      && agent.status === SpyStatus.IDLE
      && agent.cooldownMonths <= 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const launchReason = validateStrategyLaunch(game, draft);
  const targetName = draft.type === PlotType.SOW_DISCORD || isStrikeWhileHot || isEdict
    ? game.factions[draft.targetFactionId ?? -1]?.name ?? '未选目标'
    : isWatchFire
      ? `${game.factions[draft.targetFactionId ?? -1]?.name ?? '甲'}↔${game.factions[draft.secondaryFactionId ?? -1]?.name ?? '乙'}`
      : isSecretCrossing
        ? `明修${game.cities[draft.feintCityId ?? -1]?.name ?? '？'}/暗渡${game.cities[draft.targetCityId ?? -1]?.name ?? '？'}`
        : isInstigate
          ? `${game.cities[draft.feintCityId ?? -1]?.name ?? '源'}攻${game.cities[draft.targetCityId ?? -1]?.name ?? '目标'}`
          : isKillChicken || isPoach
            ? (draft.targetOfficerId != null
              ? game.officers[draft.targetOfficerId]?.name ?? '未选目标'
              : isPoach ? '未选武将' : '随机儆猴（低忠诚池）')
            : game.cities[draft.targetCityId ?? -1]?.name ?? '未选目标';

  const surfaceEnemyCities = enemyCities.filter((city) => {
    const depth = game.intel?.cities?.[city.id]?.depth;
    return depth === 'surface' || depth === 'detailed';
  });
  const feintCandidates = surfaceEnemyCities.filter((city) =>
    draft.targetCityId == null
      || (city.id !== draft.targetCityId && roadNeighbors(draft.targetCityId).includes(city.id)));
  const secretCandidates = surfaceEnemyCities.filter((city) =>
    draft.feintCityId == null
      || (city.id !== draft.feintCityId && roadNeighbors(draft.feintCityId).includes(city.id)));

  return (
    <div
      className="flex h-[min(34rem,calc(100vh-12rem))] min-h-0 flex-1 flex-col"
      data-testid="command-strategy-drawer"
    >
      <nav className="mb-3 grid grid-cols-3 gap-1" aria-label="计略分面">
        {FACETS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`command-strategy-facet-${item.id}`}
            aria-current={facet === item.id ? 'page' : undefined}
            onClick={() => setFacet(item.id)}
            className={`border py-1.5 ${
              facet === item.id
                ? 'border-violet-700 bg-violet-950/40 text-violet-100'
                : 'border-stone-800 text-stone-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <p className="mb-3 text-[10px] leading-relaxed text-stone-500">
        S17 四计由此唯一发起；探秘与女间谍仍归 S07 情报域。
      </p>

      {facet === 'situation' ? (
        <section className="min-h-0 space-y-3 overflow-y-auto" data-testid="command-strategy-situation">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="进行中" value={`${overview.activeCount}/${overview.maxActive}`} />
            <Metric label="势力总金" value={overview.totalGold} />
            <Metric label="宫廷人脉" value={overview.courtNetwork} />
          </div>
          <InfoList title="已获探秘情报的敌城" items={overview.detailedEnemyCities} empty="暂无；美人计与假情报尚无可用敌城。" />
          <InfoList title="空闲女间谍" items={overview.idleFemaleAgents} empty="暂无；美人计仍可不派女间谍。" />
          <InfoList title="空城疑兵候选" items={overview.emptyFortCandidates} empty="暂无兵力＜3500且粮≥150的己方城。" />
          <InfoList title="树上开花候选" items={overview.blossomCandidates} empty="暂无粮≥100的己方城。" />
          <InfoList
            title="指桑骂槐候选（忠＜80）"
            items={overview.killChickenCandidates}
            empty={`暂无足够低忠诚武将（需≥${KILL_CHICKEN_MIN_LOW}）。`}
          />
          <InfoList
            title="趁火打劫候选（同时交战≥2家）"
            items={overview.strikeWhileHotFactions}
            empty="暂无正多线交战的势力可趁。"
          />
          <InfoList
            title="调虎离山候选（探秘敌城+可诱离守将）"
            items={overview.lureTigerCities}
            empty="暂无已探秘且有他城可诱往的敌城。"
          />
          <InfoList
            title="借刀杀人候选（探秘+邻接第三方）"
            items={overview.instigateCities}
            empty="暂无已探秘且邻接第三方的敌城。"
          />
          <InfoList
            title="隔岸观火候选（友好≥40）"
            items={overview.watchFirePairs}
            empty="暂无两家其他势力友好≥40。"
          />
          <p className="border border-stone-800 bg-stone-900/50 px-3 py-2 text-[10px] text-stone-500">
            总军师任免归朝廷；未来战略态势与献策才进入计略。
          </p>
        </section>
      ) : facet === 'launch' ? (
        <section className="min-h-0 space-y-2 overflow-y-auto" data-testid="command-strategy-launch">
          <label className="block text-[10px] text-stone-500">
            计略
            <select
              data-testid="command-strategy-plot-type"
              className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
              value={draft.type}
              onChange={(event) => setDraft({
                type: event.target.value as PlotType,
                targetCityId: null,
                feintCityId: null,
                targetFactionId: null,
                agentId: null,
                targetOfficerId: null,
                secondaryFactionId: null,
              })}
            >
              <option value={PlotType.HONEY_TRAP}>美人计（探秘情报、人脉2、金150）</option>
              <option value={PlotType.SOW_DISCORD}>离间计（非盟友势力、金200）</option>
              <option value={PlotType.FALSE_INTEL}>假情报（探秘情报、金120）</option>
              <option value={PlotType.EMPTY_FORT}>空城疑兵（寡兵城、粮150）</option>
              <option value={PlotType.UNDERMINE}>釜底抽薪（L2·探秘·金300+60×6）</option>
              <option value={PlotType.SECRET_CROSSING}>暗渡陈仓（L2·邻接双城 surface·金200）</option>
              <option value={PlotType.BLOSSOM}>树上开花（L2·己方城·金150粮100）</option>
              <option value={PlotType.KILL_CHICKEN}>指桑骂槐（L2·即时·金100·低忠诚≥2）</option>
              <option value={PlotType.STRIKE_WHILE_HOT}>趁火打劫（L2·即时·金150·目标多线交战≥2）</option>
              <option value={PlotType.LURE_TIGER}>调虎离山（L2·探秘+女间谍·金200+50×2）</option>
              <option value={PlotType.INSTIGATE}>借刀杀人（L2·探秘+女间谍+第三方邻城·金300）</option>
              <option value={PlotType.POACH}>秘密挖角（L2·探秘敌将·金100~500+50×2）</option>
              <option value={PlotType.WATCH_FIRE}>隔岸观火（L2·两势力友好≥40·金400+80×3）</option>
              <option value={PlotType.SWAP_PILLAR}>偷梁换柱（L2·探秘+密探反间·金300）</option>
              <option value={PlotType.EDICT}>借尸还魂（L2·目标势力·金300）</option>
            </select>
          </label>

          {draft.type === PlotType.SOW_DISCORD || isStrikeWhileHot || isEdict ? (
            <label className="block text-[10px] text-stone-500">
              目标势力
              <select
                data-testid="command-strategy-target-faction"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.targetFactionId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  targetFactionId: event.target.value ? Number(event.target.value) : null,
                }))}
              >
                <option value="">{isStrikeWhileHot ? '选择同时与≥2家交战的势力…' : '选择存续的非盟友势力…'}</option>
                {(isStrikeWhileHot ? strikeWhileHotFactions : enemyFactions).map((faction) => (
                  <option key={faction.id} value={faction.id}>
                    {faction.name}{isStrikeWhileHot ? `（交战${countWarsForFaction(game, faction.id)}家）` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : isWatchFire ? (
            <>
              <label className="block text-[10px] text-stone-500">
                势力甲
                <select
                  data-testid="command-strategy-target-faction"
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                  value={draft.targetFactionId ?? ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    targetFactionId: event.target.value ? Number(event.target.value) : null,
                  }))}
                >
                  <option value="">选择第一家势力…</option>
                  {Object.values(game.factions)
                    .filter((f) => f.isAlive && f.id !== game.playerFactionId)
                    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
                    .map((faction) => (
                      <option key={faction.id} value={faction.id}>{faction.name}</option>
                    ))}
                </select>
              </label>
              <label className="block text-[10px] text-stone-500">
                势力乙
                <select
                  data-testid="command-strategy-secondary-faction"
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                  value={draft.secondaryFactionId ?? ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    secondaryFactionId: event.target.value ? Number(event.target.value) : null,
                  }))}
                >
                  <option value="">选择第二家势力（友好≥40）…</option>
                  {Object.values(game.factions)
                    .filter((f) =>
                      f.isAlive
                      && f.id !== game.playerFactionId
                      && f.id !== draft.targetFactionId
                      && (findDiplomacy(game.diplomacy, draft.targetFactionId ?? -1, f.id)?.favorability ?? 0) >= 40)
                    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
                    .map((faction) => (
                      <option key={faction.id} value={faction.id}>
                        {faction.name}（友{findDiplomacy(game.diplomacy, draft.targetFactionId ?? -1, faction.id)?.favorability ?? 0}）
                      </option>
                    ))}
                </select>
              </label>
            </>
          ) : isKillChicken ? (
            <label className="block text-[10px] text-stone-500">
              儆猴目标（可选）
              <select
                data-testid="command-strategy-target-officer"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.targetOfficerId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  targetOfficerId: event.target.value ? Number(event.target.value) : null,
                }))}
              >
                <option value="">随机从低忠诚池选取…</option>
                {killChickenOfficers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}（忠{o.loyalty}）</option>
                ))}
              </select>
            </label>
          ) : isSecretCrossing ? (
            <>
              <label className="block text-[10px] text-stone-500">
                明修城（牵制）
                <select
                  data-testid="command-strategy-feint-city"
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                  value={draft.feintCityId ?? ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    feintCityId: event.target.value ? Number(event.target.value) : null,
                  }))}
                >
                  <option value="">选择至少 surface 的邻接敌城…</option>
                  {feintCandidates.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] text-stone-500">
                暗渡城（出击）
                <select
                  data-testid="command-strategy-target-city"
                  className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                  value={draft.targetCityId ?? ''}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    targetCityId: event.target.value ? Number(event.target.value) : null,
                  }))}
                >
                  <option value="">选择与明修城邻接的敌城…</option>
                  {secretCandidates.map((city) => (
                    <option key={city.id} value={city.id}>{city.name}</option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <label className="block text-[10px] text-stone-500">
              {isEmpty || isBlossom ? '己方城' : '目标敌城'}
              <select
                data-testid="command-strategy-target-city"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.targetCityId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  targetCityId: event.target.value ? Number(event.target.value) : null,
                }))}
              >
                <option value="">{isEmpty ? '兵力＜3500且粮≥150…' : isBlossom ? '粮≥100的己方城…' : '选择已获 detailed 情报的敌城…'}</option>
                {(isEmpty ? weakCities : isBlossom ? blossomCities : enemyCities).map((city) => {
                  const detailed = game.intel?.cities?.[city.id]?.depth === 'detailed';
                  return (
                    <option key={city.id} value={city.id} disabled={!isEmpty && !isBlossom && !detailed}>
                      {city.name} {isEmpty ? `兵${city.troops} 粮${city.food}` : isBlossom ? `粮${city.food}` : detailed ? '✓' : '（需探秘）'}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {isHoney || isLureTiger || isInstigate ? (
            <label className="block text-[10px] text-stone-500">
              {isLureTiger || isInstigate ? '女间谍（必派）' : '女间谍（可选）'}
              <select
                data-testid="command-strategy-agent"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.agentId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  agentId: event.target.value || null,
                }))}
              >
                <option value="">{isLureTiger || isInstigate ? '选择空闲女间谍…' : '不派女间谍'}</option>
                {femaleAgents.map((agent) => <option key={agent.id} value={agent.id}>♀ {agent.name} Lv{agent.rank}</option>)}
              </select>
            </label>
          ) : null}
          {isLureTiger ? (
            <label className="block text-[10px] text-stone-500">
              诱离守将（可选，默认武力最高）
              <select
                data-testid="command-strategy-target-officer"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.targetOfficerId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  targetOfficerId: event.target.value ? Number(event.target.value) : null,
                }))}
              >
                <option value="">默认：该城武力最高守将</option>
                {lureOfficers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}（武{o.stats.war}）</option>
                ))}
              </select>
            </label>
          ) : null}
          {isInstigate ? (
            <label className="block text-[10px] text-stone-500">
              第三方源城
              <select
                data-testid="command-strategy-feint-city"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.feintCityId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  feintCityId: event.target.value ? Number(event.target.value) : null,
                }))}
              >
                <option value="">选择与目标城邻接的第三方城…</option>
                {instigateSources.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}（{game.factions[city.ruler!]?.name}）</option>
                ))}
              </select>
            </label>
          ) : null}
          {isPoach ? (
            <label className="block text-[10px] text-stone-500">
              挖角武将
              <select
                data-testid="command-strategy-target-officer"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.targetOfficerId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  targetOfficerId: event.target.value ? Number(event.target.value) : null,
                }))}
              >
                <option value="">选择该城在职非君主…</option>
                {poachOfficers.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}（忠{o.loyalty} 统{o.stats.leadership}）</option>
                ))}
              </select>
            </label>
          ) : null}
          {isSwapPillar ? (
            <label className="block text-[10px] text-stone-500">
              反间密探（必派）
              <select
                data-testid="command-strategy-agent"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.agentId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  agentId: event.target.value || null,
                }))}
              >
                <option value="">选择空闲密探…</option>
                {idleAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.agentKind === 'female' ? '♀ ' : ''}{agent.name}</option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="border border-stone-800 bg-stone-900/50 px-3 py-2 text-[10px] text-stone-500">
            <p>立即消耗：<span className="text-stone-300">{PLOT_COST[draft.type]}</span></p>
            <p>当前进行中：{overview.activeCount}/{overview.maxActive}</p>
          </div>
          {launchReason ? <p data-testid="command-strategy-launch-reason" className="text-[10px] text-amber-500">{launchReason}</p> : null}
          {!isEmpty && !isBlossom && !isKillChicken && !isStrikeWhileHot && !isWatchFire && !isEdict && draft.type !== PlotType.SOW_DISCORD ? (
            <button
              type="button"
              data-testid="command-strategy-go-intel"
              className="w-full rounded border border-sky-800 bg-sky-950/30 px-3 py-2 text-sky-100"
              onClick={() => dispatch({
                type: 'select-command',
                domain: 'intel',
                commandId: isSecretCrossing ? 'recon' : 'recon',
              })}
            >
              前往情报 · {isSecretCrossing ? '侦查/探秘' : '探秘'}
            </button>
          ) : null}
          <button
            type="button"
            data-testid="command-strategy-launch-submit"
            data-command-write="true"
            disabled={loading || launchReason != null}
            className="w-full rounded border border-violet-700 bg-violet-950/50 px-3 py-2 text-violet-100 disabled:opacity-40"
            onClick={() => setConfirmOpen(true)}
          >
            送交终审 · {PLOT_LABEL[draft.type]}
          </button>
          <p className="text-[10px] leading-relaxed text-stone-600">
            探秘和女间谍仍属于情报域；跨域导航不复制情报写链。
          </p>
        </section>
      ) : (
        <section className="min-h-0 space-y-2 overflow-y-auto" data-testid="command-strategy-ongoing">
          {overview.plots.length === 0 ? (
            <p className="border border-stone-800 bg-stone-900/50 px-3 py-3 text-stone-500">
              尚无己方计谋记录。
            </p>
          ) : overview.plots.map((plot) => (
            <article
              key={plot.id}
              data-testid={`command-strategy-plot-${plot.id}`}
              className="border border-stone-800 bg-stone-900/60 px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <strong className="text-stone-100">{plot.label} · {plot.target}</strong>
                <span className="text-[10px] text-violet-200">{plot.stageLabel}</span>
              </div>
              <p className="mt-1 text-[10px] text-stone-500">
                {plot.stage === PlotStage.RESOLVED ? '已完成' : `剩余 ${plot.monthsLeft} 月`}
                {plot.progress != null ? ` · 进度 ${plot.progress}%` : ''}
                {plot.detected ? ' · 已暴露' : ''}
              </p>
              {plot.message ? <p className="text-[10px] text-stone-400">{plot.message}</p> : null}
              {plot.cancellable ? (
                <button
                  type="button"
                  data-testid={`command-strategy-cancel-${plot.id}`}
                  data-command-write="true"
                  disabled={loading}
                  className="mt-2 w-full rounded border border-amber-900 bg-amber-950/40 px-2 py-1 text-[10px] text-amber-100 disabled:opacity-40"
                  onClick={() => void cancelPlot(plot.id)}
                >
                  提前终止（沉没成本不返还）
                </button>
              ) : null}
            </article>
          ))}
          <p className="text-[10px] text-stone-600">L2 战略计谋可提前终止；L1 战术计谋不可取消。</p>
        </section>
      )}
      <CommandConfirmDialog
        open={confirmOpen}
        category="计略"
        command={`确认发起${PLOT_LABEL[draft.type]}：${targetName}`}
        summary="计谋会立即扣除资源并进入准备或结算流程，失败时资源不返还。"
        items={[
          { label: '目标', value: targetName },
          { label: '立即消耗', value: PLOT_COST[draft.type], tone: 'warning' },
          { label: '执行者', value: (isHoney || isLureTiger || isInstigate || isSwapPillar) && draft.agentId ? game.intel?.agents?.[draft.agentId]?.name ?? '特工已失效' : '势力计略（不指定武将）' },
          { label: '结算', value: isEmpty ? '立即布置防御效果' : isKillChicken ? '即时杀鸡儆猴结算' : isStrikeWhileHot ? '即时锁定首击伤害×1.2' : isLureTiger ? '分期 2 月后诱离守将，城防减半' : isInstigate ? '准备 2 月后煽动第三方出征' : isPoach ? '分期 2 月后策反武将' : isWatchFire ? '分期 3 月后离间至开战' : isSwapPillar ? '准备 2 月后抽换守将' : isEdict ? '准备 1 月后诋毁民心' : isBlossom ? '准备 1 月后虚张生效' : '进入准备／成功率判定' },
          { label: '失败后果', value: '已消耗资源不返还' },
        ]}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return latest ? validateStrategyLaunch(latest, draft) : '计谋草稿已失效，请返回修改。';
        }}
        fallbackFocusSelector="[data-testid='command-domain-strategy']"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await launchPlot(draft.type, {
            targetCityId: isCityTarget ? draft.targetCityId ?? undefined : undefined,
            feintCityId: isSecretCrossing || isInstigate ? draft.feintCityId ?? undefined : undefined,
            targetFactionId: draft.type === PlotType.SOW_DISCORD || isStrikeWhileHot || isWatchFire || isEdict
              ? draft.targetFactionId ?? undefined
              : undefined,
            secondaryFactionId: isWatchFire ? draft.secondaryFactionId ?? undefined : undefined,
            targetOfficerId: isKillChicken || isHoney || isLureTiger || isPoach
              ? draft.targetOfficerId ?? undefined
              : undefined,
            agentId: isHoney || isLureTiger || isInstigate || isSwapPillar ? draft.agentId ?? undefined : undefined,
          });
          if (!useGameStore.getState().error) {
            setConfirmOpen(false);
            setDraft((current) => ({
              ...current,
              targetCityId: null,
              feintCityId: null,
              targetFactionId: null,
              secondaryFactionId: null,
              agentId: null,
              targetOfficerId: null,
            }));
          }
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-stone-800 bg-stone-900/60 px-2 py-2 text-center">
      <strong className="block text-stone-100">{value}</strong>
      <span className="text-[9px] text-stone-500">{label}</span>
    </div>
  );
}

function InfoList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="border border-stone-800 bg-stone-900/40 px-3 py-2">
      <h3 className="text-stone-300">{title}（{items.length}）</h3>
      <p className="mt-1 text-[10px] text-stone-500">{items.length > 0 ? items.join('、') : empty}</p>
    </div>
  );
}
