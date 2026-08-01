// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 功绩统一发放（服务端引擎层，Session 262）
 *
 * 与 `shared/merit.ts` 的纯函数 `grantMerit(officer, amount)` 配套：
 * - `grantMerit` 只负责数值累加与三字段同步（无势力上下文）；
 * - `grantMeritTo` 是引擎内发放的唯一入口，补齐「武将存在性」与
 *   「君主不发放」两道守卫（君主特例见 docs/04 §6.5），避免各调用点重复判断。
 *
 * 确定性：不消耗任何 RNG；数值由调用点以固定值传入（不摇范围），
 * 保证现有 verify-civil-rng 等断言「即时动作各消费一次权威随机数」不被破坏。
 */
import { grantMerit, type GameState } from '@leh/shared';

/**
 * 给指定武将发放功绩并同步三字段。
 * - 武将不存在 / 无势力 / 是君主 → 原样返回 state（不发放、不抛错）；
 * - 否则返回 officers 已更新的新 state。
 */
export function grantMeritTo(
  state: GameState,
  officerId: number,
  amount: number,
): GameState {
  const officer = state.officers[officerId];
  if (!officer || officer.faction == null) return state;
  const rulerId = state.factions[officer.faction]?.rulerId;
  if (rulerId === officerId) return state; // 君主不发功绩（docs/04 §6.5）
  return {
    ...state,
    officers: {
      ...state.officers,
      [officerId]: grantMerit(officer, amount),
    },
  };
}
