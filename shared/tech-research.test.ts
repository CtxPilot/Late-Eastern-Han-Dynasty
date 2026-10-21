// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  TECH_BRANCHES,
  TECH_BRANCH_CONFIGS,
  TECH_CULTURE_THRESHOLDS,
  TECH_GOLD_COSTS,
  TECH_MONTHS,
  getTechBranchConfig,
  getTechTierInfo,
  getTechInitialGoldCost,
  safeTechLevels,
} from './tech-research.js';

describe('tech research metadata & config', () => {
  it('covers all five tech branches from docs/04 §34.6', () => {
    expect(TECH_BRANCHES).toEqual([
      'farming',
      'commerce',
      'military',
      'fortification',
      'cultivation',
    ]);
  });

  it('aligns culture thresholds, gold costs and months across 5 levels', () => {
    expect(TECH_CULTURE_THRESHOLDS).toEqual([100, 250, 500, 700, 900]);
    expect(TECH_GOLD_COSTS).toEqual([200, 400, 800, 1600, 3200]);
    expect(TECH_MONTHS).toEqual([2, 4, 6, 8, 12]);
  });

  it('provides complete 5 tiers for each branch', () => {
    for (const branch of TECH_BRANCHES) {
      const conf = getTechBranchConfig(branch);
      expect(conf).toBeDefined();
      expect(conf.tiers.length).toBe(5);
      for (let lvl = 1; lvl <= 5; lvl++) {
        const tier = getTechTierInfo(branch, lvl);
        expect(tier).toBeDefined();
        expect(tier?.level).toBe(lvl);
        expect(tier?.cultureThreshold).toBe(TECH_CULTURE_THRESHOLDS[lvl - 1]);
        expect(tier?.goldCost).toBe(TECH_GOLD_COSTS[lvl - 1]);
        expect(tier?.months).toBe(TECH_MONTHS[lvl - 1]);
      }
    }
  });

  it('calculates initial 1/3 gold cost accurately', () => {
    expect(getTechInitialGoldCost('farming', 1)).toBe(67);
    expect(getTechInitialGoldCost('farming', 2)).toBe(134);
    expect(getTechInitialGoldCost('farming', 3)).toBe(267);
    expect(getTechInitialGoldCost('farming', 4)).toBe(534);
    expect(getTechInitialGoldCost('farming', 5)).toBe(1067);
  });

  it('safeTechLevels provides complete default fallbacks for missing levels', () => {
    const s = safeTechLevels(null);
    expect(s).toEqual({
      farming: 0,
      commerce: 0,
      military: 0,
      fortification: 0,
      cultivation: 0,
    });
  });
});
