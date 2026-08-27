// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { nanjun190 } from './data/historical-geography/nanjun-190.js';
import {
  buildCommanderyWorldGraph,
  buildJingzhouPilotGraph,
  buildMacroWorldGraph,
  cityNodeId,
  neighborsOf,
  shortestPath,
} from './world-graph.js';

const stubCities = {
  13: { id: 13, name: '宛', province: '荆州', x: 100, y: 100, isCapital: false, isPass: false },
  14: { id: 14, name: '江陵', province: '荆州', x: 120, y: 140, isCapital: true, isPass: false },
  15: { id: 15, name: '襄阳', province: '荆州', x: 110, y: 120, isCapital: false, isPass: true },
  1: { id: 1, name: '洛阳', province: '司隶', x: 50, y: 50, isCapital: true, isPass: false },
};

describe('buildMacroWorldGraph', () => {
  it('builds city nodes and major_road edges for provided cities', () => {
    const g = buildMacroWorldGraph(stubCities);
    expect(g.nodes.has(cityNodeId(13))).toBe(true);
    expect(g.nodes.get(cityNodeId(15))?.kind).toBe('pass');
    expect(g.nodes.get(cityNodeId(14))?.kind).toBe('province_capital');
    // 宛—襄阳、江陵—襄阳 在 CITY_ROAD_EDGES
    const edgeIds = g.edges.map((e) => e.id);
    expect(edgeIds).toContain('macro_13_15');
    expect(edgeIds).toContain('macro_14_15');
  });
});

describe('buildCommanderyWorldGraph', () => {
  it('projects nanjun counties and routes', () => {
    const g = buildCommanderyWorldGraph(nanjun190);
    expect(g.nodes.size).toBeGreaterThanOrEqual(nanjun190.counties.length);
    expect(g.edges.length).toBe(nanjun190.routes.length);
    const seat = nanjun190.commanderies[0]!.seatCountyId;
    expect(g.nodes.get(seat)?.kind).toBe('commandery_capital');
  });
});

describe('buildJingzhouPilotGraph', () => {
  it('unions macro Jingzhou with nanjun and bridges seat city', () => {
    const g = buildJingzhouPilotGraph(stubCities, nanjun190);
    expect(g.nodes.has(cityNodeId(14))).toBe(true);
    expect(g.nodes.has('nanjun_jiangling')).toBe(true);
    const bridge = g.edges.find((e) => e.id.startsWith('bridge_jingzhou_'));
    expect(bridge).toBeDefined();
    expect(bridge!.from).toBe(cityNodeId(14));
    expect(bridge!.to).toBe(nanjun190.commanderies[0]!.seatCountyId);
  });
});

describe('shortestPath / neighborsOf', () => {
  it('finds path宛→江陵 via 襄阳 on macro graph', () => {
    const g = buildMacroWorldGraph(stubCities);
    const path = shortestPath(g, cityNodeId(13), cityNodeId(14));
    expect(path).not.toBeNull();
    expect(path!.nodeIds).toEqual([cityNodeId(13), cityNodeId(15), cityNodeId(14)]);
    expect(path!.totalDistance).toBe(2);
  });

  it('lists neighbors', () => {
    const g = buildMacroWorldGraph(stubCities);
    const n = neighborsOf(g, cityNodeId(15));
    expect(n.sort()).toEqual([cityNodeId(13), cityNodeId(14)].sort());
  });
});

describe('planMacroCityPath equivalence', () => {
  it('matches legacy roadNeighbors BFS for all pairs among stub cities', async () => {
    const { roadNeighbors } = await import('./city-roads.js');
    const { planMacroCityPath, macroAdjacentCityIds } = await import('./world-graph.js');
    const ids = [13, 14, 15];
    for (const id of ids) {
      expect(macroAdjacentCityIds(id).sort()).toEqual(roadNeighbors(id).sort());
    }
    // legacy BFS
    function legacyPlan(fromId: number, targetId: number): number[] {
      if (fromId === targetId) return [];
      const visited = new Set<number>([fromId]);
      const queue: Array<{ id: number; path: number[] }> = [{ id: fromId, path: [] }];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const next of roadNeighbors(cur.id)) {
          if (visited.has(next)) continue;
          visited.add(next);
          const newPath = [...cur.path, next];
          if (next === targetId) return newPath;
          queue.push({ id: next, path: newPath });
        }
      }
      return [];
    }
    for (const a of ids) {
      for (const b of ids) {
        expect(planMacroCityPath(a, b)).toEqual(legacyPlan(a, b));
      }
    }
  });
});
