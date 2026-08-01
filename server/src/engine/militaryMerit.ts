// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 军事功绩公共模块（Session 263，docs/04 §6.1 军事条目）
 *
 * - `pickDefenderCommander`：统一"守方主将"定义——守方城内武力最高 ACTIVE 武将
 *   （与 campaign.ts `runAutoBattle` 守将选择口径一致；march.ts 与 campaign.ts 共用）。
 * - 军事功绩数值常量（固定值，不消耗权威 RNG；数值取 6.1 文档条目，待平衡）。
 *
 * 发放统一经 `grantMeritTo`（`./meritGrant.js`：武将存在性 + 君主不发）。
 */
import { OfficerStatus, type City, type GameState, type Officer } from '@leh/shared';

/** 破城（攻方主将，march/campaign 占城结算） */
export const MERIT_CAPTURE_CITY = 30;
/** 守城（守方主将，守方击退攻方） */
export const MERIT_DEFEND_CITY = 8;
/** 灭国（占城导致目标势力覆灭，攻方主将） */
export const MERIT_ANNIHILATE_FACTION = 50;
/** 野战击破敌方主力（守方溃散 30% 线，攻方主将，Session 264） */
export const MERIT_FIELD_ANNIHILATE = 20;
/** 野战险胜击退（守方未溃散，回合上限小胜）或守方击退来敌（Session 264） */
export const MERIT_FIELD_ROUT = 10;

/** 守方主将：城内 `rulerFaction` 方武力最高 ACTIVE 武将（无则 undefined）。 */
export function pickDefenderCommander(
  state: GameState,
  city: City,
  rulerFaction: number,
): Officer | undefined {
  const candidates = city.officers
    .map((id) => state.officers[id])
    .filter(
      (o): o is Officer =>
        !!o && o.faction === rulerFaction && o.status === OfficerStatus.ACTIVE,
    );
  candidates.sort((a, b) => b.stats.war - a.stats.war);
  return candidates[0];
}
