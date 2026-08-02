// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  type SaveEnvelopeV1,
} from './types/save.js';
import { GameStateSchema, type PersistedGameState } from './game-state-full-schema.js';
import { SAVE_RNG_ALGORITHM } from './rng.js';

const SerializableRngStateSchema = z.object({
  algorithm: z.literal(SAVE_RNG_ALGORITHM),
  state: z.number().int().min(1).max(0xffff_ffff),
  draws: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).strict();

const SaveEnvelopeMetadataV1Schema = z
  .object({
    schemaVersion: z.literal(CURRENT_SAVE_SCHEMA_VERSION),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
    scenarioId: z.number().int().positive(),
    rng: SerializableRngStateSchema,
    snapshot: z.unknown(),
  })
  .strict();

export class UnsupportedSaveVersionError extends Error {
  readonly version: unknown;

  constructor(version: unknown) {
    super(`不支持的存档版本: ${String(version)}`);
    this.name = 'UnsupportedSaveVersionError';
    this.version = version;
  }
}

function readSaveSchemaVersion(input: unknown): unknown {
  return typeof input === 'object' && input !== null && 'schemaVersion' in input
    ? (input as { schemaVersion?: unknown }).schemaVersion
    : undefined;
}

const LEGACY_NOBILITY_RANK_MAP = {
  none: 'none',
  marquis: 'xianMarquis',
  duke: 'duke',
  prince: 'king',
  king: 'emperor',
} as const;

/**
 * K6 方案 A：v1 早期存档曾使用五级字符串枚举。由于存档版本仍为 v1，
 * 在严格 GameState 校验前做幂等字段迁移；新七级值原样保留。
 */
function migrateLegacyNobilityRanks(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const envelope = input as { snapshot?: unknown };
  if (typeof envelope.snapshot !== 'object' || envelope.snapshot === null) return input;
  const snapshot = envelope.snapshot as { officers?: unknown };
  if (typeof snapshot.officers !== 'object' || snapshot.officers === null) return input;

  let changed = false;
  const officers = Object.fromEntries(
    Object.entries(snapshot.officers).map(([id, value]) => {
      if (typeof value !== 'object' || value === null) return [id, value];
      const officer = value as { nobilityRank?: unknown };
      const mapped =
        typeof officer.nobilityRank === 'string'
          ? LEGACY_NOBILITY_RANK_MAP[
              officer.nobilityRank as keyof typeof LEGACY_NOBILITY_RANK_MAP
            ]
          : undefined;
      if (!mapped || mapped === officer.nobilityRank) return [id, value];
      changed = true;
      return [id, { ...officer, nobilityRank: mapped }];
    }),
  );
  if (!changed) return input;
  return { ...envelope, snapshot: { ...snapshot, officers } };
}

/** R7：v1 早期 S09 使用 beauty* 字段；加载时幂等改名并删除旧键。 */
function migrateLegacyCourtNetworkFields(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const envelope = input as { snapshot?: unknown };
  if (typeof envelope.snapshot !== 'object' || envelope.snapshot === null) return input;
  const snapshot = envelope.snapshot as { cities?: unknown; factions?: unknown };
  let changed = false;

  const cities =
    typeof snapshot.cities === 'object' && snapshot.cities !== null
      ? Object.fromEntries(Object.entries(snapshot.cities).map(([id, value]) => {
          if (typeof value !== 'object' || value === null) return [id, value];
          const city = value as Record<string, unknown>;
          if (!('beautySeekLeft' in city) && !('beautyPool' in city)) return [id, value];
          const {
            beautySeekLeft,
            beautyPool,
            ...rest
          } = city;
          changed = true;
          return [id, {
            ...rest,
            courtNetworkOpportunities:
              typeof city.courtNetworkOpportunities === 'number'
                ? city.courtNetworkOpportunities
                : typeof beautySeekLeft === 'number'
                  ? beautySeekLeft
                  : typeof beautyPool === 'number'
                    ? beautyPool
                    : 0,
          }];
        }))
      : snapshot.cities;

  const factions =
    typeof snapshot.factions === 'object' && snapshot.factions !== null
      ? Object.fromEntries(Object.entries(snapshot.factions).map(([id, value]) => {
          if (typeof value !== 'object' || value === null) return [id, value];
          const faction = value as Record<string, unknown>;
          if (!('beautyStock' in faction)) return [id, value];
          const { beautyStock, ...rest } = faction;
          changed = true;
          return [id, {
            ...rest,
            courtNetwork:
              typeof faction.courtNetwork === 'number'
                ? faction.courtNetwork
                : typeof beautyStock === 'number'
                  ? beautyStock
                  : 0,
          }];
        }))
      : snapshot.factions;

  return changed
    ? { ...envelope, snapshot: { ...snapshot, cities, factions } }
    : input;
}

/**
 * 合规迁移：具名女性赠与/随侍机制已退役。
 * v1 版本号不变，读取时幂等清空旧 Officer.beauties 与 Female.giftedToOfficerId，
 * 防止旧存档在运行时重新激活已删除语义。
 */
function migrateRetiredNamedFemaleGifts(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const envelope = input as { snapshot?: unknown };
  if (typeof envelope.snapshot !== 'object' || envelope.snapshot === null) return input;
  const snapshot = envelope.snapshot as { officers?: unknown; females?: unknown };
  let changed = false;

  const officers = typeof snapshot.officers === 'object' && snapshot.officers !== null
    ? Object.fromEntries(Object.entries(snapshot.officers).map(([id, value]) => {
        if (typeof value !== 'object' || value === null) return [id, value];
        const officer = value as Record<string, unknown>;
        if (!Array.isArray(officer.beauties) || officer.beauties.length === 0) return [id, value];
        changed = true;
        return [id, { ...officer, beauties: [] }];
      }))
    : snapshot.officers;

  const females = typeof snapshot.females === 'object' && snapshot.females !== null
    ? Object.fromEntries(Object.entries(snapshot.females).map(([id, value]) => {
        if (typeof value !== 'object' || value === null) return [id, value];
        const female = value as Record<string, unknown>;
        if (female.giftedToOfficerId == null) return [id, value];
        changed = true;
        return [id, { ...female, giftedToOfficerId: null }];
      }))
    : snapshot.females;

  return changed
    ? { ...envelope, snapshot: { ...snapshot, officers, females } }
    : input;
}

/**
 * 将任意已解析的存档信封分派到当前版本。
 *
 * 当前首个持久化版本就是 v1，因此 v1 分支是显式恒等迁移。未来增加 v2 时，
 * 必须在这里登记 v1 -> v2 的逐版本迁移，禁止猜测或静默接收未知版本。
 */
export function migrateSaveEnvelopeToCurrent(input: unknown): unknown {
  const version = readSaveSchemaVersion(input);

  switch (version) {
    case CURRENT_SAVE_SCHEMA_VERSION:
      return migrateRetiredNamedFemaleGifts(
        migrateLegacyCourtNetworkFields(migrateLegacyNobilityRanks(input)),
      );
    default:
      throw new UnsupportedSaveVersionError(version);
  }
}

/**
 * 解析 v1 存档信封，并强制使用调用方提供的 Schema 校验快照。
 * 当前仓库尚无完整 GameState Zod Schema，因此不得用 z.unknown() 作为生产读取器。
 */
export function parseSaveEnvelopeV1<TSnapshot>(
  input: unknown,
  snapshotSchema: z.ZodType<TSnapshot>,
): SaveEnvelopeV1<TSnapshot> {
  const version = readSaveSchemaVersion(input);

  if (version !== CURRENT_SAVE_SCHEMA_VERSION) {
    throw new UnsupportedSaveVersionError(version);
  }

  const envelope = SaveEnvelopeMetadataV1Schema.parse(input);
  return {
    ...envelope,
    snapshot: snapshotSchema.parse(envelope.snapshot),
  };
}

/**
 * 当前版本的加载前持久化边界：版本分派后，严格校验 v1 信封和完整 GameState。
 * 本函数不读取磁盘、不恢复连接/动画等瞬态上下文，也不代表生产读档已实现。
 */
export function parseCurrentSaveEnvelope(
  input: unknown,
): SaveEnvelopeV1<PersistedGameState> {
  const migrated = migrateSaveEnvelopeToCurrent(input);
  const envelope = parseSaveEnvelopeV1(migrated, GameStateSchema);
  if (envelope.scenarioId !== envelope.snapshot.scenarioId) {
    throw new Error(
      `存档信封与快照的剧本 ID 不一致: ${envelope.scenarioId} !== ${envelope.snapshot.scenarioId}`,
    );
  }
  return envelope;
}
