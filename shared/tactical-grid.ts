// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S10 六角战旗纯核心。
 *
 * 坐标采用 pointy-top axial(q,r)：q 向右，r 向右下；数组索引固定为
 * `cells[r][q]`。第三轴 s = -q-r 只用于距离计算，不进入存档。
 * 所有搜索均使用二叉最小堆，100×100 上界下为 O(V log V)。
 */

export interface TacticalHex { q: number; r: number }
export type TacticalTerrain = 'plain' | 'forest' | 'mountain' | 'water' | 'swamp' | 'wall' | 'city';
export type TacticalObstacle = 'building' | 'tree' | 'barricade' | 'unit';
export type TacticalMobility = 'foot' | 'cavalry' | 'naval' | 'amphibious';

export interface TacticalCell {
  terrain: TacticalTerrain;
  obstacle?: TacticalObstacle;
  /** 高程用于动画选择：相邻格绝对差 >=1 时使用 climb。 */
  elevation?: number;
}

export interface TacticalGrid {
  width: number;
  height: number;
  cells: TacticalCell[][];
}

export interface MovementProfile {
  mobility: TacticalMobility;
  /** 可选逐地形覆写；Infinity 表示不可通行。 */
  terrainCost?: Partial<Record<TacticalTerrain, number>>;
  ignoredObstacles?: TacticalObstacle[];
}

export interface PathStep {
  coord: TacticalHex;
  step: number;
  cost: number;
  spent: number;
  remaining: number;
  animation: 'walk' | 'turn' | 'climb' | 'wade';
}

export interface PathResult {
  found: boolean;
  path: PathStep[];
  totalCost: number;
  visited: number;
  reason?: 'OUT_OF_BOUNDS' | 'BLOCKED' | 'UNREACHABLE' | 'INVALID_GRID';
}

export const MAX_TACTICAL_GRID = 100;

export const BASE_TERRAIN_COST: Record<TacticalTerrain, number> = {
  plain: 1, forest: 2, mountain: 3, water: 4, swamp: 3, wall: Infinity, city: 2,
};

export const OBSTACLE_BLOCKS: Record<TacticalObstacle, boolean> = {
  building: true, tree: true, barricade: true, unit: true,
};

const DIRECTIONS: readonly TacticalHex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export const tacticalHexKey = ({ q, r }: TacticalHex): string => `${q},${r}`;

export function parseTacticalHexKey(key: string): TacticalHex {
  const [q, r] = key.split(',').map(Number);
  if (!Number.isInteger(q) || !Number.isInteger(r)) throw new Error(`INVALID_HEX_KEY:${key}`);
  return { q, r };
}

export function tacticalHexDistance(a: TacticalHex, b: TacticalHex): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function tacticalHexToPixel(hex: TacticalHex, size: number, origin = { x: 0, y: 0 }) {
  return {
    x: origin.x + size * Math.sqrt(3) * (hex.q + hex.r / 2),
    y: origin.y + size * 1.5 * hex.r,
  };
}

export function tacticalPixelToHex(x: number, y: number, size: number, origin = { x: 0, y: 0 }): TacticalHex {
  const px = (x - origin.x) / size;
  const py = (y - origin.y) / size;
  return cubeRound(Math.sqrt(3) / 3 * px - py / 3, 2 / 3 * py);
}

function cubeRound(q: number, r: number): TacticalHex {
  const s = -q - r;
  let rq = Math.round(q); let rr = Math.round(r); let rs = Math.round(s);
  const dq = Math.abs(rq - q); const dr = Math.abs(rr - r); const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

export function validateTacticalGrid(grid: TacticalGrid): void {
  if (!Number.isInteger(grid.width) || !Number.isInteger(grid.height) || grid.width < 1 || grid.height < 1 ||
      grid.width > MAX_TACTICAL_GRID || grid.height > MAX_TACTICAL_GRID || grid.cells.length !== grid.height ||
      grid.cells.some((row) => row.length !== grid.width)) {
    throw new Error('INVALID_GRID');
  }
}

export function tacticalNeighbors(hex: TacticalHex, grid: TacticalGrid): TacticalHex[] {
  return DIRECTIONS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }))
    .filter((h) => h.q >= 0 && h.r >= 0 && h.q < grid.width && h.r < grid.height);
}

/** 单一通行判定入口；寻路、范围和服务端落子必须共用，防止 UI/引擎规则漂移。 */
export function tacticalMoveCost(cell: TacticalCell, profile: MovementProfile): number {
  if (cell.obstacle && OBSTACLE_BLOCKS[cell.obstacle] && !profile.ignoredObstacles?.includes(cell.obstacle)) return Infinity;
  if (cell.terrain === 'water' && profile.mobility !== 'naval' && profile.mobility !== 'amphibious') return Infinity;
  if (cell.terrain !== 'water' && profile.mobility === 'naval') return Infinity;
  const cost = profile.terrainCost?.[cell.terrain] ?? BASE_TERRAIN_COST[cell.terrain];
  return Number.isFinite(cost) && cost > 0 ? cost : Infinity;
}

interface HeapNode { key: string; coord: TacticalHex; score: number; spent: number }
class MinHeap {
  private data: HeapNode[] = [];
  get size() { return this.data.length; }
  push(node: HeapNode) {
    this.data.push(node);
    let i = this.data.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.data[p].score <= node.score) break;
      this.data[i] = this.data[p]; i = p;
    }
    this.data[i] = node;
  }
  pop(): HeapNode | undefined {
    const root = this.data[0]; const last = this.data.pop();
    if (!root || !last || this.data.length === 0) return root;
    let i = 0;
    while (true) {
      let child = i * 2 + 1;
      if (child >= this.data.length) break;
      if (child + 1 < this.data.length && this.data[child + 1].score < this.data[child].score) child++;
      if (this.data[child].score >= last.score) break;
      this.data[i] = this.data[child]; i = child;
    }
    this.data[i] = last;
    return root;
  }
}

/** A* 最短耗费路径；启发函数使用六角距离×最小代价，保持 admissible。 */
export function findTacticalPath(grid: TacticalGrid, start: TacticalHex, goal: TacticalHex, movement: number, profile: MovementProfile): PathResult {
  try { validateTacticalGrid(grid); } catch { return { found: false, path: [], totalCost: 0, visited: 0, reason: 'INVALID_GRID' }; }
  const inside = (h: TacticalHex) => h.q >= 0 && h.r >= 0 && h.q < grid.width && h.r < grid.height;
  if (!inside(start) || !inside(goal)) return { found: false, path: [], totalCost: 0, visited: 0, reason: 'OUT_OF_BOUNDS' };
  if (!Number.isFinite(tacticalMoveCost(grid.cells[goal.r][goal.q], profile))) return { found: false, path: [], totalCost: 0, visited: 0, reason: 'BLOCKED' };
  const startKey = tacticalHexKey(start); const goalKey = tacticalHexKey(goal);
  const open = new MinHeap(); const best = new Map<string, number>([[startKey, 0]]); const came = new Map<string, string>();
  open.push({ key: startKey, coord: start, score: tacticalHexDistance(start, goal), spent: 0 });
  let visited = 0;
  while (open.size) {
    const cur = open.pop()!;
    if (cur.spent !== best.get(cur.key)) continue;
    visited++;
    if (cur.key === goalKey) return buildPath(grid, came, best, startKey, goalKey, movement);
    for (const next of tacticalNeighbors(cur.coord, grid)) {
      const cost = tacticalMoveCost(grid.cells[next.r][next.q], profile); const spent = cur.spent + cost;
      if (!Number.isFinite(cost) || spent > movement) continue;
      const key = tacticalHexKey(next);
      if (spent >= (best.get(key) ?? Infinity)) continue;
      best.set(key, spent); came.set(key, cur.key);
      open.push({ key, coord: next, spent, score: spent + tacticalHexDistance(next, goal) });
    }
  }
  return { found: false, path: [], totalCost: 0, visited, reason: 'UNREACHABLE' };
}

/** Dijkstra 动态移动范围；返回每格剩余移动力，供高亮和 UI 数字同源。 */
export function computeTacticalRange(grid: TacticalGrid, start: TacticalHex, movement: number, profile: MovementProfile): Map<string, number> {
  validateTacticalGrid(grid);
  const startKey = tacticalHexKey(start); const best = new Map<string, number>([[startKey, 0]]); const open = new MinHeap();
  open.push({ key: startKey, coord: start, score: 0, spent: 0 });
  while (open.size) {
    const cur = open.pop()!;
    if (cur.spent !== best.get(cur.key)) continue;
    for (const next of tacticalNeighbors(cur.coord, grid)) {
      const cost = tacticalMoveCost(grid.cells[next.r][next.q], profile); const spent = cur.spent + cost; const key = tacticalHexKey(next);
      if (!Number.isFinite(cost) || spent > movement || spent >= (best.get(key) ?? Infinity)) continue;
      best.set(key, spent); open.push({ key, coord: next, score: spent, spent });
    }
  }
  return new Map([...best].map(([key, spent]) => [key, movement - spent]));
}

function buildPath(grid: TacticalGrid, came: Map<string, string>, best: Map<string, number>, startKey: string, goalKey: string, movement: number): PathResult {
  const keys: string[] = [goalKey];
  while (keys[0] !== startKey) keys.unshift(came.get(keys[0])!);
  const path = keys.map((key, index) => {
    const coord = parseTacticalHexKey(key); const spent = best.get(key) ?? 0;
    const prev = index ? parseTacticalHexKey(keys[index - 1]) : coord;
    const prevCell = grid.cells[prev.r][prev.q]; const cell = grid.cells[coord.r][coord.q];
    const animation: PathStep['animation'] = Math.abs((cell.elevation ?? 0) - (prevCell.elevation ?? 0)) >= 1 ? 'climb' : cell.terrain === 'water' ? 'wade' : index > 1 ? 'turn' : 'walk';
    return { coord, step: index, cost: index ? spent - (best.get(keys[index - 1]) ?? 0) : 0, spent, remaining: movement - spent, animation };
  });
  return { found: true, path, totalCost: best.get(goalKey) ?? 0, visited: best.size };
}
