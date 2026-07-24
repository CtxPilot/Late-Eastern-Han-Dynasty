// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 郡域战场实例（`docs/21-battlefield-scene-design.md` §8.2）
 *
 * 与 `BattlefieldMap`（Tier I，大地图节点数字 id）不同，BattlefieldInstance 基于
 * 历史郡域县节点（字符串 id，如 'nanjun_jiangling'），是更细粒度的郡域战场容器。
 * 进行中实例可序列化（§8.1），但 BF-P1 暂不接入 GameState schema（避免破坏
 * CampaignArmy 62/62）；存档往返用独立 Zod 验证。
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
}

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
