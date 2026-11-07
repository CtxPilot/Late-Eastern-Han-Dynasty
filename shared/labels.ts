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
 * OfficerDetail "性格与理想" 区块展示。数值类隐藏属性通过游玩发现，不在简册直读。
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
 * 文字风味字段，用于 OfficerDetail "性格与理想" 区块展示。
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
 * 理想（Ideal 枚举）→ 中文文案。
 * 文字风味字段，用于 OfficerDetail "性格与理想" 区块展示。
 * 枚举值回归文档原值（01-overview.md:111）：霸道/王道/割据/侠义/名利。
 */
export const IDEAL_LABEL: Record<Ideal, string> = {
  [Ideal.HEGEMONY]: '霸道',
  [Ideal.BENEVOLENCE]: '王道',
  [Ideal.SEPARATIST]: '割据',
  [Ideal.CHIVALRY]: '侠义',
  [Ideal.FAME]: '名利',
};

/**
 * 单挑 7 类出牌指令（DuelCommand）→ 中文名。
 */
export const DUEL_COMMAND_LABEL: Record<string, string> = {
  fierce_attack: '猛攻',
  restrain: '牵制',
  finisher: '必杀',
  parry: '格挡',
  dodge: '闪避',
  probe: '周旋',
  sneak_attack: '暗袭',
};

/**
 * 单挑 7 类出牌指令 → 克制规则说明。
 */
export const DUEL_COMMAND_DESC: Record<string, string> = {
  fierce_attack: '克制【牵制】 · 被【必杀】克',
  restrain: '克制【必杀】 · 被【猛攻】克',
  finisher: '克制【猛攻】 · 被【牵制】克',
  parry: '减伤反手 · 被【周旋】克',
  dodge: '免疫猛攻与牵制 · 被【周旋】克',
  probe: '周旋试探 · 克制【闪避与格挡】',
  sneak_attack: '袖里暗刃 · 出其不意',
};

export interface DuelCardMatchupResult {
  advantage: 1 | -1 | 0;
  label: string;
  color: string;
}

/**
 * 单挑卡牌三向克制判定（核心三环：猛攻克牵制、牵制克必杀、必杀克猛攻）
 */
export function getDuelCardMatchup(cmd1: string, cmd2: string): DuelCardMatchupResult {
  if (cmd1 === cmd2) {
    return { advantage: 0, label: '平局', color: '#e2e8f0' };
  }
  if (
    (cmd1 === 'fierce_attack' && cmd2 === 'restrain') ||
    (cmd1 === 'restrain' && cmd2 === 'finisher') ||
    (cmd1 === 'finisher' && cmd2 === 'fierce_attack') ||
    (cmd1 === 'probe' && (cmd2 === 'dodge' || cmd2 === 'parry')) ||
    (cmd1 === 'fierce_attack' && cmd2 === 'probe')
  ) {
    return { advantage: 1, label: '克制', color: '#f59e0b' };
  }
  if (
    (cmd2 === 'fierce_attack' && cmd1 === 'restrain') ||
    (cmd2 === 'restrain' && cmd1 === 'finisher') ||
    (cmd2 === 'finisher' && cmd1 === 'fierce_attack') ||
    (cmd2 === 'probe' && (cmd1 === 'dodge' || cmd1 === 'parry')) ||
    (cmd2 === 'fierce_attack' && cmd1 === 'probe')
  ) {
    return { advantage: -1, label: '被克', color: '#94a3b8' };
  }
  return { advantage: 0, label: '均势', color: '#cbd5e1' };
}
