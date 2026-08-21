// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { cultureThresholdProgress } from './culture.js';

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
