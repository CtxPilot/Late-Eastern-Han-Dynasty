// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  CityPolicy,
  CivilPosition,
  FamilyTier,
  GrowthPotential,
  Ideal,
  LocalPosition,
  MaritalStatus,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Personality,
  TerrainType,
  UnitProficiency,
  UnitType,
} from './enums/index.js';
import {
  CityRuntimeSchema,
  FemaleRuntimeSchema,
  GameStateEntitiesSchema,
} from './game-state-entity-schema.js';

function validOfficer() {
  return {
    id: 1,
    name: '曹操',
    birthYear: 155,
    deathYear: 220,
    stats: { leadership: 100, war: 72, intelligence: 91, politics: 94, charisma: 90 },
    hidden: {
      compatibility: 25,
      righteousness: 5,
      ambition: 14,
      valor: 5,
      composure: 6,
      lifespan: 220,
      growth: GrowthPotential.MID,
      personality: Personality.BOLD,
      ideal: Ideal.HEGEMONY,
      bloodline: [],
      ceilingBonus: null,
      power: 65,
      burst: 50,
      agility: 55,
      luck: 95,
      intuition: 70,
      awe: 90,
      strategy: 85,
      tactics: 80,
    },
    unitProficiency: { [UnitType.LIGHT_INFANTRY]: UnitProficiency.A },
    formationMastery: [0],
    skills: [{ skillId: 'inspire', level: 3, useCount: 0 }],
    tags: ['豪族'],
    faction: 1,
    location: 1,
    loyalty: 100,
    experience: 0,
    status: OfficerStatus.ACTIVE,
    civilPosition: CivilPosition.NONE,
    localPosition: LocalPosition.NONE,
    militaryPosition: MilitaryPosition.GENERAL,
    nobilityRank: NobilityRank.NONE,
    merit: 0,
    stamina: 100,
    wifeId: null,
    beauties: [],
  };
}

function validCity() {
  return {
    id: 1,
    name: '洛阳',
    province: '司隶',
    x: 100,
    y: 100,
    maxPopulation: 1000,
    isCapital: true,
    isPass: false,
    specialProduct: null,
    recruitableUnits: [UnitType.LIGHT_INFANTRY],
    initialStats: { farm: 10, commerce: 10, wall: 10 },
    terrain: TerrainType.PLAIN,
    stats: { farm: 10, commerce: 10, wall: 10, morale: 70 },
    gold: 100,
    food: 100,
    population: 100,
    demographics: { adultMale: 30, adultFemale: 30, child: 20, elder: 20 },
    beautySeekLeft: 0,
    troops: 100,
    troopsMorale: 70,
    officers: [1],
    ruler: 1,
    facilities: [],
    policy: CityPolicy.FARMING,
    developmentProgress: { farm: 0, commerce: 0, wall: 0 },
  };
}

function validFaction() {
  return {
    id: 1,
    name: '曹操',
    color: '#334455',
    rulerId: 1,
    capitalCityId: 1,
    scenarioMode: 'territorial' as const,
    gold: 100,
    food: 100,
    beautyStock: 0,
    cityIds: [1],
    officerIds: [1],
    isPlayer: true,
    isAlive: true,
  };
}

function validFemale() {
  return {
    id: 201,
    name: '卞氏',
    birthYear: 160,
    deathYear: 230,
    family: FamilyTier.GREAT_CLAN,
    clanName: '卞',
    factionId: 1,
    locationId: 1,
    initialStatus: MaritalStatus.MARRIED,
    initialHusbandId: 1,
    influence: {
      household: 60,
      counsel: 50,
      martial: 10,
      prestige: 70,
      fortitude: 60,
      scholarship: 50,
    },
    statBonus: { politics: 2 },
    teachableSkills: [],
    enhanceableSkills: [],
    talents: [],
    relatedEvents: [],
    canCommand: false,
    description: '测试夹具',
    status: MaritalStatus.MARRIED,
    husbandId: 1,
    giftedToOfficerId: null,
  };
}

function validEntities() {
  return {
    officers: { 1: validOfficer() },
    cities: { 1: validCity() },
    factions: { 1: validFaction() },
    females: { 201: validFemale() },
  };
}

describe('GameStateEntitiesSchema', () => {
  it('parses a valid runtime entity slice', () => {
    expect(GameStateEntitiesSchema.parse(validEntities())).toEqual(validEntities());
  });

  it('rejects record keys that do not match entity ids', () => {
    expect(() =>
      GameStateEntitiesSchema.parse({
        ...validEntities(),
        officers: { 2: validOfficer() },
      }),
    ).toThrow(/记录键 2 与实体 id 1 不一致/);
  });

  it('rejects population totals that disagree with demographic buckets', () => {
    expect(() => CityRuntimeSchema.parse({ ...validCity(), population: 101 })).toThrow(
      /人口四桶合计/,
    );
  });

  it('rejects mutually exclusive marriage and gifted states', () => {
    expect(() =>
      FemaleRuntimeSchema.parse({ ...validFemale(), giftedToOfficerId: 2 }),
    ).toThrow(/已婚女性不能同时处于赏赐状态/);
  });
});
