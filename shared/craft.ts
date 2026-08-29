// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 工艺运行时：质量门槛（与文化技艺门槛同构）+ 征兵质量消费（Session 401）。
 *
 * 0-A 以「征兵后部队士气加成」代理正式兵质等级（P5-14 后置）；
 * 器械建造速度仍后置。
 */
import {
  CULTURE_RUNTIME_MAX,
  CULTURE_TECH_LEVEL_THRESHOLDS,
  cultureThresholdProgress,
  type CultureThresholdProgress,
} from './culture.js';

/** 工艺质量门槛与文化技艺门槛同构（真源 docs/08）。 */
export const CRAFT_QUALITY_THRESHOLDS = CULTURE_TECH_LEVEL_THRESHOLDS;
export const CRAFT_RUNTIME_MAX = CULTURE_RUNTIME_MAX;

/** 每达 1 级工艺门槛，征兵后部队士气 +N（真源 docs/08）。 */
export const CRAFT_CONSCRIPT_MORALE_PER_LEVEL = 2;

export function craftQualityThresholdProgress(value: number): CultureThresholdProgress {
  return cultureThresholdProgress(value);
}

/**
 * 工艺对征兵质量的代理：Lv0=+0 … Lv5=+10 部队士气。
 * 不消费 RNG；最终士气仍 clamp 到 [0, 100]。
 */
export function craftConscriptMoraleBonus(craftValue: number): number {
  return craftQualityThresholdProgress(craftValue).reachedLevels * CRAFT_CONSCRIPT_MORALE_PER_LEVEL;
}
