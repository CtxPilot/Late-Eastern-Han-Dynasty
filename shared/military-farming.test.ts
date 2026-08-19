// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { Season } from './enums/index.js';
import {
  militaryFarmingFoodProduced,
  militaryFarmingSeasonMul,
  quarterKey,
} from './military-farming.js';

describe('military farming', () => {
  it('applies season multipliers 春0.8/夏1.0/秋1.5/冬0.3', () => {
    expect(militaryFarmingSeasonMul(Season.SPRING)).toBe(0.8);
    expect(militaryFarmingSeasonMul(Season.SUMMER)).toBe(1.0);
    expect(militaryFarmingSeasonMul(Season.AUTUMN)).toBe(1.5);
    expect(militaryFarmingSeasonMul(Season.WINTER)).toBe(0.3);
  });

  it('produces floor(troops × farm/100 × seasonMul × 0.5)', () => {
    expect(militaryFarmingFoodProduced(5000, 280, Season.SPRING)).toBe(
      Math.floor(5000 * 2.8 * 0.8 * 0.5),
    );
    expect(militaryFarmingFoodProduced(5000, 280, Season.AUTUMN)).toBe(
      Math.floor(5000 * 2.8 * 1.5 * 0.5),
    );
    expect(militaryFarmingFoodProduced(0, 280, Season.SUMMER)).toBe(0);
    expect(militaryFarmingFoodProduced(5000, 0, Season.SUMMER)).toBe(0);
  });

  it('reuses civilian quarterKey semantics', () => {
    expect(quarterKey(190, 1)).toBe(quarterKey(190, 3));
    expect(quarterKey(190, 4)).toBe(quarterKey(190, 6));
    expect(quarterKey(190, 4)).not.toBe(quarterKey(190, 7));
  });
});