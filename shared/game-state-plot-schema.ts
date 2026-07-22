// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import { PlotStage, PlotType } from './enums/index.js';
import type { GameState } from './types/game.js';
import type { Plot, PlotCost, PlotResult } from './types/plot.js';

const PositiveIdSchema = z.number().int().positive();
const NonNegativeIntSchema = z.number().int().nonnegative();

export const PlotCostRuntimeSchema: z.ZodType<PlotCost> = z.object({
  gold: NonNegativeIntSchema,
  food: NonNegativeIntSchema.optional(),
  beauty: NonNegativeIntSchema.optional(),
  requiresIntel: z.enum(['surface', 'detailed']).optional(),
}).strict();

export const PlotResultRuntimeSchema: z.ZodType<PlotResult> = z.object({
  success: z.boolean(),
  detected: z.boolean(),
  message: z.string().min(1),
  favorChanges: z.array(z.object({
    a: PositiveIdSchema,
    b: PositiveIdSchema,
    delta: z.number().int().min(-100).max(100),
  }).strict().refine((change) => change.a !== change.b, '计谋外交变化不能指向同一势力')).optional(),
  inverted: z.boolean().optional(),
}).strict();

export const PlotRuntimeSchema: z.ZodType<Plot> = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(PlotType),
  casterFactionId: PositiveIdSchema,
  targetFactionId: PositiveIdSchema.optional(),
  targetCityId: PositiveIdSchema.optional(),
  targetOfficerId: PositiveIdSchema.optional(),
  agentId: z.string().min(1).optional(),
  stage: z.nativeEnum(PlotStage),
  monthsLeft: NonNegativeIntSchema,
  cost: PlotCostRuntimeSchema,
  result: PlotResultRuntimeSchema.optional(),
  year: z.number().int().nonnegative(),
  month: z.number().int().min(1).max(12),
}).strict().superRefine((plot, ctx) => {
  if (plot.stage === PlotStage.PREP && (plot.monthsLeft < 1 || plot.result != null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stage'], message: '准备期计谋必须保留正数倒计时且不能提前写入结果' });
  }
  if (plot.stage === PlotStage.ACTIVE && (plot.monthsLeft < 1 || plot.result == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stage'], message: '生效期计谋必须保留正数倒计时及结算结果' });
  }
  if (plot.stage === PlotStage.RESOLVED && (plot.monthsLeft !== 0 || plot.result == null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stage'], message: '已结算计谋必须归零倒计时并写入结果' });
  }
  if (plot.agentId != null && plot.type !== PlotType.HONEY_TRAP) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['agentId'], message: '只有美人计可以绑定女间谍' });
  }

  const requiresFaction = plot.type !== PlotType.EMPTY_FORT;
  const requiresCity = plot.type !== PlotType.SOW_DISCORD;
  if (requiresFaction !== (plot.targetFactionId != null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetFactionId'], message: requiresFaction ? '该计谋必须指定目标势力' : '空城疑兵不能指定目标势力' });
  }
  if (requiresCity !== (plot.targetCityId != null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetCityId'], message: requiresCity ? '该计谋必须指定目标城市' : '离间计不能指定目标城市' });
  }
  if (plot.targetOfficerId != null && plot.type !== PlotType.HONEY_TRAP) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetOfficerId'], message: '只有美人计可以指定目标武将' });
  }
  if (plot.result?.inverted != null && plot.type !== PlotType.EMPTY_FORT) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['result', 'inverted'], message: '只有空城疑兵可以记录识破反转' });
  }
});

type GameStatePlotSlice = Pick<GameState, 'plots'>;

export const GameStatePlotSchema: z.ZodType<GameStatePlotSlice> = z.object({
  plots: z.array(PlotRuntimeSchema),
}).strict().superRefine((slice, ctx) => {
  const ids = new Set<string>();
  slice.plots.forEach((plot, index) => {
    if (ids.has(plot.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['plots', index, 'id'], message: '计谋 ID 不能重复' });
    }
    ids.add(plot.id);
  });
});

export type GameStatePlot = z.infer<typeof GameStatePlotSchema>;
