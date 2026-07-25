// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 霸府/称王/称帝主线纯函数（docs/26，HC-P0~P2）。
 * 本轮（HC-P0-1）只提供"控制汉献帝"判定，后续阶段（开霸府/称王/称帝转移）留 HC-P0-3+。
 */
import type { GameState } from './types/game.js';

/**
 * 判定某势力是否当前控制汉献帝（docs/26 Q1 方案A）。
 *
 * 规则：emperorLocation 指向汉帝所在城池 id；占领该城池的势力即视为控制汉帝。
 * - emperorLocation 为 null/undefined（未迎奉或旧存档降级）→ 无人控制，返回 false
 * - emperorLocation 指向的城池不存在或无主（ruler=null）→ 无人控制，返回 false
 * - 否则返回 state.cities[emperorLocation].ruler === factionId
 *
 * 城池易主时 emperorLocation 本身不变（汉帝本人还在原地，只是换了占领者），
 * 因此本函数会随城池归属变化动态返回不同结果，无需改字段。
 */
export function controlsEmperor(state: GameState, factionId: number): boolean {
  const loc = state.emperorLocation;
  if (loc == null) return false;
  const city = state.cities[loc];
  if (!city) return false;
  return city.ruler === factionId;
}