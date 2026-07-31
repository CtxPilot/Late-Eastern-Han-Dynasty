// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 郡域战场迷雾（BF-P5，`docs/21-battlefield-scene-design.md` §郡域迷雾）。
 *
 * 背景：BF-P2 Q9 的"视野扩张"攻占效果（`docs/25-bf-p2-design.md` §2.4 第 4 条 /
 * §2.6.2）此前因郡域场景无迷雾层而只有占位视觉反馈。本模块提供郡域迷雾的
 * **纯函数层**（全部零 RNG 消费）：
 *
 *  - `computeRevealedNodeIds` —— 攻方视野揭示集；
 *  - `maskBattlefieldInstanceForPlayer` —— 按揭示集裁剪 BattlefieldInstance
 *    军情（地理层——县名/位置/路线——始终可见，只遮蔽军情）。
 *
 * 揭示规则（地理层 vs 军情层分离）：
 *  - **地理层始终可见**：县节点名、相对位置、路线、郡治标记。郡域地图属于
 *    公共地理知识（`docs/22-nanjun-historical-geography-collation.md`），不遮蔽。
 *  - **军情层按揭示集遮蔽**：驻军数（garrison）、城防（wallDurability）、
 *    Army 部署（nodeStates[].armyIds / dynamicSituation.deployments）。未揭示
 *    县节点军情显示为"未知"（garrison=0、wall=0、armyIds=[]），并记录进
 *    `foggedNodeIds`（mask 投影字段，不写入存档）。
 *  - 揭示集 = 入口县 ∪ 郡治（seat，攻方明确目标）∪ 攻方 Army 所在县 ∪
 *    攻方已占领县 ∪ 上述来源的一跳邻接。
 *
 * 视野扩张效果：`engageCounty` 攻占某县后，该县及其邻接县进入揭示集，
 * 军情对攻方透明——补齐 BF-P2 Q9 第 4 条。
 *
 * 0-A 边界：守方 Army 入郡域场景由 R6（S15 多线 AI）排期；本模块已按
 * 攻方 Army id 列表（`playerArmyIds`）过滤 Army 位置揭示，R6 接入守方 Army
 * 后其位置仍只在"攻方可见"时暴露。
 *
 * 消费方：`shared/mask-state.ts` `maskGameStateForPlayer`（服务端下发投影）。
 */

import type { BattlefieldInstance, BattlefieldNodeState } from './types/battlefield-instance.js';

/**
 * 计算攻方视野揭示集（节点 id 列表，含来源本身与一跳邻接）。
 *
 * 揭示来源：
 *  1. 入口县（`inst.entryNodeIds`，攻方从边界进入）；
 *  2. 郡治（`inst.targetSeatNodeId`，攻方明确进攻目标，天然可察）；
 *  3. 攻方 Army 当前所在县（`playerArmyIds` ∩ `nodeStates[].armyIds`）；
 *  4. 攻方已占领县（`rulerFactionId === playerFactionId`）。
 * 每个来源节点自身 + 其 `adjacentNodeIds`（一跳）均为已揭示。
 *
 * 返回排序去重列表，纯函数零 RNG。
 */
export function computeRevealedNodeIds(
  inst: BattlefieldInstance,
  playerFactionId: number,
  playerArmyIds: readonly string[],
): string[] {
  const playerArmySet = new Set(playerArmyIds);
  const revealSources = new Set<string>();

  for (const entry of inst.entryNodeIds) revealSources.add(entry);
  revealSources.add(inst.targetSeatNodeId);
  for (const node of inst.nodeStates) {
    const hasPlayerArmy = node.armyIds.some((armyId) => playerArmySet.has(armyId));
    if (hasPlayerArmy || node.rulerFactionId === playerFactionId) {
      revealSources.add(node.nodeId);
    }
  }

  const revealed = new Set<string>();
  for (const source of revealSources) {
    revealed.add(source);
    const node = inst.nodeStates.find((n) => n.nodeId === source);
    for (const adjacent of node?.adjacentNodeIds ?? []) revealed.add(adjacent);
  }

  return [...revealed].sort();
}

/**
 * 按攻方视野裁剪 BattlefieldInstance 军情，返回**新实例**（不修改入参）。
 *
 * - 揭示节点：军情原样保留。
 * - 未揭示节点：garrison / wallDurability / maxWallDurability 置 0，
 *   armyIds 置空，并追加到 `foggedNodeIds`（mask 投影字段）。
 * - `dynamicSituation.deployments` 仅保留"攻方 Army 且其节点已揭示"的条目
 *   （防止经部署快照泄露守方 Army 位置）。
 *
 * 地理层字段（nodeId/name/role/rulerFactionId 之外的布局与邻接）保持不变。
 */
export function maskBattlefieldInstanceForPlayer(
  inst: BattlefieldInstance,
  playerFactionId: number,
  playerArmyIds: readonly string[],
): BattlefieldInstance {
  const revealed = new Set(computeRevealedNodeIds(inst, playerFactionId, playerArmyIds));
  const playerArmySet = new Set(playerArmyIds);

  const foggedNodeIds: string[] = [];
  const nodeStates: BattlefieldNodeState[] = inst.nodeStates.map((node) => {
    if (revealed.has(node.nodeId)) return node;
    foggedNodeIds.push(node.nodeId);
    return {
      ...node,
      garrison: 0,
      wallDurability: 0,
      maxWallDurability: 0,
      armyIds: [],
    };
  });

  const dynamicSituation = inst.dynamicSituation
    ? {
        ...inst.dynamicSituation,
        deployments: inst.dynamicSituation.deployments.filter(
          (deployment) =>
            revealed.has(deployment.nodeId) && playerArmySet.has(deployment.armyId),
        ),
      }
    : undefined;

  return {
    ...inst,
    nodeStates,
    dynamicSituation,
    foggedNodeIds,
  };
}
