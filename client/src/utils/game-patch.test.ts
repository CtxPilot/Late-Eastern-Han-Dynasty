// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { applyGamePatch, computeGamePatch, isGamePatchEnvelope } from './game-patch';

// P2-4（Session 415）差分补丁单测：COW 身份差分 + 客户端合并的往返一致性。

const prev = {
  currentYear: 190,
  currentMonth: 1,
  actionLog: [{ year: 190, month: 1, type: 'end_turn', message: 'a' }],
  officers: {
    1: { id: 1, name: '曹操', stamina: 90 },
    2: { id: 2, name: '夏侯惇', stamina: 80 },
    3: { id: 3, name: '荀彧', stamina: 70 },
  },
  cities: { 14: { id: 14, name: '洛阳', troops: 5000 } },
};

const next = {
  currentYear: 190,
  currentMonth: 2,
  actionLog: [{ year: 190, month: 2, type: 'end_turn', message: 'b' }],
  officers: {
    1: { id: 1, name: '曹操', stamina: 95 }, // 体力恢复 → 变化
    2: prev.officers[2], // 引用共享（未变）
    3: prev.officers[3], // 引用共享（未变）
    4: { id: 4, name: '新武将', stamina: 50 }, // 新增
  },
  cities: prev.cities, // 引用共享
};

describe('game-patch（P2-4 差分补丁）', () => {
  it('仅变化的顶层键与条目进入补丁', () => {
    const patch = computeGamePatch(prev, next);
    expect(patch.set.currentMonth).toBe(2);
    expect(patch.set.officers).toBeUndefined(); // 映射型走 merge
    expect(Object.keys(patch.merge.officers ?? {}).sort()).toEqual(['1', '4']);
    expect(patch.merge.cities).toBeUndefined();
  });

  it('apply(compute(prev,next)) 与 next 逐字段一致', () => {
    const merged = applyGamePatch(prev, computeGamePatch(prev, next)) as typeof next;
    expect(merged.currentMonth).toBe(next.currentMonth);
    expect(merged.actionLog).toEqual(next.actionLog);
    expect(merged.officers).toEqual(next.officers);
    expect(merged.cities).toEqual(next.cities);
  });

  it('未变条目保持引用共享（增量化本体）', () => {
    const merged = applyGamePatch(prev, computeGamePatch(prev, next)) as typeof next;
    expect(merged.officers[2]).toBe(next.officers[2]);
    expect(merged.cities).toBe(next.cities);
  });

  it('条目删除以显式 undefined 表示，合并后 JSON 等价', () => {
    const nextDeleted = { ...prev, officers: { 1: prev.officers[1] } };
    const patch = computeGamePatch(prev, nextDeleted);
    const merged = applyGamePatch(prev, patch) as typeof nextDeleted;
    expect(Object.keys(merged.officers).sort()).toEqual(['1']);
    expect(JSON.parse(JSON.stringify(merged))).toEqual(JSON.parse(JSON.stringify(nextDeleted)));
  });

  it('isGamePatchEnvelope 只认补丁信封', () => {
    expect(isGamePatchEnvelope({ __gamePatch: { __k: 'leh-game-patch-v1', set: {}, merge: {} } })).toBe(true);
    expect(isGamePatchEnvelope({ currentYear: 190 })).toBe(false);
  });
});
