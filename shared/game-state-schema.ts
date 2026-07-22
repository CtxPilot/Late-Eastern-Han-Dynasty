// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import { Season } from './enums/index.js';
import type { GameAction, GameState } from './types/game.js';

const EventSourceClassSchema = z.enum([
  'official_history',
  'annotated_history',
  'literature',
  'legend',
  'gameplay',
]);

const GameActionSchema: z.ZodType<GameAction> = z
  .object({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    type: z.string().min(1),
    message: z.string(),
  })
  .strict();

/**
 * GameState 中与年月、剧本和事件账本有关的可持久化切片。
 *
 * 这是完整 GameStateSchema 的组合部件，不是生产读档 Schema。使用 pick
 * 显式绑定类型字段，避免文档与运行时 GameState 根字段静默漂移。
 */
export const GameStateTimelineSchema: z.ZodType<
  Pick<
    GameState,
    | 'scenarioId'
    | 'enabledEventLayers'
    | 'enabledChildEventIds'
    | 'currentYear'
    | 'currentMonth'
    | 'season'
    | 'playerFactionId'
    | 'completedEvents'
    | 'pendingEvents'
    | 'invalidatedEvents'
    | 'eventChoices'
    | 'actionLog'
  >
> = z
  .object({
    scenarioId: z.number().int().positive(),
    enabledEventLayers: z.array(EventSourceClassSchema),
    enabledChildEventIds: z.array(z.number().int().positive()),
    currentYear: z.number().int(),
    currentMonth: z.number().int().min(1).max(12),
    season: z.nativeEnum(Season),
    playerFactionId: z.number().int().positive(),
    completedEvents: z.array(z.number().int().positive()),
    pendingEvents: z.array(z.number().int().positive()),
    invalidatedEvents: z.array(z.number().int().positive()),
    eventChoices: z.record(z.coerce.number().int().positive(), z.number().int().nonnegative()),
    actionLog: z.array(GameActionSchema),
  })
  .strict()
  .superRefine((timeline, ctx) => {
    const expectedSeason = Math.floor((timeline.currentMonth - 1) / 3) as Season;
    if (timeline.season !== expectedSeason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['season'],
        message: `季节与月份不一致：${timeline.currentMonth}月应为 season=${expectedSeason}`,
      });
    }
  });

export type GameStateTimeline = z.infer<typeof GameStateTimelineSchema>;
