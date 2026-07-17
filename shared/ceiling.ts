// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 属性天花板隐藏加成 — 设计真源 docs/04-game-systems.md §27
 * 引擎实现见 P5-15；改数值须同步 01/03/04 文档与本文件。
 */
import { CeilingAttribute } from './enums/index.js';

/** 五维天花板持有者 + 隐藏加成（定稿） */
export const CEILING_HOLDERS: Readonly<
  Record<CeilingAttribute, { name: string; hiddenBonus: number }>
> = {
  [CeilingAttribute.WAR]: { name: '吕布', hiddenBonus: 50 },
  [CeilingAttribute.INTELLIGENCE]: { name: '诸葛亮', hiddenBonus: 20 },
  [CeilingAttribute.LEADERSHIP]: { name: '曹操', hiddenBonus: 15 },
  [CeilingAttribute.POLITICS]: { name: '荀彧', hiddenBonus: 10 },
  [CeilingAttribute.CHARISMA]: { name: '刘备', hiddenBonus: 5 },
};

/** 第二梯度起点：武力 97；统/智/政/魅 99 */
export const SECOND_TIER_FLOOR: Readonly<Record<CeilingAttribute, number>> = {
  [CeilingAttribute.WAR]: 97,
  [CeilingAttribute.LEADERSHIP]: 99,
  [CeilingAttribute.INTELLIGENCE]: 99,
  [CeilingAttribute.POLITICS]: 99,
  [CeilingAttribute.CHARISMA]: 99,
};

/** 裸属性绝对上限（每维仅 1 人） */
export const BARE_STAT_CAP = 100;

/** 公式计算硬顶 */
export const EFFECTIVE_STAT_HARD_CAP = 255;

export function getCeilingHiddenBonus(attribute: CeilingAttribute): number {
  return CEILING_HOLDERS[attribute].hiddenBonus;
}

/**
 * 面板展示用属性：只显示裸属性，硬顶 100。
 * **禁止**在 UI 展示 hiddenBonus；引擎战斗用有效属性见 P5-15。
 */
export function panelStatDisplay(bare: number): number {
  return Math.max(0, Math.min(BARE_STAT_CAP, Math.floor(bare)));
}

export function panelStatsDisplay(stats: {
  leadership: number;
  war: number;
  intelligence: number;
  politics: number;
  charisma: number;
}): {
  leadership: number;
  war: number;
  intelligence: number;
  politics: number;
  charisma: number;
} {
  return {
    leadership: panelStatDisplay(stats.leadership),
    war: panelStatDisplay(stats.war),
    intelligence: panelStatDisplay(stats.intelligence),
    politics: panelStatDisplay(stats.politics),
    charisma: panelStatDisplay(stats.charisma),
  };
}
