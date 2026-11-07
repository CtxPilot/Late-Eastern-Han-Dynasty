// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { City, Faction } from '@leh/shared';

/**
 * S20-W3: 势力领土凸包与多边形纯函数计算引擎 (mapTerritory.ts)
 *
 * 规格：
 * - 纯数学 Graham Scan 凸包算法；
 * - 单城势力退化为圆形缓冲多边形（12 边形点集）；
 * - 双城势力退化为胶囊走廊缓冲多边形；
 * - 三城及以上计算最小凸包并向外平滑外扩缓冲边界（padding: 35px）；
 * - 支持 visibleCityIds / 迷雾过滤（未探明迷雾城不参与领土凸包计算）；
 * - 导出 points 平坦数组 [x0, y0, x1, y1, ...] 供 Konva Line closed 或 SVG polygon 直接消费。
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface FactionTerritory {
  factionId: number;
  color: string;
  points: number[];
  center: Point2D;
  cityCount: number;
}

function crossProduct(o: Point2D, a: Point2D, b: Point2D): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function distanceSq(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/**
 * Graham Scan 计算 2D 点集凸包
 */
export function computeConvexHull(points: Point2D[]): Point2D[] {
  if (points.length <= 1) return [...points];

  // 去重相同坐标点
  const uniquePoints: Point2D[] = [];
  const seen = new Set<string>();
  for (const p of points) {
    const key = `${p.x},${p.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniquePoints.push(p);
    }
  }

  if (uniquePoints.length <= 2) return [...uniquePoints];

  // 1. 寻找 y 最小（若相同则 x 最小）作为锚点
  let pivotIndex = 0;
  for (let i = 1; i < uniquePoints.length; i++) {
    if (
      uniquePoints[i].y < uniquePoints[pivotIndex].y ||
      (uniquePoints[i].y === uniquePoints[pivotIndex].y &&
        uniquePoints[i].x < uniquePoints[pivotIndex].x)
    ) {
      pivotIndex = i;
    }
  }

  const pivot = uniquePoints[pivotIndex];
  const rest = uniquePoints.filter((_, idx) => idx !== pivotIndex);

  // 2. 按相对于 pivot 的极角排序；极角相同时距离小的排在前面
  rest.sort((a, b) => {
    const cp = crossProduct(pivot, a, b);
    if (Math.abs(cp) < 1e-9) {
      return distanceSq(pivot, a) - distanceSq(pivot, b);
    }
    return cp > 0 ? -1 : 1;
  });

  const sorted = [pivot, ...rest];
  if (sorted.length <= 2) return sorted;

  // 3. 构建凸包栈
  const hull: Point2D[] = [sorted[0], sorted[1]];
  for (let i = 2; i < sorted.length; i++) {
    const p = sorted[i];
    while (hull.length >= 2) {
      const top = hull[hull.length - 1];
      const second = hull[hull.length - 2];
      if (crossProduct(second, top, p) <= 0) {
        hull.pop();
      } else {
        break;
      }
    }
    hull.push(p);
  }

  return hull;
}

/**
 * 为单城生成 12 边形圆形缓冲
 */
export function generateCircleBuffer(center: Point2D, radius: number): Point2D[] {
  const segments = 12;
  const pts: Point2D[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    pts.push({
      x: Math.round(center.x + radius * Math.cos(angle)),
      y: Math.round(center.y + radius * Math.sin(angle)),
    });
  }
  return pts;
}

/**
 * 为双城生成胶囊走廊缓冲多边形
 */
export function generateCapsuleBuffer(p1: Point2D, p2: Point2D, radius: number): Point2D[] {
  const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const perp = angle + Math.PI / 2;

  const pts: Point2D[] = [];
  const segments = 6;

  // p1 半圆
  for (let i = 0; i <= segments; i++) {
    const a = perp + (i * Math.PI) / segments;
    pts.push({
      x: Math.round(p1.x + radius * Math.cos(a)),
      y: Math.round(p1.y + radius * Math.sin(a)),
    });
  }

  // p2 半圆
  for (let i = 0; i <= segments; i++) {
    const a = perp + Math.PI + (i * Math.PI) / segments;
    pts.push({
      x: Math.round(p2.x + radius * Math.cos(a)),
      y: Math.round(p2.y + radius * Math.sin(a)),
    });
  }

  return pts;
}

/**
 * 沿几何中心向外平滑外扩多边形
 */
export function expandPolygon(polygon: Point2D[], padding: number): Point2D[] {
  if (polygon.length === 0) return [];
  const cx = polygon.reduce((s, p) => s + p.x, 0) / polygon.length;
  const cy = polygon.reduce((s, p) => s + p.y, 0) / polygon.length;

  return polygon.map((p) => {
    const vx = p.x - cx;
    const vy = p.y - cy;
    const len = Math.sqrt(vx * vx + vy * vy);
    if (len < 1e-4) return { ...p };
    return {
      x: Math.round(p.x + (vx / len) * padding),
      y: Math.round(p.y + (vy / len) * padding),
    };
  });
}

/**
 * 派生全图所有势力的领土凸包多边形
 *
 * @param cities 城池列表或字典
 * @param factions 势力列表或字典
 * @param padding 领土外扩像素缓冲（默认 35）
 * @param visibleCityIds 可选可见城池白名单（未探明迷雾城不参与凸包计算）
 */
export function deriveFactionTerritories(
  cities: Record<number, City> | City[],
  factions: Record<number, Faction> | Faction[],
  padding = 35,
  visibleCityIds?: Set<number> | number[],
): FactionTerritory[] {
  const cityList = Array.isArray(cities) ? cities : Object.values(cities);
  const factionMap = Array.isArray(factions)
    ? Object.fromEntries(factions.map((f) => [f.id, f]))
    : factions;

  const visibleSet = visibleCityIds
    ? visibleCityIds instanceof Set
      ? visibleCityIds
      : new Set(visibleCityIds)
    : null;

  // 按 ruler 分组城池，且排除未探明的迷雾城
  const factionCities: Record<number, City[]> = {};
  for (const c of cityList) {
    if (visibleSet && !visibleSet.has(c.id)) {
      continue;
    }
    if (c.ruler != null && factionMap[c.ruler]) {
      if (!factionCities[c.ruler]) {
        factionCities[c.ruler] = [];
      }
      factionCities[c.ruler].push(c);
    }
  }

  const territories: FactionTerritory[] = [];

  for (const [fIdStr, fCities] of Object.entries(factionCities)) {
    const factionId = Number(fIdStr);
    const faction = factionMap[factionId];
    if (!faction || fCities.length === 0) continue;

    let hullPoints: Point2D[];
    if (fCities.length === 1) {
      hullPoints = generateCircleBuffer({ x: fCities[0].x, y: fCities[0].y }, padding);
    } else if (fCities.length === 2) {
      hullPoints = generateCapsuleBuffer(
        { x: fCities[0].x, y: fCities[0].y },
        { x: fCities[1].x, y: fCities[1].y },
        padding,
      );
    } else {
      const rawPoints = fCities.map((c) => ({ x: c.x, y: c.y }));
      const hull = computeConvexHull(rawPoints);
      hullPoints = expandPolygon(hull, padding);
    }

    const cx = Math.round(fCities.reduce((s, c) => s + c.x, 0) / fCities.length);
    const cy = Math.round(fCities.reduce((s, c) => s + c.y, 0) / fCities.length);

    territories.push({
      factionId,
      color: faction.color,
      points: hullPoints.flatMap((p) => [p.x, p.y]),
      center: { x: cx, y: cy },
      cityCount: fCities.length,
    });
  }

  return territories;
}
