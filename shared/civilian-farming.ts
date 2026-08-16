// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 民屯田纯函数（docs/04 §2.8）
 * 与农业开发（stats.farm）平行：分配人口户数 → 月结直接产粮。
 */
import { Season } from './enums/index.js';
import type { City } from './types/city.js';

/** 保留劳力（驻军占用）；简化为驻军人数，避免过度抽空耕作人口 */
export function reservedLaborForFarming(city: Pick<City, 'troops'>): number {
  return Math.max(0, city.troops);
}

/** 可分配民屯上限：floor((总人口 − 保留劳力) × 0.3) */
export function maxCivilianFarmingHouseholds(
  city: Pick<City, 'population' | 'troops'>,
): number {
  const pool = Math.max(0, city.population - reservedLaborForFarming(city));
  return Math.floor(pool * 0.3);
}

/** 地域系数（docs/04 §2.8） */
export function civilianFarmingRegionFactor(province: string): number {
  if (/司|兖|豫|青|徐/.test(province)) return 1.2;
  if (/冀|幽|并/.test(province)) return 1.0;
  if (/雍|凉/.test(province)) return 0.8;
  if (/荆/.test(province)) return 1.1;
  if (/扬/.test(province)) return 1.0;
  if (/益/.test(province)) return 0.9;
  if (/交/.test(province)) return 1.0;
  if (/南中|南/.test(province)) return 0.6;
  return 1.0;
}

/** 季节倍率：春×1.0 / 夏×1.2 / 秋×1.5 / 冬×0.6 */
export function civilianFarmingSeasonMul(season: Season): number {
  switch (season) {
    case Season.SPRING:
      return 1.0;
    case Season.SUMMER:
      return 1.2;
    case Season.AUTUMN:
      return 1.5;
    case Season.WINTER:
      return 0.6;
    default:
      return 1.0;
  }
}

/**
 * 月产粮：floor(户数 × 0.8 × seasonMul × regionFactor)
 */
export function civilianFarmingFoodProduced(
  households: number,
  season: Season,
  province: string,
): number {
  if (households <= 0) return 0;
  return Math.floor(
    households *
      0.8 *
      civilianFarmingSeasonMul(season) *
      civilianFarmingRegionFactor(province),
  );
}

/** 年月戳 → 季度键（1/4/7/10 起算） */
export function quarterKey(year: number, month: number): number {
  const q = Math.floor((month - 1) / 3);
  return year * 4 + q;
}
