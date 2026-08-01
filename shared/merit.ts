// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S12 功绩等级系统（docs/04 §十 6.1~6.3）。
 *
 * 20 级统一功绩体系（统一文武晋升，文武各有侧重）：
 * - 等级由 `merit`（累计功绩）反查 20 级表派生；
 * - 等级表提供武/文称号、带兵+、里程碑属性/技能/特殊效果；
 * - 功绩衰减：70 岁+ 每季 -0.3%，75 岁+ -0.5%，80 岁+ -1.0%，
 *   保底 = min(10, peakMeritLevel)（生涯最高等级作为衰减退级底线）。
 *
 * 0-A 实装边界（Session 265 更新）：等级/称号/进度为完整实现；等级表
 * "属性/技能/特殊效果"的运行时数值消费已接入——属性加成（Lv5 体上限+3、
 * Lv15/16/17/20 属性+，经 `meritAttrBonusFor` 累计，Lv16 按文武分岔）、
 * 特殊效果（Lv3/4/6 单挑与开发加成、Lv9 暴率/内政效率、Lv12 被俘-20%、
 * Lv14 适性+1、Lv20 体力恢复+5/月，经 `meritEffects`）、带兵+ 接出征上限
 * （`formationTroopCap`）。依赖未实装引擎的效果（自荐官职/声望/自选技能/
 * 指挥部队数/忠诚系列/专属技/再动/双主武器）仍后置。
 */
import type { Officer, MeritPath } from './types/officer.js';
import type { OfficerStats } from './types/common.js';
import {
  CivilPosition,
  HegemonyPosition,
  LocalPosition,
  MilitaryPosition,
} from './enums/index.js';

/** 20 级等级表（docs/04 §十 6.2 数据真源） */
export interface MeritLevelEntry {
  level: number;
  /** 达到本级所需累计功绩（含本级下限） */
  threshold: number;
  titleWar: string;
  titleScholar: string;
  /** 带兵+（出征上限等消费点后置接入） */
  troopBonus: number;
  /** 里程碑属性加成（Lv5 体上限+3 / Lv15 全+3 / Lv16 武统或文政+5 / Lv17 全+5 / Lv20 全+8） */
  attrBonus: Partial<Record<'war' | 'leadership' | 'intelligence' | 'politics' | 'charisma' | 'stamina', number>> | null;
  /** 等级特殊效果说明（展示用；运行时数值消费后置） */
  special: string | null;
}

export const MERIT_LEVELS: readonly MeritLevelEntry[] = [
  { level: 1,  threshold: 0,      titleWar: '白身',   titleScholar: '白身',   troopBonus: 0,     attrBonus: null, special: null },
  { level: 2,  threshold: 50,     titleWar: '新锐',   titleScholar: '新锐',   troopBonus: 200,   attrBonus: null, special: null },
  { level: 3,  threshold: 150,    titleWar: '精兵',   titleScholar: '文吏',   troopBonus: 400,   attrBonus: null, special: '武：单挑+5% / 文：开发+5%' },
  { level: 4,  threshold: 350,    titleWar: '骁勇',   titleScholar: '干练',   troopBonus: 600,   attrBonus: null, special: '武：单挑+10% / 文：开发+10%' },
  { level: 5,  threshold: 700,    titleWar: '豪杰',   titleScholar: '贤士',   troopBonus: 800,   attrBonus: { stamina: 3 }, special: '可自荐官职' },
  { level: 6,  threshold: 1200,   titleWar: '良将',   titleScholar: '能吏',   troopBonus: 1000,  attrBonus: null, special: '★文武分岔：武单挑+15% / 文内政+10%' },
  { level: 7,  threshold: 2000,   titleWar: '勇将',   titleScholar: '干吏',   troopBonus: 1200,  attrBonus: null, special: '忠诚降速-20%' },
  { level: 8,  threshold: 3200,   titleWar: '名将',   titleScholar: '名臣',   troopBonus: 1500,  attrBonus: null, special: '势力声望+5（永久）' },
  { level: 9,  threshold: 5000,   titleWar: '虎将',   titleScholar: '贤臣',   troopBonus: 1800,  attrBonus: null, special: '武：暴率+5% / 文：内政效率+10%' },
  { level: 10, threshold: 7500,   titleWar: '英雄',   titleScholar: '国士',   troopBonus: 2200,  attrBonus: null, special: '+1 自选技能 · 重要门槛' },
  { level: 11, threshold: 11000,  titleWar: '英杰',   titleScholar: '国辅',   troopBonus: 2600,  attrBonus: null, special: '可指挥部队数+1' },
  { level: 12, threshold: 16000,  titleWar: '忠勇',   titleScholar: '忠良',   troopBonus: 3000,  attrBonus: null, special: '被俘概率-20%' },
  { level: 13, threshold: 23000,  titleWar: '威名',   titleScholar: '德望',   troopBonus: 3500,  attrBonus: null, special: '同级以下忠诚+1/季（光环）' },
  { level: 14, threshold: 32000,  titleWar: '百战',   titleScholar: '经国',   troopBonus: 4000,  attrBonus: null, special: '全兵种适性+1级' },
  { level: 15, threshold: 45000,  titleWar: '虎威',   titleScholar: '国柱',   troopBonus: 5000,  attrBonus: { war: 3, leadership: 3, intelligence: 3, politics: 3, charisma: 3 }, special: null },
  { level: 16, threshold: 62000,  titleWar: '万人敌', titleScholar: '王佐',   troopBonus: 6000,  attrBonus: { war: 5, leadership: 5, politics: 5 }, special: null },
  { level: 17, threshold: 85000,  titleWar: '千古',   titleScholar: '国器',   troopBonus: 7500,  attrBonus: { war: 5, leadership: 5, intelligence: 5, politics: 5, charisma: 5 }, special: null },
  { level: 18, threshold: 115000, titleWar: '盖世',   titleScholar: '无双',   troopBonus: 9000,  attrBonus: null, special: '专属技效果+50%' },
  { level: 19, threshold: 155000, titleWar: '不世出', titleScholar: '社稷',   troopBonus: 11000, attrBonus: null, special: '每击杀可再动 1 次' },
  { level: 20, threshold: 210000, titleWar: '天下第一', titleScholar: '天下第一', troopBonus: 15000, attrBonus: { war: 8, leadership: 8, intelligence: 8, politics: 8, charisma: 8 }, special: '双主武器 / 体力恢复+5/月 / 全忠诚+2' },
] as const;

export const MAX_MERIT_LEVEL = MERIT_LEVELS[MERIT_LEVELS.length - 1].level;

/** 老将衰减保底等级（docs/04 §十 6.3：最低保留 Lv10；未到过 Lv10 者按其生涯峰值保底） */
export const MERIT_DECAY_FLOOR_LEVEL = 10;

/** 由累计功绩反查等级（1~20） */
export function meritLevelFor(merit: number): number {
  const m = Math.max(0, Math.floor(merit));
  let level = 1;
  for (const entry of MERIT_LEVELS) {
    if (m >= entry.threshold) level = entry.level;
  }
  return level;
}

export function meritEntry(level: number): MeritLevelEntry {
  const clamped = Math.min(MAX_MERIT_LEVEL, Math.max(1, Math.floor(level)));
  return MERIT_LEVELS[clamped - 1];
}

/** 当前等级称号（按文武分岔） */
export function meritTitle(level: number, path: MeritPath): string {
  const entry = meritEntry(level);
  if (path === 'warrior') return entry.titleWar;
  if (path === 'scholar') return entry.titleScholar;
  // neutral：武/文称号相同时取之，否则返回「LvN + 白身」
  return entry.titleWar === entry.titleScholar ? entry.titleWar : `白身`;
}

/** 带兵+（消费点：04 §7.5 出征上限公式 后置接入，当前仅供展示） */
export function meritTroopBonus(level: number): number {
  return meritEntry(level).troopBonus;
}

/** 里程碑属性加成（Lv5 体上限+3 等；消费点后置，当前仅供展示） */
export function meritAttrBonus(level: number): MeritLevelEntry['attrBonus'] {
  return meritEntry(level).attrBonus;
}

/** 下一级所需累计功绩（Lv20 返回 null，表示已满级） */
export function meritNextThreshold(merit: number): { level: number; threshold: number } | null {
  const level = meritLevelFor(merit);
  const next = MERIT_LEVELS[level]; // level 是 1-based，数组索引即下一级
  return next ? { level: next.level, threshold: next.threshold } : null;
}

/**
 * 功绩衰减（docs/04 §十 6.3）：按年龄档位每季扣除比例，
 * 保底 = min(10, peakMeritLevel)。返回衰减后的功绩数值。
 */
export function applyMeritDecay(
  merit: number,
  peakMeritLevel: number,
  age: number,
  quarters: number = 1,
): number {
  if (age < 70 || quarters <= 0) return Math.max(0, Math.floor(merit));
  const rate = age >= 80 ? 0.01 : age >= 75 ? 0.005 : 0.003;
  let m = merit;
  for (let i = 0; i < quarters; i += 1) {
    m = m * (1 - rate);
  }
  const floor = Math.min(MERIT_DECAY_FLOOR_LEVEL, Math.max(1, peakMeritLevel));
  const floorMerit = meritEntry(floor).threshold;
  return Math.max(floorMerit, Math.floor(m));
}

/** 文武分岔（docs/04 §十 6.2 Lv6 ★分岔）：按当前官职轨道派生。 */
export function deriveMeritPath(officer: Pick<Officer, 'civilPosition' | 'localPosition' | 'militaryPosition' | 'hegemonyPosition'>): MeritPath {
  const m = officer.militaryPosition ?? MilitaryPosition.NONE;
  if (m !== MilitaryPosition.NONE) return 'warrior';
  const h = officer.hegemonyPosition ?? HegemonyPosition.NONE;
  if (h === HegemonyPosition.GRAND_COMMANDER
    || h === HegemonyPosition.GRAND_CAPTAIN
    || h === HegemonyPosition.KINGDOM_COMMANDANT
    || h === HegemonyPosition.KINGDOM_GENTLEMAN_STEWARD
    || h === HegemonyPosition.KINGDOM_COACH_MINISTER) {
    return 'warrior';
  }
  const c = officer.civilPosition ?? CivilPosition.NONE;
  const l = officer.localPosition ?? LocalPosition.NONE;
  if (c !== CivilPosition.NONE || l !== LocalPosition.NONE) return 'scholar';
  return 'neutral';
}

/**
 * 同步功绩派生三字段（merit 变化后调用）：
 * meritLevel / peakMeritLevel（生涯最高）/ meritPath（官职轨道派生）。
 */
export function syncMerit(officer: Officer): Officer {
  const level = meritLevelFor(officer.merit);
  const peak = Math.max(officer.peakMeritLevel ?? level, level);
  return {
    ...officer,
    meritLevel: level,
    peakMeritLevel: peak,
    meritPath: deriveMeritPath(officer),
  };
}

/** 发放功绩（统一入口：merit += amount 并同步三字段）。amount 为非负整数。 */
export function grantMerit(officer: Officer, amount: number): Officer {
  const next = { ...officer, merit: (officer.merit ?? 0) + Math.max(0, Math.floor(amount)) };
  return syncMerit(next);
}

// =====================================================================
// 等级表数值消费（Session 265 实装；docs/04 §十 6.2）
// =====================================================================

/** 属性加成可作用维度（含体力上限维度 stamina） */
export type MeritAttrStat = keyof OfficerStats | 'stamina';

/**
 * 等级表里程碑属性加成累计（docs/04 §十 6.2 表"属性"列）：
 * Lv5 体上限+3 · Lv15 全属性+3 · Lv16 文武分岔（武:统+5 / 文:政+5，
 * neutral 按数据表全量 war/leadership/politics+5）· Lv17 全属性+5 ·
 * Lv20 全属性+8。多等级加成累计叠加。
 */
export function meritAttrBonusFor(
  officer: { merit?: number; meritLevel?: number; meritPath?: MeritPath },
): Partial<Record<MeritAttrStat, number>> {
  const level = officer.meritLevel ?? meritLevelFor(officer.merit ?? 0);
  const path = officer.meritPath ?? 'neutral';
  const acc: Partial<Record<MeritAttrStat, number>> = {};
  const add = (stat: MeritAttrStat, value: number) => {
    acc[stat] = (acc[stat] ?? 0) + value;
  };
  for (const entry of MERIT_LEVELS) {
    if (entry.level > level) break;
    if (!entry.attrBonus) continue;
    if (entry.level === 16) {
      // ★文武分岔（docs/04 §十 6.2 Lv16：武:统+5 / 文:政+5）
      if (path === 'warrior') add('leadership', 5);
      else if (path === 'scholar') add('politics', 5);
      else {
        add('war', 5);
        add('leadership', 5);
        add('politics', 5);
      }
    } else {
      for (const [stat, value] of Object.entries(entry.attrBonus)) {
        add(stat as MeritAttrStat, value as number);
      }
    }
  }
  return acc;
}

/** 等级表特殊效果数值（docs/04 §十 6.2 表"特殊"列，分岔按 meritPath） */
export interface MeritEffects {
  /** 单挑伤害加成（武 Lv3/4/6：+5%/+10%/+15%） */
  duelBonus: number;
  /** 开发效率加成——持续项目（农/商/城）结算增益（文 Lv3/4：+5%/+10%） */
  developBonus: number;
  /** 内政效率加成——施米/征兵/训练即时效果增益（文 Lv6/9：+10%） */
  civilEfficiency: number;
  /** 暴击率加成（武 Lv9：+5%） */
  critBonus: number;
  /** 被俘概率减免（Lv12：-20%） */
  captureResist: number;
  /** 全兵种适性+1 级（Lv14；NONE→C→B→A→S，S 封顶） */
  proficiencyBoost: number;
  /** 每月体力恢复加成（Lv20：+5/月，封顶体力上限） */
  staminaRecovery: number;
}

/** 由等级 + 文武分岔查询特殊效果数值（未达等级返回 0） */
export function meritEffects(level: number, path: MeritPath = 'neutral'): MeritEffects {
  const lv = Math.min(MAX_MERIT_LEVEL, Math.max(1, Math.floor(level)));
  const warrior = path === 'warrior';
  const scholar = path === 'scholar';
  return {
    duelBonus: warrior ? (lv >= 6 ? 0.15 : lv >= 4 ? 0.10 : lv >= 3 ? 0.05 : 0) : 0,
    developBonus: scholar ? (lv >= 4 ? 0.10 : lv >= 3 ? 0.05 : 0) : 0,
    civilEfficiency: scholar ? (lv >= 9 ? 0.10 : lv >= 6 ? 0.10 : 0) : 0,
    critBonus: warrior && lv >= 9 ? 0.05 : 0,
    captureResist: lv >= 12 ? 0.2 : 0,
    proficiencyBoost: lv >= 14 ? 1 : 0,
    staminaRecovery: lv >= 20 ? 5 : 0,
  };
}

/** 武官等级 rank（0-A 四级简化：军候 1 / 校尉 2 / 将军 3 / 大将军 4，无=0） */
export function militaryPositionRank(position: MilitaryPosition): number {
  switch (position) {
    case MilitaryPosition.CAPTAIN: return 1;
    case MilitaryPosition.COLONEL: return 2;
    case MilitaryPosition.GENERAL: return 3;
    case MilitaryPosition.GRAND_GENERAL: return 4;
    default: return 0;
  }
}

/**
 * 出征上限（docs/04 §7.5 + 6.2 带兵+，Session 265 实装）：
 *   cap = 5000 + 武官等级×500 + meritTroopBonus(level)
 * 实际出征数另受 min(城市驻军, cap) 约束（调用方校验）。
 */
export function formationTroopCap(
  officer: { militaryPosition?: MilitaryPosition; merit?: number; meritLevel?: number },
): number {
  const level = officer.meritLevel ?? meritLevelFor(officer.merit ?? 0);
  const rank = militaryPositionRank(officer.militaryPosition ?? MilitaryPosition.NONE);
  return 5000 + rank * 500 + meritTroopBonus(level);
}
