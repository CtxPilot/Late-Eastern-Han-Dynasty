// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-03：九品中正制引擎服务（Nine-Rank Engine）
 *
 * 负责：
 * 1. 势力中正巡查定品（conductNineRanksEvaluation）
 * 2. 势力门阀评阶统计分布（getNineRanksSummary）
 * 3. 宏观天下大势同步
 */

import {
  evaluateFactionNineRanks,
  deriveTrendStage,
  isUpperRank,
  isMiddleRank,
  isLowerRank,
  type GameState,
} from '@leh/shared';

export interface NineRanksSummary {
  factionId: number;
  totalOfficers: number;
  upperCount: number;   // 上品 (1~3品)
  middleCount: number;  // 中品 (4~6品)
  lowerCount: number;   // 下品 (7~9品)
  gradeDistribution: Record<number, number>; // 1~9 品分布
}

/**
 * 势力进行九品中正大定品。
 * - 全员依据家世门第、才德五维、声誉功绩重新考评品阶；
 * - 同步宏观大势 trendStage；
 * - 记录 actionLog；
 * - 遵循 COW 不可变原则。
 */
export function conductNineRanksEvaluation(state: GameState, factionId: number): GameState {
  const faction = state.factions[factionId];
  if (!faction || !faction.isAlive) {
    throw new Error('势力不存在或已灭亡');
  }

  const nextOfficers = evaluateFactionNineRanks(state.officers, factionId);
  const nextTrend = state.trendStage ?? deriveTrendStage(state.currentYear, state);

  const actionLogEntry = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'nine_ranks_evaluation',
    message: `${faction.name} 施行九品官人给定品，考评在任百官门阀才德。`,
  };

  return {
    ...state,
    officers: nextOfficers,
    trendStage: nextTrend,
    actionLog: [actionLogEntry, ...state.actionLog],
  };
}

/**
 * 获取势力官员的九品中正分布摘要。
 */
export function getNineRanksSummary(state: GameState, factionId: number): NineRanksSummary {
  const officers = Object.values(state.officers).filter(
    (o) => o.faction === factionId && o.status === 'active',
  );

  let upperCount = 0;
  let middleCount = 0;
  let lowerCount = 0;
  const gradeDistribution: Record<number, number> = {
    1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0,
  };

  for (const o of officers) {
    const grade = o.rankGrade ?? 9;
    gradeDistribution[grade] = (gradeDistribution[grade] ?? 0) + 1;
    if (isUpperRank(grade)) {
      upperCount++;
    } else if (isMiddleRank(grade)) {
      middleCount++;
    } else if (isLowerRank(grade)) {
      lowerCount++;
    }
  }

  return {
    factionId,
    totalOfficers: officers.length,
    upperCount,
    middleCount,
    lowerCount,
    gradeDistribution,
  };
}
