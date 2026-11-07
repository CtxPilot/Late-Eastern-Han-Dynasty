// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { UnitType } from './enums/index.js';

/**
 * 兵种默认克制关系表（真源来自 units.json / 08-data-dictionary）
 * 攻方克制守方 → 1.3；被克制 → 0.7；互无关系 → 1.0
 */
export const DEFAULT_STRONG_AGAINST_MAP: Record<string, UnitType[]> = {
  [UnitType.LIGHT_INFANTRY]: [UnitType.ARCHER],
  [UnitType.HEAVY_INFANTRY]: [UnitType.SPEARMAN],
  [UnitType.SPEARMAN]: [UnitType.LIGHT_CAVALRY, UnitType.HEAVY_CAVALRY],
  [UnitType.ARCHER]: [UnitType.HEAVY_INFANTRY],
  [UnitType.LIGHT_CAVALRY]: [UnitType.ARCHER],
  [UnitType.HEAVY_CAVALRY]: [UnitType.LIGHT_INFANTRY, UnitType.HEAVY_INFANTRY],
  [UnitType.LIGHT_NAVY]: [UnitType.MEDIUM_NAVY],
  [UnitType.MEDIUM_NAVY]: [UnitType.LIGHT_NAVY, UnitType.ARCHER],
  [UnitType.HEAVY_NAVY]: [UnitType.LIGHT_NAVY, UnitType.MEDIUM_NAVY, UnitType.LIGHT_INFANTRY],
  [UnitType.CROSSBOWMAN]: [UnitType.LIGHT_CAVALRY, UnitType.HEAVY_CAVALRY],
  [UnitType.HORSE_ARCHER]: [UnitType.ARCHER, UnitType.CROSSBOWMAN],
  [UnitType.SIEGE]: [],
  [UnitType.TIGER_LEOPARD]: [UnitType.LIGHT_INFANTRY, UnitType.ARCHER],
  [UnitType.QINGZHOU]: [],
  [UnitType.TRAPPED_CAMP]: [UnitType.LIGHT_INFANTRY, UnitType.HEAVY_INFANTRY],
  [UnitType.WHITE_HORSE]: [UnitType.ARCHER, UnitType.CROSSBOWMAN],
  [UnitType.XILIANG_IRON]: [UnitType.LIGHT_INFANTRY, UnitType.HEAVY_INFANTRY, UnitType.ARCHER],
  [UnitType.DANYANG]: [UnitType.LIGHT_INFANTRY],
  [UnitType.JIEFAN]: [UnitType.LIGHT_CAVALRY],
  [UnitType.WHITE_EAR]: [UnitType.LIGHT_CAVALRY, UnitType.HEAVY_CAVALRY],
  [UnitType.WUDANG_FLYING]: [UnitType.ARCHER, UnitType.CROSSBOWMAN],
  [UnitType.RATTAN_ARMOR]: [UnitType.LIGHT_INFANTRY, UnitType.ARCHER],
  [UnitType.ELEPHANT]: [UnitType.LIGHT_INFANTRY, UnitType.HEAVY_INFANTRY, UnitType.SPEARMAN, UnitType.ARCHER, UnitType.CROSSBOWMAN],
  [UnitType.YELLOW_TURBAN]: [],
};

/**
 * 兵种克制系数计算纯函数
 * @param attackerType 攻方兵种
 * @param defenderType 守方兵种
 * @param strongAgainst 克制映射字典（可选，默认使用全量真源表）
 * @returns 1.3 (克制) | 0.7 (被克) | 1.0 (均衡)
 */
export function getUnitMatchup(
  attackerType: UnitType | string,
  defenderType: UnitType | string,
  strongAgainst: Record<string, UnitType[]> = DEFAULT_STRONG_AGAINST_MAP,
): number {
  const strong = strongAgainst[attackerType] ?? [];
  const weak = strongAgainst[defenderType] ?? [];
  if (strong.includes(defenderType as UnitType)) return 1.3;
  if (weak.includes(attackerType as UnitType)) return 0.7;
  return 1.0;
}

export interface UnitMatchupInfo {
  modifier: number;
  label: string;
  isAdvantage: boolean;
  isDisadvantage: boolean;
  color: string;
}

/**
 * 提取兵种克制情报（用于 UI 飘字与印信标记）
 */
export function getUnitMatchupInfo(
  attackerType: UnitType | string,
  defenderType: UnitType | string,
  strongAgainst: Record<string, UnitType[]> = DEFAULT_STRONG_AGAINST_MAP,
): UnitMatchupInfo {
  const modifier = getUnitMatchup(attackerType, defenderType, strongAgainst);
  if (modifier > 1.05) {
    return {
      modifier,
      label: '克制',
      isAdvantage: true,
      isDisadvantage: false,
      color: '#fbbf24', // 琥珀金
    };
  }
  if (modifier < 0.95) {
    return {
      modifier,
      label: '被克',
      isAdvantage: false,
      isDisadvantage: true,
      color: '#94a3b8', // 灰蓝
    };
  }
  return {
    modifier: 1.0,
    label: '均衡',
    isAdvantage: false,
    isDisadvantage: false,
    color: '#e2e8f0', // 宣纸白
  };
}

export type UnitCategory = 'infantry' | 'cavalry' | 'archer' | 'navy' | 'special';

export interface UnitMeleeBadge {
  char: string;
  name: string;
  category: UnitCategory;
  shape: 'circle' | 'square' | 'diamond' | 'shield';
  color: string;
}

export const UNIT_MELEE_BADGES: Record<string, UnitMeleeBadge> = {
  [UnitType.LIGHT_INFANTRY]: { char: '步', name: '轻步兵', category: 'infantry', shape: 'square', color: '#94a3b8' },
  [UnitType.HEAVY_INFANTRY]: { char: '甲', name: '重步兵', category: 'infantry', shape: 'shield', color: '#64748b' },
  [UnitType.SPEARMAN]: { char: '枪', name: '长枪兵', category: 'infantry', shape: 'square', color: '#0ea5e9' },
  [UnitType.ARCHER]: { char: '弓', name: '短弓兵', category: 'archer', shape: 'circle', color: '#22c55e' },
  [UnitType.CROSSBOWMAN]: { char: '弩', name: '强弩兵', category: 'archer', shape: 'circle', color: '#16a34a' },
  [UnitType.LIGHT_CAVALRY]: { char: '轻', name: '轻骑兵', category: 'cavalry', shape: 'diamond', color: '#f59e0b' },
  [UnitType.HEAVY_CAVALRY]: { char: '重', name: '重骑兵', category: 'cavalry', shape: 'diamond', color: '#d97706' },
  [UnitType.HORSE_ARCHER]: { char: '射', name: '弓骑兵', category: 'cavalry', shape: 'diamond', color: '#eab308' },
  [UnitType.LIGHT_NAVY]: { char: '走', name: '走舸', category: 'navy', shape: 'square', color: '#38bdf8' },
  [UnitType.MEDIUM_NAVY]: { char: '蒙', name: '蒙冲', category: 'navy', shape: 'shield', color: '#0284c7' },
  [UnitType.HEAVY_NAVY]: { char: '楼', name: '楼船', category: 'navy', shape: 'shield', color: '#0369a1' },
  [UnitType.SIEGE]: { char: '器', name: '攻城器', category: 'special', shape: 'square', color: '#78716c' },
  [UnitType.TIGER_LEOPARD]: { char: '豹', name: '虎豹骑', category: 'cavalry', shape: 'diamond', color: '#dc2626' },
  [UnitType.QINGZHOU]: { char: '青', name: '青州兵', category: 'infantry', shape: 'shield', color: '#059669' },
  [UnitType.TRAPPED_CAMP]: { char: '陷', name: '陷阵营', category: 'infantry', shape: 'shield', color: '#b91c1c' },
  [UnitType.WHITE_HORSE]: { char: '白', name: '白马义从', category: 'cavalry', shape: 'diamond', color: '#f8fafc' },
  [UnitType.XILIANG_IRON]: { char: '凉', name: '西凉铁骑', category: 'cavalry', shape: 'diamond', color: '#7c2d12' },
  [UnitType.DANYANG]: { char: '丹', name: '丹阳精兵', category: 'infantry', shape: 'square', color: '#ea580c' },
  [UnitType.JIEFAN]: { char: '烦', name: '解烦营', category: 'infantry', shape: 'square', color: '#c026d3' },
  [UnitType.WHITE_EAR]: { char: '毦', name: '白毦兵', category: 'infantry', shape: 'shield', color: '#e2e8f0' },
  [UnitType.WUDANG_FLYING]: { char: '当', name: '无当飞军', category: 'archer', shape: 'circle', color: '#15803d' },
  [UnitType.RATTAN_ARMOR]: { char: '藤', name: '藤甲兵', category: 'infantry', shape: 'shield', color: '#854d0e' },
  [UnitType.ELEPHANT]: { char: '象', name: '战象', category: 'special', shape: 'diamond', color: '#831843' },
  [UnitType.YELLOW_TURBAN]: { char: '巾', name: '黄巾义军', category: 'infantry', shape: 'square', color: '#eab308' },
};

/**
 * 提取兵种印信徽标信息
 */
export function getUnitMeleeBadge(unitType: UnitType | string): UnitMeleeBadge {
  return UNIT_MELEE_BADGES[unitType] ?? {
    char: '卒',
    name: '行伍士卒',
    category: 'infantry',
    shape: 'square',
    color: '#94a3b8',
  };
}
