// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  CITY_ROAD_EDGES,
  roadNeighbors,
  areCitiesRoadAdjacent,
  canAttemptMarchTo,
  canMarchAlongRoad,
  playerCitiesAdjacentTo,
  allRoadEdges,
} from './city-roads';

describe('CITY_ROAD_EDGES', () => {
  it('has at least 30 edges for 30 cities', () => {
    expect(CITY_ROAD_EDGES.length).toBeGreaterThanOrEqual(30);
  });

  it('all edges are valid city IDs (1-106, 0-B 106 城)', () => {
    for (const [a, b] of CITY_ROAD_EDGES) {
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(106);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(106);
      expect(a).not.toBe(b);
    }
  });

  it('covers every city 1..106 with at least one road (0-B 扩容)', () => {
    const seen = new Set<number>();
    for (const [a, b] of CITY_ROAD_EDGES) {
      seen.add(a);
      seen.add(b);
    }
    for (let id = 1; id <= 106; id++) expect(seen.has(id)).toBe(true);
  });

  it('the road network is fully connected (single component)', () => {
    const adj = new Map<number, Set<number>>();
    for (const [a, b] of CITY_ROAD_EDGES) {
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
    }
    const visited = new Set<number>([1]);
    const queue = [1];
    while (queue.length > 0) {
      const cur = queue.pop()!;
      for (const next of adj.get(cur) ?? []) {
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    expect(visited.size).toBe(106);
  });

  it('has no duplicate edges', () => {
    const seen = new Set<string>();
    for (const [a, b] of CITY_ROAD_EDGES) {
      const key = [a, b].sort().join('-');
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('洛阳(1) connects to major cities', () => {
    const neighbors = roadNeighbors(1);
    expect(neighbors).toContain(2); // 长安
    expect(neighbors).toContain(7); // 陈留
    expect(neighbors).toContain(13); // 宛
  });

  it('成都(19) connects to 汉中(20) and 江州(21)', () => {
    const neighbors = roadNeighbors(19);
    expect(neighbors).toContain(20);
    expect(neighbors).toContain(21);
  });
});

describe('roadNeighbors', () => {
  it('returns empty array for unknown city', () => {
    expect(roadNeighbors(999)).toEqual([]);
  });

  it('is symmetric', () => {
    for (const [a, b] of CITY_ROAD_EDGES) {
      expect(roadNeighbors(a)).toContain(b);
      expect(roadNeighbors(b)).toContain(a);
    }
  });
});

describe('areCitiesRoadAdjacent', () => {
  it('returns true for connected cities', () => {
    expect(areCitiesRoadAdjacent(1, 2)).toBe(true);
    expect(areCitiesRoadAdjacent(2, 1)).toBe(true);
  });

  it('returns false for non-connected cities', () => {
    expect(areCitiesRoadAdjacent(1, 30)).toBe(false);
  });

  it('returns false for same city', () => {
    expect(areCitiesRoadAdjacent(1, 1)).toBe(false);
  });
});

describe('canMarchAlongRoad', () => {
  it('is alias for areCitiesRoadAdjacent', () => {
    expect(canMarchAlongRoad(1, 2)).toBe(areCitiesRoadAdjacent(1, 2));
    expect(canMarchAlongRoad(1, 30)).toBe(areCitiesRoadAdjacent(1, 30));
  });
});

describe('playerCitiesAdjacentTo', () => {
  it('filters player cities adjacent to target', () => {
    const playerIds = [1, 2, 3, 7, 13];
    const adjacent = playerCitiesAdjacentTo(playerIds, 1);
    // 洛阳(1) connects to 长安(2), 阳翟(3), 陈留(7), 宛(13)
    expect(adjacent).toContain(2);
    expect(adjacent).toContain(3);
    expect(adjacent).toContain(7);
    expect(adjacent).toContain(13);
  });

  it('returns empty if no player cities adjacent', () => {
    expect(playerCitiesAdjacentTo([30], 1)).toEqual([]);
  });
});

describe('canAttemptMarchTo', () => {
  const cities = {
    13: { id: 13, ruler: null, troops: 0 },
    15: { id: 15, ruler: 2, troops: 5000 },
    19: { id: 19, ruler: 2, troops: 5000 },
  };

  it('allows a road-adjacent fog-masked target without reading hidden ownership or troops', () => {
    expect(canAttemptMarchTo(cities, 2, 13)).toBe(true);
  });

  it('still rejects a known player city and targets without an eligible adjacent source', () => {
    expect(canAttemptMarchTo(cities, 2, 15)).toBe(false);
    expect(canAttemptMarchTo(cities, 2, 1)).toBe(false);
    expect(
      canAttemptMarchTo(
        { ...cities, 15: { ...cities[15], troops: 999 } },
        2,
        13,
      ),
    ).toBe(false);
  });
});

describe('allRoadEdges', () => {
  it('returns same reference as CITY_ROAD_EDGES', () => {
    expect(allRoadEdges()).toBe(CITY_ROAD_EDGES);
  });
});
