// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战场地图引擎（05 §二十 三层战斗架构 Tier I）
 *
 * 职责：
 * - 从行政大地图生成战场地图（节点子集）
 * - 管理战场上的 Army 操作（行军/攻击/围城等）
 * - 触发白刃战
 *
 * 0-A 简化：
 * - 每节点同势力至多 1 支 Army
 * - 无战略点系统（框架预留）
 * - 无陷阱系统（框架预留）
 * - 无战场工程建造（Phase 1）
 */
import {
  type BattlefieldMap,
  type BattlefieldNode,
  type GameState,
  type CampaignArmy,
  calcFoodCost,
} from '@leh/shared';

// ====== 常量 ======

/** 行军每回合士气衰减 */
const MARCH_MORALE_DECAY = 2;
/** 行军每回合疲劳增量 */
const MARCH_FATIGUE = 10;
/** 行军每回合组织度衰减 */
const MARCH_ORG_DECAY = 1;

// ====== 战场生成 ======

/**
 * 从 CampaignNode 子集生成战场地图
 * @param nodes 参与战争的 CampaignNode 子集
 * @param attackerFactionId 进攻方势力 ID
 * @param defenderFactionId 防守方势力 ID
 * @param targetCityId 目标城市 ID
 */
export function generateBattlefield(
  battlefieldId: string,
  warId: string,
  nodes: BattlefieldNode[],
  attackerFactionId: number,
  defenderFactionId: number,
  targetCityId: number,
  armyIds: string[],
): BattlefieldMap {
  return {
    id: battlefieldId,
    warId,
    attackerFactionId,
    defenderFactionId,
    targetCityId,
    nodes,
    armyIds,
    turn: 0,
    phase: 'active',
  };
}

/**
 * 从 CampaignNode 列表提取参与战场的节点子集
 * 0-A 简化：目标城市 + 邻接己方节点 + 邻接敌方节点
 */
export function extractBattlefieldNodes(
  state: GameState,
  targetCityId: number,
  fromCityId: number,
): BattlefieldNode[] {
  const targetNode = state.campaignNodes.find((n) => n.id === targetCityId);
  if (!targetNode) throw new Error('目标城市不在战役节点中');

  // 收集相关节点 ID：出发城 + 目标 + 邻接
  const relevantIds = new Set<number>();
  relevantIds.add(fromCityId);
  relevantIds.add(targetCityId);
  for (const nid of targetNode.adjacentNodeIds) {
    relevantIds.add(nid);
  }
  // 也加出发城的邻接
  const fromNode = state.campaignNodes.find((n) => n.id === fromCityId);
  if (fromNode) {
    for (const nid of fromNode.adjacentNodeIds) {
      relevantIds.add(nid);
    }
  }

  return state.campaignNodes
    .filter((n) => relevantIds.has(n.id))
    .map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      x: n.x,
      y: n.y,
      ruler: n.ruler,
      adjacentNodeIds: n.adjacentNodeIds,
      garrison: n.garrison,
      wallDurability: n.wallDurability,
      maxWallDurability: n.maxWallDurability,
      armyIds: state.campaignArmies
        .filter((a) => a.currentNodeId === n.id && a.factionId === state.playerFactionId)
        .map((a) => a.id),
      traps: [],
    }));
}

// ====== 战场操作 ======

/** 行军：Army 沿道路向目标节点移动（验证路径合法性） */
export function orderBattlefieldMarch(
  battlefield: BattlefieldMap,
  army: CampaignArmy,
  targetNodeId: number,
): BattlefieldMap {
  if (battlefield.phase !== 'active') throw new Error('战场已结束');

  // 验证目标在战场节点中
  const targetNode = battlefield.nodes.find((n) => n.id === targetNodeId);
  if (!targetNode) throw new Error('目标节点不在战场范围内');

  // 验证邻接
  if (!targetNode.adjacentNodeIds.includes(army.currentNodeId)) {
    throw new Error('目标节点不邻接当前节点');
  }

  // 验证目标节点无同势力 Army（0-A 简化）
  if (targetNode.ruler === army.factionId && targetNode.armyIds.length > 0) {
    // 己方城已有 Army → 等待（0-A 简化）
  }

  return battlefield;
}

/** 执行战场行军推进（每回合调用）：消耗粮草、移动位置 */
export function tickBattlefieldMarch(
  state: GameState,
  battlefield: BattlefieldMap,
): { state: GameState; battlefield: BattlefieldMap; log: string[] } {
  const logs: string[] = [];
  let armies = [...state.campaignArmies];
  const battlefieldArmyIds = new Set(battlefield.armyIds);

  for (let i = 0; i < armies.length; i++) {
    const a = armies[i];
    if (!a || a.phase !== 'marching') continue;
    if (!battlefieldArmyIds.has(a.id)) continue;
    if (a.path.length === 0) continue;

    const nextNodeId = a.path[0];
    const restPath = a.path.slice(1);

    // 补给消耗
    const foodCost = calcFoodCost(a.troops);
    let food = a.food - foodCost;
    let morale = a.morale - MARCH_MORALE_DECAY;
    let fatigue = a.fatigue + MARCH_FATIGUE;
    let org = a.organization - MARCH_ORG_DECAY;

    if (food <= 0) {
      food = 0;
      morale -= 15;
      org -= 10;
      logs.push(`${a.name} 缺粮，士气大降`);
    }

    // 到达下一节点
    armies[i] = {
      ...a,
      currentNodeId: nextNodeId,
      path: restPath,
      food,
      morale: Math.max(0, Math.min(100, morale)),
      fatigue: Math.max(0, Math.min(100, fatigue)),
      organization: Math.max(0, Math.min(100, org)),
    };

    logs.push(`${a.name} 前进至 ${getNodeName(battlefield, nextNodeId)}`);
  }

  // 更新战场节点上的 Army ID 映射
  const updatedNodes = battlefield.nodes.map((n) => ({
    ...n,
    armyIds: armies
      .filter((a) => a.currentNodeId === n.id && battlefieldArmyIds.has(a.id))
      .map((a) => a.id),
  }));

  return {
    state: { ...state, campaignArmies: armies },
    battlefield: { ...battlefield, nodes: updatedNodes },
    log: logs,
  };
}

// ====== 辅助函数 ======

function getNodeName(battlefield: BattlefieldMap, nodeId: number): string {
  return battlefield.nodes.find((n) => n.id === nodeId)?.name ?? `节点${nodeId}`;
}
