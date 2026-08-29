// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 交通运行时：路网门槛（与文化技艺门槛同构）+ 运输损耗消费（Session 402）。
 *
 * 0-A 消费「运输损耗」一侧——已达门槛级数 → 行军每跳粮耗乘区下调；
 * 行军速度（多跳/疲劳）仍后置。
 */
import {
  CULTURE_RUNTIME_MAX,
  CULTURE_TECH_LEVEL_THRESHOLDS,
  cultureThresholdProgress,
  type CultureThresholdProgress,
} from './culture.js';

/** 交通路网门槛与文化技艺门槛同构（真源 docs/08）。 */
export const TRANSPORT_ROUTE_THRESHOLDS = CULTURE_TECH_LEVEL_THRESHOLDS;
export const TRANSPORT_RUNTIME_MAX = CULTURE_RUNTIME_MAX;

/** 每达 1 级交通门槛，行军粮耗减免 N 百分点（真源 docs/08）。 */
export const TRANSPORT_FOOD_LOSS_REDUCTION_PER_LEVEL = 2;

export function transportRouteThresholdProgress(value: number): CultureThresholdProgress {
  return cultureThresholdProgress(value);
}

/**
 * 交通对行军粮耗的百分点减免：Lv0=+0 … Lv5=+10。
 * 不消费 RNG。
 */
export function transportFoodLossReductionPct(transportValue: number): number {
  return (
    transportRouteThresholdProgress(transportValue).reachedLevels *
    TRANSPORT_FOOD_LOSS_REDUCTION_PER_LEVEL
  );
}

/** 行军粮耗乘区：1 − 减免百分点/100（Lv5 → 0.9）。 */
export function transportMarchFoodMul(transportValue: number): number {
  return 1 - transportFoodLossReductionPct(transportValue) / 100;
}

/**
 * 行军读交通值：出发城属本势力则用该城，否则取本势力城最高交通（路网后勤）。
 */
export function armyTransportForMarch(
  cities: Readonly<Record<number, { ruler: number | null; stats: { transport?: number } }>>,
  factionId: number,
  fromNodeId: number | null | undefined,
): number {
  if (fromNodeId != null) {
    const city = cities[fromNodeId];
    if (city?.ruler === factionId) {
      return city.stats.transport ?? 0;
    }
  }
  let max = 0;
  for (const city of Object.values(cities)) {
    if (city.ruler === factionId) {
      max = Math.max(max, city.stats.transport ?? 0);
    }
  }
  return max;
}
