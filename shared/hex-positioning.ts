// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 六角战场位置态势（S10 · FM-P5 最小切片）。
 *
 * 包围不是存档字段：每次从当前单位坐标、存活状态和朝向派生，避免快照里的
 * “被围”状态在移动、撤退或读档后过期。至少两支相邻且朝向目标的敌军，来自
 * 不同六方向时，目标才算被协同包围；单支贴身敌军仍只是白刃接战/侧击。
 */
import type { BattleUnit } from './types/battle.js';
import { directionTo, facingDelta, type HexFacing } from './melee-engagement.js';
import { tacticalHexDistance } from './tactical-grid.js';

export interface HexSurroundState {
  unitId: string;
  enemyUnitIds: string[];
  enemyDirections: HexFacing[];
  isSurrounded: boolean;
}

function isLive(unit: BattleUnit): boolean {
  return !unit.isDestroyed && !unit.isRetreated && unit.troopCount > 0;
}

function defaultFacing(unit: BattleUnit): HexFacing {
  return unit.side === 'attacker' ? 0 : 3;
}

/**
 * 派生一个单位的协同包围状态。
 * 敌军必须相邻、存活，并且朝向目标的前/侧方向（不接受背向贴邻）；同一方向
 * 的重复来源不叠加。排序保证战报、测试和重放结果稳定。
 */
export function resolveHexSurround(
  units: readonly BattleUnit[],
  unitId: string,
): HexSurroundState {
  const target = units.find((unit) => unit.id === unitId);
  if (!target) return { unitId, enemyUnitIds: [], enemyDirections: [], isSurrounded: false };

  const engaged = units
    .filter((unit) => unit.id !== target.id && unit.side !== target.side && isLive(unit))
    .filter((unit) => tacticalHexDistance(unit.position, target.position) === 1)
    .map((unit) => ({
      unit,
      direction: directionTo(target.position, unit.position),
      facingDelta: facingDelta(unit.facing ?? defaultFacing(unit), directionTo(unit.position, target.position)),
    }))
    .filter((entry) => entry.facingDelta <= 2)
    .sort((a, b) => a.direction - b.direction || a.unit.id.localeCompare(b.unit.id));

  const byDirection = new Map<HexFacing, typeof engaged[number]>();
  for (const entry of engaged) {
    if (!byDirection.has(entry.direction)) byDirection.set(entry.direction, entry);
  }
  const directional = [...byDirection.values()].sort((a, b) => a.direction - b.direction || a.unit.id.localeCompare(b.unit.id));
  return {
    unitId,
    enemyUnitIds: directional.map((entry) => entry.unit.id),
    enemyDirections: directional.map((entry) => entry.direction),
    isSurrounded: directional.length >= 2,
  };
}

export function isUnitSurrounded(units: readonly BattleUnit[], unitId: string): boolean {
  return resolveHexSurround(units, unitId).isSurrounded;
}
