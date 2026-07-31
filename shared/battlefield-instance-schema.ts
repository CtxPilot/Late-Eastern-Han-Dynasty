// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import type { BattlefieldInstance, BattlefieldGenerationAudit, BattlefieldNodeState, BattlefieldRouteState, EncounterState, BattlefieldDynamicSituation, BattlefieldDuelContext } from './types/battlefield-instance.js';
import { DuelStateRuntimeSchema } from './game-state-battle-schema.js';

const StableIdSchema = z.string().min(1);
const NonNegInt = z.number().int().nonnegative();

export const BattlefieldNodeStateSchema: z.ZodType<BattlefieldNodeState> = z.object({
  nodeId: StableIdSchema,
  name: z.string().min(1),
  role: z.enum(['seat', 'county', 'marquisate', 'frontier']),
  rulerFactionId: z.number().int().nullable(),
  garrison: NonNegInt,
  wallDurability: NonNegInt,
  maxWallDurability: NonNegInt,
  armyIds: z.array(z.string()),
  adjacentNodeIds: z.array(StableIdSchema),
  localX: z.number(),
  localY: z.number(),
  controlTurns: NonNegInt,
}).strict();

export const BattlefieldRouteStateSchema: z.ZodType<BattlefieldRouteState> = z.object({
  routeId: StableIdSchema,
  fromNodeId: StableIdSchema,
  toNodeId: StableIdSchema,
  type: z.string().min(1),
}).strict();

export const EncounterStateSchema: z.ZodType<EncounterState> = z.object({
  encounterId: StableIdSchema,
  attackerArmyId: StableIdSchema,
  defenderArmyId: StableIdSchema.optional(),
  defenderNodeIds: z.array(StableIdSchema),
  phase: z.enum(['active', 'resolved']),
  winner: z.enum(['attacker', 'defender']).nullable().optional(),
  battleId: z.string().optional(),
  resolution: z.enum(['auto', 'tactical', 'standard']).optional(),
}).strict();

export const BattlefieldGenerationAuditSchema: z.ZodType<BattlefieldGenerationAudit> = z.object({
  rngAlgorithm: z.literal('xorshift32-v1'),
  rngDrawStart: NonNegInt,
  rngDrawEnd: NonNegInt,
  decisions: z.array(z.string()),
}).strict();

export const BattlefieldDynamicSituationSchema: z.ZodType<BattlefieldDynamicSituation> = z.object({
  weather: z.enum(['clear', 'rain', 'fog']),
  deployments: z.array(z.object({
    armyId: StableIdSchema,
    nodeId: StableIdSchema,
  }).strict()),
  attackerScouted: z.boolean(),
  defenderScouted: z.boolean(),
  ambush: z.enum(['none', 'attacker', 'defender']),
  encounterOrder: z.array(StableIdSchema),
}).strict();

export const BattlefieldDuelContextSchema: z.ZodType<BattlefieldDuelContext> = z.object({
  kind: z.enum(['formation_front', 'city_front']),
  nodeId: StableIdSchema,
  attackerArmyId: StableIdSchema.optional(),
  challengerId: z.number().int().positive(),
  defenderId: z.number().int().positive(),
  duel: z.lazy(() => DuelStateRuntimeSchema),
  settlementApplied: z.boolean(),
}).strict();

export const BattlefieldInstanceSchema: z.ZodType<BattlefieldInstance> = z.object({
  id: StableIdSchema,
  warId: StableIdSchema,
  templateId: StableIdSchema,
  templateVersion: NonNegInt,
  scenarioDateAtCreation: z.string().min(1),
  targetCommanderyId: StableIdSchema,
  targetSeatNodeId: StableIdSchema,
  entryNodeIds: z.array(StableIdSchema),
  nodeStates: z.array(BattlefieldNodeStateSchema),
  routeStates: z.array(BattlefieldRouteStateSchema),
  armyIds: z.array(z.string()),
  encounters: z.array(EncounterStateSchema),
  turn: NonNegInt,
  phase: z.enum(['active', 'settling', 'resolved']),
  generationAudit: BattlefieldGenerationAuditSchema,
  dynamicSituation: BattlefieldDynamicSituationSchema.optional(),
  activeDuel: BattlefieldDuelContextSchema.optional(),
}).strict().superRefine((inst, ctx) => {
  const nodeIds = new Set(inst.nodeStates.map((n) => n.nodeId));
  if (inst.nodeStates.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodeStates'], message: '战场实例至少含 1 个节点' });
  }
  const seat = inst.nodeStates.find((n) => n.nodeId === inst.targetSeatNodeId);
  if (!seat) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetSeatNodeId'], message: `targetSeatNodeId ${inst.targetSeatNodeId} 不在 nodeStates 中` });
  } else if (seat.role !== 'seat') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetSeatNodeId'], message: `targetSeatNodeId 必须是 seat 角色，实为 ${seat.role}` });
  }
  for (const n of inst.nodeStates) {
    for (const adj of n.adjacentNodeIds) {
      if (!nodeIds.has(adj)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodeStates'], message: `${n.nodeId} 邻接 ${adj} 不在战场节点中` });
      }
    }
  }
  const ids = inst.nodeStates.map((n) => n.nodeId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nodeStates'], message: '节点 id 重复' });
  }
  for (const [index, deployment] of (inst.dynamicSituation?.deployments ?? []).entries()) {
    if (!inst.armyIds.includes(deployment.armyId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dynamicSituation', 'deployments', index, 'armyId'], message: '部署 Army 不在实例 armyIds 中' });
    }
    if (!nodeIds.has(deployment.nodeId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dynamicSituation', 'deployments', index, 'nodeId'], message: '部署节点不在战场中' });
    }
  }
  if (inst.activeDuel) {
    if (!nodeIds.has(inst.activeDuel.nodeId)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeDuel', 'nodeId'], message: '单挑节点不在战场中' });
    }
    if (inst.activeDuel.challengerId !== inst.activeDuel.duel.challengerId
      || inst.activeDuel.defenderId !== inst.activeDuel.duel.defenderId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['activeDuel'], message: '单挑上下文双方必须与 DuelState 一致' });
    }
  }
});

export type BattlefieldInstanceSnapshot = z.infer<typeof BattlefieldInstanceSchema>;
