// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 官职 Demo（S11/S12）：0-A 精简三轨标签与任命门槛
 * 全量 24/44 级见 04§九；此处仅枚举已实现子集。
 */
import {
  CivilPosition,
  HegemonyPosition,
  LocalPosition,
  MilitaryPosition,
} from './enums/index.js';
import type { OfficerStats } from './types/common.js';

export type PositionTrack = 'civil' | 'local' | 'military' | 'hegemony';

export interface PositionReq {
  leadership?: number;
  war?: number;
  intelligence?: number;
  politics?: number;
  charisma?: number;
  /** 功绩等级门槛（S12，docs/04 §十；0-A 精简数值待平衡） */
  meritLevel?: number;
  /** 一势力唯一 */
  uniqueFaction?: boolean;
  /** 一城唯一（需 cityId） */
  uniqueCity?: boolean;
  /** 任命时必须指定城 */
  needsCity?: boolean;
}

export const CIVIL_LABELS: Record<CivilPosition, string> = {
  [CivilPosition.NONE]: '无',
  [CivilPosition.CLERK]: '书吏',
  [CivilPosition.MAGISTRATE]: '县令',
  [CivilPosition.PREFECT]: '郡守',
  [CivilPosition.GOVERNOR]: '都督',
  [CivilPosition.CHANCELLOR]: '丞相',
};

export const LOCAL_LABELS: Record<LocalPosition, string> = {
  [LocalPosition.NONE]: '无',
  [LocalPosition.ADVISOR]: '军师',
  [LocalPosition.INTENDANT]: '从事',
  [LocalPosition.PREFECT]: '太守',
};

export const MILITARY_LABELS: Record<MilitaryPosition, string> = {
  [MilitaryPosition.NONE]: '无',
  [MilitaryPosition.CAPTAIN]: '军候',
  [MilitaryPosition.COLONEL]: '校尉',
  [MilitaryPosition.GENERAL]: '将军',
  [MilitaryPosition.GRAND_GENERAL]: '大将军',
};

export const HEGEMONY_LABELS: Record<HegemonyPosition, string> = {
  [HegemonyPosition.NONE]: '无',
  [HegemonyPosition.GRAND_COMMANDER]: '大司马',
  [HegemonyPosition.REGENT_SECRETARY]: '录尚书事',
  [HegemonyPosition.GRAND_CAPTAIN]: '都督中外诸军事',
  [HegemonyPosition.KINGDOM_CHANCELLOR]: '王国相',
  [HegemonyPosition.KINGDOM_INTERIOR_MINISTER]: '内史',
  [HegemonyPosition.KINGDOM_COMMANDANT]: '中尉',
  [HegemonyPosition.KINGDOM_GENTLEMAN_STEWARD]: '郎中令',
  [HegemonyPosition.KINGDOM_AGRICULTURE_MINISTER]: '大司农',
  [HegemonyPosition.KINGDOM_COACH_MINISTER]: '太仆',
};

export const CIVIL_REQ: Partial<Record<CivilPosition, PositionReq>> = {
  [CivilPosition.CLERK]: { politics: 30 },
  [CivilPosition.MAGISTRATE]: { politics: 50, intelligence: 40, meritLevel: 2 },
  [CivilPosition.PREFECT]: { politics: 60, leadership: 50, meritLevel: 3 },
  [CivilPosition.GOVERNOR]: {
    leadership: 90,
    intelligence: 80,
    meritLevel: 5,
    uniqueFaction: true,
  },
  [CivilPosition.CHANCELLOR]: {
    politics: 80,
    intelligence: 70,
    meritLevel: 6,
    uniqueFaction: true,
  },
};

export const LOCAL_REQ: Partial<Record<LocalPosition, PositionReq>> = {
  [LocalPosition.INTENDANT]: { politics: 40, needsCity: true },
  [LocalPosition.ADVISOR]: {
    intelligence: 90,
    meritLevel: 4,
    uniqueFaction: true,
  },
  [LocalPosition.PREFECT]: {
    leadership: 70,
    politics: 60,
    meritLevel: 3,
    needsCity: true,
    uniqueCity: true,
  },
};

export const MILITARY_REQ: Partial<Record<MilitaryPosition, PositionReq>> = {
  [MilitaryPosition.CAPTAIN]: { leadership: 30, war: 30 },
  [MilitaryPosition.COLONEL]: { leadership: 50, war: 50, meritLevel: 2 },
  [MilitaryPosition.GENERAL]: { leadership: 70, war: 60, meritLevel: 3 },
  [MilitaryPosition.GRAND_GENERAL]: {
    leadership: 85,
    war: 80,
    meritLevel: 6,
    uniqueFaction: true,
  },
};

/**
 * 霸府专属官职门槛（docs/26 Q2 方案B，HC-P0-4）。
 * 三档均为霸府核心权力顶点，参照大将军/军师/丞相/都督采用势力唯一。
 * 门槛与最高级武官/文官持平，确保仅顶级武将可任。
 */
export const HEGEMONY_REQ: Partial<Record<HegemonyPosition, PositionReq>> = {
  [HegemonyPosition.GRAND_COMMANDER]: {
    leadership: 85,
    war: 75,
    meritLevel: 6,
    uniqueFaction: true,
  },
  [HegemonyPosition.REGENT_SECRETARY]: {
    politics: 80,
    intelligence: 75,
    meritLevel: 6,
    uniqueFaction: true,
  },
  [HegemonyPosition.GRAND_CAPTAIN]: {
    leadership: 85,
    war: 80,
    meritLevel: 6,
    uniqueFaction: true,
  },
  [HegemonyPosition.KINGDOM_CHANCELLOR]: {
    politics: 85,
    intelligence: 80,
    meritLevel: 6,
    uniqueFaction: true,
  },
  [HegemonyPosition.KINGDOM_INTERIOR_MINISTER]: {
    politics: 80,
    charisma: 70,
    meritLevel: 4,
    uniqueFaction: true,
  },
  [HegemonyPosition.KINGDOM_COMMANDANT]: {
    leadership: 80,
    war: 75,
    meritLevel: 4,
    uniqueFaction: true,
  },
  [HegemonyPosition.KINGDOM_GENTLEMAN_STEWARD]: {
    leadership: 75,
    charisma: 75,
    meritLevel: 4,
    uniqueFaction: true,
  },
  [HegemonyPosition.KINGDOM_AGRICULTURE_MINISTER]: {
    politics: 80,
    intelligence: 75,
    meritLevel: 5,
    uniqueFaction: true,
  },
  [HegemonyPosition.KINGDOM_COACH_MINISTER]: {
    leadership: 75,
    politics: 70,
    meritLevel: 5,
    uniqueFaction: true,
  },
};

export const KINGDOM_POSITIONS = [
  HegemonyPosition.KINGDOM_CHANCELLOR,
  HegemonyPosition.KINGDOM_INTERIOR_MINISTER,
  HegemonyPosition.KINGDOM_COMMANDANT,
  HegemonyPosition.KINGDOM_GENTLEMAN_STEWARD,
  HegemonyPosition.KINGDOM_AGRICULTURE_MINISTER,
  HegemonyPosition.KINGDOM_COACH_MINISTER,
] as const;

export function isKingdomPosition(position: string): position is HegemonyPosition {
  return (KINGDOM_POSITIONS as readonly string[]).includes(position);
}

export function meetsPositionReq(stats: OfficerStats, req: PositionReq, meritLevel?: number): boolean {
  if (req.leadership != null && stats.leadership < req.leadership) return false;
  if (req.war != null && stats.war < req.war) return false;
  if (req.intelligence != null && stats.intelligence < req.intelligence) return false;
  if (req.politics != null && stats.politics < req.politics) return false;
  if (req.charisma != null && stats.charisma < req.charisma) return false;
  // 功绩门槛仅在调用方显式传入 meritLevel 时检查（未传 = 不检查功绩）
  if (req.meritLevel != null && meritLevel != null && meritLevel < req.meritLevel) return false;
  return true;
}

export function formatReq(req: PositionReq): string {
  const parts: string[] = [];
  if (req.leadership != null) parts.push(`统≥${req.leadership}`);
  if (req.war != null) parts.push(`武≥${req.war}`);
  if (req.intelligence != null) parts.push(`智≥${req.intelligence}`);
  if (req.politics != null) parts.push(`政≥${req.politics}`);
  if (req.charisma != null) parts.push(`魅≥${req.charisma}`);
  if (req.meritLevel != null) parts.push(`功绩Lv${req.meritLevel}`);
  return parts.join(' ') || '无门槛';
}

export function positionLabel(
  track: PositionTrack,
  position: string,
): string {
  if (track === 'civil') return CIVIL_LABELS[position as CivilPosition] ?? position;
  if (track === 'local') return LOCAL_LABELS[position as LocalPosition] ?? position;
  if (track === 'military') return MILITARY_LABELS[position as MilitaryPosition] ?? position;
  return HEGEMONY_LABELS[position as HegemonyPosition] ?? position;
}
