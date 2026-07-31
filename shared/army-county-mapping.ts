// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Army—县位置映射与补给线真实路径判定（BF-P5）。
 *
 * 背景：`CampaignArmy` 在大地图层移动（位置为数字 `currentNodeId`，见
 * `shared/types/campaign.ts`）；郡域县节点用字符串 `countyId`（如
 * `'nanjun_jiangling'`，见 `shared/types/battlefield-instance.ts`）。两层原本
 * **无位置映射**，导致 BF-P2 §2.6.1 的"补给线经过攻方控制县"只能退化为
 * "占领任意首批县 → 守方全军 morale -5"的全局简化。
 *
 * 本模块提供四类纯函数（全部零 RNG 消费，不引入 `Math.random()`）：
 *
 *  1. `resolveArmyCountyNodeId` —— Army 在郡域战场内的 countyId 定位：
 *     权威来源是 `nodeStates[].armyIds`（运行时位置表，`generateCommanderyBattlefield`
 *     已从创建时部署写入）；回退 `dynamicSituation.deployments`（BF-P3 冻结快照）。
 *  2. `shortestCountyPath` —— 沿 `nodeStates[].adjacentNodeIds`（无向）的 BFS 最短路径。
 *  3. `isCountyPathBlockedBy` —— 补给线（己方边界入口 → Army 当前节点）是否经过
 *     阻断方控制的县。
 *  4. `monthlyArmyFoodCost` —— 0-A 月度粮耗折算（复用行军公式
 *     `FOOD_PER_100_PER_TURN = 3`，见 `server/src/engine/campaign.ts:45`）；
 *     补给切断时 ×2。
 *
 * 设计真源：`docs/25-bf-p2-design.md` §2.4 第 1 条 / §2.6.1（补给线切断）。
 * 消费方：`server/src/engine/turn.ts` `tickBattlefieldInstance`。
 */

import type { BattlefieldInstance } from './types/battlefield-instance.js';

/** 月度粮耗折算基线（0-A）：与行军 tick 同一公式 `(troops/100) * 3`。 */
export function monthlyArmyFoodCost(troops: number): number {
  return Math.max(1, Math.floor((troops / 100) * 3));
}

/**
 * Army—县位置映射：解析 Army 在郡域战场内的县节点定位。
 * @returns countyId（如 `'nanjun_jiangling'`），或 null（该 Army 不在郡域战场内）。
 */
export function resolveArmyCountyNodeId(inst: BattlefieldInstance, armyId: string): string | null {
  // 1) 权威运行时位置：nodeStates[].armyIds（generateCommanderyBattlefield 已从部署写入）
  const located = inst.nodeStates.find((n) => n.armyIds.includes(armyId));
  if (located) return located.nodeId;
  // 2) 回退：BF-P3 创建时冻结的部署快照
  const deployment = inst.dynamicSituation?.deployments.find((d) => d.armyId === armyId);
  if (deployment) return deployment.nodeId;
  // 3) Army 不在该郡域战场内
  return null;
}

/**
 * 沿郡域县图（`nodeStates[].adjacentNodeIds`，无向）的 BFS 最短路径。
 * @returns 节点序列（含起止），起止相同返回 `[from]`，不可达返回 null。
 */
export function shortestCountyPath(
  inst: BattlefieldInstance,
  fromNodeId: string,
  toNodeId: string,
): string[] | null {
  if (fromNodeId === toNodeId) return [fromNodeId];
  const nodeIds = new Set(inst.nodeStates.map((n) => n.nodeId));
  if (!nodeIds.has(fromNodeId) || !nodeIds.has(toNodeId)) return null;

  const adjacency = new Map<string, string[]>();
  for (const node of inst.nodeStates) {
    adjacency.set(node.nodeId, node.adjacentNodeIds);
  }
  const prev = new Map<string, string | null>([[fromNodeId, null]]);
  const visited = new Set<string>([fromNodeId]);
  const queue: string[] = [fromNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toNodeId) {
      const path: string[] = [];
      let cursor: string | null = toNodeId;
      while (cursor != null) {
        path.unshift(cursor);
        cursor = prev.get(cursor) ?? null;
      }
      return path;
    }
    for (const next of [...(adjacency.get(current) ?? [])].sort()) {
      if (visited.has(next)) continue;
      visited.add(next);
      prev.set(next, current);
      queue.push(next);
    }
  }
  return null;
}

/**
 * 补给线切断判定：路径上（不含起点边界入口）是否存在阻断方控制的县。
 *
 * 设计原意（`docs/25-bf-p2-design.md` §2.6.1）：守方 Army 若其补给线
 * （从己方边界入口到 Army 当前节点的最短路径）**经过**攻方控制县 →
 * 月度粮耗×2 + 士气 -5。只有补给线真的穿过占领县的 Army 才受罚。
 *
 * @param path 由 `shortestCountyPath` 返回的节点序列（含起止）；起点为守方边界
 *   入口（不参与判定），其余节点（含 Army 自身所在节点）被阻断方控制即视为切断。
 */
export function isCountyPathBlockedBy(
  inst: BattlefieldInstance,
  path: string[],
  blockerFactionId: number,
): boolean {
  return path.slice(1).some((nodeId) => {
    const node = inst.nodeStates.find((n) => n.nodeId === nodeId);
    return node?.rulerFactionId === blockerFactionId;
  });
}
