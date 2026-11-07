// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P5-14 · 部队等级系统数字真源（0-A 切片，Session 456）。
 *
 * 设计真源：docs/04-game-systems.md §二十五 / docs/05-combat-system.md §5.6.1。
 * 本模块只负责「经验 → 等级 → 战斗投影」的纯函数；经验获取/补员稀释/训练
 * 等经济侧在后续切片接入，避免本轮触碰战役 RNG 与存档金样。
 *
 * 0-A 投影范围：攻击/防御百分比、暴击率百分点、士气上限（展示用，战斗内
 * `BattleUnit.morale` 仍受 0~100 Schema 夹紧）。
 */

export const TROOP_LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1800, 3000] as const;
export const TROOP_LEVEL_NAMES = ['新卒', '训练兵', '老兵', '劲旅', '精锐', '百战', '铁军'] as const;
export const TROOP_LEVEL_ATTACK_PCT = [0, 5, 10, 15, 20, 25, 30] as const;
export const TROOP_LEVEL_DEFENSE_PCT = [0, 5, 10, 15, 20, 25, 30] as const;
/** Lv4 +2%、Lv5 +4%；Lv6/7 不再叠加（0-A 口径）。 */
export const TROOP_LEVEL_CRIT_PCT = [0, 0, 0, 2, 4, 4, 4] as const;
export const TROOP_LEVEL_MORALE_CAP = [100, 105, 110, 115, 120, 125, 130] as const;

export interface TroopLevelInfo {
  level: number;
  name: string;
  attackPct: number;
  defensePct: number;
  critPct: number;
  moraleCap: number;
  /** 当前等级阈值；下一等级阈值（满级为 null）。 */
  currentThreshold: number;
  nextThreshold: number | null;
}

/** 经验值 → 等级（1~7）；负值按 0 处理。 */
export function troopLevelFor(experience: number): number {
  const xp = Math.max(0, Math.floor(experience));
  let level = 1;
  for (let i = 0; i < TROOP_LEVEL_THRESHOLDS.length; i++) {
    if (xp >= TROOP_LEVEL_THRESHOLDS[i]!) level = i + 1;
  }
  return level;
}

/** 经验值 → 完整等级投影。 */
export function troopLevelInfo(experience: number): TroopLevelInfo {
  const xp = Math.max(0, Math.floor(experience));
  const level = troopLevelFor(xp);
  const idx = level - 1;
  return {
    level,
    name: TROOP_LEVEL_NAMES[idx]!,
    attackPct: TROOP_LEVEL_ATTACK_PCT[idx]!,
    defensePct: TROOP_LEVEL_DEFENSE_PCT[idx]!,
    critPct: TROOP_LEVEL_CRIT_PCT[idx]!,
    moraleCap: TROOP_LEVEL_MORALE_CAP[idx]!,
    currentThreshold: TROOP_LEVEL_THRESHOLDS[idx]!,
    nextThreshold: idx + 1 < TROOP_LEVEL_THRESHOLDS.length ? TROOP_LEVEL_THRESHOLDS[idx + 1]! : null,
  };
}

/** 战报/HUD 展示用：`Lv4 劲旅`。 */
export function troopLevelLabel(experience: number): string {
  const info = troopLevelInfo(experience);
  return `Lv${info.level} ${info.name}`;
}

/** Lv6「百战」起士气战斗下限（§25.1：士气永不低于 50）。 */
export const TROOP_LEVEL_MORALE_FLOOR = 50;

/** 战斗内士气下限：Lv6+ 为 50，其余 0。 */
export function troopMoraleFloor(experience: number): number {
  return troopLevelFor(experience) >= 6 ? TROOP_LEVEL_MORALE_FLOOR : 0;
}

/**
 * 部队全灭后的经验（§25.2）：普通部队归零；Lv7 铁军保留 30%。
 * 未全灭时调用方不应调用本函数。
 */
export function troopXpAfterWipe(experience: number): number {
  const xp = Math.max(0, Math.floor(experience));
  return troopLevelFor(xp) >= 7 ? Math.floor(xp * 0.3) : 0;
}

/**
 * 补员稀释（§25.3）：新经验 = (旧兵数×旧xp + 新兵数×0) / (旧兵数+新兵数)。
 * 纯函数便于后续城市补员/训练切片直接复用。
 */
export function dilutedTroopXp(oldTroops: number, oldXp: number, newTroops: number): number {
  const oldCount = Math.max(0, Math.floor(oldTroops));
  const newCount = Math.max(0, Math.floor(newTroops));
  const total = oldCount + newCount;
  if (total <= 0) return 0;
  return Math.floor((oldCount * Math.max(0, oldXp)) / total);
}

/** 以少胜多判定阈值：敌方初始兵力 ≥ 我方 1.3 倍。 */
export const TROOP_XP_OUTNUMBERED_RATIO = 1.3;
/** 战果经验常量（§25.2 / 05 §5.6.1）。 */
export const TROOP_XP_PARTICIPATION = 20;
export const TROOP_XP_PER_KILL = 30;
export const TROOP_XP_COMMANDER_KILL = 50;
export const TROOP_XP_OUTNUMBERED_MULT = 1.3;
export const TROOP_XP_VICTORY_MULT = 1.5;

export interface TroopBattleXpInput {
  /** 当前累计经验（用于全灭归零 / 铁军保留判定）。 */
  currentXp: number;
  /** 本方是否仍有存活单位。 */
  survived: boolean;
  /** 本方是否获胜。 */
  victory: boolean;
  /** 击破敌方单位数。 */
  kills: number;
  /** 是否击斩/俘获敌方主将。 */
  commanderKilled?: boolean;
  /** 敌方初始总兵力是否 ≥ 我方 1.3 倍。 */
  outnumbered?: boolean;
  /** 本方主将统率（0~100），最终经验 ×(1+统/200)。 */
  leadership?: number;
}

/**
 * 单场战斗获得的部队经验（§25.2）。返回「新增经验」而非累计值；
 * 全灭时返回全灭后的绝对经验（普通 0，Lv7 铁军保留 30%），调用方应直接覆盖。
 */
export function troopBattleXpGain(input: TroopBattleXpInput): number {
  if (!input.survived) return troopXpAfterWipe(input.currentXp);
  let xp = TROOP_XP_PARTICIPATION;
  xp += Math.max(0, Math.floor(input.kills)) * TROOP_XP_PER_KILL;
  if (input.commanderKilled) xp += TROOP_XP_COMMANDER_KILL;
  if (input.outnumbered) xp *= TROOP_XP_OUTNUMBERED_MULT;
  if (input.victory) xp *= TROOP_XP_VICTORY_MULT;
  xp *= 1 + Math.max(0, Math.min(100, input.leadership ?? 0)) / 200;
  return Math.max(0, Math.floor(xp));
}

/** 结算后的累计经验：存活 = 旧经验 + 新增；全灭 = 全灭后绝对经验。 */
export function troopXpAfterBattle(input: TroopBattleXpInput): number {
  if (!input.survived) return troopXpAfterWipe(input.currentXp);
  return Math.max(0, Math.floor(input.currentXp)) + troopBattleXpGain(input);
}

