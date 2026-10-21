// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  sanitationThresholdProgress,
  computeSanitationDemographicModifiers,
  SANITATION_PLAGUE_IMMUNE_THRESHOLD,
  SANITATION_PLAGUE_RISK_THRESHOLD,
  SANITATION_PLAGUE_SEVERE_THRESHOLD,
} from './sanitation.js';

describe('sanitation threshold progress', () => {
  it('correctly reports Lv0 for sanitation below 100', () => {
    const p = sanitationThresholdProgress(50);
    expect(p.reachedLevels).toBe(0);
    expect(p.nextLevel).toBe(1);
    expect(p.nextThreshold).toBe(100);
    expect(p.remaining).toBe(50);
  });

  it('correctly reports Lv3 for sanitation 500', () => {
    const p = sanitationThresholdProgress(500);
    expect(p.reachedLevels).toBe(3);
    expect(p.nextLevel).toBe(4);
    expect(p.nextThreshold).toBe(700);
    expect(p.remaining).toBe(200);
  });

  it('caps at Lv5 for sanitation >= 900', () => {
    const p = sanitationThresholdProgress(950);
    expect(p.reachedLevels).toBe(5);
    expect(p.nextLevel).toBeNull();
    expect(p.nextThreshold).toBeNull();
    expect(p.remaining).toBe(0);
  });
});

describe('sanitation demographic modifiers', () => {
  it('applies penalties when sanitation is under 100 (Lv0)', () => {
    const mods = computeSanitationDemographicModifiers(40);
    expect(mods.childDeathMultiplier).toBe(1.3);
    expect(mods.elderDeathMultiplier).toBe(1.25);
    expect(mods.birthMultiplier).toBe(1.0);
    expect(mods.adultDeathMultiplier).toBe(1.0);
  });

  it('applies scaling bonuses for Lv1 to Lv5', () => {
    const lv1 = computeSanitationDemographicModifiers(100);
    expect(lv1.birthMultiplier).toBeCloseTo(1.02);
    expect(lv1.childDeathMultiplier).toBeCloseTo(0.9);
    expect(lv1.elderDeathMultiplier).toBeCloseTo(0.92);

    const lv5 = computeSanitationDemographicModifiers(900);
    expect(lv5.birthMultiplier).toBeCloseTo(1.10);
    expect(lv5.childDeathMultiplier).toBeCloseTo(0.5);
    expect(lv5.elderDeathMultiplier).toBeCloseTo(0.6);
  });

  it('constants define clear plague thresholds', () => {
    expect(SANITATION_PLAGUE_IMMUNE_THRESHOLD).toBe(150);
    expect(SANITATION_PLAGUE_RISK_THRESHOLD).toBe(100);
    expect(SANITATION_PLAGUE_SEVERE_THRESHOLD).toBe(60);
  });
});
