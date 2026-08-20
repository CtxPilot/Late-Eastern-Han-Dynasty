// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { BattleUnit } from '@leh/shared';

/**
 * BattleView 的可操作部队边界必须与六角引擎一致：撤退部队保留快照，
 * 但不再参与地图选择、目标标记、包围派生或任何玩家动作。
 */
export function isActiveTacticalUnit(unit: BattleUnit): boolean {
  return !unit.isDestroyed && !unit.isRetreated && unit.troopCount > 0;
}

/** 结束态仍可展示未被击破的撤退部队，便于玩家看到残部回流前的兵力快照。 */
export function isBattleSideCardUnit(unit: BattleUnit): boolean {
  return !unit.isDestroyed && unit.troopCount > 0;
}
