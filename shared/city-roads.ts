// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 0-A 30 城道路邻接（出征可达）
 * 依据：东汉末主要官道/漕运走廊 + 大地图相对位置
 * - 司豫兖冀徐青并：中原官道网
 * - 长安↔汉中↔成都：栈道/蜀道
 * - 宛↔襄阳↔江陵：荆襄线
 * - 寿春↔建业↔吴↔广陵：江淮
 * - 凉州：长安—冀县—姑臧
 * - 交州：江陵南下番禺—龙编（简化）
 *
 * 改边须同步 docs/04 出征邻接说明与地图道路层。
 */

/** 无向边 [cityIdA, cityIdB] */
export const CITY_ROAD_EDGES: ReadonlyArray<readonly [number, number]> = [
  // 司隶 / 中原核心
  [1, 2], // 洛阳—长安
  [1, 3], // 洛阳—阳翟
  [1, 7], // 洛阳—陈留
  [1, 13], // 洛阳—宛
  [1, 25], // 洛阳—壶关（上党道）
  [2, 20], // 长安—汉中（褒斜/子午栈道）
  [2, 22], // 长安—冀县（陇右道）
  // 豫州
  [3, 4], // 阳翟—平舆
  [3, 13], // 阳翟—宛
  [4, 7], // 平舆—陈留
  [4, 18], // 平舆—寿春（淮上）
  // 兖州 / 冀州
  [5, 6], // 邺—真定
  [5, 8], // 邺—濮阳
  [5, 11], // 邺—平原
  [5, 25], // 邺—壶关
  [6, 24], // 真定—晋阳
  [6, 26], // 真定—涿
  [7, 8], // 陈留—濮阳
  [8, 11], // 濮阳—平原
  // 徐州 / 青州 / 扬州
  [9, 10], // 下邳—广陵
  [9, 12], // 下邳—剧县
  [9, 18], // 下邳—寿春
  [10, 17], // 广陵—建业
  [11, 12], // 平原—剧县
  [16, 17], // 吴—建业
  [17, 18], // 建业—寿春
  // 荆州
  [13, 15], // 宛—襄阳
  [14, 15], // 江陵—襄阳
  [14, 21], // 江陵—江州（江路）
  [15, 18], // 襄阳—寿春（淮汉联系，略简）
  // 益州
  [19, 20], // 成都—汉中
  [19, 21], // 成都—江州
  [20, 22], // 汉中—冀县（陈仓/祁山方向简化）
  // 凉州
  [22, 23], // 冀县—姑臧
  // 并州
  [24, 25], // 晋阳—壶关
  // 幽州
  [26, 27], // 涿—蓟
  [27, 28], // 蓟—襄平（辽东道）
  // 交州（南下简化：荆南官道/海路）
  [14, 29], // 江陵—番禺
  [29, 30], // 番禺—龙编
] as const;

const _adj = new Map<number, Set<number>>();
for (const [a, b] of CITY_ROAD_EDGES) {
  if (!_adj.has(a)) _adj.set(a, new Set());
  if (!_adj.has(b)) _adj.set(b, new Set());
  _adj.get(a)!.add(b);
  _adj.get(b)!.add(a);
}

/** 与 cityId 道路邻接的城 id 列表 */
export function roadNeighbors(cityId: number): number[] {
  return [...(_adj.get(cityId) ?? [])];
}

/** 两城是否有官道直连 */
export function areCitiesRoadAdjacent(a: number, b: number): boolean {
  return _adj.get(a)?.has(b) ?? false;
}

/**
 * 出征：出发城与目标城必须道路邻接。
 * （行军经己方中间城暂不做多跳，保持 Demo 清晰）
 */
export function canMarchAlongRoad(fromCityId: number, targetCityId: number): boolean {
  return areCitiesRoadAdjacent(fromCityId, targetCityId);
}

/** 己方城中，与目标道路邻接的城 id */
export function playerCitiesAdjacentTo(
  playerCityIds: number[],
  targetCityId: number,
): number[] {
  return playerCityIds.filter((id) => areCitiesRoadAdjacent(id, targetCityId));
}

/** 所有道路边（地图绘制用） */
export function allRoadEdges(): ReadonlyArray<readonly [number, number]> {
  return CITY_ROAD_EDGES;
}
