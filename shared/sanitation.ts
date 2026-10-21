// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 卫生运行时：门槛投影 + 人口增长/死亡率调节 + 瘟疫状态常数。
 *
 * 依据 docs/04 §2.1、§23.6、§28.3 与 docs/08-data-dictionary.md。
 */
import {
  CULTURE_RUNTIME_MAX,
  CULTURE_TECH_LEVEL_THRESHOLDS,
  cultureThresholdProgress,
  type CultureThresholdProgress,
} from './culture.js';

export const SANITATION_THRESHOLDS = CULTURE_TECH_LEVEL_THRESHOLDS;
export const SANITATION_RUNTIME_MAX = CULTURE_RUNTIME_MAX;

/** 瘟疫天然免疫门槛：卫生 >= 150 绝不爆发瘟疫 */
export const SANITATION_PLAGUE_IMMUNE_THRESHOLD = 150;

/** 瘟疫爆发恶劣卫生门槛：卫生 < 100 存在风险，< 60 爆发重度瘟疫 */
export const SANITATION_PLAGUE_RISK_THRESHOLD = 100;
export const SANITATION_PLAGUE_SEVERE_THRESHOLD = 60;

/** 瘟疫持续月数 */
export const PLAGUE_MONTHS_MILD = 2;
export const PLAGUE_MONTHS_SEVERE = 3;

/** 瘟疫人口损耗率（每月） */
export const PLAGUE_MORTALITY_MILD = 0.008; // 0.8%
export const PLAGUE_MORTALITY_SEVERE = 0.015; // 1.5%

/** 瘟疫城内驻留武将每月体力扣除 */
export const PLAGUE_OFFICER_STAMINA_DRAIN = 15;

/** 瘟疫城防守军每月士气扣除 */
export const PLAGUE_TROOPS_MORALE_DRAIN = 3;

export function sanitationThresholdProgress(value: number): CultureThresholdProgress {
  return cultureThresholdProgress(value);
}

export const computeSanitationThresholdProgress = sanitationThresholdProgress;

export interface SanitationDemographicModifiers {
  birthMultiplier: number;
  childDeathMultiplier: number;
  adultDeathMultiplier: number;
  elderDeathMultiplier: number;
}

/**
 * 计算卫生对人口生育与死亡率的乘数修饰：
 * - 卫生达标 (Lv1~5): 儿童死亡率最高 -50%, 老人死亡率最高 -40%, 成人死亡率最高 -40%, 生育率最高 +10%
 * - 卫生恶劣 (<100, Lv0): 儿童死亡率 +30%, 老人死亡率 +25%
 */
export function computeSanitationDemographicModifiers(sanitationValue: number): SanitationDemographicModifiers {
  const progress = sanitationThresholdProgress(sanitationValue);
  const levels = progress.reachedLevels;

  if (levels > 0) {
    return {
      birthMultiplier: 1 + levels * 0.02,
      childDeathMultiplier: Math.max(0.5, 1 - levels * 0.1),
      adultDeathMultiplier: Math.max(0.6, 1 - levels * 0.08),
      elderDeathMultiplier: Math.max(0.6, 1 - levels * 0.08),
    };
  }

  // Lv0: 卫生恶劣
  return {
    birthMultiplier: 1.0,
    childDeathMultiplier: 1.3,
    adultDeathMultiplier: 1.0,
    elderDeathMultiplier: 1.25,
  };
}
