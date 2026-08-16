// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { Season } from './enums/index.js';
import {
  civilianFarmingFoodProduced,
  civilianFarmingRegionFactor,
  civilianFarmingSeasonMul,
  maxCivilianFarmingHouseholds,
  quarterKey,
} from './civilian-farming.js';

describe('civilian farming', () => {
  it('caps households at 30% of non-reserved population', () => {
    expect(maxCivilianFarmingHouseholds({ population: 10000, troops: 1000 })).toBe(2700);
    expect(maxCivilianFarmingHouseholds({ population: 100, troops: 200 })).toBe(0);
  });

  it('maps province region factors', () => {
    expect(civilianFarmingRegionFactor('司隶')).toBe(1.2);
    expect(civilianFarmingRegionFactor('荆州')).toBe(1.1);
    expect(civilianFarmingRegionFactor('凉州')).toBe(0.8);
  });

  it('applies season and region to food output', () => {
    expect(civilianFarmingSeasonMul(Season.AUTUMN)).toBe(1.5);
    expect(civilianFarmingFoodProduced(1000, Season.AUTUMN, '司隶')).toBe(
      Math.floor(1000 * 0.8 * 1.5 * 1.2),
    );
    expect(civilianFarmingFoodProduced(0, Season.SPRING, '司隶')).toBe(0);
  });

  it('quarterKey groups months 1-3 / 4-6 / 7-9 / 10-12', () => {
    expect(quarterKey(190, 1)).toBe(quarterKey(190, 3));
    expect(quarterKey(190, 1)).not.toBe(quarterKey(190, 4));
    expect(quarterKey(190, 12)).toBe(quarterKey(190, 10));
  });
});
