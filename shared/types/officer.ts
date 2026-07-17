// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type {
  CeilingAttribute,
  GrowthPotential,
  Ideal,
  OfficerStatus,
  Personality,
  UnitProficiency,
  UnitType,
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  NobilityRank,
  SkillType,
} from '../enums/index.js';
import type { OfficerStats } from './common.js';

export interface CeilingBonus {
  attribute: CeilingAttribute;
  hiddenBonus: number;
}

export interface OfficerHidden {
  compatibility: number;
  righteousness: number;
  ambition: number;
  valor: number;
  composure: number;
  lifespan: number;
  growth: GrowthPotential;
  personality: Personality;
  ideal: Ideal;
  bloodline: number[];
  ceilingBonus: CeilingBonus | null;
  power: number;
  burst: number;
  agility: number;
  luck: number;
  intuition: number;
  awe: number;
  strategy: number;
  tactics: number;
}

export interface OfficerSkillStatic {
  skillId: SkillType;
  level: number;
}

export interface OfficerSkill extends OfficerSkillStatic {
  useCount: number;
}

/** Static JSON record (officers.json) */
export interface OfficerStatic {
  id: number;
  name: string;
  birthYear: number;
  deathYear: number;
  stats: OfficerStats;
  hidden: OfficerHidden;
  unitProficiency: Partial<Record<UnitType, UnitProficiency>>;
  formationMastery: number[];
  skills: OfficerSkillStatic[];
  uniqueSkill?: SkillType;
  tags: string[];           // 出身标签（社会·地域·职业·政治·特殊）
}

/** Runtime officer entity */
export interface Officer extends OfficerStatic {
  faction: number | null;
  location: number | null;
  loyalty: number;
  experience: number;
  status: OfficerStatus;
  skills: OfficerSkill[];
  civilPosition: CivilPosition;
  localPosition: LocalPosition;
  militaryPosition: MilitaryPosition;
  nobilityRank: NobilityRank;
  merit: number;
  stamina: number;
  /** 正妻女性 id（婚配）；面板不展示隐藏加成 */
  wifeId?: number | null;
  /** 赏赐美人（非婚配）女性 id 列表 */
  beauties: number[];
}
