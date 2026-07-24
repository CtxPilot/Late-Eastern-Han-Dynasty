// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S23 人物状态表情系统（`docs/24-character-expression-system-design.md`）
 *
 * 本模块是 S22 美术基调 A+C+B 方案中 C 层（程序化五官拼图）的动态状态化扩展：
 * 把静态哈希派生的「眉眼」维度改为由确定性游戏状态驱动切换。
 *
 * `resolveExpression` 是纯函数：相同输入必然相同输出，不消耗 RNG。
 * 3 原型（吕布 id=5 / 曹操 id=1 / 诸葛亮 id=4）走角色化分支；
 * 其余武将走通用回退（标准胜/败/怀疑/沉思，无角色化变体）。
 *
 * 数据来源全部是既有系统已落进 GameState 的字段，不发明新数值：
 * - `Officer.loyalty`（S11 人事 / S18 家族）
 * - `Officer.stamina`（S12 体力，<30 代理负伤）
 * - `Officer.status`（OfficerStatus 枚举，仅 FREE/ACTIVE/PRISONER/DEAD，无负伤值）
 * - `BattleState.winner` + `BattleUnit.side/morale`（S10 战斗）
 * - `CampaignArmy.morale`（S05 军事，大地图持续态）
 */

import { OfficerStatus } from './enums/index.js';
import type { OfficerHidden, OfficerStats } from './types/index.js';

export type ExpressionId =
  | 'neutral'
  | 'victory'
  | 'defeat'
  | 'anger'
  | 'reluctant'
  | 'suspicion'
  | 'ponder';

export type BackgroundTone = 'gold' | 'cold' | 'dark-red' | 'grey' | 'neutral';

/** 战斗上下文（瞬时态）；BattleView SideCard 传入，OfficerDetail 不传。 */
export interface BattleSideContext {
  /** 该武将在本场战斗中的阵营 */
  side: 'attacker' | 'defender';
  /** 战斗胜方；null = 未分胜负/进行中（不算瞬时态） */
  winner: 'attacker' | 'defender' | null;
  /** 该武将所在单位的士气（0-100） */
  morale: number;
  /** 是否已被歼灭（影响败仗强度，本轮未细分） */
  isDestroyed?: boolean;
  isRetreated?: boolean;
}

export interface ExpressionInput {
  officerId: number;
  loyalty: number;
  stamina: number;
  status: OfficerStatus;
  stats: OfficerStats;
  hidden: OfficerHidden;
  /** 大地图部队士气（持续态用；战斗中用 battle.morale）；无则跳过士气维度 */
  morale?: number;
  /** 战斗上下文；无则 undefined（持续态场景） */
  battle?: BattleSideContext | null;
}

export interface ExpressionState {
  expression: ExpressionId;
  backgroundTone: BackgroundTone;
  /** 瞬时态标记：UI 据此决定是否切换到 ExpressionPortrait（无瞬时态时仍可用静态 OfficerPortrait） */
  transient: boolean;
}

const LV_BU = 5;
const CAO_CAO = 1;
const ZHUGE_LIANG = 4;

/** stamina 低于此阈值视为负伤/体力枯竭（代理 OfficerStatus 缺失的 INJURED）。 */
export const INJURY_STAMINA_THRESHOLD = 30;
/** 忠诚低于此阈值触发怀疑/不甘持续态。 */
export const LOW_LOYALTY_THRESHOLD = 60;
/** 士气低于此阈值触发沉思；高于 HIGH_MORALE_THRESHOLD 触发积极背景。 */
export const LOW_MORALE_THRESHOLD = 40;
export const HIGH_MORALE_THRESHOLD = 70;

/**
 * 纯函数：给定状态输入，返回应渲染的表情与背景色调。
 *
 * 优先级（表情，高者压制低者）：
 * 1. status !== ACTIVE → 锁定 neutral（PRISONER→cold / DEAD→grey / FREE→neutral）
 * 2. 战斗瞬时态（battle.winner !== null）→ 胜/败表情（角色化变体）
 * 3. 负伤持续态（stamina < 30，无战斗时）→ anger(吕布) / ponder(其余)
 * 4. 忠诚 < 60 → reluctant(吕布) / suspicion(其余)
 * 5. 士气 < 40 → ponder；> 70 → neutral
 * 6. 默认 neutral
 *
 * 背景层独立于表情，按严重度透出：负伤(grey) > 忠诚(dark-red) > 战斗瞬时态(gold/cold) > 高士气(gold) > neutral。
 * 例：胜仗 + 低忠诚 → 表情 victory（瞬时态）+ 背景 dark-red（持续态透出）。
 */
export function resolveExpression(input: ExpressionInput): ExpressionState {
  const { officerId, loyalty, stamina, status, morale, battle } = input;

  if (status === OfficerStatus.PRISONER) {
    return { expression: 'neutral', backgroundTone: 'cold', transient: false };
  }
  if (status === OfficerStatus.DEAD) {
    return { expression: 'neutral', backgroundTone: 'grey', transient: false };
  }
  if (status === OfficerStatus.FREE) {
    return { expression: 'neutral', backgroundTone: 'neutral', transient: false };
  }

  const injured = stamina < INJURY_STAMINA_THRESHOLD;
  const transient = battle != null && battle.winner !== null;

  // ---- 表情层 ----
  let expression: ExpressionId;
  if (transient && battle) {
    const won = battle.winner === battle.side;
    if (won) {
      // 胜：吕布狂傲(victory)；曹/诸葛不动声色(neutral)；通用标准胜利(victory)
      expression = officerId === CAO_CAO || officerId === ZHUGE_LIANG ? 'neutral' : 'victory';
    } else {
      // 败：吕布怒(anger)；曹/诸葛思(ponder)；通用标准挫败(defeat)
      expression =
        officerId === LV_BU ? 'anger'
          : officerId === CAO_CAO || officerId === ZHUGE_LIANG ? 'ponder'
            : 'defeat';
    }
  } else if (injured) {
    // 负伤（无战斗）：吕布怒(anger)；其余思(ponder)
    expression = officerId === LV_BU ? 'anger' : 'ponder';
  } else if (loyalty < LOW_LOYALTY_THRESHOLD) {
    // 低忠诚：吕布不甘(reluctant)；其余怀疑(suspicion)
    expression = officerId === LV_BU ? 'reluctant' : 'suspicion';
  } else if (morale !== undefined && morale < LOW_MORALE_THRESHOLD) {
    expression = 'ponder';
  } else if (morale !== undefined && morale > HIGH_MORALE_THRESHOLD) {
    expression = 'neutral';
  } else {
    expression = 'neutral';
  }

  // ---- 背景色调层（独立于表情，严重度透出）----
  let backgroundTone: BackgroundTone;
  if (injured) {
    backgroundTone = 'grey';
  } else if (loyalty < LOW_LOYALTY_THRESHOLD) {
    backgroundTone = 'dark-red';
  } else if (transient && battle) {
    backgroundTone = battle.winner === battle.side ? 'gold' : 'cold';
  } else if (morale !== undefined && morale > HIGH_MORALE_THRESHOLD) {
    backgroundTone = 'gold';
  } else {
    backgroundTone = 'neutral';
  }

  return { expression, backgroundTone, transient };
}
