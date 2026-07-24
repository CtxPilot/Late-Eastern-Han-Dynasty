// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import type { BattlefieldInstance, BattlefieldGenerationAudit, BattlefieldNodeState, BattlefieldRouteState, EncounterState } from './types/battlefield-instance.js';

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
});

export type BattlefieldInstanceSnapshot = z.infer<typeof BattlefieldInstanceSchema>;
