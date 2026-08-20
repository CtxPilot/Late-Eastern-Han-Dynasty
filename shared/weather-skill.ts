// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { Weather } from './enums/index.js';

/**
 * 05 §3.2 天气主动技能（0-A）：
 * 诸葛亮 / 司马懿 专属；不扩 skills.json 30 通用技能表。
 * 诸葛亮沿用「神算」叙事代理：气力消耗减半。
 */
export const WEATHER_ACTIVE_CASTER_IDS: ReadonlySet<number> = new Set([
  4, // 诸葛亮
  12, // 司马懿
]);

/** 基础气力消耗；诸葛亮（神算代理）为半额。 */
export const WEATHER_ACTIVE_BASE_COST = 40;

/** 主动切换后重置倒计时（取 3~8 中位，确定性，不消费 RNG）。 */
export const WEATHER_ACTIVE_TIMER_RESET = 5;

export const ALL_BATTLE_WEATHERS: readonly Weather[] = [
  Weather.CLEAR,
  Weather.CLOUDY,
  Weather.RAIN,
  Weather.STORM,
  Weather.FOG,
  Weather.SNOW,
] as const;

export function canUseWeatherActive(officerId: number): boolean {
  return WEATHER_ACTIVE_CASTER_IDS.has(officerId);
}

export function weatherActiveEnergyCost(officerId: number): number {
  if (officerId === 4) return Math.floor(WEATHER_ACTIVE_BASE_COST / 2);
  return WEATHER_ACTIVE_BASE_COST;
}

export function isValidBattleWeather(value: string): value is Weather {
  return (ALL_BATTLE_WEATHERS as readonly string[]).includes(value);
}
