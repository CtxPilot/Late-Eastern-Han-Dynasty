// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';

const UnitTypeSchema = z.enum([
  'lightInfantry',
  'heavyInfantry',
  'spearman',
  'archer',
  'crossbowman',
  'lightCavalry',
  'heavyCavalry',
  'horseArcher',
  'lightNavy',
  'mediumNavy',
  'heavyNavy',
  'siege',
  'tigerLeopard',
  'qingzhouTroops',
  'trappedCamp',
  'whiteHorse',
  'xiliangIron',
  'danyangTroops',
  'jiefanTroops',
  'whiteEar',
  'wudangFlying',
  'rattanArmor',
  'elephant',
  'yellowTurban',
]);

const UnitProficiencySchema = z.enum(['S', 'A', 'B', 'C', 'NONE']);
const TerrainTypeSchema = z.enum([
  'plain',
  'forest',
  'mountain',
  'water',
  'wall',
  'city',
  'swamp',
]);

const OfficerStatsSchema = z.object({
  leadership: z.number().int().min(1).max(100),
  war: z.number().int().min(1).max(100),
  intelligence: z.number().int().min(1).max(100),
  politics: z.number().int().min(1).max(100),
  charisma: z.number().int().min(1).max(100),
});

const CeilingBonusSchema = z.object({
  attribute: z.enum(['leadership', 'war', 'intelligence', 'politics', 'charisma']),
  hiddenBonus: z.number().int().min(0).max(100),
});

const OfficerHiddenSchema = z.object({
  compatibility: z.number().int().min(0).max(150),
  righteousness: z.number().int().min(0).max(15),
  ambition: z.number().int().min(0).max(15),
  valor: z.number().int().min(0).max(7),
  composure: z.number().int().min(0).max(7),
  lifespan: z.number().int(),
  growth: z.enum(['low', 'mid', 'high']),
  personality: z.enum(['brave', 'calm', 'bold', 'cautious', 'reckless', 'gentle']),
  ideal: z.enum(['hegemony', 'benevolence', 'separatist', 'chivalry', 'fame']),
  bloodline: z.array(z.number().int()),
  ceilingBonus: CeilingBonusSchema.nullable(),
  power: z.number().int().min(1).max(100),
  burst: z.number().int().min(1).max(100),
  agility: z.number().int().min(1).max(100),
  luck: z.number().int().min(1).max(100),
  intuition: z.number().int().min(1).max(100),
  awe: z.number().int().min(1).max(100),
  strategy: z.number().int().min(1).max(100),
  tactics: z.number().int().min(1).max(100),
});

export const OfficerStaticSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  birthYear: z.number().int(),
  deathYear: z.number().int(),
  stats: OfficerStatsSchema,
  hidden: OfficerHiddenSchema,
  unitProficiency: z.record(UnitTypeSchema, UnitProficiencySchema),
  formationMastery: z.array(z.number().int().min(0).max(17)),
  skills: z.array(
    z.object({
      skillId: z.string().min(1),
      level: z.number().int().min(1).max(5),
    }),
  ),
  uniqueSkill: z.string().optional(),
  tags: z.array(z.string()),
});

export const OfficersFileSchema = z.array(OfficerStaticSchema);

export const CityStaticSchema = z.object({
  id: z.number().int().positive(),
  /** Display name = 治所/通用地名 (洛阳/长安/成都…) */
  name: z.string().min(1),
  /** Optional formal 郡国名 (河南尹/蜀郡…) */
  adminName: z.string().optional(),
  province: z.string().min(1),
  x: z.number(),
  y: z.number(),
  maxPopulation: z.number().int().positive(),
  isCapital: z.boolean(),
  isPass: z.boolean(),
  specialProduct: z.string().nullable(),
  recruitableUnits: z.array(UnitTypeSchema),
  initialStats: z.object({
    farm: z.number().int().min(0),
    commerce: z.number().int().min(0),
    wall: z.number().int().min(0),
  }),
  resourceOutput: z
    .record(z.enum(['wood', 'iron', 'warhorse']), z.number())
    .optional(),
  tier: z.number().int().min(1).max(6).optional(),
  latitudeIndex: z.number().int().min(1).max(5).optional(),
  specialties: z.array(z.string()).optional(),
  countyCount: z.number().int().optional(),
  facilities: z.array(z.string()).optional(),
  policy: z.string().nullable().optional(),
  developmentProgress: z
    .object({
      farm: z.number(),
      commerce: z.number(),
      wall: z.number(),
    })
    .optional(),
});

export const CitiesFileSchema = z.array(CityStaticSchema);

export const FormationTemplateSchema = z.object({
  id: z.number().int().min(0).max(17),
  name: z.string().min(1),
  description: z.string(),
  historicalSource: z.string(),
  modifiers: z.object({
    attack: z.number(),
    defense: z.number(),
    mobility: z.number(),
    range: z.number(),
  }),
  effects: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      modifier: z.object({
        type: z.string(),
        value: z.number(),
        condition: z.string().optional(),
      }),
    }),
  ),
  allowedUnits: z.array(UnitTypeSchema),
  bestUnits: z.array(UnitTypeSchema),
  restrictedUnits: z.array(UnitTypeSchema),
  terrainModifiers: z.record(TerrainTypeSchema, z.number()),
});

export const FormationsFileSchema = z.array(FormationTemplateSchema);

const CombatEffectTypeSchema = z.enum([
  'knockback',
  'stun',
  'charge',
  'pierce',
  'aoe',
  'fire',
  'morale',
  'confusion',
  'none',
]);

const CombatAbilityLevelSchema = z.object({
  level: z.number().int().min(1).max(5),
  energyCost: z.number().int().min(0),
  power: z.number().positive(),
  hitRateBonus: z.number(),
  requiredProficiency: UnitProficiencySchema,
});

export const CombatAbilityDefSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    leveling: z.enum(['leveled', 'proficiency']),
    perLevel: z.array(CombatAbilityLevelSchema).optional(),
    energyCost: z.number().int().min(0).optional(),
    basePower: z.number().positive().optional(),
    maxPower: z.number().positive().optional(),
    hitRateBonus: z.number().optional(),
    specialEffect: CombatEffectTypeSchema,
    effectValue: z.number().optional(),
    minRange: z.number().int().min(0),
    maxRange: z.number().int().min(0),
    coopAllowed: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (val.leveling === 'leveled') {
      if (!val.perLevel || val.perLevel.length !== 5) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'leveled ability must have exactly 5 perLevel entries',
          path: ['perLevel'],
        });
      }
    } else {
      if (val.energyCost === undefined || val.basePower === undefined || val.maxPower === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'proficiency ability requires energyCost, basePower, maxPower',
          path: ['energyCost'],
        });
      }
    }
    if (val.maxRange < val.minRange) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maxRange must be >= minRange',
        path: ['maxRange'],
      });
    }
  });

export const UnitTemplateSchema = z.object({
  type: UnitTypeSchema,
  name: z.string().min(1),
  isSpecial: z.boolean(),
  attack: z.number(),
  defense: z.number(),
  mobility: z.number(),
  range: z.number(),
  traits: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      modifier: z.object({
        type: z.string(),
        value: z.number(),
        condition: z.string().optional(),
      }),
    }),
  ),
  strongAgainst: z.array(UnitTypeSchema),
  weakAgainst: z.array(UnitTypeSchema),
  recruitRequirement: z.record(z.unknown()).nullable(),
  terrainModifiers: z.record(TerrainTypeSchema, z.number()),
  recruitCost: z.object({
    gold: z.number(),
    food: z.number(),
    population: z.number(),
  }),
  abilities: z.array(CombatAbilityDefSchema),
});

export const UnitsFileSchema = z.array(UnitTemplateSchema);

export const ItemStaticSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  category: z.enum([
    'weapon_primary',
    'weapon_secondary',
    'armor',
    'mount',
    'book',
    'special',
    'consumable',
  ]),
  quality: z.enum(['common', 'rare', 'epic', 'legendary']),
  primaryWeaponSubType: z
    .enum(['sword', 'blade', 'spear', 'halberd', 'blunt'])
    .optional(),
  secondaryWeaponSubType: z.enum(['bow', 'crossbow', 'throwing']).optional(),
  armorSubType: z.enum(['cloth', 'leather', 'metal', 'specialArmor']).optional(),
  baseStats: z.record(z.number()),
  baseEffect: z.array(
    z.object({
      type: z.string(),
      value: z.number(),
      description: z.string().optional(),
    }),
  ),
  equipRequirement: z.record(z.unknown()),
  bond: z
    .object({
      officerId: z.number(),
      bonusEffect: z.array(
        z.object({
          type: z.string(),
          value: z.number(),
          description: z.string().optional(),
        }),
      ),
    })
    .optional(),
  sets: z.array(z.number()).optional(),
  consumable: z
    .object({
      effect: z.object({
        type: z.string(),
        value: z.number(),
        description: z.string().optional(),
      }),
      maxStack: z.number().int().positive(),
    })
    .optional(),
  acquisition: z.array(
    z.enum(['initial', 'search', 'shop', 'event', 'craft', 'loot', 'inherit']),
  ),
  shopPrice: z.number().optional(),
  description: z.string(),
});

export const ItemsFileSchema = z.array(ItemStaticSchema);

const InfluenceSchema = z.object({
  household: z.number(),
  counsel: z.number(),
  martial: z.number(),
  prestige: z.number(),
  fortitude: z.number(),
  scholarship: z.number(),
});

export const FemaleStaticSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  birthYear: z.number().int(),
  deathYear: z.number().int(),
  family: z.enum(['imperial', 'greatClan', 'localPower', 'commoner']),
  clanName: z.string(),
  factionId: z.number().nullable(),
  locationId: z.number().int(),
  fatherId: z.number().optional(),
  motherId: z.number().optional(),
  initialStatus: z.enum(['single', 'betrothed', 'married', 'widow']),
  initialHusbandId: z.number().optional(),
  influence: InfluenceSchema,
  statBonus: z.record(z.number()),
  teachableSkills: z.array(z.string()),
  enhanceableSkills: z.array(
    z.object({
      skill: z.string(),
      bonus: z.number(),
    }),
  ),
  talents: z.array(z.string()),
  relatedEvents: z.array(z.number()),
  marriageRequirements: z.record(z.number()).optional(),
  canCommand: z.boolean(),
  description: z.string(),
});

export const FemalesFileSchema = z.array(FemaleStaticSchema);

export const ChildBirthDefSchema = z.object({
  childId: z.number().int().positive(),
  childName: z.string().min(1),
  fatherId: z.number().int(),
  motherId: z.number().int(),
  birthYear: z.number().int(),
  appearYear: z.number().int(),
  source: z.enum(['history', 'romance', 'folklore']),
  baseStats: OfficerStatsSchema,
  motherBonus: z
    .object({
      fromScholarship: z.record(z.number()).optional(),
      fromBloodline: z.record(z.number()).optional(),
      extraSkills: z.array(z.string()).optional(),
      extraTalents: z.array(z.string()).optional(),
    })
    .optional(),
});

export const ChildrenFileSchema = z.array(ChildBirthDefSchema);

export const SkillTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(['tactics', 'command', 'civil', 'personal', 'unique']),
  description: z.string(),
  maxLevel: z.number().int().min(1).max(5),
  levels: z
    .array(
      z.object({
        level: z.number().int().min(1).max(5),
        name: z.string(),
        effects: z.array(
          z.object({
            type: z.string(),
            value: z.number(),
            range: z.number().optional(),
            condition: z.string().optional(),
            description: z.string().optional(),
          }),
        ),
        requirement: z.object({
          minStats: z.record(z.number()).optional(),
          useCount: z.number().optional(),
          prevLevel: z.number().optional(),
          itemRequired: z.number().optional(),
        }),
      }),
    )
    .min(1),
});

export const SkillsFileSchema = z.array(SkillTemplateSchema);

const EventSourceClassSchema = z.enum([
  'official_history',
  'annotated_history',
  'literature',
  'legend',
  'gameplay',
]);

export const ScenarioStaticSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  type: z.enum(['historical', 'whatif']).optional(),
  noLifespan: z.boolean().optional(),
  description: z.string(),
  startYear: z.number().int(),
  endYear: z.number().int(),
  startState: z.object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    factions: z.array(z.number()),
    activeFactionIds: z.array(z.number()),
    cityOwnership: z.record(z.number()),
    officerPositions: z.array(
      z.object({
        officerId: z.number(),
        cityId: z.number(),
        factionId: z.number(),
        civilPosition: z.string().optional(),
        localPosition: z.string().optional(),
        militaryPosition: z.string().optional(),
        nobilityRank: z.string().optional(),
        merit: z.number().optional(),
        loyalty: z.number().min(0).max(100),
      }),
    ),
    femalePositions: z.array(
      z.object({
        femaleId: z.number(),
        cityId: z.number(),
        status: z.enum(['single', 'betrothed', 'married', 'widow']),
        husbandId: z.number().optional(),
        factionId: z.number().optional(),
      }),
    ),
    initialDiplomacy: z.array(
      z.object({
        factionA: z.number(),
        factionB: z.number(),
        relation: z.enum(['war', 'hostile', 'neutral', 'friendly', 'allied']),
        favorability: z.number(),
        marriageBond: z.boolean().optional(),
      }),
    ),
    completedEvents: z.array(z.number()),
  }),
  factionSetups: z.array(z.object({
    id: z.number().int().positive(),
    name: z.string().min(1),
    color: z.string().min(1),
    rulerId: z.number().int().positive(),
    capitalCityId: z.number().int().positive(),
    mode: z.enum(['territorial', 'expeditionary', 'hosted']),
    headquartersLabel: z.string().min(1),
    historicalNote: z.string().optional(),
  })).min(1),
  eventIds: z.array(z.number().int().positive()),
  availableOfficerIds: z.array(z.number().int().positive()).min(1),
  availableFemaleIds: z.array(z.number().int().positive()),
  childEventIds: z.array(z.number().int().positive()),
  availableEventLayers: z.array(EventSourceClassSchema).min(1),
  defaultEventLayers: z.array(EventSourceClassSchema).min(1),
  scopeNote: z.string().optional(),
  playableFactions: z.array(z.number()),
  recommendedFaction: z.number().optional(),
});

export const ScenariosFileSchema = z.array(ScenarioStaticSchema);

export const EventTemplateSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string(),
  category: z.enum(['historical', 'random', 'marriage', 'diplomacy', 'battle']),
  sourceClass: EventSourceClassSchema,
  sources: z.array(z.string().min(1)).min(1),
  scenarioIds: z.array(z.number().int().positive()).min(1),
  dateWindow: z.object({
    startYear: z.number().int(),
    startMonth: z.number().int().min(1).max(12),
    endYear: z.number().int(),
    endMonth: z.number().int().min(1).max(12),
  }),
  decisionFactionId: z.number().int().positive().optional(),
  decisionOfficerId: z.number().int().positive().optional(),
  prerequisiteEventIds: z.array(z.number().int().positive()).optional(),
  mutexGroup: z.string().min(1).optional(),
  conditions: z.array(
    z.object({
      type: z.enum(['year', 'officer', 'city', 'faction', 'event']),
      field: z.string(),
      targetId: z.number().int().positive().optional(),
      operator: z.enum(['equals', 'gte', 'lte', 'in', 'hasItem', 'notHas', 'probability']),
      value: z.unknown(),
    }),
  ),
  dialogues: z.array(
    z.object({
      speakerId: z.number().optional(),
      speakerName: z.string(),
      text: z.string(),
      portrait: z.string().optional(),
    }),
  ),
  choices: z.array(
    z.object({
      label: z.string(),
      effects: z.array(
        z.object({
            type: z.enum(['recruit', 'loyalty', 'develop', 'relation', 'war', 'capital', 'troops', 'gold', 'food', 'population']),
          target: z.enum(['faction', 'officer', 'city', 'global']),
          targetId: z.number().optional(),
          field: z.string(),
          value: z.unknown(),
        }),
      ),
      aiWeight: z.number().min(0).optional(),
      aiPersonalityWeights: z.record(z.number()).optional(),
      aiIdealWeights: z.record(z.number()).optional(),
    }),
  ),
  autoChoice: z.number().int().nonnegative().optional(),
});

export const EventsFileSchema = z.array(EventTemplateSchema);

export const DataFileSchemas = {
  officers: OfficersFileSchema,
  cities: CitiesFileSchema,
  formations: FormationsFileSchema,
  units: UnitsFileSchema,
  items: ItemsFileSchema,
  females: FemalesFileSchema,
  children: ChildrenFileSchema,
  skills: SkillsFileSchema,
  scenarios: ScenariosFileSchema,
  events: EventsFileSchema,
} as const;

export type DataFileKey = keyof typeof DataFileSchemas;

export function validateDataFile(key: DataFileKey, data: unknown) {
  return DataFileSchemas[key].safeParse(data);
}
