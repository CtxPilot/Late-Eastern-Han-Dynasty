// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import { DipRelation } from './enums/index.js';
import type { DiplomacyLink } from './types/diplomacy.js';
import type { GameState } from './types/game.js';

const PositiveIdSchema = z.number().int().positive();

export const DiplomacyLinkRuntimeSchema: z.ZodType<DiplomacyLink> = z
  .object({
    factionA: PositiveIdSchema,
    factionB: PositiveIdSchema,
    relation: z.nativeEnum(DipRelation),
    favorability: z.number().min(-100).max(100),
    marriageBond: z.boolean().optional(),
  })
  .strict()
  .superRefine((link, ctx) => {
    if (link.factionA === link.factionB) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['factionB'],
        message: '外交双方不能是同一势力',
      });
    }
  });

type GameStateDiplomacySlice = Pick<GameState, 'diplomacy'>;

export const GameStateDiplomacySchema: z.ZodType<GameStateDiplomacySlice> = z
  .object({
    diplomacy: z.array(DiplomacyLinkRuntimeSchema),
  })
  .strict()
  .superRefine((slice, ctx) => {
    const seen = new Set<string>();
    slice.diplomacy.forEach((link, index) => {
      const low = Math.min(link.factionA, link.factionB);
      const high = Math.max(link.factionA, link.factionB);
      const key = `${low}:${high}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['diplomacy', index],
          message: '同一势力对只能有一条外交关系',
        });
      }
      seen.add(key);
    });
  });

export type GameStateDiplomacy = z.infer<typeof GameStateDiplomacySchema>;
