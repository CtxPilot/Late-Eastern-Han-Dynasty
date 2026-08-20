// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { Weather } from './enums/index.js';
import {
  ALL_BATTLE_WEATHERS,
  canUseWeatherActive,
  isValidBattleWeather,
  weatherActiveEnergyCost,
  WEATHER_ACTIVE_TIMER_RESET,
} from './weather-skill.js';

describe('weather-skill', () => {
  it('白名单：诸葛亮/司马懿可观天', () => {
    expect(canUseWeatherActive(4)).toBe(true);
    expect(canUseWeatherActive(12)).toBe(true);
    expect(canUseWeatherActive(1)).toBe(false);
  });

  it('气力：诸葛亮半额，司马懿全额', () => {
    expect(weatherActiveEnergyCost(4)).toBe(20);
    expect(weatherActiveEnergyCost(12)).toBe(40);
  });

  it('倒计时重置与天气校验', () => {
    expect(WEATHER_ACTIVE_TIMER_RESET).toBe(5);
    expect(ALL_BATTLE_WEATHERS).toContain(Weather.RAIN);
    expect(isValidBattleWeather('rain')).toBe(true);
    expect(isValidBattleWeather('wind')).toBe(false);
  });
});
