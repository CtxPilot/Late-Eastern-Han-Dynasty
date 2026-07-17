// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战役层数据类型（05 §十二~§十七 · 03 §二十）
 * 战役层 = 大地图多回合行军 + 自动战斗算法结算。
 * 战术层（hex battle）设计保留，代码存续但不作为主线。
 */
import type { FormationType, UnitType } from '../enums/index.js';

// ====== 枚举（字符串字面量联合，避免 enum 循环依赖） ======

/** 战役阶段（05 §16 状态机） */
export type CampaignPhase =
  | 'garrison' // 驻守/待命
  | 'marching' // 行军中
  | 'engaged' // 野战接战
  | 'sieging' // 围城
  | 'assaulting' // 强攻
  | 'retreating'; // 撤退中

/** Squad 五部阵位（05 §13.3） */
export type SquadPosition = 'vanguard' | 'center' | 'left' | 'right' | 'rearguard';

/** 设施类型（05 §15.1 · 03 §20.3） */
export type StructureType =
  | 'camp' // 营寨
  | 'ram' // 冲车
  | 'ladder' // 云梯
  | 'siege_tower' // 井阑
  | 'catapult' // 投石车
  | 'supply_depot' // 粮仓
  | 'trap' // 陷阱
  | 'watchtower' // 瞭望塔
  | 'palisade' // 栅栏
  | 'trench' // 壕沟
  | 'pontoon_bridge'; // 浮桥

/** 总军师态势（05 §14.3） */
export type StrategyType = 'offense' | 'defense' | 'development' | 'endurance';

// ====== 节点 ======

export type NodeType = 'major_city' | 'county' | 'pass' | 'port' | 'facility';

/** 战役地图节点（0-A：30 治所 = 30 节点） */
export interface CampaignNode {
  id: number;
  name: string;
  type: NodeType;
  x: number;
  y: number;
  ruler: number | null;
  commanderyId: number;
  adjacentNodeIds: number[];
  garrison: number;
  wallDurability: number;
  maxWallDurability: number;
  farm: number;
  commerce: number;
  population: number;
  morale: number;
  /** 关隘专属：封锁方向（0-A 暂不启用） */
  lockDirection?: number[];
}

// ====== Squad / Army ======

export interface CampaignSquad {
  officerId: number;
  role: 'main' | 'sub';
  position: SquadPosition;
  unitType: UnitType;
  troops: number;
  morale: number;
}

/** 围城状态（05 §16.5） */
export interface SiegeState {
  wallDurability: number;
  maxWallDurability: number;
  gateDurability: number;
  siegeTurns: number;
  attackerStructures: StructureType[];
  defenderBonus: number;
  surrenderChance: number;
}

/** 设施实例（05 §15） */
export interface CampStructure {
  type: StructureType;
  builderId: number;
  /** 0~1 建造进度；1 = 完工可用 */
  buildProgress: number;
  durability: number;
  effect: string;
  nodeId: number;
}

/**
 * 战役 Army（05 §13.1）
 * 替代旧 Army（shared/types/army.ts）作为战役层主单位。
 */
export interface CampaignArmy {
  id: string;
  factionId: number;
  name: string;

  // 编成
  commanderId: number;
  subCommanderIds: number[];
  advisorId?: number;
  subAdvisorId?: number;

  // 兵种与阵型
  unitType: UnitType;
  formation: FormationType;

  // 位置与状态
  currentNodeId: number;
  targetNodeId?: number;
  /** 完整路径节点序列（不含当前节点） */
  path: number[];
  phase: CampaignPhase;

  // 兵力与补给
  troops: number;
  maxTroops: number;
  food: number;
  maxFood: number;

  // 品质四维（05 §13.5）
  morale: number; // 0-100
  organization: number; // 0-100
  experience: number; // 0~3000, Lv1~7
  fatigue: number; // 0-100（越高越疲劳）

  // Squad 编队
  squads: CampaignSquad[];

  // 已建造设施
  structures: CampStructure[];

  // 围城状态
  siegeState?: SiegeState;

  // 出发城（残兵回流用）
  fromNodeId?: number;
}

// ====== 自动战斗结果（05 §17.5） ======

export interface AutoBattleDuel {
  triggered: boolean;
  attacker: number;
  defender: number;
  winner: number;
  description: string;
}

export interface AutoBattleEvent {
  round: number;
  type: 'duel' | 'rout' | 'breach' | 'stratagem' | 'advisor';
  description: string;
}

export interface AutoBattleResult {
  winner: 'attacker' | 'defender';
  rounds: number;
  battlefield: string;
  attackerCasualties: number;
  defenderCasualties: number;
  attackerRemaining: number;
  defenderRemaining: number;
  commanderStatus: Record<number, 'alive' | 'wounded' | 'captured' | 'killed'>;
  duels: AutoBattleDuel[];
  attackerMoraleAfter: number;
  defenderMoraleAfter: number;
  prisoners: number;
  spoils: { gold: number; food: number };
  events: AutoBattleEvent[];
}

// ====== 总军师（05 §14 · 03 §20.5） ======

export interface GrandStrategist {
  factionId: number;
  officerId: number;
  appointedYear: number;
  strategy: StrategyType;
  /** 上次切换季（年×4+季） */
  lastStrategyChange: number;
  adviceSuccess: number;
  insightCount: number;
  strategyScore: number;
}

// ====== 势力特点（04 §36 · 03 §20.6） ======

export interface FactionTraitModifier {
  type: string;
  value: number;
  description: string;
}

export interface FactionTraitAbility {
  name: string;
  trigger: 'passive' | 'active';
  effect: string;
  cooldown?: number;
}

export interface FactionTrait {
  factionId: number;
  name: string;
  source: string;
  modifiers: FactionTraitModifier[];
  specialAbility?: FactionTraitAbility;
  flaw?: { name: string; effect: string };
}

// ====== 编成选项 ======

export interface CampaignFormationOptions {
  commanderId: number;
  subCommanderIds: number[];
  advisorId?: number;
  subAdvisorId?: number;
  fromNodeId: number;
  targetNodeId: number;
  unitType: UnitType;
  formation: FormationType;
  troopCount: number;
  /** 携粮（不超过出发城库存） */
  food: number;
}