// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  MAX_SAVE_BYTES,
  assertSaveSize,
  envelopeByteLength,
  isValidSaveSlotName,
} from './save-limits.js';

describe('save-limits（离线/在线存档单一真源）', () => {
  it('槽位名规则与服务端 SQLite 介质一致', () => {
    expect(isValidSaveSlotName('a')).toBe(true);
    expect(isValidSaveSlotName('Auto-Save_1')).toBe(true);
    expect(isValidSaveSlotName('')).toBe(false);
    expect(isValidSaveSlotName('_leading')).toBe(false);
    expect(isValidSaveSlotName('-leading')).toBe(false);
    expect(isValidSaveSlotName('a'.repeat(32))).toBe(true);
    expect(isValidSaveSlotName('a'.repeat(33))).toBe(false);
    expect(isValidSaveSlotName('含中文')).toBe(false);
    expect(isValidSaveSlotName('bad/slot')).toBe(false);
  });

  it('信封字节数按 UTF-8 计量并与上限校验联动', () => {
    expect(envelopeByteLength('{}')).toBe(2);
    expect(envelopeByteLength(JSON.stringify({ 中文: '测' }))).toBeGreaterThan(2);
    expect(() => assertSaveSize(MAX_SAVE_BYTES)).not.toThrow();
    expect(() => assertSaveSize(MAX_SAVE_BYTES + 1)).toThrow(/超过/);
  });
});
