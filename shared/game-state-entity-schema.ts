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
    merit: z.number().int().nonnegative(),
    stamina: z.number().int().nonnegative(),
    wifeId: NullablePositiveIdSchema.optional(),
    beauties: z.array(PositiveIdSchema),
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
    beautySeekLeft: z.number().int().nonnegative(),
    beautyPool: z.number().int().nonnegative().optional(),
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
    beautyStock: z.number().int().nonnegative(),
    cityIds: z.array(PositiveIdSchema),
    officerIds: z.array(PositiveIdSchema),
    isPlayer: z.boolean(),
    isAlive: z.boolean(),
  })
  .strict();

export const FemaleRuntimeSchema: z.ZodType<FemaleCharacter> = z
  .object({
    ...FemaleStaticSchema.shape,
    family: z.nativeEnum(FamilyTier),
    initialStatus: z.nativeEnum(MaritalStatus),
    status: z.nativeEnum(MaritalStatus),
    husbandId: PositiveIdSchema.optional(),
    giftedToOfficerId: NullablePositiveIdSchema.optional(),
  })
  .strict()
  .superRefine((female, ctx) => {
    if (female.husbandId !== undefined && female.giftedToOfficerId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['giftedToOfficerId'],
        message: '已婚女性不能同时处于赏赐状态',
      });
    }
  });

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
  .strict();

export type GameStateEntities = z.infer<typeof GameStateEntitiesSchema>;
