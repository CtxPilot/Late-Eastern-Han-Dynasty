// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import {
  CityFacility,
  CityPolicy,
  CityTier,
  CeilingAttribute,
  CivilPosition,
  FamilyTier,
  GrowthPotential,
  HegemonyPosition,
  Ideal,
  LocalPosition,
  MaritalStatus,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Personality,
  ResourceType,
  TerrainType,
  UnitProficiency,
  UnitType,
} from './enums/index.js';
import type { City } from './types/city.js';
import type { Faction } from './types/faction.js';
import type { FemaleCharacter } from './types/female.js';
import type { GameState } from './types/game.js';
import type { Officer } from './types/officer.js';
import {
  CityStaticSchema,
  FemaleStaticSchema,
  OfficerStaticSchema,
} from './validators/index.js';
import { CITY_FACTION_KINDS } from './city-factions.js';

const PositiveIdSchema = z.number().int().positive();
const NullablePositiveIdSchema = PositiveIdSchema.nullable();

const OfficerSkillSchema = z
  .object({
    skillId: z.string().min(1),
    level: z.number().int().min(1).max(5),
    useCount: z.number().int().nonnegative(),
  })
  .strict();

export const OfficerRuntimeSchema: z.ZodType<Officer> = z
  .object({
    ...OfficerStaticSchema.shape,
    hidden: z
      .object({
        compatibility: z.number().int().min(0).max(150),
        righteousness: z.number().int().min(0).max(15),
        ambition: z.number().int().min(0).max(15),
        valor: z.number().int().min(0).max(7),
        composure: z.number().int().min(0).max(7),
        lifespan: z.number().int(),
        growth: z.nativeEnum(GrowthPotential),
        personality: z.nativeEnum(Personality),
        ideal: z.nativeEnum(Ideal),
        bloodline: z.array(z.number().int()),
        ceilingBonus: z
          .object({
            attribute: z.nativeEnum(CeilingAttribute),
            hiddenBonus: z.number().int().min(0).max(100),
          })
          .strict()
          .nullable(),
        power: z.number().int().min(1).max(100),
        burst: z.number().int().min(1).max(100),
        agility: z.number().int().min(1).max(100),
        luck: z.number().int().min(1).max(100),
        intuition: z.number().int().min(1).max(100),
        awe: z.number().int().min(1).max(100),
        strategy: z.number().int().min(1).max(100),
        tactics: z.number().int().min(1).max(100),
      })
      .strict(),
    unitProficiency: z.record(z.nativeEnum(UnitType), z.nativeEnum(UnitProficiency)),
    skills: z.array(OfficerSkillSchema),
    faction: NullablePositiveIdSchema,
    location: NullablePositiveIdSchema,
    loyalty: z.number().int().min(0).max(100),
    experience: z.number().int().nonnegative(),
    status: z.nativeEnum(OfficerStatus),
    civilPosition: z.nativeEnum(CivilPosition),
    localPosition: z.nativeEnum(LocalPosition),
    militaryPosition: z.nativeEnum(MilitaryPosition),
    nobilityRank: z.nativeEnum(NobilityRank),
    hegemonyPosition: z.nativeEnum(HegemonyPosition).optional(),
    merit: z.number().int().nonnegative(),
    meritLevel: z.number().int().min(1).max(20).optional(),
    peakMeritLevel: z.number().int().min(1).max(20).optional(),
    meritPath: z.enum(['warrior', 'scholar', 'neutral']).optional(),
    stamina: z.number().int().nonnegative(),
    actionsPerMonth: z.number().int().nonnegative().optional(),
    wifeId: NullablePositiveIdSchema.optional(),
    beauties: z.array(PositiveIdSchema).max(0, '具名女性赠与字段已退役，运行时必须为空'),
    equipment: z
      .object({
        weaponPrimary: PositiveIdSchema.optional(),
        weaponSecondary: PositiveIdSchema.optional(),
        armor: PositiveIdSchema.optional(),
        mount: PositiveIdSchema.optional(),
        tome: PositiveIdSchema.optional(),
      })
      .strict()
      .optional(),
    skillTreeState: z.record(z.string(), z.number().int().nonnegative()).optional(),
    skillPointsSpent: z.number().int().nonnegative().optional(),
    traitLevels: z.record(z.string(), z.number().int().nonnegative()).optional(),
    traitPointsSpent: z.number().int().nonnegative().optional(),
    consortIds: z.array(z.object({ id: z.number().int(), rank: z.enum(['concubine', 'ji']) })).optional(),
  })
  .strict();

const CityDemographicsSchema = z
  .object({
    adultMale: z.number().int().nonnegative(),
    adultFemale: z.number().int().nonnegative(),
    child: z.number().int().nonnegative(),
    elder: z.number().int().nonnegative(),
  })
  .strict();

const CityFactionEntrySchema = z
  .object({
    kind: z.enum(CITY_FACTION_KINDS),
    name: z.string().min(1),
    satisfaction: z.number().int().min(0).max(100),
  })
  .strict();

export const CityRuntimeSchema: z.ZodType<City> = z
  .object({
    ...CityStaticSchema.shape,
    recruitableUnits: z.array(z.nativeEnum(UnitType)),
    resourceOutput: z.record(z.nativeEnum(ResourceType), z.number()).optional(),
    tier: z.nativeEnum(CityTier).optional(),
    facilities: z.array(z.nativeEnum(CityFacility)),
    policy: z.nativeEnum(CityPolicy).nullable(),
    terrain: z.nativeEnum(TerrainType),
    stats: z
      .object({
        farm: z.number().nonnegative(),
        commerce: z.number().nonnegative(),
        wall: z.number().nonnegative(),
        morale: z.number().min(0).max(100),
      })
      .strict(),
    gold: z.number().nonnegative(),
    food: z.number().nonnegative(),
    population: z.number().int().nonnegative(),
    demographics: CityDemographicsSchema,
    courtNetworkOpportunities: z.number().int().nonnegative(),
    troops: z.number().int().nonnegative(),
    troopsMorale: z.number().min(0).max(100),
    officers: z.array(PositiveIdSchema),
    ruler: NullablePositiveIdSchema,
    developmentProgress: z
      .object({
        farm: z.number().nonnegative(),
        commerce: z.number().nonnegative(),
        wall: z.number().nonnegative(),
      })
      .strict(),
    activeDevelopment: z
      .object({
        kind: z.enum(['farm', 'commerce', 'wall']),
        assignedOfficerId: PositiveIdSchema,
        totalMonths: z.number().int().positive(),
        remainingMonths: z.number().int().nonnegative(),
        totalGoldCost: z.number().int().positive(),
        goldPaid: z.number().int().nonnegative(),
        pausedMonths: z.number().int().nonnegative(),
        progressLostMonths: z.number().int().nonnegative(),
        status: z.enum(['active', 'paused']),
      })
      .strict()
      .optional(),
    cityFactions: z.array(CityFactionEntrySchema).optional(),
    factionPatrolStamp: z.number().int().optional(),
    pendingImpeachment: z
      .object({
        officerId: PositiveIdSchema,
        sinceStamp: z.number().int(),
      })
      .strict()
      .optional(),
    civilianFarmingHouseholds: z.number().int().nonnegative().optional(),
    civilianFarmingAssignQuarter: z.number().int().optional(),
    militaryFarming: z.boolean().optional(),
    militaryFarmingAssignQuarter: z.number().int().optional(),
    garrisonFamilies: z.number().int().nonnegative().optional(),
    familyBackupCityId: PositiveIdSchema.optional(),
    familyRelocateQuarter: z.number().int().optional(),
  })
  .strict()
  .superRefine((city, ctx) => {
    const demographicTotal =
      city.demographics.adultMale +
      city.demographics.adultFemale +
      city.demographics.child +
      city.demographics.elder;
    if (city.population !== demographicTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['population'],
        message: `总人口 ${city.population} 与人口四桶合计 ${demographicTotal} 不一致`,
      });
    }
  });

export const FactionRuntimeSchema: z.ZodType<Faction> = z
  .object({
    id: PositiveIdSchema,
    name: z.string().min(1),
    color: z.string().min(1),
    rulerId: PositiveIdSchema,
    capitalCityId: PositiveIdSchema,
    scenarioMode: z.enum(['territorial', 'expeditionary', 'hosted']).optional(),
    headquartersLabel: z.string().min(1).optional(),
    gold: z.number().nonnegative(),
    food: z.number().nonnegative(),
    courtNetwork: z.number().int().nonnegative(),
    cityIds: z.array(PositiveIdSchema),
    officerIds: z.array(PositiveIdSchema),
    isPlayer: z.boolean(),
    isAlive: z.boolean(),
    fame: z.number().int().min(0).max(1000).optional(),
    politicalStage: z.enum(['vassal', 'hegemon', 'king', 'emperor']).optional(),
    politicalTitle: z.string().optional(),
    politicalStageChangedYear: z.number().int().optional(),
    politicalStageAgeMonths: z.number().int().nonnegative().optional(),
    kingdomName: z.string().min(1).optional(),
    imperialAuthority: z.number().int().min(0).max(100).optional(),
    imperialDecreeCooldown: z.number().int().nonnegative().optional(),
    inventory: z.record(z.coerce.number().int().positive(), z.number().int().positive()).optional(),
    mandate: z.number().int().min(0).max(100).optional(),
    popularWill: z.number().int().min(0).max(100).optional(),
    arms: z.number().int().nonnegative().optional(),
  })
  .strict();

export const FemaleRuntimeSchema: z.ZodType<FemaleCharacter> = z
  .object({
    ...FemaleStaticSchema.shape,
    family: z.nativeEnum(FamilyTier),
    initialStatus: z.nativeEnum(MaritalStatus),
    status: z.nativeEnum(MaritalStatus),
    husbandId: PositiveIdSchema.optional(),
    giftedToOfficerId: z.null().optional(),
  })
  .strict();

function entityRecordSchema<T extends { id: number }>(entitySchema: z.ZodType<T>) {
  return z.record(z.coerce.number().int().positive(), entitySchema).superRefine((entities, ctx) => {
    for (const [recordKey, entity] of Object.entries(entities)) {
      if (Number(recordKey) !== entity.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [recordKey, 'id'],
          message: `记录键 ${recordKey} 与实体 id ${entity.id} 不一致`,
        });
      }
    }
  });
}

export const GameStateEntitiesSchema: z.ZodType<
  Pick<GameState, 'officers' | 'cities' | 'factions' | 'females'>
> = z
  .object({
    officers: entityRecordSchema(OfficerRuntimeSchema),
    cities: entityRecordSchema(CityRuntimeSchema),
    factions: entityRecordSchema(FactionRuntimeSchema),
    females: entityRecordSchema(FemaleRuntimeSchema),
  })
  .strict()
  .superRefine((entities, ctx) => {
    for (const city of Object.values(entities.cities)) {
      const project = city.activeDevelopment;
      if (project && !entities.officers[project.assignedOfficerId]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cities', city.id, 'activeDevelopment', 'assignedOfficerId'],
          message: '持续项目指派武将不存在',
        });
      }
    }
  });

export type GameStateEntities = z.infer<typeof GameStateEntitiesSchema>;
