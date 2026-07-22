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
      return input;
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
