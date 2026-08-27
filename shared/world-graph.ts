// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Historical World Graph — LocationNode + RouteEdge 适配层（Session 380）。
 *
 * 不替代现有玩法真源：宏观移动仍以 `city-roads` / CampaignArmy 为准；
 * 郡域仍以 historical-geography bundle 为准。本模块把两者投影为统一只读图，
 * 供战略 UI / 路径查询 / 后续引擎迁移动用。
 */

import { CITY_ROAD_EDGES, roadNeighbors } from './city-roads.js';
import type { HistoricalGeographyBundle } from './data/historical-geography/schema.js';
import type { City } from './types/city.js';

export type LocationNodeKind =
  | 'city'
  | 'commandery_capital'
  | 'province_capital'
  | 'county'
  | 'pass'
  | 'port'
  | 'ferry'
  | 'fort'
  | 'village'
  | 'special_location';

export type RouteType = 'road' | 'major_road' | 'mountain_road' | 'river' | 'waterway' | 'pass' | 'ferry';

export interface LocationNode {
  /** 稳定 id：宏观 `city:{n}`；郡域沿用 county/landmark snake_case */
  id: string;
  name: string;
  kind: LocationNodeKind;
  province?: string;
  /** 宏观城 id（仅宏观层） */
  worldCityId?: number;
  commanderyId?: string;
  /** 抽象布局用相对坐标（0~1 或像素归一）；非地理多边形 */
  layoutX?: number;
  layoutY?: number;
  isPass?: boolean;
  validFromYear?: number;
  validToYear?: number;
}

export interface RouteEdge {
  id: string;
  from: string;
  to: string;
  routeType: RouteType;
  /** 行军代价；宏观默认 1；郡域读 movementCost */
  distance: number;
  travelDays?: number;
  difficulty?: number;
  seasonalModifier?: 'all' | 'dry' | 'wet';
  validFromYear?: number;
  validToYear?: number;
}

export interface WorldGraph {
  nodes: ReadonlyMap<string, LocationNode>;
  edges: readonly RouteEdge[];
}

export function cityNodeId(worldCityId: number): string {
  return `city:${worldCityId}`;
}

export function parseCityNodeId(nodeId: string): number | null {
  const m = /^city:(\d+)$/.exec(nodeId);
  return m ? Number(m[1]) : null;
}

function macroKind(city: Pick<City, 'isCapital' | 'isPass'>): LocationNodeKind {
  if (city.isPass) return 'pass';
  if (city.isCapital) return 'province_capital';
  return 'city';
}

function mapHistoricalRouteKind(
  kind: 'road' | 'river' | 'pass' | 'ferry',
): RouteType {
  switch (kind) {
    case 'river':
      return 'waterway';
    case 'pass':
      return 'pass';
    case 'ferry':
      return 'ferry';
    default:
      return 'road';
  }
}

/**
 * 从运行时/静态城表 + 官道边构建宏观 WorldGraph。
 */
export function buildMacroWorldGraph(
  cities: Record<number, Pick<City, 'id' | 'name' | 'province' | 'x' | 'y' | 'isCapital' | 'isPass'>>,
  edges: ReadonlyArray<readonly [number, number]> = CITY_ROAD_EDGES,
): WorldGraph {
  const nodes = new Map<string, LocationNode>();
  const xs = Object.values(cities).map((c) => c.x);
  const ys = Object.values(cities).map((c) => c.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  for (const city of Object.values(cities)) {
    nodes.set(cityNodeId(city.id), {
      id: cityNodeId(city.id),
      name: city.name,
      kind: macroKind(city),
      province: city.province,
      worldCityId: city.id,
      layoutX: (city.x - minX) / spanX,
      layoutY: (city.y - minY) / spanY,
      isPass: city.isPass,
    });
  }

  const routeEdges: RouteEdge[] = [];
  for (const [a, b] of edges) {
    if (!cities[a] || !cities[b]) continue;
    const from = cityNodeId(a);
    const to = cityNodeId(b);
    const id = a < b ? `macro_${a}_${b}` : `macro_${b}_${a}`;
    routeEdges.push({
      id,
      from,
      to,
      routeType: 'major_road',
      distance: 1,
      travelDays: 1,
    });
  }

  return { nodes, edges: routeEdges };
}

/**
 * 从郡域 historical-geography bundle 构建子图（县 + 地标端点 + routes）。
 */
export function buildCommanderyWorldGraph(bundle: HistoricalGeographyBundle): WorldGraph {
  const nodes = new Map<string, LocationNode>();
  const cmd = bundle.commanderies[0];

  for (const county of bundle.counties) {
    const kind: LocationNodeKind =
      county.role === 'seat' ? 'commandery_capital' : county.role === 'frontier' ? 'fort' : 'county';
    nodes.set(county.id, {
      id: county.id,
      name: county.name,
      kind,
      province: cmd?.province,
      commanderyId: county.commanderyId,
      worldCityId: cmd?.worldCityId,
      layoutX: county.localX,
      layoutY: county.localY,
      validFromYear: county.validFromYear,
      validToYear: county.validToYear,
    });
  }

  for (const lm of bundle.landmarks) {
    if (nodes.has(lm.id)) continue;
    const kind: LocationNodeKind =
      lm.kind === 'pass'
        ? 'pass'
        : lm.kind === 'ferry'
          ? 'ferry'
          : lm.kind === 'port'
            ? 'port'
            : 'special_location';
    const geom = lm.localGeometry;
    let layoutX = 0.5;
    let layoutY = 0.5;
    if (geom.type === 'point') {
      layoutX = geom.x;
      layoutY = geom.y;
    } else if ((geom.type === 'polyline' || geom.type === 'polygon') && geom.points[0]) {
      layoutX = geom.points[0][0];
      layoutY = geom.points[0][1];
    }
    nodes.set(lm.id, {
      id: lm.id,
      name: lm.name,
      kind,
      province: cmd?.province,
      commanderyId: lm.commanderyId,
      layoutX,
      layoutY,
      validFromYear: lm.validFromYear,
      validToYear: lm.validToYear,
    });
  }

  const edges: RouteEdge[] = bundle.routes.map((r) => ({
    id: r.id,
    from: r.fromNodeId,
    to: r.toNodeId,
    routeType: mapHistoricalRouteKind(r.kind),
    distance: r.movementCost,
    travelDays: r.movementCost,
    seasonalModifier: r.seasonal ?? 'all',
    validFromYear: r.validFromYear,
    validToYear: r.validToYear,
  }));

  return { nodes, edges };
}

/**
 * 荆州试点：宏观荆州城图 ∪ 南郡郡域图（节点 id 空间分离，用 bridge 边连接江陵）。
 */
export function buildJingzhouPilotGraph(
  cities: Record<number, Pick<City, 'id' | 'name' | 'province' | 'x' | 'y' | 'isCapital' | 'isPass'>>,
  nanjunBundle: HistoricalGeographyBundle,
): WorldGraph {
  const jingCities = Object.fromEntries(
    Object.values(cities)
      .filter((c) => c.province === '荆州')
      .map((c) => [c.id, c]),
  );
  const macro = buildMacroWorldGraph(jingCities);
  const county = buildCommanderyWorldGraph(nanjunBundle);

  const nodes = new Map<string, LocationNode>([...macro.nodes, ...county.nodes]);
  const seat = nanjunBundle.commanderies[0];
  const seatCountyId = seat?.seatCountyId;
  const worldCityId = seat?.worldCityId;
  const edges = [...macro.edges, ...county.edges];

  if (seatCountyId && worldCityId != null && nodes.has(seatCountyId) && nodes.has(cityNodeId(worldCityId))) {
    edges.push({
      id: `bridge_jingzhou_${worldCityId}_${seatCountyId}`,
      from: cityNodeId(worldCityId),
      to: seatCountyId,
      routeType: 'major_road',
      distance: 0,
      travelDays: 0,
    });
  }

  return { nodes, edges };
}

/** BFS 最短路径（无权或按 distance）；不可达返回 null */
export function shortestPath(
  graph: WorldGraph,
  fromId: string,
  toId: string,
): { nodeIds: string[]; totalDistance: number } | null {
  if (!graph.nodes.has(fromId) || !graph.nodes.has(toId)) return null;
  if (fromId === toId) return { nodeIds: [fromId], totalDistance: 0 };

  const adj = new Map<string, { to: string; dist: number }[]>();
  for (const e of graph.edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    if (!adj.has(e.to)) adj.set(e.to, []);
    adj.get(e.from)!.push({ to: e.to, dist: e.distance });
    adj.get(e.to)!.push({ to: e.from, dist: e.distance });
  }

  const prev = new Map<string, string | null>();
  const dist = new Map<string, number>();
  const queue: string[] = [fromId];
  prev.set(fromId, null);
  dist.set(fromId, 0);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur === toId) break;
    for (const { to, dist: d } of adj.get(cur) ?? []) {
      const nd = (dist.get(cur) ?? 0) + d;
      if (!dist.has(to) || nd < dist.get(to)!) {
        dist.set(to, nd);
        prev.set(to, cur);
        queue.push(to);
      }
    }
  }

  if (!prev.has(toId)) return null;
  const nodeIds: string[] = [];
  let walk: string | null = toId;
  while (walk != null) {
    nodeIds.push(walk);
    walk = prev.get(walk) ?? null;
  }
  nodeIds.reverse();
  return { nodeIds, totalDistance: dist.get(toId) ?? 0 };
}

/** 宏观兼容：node id → 邻接 worldCityId（委托 city-roads） */
export function macroRoadNeighborCityIds(worldCityId: number): number[] {
  return roadNeighbors(worldCityId);
}

export function neighborsOf(graph: WorldGraph, nodeId: string): string[] {
  const out = new Set<string>();
  for (const e of graph.edges) {
    if (e.from === nodeId) out.add(e.to);
    if (e.to === nodeId) out.add(e.from);
  }
  return [...out];
}
