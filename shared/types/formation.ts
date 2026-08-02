// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { TerrainType, UnitType } from '../enums/index.js';
import type { SquadPosition } from './campaign.js';

export interface FormationEffect {
  name: string;
  description: string;
  modifier: {
    type: string;
    value: number;
    condition?: string;
  };
}

export interface FormationModifiers {
  attack: number;
  defense: number;
  mobility: number;
  range: number;
}

/** 单级阵型数据（03 §9） */
export interface FormationLevelData {
  level: 1 | 2 | 3 | 4 | 5;
  attack: number;
  defense: number;
  mobility: number;
  range: number;
  specialEffects?: string[];
}

/** 极效果（03 §9） */
export interface FormationUltimate {
  attackBonus: number;
  defenseBonus: number;
  mobilityBonus: number;
  rangeBonus: number;
  effect: string;
  proficiencyRequired: number;
}

/** 阵型前置条件（科技树，03 §9） */
export interface FormationPrerequisite {
  formationId: number;
  requiredLevel: number;
}

/** 六角轴向偏移 (q, r) */
export interface HexOffset {
  q: number;
  r: number;
}

/**
 * 原创五部部署模板（FM 计划 §4.3，Gate D 已审）。
 * 部署不新增持久状态，进入局部交战时由阵型 ID + 既有 SquadPosition 派生。
 */
export interface FormationDeployment {
  /** 每阵位相对中军(0,0)的偏移；Partial 表示缺部按 fallbackOrder 收缩 */
  slots: Partial<Record<SquadPosition, HexOffset>>;
  fallbackOrder: readonly SquadPosition[];
  symmetry: 'symmetric' | 'left_weighted' | 'right_weighted';
}

/** 完整阵型模板（静态 JSON，03 §9 长期目标模型） */
export interface Formation {
  id: number;
  name: string;
  description: string;
  historicalSource: string;
  family: 'land' | 'water';
  tiers: FormationLevelData[];
  ultimate: FormationUltimate;
  effects: FormationEffect[];
  allowedUnits: UnitType[];
  bestUnits: UnitType[];
  restrictedUnits: UnitType[];
  terrainModifiers: Partial<Record<TerrainType, number>>;
  prerequisites?: FormationPrerequisite[];
  specialUnlock?: {
    minIntelligence?: number;
    minNavalProficiency?: 'S' | 'A' | 'B' | 'C' | 'NONE';
    allowOnlyUnitTypes?: UnitType[];
  };
  /** FM 0-A 五部部署草稿（Gate D） */
  deployment?: FormationDeployment;
  /**
   * 标准模式白刃战（runMeleeRound）战术贡献（FM-P3a 点值迁移）。
   * 唯一运行量纲 = `tiers[0]`（0-A 固定 Lv1）攻防机射点值 + `effects` 暴击链（N1 已审）；
   * 三模式（自动/标准/六角）同源消费，不再存在第二套阵型数值表（meleePercent 已退役）。
   */
}

/**
 * 0-A 可消费的基础阵型（版本化规则范围，不含名称/属性/效果）。
 * 冲阵 16 保留静态与精通，但不在本集合。
 */
export const ZERO_A_PLAYABLE_FORMATION_IDS: readonly number[] = [0, 1, 2, 3, 4, 6];

/** @deprecated 旧静态 JSON 记录（legacy `modifiers` 结构）；FM-P1 已迁移到 `Formation` */
export interface FormationTemplate {
  id: number;
  name: string;
  description: string;
  historicalSource: string;
  modifiers: FormationModifiers;
  effects: FormationEffect[];
  allowedUnits: UnitType[];
  bestUnits: UnitType[];
  restrictedUnits: UnitType[];
  terrainModifiers: Partial<Record<TerrainType, number>>;
}
