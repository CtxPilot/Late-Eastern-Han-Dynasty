// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  TRANSPORT_FOOD_LOSS_REDUCTION_PER_LEVEL,
  armyTransportForMarch,
  transportFoodLossReductionPct,
  transportMarchFoodMul,
  transportRouteThresholdProgress,
} from './transport.js';

describe('transport route threshold', () => {
  it('mirrors culture thresholds for 0-A route preview', () => {
    expect(transportRouteThresholdProgress(0)).toMatchObject({
      reachedLevels: 0,
      nextThreshold: 100,
    });
    expect(transportRouteThresholdProgress(500).reachedLevels).toBe(3);
    expect(transportRouteThresholdProgress(900).reachedLevels).toBe(5);
  });
});

describe('transport march food loss (Session 402)', () => {
  it('grants 2 percentage points reduction per reached threshold', () => {
    expect(TRANSPORT_FOOD_LOSS_REDUCTION_PER_LEVEL).toBe(2);
    expect(transportFoodLossReductionPct(0)).toBe(0);
    expect(transportFoodLossReductionPct(100)).toBe(2);
    expect(transportFoodLossReductionPct(500)).toBe(6);
    expect(transportFoodLossReductionPct(900)).toBe(10);
    expect(transportMarchFoodMul(500)).toBeCloseTo(0.94);
    expect(transportMarchFoodMul(900)).toBeCloseTo(0.9);
  });

  it('prefers departure city transport when faction-owned, else max realm', () => {
    const cities = {
      1: { ruler: 1, stats: { transport: 100 } },
      2: { ruler: 1, stats: { transport: 500 } },
      3: { ruler: 2, stats: { transport: 900 } },
    };
    expect(armyTransportForMarch(cities, 1, 1)).toBe(100);
    expect(armyTransportForMarch(cities, 1, 3)).toBe(500);
    expect(armyTransportForMarch(cities, 1, null)).toBe(500);
  });
});
