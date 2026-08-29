// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  CRAFT_CONSCRIPT_MORALE_PER_LEVEL,
  craftConscriptMoraleBonus,
  craftQualityThresholdProgress,
} from './craft.js';

describe('craft quality threshold', () => {
  it('mirrors culture thresholds for 0-A quality preview', () => {
    expect(craftQualityThresholdProgress(0)).toMatchObject({
      reachedLevels: 0,
      nextThreshold: 100,
      remaining: 100,
    });
    expect(craftQualityThresholdProgress(500)).toMatchObject({
      reachedLevels: 3,
      nextThreshold: 700,
      remaining: 200,
    });
    expect(craftQualityThresholdProgress(900).reachedLevels).toBe(5);
  });
});

describe('craft conscript morale bonus (Session 401)', () => {
  it('grants +2 troopsMorale per reached quality threshold', () => {
    expect(CRAFT_CONSCRIPT_MORALE_PER_LEVEL).toBe(2);
    expect(craftConscriptMoraleBonus(0)).toBe(0);
    expect(craftConscriptMoraleBonus(99)).toBe(0);
    expect(craftConscriptMoraleBonus(100)).toBe(2);
    expect(craftConscriptMoraleBonus(500)).toBe(6);
    expect(craftConscriptMoraleBonus(900)).toBe(10);
    expect(craftConscriptMoraleBonus(999)).toBe(10);
  });
});
