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

import type { DuelState } from './duel.js';

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
  /**
   * 行军代价（Session 382）。生成时自 historical-geography `Route.movementCost` 写入；
   * 旧存档可缺省，路径算法按 1 处理（与跳数 BFS 等价）。
   */
  movementCost?: number;
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

export interface BattlefieldDynamicSituation {
  weather: 'clear' | 'rain' | 'fog';
  deployments: Array<{ armyId: string; nodeId: string }>;
  attackerScouted: boolean;
  defenderScouted: boolean;
  ambush: 'none' | 'attacker' | 'defender';
  encounterOrder: string[];
}

/** BF-P4：郡域层阵前/城下挑战；伤害与指令完全复用 S10 DuelState。 */
export interface BattlefieldDuelContext {
  kind: 'formation_front' | 'city_front';
  nodeId: string;
  attackerArmyId?: string;
  challengerId: number;
  defenderId: number;
  duel: DuelState;
  /** 结果是否已回写，避免 step/skip 重试重复修改驻军、士气或功绩。 */
  settlementApplied: boolean;
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
  /** BF-P3：创建时冻结的动态战况；旧存档可无此字段。 */
  dynamicSituation?: BattlefieldDynamicSituation;
  /** BF-P4：进行中或待关闭的阵前/城下单挑；旧存档可无此字段。 */
  activeDuel?: BattlefieldDuelContext;
  /**
   * BF-P5：郡域迷雾 mask 投影字段——当前被迷雾遮蔽（军情未知）的县节点 id。
   * 仅由 `shared/commandery-fog.ts` `maskBattlefieldInstanceForPlayer` 在
   * 服务端下发投影时填充（`maskGameStateForPlayer` 调用），**不写入存档**；
   * 服务端真源实例与旧存档无此字段。
   */
  foggedNodeIds?: string[];
}

export const BATTLEFIELD_TEMPLATE_VERSION = 1;
