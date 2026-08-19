// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  FAMILY_CAPTURE_MORALE_HIT,
  FAMILY_PER_TROOP,
  FAMILY_RELOCATE_GOLD,
  citiesShockedByFamilyCapture,
  familiesGainedOnConscript,
  familyLocationCityId,
} from './hostage-families.js';
import type { City } from './types/city.js';
import type { GameState } from './types/game.js';

function city(partial: Partial<City> & { id: number }): City {
  return {
    name: `城${partial.id}`,
    demographics: { adultMale: 1000, adultFemale: 800, child: 400, elder: 200 },
    troops: 0,
    garrisonFamilies: 0,
    ...partial,
  } as City;
}

describe('hostage families', () => {
  it('binds two dependents per troop, capped by civilian pool', () => {
    const c = city({ id: 1, demographics: { adultMale: 100, adultFemale: 10, child: 5, elder: 5 } });
    expect(familiesGainedOnConscript(20, c)).toBe(20);
    expect(FAMILY_PER_TROOP).toBe(2);
    expect(FAMILY_RELOCATE_GOLD).toBe(500);
    expect(FAMILY_CAPTURE_MORALE_HIT).toBe(40);
  });

  it('family location follows backup city', () => {
    expect(familyLocationCityId(city({ id: 2 }))).toBe(2);
    expect(familyLocationCityId(city({ id: 2, familyBackupCityId: 1 }))).toBe(1);
  });

  it('capital hostage shocks all remaining cities', () => {
    const state = {
      factions: { 1: { id: 1, capitalCityId: 1 } },
      cities: {
        1: city({ id: 1, ruler: 2 }),
        2: city({ id: 2, ruler: 1, garrisonFamilies: 0, familyBackupCityId: 1 }),
        3: city({ id: 3, ruler: 1, garrisonFamilies: 50, familyBackupCityId: 1 }),
      },
    } as unknown as GameState;
    expect(citiesShockedByFamilyCapture(state, 1, 1).sort()).toEqual([2, 3]);
  });

  it('non-capital capture only shocks cities whose families live there', () => {
    const state = {
      factions: { 1: { id: 1, capitalCityId: 1 } },
      cities: {
        1: city({ id: 1, ruler: 1, garrisonFamilies: 10 }),
        4: city({ id: 4, ruler: 2 }),
        5: city({ id: 5, ruler: 1, garrisonFamilies: 80, familyBackupCityId: 4 }),
        6: city({ id: 6, ruler: 1, garrisonFamilies: 80 }),
      },
    } as unknown as GameState;
    expect(citiesShockedByFamilyCapture(state, 4, 1)).toEqual([5]);
  });
});
