// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import { PlotStage, PlotType } from './enums/index.js';
import type { GameState } from './types/game.js';
import type { Plot, PlotCost, PlotInstallments, PlotResult } from './types/plot.js';

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

export const PlotInstallmentsRuntimeSchema: z.ZodType<PlotInstallments> = z.object({
  goldPerMonth: NonNegativeIntSchema,
  months: z.number().int().positive(),
  paidMonths: NonNegativeIntSchema,
}).strict();

export const PlotRuntimeSchema: z.ZodType<Plot> = z.object({
  id: z.string().min(1),
  type: z.nativeEnum(PlotType),
  casterFactionId: PositiveIdSchema,
  casterOfficerId: PositiveIdSchema.optional(),
  targetFactionId: PositiveIdSchema.optional(),
  targetCityId: PositiveIdSchema.optional(),
  feintCityId: PositiveIdSchema.optional(),
  secondaryFactionId: PositiveIdSchema.optional(),
  targetOfficerId: PositiveIdSchema.optional(),
  agentId: z.string().min(1).optional(),
  stage: z.nativeEnum(PlotStage),
  monthsLeft: NonNegativeIntSchema,
  cost: PlotCostRuntimeSchema,
  result: PlotResultRuntimeSchema.optional(),
  year: z.number().int().nonnegative(),
  month: z.number().int().min(1).max(12),
  layer: z.enum(['tactical', 'strategic', 'policy']).optional(),
  progress: z.number().min(0).max(100).optional(),
  installments: PlotInstallmentsRuntimeSchema.optional(),
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
  if (
    plot.agentId != null
    && plot.type !== PlotType.HONEY_TRAP
    && plot.type !== PlotType.LURE_TIGER
    && plot.type !== PlotType.INSTIGATE
    && plot.type !== PlotType.SWAP_PILLAR
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['agentId'], message: '只有美人计/调虎离山/借刀杀人/偷梁换柱可以绑定特工' });
  }

  const requiresFaction =
    plot.type !== PlotType.EMPTY_FORT
    && plot.type !== PlotType.BLOSSOM
    && plot.type !== PlotType.KILL_CHICKEN;
  const requiresCity =
    plot.type !== PlotType.SOW_DISCORD
    && plot.type !== PlotType.KILL_CHICKEN
    && plot.type !== PlotType.STRIKE_WHILE_HOT
    && plot.type !== PlotType.WATCH_FIRE
    && plot.type !== PlotType.EDICT;
  if (requiresFaction !== (plot.targetFactionId != null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetFactionId'],
      message: requiresFaction
        ? '该计谋必须指定目标势力'
        : '空城疑兵/树上开花/指桑骂槐不能指定目标势力',
    });
  }
  if (requiresCity !== (plot.targetCityId != null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetCityId'],
      message: requiresCity ? '该计谋必须指定目标城市' : '离间计/指桑骂槐/趁火打劫/隔岸观火/借尸还魂不能指定目标城市',
    });
  }
  if (
    plot.targetOfficerId != null
    && plot.type !== PlotType.HONEY_TRAP
    && plot.type !== PlotType.KILL_CHICKEN
    && plot.type !== PlotType.LURE_TIGER
    && plot.type !== PlotType.POACH
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetOfficerId'],
      message: '只有美人计/指桑骂槐/调虎离山/秘密挖角可以指定目标武将',
    });
  }
  if (plot.result?.inverted != null && plot.type !== PlotType.EMPTY_FORT) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['result', 'inverted'], message: '只有空城疑兵可以记录识破反转' });
  }
  if (plot.type === PlotType.UNDERMINE && plot.layer != null && plot.layer !== 'strategic') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '釜底抽薪必须为 strategic 层' });
  }
  if (plot.type === PlotType.BLOSSOM && plot.layer != null && plot.layer !== 'strategic') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '树上开花必须为 strategic 层' });
  }
  if (plot.type === PlotType.KILL_CHICKEN && plot.layer != null && plot.layer !== 'strategic') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '指桑骂槐必须为 strategic 层' });
  }
  if (plot.type === PlotType.STRIKE_WHILE_HOT && plot.layer != null && plot.layer !== 'strategic') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '趁火打劫必须为 strategic 层' });
  }
  if (plot.type === PlotType.STRIKE_WHILE_HOT && plot.stage !== PlotStage.RESOLVED) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stage'], message: '趁火打劫为即时计谋，必须 RESOLVED' });
  }
  if (plot.type === PlotType.LURE_TIGER && plot.layer != null && plot.layer !== 'strategic') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '调虎离山必须为 strategic 层' });
  }
  if (plot.type === PlotType.LURE_TIGER && plot.agentId == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['agentId'], message: '调虎离山必须绑定女间谍' });
  }
  if (plot.type === PlotType.INSTIGATE) {
    if (plot.layer != null && plot.layer !== 'strategic') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '借刀杀人必须为 strategic 层' });
    }
    if (plot.agentId == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['agentId'], message: '借刀杀人必须绑定女间谍' });
    }
    if (plot.feintCityId == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['feintCityId'], message: '借刀杀人必须指定第三方源城' });
    }
    if (plot.secondaryFactionId == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['secondaryFactionId'], message: '借刀杀人必须指定第三方势力' });
    }
  }
  if (plot.type === PlotType.POACH) {
    if (plot.layer != null && plot.layer !== 'strategic') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '秘密挖角必须为 strategic 层' });
    }
    if (plot.targetOfficerId == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['targetOfficerId'], message: '秘密挖角必须指定目标武将' });
    }
  }
  if (plot.type === PlotType.WATCH_FIRE) {
    if (plot.layer != null && plot.layer !== 'strategic') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '隔岸观火必须为 strategic 层' });
    }
    if (plot.secondaryFactionId == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['secondaryFactionId'], message: '隔岸观火必须指定第二势力' });
    } else if (plot.targetFactionId != null && plot.secondaryFactionId === plot.targetFactionId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['secondaryFactionId'], message: '隔岸观火两势力不可相同' });
    }
  }
  if (plot.type === PlotType.SWAP_PILLAR) {
    if (plot.layer != null && plot.layer !== 'strategic') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '偷梁换柱必须为 strategic 层' });
    }
    if (plot.agentId == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['agentId'], message: '偷梁换柱必须绑定反间密探' });
    }
  }
  if (plot.type === PlotType.EDICT && plot.layer != null && plot.layer !== 'strategic') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '借尸还魂必须为 strategic 层' });
  }
  if (plot.type === PlotType.SECRET_CROSSING) {
    if (plot.layer != null && plot.layer !== 'strategic') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['layer'], message: '暗渡陈仓必须为 strategic 层' });
    }
    if (plot.feintCityId == null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['feintCityId'], message: '暗渡陈仓必须指定明修城' });
    } else if (plot.targetCityId != null && plot.feintCityId === plot.targetCityId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['feintCityId'], message: '明修城与暗渡城不可相同' });
    }
  } else if (plot.feintCityId != null && plot.type !== PlotType.INSTIGATE) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['feintCityId'], message: '只有暗渡陈仓/借刀杀人可以指定第二城' });
  }
  if (
    plot.secondaryFactionId != null
    && plot.type !== PlotType.WATCH_FIRE
    && plot.type !== PlotType.INSTIGATE
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['secondaryFactionId'], message: '只有隔岸观火/借刀杀人可以指定第二势力' });
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
