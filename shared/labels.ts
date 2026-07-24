// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Shared label maps for officer detail UI rendering.
 *
 * - FORMATION_LABEL: 阵型 id → 中文名（覆盖设计内 18 陆阵 0~17，匹配 formations.json 命名）
 * - PERSONALITY_LABEL / IDEAL_LABEL: hidden.{personality,ideal} 枚举 → 中文文案
 *
 * 设计决策（Session 178）：hidden 数值类字段（righteousness/ambition/valor/composure/
 * luck 等）保持隐藏，不在 UI 展示；仅 personality + ideal 这两个文字风味字段在
 * OfficerDetail "性格" 区块展示。数值类隐藏属性通过游玩发现，不在简册直读。
 *
 * 参见 `docs/05-combat-system.md` §4（阵型设计）、`shared/enums/index.ts`（枚举定义）。
 */
import { Ideal, Personality } from './enums/index.js';

/**
 * 阵型 id → 中文名。
 *
 * 0-A formations.json 实际录入 7 条（id 0,2,4,6,7,8,16）；其余 id（1,3,5,9-15,17）
 * 为设计内但 0-A 未录入的陆阵，此处提供预留名保证 UI 永不显示 "undefined"。
 * 命名与 formations.json 保持一致（带 "阵" 后缀）。
 */
export const FORMATION_LABEL: Record<number, string> = {
  0: '方阵',
  1: '圆阵',
  2: '锥形阵',
  3: '雁行阵',
  4: '鹤翼阵',
  5: '鱼鳞阵',
  6: '锋矢阵',
  7: '偃月阵',
  8: '长蛇阵',
  9: '衡轭阵',
  10: '疏阵',
  11: '数阵',
  12: '钩形阵',
  13: '玄襄阵',
  14: '车悬阵',
  15: '八卦阵',
  16: '冲阵',
  17: '云阵',
};

/**
 * 性格（Personality 枚举）→ 中文文案。
 * 文字风味字段，用于 OfficerDetail "性格" 区块展示。
 */
export const PERSONALITY_LABEL: Record<Personality, string> = {
  [Personality.BRAVE]: '勇烈',
  [Personality.CALM]: '沉稳',
  [Personality.BOLD]: '果敢',
  [Personality.CAUTIOUS]: '谨慎',
  [Personality.RECKLESS]: '刚烈',
  [Personality.GENTLE]: '温厚',
};

/**
 * 志向（Ideal 枚举）→ 中文文案。
 * 文字风味字段，用于 OfficerDetail "性格" 区块展示。
 */
export const IDEAL_LABEL: Record<Ideal, string> = {
  [Ideal.HEGEMONY]: '霸业',
  [Ideal.BENEVOLENCE]: '仁政',
  [Ideal.SEPARATIST]: '割据',
  [Ideal.CHIVALRY]: '侠义',
  [Ideal.FAME]: '名利',
};
