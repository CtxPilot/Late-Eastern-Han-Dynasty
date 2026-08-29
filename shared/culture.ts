// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 文化运行时：门槛投影（Session 363）+ 人才登用加成（Session 400）。
 *
 * 技艺研发解锁仍后置；本轮仅消费「人才吸引」一侧——已达门槛级数 → 登用成功率百分点。
 */
export const CULTURE_TECH_LEVEL_THRESHOLDS = [100, 250, 500, 700, 900] as const;
export const CULTURE_RUNTIME_MAX = 999;

/** 每达 1 级技艺门槛，登用成功率 +N 百分点（真源 docs/08）。 */
export const CULTURE_RECRUIT_BONUS_PER_LEVEL = 2;

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

/**
 * 文化对登用成功率的百分点修正：Lv0=+0 … Lv5=+10。
 * 不消费 RNG；最终仍由 negotiation clamp [5,90]。
 */
export function cultureRecruitModifier(cultureValue: number): number {
  return cultureThresholdProgress(cultureValue).reachedLevels * CULTURE_RECRUIT_BONUS_PER_LEVEL;
}

/**
 * 登用读文化值：目标所在己方城优先，否则取己方城最高文化（声教吸引力）。
 */
export function playerCultureForRecruit(
  cities: Readonly<Record<number, { ruler: number | null; stats: { culture?: number } }>>,
  playerFactionId: number,
  targetLocation: number | null | undefined,
): number {
  if (targetLocation != null) {
    const city = cities[targetLocation];
    if (city?.ruler === playerFactionId) {
      return city.stats.culture ?? 0;
    }
  }
  let max = 0;
  for (const city of Object.values(cities)) {
    if (city.ruler === playerFactionId) {
      max = Math.max(max, city.stats.culture ?? 0);
    }
  }
  return max;
}
