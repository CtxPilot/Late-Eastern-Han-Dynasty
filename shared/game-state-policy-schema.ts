// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import { PolicyType } from './enums/index.js';
import type { GameState } from './types/game.js';
import type { NationalPolicy } from './types/policy.js';

const PositiveIdSchema = z.number().int().positive();

export const NationalPolicyRuntimeSchema: z.ZodType<NationalPolicy> = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(PolicyType),
  factionId: PositiveIdSchema,
  active: z.boolean(),
  sinceYear: z.number().int().nonnegative(),
  sinceMonth: z.number().int().min(1).max(12),
  cooldown: z.number().int().nonnegative(),
  targetCityId: PositiveIdSchema.optional(),
  scorchedUntilStamp: z.number().int().optional(),
}).strict().superRefine((policy, ctx) => {
  if (policy.type === PolicyType.SCORCHED_EARTH && policy.targetCityId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetCityId'],
      message: '坚壁清野必须指定边境城',
    });
  }
  if (policy.type !== PolicyType.SCORCHED_EARTH && policy.targetCityId != null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetCityId'],
      message: '仅坚壁清野可以指定目标城',
    });
  }
});

type GameStatePolicySlice = Pick<GameState, 'nationalPolicies'>;

export const GameStatePolicySchema: z.ZodType<GameStatePolicySlice> = z.object({
  nationalPolicies: z.array(NationalPolicyRuntimeSchema).optional(),
}).strict().superRefine((slice, ctx) => {
  const ids = new Set<string>();
  const byFaction = new Map<number, number>();
  (slice.nationalPolicies ?? []).forEach((policy, index) => {
    if (ids.has(policy.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nationalPolicies', index, 'id'], message: '国策 ID 不能重复' });
    }
    ids.add(policy.id);
    byFaction.set(policy.factionId, (byFaction.get(policy.factionId) ?? 0) + 1);
  });
  byFaction.forEach((count, factionId) => {
    if (count > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nationalPolicies'],
        message: `势力 ${factionId} 同时只能有一条国策记录`,
      });
    }
  });
});
