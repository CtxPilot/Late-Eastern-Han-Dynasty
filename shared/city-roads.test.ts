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

  it('all edges are valid city IDs (1-30)', () => {
    for (const [a, b] of CITY_ROAD_EDGES) {
      expect(a).toBeGreaterThanOrEqual(1);
      expect(a).toBeLessThanOrEqual(30);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(30);
      expect(a).not.toBe(b);
    }
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
