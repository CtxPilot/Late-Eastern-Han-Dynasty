// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  type GameAction,
  type GameState,
  type Officer,
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  OfficerStatus,
  calculatePrisonerRansomValue,
  calculatePrisonerSurrenderChance,
  findDiplomacy,
  relationPairKey,
  resolveAffinity,
} from '@leh/shared';
import { upsertLink } from './diplomacy.js';
import { registerBloodFeud } from './relationDepth.js';

export interface SurrenderResult {
  state: GameState;
  success: boolean;
  message: string;
  chanceEvaluation: ReturnType<typeof calculatePrisonerSurrenderChance>;
}

export interface RansomResult {
  state: GameState;
  ransom: number;
  success: boolean;
  message: string;
}

/**
 * 战俘处置：劝降招降。
 *
 * 结合双方主从义理、忠诚度、关押月数久羁衰退、势力声望与君主德望进行几率判定。
 * 成功：正式改换门庭归顺本势力，转为 ACTIVE 并分配基础忠诚；
 * 失败：意志略受动摇（忠诚-2），仍关押候审。
 */
export function persuadePrisonerSurrender(
  state: GameState,
  prisonerId: number,
  captorFactionId: number,
  rng: () => number,
): SurrenderResult {
  const prisoner = state.officers[prisonerId];
  if (!prisoner || prisoner.status !== OfficerStatus.PRISONER) {
    throw new Error(`武将 ${prisonerId} 不是在押战俘`);
  }
  if (prisoner.captiveByFactionId !== captorFactionId) {
    throw new Error(`武将 ${prisoner.name} 并非由本势力羁押关押`);
  }
  const captorFaction = state.factions[captorFactionId];
  if (!captorFaction) {
    throw new Error(`羁押势力 ${captorFactionId} 不存在`);
  }

  const leader = captorFaction.rulerId ? state.officers[captorFaction.rulerId] : null;
  const captorRuler = leader ?? prisoner;
  const captorFame = captorFaction.fame ?? 0;
  const months = prisoner.imprisonedMonths ?? 0;
  const chanceEvaluation = calculatePrisonerSurrenderChance(
    prisoner,
    captorRuler,
    months,
    captorFame,
  );

  const roll = rng() * 100;
  const success = roll < chanceEvaluation.finalChance;

  if (success) {
    // 成功归降
    const baseLoyalty = Math.max(
      50,
      Math.min(95, 60 + Math.floor((leader?.stats.charisma ?? 50) * 0.2)),
    );
    const updatedPrisoner: Officer = {
      ...prisoner,
      status: OfficerStatus.ACTIVE,
      faction: captorFactionId,
      captiveByFactionId: undefined,
      imprisonedMonths: 0,
      loyalty: baseLoyalty,
      civilPosition: CivilPosition.NONE,
      militaryPosition: MilitaryPosition.NONE,
      localPosition: LocalPosition.NONE,
      hegemonyPosition: undefined,
      location: leader?.location ?? captorFaction.capitalCityId,
    };

    // 势力声望 +5
    const updatedCaptorFaction = {
      ...captorFaction,
      fame: (captorFaction.fame ?? 0) + 5,
    };

    // 君臣亲和 +15
    let affinities = { ...(state.relationAffinities ?? {}) };
    if (leader) {
      const key = relationPairKey(prisoner.id, leader.id);
      const curr = resolveAffinity(prisoner, leader, affinities);
      affinities[key] = Math.min(100, curr + 15);
    }

    const logEntry: GameAction = {
      year: state.currentYear,
      month: state.currentMonth,
      type: 'prisoner_surrender',
      message: `【招降归顺】${prisoner.name} 感念明公宽宏厚德，誓言归顺我军，效犬马之劳！`,
    };

    const nextState: GameState = {
      ...state,
      officers: { ...state.officers, [prisoner.id]: updatedPrisoner },
      factions: { ...state.factions, [captorFactionId]: updatedCaptorFaction },
      relationAffinities: affinities,
      actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
    };

    return {
      state: nextState,
      success: true,
      message: `招降成功！${prisoner.name} 正式归顺`,
      chanceEvaluation,
    };
  } else {
    // 劝降未果，忠诚微降
    const updatedPrisoner: Officer = {
      ...prisoner,
      loyalty: Math.max(20, (prisoner.loyalty ?? 80) - 2),
    };

    const logEntry: GameAction = {
      year: state.currentYear,
      month: state.currentMonth,
      type: 'prisoner_refuse',
      message: `【劝降未果】${prisoner.name} 意气凛然，誓死不从。`,
    };

    const nextState: GameState = {
      ...state,
      officers: { ...state.officers, [prisoner.id]: updatedPrisoner },
      actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
    };

    return {
      state: nextState,
      success: false,
      message: `${prisoner.name} 誓死不从，劝降未果`,
      chanceEvaluation,
    };
  }
}

/**
 * 战俘处置：义释放归。
 *
 * 宽仁待俘，本势力声望+15，获释武将对君主亲和+30；若母国存活两国好感+15。
 */
export function releasePrisoner(
  state: GameState,
  prisonerId: number,
  captorFactionId: number,
): GameState {
  const prisoner = state.officers[prisonerId];
  if (!prisoner || prisoner.status !== OfficerStatus.PRISONER) {
    throw new Error(`武将 ${prisonerId} 不是在押战俘`);
  }
  if (prisoner.captiveByFactionId !== captorFactionId) {
    throw new Error(`武将 ${prisoner.name} 并非由本势力羁押关押`);
  }
  const captorFaction = state.factions[captorFactionId];
  if (!captorFaction) {
    throw new Error(`羁押势力 ${captorFactionId} 不存在`);
  }

  const originalFaction =
    prisoner.faction != null ? state.factions[prisoner.faction] : undefined;
  const originalAlive = originalFaction && (originalFaction.cityIds?.length ?? 0) > 0;

  const updatedPrisoner: Officer = {
    ...prisoner,
    status: originalAlive ? OfficerStatus.ACTIVE : OfficerStatus.FREE,
    faction: originalAlive ? prisoner.faction : 0,
    captiveByFactionId: undefined,
    imprisonedMonths: 0,
    location: originalAlive ? originalFaction.capitalCityId : captorFaction.capitalCityId,
  };

  const updatedCaptorFaction = {
    ...captorFaction,
    fame: (captorFaction.fame ?? 0) + 15,
  };

  let affinities = { ...(state.relationAffinities ?? {}) };
  const leader = captorFaction.rulerId ? state.officers[captorFaction.rulerId] : null;
  if (leader) {
    const key = relationPairKey(prisoner.id, leader.id);
    const curr = resolveAffinity(prisoner, leader, affinities);
    affinities[key] = Math.min(100, curr + 30);
  }

  let diplomacy = state.diplomacy;
  if (originalAlive && originalFaction.id !== captorFactionId) {
    const existingFavor =
      findDiplomacy(diplomacy, captorFactionId, originalFaction.id)?.favorability ?? 0;
    diplomacy = upsertLink(
      diplomacy,
      captorFactionId,
      originalFaction.id,
      { favorability: Math.min(100, existingFavor + 15) },
      state,
    );
  }

  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'prisoner_release',
    message: `【义释战俘】宽宏仁厚，义释战俘 ${prisoner.name}。海内称颂，威德远播！`,
  };

  return {
    ...state,
    officers: { ...state.officers, [prisoner.id]: updatedPrisoner },
    factions: { ...state.factions, [captorFactionId]: updatedCaptorFaction },
    diplomacy,
    relationAffinities: affinities,
    actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
  };
}

/**
 * 战俘处置：索取赎金。
 *
 * 依据武将五维、九品中正品阶及功绩折算法定赎金（100~1500金），向母国国库收取交割，武将获释归国。
 */
export function ransomPrisoner(
  state: GameState,
  prisonerId: number,
  captorFactionId: number,
): RansomResult {
  const prisoner = state.officers[prisonerId];
  if (!prisoner || prisoner.status !== OfficerStatus.PRISONER) {
    throw new Error(`武将 ${prisonerId} 不是在押战俘`);
  }
  if (prisoner.captiveByFactionId !== captorFactionId) {
    throw new Error(`武将 ${prisoner.name} 并非由本势力羁押关押`);
  }
  const captorFaction = state.factions[captorFactionId];
  if (!captorFaction) {
    throw new Error(`羁押势力 ${captorFactionId} 不存在`);
  }

  const originalFaction =
    prisoner.faction != null ? state.factions[prisoner.faction] : undefined;
  if (!originalFaction || (originalFaction.cityIds?.length ?? 0) === 0) {
    throw new Error(`武将 ${prisoner.name} 原所属势力已灭亡，无法索取赎金`);
  }

  const nominalRansom = calculatePrisonerRansomValue(prisoner);
  const treasury = originalFaction.gold ?? 0;
  if (treasury <= 0) {
    throw new Error(`原所属势力国库空虚，无力支付赎金`);
  }
  const actualRansom = Math.min(nominalRansom, treasury);

  const updatedOriginalFaction = {
    ...originalFaction,
    gold: Math.max(0, treasury - actualRansom),
  };
  const updatedCaptorFaction = {
    ...captorFaction,
    gold: (captorFaction.gold ?? 0) + actualRansom,
  };

  const updatedPrisoner: Officer = {
    ...prisoner,
    status: OfficerStatus.ACTIVE,
    captiveByFactionId: undefined,
    imprisonedMonths: 0,
    location: originalFaction.capitalCityId,
  };

  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'prisoner_ransom',
    message: `【战俘交割】${originalFaction.name} 交付国库赎金 ${actualRansom} 金，赎回重臣 ${prisoner.name}。`,
  };

  const nextState: GameState = {
    ...state,
    officers: { ...state.officers, [prisoner.id]: updatedPrisoner },
    factions: {
      ...state.factions,
      [originalFaction.id]: updatedOriginalFaction,
      [captorFactionId]: updatedCaptorFaction,
    },
    actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
  };

  return {
    state: nextState,
    ransom: actualRansom,
    success: true,
    message: `成功赎回！收讫国库赎金 ${actualRansom} 金`,
  };
}

/**
 * 战俘处置：严刑斩立决。
 *
 * 将战俘推出处斩：武将死亡，羁押方声望依品阶严厉扣除 50~100 点，母国关系暴跌-50，死者义兄弟/亲族直系与处刑君主结下血海深仇！
 */
export function executePrisoner(
  state: GameState,
  prisonerId: number,
  captorFactionId: number,
): GameState {
  const prisoner = state.officers[prisonerId];
  if (!prisoner || prisoner.status !== OfficerStatus.PRISONER) {
    throw new Error(`武将 ${prisonerId} 不是在押战俘`);
  }
  if (prisoner.captiveByFactionId !== captorFactionId) {
    throw new Error(`武将 ${prisoner.name} 并非由本势力羁押关押`);
  }
  const captorFaction = state.factions[captorFactionId];
  if (!captorFaction) {
    throw new Error(`羁押势力 ${captorFactionId} 不存在`);
  }

  const updatedPrisoner: Officer = {
    ...prisoner,
    status: OfficerStatus.DEAD,
    location: null,
    captiveByFactionId: undefined,
    imprisonedMonths: undefined,
    civilPosition: CivilPosition.NONE,
    militaryPosition: MilitaryPosition.NONE,
    localPosition: LocalPosition.NONE,
    hegemonyPosition: undefined,
  };

  const rank = prisoner.rankGrade;
  const penalty = rank != null && rank <= 3 ? 100 : rank != null && rank <= 6 ? 75 : 50;
  const updatedCaptorFaction = {
    ...captorFaction,
    fame: Math.max(0, (captorFaction.fame ?? 0) - penalty),
  };

  let nextState: GameState = {
    ...state,
    officers: { ...state.officers, [prisoner.id]: updatedPrisoner },
    factions: { ...state.factions, [captorFactionId]: updatedCaptorFaction },
  };

  // 血仇建立（直系/义兄弟/师徒与 captorLeader 结为仇敌，亲和坠至 -100）
  if (captorFaction.rulerId) {
    nextState = registerBloodFeud(nextState, captorFaction.rulerId, prisoner.id);
  }

  // 母国外交恶化
  const originalFaction =
    prisoner.faction != null ? state.factions[prisoner.faction] : undefined;
  if (
    originalFaction &&
    (originalFaction.cityIds?.length ?? 0) > 0 &&
    originalFaction.id !== captorFactionId
  ) {
    const existingFavor =
      findDiplomacy(nextState.diplomacy, captorFactionId, originalFaction.id)?.favorability ?? 0;
    nextState = {
      ...nextState,
      diplomacy: upsertLink(
        nextState.diplomacy,
        captorFactionId,
        originalFaction.id,
        { favorability: Math.max(-100, existingFavor - 50) },
        nextState,
      ),
    };
  }

  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'prisoner_executed',
    message: `【严刑斩决】将战俘 ${prisoner.name} 推出斩首！天下士人深恶其暴，声望受损！`,
  };

  nextState = {
    ...nextState,
    actionLog: [logEntry, ...(nextState.actionLog ?? [])].slice(0, 80),
  };

  return nextState;
}

/**
 * 月度在押战俘状态演进（turn.ts 月结管线中调用）。
 *
 * 保证 COW 与零漂移铁律：
 * 若当前无任何在押战俘，直接返回原引用 state，不消耗任何 RNG，零内存对象分配。
 * 若有在押战俘：
 * 1. 关押月数 +1；
 * 2. 忠诚意志每月 -1（最低 20）；
 * 3. 智谋高/久押战俘有机率越狱脱枷。
 */
export function tickPrisonersMonth(state: GameState, rng: () => number): GameState {
  const prisonerEntries = Object.entries(state.officers).filter(
    ([, o]) => o.status === OfficerStatus.PRISONER,
  );
  if (prisonerEntries.length === 0) {
    return state;
  }

  let hasChanges = false;
  const updatedOfficers = { ...state.officers };
  const logs: GameAction[] = [];

  for (const [idStr, prisoner] of prisonerEntries) {
    const id = Number(idStr);
    const months = (prisoner.imprisonedMonths ?? 0) + 1;
    const loyalty = Math.max(20, (prisoner.loyalty ?? 80) - 1);

    // 越狱检定：智力 > 80 为 3%，智力 > 65 为 1.5%，其余 0.5%
    let escapeChance =
      prisoner.stats?.intelligence && prisoner.stats.intelligence > 80
        ? 3
        : prisoner.stats?.intelligence && prisoner.stats.intelligence > 65
          ? 1.5
          : 0.5;
    if (months > 12) escapeChance += 1.0;

    const roll = rng() * 100;
    if (roll < escapeChance) {
      // 越狱成功
      const origFaction =
        prisoner.faction != null ? state.factions[prisoner.faction] : undefined;
      const origAlive = origFaction && (origFaction.cityIds?.length ?? 0) > 0;
      updatedOfficers[id] = {
        ...prisoner,
        status: origAlive ? OfficerStatus.ACTIVE : OfficerStatus.FREE,
        faction: origAlive ? prisoner.faction : 0,
        captiveByFactionId: undefined,
        imprisonedMonths: 0,
        loyalty,
        location: origAlive ? origFaction.capitalCityId : null,
      };
      logs.push({
        year: state.currentYear,
        month: state.currentMonth,
        type: 'prisoner_escape',
        message: `【战俘潜逃】在押战俘 ${prisoner.name} 乘夜机敏脱枷，逃出生天！`,
      });
      hasChanges = true;
    } else {
      updatedOfficers[id] = {
        ...prisoner,
        imprisonedMonths: months,
        loyalty,
      };
      hasChanges = true;
    }
  }

  if (!hasChanges) {
    return state;
  }

  return {
    ...state,
    officers: updatedOfficers,
    actionLog: [...logs, ...(state.actionLog ?? [])].slice(0, 80),
  };
}
