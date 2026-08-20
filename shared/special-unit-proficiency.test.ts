// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { UnitType } from './enums/index.js';
import {
  SPECIAL_ABILITY_FULL_USES,
  getUnitAbilityUses,
  proficiencyPowerRatio,
  recordUnitAbilityUse,
  resolveProficiencyPower,
} from './special-unit-proficiency.js';
import type { Officer } from './types/officer.js';

function stubOfficer(): Officer {
  return {
    id: 1,
    name: '测',
    birthYear: 150,
    deathYear: 200,
    stats: { leadership: 70, war: 70, intelligence: 70, politics: 70, charisma: 70 },
    hidden: {
      compatibility: 50, righteousness: 5, ambition: 5, valor: 5, composure: 5,
      lifespan: 200, growth: 'mid' as never, personality: 'calm' as never, ideal: 'hegemony' as never,
      bloodline: [], ceilingBonus: null, power: 50, burst: 50, agility: 50, luck: 50,
      intuition: 50, awe: 50, strategy: 50, tactics: 50,
    },
    unitProficiency: {},
    formationMastery: [],
    skills: [],
    tags: [],
    faction: 1,
    location: 1,
    loyalty: 90,
    experience: 0,
    status: 'active' as never,
    civilPosition: 'none' as never,
    localPosition: 'none' as never,
    militaryPosition: 'none' as never,
    nobilityRank: 'none' as never,
    merit: 0,
    stamina: 100,
    wifeId: null,
    beauties: [],
  };
}

describe('special-unit-proficiency', () => {
  it('0 次为 base，满次为 max', () => {
    expect(resolveProficiencyPower(1.2, 1.8, 0)).toBeCloseTo(1.2);
    expect(resolveProficiencyPower(1.2, 1.8, SPECIAL_ABILITY_FULL_USES)).toBeCloseTo(1.8);
    expect(proficiencyPowerRatio(25)).toBeCloseTo(0.5);
  });

  it('recordUnitAbilityUse 累加并就地写回', () => {
    const o = stubOfficer();
    expect(getUnitAbilityUses(o, UnitType.LIGHT_CAVALRY)).toBe(0);
    expect(recordUnitAbilityUse(o, UnitType.LIGHT_CAVALRY)).toBe(1);
    expect(recordUnitAbilityUse(o, UnitType.LIGHT_CAVALRY)).toBe(2);
    expect(getUnitAbilityUses(o, UnitType.LIGHT_CAVALRY)).toBe(2);
    expect(o.unitUsageRecords?.[0]?.unitType).toBe(UnitType.LIGHT_CAVALRY);
  });
});
