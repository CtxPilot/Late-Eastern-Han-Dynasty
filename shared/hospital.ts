// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-06：战阵创伤、伤兵营收治与杏林医馆体系（Casualties, Field Hospital & Medical Recovery）
 *
 * 核心模型：
 * 1. 战场战损 40%/60% 分流纯函数（calculateCasualtySplit）
 * 2. 伤兵营月度回流与医疗加速模型（calculateMonthlyWoundedRecoveryRate）
 * 3. 武将创伤等级（0=健康, 1=轻伤, 2=中伤, 3=重伤, 4=濒死）与战力衰减计算（calculateInjuryCombatPenalty）
 * 4. 杏林医馆注资与派医施救成本规则
 */

import type { City } from './types/city.js';
import type { Officer } from './types/officer.js';

export enum InjuryLevel {
  HEALTHY = 0,
  MILD = 1,
  MODERATE = 2,
  SEVERE = 3,
  CRITICAL = 4,
}

export const HOSPITAL_FUNDING_COST = 100; // 官办医馆注资拨款经费（贯）
export const HOSPITAL_FUNDING_DURATION = 3; // 注资有效期（月）

export const CURE_COST_BY_INJURY: Record<number, number> = {
  [InjuryLevel.MILD]: 50,
  [InjuryLevel.MODERATE]: 100,
  [InjuryLevel.SEVERE]: 200,
  [InjuryLevel.CRITICAL]: 400,
};

/**
 * 战损分流计算（docs/04 §24.1）：
 * 战斗中损耗兵力按 40% 永久阵亡、60% 负伤转入城池伤兵营。
 */
export function calculateCasualtySplit(totalLoss: number): {
  dead: number;
  wounded: number;
} {
  if (totalLoss <= 0) {
    return { dead: 0, wounded: 0 };
  }
  const dead = Math.round(totalLoss * 0.4);
  const wounded = totalLoss - dead;
  return { dead, wounded };
}

/**
 * 检查武将是否掌握医道技艺或「悬壶济世」特性。
 */
export function hasMedicalSkill(officer?: Officer | null): boolean {
  if (!officer) return false;
  // 检查技能列表 (skillId)
  if (
    officer.skills?.some(
      (s) => s.skillId === 'medicine' || s.skillId === 'heal' || s.skillId === 'xuanhu',
    )
  ) {
    return true;
  }
  return false;
}

/**
 * 计算城池伤兵营当月伤兵自然回流率（docs/04 §24.2）。
 *
 * 基础 10%/月：
 * - 官办医馆注资拨款（hospitalFundedMonths > 0）：+10%；
 * - 城市卫生良好（sanitation >= 80）：+5%；
 * - 驻城武将拥有医术/悬壶特性：+10%；
 * - 药材特产或药材商路畅通：+5%；
 * 最终回流率夹紧在 [10%, 40%] 区间。
 */
export function calculateMonthlyWoundedRecoveryRate(params: {
  city: City;
  officersInCity?: Officer[];
  hasHerbSupply?: boolean;
}): number {
  const { city, officersInCity, hasHerbSupply } = params;

  let rate = 0.10; // 基础 10%

  // 官办医馆拨款扶持
  if (city.hospitalFundedMonths && city.hospitalFundedMonths > 0) {
    rate += 0.10;
  }

  // 城市卫生加成
  const sanitation = city.stats?.sanitation ?? 0;
  if (sanitation >= 80) {
    rate += 0.05;
  }

  // 驻城医官才艺加成
  if (officersInCity && officersInCity.some((o) => hasMedicalSkill(o))) {
    rate += 0.10;
  }

  // 药材特产/商道调理
  if (hasHerbSupply) {
    rate += 0.05;
  }

  return Math.min(0.40, Math.max(0.10, rate));
}

export interface InjuryCombatPenalty {
  forceModifier: number;
  commandModifier: number;
  allModifier: number;
  canDuel: boolean;
  canMarch: boolean;
  label: string;
}

/**
 * 计算武将负伤战力削减与行动受限（docs/04 §23.1/§23.4）。
 */
export function calculateInjuryCombatPenalty(injury?: number): InjuryCombatPenalty {
  const level = injury ?? InjuryLevel.HEALTHY;

  switch (level) {
    case InjuryLevel.MILD:
      return {
        forceModifier: 0.95,
        commandModifier: 0.95,
        allModifier: 1.0,
        canDuel: true,
        canMarch: true,
        label: '轻伤',
      };
    case InjuryLevel.MODERATE:
      return {
        forceModifier: 0.85,
        commandModifier: 0.90,
        allModifier: 1.0,
        canDuel: false, // 禁止单挑
        canMarch: true,
        label: '中伤',
      };
    case InjuryLevel.SEVERE:
      return {
        forceModifier: 0.80,
        commandModifier: 0.80,
        allModifier: 0.80, // 全属性-20%
        canDuel: false,
        canMarch: false, // 禁止出征行军
        label: '重伤',
      };
    case InjuryLevel.CRITICAL:
      return {
        forceModifier: 0.60,
        commandModifier: 0.60,
        allModifier: 0.60, // 全属性-40%
        canDuel: false,
        canMarch: false,
        label: '濒死',
      };
    case InjuryLevel.HEALTHY:
    default:
      return {
        forceModifier: 1.0,
        commandModifier: 1.0,
        allModifier: 1.0,
        canDuel: true,
        canMarch: true,
        label: '健康',
      };
  }
}

/**
 * 创伤自然降级/痊愈所需月数门槛（docs/04 §23.1）。
 */
export function getHealingMonthsRequired(injury: number): number {
  switch (injury) {
    case InjuryLevel.MILD:
      return 2;
    case InjuryLevel.MODERATE:
      return 4;
    case InjuryLevel.SEVERE:
      return 6;
    case InjuryLevel.CRITICAL:
      return 12;
    default:
      return 0;
  }
}

/**
 * 判断武将是否处于负伤状态。
 */
export function isOfficerInjured(officer?: Officer | null): boolean {
  return Boolean(officer && officer.injury && officer.injury > 0);
}
