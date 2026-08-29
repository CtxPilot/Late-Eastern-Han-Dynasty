// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * GameState 差分补丁（P2-4 · Session 416，关闭 D-0B-1 客户端增量化第一步）。
 *
 * worker 侧以 P2-1 的 copy-on-write 身份为基础做**条目级差分**：
 *   映射型集合（officers/cities/factions…）中未变的条目保持同一引用 → 只有变化的条目进入补丁；
 *   数组/标量等按顶层整体替换。client 侧 `applyGamePatch` 把补丁合并到上一帧状态，
 *   合并结果与「直接整态替换」在内容上逐字段一致（有测试断言）。
 *
 * 边界：仅覆盖 endTurn（最重的月度动作）；顶层键删除不表示（endTurn 不删除顶层键）。
 */

export interface GamePatch {
  __k: 'leh-game-patch-v1';
  /** 顶层整体替换 */
  set: Record<string, unknown>;
  /** 映射型集合条目级合并（仅变化的条目） */
  merge: Record<string, Record<string, unknown>>;
}

export interface GamePatchEnvelope {
  __gamePatch: GamePatch;
}

export function isGamePatchEnvelope(v: unknown): v is GamePatchEnvelope {
  if (typeof v !== 'object' || v === null || !('__gamePatch' in v)) return false;
  return (v as { __gamePatch?: { __k?: unknown } }).__gamePatch?.__k === 'leh-game-patch-v1';
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 权威侧：基于 COW 引用身份计算两帧之间的条目级补丁（零 RNG、零语义）。 */
export function computeGamePatch(prev: unknown, next: unknown): GamePatch {
  const set: Record<string, unknown> = {};
  const merge: Record<string, Record<string, unknown>> = {};
  const p = isPlainObject(prev) ? prev : {};
  const n = isPlainObject(next) ? next : {};
  for (const key of Object.keys(n)) {
    const a = p[key];
    const b = n[key];
    if (a === b) continue;
    if (isPlainObject(a) && isPlainObject(b)) {
      const entries: Record<string, unknown> = {};
      let changed = false;
      for (const [k, v] of Object.entries(b)) {
        if (a[k] === v) continue;
        entries[k] = v;
        changed = true;
      }
      for (const k of Object.keys(a)) {
        if (!(k in b)) {
          entries[k] = undefined;
          changed = true;
        }
      }
      if (changed) merge[key] = entries;
    } else {
      set[key] = b;
    }
  }
  return { __k: 'leh-game-patch-v1', set, merge };
}

/** 客户端侧：把补丁合并进上一帧，产出与整态替换内容一致的新状态对象。 */
export function applyGamePatch(base: unknown, patch: GamePatch): unknown {
  const merged: Record<string, unknown> = { ...(isPlainObject(base) ? base : {}) };
  for (const [key, val] of Object.entries(patch.set)) merged[key] = val;
  for (const [key, entries] of Object.entries(patch.merge)) {
    const target = { ...(isPlainObject(merged[key]) ? merged[key] : {}) };
    for (const [k, v] of Object.entries(entries)) {
      if (v === undefined) delete target[k];
      else target[k] = v;
    }
    merged[key] = target;
  }
  return merged;
}
