// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 三层战斗架构类型（05 §二十）
 * Tier I：战场地图 — 战争独立生成，节点子集，行军/攻击/围城
 * Tier II：白刃战 — 阵型·战术点·计谋·单挑
 */
import type { FormationType } from '../enums/index.js';
import type { DuelResult } from './duel.js';

// ====== Tier I：战场地图 ======

/** 战场节点（Tier I 节点子集，在 CampaignNode 基础上扩展战场特有状态） */
export interface BattlefieldNode {
  /** 引用 CampaignNode.id */
  id: number;
  name: string;
  type: 'major_city' | 'county' | 'pass' | 'port' | 'facility';
  x: number;
  y: number;
  /** 当前占领势力 */
  ruler: number | null;
  adjacentNodeIds: number[];
  garrison: number;
  wallDurability: number;
  maxWallDurability: number;
  /** 该节点上的 Army ID 列表（0-A 简化：每势力至多 1 支） */
  armyIds: string[];
  /** 陷阱列表 */
  traps: BattlefieldTrap[];
  /** 战略点类型（0-A 预留框架） */
  strategicPointType?: 'supply' | 'highland' | 'ferry' | 'bridge' | 'forest' | null;
  /** 战略点占领方 */
  strategicOwner?: number | null;
}

/** 陷阱类型（05 §20.2.5 · 0-A 预留框架） */
export interface BattlefieldTrap {
  type: 'explosive' | 'rockfall' | 'tripwire' | 'oil';
  ownerFactionId: number;
  /** 剩余次数 */
  remaining: number;
}

/** 战场地图（Tier I） */
export interface BattlefieldMap {
  /** 战场唯一 ID */
  id: string;
  /** 关联的战争 */
  warId: string;
  /** 进攻方势力 */
  attackerFactionId: number;
  /** 防守方势力 */
  defenderFactionId: number;
  /** 目标城市 ID */
  targetCityId: number;
  /** 节点子集 */
  nodes: BattlefieldNode[];
  /** 当前在战场上的 Army 列表（引用自 GameState.campaignArmies） */
  armyIds: string[];
  /** 战场回合计数 */
  turn: number;
  /** 战场状态 */
  phase: 'active' | 'attacker_victory' | 'defender_victory' | 'stalemate';
}

// ====== Tier II：白刃战 ======

/** 白刃战入口模式选择 */
export type MeleeEntryMode = 'auto' | 'standard' | 'micro';

/** 战术点动作类型 */
export type TacticalActionType =
  | 'normal_attack'
  | 'ability_attack'
  | 'change_formation'
  | 'use_stratagem'
  | 'initiate_duel'
  | 'all_out_assault'
  | 'hold_firm'
  | 'reorganize'
  | 'retreat_prep'
  | 'counter_stratagem';

/** 玩家本回合的战术点分配 */
export interface TacticalAction {
  type: TacticalActionType;
  /** 战法攻击/用计时的目标 ID */
  targetUnitId?: string;
  /** 变阵时的目标阵型 */
  targetFormation?: FormationType;
  /** 战法/计谋 ID */
  abilityId?: string;
}

/** 白刃战阵型选择 */
export interface MeleeFormation {
  formation: FormationType;
  /** 攻防修正已包含在 calcDamage 用的阵型数据中，此处仅记录选择 */
}

/** 白刃战状态 */
export interface MeleeState {
  /** 战场地图 ID */
  battlefieldId: string;
  /** 关联的 Army ID */
  attackerArmyId: string;
  defenderArmyId: string;
  attackerFactionId: number;
  defenderFactionId: number;
  /** 当前回合数 */
  round: number;
  /** 最多 20 回合 */
  maxRounds: number;

  // 进攻方状态
  attackerTroops: number;
  attackerMorale: number;
  attackerFatigue: number;
  attackerFormation: FormationType;

  // 防守方状态
  defenderTroops: number;
  defenderMorale: number;
  defenderFatigue: number;
  defenderFormation: FormationType;

  /** 战术点（进攻方玩家） */
  tacticalPoints: number;
  /** 本回合已使用的战术点 */
  tacticalPointsUsed: number;

  /** 胜负判定 */
  phase: 'active' | 'attacker_victory' | 'defender_victory' | 'stalemate';

  /** 本场战斗的日志 */
  eventLog: string[];
}

/** 单回合结算结果 */
export interface MeleeRoundResult {
  round: number;
  attackerDamage: number;
  defenderDamage: number;
  attackerTroopsAfter: number;
  defenderTroopsAfter: number;
  attackerMoraleAfter: number;
  defenderMoraleAfter: number;
  /** 单挑结果 */
  duelResult?: DuelResult;
  /** 事件日志 */
  events: string[];
  /** 是否分胜负 */
  phase: 'active' | 'attacker_victory' | 'defender_victory' | 'stalemate';
}

/** 白刃战完整结果（多回合结束） */
export interface MeleeResult {
  winner: number;
  loser: number;
  attackerRemaining: number;
  defenderRemaining: number;
  attackerMorale: number;
  defenderMorale: number;
  casualties: { attacker: number; defender: number };
  duelResult?: DuelResult;
  capturedOfficers: number[];
  killedOfficers: number[];
  eventLog: string[];
  roundsFought: number;
}

/** 战争完整结果 */
export interface WarResult {
  winner: number;
  loser: number;
  conqueredCities: number[];
  capturedOfficers: number[];
  killedOfficers: number[];
  warDuration: number;
}
