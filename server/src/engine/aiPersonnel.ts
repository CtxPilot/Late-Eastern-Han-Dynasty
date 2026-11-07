// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P5-01 AI 人事决策引擎（同城在野登用 & 低忠诚赏赐维稳）。
 *
 * 核心逻辑：
 * 1. 扫描 AI 城池中出现的在野武将（FREE）；
 * 2. 选派同城高魅力官员实施登用，相性吻合或魅力卓越者纳为心腹；
 * 3. 监测麾下低忠诚官员（<65），适度颁赐金帛防止离间背叛；
 * 4. 零破坏性修改，严格遵循文言起居注叙事规范。
 */

import {
  OfficerStatus,
  resolveRecruitChance,
  type GameState,
} from '@leh/shared';
import { syncFactionResources } from './economy.js';

export const AI_PERSONNEL_CONFIG = Object.freeze({
  recruitGoldCost: 200,
  rewardGoldCost: 50,
  loyaltyWarningThreshold: 65,
  loyaltyRewardGain: 8,
  minRecruitChance: 40,
  baseLoyaltyOnRecruit: 60,
});

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
      {
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

/** 计算两位武将的相性差（0~150 环状结构） */
export function getAffinityDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 150 - diff);
}

/** AI 城池尝试登用同城在野武将 */
export function decideAiRecruitWandering(
  state: GameState,
  factionId: number,
): GameState | null {
  const faction = state.factions[factionId];
  if (!faction || !faction.isAlive) return null;

  const myCities = Object.values(state.cities)
    .filter((c) => c.ruler === factionId && c.gold >= AI_PERSONNEL_CONFIG.recruitGoldCost)
    .sort((a, b) => b.gold - a.gold);

  if (myCities.length === 0) return null;

  for (const city of myCities) {
    // 查找城中的在野武将（FREE 且 location 匹配）
    const freeOfficers = Object.values(state.officers)
      .filter((o) => o.status === OfficerStatus.FREE && o.location === city.id)
      .sort((a, b) => (b.stats.leadership + b.stats.intelligence) - (a.stats.leadership + a.stats.intelligence));

    if (freeOfficers.length === 0) continue;

    // 寻找同城可用招募官员
    const recruiters = Object.values(state.officers)
      .filter((o) => o.faction === factionId && o.status === OfficerStatus.ACTIVE && o.location === city.id)
      .sort((a, b) => b.stats.charisma - a.stats.charisma);

    if (recruiters.length === 0) continue;
    const recruiter = recruiters[0];
    const target = freeOfficers[0];

    const chance = resolveRecruitChance(recruiter, target);
    const dist = getAffinityDistance(recruiter.hidden.compatibility, target.hidden.compatibility);

    if (chance >= AI_PERSONNEL_CONFIG.minRecruitChance || recruiter.stats.charisma >= 80) {
      const cities = {
        ...state.cities,
        [city.id]: {
          ...city,
          gold: city.gold - AI_PERSONNEL_CONFIG.recruitGoldCost,
        },
      };

      const initialLoyalty = Math.min(
        100,
        AI_PERSONNEL_CONFIG.baseLoyaltyOnRecruit + Math.max(0, Math.floor((45 - dist) / 2)),
      );

      const officers = {
        ...state.officers,
        [target.id]: {
          ...target,
          status: OfficerStatus.ACTIVE,
          faction: factionId,
          loyalty: initialLoyalty,
        },
      };

      const msg = `【人事】${recruiter.name}在${city.name}寻访并登用在野名士${target.name}，誓效犬马之劳！`;
      return pushLog(state, 'ai_personnel', msg, { cities, officers });
    }
  }

  return null;
}

/** AI 势力对忠诚偏低的武将适度赏赐维稳 */
export function decideAiLoyaltyReward(
  state: GameState,
  factionId: number,
): GameState | null {
  const faction = state.factions[factionId];
  if (!faction || !faction.isAlive) return null;

  const lowLoyaltyOfficers = Object.values(state.officers)
    .filter(
      (o) =>
        o.faction === factionId &&
        o.status === OfficerStatus.ACTIVE &&
        (o.loyalty ?? 100) < AI_PERSONNEL_CONFIG.loyaltyWarningThreshold,
    )
    .sort((a, b) => (a.loyalty ?? 100) - (b.loyalty ?? 100));

  if (lowLoyaltyOfficers.length === 0) return null;

  for (const officer of lowLoyaltyOfficers) {
    if (officer.location == null) continue;
    const city = state.cities[officer.location];
    if (!city || city.ruler !== factionId || city.gold < AI_PERSONNEL_CONFIG.rewardGoldCost) continue;

    const currentLoyalty = officer.loyalty ?? 50;
    const nextLoyalty = Math.min(100, currentLoyalty + AI_PERSONNEL_CONFIG.loyaltyRewardGain);

    const cities = {
      ...state.cities,
      [city.id]: {
        ...city,
        gold: city.gold - AI_PERSONNEL_CONFIG.rewardGoldCost,
      },
    };

    const officers = {
      ...state.officers,
      [officer.id]: {
        ...officer,
        loyalty: nextLoyalty,
      },
    };

    const msg = `【人事】${faction.name}向${officer.name}颁赐金帛以彰勤绩，其忠诚度提升至${nextLoyalty}。`;
    return pushLog(state, 'ai_personnel', msg, { cities, officers });
  }

  return null;
}

/** 每回合运行非玩家势力人事管理与在野人才纳贤 */
export function runAllAiPersonnel(state: GameState): GameState {
  let s = state;

  const aiFactions = Object.values(s.factions)
    .filter((f) => f.isAlive && !f.isPlayer)
    .sort((a, b) => a.id - b.id);

  for (const f of aiFactions) {
    // 1. 尝试登用在野人才
    const recruitState = decideAiRecruitWandering(s, f.id);
    if (recruitState) {
      s = syncFactionResources(recruitState);
      continue;
    }

    // 2. 尝试犒赏维稳低忠将领
    const rewardState = decideAiLoyaltyReward(s, f.id);
    if (rewardState) {
      s = syncFactionResources(rewardState);
      continue;
    }
  }

  return s;
}
