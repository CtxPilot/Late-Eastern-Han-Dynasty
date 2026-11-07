// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * D-0B-8 · 吕布「天下无双」服务端数值真源（Session 455）。
 *
 * 设计真源：docs/08-data-dictionary.md §三十二、docs/05-combat-system.md §十九.4。
 * 全部为确定性规则：不新增 RNG 消费点、不新增 BattleState 持久字段。
 *
 * 三条效果：
 *   1. 无双乱舞：吕布普攻命中后，对首要目标相邻（1 格内）的其他敌军造成
 *      主伤害 35% 的溅射（至少 1，士气 −1）。
 *   2. 心理震慑：吕布方圆 2 格内的敌军，攻击伤害 −10%、反击率 −10 百分点、
 *      反击伤害 ×0.9。
 *   3. 鬼神：吕布部队兵力 ≤30% 时进入鬼神形态——受到伤害时防御 ×2，
 *      普攻造成伤害后按 20% 吸血回复自身兵力（不超过满编）。
 */
import { LV_BU_OFFICER_ID } from './tournament.js';
import { tacticalHexDistance, type TacticalHex } from './tactical-grid.js';

/** 无双乱舞溅射半径（首要目标周围 1 格）。 */
export const PEERLESS_DANCE_SPLASH_RADIUS = 1;
/** 无双乱舞溅射比例（主伤害的 35%）。 */
export const PEERLESS_DANCE_SPLASH_PCT = 35;
/** 心理震慑光环半径（2 格）。 */
export const PEERLESS_INTIMIDATE_RADIUS = 2;
/** 心理震慑：敌军攻击伤害降低 10%。 */
export const PEERLESS_INTIMIDATE_DAMAGE_PCT = 10;
/** 心理震慑：敌军反击率降低 10 百分点。 */
export const PEERLESS_INTIMIDATE_COUNTER_PCT = 10;
/** 鬼神形态触发阈值：兵力 ≤ 满编 30%。 */
export const PEERLESS_GHOST_TROOP_PCT = 30;
/** 鬼神形态防御倍率。 */
export const PEERLESS_GHOST_DEFENSE_MULTIPLIER = 2;
/** 鬼神形态吸血比例（造成伤害的 20%）。 */
export const PEERLESS_GHOST_LIFESTEAL_PCT = 20;

type PeerlessLike = { id: number; uniqueSkill?: string | null };

/** 是否为吕布（0-A/0-B 固定 id=5；0-B 起也可由 uniqueSkill='wushuang' 派生）。 */
export function isPeerlessOfficer(officer: PeerlessLike | null | undefined): boolean {
  if (!officer) return false;
  return officer.id === LV_BU_OFFICER_ID || officer.uniqueSkill === 'wushuang';
}

/** 是否进入鬼神形态（只按当前兵力比例判定，不引入额外状态字段）。 */
export function isPeerlessGhostForm(unit: { troopCount: number; maxTroops: number }): boolean {
  if (unit.maxTroops <= 0 || unit.troopCount <= 0) return false;
  return unit.troopCount * 100 <= unit.maxTroops * PEERLESS_GHOST_TROOP_PCT;
}

/** 无双乱舞单次溅射伤害。 */
export function peerlessSplashDamage(mainDamage: number): number {
  return Math.max(1, Math.round((Math.max(0, mainDamage) * PEERLESS_DANCE_SPLASH_PCT) / 100));
}

/** 鬼神形态吸血回复量。 */
export function peerlessLifestealHeal(damageDealt: number): number {
  return Math.max(0, Math.round((Math.max(0, damageDealt) * PEERLESS_GHOST_LIFESTEAL_PCT) / 100));
}

/** 目标是否处于吕布的心理震慑光环内（以吕布所在格为中心）。 */
export function isWithinPeerlessIntimidate(
  target: Pick<TacticalHex, 'q' | 'r'>,
  peerlessPosition: Pick<TacticalHex, 'q' | 'r'>,
): boolean {
  return tacticalHexDistance(target, peerlessPosition) <= PEERLESS_INTIMIDATE_RADIUS;
}
