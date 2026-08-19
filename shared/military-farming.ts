// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 军屯田纯函数（docs/05 §5.8.1）
 * 驻军非战时开垦自给：月结直接产粮，每季士气−3，训练收益减半。
 */
import { Season } from './enums/index.js';
import { quarterKey } from './civilian-farming.js';

/** 军屯季节倍率：春×0.8 / 夏×1.0 / 秋×1.5 / 冬×0.3 */
export function militaryFarmingSeasonMul(season: Season): number {
  switch (season) {
    case Season.SPRING:
      return 0.8;
    case Season.SUMMER:
      return 1.0;
    case Season.AUTUMN:
      return 1.5;
    case Season.WINTER:
      return 0.3;
    default:
      return 1.0;
  }
}

/**
 * 月产粮：floor(troops × (farm / 100) × seasonMul × 0.5)
 * farm 为当前农业开发值（city.stats.farm）。
 */
export function militaryFarmingFoodProduced(
  troops: number,
  farm: number,
  season: Season,
): number {
  if (troops <= 0 || farm <= 0) return 0;
  return Math.floor(troops * (farm / 100) * militaryFarmingSeasonMul(season) * 0.5);
}

export { quarterKey };