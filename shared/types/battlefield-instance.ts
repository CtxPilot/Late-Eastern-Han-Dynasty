// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 郡域战场实例（`docs/21-battlefield-scene-design.md` §8.2）
 *
 * 与 `BattlefieldMap`（Tier I，大地图节点数字 id）不同，BattlefieldInstance 基于
 * 历史郡域县节点（字符串 id，如 'nanjun_jiangling'），是更细粒度的郡域战场容器。
 * 双层数据模型（Q11 已落地）：两类型保持独立、不合并不废弃，职责分离——
 * 详见 `docs/02-architecture.md` §独立郡域战场数据流 + `docs/25-bf-p2-design.md` §四。
 *
 * 存档契约（Q10 已实装，Session 174）：已接入 `GameState.activeBattlefieldInstance`
 * （optional 字段，不升 schema 版本），与 `activeBattlefield` 场景栈强制互斥
 * （Zod `superRefine` + orchestrator 双重护栏）。`verify-save-battlefield-instance`
 * 27/27 覆盖空场/进行中场/清档/跨版本兼容/Zod 严格 5 类断言。
 *
 * RNG 边界（为 BF-P3 预留）：`generateNanjunBattlefield` 是零 RNG 纯函数
 * （静态模板生成不消费随机数）；`enterNanjunBattlefield` orchestrator 当前不
 * 注入 RNG，但未来 BF-P3 实施"动态部署/遭遇/AI 行动"时，扩展点须显式注入权威
 * `xorshift32-v1`（runtimeRandom），不得引入 `Math.random()`。
 */

export interface BattlefieldNodeState {
  nodeId: string;
  name: string;
  role: 'seat' | 'county' | 'marquisate' | 'frontier';
  rulerFactionId: number | null;
  garrison: number;
  wallDurability: number;
  maxWallDurability: number;
  armyIds: string[];
  adjacentNodeIds: string[];
  localX: number;
  localY: number;
  /**
   * 已被当前 rulerFactionId 连续控制的月数（BF-P2 Q9）。
   * - 0 = 未占领或刚占领；
   * - >0 = 已占领且经过月度 tick；
   * 月度 tick 中若 garrison==0 且 controlTurns>0，则掉控制（rulerFactionId=null）。
   */
  controlTurns: number;
}

/**
 * BF-P2 Q9 首批可攻打县（当阳/华容/枝江）。
 * 江陵 seat 在 P1 已实现；这 3 县在 Q9 开放为可攻打目标。
 * 其余 12 县本轮仍为纯静态展示（不参与攻打/驻军/控制权流转）。
 */
export const FIRST_BATCH_COUNTY_IDS = [
  'nanjun_dangyang',
  'nanjun_huarong',
  'nanjun_zhijiang',
] as const;

export interface BattlefieldRouteState {
  routeId: string;
  fromNodeId: string;
  toNodeId: string;
  type: string;
}

export interface EncounterState {
  encounterId: string;
  attackerArmyId: string;
  defenderArmyId?: string;
  defenderNodeIds: string[];
  phase: 'active' | 'resolved';
  winner?: 'attacker' | 'defender' | null;
  battleId?: string;
  resolution?: 'auto' | 'tactical' | 'standard';
}

export interface BattlefieldGenerationAudit {
  rngAlgorithm: 'xorshift32-v1';
  rngDrawStart: number;
  rngDrawEnd: number;
  decisions: string[];
}

export interface BattlefieldInstance {
  id: string;
  warId: string;
  templateId: string;
  templateVersion: number;
  scenarioDateAtCreation: string;
  targetCommanderyId: string;
  targetSeatNodeId: string;
  entryNodeIds: string[];
  nodeStates: BattlefieldNodeState[];
  routeStates: BattlefieldRouteState[];
  armyIds: string[];
  encounters: EncounterState[];
  turn: number;
  phase: 'active' | 'settling' | 'resolved';
  generationAudit: BattlefieldGenerationAudit;
}

export const BATTLEFIELD_TEMPLATE_VERSION = 1;
