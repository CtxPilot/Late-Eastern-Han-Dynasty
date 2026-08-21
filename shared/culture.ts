// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 Session 363：文化对既有技艺门槛的只读投影。
 *
 * 这组门槛只负责展示进度；在正式技艺研发/人才吸引消费落地前，不能被当作解锁或数值加成。
 */
export const CULTURE_TECH_LEVEL_THRESHOLDS = [100, 250, 500, 700, 900] as const;
export const CULTURE_RUNTIME_MAX = 999;

export interface CultureThresholdProgress {
  current: number;
  reachedLevels: number;
  maxLevel: number;
  nextLevel: number | null;
  nextThreshold: number | null;
  remaining: number;
}

export function cultureThresholdProgress(value: number): CultureThresholdProgress {
  const current = Number.isFinite(value)
    ? Math.max(0, Math.min(CULTURE_RUNTIME_MAX, Math.floor(value)))
    : 0;
  const reachedLevels = CULTURE_TECH_LEVEL_THRESHOLDS.filter((threshold) => current >= threshold).length;
  const nextThreshold = CULTURE_TECH_LEVEL_THRESHOLDS[reachedLevels] ?? null;

  return {
    current,
    reachedLevels,
    maxLevel: CULTURE_TECH_LEVEL_THRESHOLDS.length,
    nextLevel: nextThreshold == null ? null : reachedLevels + 1,
    nextThreshold,
    remaining: nextThreshold == null ? 0 : nextThreshold - current,
  };
}
