// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  cultureThresholdProgress,
  cultureRecruitModifier,
  playerCultureForRecruit,
  CULTURE_RECRUIT_BONUS_PER_LEVEL,
} from './culture.js';

describe('culture threshold preview', () => {
  it('shows the first threshold and remaining culture below Lv1', () => {
    expect(cultureThresholdProgress(0)).toEqual({
      current: 0,
      reachedLevels: 0,
      maxLevel: 5,
      nextLevel: 1,
      nextThreshold: 100,
      remaining: 100,
    });
  });

  it('counts reached thresholds without treating an uncompleted level as reached', () => {
    expect(cultureThresholdProgress(500)).toEqual({
      current: 500,
      reachedLevels: 3,
      maxLevel: 5,
      nextLevel: 4,
      nextThreshold: 700,
      remaining: 200,
    });
  });

  it('clamps malformed or over-cap values and closes the preview at Lv5', () => {
    expect(cultureThresholdProgress(1200)).toMatchObject({
      current: 999,
      reachedLevels: 5,
      nextLevel: null,
      nextThreshold: null,
      remaining: 0,
    });
    expect(cultureThresholdProgress(Number.NaN).current).toBe(0);
  });
});

describe('culture recruit modifier (Session 400)', () => {
  it('grants +2 percentage points per reached tech threshold', () => {
    expect(CULTURE_RECRUIT_BONUS_PER_LEVEL).toBe(2);
    expect(cultureRecruitModifier(0)).toBe(0);
    expect(cultureRecruitModifier(99)).toBe(0);
    expect(cultureRecruitModifier(100)).toBe(2);
    expect(cultureRecruitModifier(500)).toBe(6);
    expect(cultureRecruitModifier(900)).toBe(10);
    expect(cultureRecruitModifier(999)).toBe(10);
  });

  it('prefers the target city culture when player-owned, else max realm culture', () => {
    const cities = {
      1: { ruler: 1, stats: { culture: 100 } },
      2: { ruler: 1, stats: { culture: 500 } },
      3: { ruler: 2, stats: { culture: 900 } },
    };
    expect(playerCultureForRecruit(cities, 1, 1)).toBe(100);
    expect(playerCultureForRecruit(cities, 1, 3)).toBe(500);
    expect(playerCultureForRecruit(cities, 1, null)).toBe(500);
  });
});
