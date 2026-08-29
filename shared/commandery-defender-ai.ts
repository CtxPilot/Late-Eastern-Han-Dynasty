// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 县级主动 AI —— 守方 Army 郡域内主动行为决策（R6 后续 · S15 深化，Session 259）。
 *
 * 背景：Session 258 后守方 Army 已能入郡域（部署到守方纵深前沿县），但在
 * `tickBattlefieldInstance` 中只被动扣粮/士气，无任何主动行为；`engageCounty`
 * 也只打驻军、无视 `nodeStates[].armyIds` 中的守方 Army（玩家看得见却打不着）。
 * 本模块提供守方 Army 月度主动行动的**决策纯函数**（零副作用，可单测）。
 *
 * 设计真源：`docs/25-bf-p2-design.md` §2.6.4（县级主动 AI，Session 259）。
 * 消费方：`server/src/engine/turn.ts` `tickBattlefieldInstance`。
 *
 * 规则优先级（每支守方 Army 独立决策，决策消费权威 PRNG）：
 *   ① 所在县被攻方占领 → 兵力优势（troops ≥ garrison×1.2）且经 RNG 判定
 *      （60%~100% 概率）→ recapture；否则 retreat（撤出郡域回大地图）。
 *   ② 补给线被切断 → 士气 <60 → retreat；否则向 seat 移动一格（加权最短路径自 Army 侧上一跳；
 *      该步被攻方占领则不移动，避免走进敌占县）。
 *   ③ 存在攻方占领县 → 向最近攻方占领县移动一格（movementCost 最小路径首步；
 *      允许走进攻方县，下月由规则 ① 触发收复，形成"移动→收复"两步走）。
 *   ④ 否则 stay（原地驻守）。
 *
 * RNG 约束：无守方 Army / 无可行动 / 无攻方占领县时**零 RNG 消费**（保持
 * f1~f9、verify-bf-p3-dynamic 确定性）；本模块不引入 `Math.random()`。
 */

import type { CampaignArmy } from './types/campaign.js';
import type { BattlefieldInstance } from './types/battlefield-instance.js';
import {
  isCountyPathBlockedBy,
  resolveArmyCountyNodeId,
  shortestCountyPath,
} from './army-county-mapping.js';

export interface DefenderAiContext {
  /** 守方势力 id（= 郡治 seat 大地图城市占领势力）。 */
  defenderFactionId: number;
  /** 攻方势力 id（= 玩家势力，郡域场景的进攻方）。 */
  attackerFactionId: number;
  /** 郡治 seat 县节点 id（守方边界入口，补给线起点）。 */
  seatNodeId: string;
}

export type DefenderArmyAction =
  | { type: 'stay' }
  | { type: 'move'; fromNodeId: string; toNodeId: string }
  /** 收复：县 rulerFactionId 夺回为守方（执行侧驻军并入 Army 兵力）。 */
  | { type: 'recapture'; nodeId: string }
  /** 撤退：撤出郡域（执行侧从位置表移除 Army，回大地图郡治城市）。 */
  | { type: 'retreat'; nodeId: string };

/** 兵力优势阈值系数：守方 Army 兵力 ≥ 攻方驻军 × 1.2 才具备收复条件。 */
export const RECAPTURE_TROOP_RATIO = 1.2;
/** 补给线被切断且士气低于该值 → 直接撤出郡域（不再尝试回撤）。 */
export const RETREAT_MORALE_THRESHOLD = 60;

/**
 * 单支守方 Army 的月度行动决策（纯函数，零副作用）。
 * @param inst 郡域战场实例（只读）
 * @param army 守方 Army（只读，须为守方势力）
 * @param ctx 攻守势力与 seat 上下文
 * @param rng 权威 PRNG（决策点消费；无可行动时零消费）
 */
export function decideDefenderArmyAction(
  inst: BattlefieldInstance,
  army: CampaignArmy,
  ctx: DefenderAiContext,
  rng: () => number,
): DefenderArmyAction {
  const countyNodeId = resolveArmyCountyNodeId(inst, army.id);
  if (!countyNodeId) return { type: 'stay' }; // 不在郡域内 → 不决策
  const node = inst.nodeStates.find((n) => n.nodeId === countyNodeId);
  if (!node) return { type: 'stay' };

  // 规则 ①：所在县被攻方占领 → 优势且判定成功则收复，否则撤退
  if (node.rulerFactionId === ctx.attackerFactionId) {
    const threshold = Math.max(1, Math.floor(node.garrison * RECAPTURE_TROOP_RATIO));
    const advantage = army.troops >= threshold;
    const resolveChance = 0.6 + rng() * 0.4; // 60%~100%
    if (advantage && rng() < resolveChance) {
      return { type: 'recapture', nodeId: countyNodeId };
    }
    return { type: 'retreat', nodeId: countyNodeId };
  }

  // 规则 ②：补给线被切断 → 士气低则撤退；否则向 seat 移动一格
  const supplyPath = shortestCountyPath(inst, ctx.seatNodeId, countyNodeId);
  const supplyCut = supplyPath
    ? isCountyPathBlockedBy(inst, supplyPath.nodeIds, ctx.attackerFactionId)
    : false;
  if (supplyCut) {
    if (army.morale < RETREAT_MORALE_THRESHOLD) {
      return { type: 'retreat', nodeId: countyNodeId };
    }
    // 向 seat 回撤一格（加权最短路径上自 Army 侧的上一跳）；该步被攻方占领 → 原地
    const nodes = supplyPath!.nodeIds;
    const step = nodes.length >= 2 ? nodes[nodes.length - 2] : undefined;
    if (step && step !== countyNodeId) {
      const stepNode = inst.nodeStates.find((n) => n.nodeId === step);
      if (stepNode && stepNode.rulerFactionId !== ctx.attackerFactionId) {
        return { type: 'move', fromNodeId: countyNodeId, toNodeId: step };
      }
    }
    return { type: 'stay' };
  }

  // 规则 ③：存在攻方占领县 → 向 totalCost 最近者移动一格（允许走进攻方县，下月触发规则 ①）
  const attackerHeld = inst.nodeStates.filter((n) => n.rulerFactionId === ctx.attackerFactionId);
  if (attackerHeld.length > 0) {
    let best: { nodeIds: string[]; totalCost: number } | null = null;
    for (const target of attackerHeld) {
      if (target.nodeId === countyNodeId) continue;
      const path = shortestCountyPath(inst, countyNodeId, target.nodeId);
      if (!path) continue;
      if (
        !best
        || path.totalCost < best.totalCost
        || (path.totalCost === best.totalCost && path.nodeIds.length < best.nodeIds.length)
      ) {
        best = path;
      }
    }
    if (best && best.nodeIds.length >= 2) {
      const step = best.nodeIds[1];
      if (step && step !== countyNodeId) {
        return { type: 'move', fromNodeId: countyNodeId, toNodeId: step };
      }
    }
  }

  // 规则 ④：原地驻守
  return { type: 'stay' };
}
