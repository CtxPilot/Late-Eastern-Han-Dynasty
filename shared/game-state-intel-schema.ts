// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import { SpyMissionType, SpyStatus } from './enums/index.js';
import type { IntelState } from './types/intel.js';
import type { GameState } from './types/game.js';
import type { CityCounterIntel, SpyAgent, SpyMissionLog } from './types/spy.js';

const PositiveIdSchema = z.number().int().positive();
const PositiveMonthSchema = z.number().int().min(1).max(12);
const NonNegativeIntSchema = z.number().int().nonnegative();
const NumericRecordKeySchema = z.coerce.number().int().positive();

const SpySkillsSchema = z
  .object({
    recon: z.number().int().min(0).max(100),
    sabotage: z.number().int().min(0).max(100),
    lethal: z.number().int().min(0).max(100),
    tradecraft: z.number().int().min(0).max(100),
  })
  .strict();

export const SpyAgentRuntimeSchema: z.ZodType<SpyAgent> = z
  .object({
    id: z.string().min(1),
    factionId: PositiveIdSchema,
    name: z.string().min(1),
    rank: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
    exp: NonNegativeIntSchema,
    skills: SpySkillsSchema,
    status: z.nativeEnum(SpyStatus),
    homeCityId: PositiveIdSchema,
    locationCityId: PositiveIdSchema.nullable(),
    captiveByFactionId: PositiveIdSchema.nullable().optional(),
    cooldownMonths: NonNegativeIntSchema,
    missionsDone: NonNegativeIntSchema,
    coverIdentity: z.string().min(1).optional(),
    agentKind: z.enum(['male', 'female']).optional(),
  })
  .strict()
  .superRefine((agent, ctx) => {
    const hasCaptor = agent.captiveByFactionId != null;
    if ((agent.status === SpyStatus.CAPTIVE) !== hasCaptor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['captiveByFactionId'],
        message: '被俘状态与俘获势力必须同时存在或同时不存在',
      });
    }
    if (agent.status === SpyStatus.DEAD && agent.locationCityId !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['locationCityId'],
        message: '已死亡特工不能保留所在城市',
      });
    }
  });

export const CityCounterIntelRuntimeSchema: z.ZodType<CityCounterIntel> = z
  .object({
    level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    untilYear: z.number().int().nonnegative(),
    untilMonth: PositiveMonthSchema,
    stationAgentId: z.string().min(1).nullable().optional(),
  })
  .strict();

export const SpyMissionLogRuntimeSchema: z.ZodType<SpyMissionLog> = z
  .object({
    year: z.number().int().nonnegative(),
    month: PositiveMonthSchema,
    type: z.union([
      z.nativeEnum(SpyMissionType),
      z.enum(['station', 'unstation', 'recruit', 'captive']),
    ]),
    agentId: z.string().min(1),
    agentName: z.string().min(1),
    factionId: PositiveIdSchema,
    targetCityId: PositiveIdSchema.optional(),
    success: z.boolean(),
    captured: z.boolean(),
    dead: z.boolean(),
    message: z.string().min(1),
  })
  .strict();

const CityIntelEntrySchema = z
  .object({
    depth: z.enum(['surface', 'detailed']),
    expireYear: z.number().int().nonnegative(),
    expireMonth: PositiveMonthSchema,
    source: z.enum(['scout', 'spy', 'battle', 'recon']),
  })
  .strict();

export const IntelStateRuntimeSchema: z.ZodType<IntelState> = z
  .object({
    cities: z.record(NumericRecordKeySchema, CityIntelEntrySchema),
    agents: z.record(z.string().min(1), SpyAgentRuntimeSchema),
    cityDefense: z.record(NumericRecordKeySchema, CityCounterIntelRuntimeSchema),
    nextAgentSeq: z.number().int().positive(),
    recentMissions: z.array(SpyMissionLogRuntimeSchema).max(30),
    plantableBeauty: z.record(NumericRecordKeySchema, NonNegativeIntSchema).optional(),
  })
  .strict()
  .superRefine((intel, ctx) => {
    for (const [recordKey, agent] of Object.entries(intel.agents)) {
      if (recordKey !== agent.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['agents', recordKey, 'id'],
          message: `特工记录键 ${recordKey} 与 id ${agent.id} 不一致`,
        });
      }
    }

    const stationedAgents = new Map<string, number>();
    for (const [cityKey, defense] of Object.entries(intel.cityDefense)) {
      if (!defense.stationAgentId) continue;
      const cityId = Number(cityKey);
      const agent = intel.agents[defense.stationAgentId];
      if (!agent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cityDefense', cityKey, 'stationAgentId'],
          message: '反间驻守引用的特工不存在',
        });
        continue;
      }
      if (agent.status !== SpyStatus.COUNTER_DUTY || agent.locationCityId !== cityId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cityDefense', cityKey, 'stationAgentId'],
          message: '反间驻守记录必须与特工状态及所在城市一致',
        });
      }
      if (stationedAgents.has(agent.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cityDefense', cityKey, 'stationAgentId'],
          message: '同一特工不能同时驻守多座城市',
        });
      }
      stationedAgents.set(agent.id, cityId);
    }

    for (const agent of Object.values(intel.agents)) {
      if (agent.status === SpyStatus.COUNTER_DUTY && !stationedAgents.has(agent.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['agents', agent.id, 'status'],
          message: '反间执勤特工必须有对应的城市驻守记录',
        });
      }
    }
  });

type GameStateIntelSlice = Pick<GameState, 'intel'>;

export const GameStateIntelSchema: z.ZodType<GameStateIntelSlice> = z
  .object({ intel: IntelStateRuntimeSchema })
  .strict();

export type GameStateIntel = z.infer<typeof GameStateIntelSchema>;
