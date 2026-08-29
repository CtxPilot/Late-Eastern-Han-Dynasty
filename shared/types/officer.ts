// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type {
  CeilingAttribute,
  GrowthPotential,
  Ideal,
  HegemonyPosition,
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
import type { Equipment } from './item.js';

/** 兵种使用/战法熟练记录（Session 350 proficiency 威力真源） */
export interface UnitUsageRecord {
  unitType: UnitType;
  battlesUsed: number;
  breakpointsHit: number;
  bestFormationMatches: number;
  /** proficiency 战法施放次数（含失手；扣气即计） */
  abilityUses: number;
}

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

/** 功绩文武分岔（docs/04 §十 6.2 Lv6 ★分岔）：由当前官职轨道派生（shared/merit.ts deriveMeritPath）。 */
export type MeritPath = 'warrior' | 'scholar' | 'neutral';

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
  tags: string[]           // 出身标签（社会·地域·职业·政治·特殊）
  /** 武将列传（由 docs/biographies/officer_{id}.md 合并，见 scripts/merge-biographies.ts） */
  biography?: string;
  /** 批次③（Session 409）P5-10：头像基因手工覆盖；未填者由 getAvatarGene 哈希派生（shared/avatar-gene.ts）。 */
  avatarGene?: import('../avatar-gene').AvatarGeneOverride;
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
  /** 霸府专属官职（docs/26 Q2 方案B，HC-P0-4 独立轨道）。非霸府势力武将该字段恒为空/none。 */
  hegemonyPosition?: HegemonyPosition;
  merit: number;
  /** 功绩等级 1~20，由 merit 反查 20 级表（shared/merit.ts meritLevelFor），merit 写入点同步 */
  meritLevel?: number;
  /** 生涯最高功绩等级，用于衰减退级底线（docs/04 §十 6.3） */
  peakMeritLevel?: number;
  /** 文武分岔：'warrior' | 'scholar' | 'neutral'（由官职轨道派生） */
  meritPath?: MeritPath;
  stamina: number;
  /** 每月可用行动次数（独立于体力）：决定"本月还能否发起新动作"，默认 1，可被技能/特性/装备加成突破。月度重置。 */
  actionsPerMonth?: number;
  /** 正妻女性 id（婚配）；面板不展示隐藏加成 */
  wifeId?: number | null;
  /** @deprecated 旧存档兼容字段。运行时必须为空，禁止写入具名女性。 */
  beauties: number[];
  /** 装备槽（0-A 5 槽：主武器/副武器/铠甲/坐骑/兵书；8+2 槽全量留 0-B，S13 Session 266 实装） */
  equipment?: Equipment;
  /** 技能树状态：nodeId → 当前等级（0=未解锁） */
  skillTreeState?: Record<string, number>;
  /** 已消耗的技能点数 */
  skillPointsSpent?: number;
  /** 特性等级状态：traitId → 当前等级（0=未拥有） */
  traitLevels?: Record<string, number>;
  /** 已消耗的特性点数 */
  traitPointsSpent?: number;
  /** 妾/姬列表（女性实体引用，数量不定） */
  consortIds?: { id: number; rank: 'concubine' | 'ji' }[];
  /**
   * 特殊兵种 / proficiency 战法使用次数（Session 350）。
   * optional：旧档缺省按 0 次起算；不升 schema 版本。
   */
  unitUsageRecords?: UnitUsageRecord[];
}
