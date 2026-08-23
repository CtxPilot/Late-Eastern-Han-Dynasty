// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { BattleUnit } from '@leh/shared';
import { computeVisibleEnemyUnitIds } from '@leh/shared';
import type { BattleState } from '@leh/shared';

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

/**
 * 战术视野（S10，Session 378）：玩家侧（攻方视角）计算视野内敌军 id 集。
 * 敌军 AI 全知不受影响；服务端权威态不改写——这是纯 UI 投影边界。
 */
export function visibleEnemyIdsForPlayer(battle: BattleState): Set<string> {
  return computeVisibleEnemyUnitIds(battle, 'attacker');
}

/**
 * 在活跃部队基础上叠加视野投影：视野外的守方单位不参与地图渲染、
 * 点击选择、可攻击红标记等一切玩家交互（如同不存在）。
 */
export function filterVisibleTacticalUnits(
  units: BattleUnit[],
  visibleEnemyIds: ReadonlySet<string>,
): BattleUnit[] {
  return units.filter(
    (unit) => isActiveTacticalUnit(unit) && (unit.side !== 'defender' || visibleEnemyIds.has(unit.id)),
  );
}
