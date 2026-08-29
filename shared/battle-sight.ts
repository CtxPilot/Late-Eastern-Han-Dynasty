// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 六角战术视野（S10，Session 378）。
 *
 * 数值真源：docs/08-data-dictionary.md §三十。
 * - 基线视野 4 格（六角距离，含自身所在格邻域）
 * - 观察者所在格地形修正：山地 +1 / 森林 −1，其余 0
 * - 天气修正：雾 −2（与射程修正同源）/ 雪 −3（05 §3.1「地势可见范围−3」）
 * - 下限夹紧 1 格
 *
 * P1-4（Session 412）起敌军 AI 目标选择同样消费本投影（半知化，`server/src/battle/simpleAi.ts`）——
 * 双方对称；服务端权威态不改写、攻击门禁不加视野校验（单机自约束）。
 */
import { TerrainType, Weather, type BattleState, type BattleUnit } from './index.js';

/** 单位基础视野格数（08 §三十）。 */
export const BASE_SIGHT_RANGE = 4;

const TERRAIN_SIGHT_MOD: Record<TerrainType, number> = {
  [TerrainType.PLAIN]: 0,
  [TerrainType.FOREST]: -1,
  [TerrainType.MOUNTAIN]: 1,
  [TerrainType.WATER]: 0,
  [TerrainType.WALL]: 0,
  [TerrainType.CITY]: 0,
  [TerrainType.SWAMP]: 0,
};

function weatherSightMod(weather: Weather): number {
  if (weather === Weather.FOG) return -2;
  if (weather === Weather.SNOW) return -3;
  return 0;
}

/** 观察者有效视野 = max(1, 基线 + 所在格地形修正 + 天气修正)。 */
export function effectiveSightRange(terrain: TerrainType, weather: Weather): number {
  return Math.max(1, BASE_SIGHT_RANGE + (TERRAIN_SIGHT_MOD[terrain] ?? 0) + weatherSightMod(weather));
}

/** 六角距离（轴向坐标，与客户端/寻路同式）。 */
export function hexDistance(a: { q: number; r: number }, b: { q: number; r: number }): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

function isActiveObserver(unit: BattleUnit): boolean {
  return !unit.isDestroyed && !unit.isRetreated && unit.troopCount > 0;
}

/**
 * 计算 playerSide 一方能看到的敌方活跃单位 id 集合：
 * 敌军与任一存活我方单位的六角距离 ≤ 该观察者有效视野即可见。
 */
export function computeVisibleEnemyUnitIds(
  battle: Pick<BattleState, 'units' | 'hexGrid' | 'weather'>,
  playerSide: 'attacker' | 'defender',
): Set<string> {
  const observers = battle.units.filter(
    (u) => u.side === playerSide && isActiveObserver(u),
  );
  const visible = new Set<string>();
  for (const enemy of battle.units) {
    if (enemy.side === playerSide || !isActiveObserver(enemy)) continue;
    for (const observer of observers) {
      const terrain = battle.hexGrid.terrain[observer.position.r]?.[observer.position.q] ?? TerrainType.PLAIN;
      if (hexDistance(observer.position, enemy.position) <= effectiveSightRange(terrain, battle.weather)) {
        visible.add(enemy.id);
        break;
      }
    }
  }
  return visible;
}
