// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  splitDemographics,
  sumDemographics,
  syncPopulation,
  ensureDemographics,
  beautySeekLeftFromFemales,
  beautyPoolFromFemales,
  civilianFoodNeed,
  troopFoodNeed,
  cityFoodNeed,
  laborForce,
  maxConscriptable,
  foodNeedBreakdown,
  ageDemographicsTick,
  withSyncedPopulation,
  BEAUTY_PER_ADULT_FEMALE,
  BEAUTY_SEEK,
  BEAUTY_LOOT,
  BEAUTY_REWARD,
  DEFAULT_DEMO_RATIO,
  AGE_RATES,
  FOOD_EAT,
  LABOR_WEIGHT,
  TROOP_FOOD_EAT,
} from './demographics';

describe('splitDemographics', () => {
  it('splits total into four buckets summing to total', () => {
    const d = splitDemographics(10000);
    expect(d.adultMale + d.adultFemale + d.child + d.elder).toBe(10000);
  });

  it('returns all zeros for zero total', () => {
    const d = splitDemographics(0);
    expect(d.adultMale).toBe(0);
    expect(d.adultFemale).toBe(0);
    expect(d.child).toBe(0);
    expect(d.elder).toBe(0);
  });

  it('uses default ratio', () => {
    const d = splitDemographics(10000);
    expect(d.adultMale).toBeCloseTo(3000, -1);
    expect(d.adultFemale).toBeCloseTo(2700, -1);
    expect(d.child).toBeCloseTo(2900, -1);
  });

  it('handles negative total gracefully', () => {
    const d = splitDemographics(-100);
    expect(sumDemographics(d)).toBe(0);
  });
});

describe('sumDemographics / syncPopulation', () => {
  it('sums four buckets', () => {
    expect(sumDemographics({ adultMale: 100, adultFemale: 200, child: 50, elder: 30 })).toBe(380);
  });

  it('syncPopulation equals sumDemographics', () => {
    const d = { adultMale: 100, adultFemale: 200, child: 50, elder: 30 };
    expect(syncPopulation(d)).toBe(sumDemographics(d));
  });
});

describe('ensureDemographics', () => {
  it('returns existing demographics if valid', () => {
    const city = {
      population: 1000,
      demographics: { adultMale: 300, adultFemale: 270, child: 290, elder: 140 },
    };
    const d = ensureDemographics(city);
    expect(d.adultMale).toBe(300);
  });

  it('falls back to split if demographics sum is zero', () => {
    const city = {
      population: 10000,
      demographics: { adultMale: 0, adultFemale: 0, child: 0, elder: 0 },
    };
    const d = ensureDemographics(city);
    expect(sumDemographics(d)).toBe(10000);
  });
});

describe('beautySeekLeftFromFemales', () => {
  it('returns 0 for 0 females', () => {
    expect(beautySeekLeftFromFemales(0)).toBe(0);
  });

  it('returns 1 per 400 females', () => {
    expect(beautySeekLeftFromFemales(400)).toBe(1);
    expect(beautySeekLeftFromFemales(800)).toBe(2);
    expect(beautySeekLeftFromFemales(1200)).toBe(3);
  });

  it('floors partial', () => {
    expect(beautySeekLeftFromFemales(500)).toBe(1);
    expect(beautySeekLeftFromFemales(399)).toBe(0);
  });
});

describe('beautyPoolFromFemales (deprecated alias)', () => {
  it('matches beautySeekLeftFromFemales', () => {
    expect(beautyPoolFromFemales(800)).toBe(beautySeekLeftFromFemales(800));
  });
});

describe('civilianFoodNeed', () => {
  it('calculates weighted food need', () => {
    const d = { adultMale: 1000, adultFemale: 1000, child: 1000, elder: 1000 };
    const need = civilianFoodNeed(d, 0); // spring
    // 1000*0.048 + 1000*0.032 + 1000*0.018 + 1000*0.024 = 48+32+18+24 = 122
    expect(need).toBe(122);
  });

  it('applies winter multiplier', () => {
    const d = { adultMale: 1000, adultFemale: 1000, child: 1000, elder: 1000 };
    const spring = civilianFoodNeed(d, 0);
    const winter = civilianFoodNeed(d, 3);
    expect(winter).toBeGreaterThan(spring);
    expect(winter).toBeCloseTo(Math.floor(122 * 1.2), 0);
  });
});

describe('troopFoodNeed', () => {
  it('calculates troop food', () => {
    expect(troopFoodNeed(1000, 0)).toBe(55); // 1000 * 0.055
  });

  it('handles zero troops', () => {
    expect(troopFoodNeed(0)).toBe(0);
  });
});

describe('cityFoodNeed', () => {
  it('sums civilian + troop food', () => {
    const city = {
      population: 4000,
      demographics: { adultMale: 1000, adultFemale: 1000, child: 1000, elder: 1000 },
      troops: 1000,
    };
    const need = cityFoodNeed(city, 0);
    expect(need).toBe(122 + 55); // civilian + troop
  });
});

describe('laborForce', () => {
  it('calculates weighted labor', () => {
    const d = { adultMale: 100, adultFemale: 100, child: 100, elder: 100 };
    // 100*1.0 + 100*0.85 + 100*0.1 + 100*0.35 = 100+85+10+35 = 230
    expect(laborForce(d)).toBe(230);
  });
});

describe('maxConscriptable', () => {
  it('reserves 8% of total population', () => {
    const d = { adultMale: 1000, adultFemale: 1000, child: 1000, elder: 1000 };
    const reserve = Math.ceil(4000 * 0.08); // 320
    expect(maxConscriptable(d)).toBe(1000 - reserve); // 680
  });

  it('returns 0 if not enough adult males', () => {
    const d = { adultMale: 100, adultFemale: 1000, child: 1000, elder: 1000 };
    expect(maxConscriptable(d)).toBe(0);
  });
});

describe('foodNeedBreakdown', () => {
  it('breaks down food by category', () => {
    const d = { adultMale: 1000, adultFemale: 1000, child: 1000, elder: 1000 };
    const bd = foodNeedBreakdown(d, 1000, 0);
    expect(bd.adultMale).toBe(48);
    expect(bd.adultFemale).toBe(32);
    expect(bd.child).toBe(18);
    expect(bd.elder).toBe(24);
    expect(bd.troops).toBe(55);
    expect(bd.total).toBe(48 + 32 + 18 + 24 + 55);
  });
});

describe('ageDemographicsTick', () => {
  it('produces births into child bucket', () => {
    const d = { adultMale: 5000, adultFemale: 5000, child: 3000, elder: 2000 };
    const result = ageDemographicsTick(d, { season: 0, morale: 70, foodRatio: 1 });
    expect(result.births).toBeGreaterThan(0);
    expect(result.next.child).toBeGreaterThan(d.child);
  });

  it('does not exceed maxPopulation', () => {
    const d = { adultMale: 5000, adultFemale: 5000, child: 3000, elder: 2000 };
    const result = ageDemographicsTick(d, { maxPopulation: 15000 });
    const total = sumDemographics(result.next);
    expect(total).toBeLessThanOrEqual(15000);
  });

  it('reduces births under famine', () => {
    const d = { adultMale: 5000, adultFemale: 5000, child: 3000, elder: 2000 };
    const normal = ageDemographicsTick(d, { foodRatio: 1 });
    const famine = ageDemographicsTick(d, { foodRatio: 0.3 });
    expect(famine.births).toBeLessThan(normal.births);
  });

  it('increases elder deaths in winter', () => {
    const d = { adultMale: 5000, adultFemale: 5000, child: 3000, elder: 2000 };
    const spring = ageDemographicsTick(d, { season: 0 });
    const winter = ageDemographicsTick(d, { season: 3 });
    expect(winter.deaths.elder).toBeGreaterThanOrEqual(spring.deaths.elder);
  });

  it('never produces negative buckets', () => {
    const d = { adultMale: 10, adultFemale: 10, child: 5, elder: 5 };
    const result = ageDemographicsTick(d, { foodRatio: 0.2, morale: 10 });
    expect(result.next.adultMale).toBeGreaterThanOrEqual(0);
    expect(result.next.adultFemale).toBeGreaterThanOrEqual(0);
    expect(result.next.child).toBeGreaterThanOrEqual(0);
    expect(result.next.elder).toBeGreaterThanOrEqual(0);
  });

  it('childToAdult uses male-biased ratio', () => {
    const d = { adultMale: 5000, adultFemale: 5000, child: 10000, elder: 2000 };
    const result = ageDemographicsTick(d);
    // male gain should be higher than female gain from child→adult
    const maleGain = result.next.adultMale - d.adultMale + result.deaths.adultMale;
    const femaleGain = result.next.adultFemale - d.adultFemale + result.deaths.adultFemale;
    // rough: male gain from childToAdult should be > female gain
    expect(maleGain).toBeGreaterThan(femaleGain);
  });
});

describe('withSyncedPopulation', () => {
  it('syncs population to sum of demographics', () => {
    const city = {
      demographics: { adultMale: 100, adultFemale: 200, child: 50, elder: 30 },
      population: 999,
    };
    const result = withSyncedPopulation(city, city.demographics);
    expect(result.population).toBe(380);
  });

  it('clamps negative values to 0', () => {
    const city = {
      demographics: { adultMale: -5, adultFemale: 200, child: 50, elder: 30 },
      population: 999,
    };
    const result = withSyncedPopulation(city, city.demographics);
    expect(result.demographics.adultMale).toBe(0);
  });
});

describe('constants', () => {
  it('DEFAULT_DEMO_RATIO sums to 1', () => {
    const sum = DEFAULT_DEMO_RATIO.adultMale + DEFAULT_DEMO_RATIO.adultFemale + DEFAULT_DEMO_RATIO.child + DEFAULT_DEMO_RATIO.elder;
    expect(sum).toBeCloseTo(1, 2);
  });

  it('BEAUTY_PER_ADULT_FEMALE is 1/400', () => {
    expect(BEAUTY_PER_ADULT_FEMALE).toBe(1 / 400);
  });

  it('BEAUTY_SEEK constants are positive', () => {
    expect(BEAUTY_SEEK.goldCost).toBeGreaterThan(0);
    expect(BEAUTY_SEEK.stockGain).toBe(1);
    expect(BEAUTY_SEEK.seekCost).toBe(1);
  });

  it('BEAUTY_LOOT gain range is valid', () => {
    expect(BEAUTY_LOOT.gainMin).toBeGreaterThan(0);
    expect(BEAUTY_LOOT.gainMax).toBeGreaterThanOrEqual(BEAUTY_LOOT.gainMin);
  });

  it('BEAUTY_REWARD loyalty gain is positive', () => {
    expect(BEAUTY_REWARD.loyaltyGain).toBeGreaterThan(0);
  });

  it('FOOD_EAT adultMale is highest', () => {
    expect(FOOD_EAT.adultMale).toBeGreaterThan(FOOD_EAT.adultFemale);
    expect(FOOD_EAT.adultMale).toBeGreaterThan(FOOD_EAT.child);
    expect(FOOD_EAT.adultMale).toBeGreaterThan(FOOD_EAT.elder);
  });

  it('TROOP_FOOD_EAT is higher than civilian', () => {
    expect(TROOP_FOOD_EAT).toBeGreaterThan(FOOD_EAT.adultMale);
  });

  it('LABOR_WEIGHT adultMale is highest', () => {
    expect(LABOR_WEIGHT.adultMale).toBeGreaterThan(LABOR_WEIGHT.adultFemale);
    expect(LABOR_WEIGHT.adultMale).toBeGreaterThan(LABOR_WEIGHT.child);
    expect(LABOR_WEIGHT.adultMale).toBeGreaterThan(LABOR_WEIGHT.elder);
  });

  it('AGE_RATES are in expected ranges', () => {
    expect(AGE_RATES.birthPerCouple).toBeGreaterThan(0);
    expect(AGE_RATES.birthPerCouple).toBeLessThan(0.1);
    expect(AGE_RATES.childToAdult).toBeGreaterThan(0);
    expect(AGE_RATES.childToAdult).toBeLessThan(0.1);
    expect(AGE_RATES.elderDeath).toBeGreaterThan(AGE_RATES.adultDeath);
  });
});
