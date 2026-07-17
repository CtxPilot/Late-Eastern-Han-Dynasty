// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 子女引擎冒烟（不依赖完整 156 回合）
 */
import {
  CivilPosition,
  GrowthPotential,
  Ideal,
  LocalPosition,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Personality,
  Season,
  TerrainType,
  emptyIntel,
  type ChildBirthDef,
  type City,
  type FemaleCharacter,
  type GameState,
  type Officer,
} from '@leh/shared';
import { tickChildrenAppear } from '../engine/child.js';

function stubOfficer(id: number, name: string, faction: number | null, wifeId?: number): Officer {
  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: {
      leadership: 80,
      war: 70,
      intelligence: 70,
      politics: 70,
      charisma: 70,
    },
    hidden: {
      compatibility: 50,
      righteousness: 8,
      ambition: 10,
      valor: 5,
      composure: 5,
      lifespan: 220,
      growth: GrowthPotential.MID,
      personality: Personality.BOLD,
      ideal: Ideal.HEGEMONY,
      bloodline: [],
      ceilingBonus: null,
      power: 50,
      burst: 50,
      agility: 50,
      luck: 50,
      intuition: 50,
      awe: 50,
      strategy: 50,
      tactics: 50,
    },
    unitProficiency: {},
    formationMastery: [0],
    skills: [],
    tags: [],
    faction,
    location: faction != null ? 1 : null,
    loyalty: 90,
    experience: 0,
    status: faction != null ? OfficerStatus.ACTIVE : OfficerStatus.FREE,
    civilPosition: CivilPosition.NONE,
    localPosition: LocalPosition.NONE,
    militaryPosition: MilitaryPosition.NONE,
    nobilityRank: NobilityRank.NONE,
    merit: 0,
    stamina: 100,
    wifeId: wifeId ?? null,
    beauties: [],
  };
}

function stubFemale(
  id: number,
  name: string,
  husbandId: number | undefined,
  factionId: number | null,
): FemaleCharacter {
  return {
    id,
    name,
    birthYear: 160,
    deathYear: 220,
    family: 'greatClan' as FemaleCharacter['family'],
    clanName: '测',
    factionId,
    locationId: 1,
    initialStatus: 'married' as FemaleCharacter['initialStatus'],
    status: 'married' as FemaleCharacter['status'],
    husbandId,
    giftedToOfficerId: null,
    influence: {
      household: 50,
      counsel: 50,
      martial: 10,
      prestige: 50,
      fortitude: 50,
      scholarship: 70,
    },
    statBonus: {},
    teachableSkills: [],
    enhanceableSkills: [],
    talents: [],
    relatedEvents: [],
    canCommand: false,
    description: 'test',
  };
}

function stubCity(): City {
  return {
    id: 1,
    name: '测试城',
    province: '司隶',
    x: 0,
    y: 0,
    maxPopulation: 100000,
    isCapital: true,
    isPass: false,
    specialProduct: null,
    recruitableUnits: [],
    initialStats: { farm: 50, commerce: 50, wall: 50 },
    facilities: [],
    policy: null,
    developmentProgress: { farm: 0, commerce: 0, wall: 0 },
    terrain: TerrainType.PLAIN,
    stats: { farm: 50, commerce: 50, wall: 50, morale: 70 },
    gold: 1000,
    food: 1000,
    population: 10000,
    demographics: { adultMale: 3000, adultFemale: 3000, child: 2000, elder: 2000 },
    beautySeekLeft: 3,
    troops: 1000,
    troopsMorale: 70,
    officers: [1],
    ruler: 1,
  };
}

const def: ChildBirthDef = {
  childId: 953,
  childName: '曹丕',
  fatherId: 1,
  motherId: 207,
  birthYear: 187,
  appearYear: 203,
  source: 'history',
  baseStats: {
    leadership: 78,
    war: 55,
    intelligence: 82,
    politics: 85,
    charisma: 75,
  },
  motherBonus: {
    fromScholarship: { intelligence: 3 },
    fromBloodline: {},
    extraSkills: ['eloquence'],
    extraTalents: [],
  },
};

function baseState(married: boolean): GameState {
  return {
    scenarioId: 1,
    currentYear: 203,
    currentMonth: 1,
    season: Season.SPRING,
    playerFactionId: 1,
    officers: {
      1: stubOfficer(1, '曹操', 1, married ? 207 : undefined),
    },
    cities: { 1: stubCity() },
    factions: {
      1: {
        id: 1,
        name: '曹操军',
        color: '#f00',
        rulerId: 1,
        capitalCityId: 1,
        gold: 1000,
        food: 1000,
        beautyStock: 0,
        cityIds: [1],
        officerIds: [1],
        isPlayer: true,
        isAlive: true,
      },
    },
    females: {
      207: stubFemale(207, '甄宓', married ? 1 : undefined, 1),
    },
    armys: [],
    campaignArmies: [],
    campaignNodes: [],
    grandStrategists: [],
    activeBattles: [],
    diplomacy: [],
    intel: emptyIntel(),
    plots: [],
    completedEvents: [],
    pendingEvents: [],
    actionLog: [],
  };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

{
  const s = { ...baseState(true), currentMonth: 2 };
  const next = tickChildrenAppear(s, [def]);
  assert(!next.officers[953], '非正月不应登场');
}

{
  const next = tickChildrenAppear(baseState(true), [def]);
  const o = next.officers[953];
  assert(o, '应登场');
  assert(o.stats.intelligence === 85, `母教智=85 得 ${o.stats.intelligence}`);
  assert(o.faction === 1, '应随父势力');
  assert(o.skills.some((sk) => sk.skillId === 'eloquence'), '母教技能');
  assert(next.factions[1].officerIds.includes(953), 'faction.officerIds');
  assert(next.cities[1].officers.includes(953), 'city.officers');
  assert(next.officers[1].hidden.bloodline.includes(953), '父 bloodline 回写');
}

{
  const next = tickChildrenAppear(baseState(false), [def]);
  const o = next.officers[953];
  assert(o, '未婚仍登场');
  assert(o.stats.intelligence === 82, `无母教智=82 得 ${o.stats.intelligence}`);
  assert(o.faction == null, '未婚应在野');
  assert(o.status === OfficerStatus.FREE, 'status free');
  assert(o.skills.length === 0, '无母教技能');
}

{
  const once = tickChildrenAppear(baseState(true), [def]);
  const twice = tickChildrenAppear(once, [def]);
  assert(Object.keys(twice.officers).length === Object.keys(once.officers).length, '幂等');
}

console.log('OK verify-child-engine: 4 cases passed');
