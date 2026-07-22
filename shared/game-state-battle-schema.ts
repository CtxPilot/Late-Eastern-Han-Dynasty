// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import { FormationType, TerrainType, UnitType, Weather } from './enums/index.js';
import type { BattleState, BattleUnit } from './types/battle.js';
import type { BattlefieldMap, BattlefieldNode, MeleeState } from './types/battlefield.js';
import { DuelCommand, type DuelState } from './types/duel.js';
import type { GameState } from './types/game.js';

const PositiveIdSchema = z.number().int().positive();
const NonNegativeIntSchema = z.number().int().nonnegative();
const PercentageSchema = z.number().min(0).max(100);
const NumericRecordSchema = <T extends z.ZodTypeAny>(value: T) =>
  z.record(z.string().regex(/^\d+$/, '键必须是武将数字 id'), value);

const DuelInjurySchema = z
  .object({
    part: z.enum(['arm', 'leg', 'rib', 'head', 'severe']),
    attackPenalty: z.number(),
    dodgePenalty: z.number(),
    blockPenalty: z.number(),
    stunTurns: NonNegativeIntSchema,
  })
  .strict();

const DuelCombatantStateSchema = z
  .object({
    officerId: PositiveIdSchema,
    hp: z.number().nonnegative(),
    maxHp: z.number().positive(),
    energy: z.number().nonnegative(),
    maxEnergy: z.number().positive(),
    injury: DuelInjurySchema.nullable(),
    sneakUsed: z.boolean(),
    consecutiveBlocks: NonNegativeIntSchema,
    lastCommand: z.nativeEnum(DuelCommand).nullable(),
  })
  .strict()
  .superRefine((combatant, ctx) => {
    if (combatant.hp > combatant.maxHp) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hp'], message: '单挑生命不能超过上限' });
    }
    if (combatant.energy > combatant.maxEnergy) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['energy'], message: '单挑气力不能超过上限' });
    }
  });

const DuelRoundSchema = z
  .object({
    round: z.number().int().positive(),
    commands: z.tuple([z.nativeEnum(DuelCommand), z.nativeEnum(DuelCommand)]),
    hits: NumericRecordSchema(z.boolean()),
    damages: NumericRecordSchema(z.number().nonnegative()),
    criticals: NumericRecordSchema(z.boolean()),
    counterDamages: NumericRecordSchema(z.number().nonnegative()),
    counterCriticals: NumericRecordSchema(z.boolean()),
    chainHits: NumericRecordSchema(z.array(z.number().nonnegative())),
    injuryApplied: NumericRecordSchema(DuelInjurySchema.nullable()),
    hpAfter: NumericRecordSchema(z.number().nonnegative()),
    description: z.string(),
    detail: z.string().optional(),
  })
  .strict();

const DuelResultSchema = z
  .object({
    winnerId: PositiveIdSchema,
    loserId: PositiveIdSchema,
    outcome: z.enum(['killed', 'captured', 'escaped', 'draw', 'surrendered']),
    rounds: z.array(DuelRoundSchema),
    moraleChange: z.object({ winner: z.number(), loser: z.number() }).strict(),
    audienceMoraleChange: z.number(),
    meritReward: z.number().nonnegative(),
    epilogue: z.string(),
  })
  .strict();

export const DuelStateRuntimeSchema: z.ZodType<DuelState> = z
  .object({
    battleId: z.string().min(1),
    phase: z.enum(['pre_duel', 'dueling', 'resolving', 'resolved']),
    challengerId: PositiveIdSchema,
    defenderId: PositiveIdSchema,
    round: NonNegativeIntSchema,
    combatants: NumericRecordSchema(DuelCombatantStateSchema),
    turnOrder: z.array(PositiveIdSchema).length(2),
    preDuelDone: z.boolean(),
    dialogueLog: z.array(
      z.object({ speakerId: PositiveIdSchema, text: z.string(), moraleEffect: z.number() }).strict(),
    ),
    roundHistory: z.array(DuelRoundSchema),
    autoResolve: z.boolean(),
    speedMode: z.enum(['full', 'fast', 'skip']),
    result: DuelResultSchema.optional(),
  })
  .strict()
  .superRefine((duel, ctx) => {
    if (duel.challengerId === duel.defenderId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defenderId'], message: '单挑双方不能是同一武将' });
    }
    const expectedIds = new Set([duel.challengerId, duel.defenderId]);
    const combatantIds = Object.values(duel.combatants).map((combatant) => combatant.officerId);
    if (combatantIds.length !== 2 || combatantIds.some((id) => !expectedIds.has(id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['combatants'], message: '单挑参战快照必须与挑战双方一致' });
    }
    if (new Set(duel.turnOrder).size !== 2 || duel.turnOrder.some((id) => !expectedIds.has(id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['turnOrder'], message: '单挑行动顺序必须恰好包含双方武将' });
    }
    if (duel.phase === 'resolved' && !duel.result) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['result'], message: '已结束单挑必须包含结果' });
    }
  });

export const BattleUnitRuntimeSchema: z.ZodType<BattleUnit> = z
  .object({
    id: z.string().min(1),
    armyId: z.string().min(1),
    commanderId: PositiveIdSchema,
    factionId: PositiveIdSchema,
    side: z.enum(['attacker', 'defender']),
    unitType: z.nativeEnum(UnitType),
    formation: z.nativeEnum(FormationType),
    troopCount: NonNegativeIntSchema,
    maxTroops: NonNegativeIntSchema,
    morale: PercentageSchema,
    food: z.number().nonnegative(),
    position: z.object({ q: z.number().int(), r: z.number().int() }).strict(),
    mp: z.number().nonnegative(),
    maxMp: z.number().nonnegative(),
    energy: z.number().nonnegative(),
    maxEnergy: z.number().nonnegative(),
    hasActed: z.boolean(),
    isRetreated: z.boolean(),
    isDestroyed: z.boolean(),
    statusEffects: z.array(
      z.object({ type: z.string().min(1), remainingTurns: NonNegativeIntSchema, value: z.number().optional() }).strict(),
    ),
  })
  .strict()
  .superRefine((unit, ctx) => {
    if (unit.troopCount > unit.maxTroops) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['troopCount'], message: '战斗兵力不能超过上限' });
    }
    if (unit.mp > unit.maxMp) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mp'], message: '战斗移动力不能超过上限' });
    }
    if (unit.energy > unit.maxEnergy) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['energy'], message: '战斗气力不能超过上限' });
    }
  });

export const BattleStateRuntimeSchema: z.ZodType<BattleState> = z
  .object({
    id: z.string().min(1),
    turn: z.number().int().positive(),
    weather: z.nativeEnum(Weather),
    attackerFaction: PositiveIdSchema,
    defenderFaction: PositiveIdSchema,
    isSiege: z.boolean(),
    cityId: PositiveIdSchema.optional(),
    fromCityId: PositiveIdSchema.optional(),
    settled: z.boolean().optional(),
    units: z.array(BattleUnitRuntimeSchema).min(1),
    phase: z.enum(['player', 'enemy', 'over']),
    winner: z.enum(['attacker', 'defender']).nullable(),
    hexGrid: z
      .object({
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        terrain: z.array(z.array(z.nativeEnum(TerrainType))),
      })
      .strict(),
    log: z.array(z.object({ turn: z.number().int().positive(), message: z.string() }).strict()),
    message: z.string(),
    duel: DuelStateRuntimeSchema.nullable().optional(),
  })
  .strict()
  .superRefine((battle, ctx) => {
    if (battle.attackerFaction === battle.defenderFaction) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defenderFaction'], message: '攻守双方不能属于同一势力' });
    }
    if (battle.phase === 'over' && battle.winner === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['winner'], message: '已结束战斗必须有胜方' });
    }
    if (battle.phase !== 'over' && battle.winner !== null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['winner'], message: '未结束战斗不能提前设置胜方' });
    }
    if (battle.hexGrid.terrain.length !== battle.hexGrid.height ||
        battle.hexGrid.terrain.some((row) => row.length !== battle.hexGrid.width)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hexGrid', 'terrain'], message: '战场地形尺寸必须与宽高一致' });
    }
    const unitIds = battle.units.map((unit) => unit.id);
    if (new Set(unitIds).size !== unitIds.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['units'], message: '战斗单位 id 不能重复' });
    }
    battle.units.forEach((unit, index) => {
      if (unit.position.q < 0 || unit.position.q >= battle.hexGrid.width ||
          unit.position.r < 0 || unit.position.r >= battle.hexGrid.height) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['units', index, 'position'], message: '战斗单位坐标超出战场边界' });
      }
      const expectedFaction = unit.side === 'attacker' ? battle.attackerFaction : battle.defenderFaction;
      if (unit.factionId !== expectedFaction) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['units', index, 'factionId'], message: '战斗单位势力与攻守方不一致' });
      }
    });
    if (battle.duel && battle.duel.battleId !== battle.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['duel', 'battleId'], message: '单挑必须归属于当前战斗' });
    }
  });

const BattlefieldTrapRuntimeSchema = z.object({
  type: z.enum(['explosive', 'rockfall', 'tripwire', 'oil']),
  ownerFactionId: PositiveIdSchema,
  remaining: NonNegativeIntSchema,
}).strict();

export const BattlefieldNodeRuntimeSchema: z.ZodType<BattlefieldNode> = z.object({
  id: PositiveIdSchema,
  name: z.string().min(1),
  type: z.enum(['major_city', 'county', 'pass', 'port', 'facility']),
  x: z.number().finite(),
  y: z.number().finite(),
  ruler: PositiveIdSchema.nullable(),
  adjacentNodeIds: z.array(PositiveIdSchema),
  garrison: NonNegativeIntSchema,
  wallDurability: z.number().nonnegative(),
  maxWallDurability: z.number().nonnegative(),
  armyIds: z.array(z.string().min(1)),
  traps: z.array(BattlefieldTrapRuntimeSchema),
  strategicPointType: z.enum(['supply', 'highland', 'ferry', 'bridge', 'forest']).nullable().optional(),
  strategicOwner: PositiveIdSchema.nullable().optional(),
}).strict().superRefine((node, ctx) => {
  if (node.wallDurability > node.maxWallDurability) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['wallDurability'], message: '城防耐久不能超过上限' });
  }
  if (new Set(node.adjacentNodeIds).size !== node.adjacentNodeIds.length || node.adjacentNodeIds.includes(node.id)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adjacentNodeIds'], message: '邻接节点不能重复或指向自身' });
  }
  if (new Set(node.armyIds).size !== node.armyIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['armyIds'], message: '节点 Army id 不能重复' });
  }
});

export const BattlefieldMapRuntimeSchema: z.ZodType<BattlefieldMap> = z.object({
  id: z.string().min(1),
  warId: z.string().min(1),
  attackerFactionId: PositiveIdSchema,
  defenderFactionId: PositiveIdSchema,
  targetCityId: PositiveIdSchema,
  nodes: z.array(BattlefieldNodeRuntimeSchema).min(1),
  armyIds: z.array(z.string().min(1)),
  turn: NonNegativeIntSchema,
  phase: z.enum(['active', 'attacker_victory', 'defender_victory', 'stalemate']),
}).strict().superRefine((battlefield, ctx) => {
  if (battlefield.attackerFactionId === battlefield.defenderFactionId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defenderFactionId'], message: '战场攻守双方不能属于同一势力' });
  }
  const nodeIds = battlefield.nodes.map((node) => node.id);
  if (new Set(nodeIds).size !== nodeIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodes'], message: '战场节点 id 不能重复' });
  }
  if (!nodeIds.includes(battlefield.targetCityId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetCityId'], message: '目标城市必须存在于战场节点中' });
  }
  if (new Set(battlefield.armyIds).size !== battlefield.armyIds.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['armyIds'], message: '战场 Army id 不能重复' });
  }
  const armyIds = new Set(battlefield.armyIds);
  battlefield.nodes.forEach((node, index) => node.armyIds.forEach((armyId) => {
    if (!armyIds.has(armyId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodes', index, 'armyIds'], message: '节点 Army 必须属于当前战场' });
    }
  }));
});

export const MeleeStateRuntimeSchema: z.ZodType<MeleeState> = z.object({
  battlefieldId: z.string().min(1),
  attackerArmyId: z.string().min(1),
  defenderArmyId: z.string().min(1),
  attackerFactionId: PositiveIdSchema,
  defenderFactionId: PositiveIdSchema,
  round: NonNegativeIntSchema,
  maxRounds: z.number().int().positive(),
  attackerTroops: NonNegativeIntSchema,
  attackerMorale: PercentageSchema,
  attackerFatigue: PercentageSchema,
  attackerFormation: z.nativeEnum(FormationType),
  defenderTroops: NonNegativeIntSchema,
  defenderMorale: PercentageSchema,
  defenderFatigue: PercentageSchema,
  defenderFormation: z.nativeEnum(FormationType),
  tacticalPoints: NonNegativeIntSchema.max(10),
  tacticalPointsUsed: NonNegativeIntSchema.max(10),
  phase: z.enum(['active', 'attacker_victory', 'defender_victory', 'stalemate']),
  eventLog: z.array(z.string()),
}).strict().superRefine((melee, ctx) => {
  if (melee.attackerArmyId === melee.defenderArmyId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defenderArmyId'], message: '白刃战双方不能是同一支 Army' });
  }
  if (melee.attackerFactionId === melee.defenderFactionId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defenderFactionId'], message: '白刃战双方不能属于同一势力' });
  }
  if (melee.round > melee.maxRounds) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['round'], message: '白刃战回合不能超过上限' });
  }
});

type GameStateCombatSlice = Pick<GameState, 'activeBattles' | 'activeBattlefield' | 'activeMelee'>;

export const GameStateBattleSchema: z.ZodType<GameStateCombatSlice> = z
  .object({
    activeBattles: z.array(BattleStateRuntimeSchema),
    activeBattlefield: BattlefieldMapRuntimeSchema.nullable(),
    activeMelee: MeleeStateRuntimeSchema.nullable(),
  })
  .strict()
  .superRefine((slice, ctx) => {
    const ids = slice.activeBattles.map((battle) => battle.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeBattles'], message: '活跃战斗 id 不能重复' });
    }
    if (slice.activeMelee && !slice.activeBattlefield) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeMelee'], message: '白刃战必须归属于活跃战场' });
    }
    if (slice.activeMelee && slice.activeBattlefield) {
      if (slice.activeMelee.battlefieldId !== slice.activeBattlefield.id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeMelee', 'battlefieldId'], message: '白刃战战场 id 必须匹配活跃战场' });
      }
      const armies = new Set(slice.activeBattlefield.armyIds);
      if (!armies.has(slice.activeMelee.attackerArmyId) || !armies.has(slice.activeMelee.defenderArmyId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeMelee'], message: '白刃战双方 Army 必须属于活跃战场' });
      }
    }
  });

export type GameStateBattle = z.infer<typeof GameStateBattleSchema>;
