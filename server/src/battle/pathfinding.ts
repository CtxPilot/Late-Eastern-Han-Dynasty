// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { HexCoord, TerrainType } from '@leh/shared';
import { hexKey, neighbors } from './hex.js';
import { TERRAIN_TABLE } from './terrain.js';

export function inBounds(h: HexCoord, cols: number, rows: number): boolean {
  return h.q >= 0 && h.q < cols && h.r >= 0 && h.r < rows;
}

/** BFS movement range with terrain costs (demo-proven, 05 §2.1) */
export function reachable(
  start: HexCoord,
  maxMp: number,
  cols: number,
  rows: number,
  terrainAt: (h: HexCoord) => TerrainType,
  blocked: Set<string>,
): Map<string, number> {
  const best = new Map<string, number>();
  const queue: { h: HexCoord; mp: number }[] = [{ h: start, mp: maxMp }];
  best.set(hexKey(start), maxMp);

  while (queue.length > 0) {
    queue.sort((a, b) => b.mp - a.mp);
    const cur = queue.shift()!;
    const curKey = hexKey(cur.h);
    if ((best.get(curKey) ?? -1) > cur.mp) continue;

    for (const n of neighbors(cur.h)) {
      if (!inBounds(n, cols, rows)) continue;
      const nk = hexKey(n);
      if (blocked.has(nk)) continue;
      const cost = TERRAIN_TABLE[terrainAt(n)].moveCost;
      if (cost >= 99) continue;
      const left = cur.mp - cost;
      if (left < 0) continue;
      if ((best.get(nk) ?? -1) >= left) continue;
      best.set(nk, left);
      queue.push({ h: n, mp: left });
    }
  }

  return best;
}
