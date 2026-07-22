// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import { ArmyStatus, FormationType, UnitType } from './enums/index.js';
import type { Army } from './types/army.js';
import type {
  CampStructure,
  CampaignArmy,
  CampaignNode,
  CampaignSquad,
  GrandStrategist,
  SiegeState,
} from './types/campaign.js';
import type { GameState } from './types/game.js';

const PositiveIdSchema = z.number().int().positive();
const NonNegativeIntSchema = z.number().int().nonnegative();
const PercentageSchema = z.number().min(0).max(100);

const CampaignPhaseSchema = z.enum([
  'garrison',
  'marching',
  'engaged',
  'sieging',
  'assaulting',
  'retreating',
]);
const SquadPositionSchema = z.enum(['vanguard', 'center', 'left', 'right', 'rearguard']);
const StructureTypeSchema = z.enum([
  'camp',
  'ram',
  'ladder',
  'siege_tower',
  'catapult',
  'supply_depot',
  'trap',
  'watchtower',
  'palisade',
  'trench',
  'pontoon_bridge',
]);
const NodeTypeSchema = z.enum(['major_city', 'county', 'pass', 'port', 'facility']);
const StrategyTypeSchema = z.enum(['offense', 'defense', 'development', 'endurance']);

export const ArmyRuntimeSchema: z.ZodType<Army> = z
  .object({
    id: z.string().min(1),
    commanderId: PositiveIdSchema,
    subCommanders: z.array(PositiveIdSchema),
    unitType: z.nativeEnum(UnitType),
    formation: z.nativeEnum(FormationType),
    troopCount: NonNegativeIntSchema,
    maxTroopCount: NonNegativeIntSchema,
    morale: PercentageSchema,
    food: z.number().nonnegative(),
    location: PositiveIdSchema,
    status: z.nativeEnum(ArmyStatus),
    targetCityId: PositiveIdSchema.optional(),
    arrivalTurn: NonNegativeIntSchema.optional(),
  })
  .strict()
  .superRefine((army, ctx) => {
    if (army.troopCount > army.maxTroopCount) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['troopCount'],
        message: '当前兵力不能超过兵力上限',
      });
    }
    if (new Set([army.commanderId, ...army.subCommanders]).size !== army.subCommanders.length + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subCommanders'],
        message: '旧 Army 主将与副将不能重复',
      });
    }
  });

export const CampaignSquadSchema: z.ZodType<CampaignSquad> = z
  .object({
    officerId: PositiveIdSchema,
    role: z.enum(['main', 'sub']),
    position: SquadPositionSchema,
    unitType: z.nativeEnum(UnitType),
    troops: NonNegativeIntSchema,
    morale: PercentageSchema,
  })
  .strict();

export const SiegeStateSchema: z.ZodType<SiegeState> = z
  .object({
    wallDurability: z.number().nonnegative(),
    maxWallDurability: z.number().nonnegative(),
    gateDurability: z.number().nonnegative(),
    siegeTurns: NonNegativeIntSchema,
    attackerStructures: z.array(StructureTypeSchema),
    defenderBonus: z.number(),
    surrenderChance: PercentageSchema,
  })
  .strict()
  .superRefine((siege, ctx) => {
    if (siege.wallDurability > siege.maxWallDurability) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wallDurability'],
        message: '当前城墙耐久不能超过耐久上限',
      });
    }
  });

export const CampStructureSchema: z.ZodType<CampStructure> = z
  .object({
    type: StructureTypeSchema,
    builderId: PositiveIdSchema,
    buildProgress: z.number().min(0).max(1),
    durability: z.number().nonnegative(),
    effect: z.string(),
    nodeId: PositiveIdSchema,
  })
  .strict();

export const CampaignArmyRuntimeSchema: z.ZodType<CampaignArmy> = z
  .object({
    id: z.string().min(1),
    factionId: PositiveIdSchema,
    name: z.string().min(1),
    commanderId: PositiveIdSchema,
    subCommanderIds: z.array(PositiveIdSchema),
    advisorId: PositiveIdSchema.optional(),
    subAdvisorId: PositiveIdSchema.optional(),
    unitType: z.nativeEnum(UnitType),
    formation: z.nativeEnum(FormationType),
    currentNodeId: PositiveIdSchema,
    targetNodeId: PositiveIdSchema.optional(),
    path: z.array(PositiveIdSchema),
    phase: CampaignPhaseSchema,
    troops: NonNegativeIntSchema,
    maxTroops: NonNegativeIntSchema,
    food: z.number().nonnegative(),
    maxFood: z.number().nonnegative(),
    morale: PercentageSchema,
    organization: PercentageSchema,
    experience: z.number().nonnegative(),
    fatigue: PercentageSchema,
    squads: z.array(CampaignSquadSchema),
    structures: z.array(CampStructureSchema),
    siegeState: SiegeStateSchema.optional(),
    fromNodeId: PositiveIdSchema.optional(),
  })
  .strict()
  .superRefine((army, ctx) => {
    if (army.troops > army.maxTroops) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['troops'], message: '当前兵力不能超过兵力上限' });
    }
    if (army.food > army.maxFood) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['food'], message: '当前军粮不能超过军粮上限' });
    }

    const assignedOfficerIds = [
      army.commanderId,
      ...army.subCommanderIds,
      ...(army.advisorId === undefined ? [] : [army.advisorId]),
      ...(army.subAdvisorId === undefined ? [] : [army.subAdvisorId]),
    ];
    if (new Set(assignedOfficerIds).size !== assignedOfficerIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['subCommanderIds'],
        message: '战役 Army 的主将、副将与参谋不能重复任职',
      });
    }

    const squadOfficerIds = army.squads.map((squad) => squad.officerId);
    if (new Set(squadOfficerIds).size !== squadOfficerIds.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['squads'], message: 'Squad 武将不能重复' });
    }
    const squadPositions = army.squads.map((squad) => squad.position);
    if (new Set(squadPositions).size !== squadPositions.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['squads'], message: 'Squad 阵位不能重复' });
    }
  });

export const CampaignNodeRuntimeSchema: z.ZodType<CampaignNode> = z
  .object({
    id: PositiveIdSchema,
    name: z.string().min(1),
    type: NodeTypeSchema,
    x: z.number().finite(),
    y: z.number().finite(),
    ruler: PositiveIdSchema.nullable(),
    commanderyId: PositiveIdSchema,
    adjacentNodeIds: z.array(PositiveIdSchema),
    garrison: NonNegativeIntSchema,
    wallDurability: z.number().nonnegative(),
    maxWallDurability: z.number().nonnegative(),
    farm: z.number().nonnegative(),
    commerce: z.number().nonnegative(),
    population: NonNegativeIntSchema,
    morale: PercentageSchema,
    lockDirection: z.array(PositiveIdSchema).optional(),
  })
  .strict()
  .superRefine((node, ctx) => {
    if (node.wallDurability > node.maxWallDurability) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wallDurability'],
        message: '节点当前城墙耐久不能超过耐久上限',
      });
    }
    if (node.adjacentNodeIds.includes(node.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adjacentNodeIds'], message: '节点不能与自身相邻' });
    }
    if (new Set(node.adjacentNodeIds).size !== node.adjacentNodeIds.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adjacentNodeIds'], message: '相邻节点不能重复' });
    }
  });

export const GrandStrategistRuntimeSchema: z.ZodType<GrandStrategist> = z
  .object({
    factionId: PositiveIdSchema,
    officerId: PositiveIdSchema,
    appointedYear: z.number().int(),
    strategy: StrategyTypeSchema,
    lastStrategyChange: NonNegativeIntSchema,
    adviceSuccess: NonNegativeIntSchema,
    insightCount: NonNegativeIntSchema,
    strategyScore: z.number(),
  })
  .strict();

function addUniqueIdIssues<T>(
  values: T[],
  idOf: (value: T) => string | number,
  path: string,
  label: string,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string | number>();
  values.forEach((value, index) => {
    const id = idOf(value);
    if (seen.has(id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path, index], message: `${label} ${id} 重复` });
    }
    seen.add(id);
  });
}

export const GameStateCampaignSchema: z.ZodType<
  Pick<GameState, 'armys' | 'campaignArmies' | 'campaignNodes' | 'grandStrategists'>
> = z
  .object({
    armys: z.array(ArmyRuntimeSchema),
    campaignArmies: z.array(CampaignArmyRuntimeSchema),
    campaignNodes: z.array(CampaignNodeRuntimeSchema),
    grandStrategists: z.array(GrandStrategistRuntimeSchema),
  })
  .strict()
  .superRefine((slice, ctx) => {
    addUniqueIdIssues(slice.armys, (army) => army.id, 'armys', '旧 Army id', ctx);
    addUniqueIdIssues(slice.campaignArmies, (army) => army.id, 'campaignArmies', '战役 Army id', ctx);
    addUniqueIdIssues(slice.campaignNodes, (node) => node.id, 'campaignNodes', '战役节点 id', ctx);
    addUniqueIdIssues(
      slice.grandStrategists,
      (strategist) => strategist.factionId,
      'grandStrategists',
      '总军师势力',
      ctx,
    );
  });

export type GameStateCampaign = z.infer<typeof GameStateCampaignSchema>;
