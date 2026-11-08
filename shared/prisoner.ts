// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-04：战俘处置与刑赏牢狱体系（Prisoner & Captives System）
 *
 * 核心模型：
 * 1. 战俘招降几率模型（calculatePrisonerSurrenderChance）
 * 2. 战俘赎金估价模型（calculatePrisonerRansomValue）
 * 3. 战俘过滤与状态判定纯函数
 */

import { OfficerStatus } from './enums/index.js';
import type { Officer } from './types/officer.js';
import { meritLevelFor } from './merit.js';

export type PrisonerAction = 'persuade' | 'release' | 'ransom' | 'execute';

export interface SurrenderChanceBreakdown {
  baseChance: number;
  righteousnessPenalty: number;
  loyaltyPenalty: number;
  imprisonedBonus: number;
  rulerCharmBonus: number;
  rulerTalentBonus: number;
  fameBonus: number;
  finalChance: number; // 百分比整数 5~85
}

/**
 * 计算战俘招降归顺几率（纯函数）。
 * - 结合战俘心志（义理、前主忠诚）、羁押心理演进（久闭牢狱锐气消解）、招抚君主魅力才智与势力声望；
 * - 最终成功率夹紧在 [5, 85] 区间内。
 */
export function calculatePrisonerSurrenderChance(
  prisoner: Officer,
  captorRuler: Officer,
  monthsImprisoned?: number,
  captorFame?: number,
): SurrenderChanceBreakdown {
  const baseChance = 35;

  // 1. 战俘心理抵抗
  // 义理基线 50，高于 50 每点减少 0.4% 成功率，低于 50 增加几率
  const righteousness = prisoner.hidden?.righteousness ?? 50;
  const righteousnessPenalty = Math.round((righteousness - 50) * 0.4);

  // 前主忠诚度基线 50，忠诚度越高越不易被劝降
  const loyalty = prisoner.loyalty ?? 50;
  const loyaltyPenalty = Math.round((loyalty - 50) * 0.3);

  // 2. 羁押月数屈服加成：每被羁押关押 1 个月，意志消磨 +2%，封顶 30%
  const months = monthsImprisoned ?? prisoner.imprisonedMonths ?? 0;
  const imprisonedBonus = Math.min(30, Math.max(0, months * 2));

  // 3. 招抚君主魅力与才识加成
  const charm = captorRuler.stats?.charisma ?? 50;
  const rulerCharmBonus = Math.round((charm - 50) * 0.3);

  const bestTalent = Math.max(
    captorRuler.stats?.intelligence ?? 50,
    captorRuler.stats?.politics ?? 50,
  );
  const rulerTalentBonus = Math.round((bestTalent - 50) * 0.2);

  // 4. 俘获方势力声望加成（每 100 声望 +1%，最多 +10%）
  const fame = captorFame ?? 0;
  const fameBonus = Math.min(10, Math.max(0, Math.floor(fame / 100)));

  const rawChance =
    baseChance -
    righteousnessPenalty -
    loyaltyPenalty +
    imprisonedBonus +
    rulerCharmBonus +
    rulerTalentBonus +
    fameBonus;

  const finalChance = Math.max(5, Math.min(85, Math.round(rawChance)));

  return {
    baseChance,
    righteousnessPenalty,
    loyaltyPenalty,
    imprisonedBonus,
    rulerCharmBonus,
    rulerTalentBonus,
    fameBonus,
    finalChance,
  };
}

/**
 * 计算战俘赎金公允估价（纯函数）。
 * - 基础金钱：300 金；
 * - 武将五维总和超过 300 部分折算为赎金；
 * - 九品品阶：上品（1~3品）+300 金，中品（4~6品）+150 金；
 * - 功绩等级：每级 +20 金；
 * - 区间夹紧：[100, 1500] 金。
 */
export function calculatePrisonerRansomValue(prisoner: Officer): number {
  let value = 300;

  const stats = prisoner.stats;
  if (stats) {
    const totalStats =
      stats.leadership +
      stats.war +
      stats.intelligence +
      stats.politics +
      stats.charisma;
    if (totalStats > 300) {
      value += Math.round((totalStats - 300) * 1.5);
    }
  }

  // 品阶加成
  if (prisoner.rankGrade != null) {
    if (prisoner.rankGrade <= 3) {
      value += 300;
    } else if (prisoner.rankGrade <= 6) {
      value += 150;
    }
  }

  // 功绩加成（高于白身 Lv1 每级加 20 金）
  const meritLv = prisoner.meritLevel ?? meritLevelFor(prisoner.merit ?? 0);
  if (meritLv > 1) {
    value += (meritLv - 1) * 20;
  }

  return Math.max(100, Math.min(1500, Math.round(value)));
}

/**
 * 判定武将是否为处于战俘关押状态。
 */
export function isPrisoner(officer: Officer): boolean {
  return officer.status === OfficerStatus.PRISONER;
}

/**
 * 获取指定势力当前羁押关押的所有战俘列表。
 */
export function getFactionPrisoners(
  officers: Record<number, Officer>,
  captorFactionId: number,
): Officer[] {
  return Object.values(officers).filter(
    (o) =>
      o.status === OfficerStatus.PRISONER &&
      o.captiveByFactionId === captorFactionId,
  );
}
