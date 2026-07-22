// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { SerializableRng } from './rng.js';

describe('SerializableRng', () => {
  it('continues with exactly the same sequence after restoring its internal state', () => {
    const live = new SerializableRng(0x12345678);
    Array.from({ length: 7 }, () => live.next());
    const saved = live.snapshot();
    const expected = Array.from({ length: 12 }, () => live.next());

    const restored = new SerializableRng(saved);
    expect(Array.from({ length: 12 }, () => restored.next())).toEqual(expected);
    expect(restored.snapshot().draws).toBe(saved.draws + 12);
  });

  it('normalizes a zero seed so the xorshift stream cannot become permanently zero', () => {
    const rng = new SerializableRng(0);
    expect(rng.snapshot().state).not.toBe(0);
    expect(rng.next()).toBeGreaterThan(0);
  });

  it('rejects invalid serialized generator state', () => {
    expect(() => new SerializableRng({ algorithm: 'xorshift32-v1', state: 0, draws: 0 })).toThrow();
    expect(() => new SerializableRng({ algorithm: 'xorshift32-v1', state: 1, draws: -1 })).toThrow();
  });
});
