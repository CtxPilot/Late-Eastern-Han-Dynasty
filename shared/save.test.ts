// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { CURRENT_SAVE_SCHEMA_VERSION } from './types/save.js';
import {
  migrateSaveEnvelopeToCurrent,
  parseCurrentSaveEnvelope,
  parseSaveEnvelopeV1,
  UnsupportedSaveVersionError,
} from './save.js';

const SnapshotSchema = z.object({ turn: z.number().int().nonnegative() }).strict();

function validEnvelope() {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-22T10:00:00.000Z',
    updatedAt: '2026-07-22T10:05:00.000Z',
    scenarioId: 1,
    rng: { algorithm: 'xorshift32-v1' as const, state: 123456789, draws: 7 },
    snapshot: { turn: 3 },
  };
}

describe('parseSaveEnvelopeV1', () => {
  it('parses valid metadata and delegates snapshot validation', () => {
    expect(parseSaveEnvelopeV1(validEnvelope(), SnapshotSchema)).toEqual(validEnvelope());
  });

  it('rejects unsupported versions before parsing the snapshot', () => {
    expect(() =>
      parseSaveEnvelopeV1({ ...validEnvelope(), schemaVersion: 2 }, SnapshotSchema),
    ).toThrow(UnsupportedSaveVersionError);
  });

  it('rejects malformed timestamps and unknown envelope fields', () => {
    expect(() =>
      parseSaveEnvelopeV1({ ...validEnvelope(), createdAt: '2026/07/22' }, SnapshotSchema),
    ).toThrow();
    expect(() =>
      parseSaveEnvelopeV1({ ...validEnvelope(), runtimeSocketId: 'transient' }, SnapshotSchema),
    ).toThrow();
  });

  it('rejects a snapshot that fails the injected schema', () => {
    expect(() =>
      parseSaveEnvelopeV1({ ...validEnvelope(), snapshot: { turn: -1 } }, SnapshotSchema),
    ).toThrow();
  });

  it('rejects invalid or unknown serialized PRNG state', () => {
    expect(() => parseSaveEnvelopeV1({ ...validEnvelope(), rng: { algorithm: 'unknown', state: 1, draws: 0 } }, SnapshotSchema)).toThrow();
    expect(() => parseSaveEnvelopeV1({ ...validEnvelope(), rng: { algorithm: 'xorshift32-v1', state: 0, draws: 0 } }, SnapshotSchema)).toThrow();
  });
});

describe('current save migration dispatch', () => {
  it('dispatches the current v1 envelope through the identity migration', () => {
    const envelope = validEnvelope();
    expect(migrateSaveEnvelopeToCurrent(envelope)).toBe(envelope);
  });

  it('rejects missing, legacy, future, and non-numeric versions', () => {
    for (const schemaVersion of [undefined, 0, 2, '1']) {
      const input = schemaVersion === undefined
        ? { snapshot: { turn: 3 } }
        : { ...validEnvelope(), schemaVersion };
      expect(() => migrateSaveEnvelopeToCurrent(input)).toThrow(UnsupportedSaveVersionError);
    }
  });

  it('always validates current snapshots with the complete GameState schema', () => {
    expect(() => parseCurrentSaveEnvelope(validEnvelope())).toThrow();
  });
});
