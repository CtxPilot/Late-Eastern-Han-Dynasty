// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import type { City, Faction } from '@leh/shared';
import {
  computeConvexHull,
  generateCircleBuffer,
  generateCapsuleBuffer,
  expandPolygon,
  deriveFactionTerritories,
} from './mapTerritory';

describe('mapTerritory - S20-W3 Graham Scan Convex Hull & Territory Polygons', () => {
  it('handles empty, single, and double points correctly in convex hull', () => {
    expect(computeConvexHull([])).toEqual([]);

    const single = [{ x: 100, y: 100 }];
    expect(computeConvexHull(single)).toEqual(single);

    const pair = [
      { x: 10, y: 10 },
      { x: 50, y: 50 },
    ];
    expect(computeConvexHull(pair)).toEqual(pair);

    // 重复坐标自动去重
    const dups = [
      { x: 20, y: 20 },
      { x: 20, y: 20 },
    ];
    expect(computeConvexHull(dups)).toEqual([{ x: 20, y: 20 }]);
  });

  it('computes minimal convex hull for square and interior points', () => {
    const squareWithInterior = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 50, y: 50 }, // 内部点，不应在凸包上
      { x: 30, y: 40 }, // 内部点
    ];

    const hull = computeConvexHull(squareWithInterior);
    expect(hull.length).toBe(4);
    // 包含 4 个极值顶点
    const hullSet = new Set(hull.map((p) => `${p.x},${p.y}`));
    expect(hullSet.has('0,0')).toBe(true);
    expect(hullSet.has('100,0')).toBe(true);
    expect(hullSet.has('100,100')).toBe(true);
    expect(hullSet.has('0,100')).toBe(true);
    expect(hullSet.has('50,50')).toBe(false);
  });

  it('generates 12-gon circular buffer for single-city faction', () => {
    const center = { x: 200, y: 300 };
    const radius = 40;
    const buffer = generateCircleBuffer(center, radius);

    expect(buffer.length).toBe(12);
    // 所有点距中心距离应接近 radius
    for (const p of buffer) {
      const dist = Math.sqrt((p.x - center.x) ** 2 + (p.y - center.y) ** 2);
      expect(Math.abs(dist - radius)).toBeLessThanOrEqual(1.5);
    }
  });

  it('generates capsule corridor buffer for two-city faction', () => {
    const p1 = { x: 100, y: 100 };
    const p2 = { x: 300, y: 100 };
    const radius = 30;
    const capsule = generateCapsuleBuffer(p1, p2, radius);

    expect(capsule.length).toBeGreaterThan(10);
    // 检查包围盒覆盖两城
    const xs = capsule.map((p) => p.x);
    const ys = capsule.map((p) => p.y);
    expect(Math.min(...xs)).toBeLessThanOrEqual(p1.x - radius + 2);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(p2.x + radius - 2);
    expect(Math.min(...ys)).toBeLessThanOrEqual(100 - radius + 2);
    expect(Math.max(...ys)).toBeGreaterThanOrEqual(100 + radius - 2);
  });

  it('expands polygon outwards from centroid by padding', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 60, y: 0 },
      { x: 30, y: 60 },
    ];
    const expanded = expandPolygon(triangle, 20);
    expect(expanded.length).toBe(3);

    // 外扩后点离中心的距离必须大于原点离中心的距离
    const cx = 30;
    const cy = 20;
    for (let i = 0; i < 3; i++) {
      const origDist = Math.hypot(triangle[i].x - cx, triangle[i].y - cy);
      const newDist = Math.hypot(expanded[i].x - cx, expanded[i].y - cy);
      expect(newDist).toBeGreaterThan(origDist);
    }
  });

  it('derives faction territories with single, double and multi-city factions', () => {
    const mockFactions: Record<number, Faction> = {
      1: {
        id: 1,
        name: '曹操',
        color: '#3b82f6',
        leaderId: 1,
        cities: [1, 2, 3, 4],
      } as unknown as Faction,
      2: {
        id: 2,
        name: '刘备',
        color: '#10b981',
        leaderId: 2,
        cities: [5],
      } as unknown as Faction,
      3: {
        id: 3,
        name: '孙权',
        color: '#ef4444',
        leaderId: 3,
        cities: [6, 7],
      } as unknown as Faction,
    };

    const mockCities: Record<number, City> = {
      1: { id: 1, name: '许昌', x: 200, y: 200, ruler: 1 } as City,
      2: { id: 2, name: '陈留', x: 260, y: 190, ruler: 1 } as City,
      3: { id: 3, name: '洛阳', x: 150, y: 180, ruler: 1 } as City,
      4: { id: 4, name: '宛城', x: 170, y: 260, ruler: 1 } as City,
      5: { id: 5, name: '新野', x: 180, y: 320, ruler: 2 } as City,
      6: { id: 6, name: '建业', x: 400, y: 350, ruler: 3 } as City,
      7: { id: 7, name: '吴郡', x: 460, y: 380, ruler: 3 } as City,
    };

    const territories = deriveFactionTerritories(mockCities, mockFactions, 30);
    expect(territories.length).toBe(3);

    const cao = territories.find((t) => t.factionId === 1);
    expect(cao).toBeDefined();
    expect(cao?.cityCount).toBe(4);
    expect(cao?.color).toBe('#3b82f6');
    expect(cao?.points.length).toBeGreaterThanOrEqual(6);

    const liu = territories.find((t) => t.factionId === 2);
    expect(liu).toBeDefined();
    expect(liu?.cityCount).toBe(1);
    expect(liu?.color).toBe('#10b981');
    expect(liu?.points.length).toBe(24); // 12-gon * 2

    const sun = territories.find((t) => t.factionId === 3);
    expect(sun).toBeDefined();
    expect(sun?.cityCount).toBe(2);
    expect(sun?.color).toBe('#ef4444');
  });

  it('filters out fog-shrouded unrevealed cities when visibleCityIds is provided', () => {
    const mockFactions: Record<number, Faction> = {
      1: { id: 1, name: '曹操', color: '#3b82f6', cities: [1, 2, 3] } as unknown as Faction,
    };
    const mockCities: Record<number, City> = {
      1: { id: 1, name: '许昌', x: 200, y: 200, ruler: 1 } as City,
      2: { id: 2, name: '陈留', x: 260, y: 190, ruler: 1 } as City,
      3: { id: 3, name: '洛阳', x: 150, y: 180, ruler: 1 } as City, // 迷雾城
    };

    // 洛阳处于迷雾中，可见白名单仅 1, 2
    const territories = deriveFactionTerritories(mockCities, mockFactions, 30, [1, 2]);
    expect(territories.length).toBe(1);
    expect(territories[0].cityCount).toBe(2); // 仅纳入 2 城做胶囊缓冲
  });
});
