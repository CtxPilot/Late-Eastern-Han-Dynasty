// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { TerrainType, UnitType } from '@leh/shared';
import { TERRAIN_TABLE } from './terrain.js';

export interface DamageInput {
  unitAttack: number;
  unitDefense: number;
  officerWar: number;
  officerLeadership: number;
  troops: number;
  maxTroops: number;
  morale: number;
  terrain: TerrainType;
  matchup?: number;
  /** 装备防御加成（S13 Session 266：黑铁甲/革甲 baseEffect defense）。 */
  armorDefense?: number;
  /**
   * 六角阵型贡献（FM-P3：tiers[0] 点值投影，模式专用量纲）。
   * formationAtk 进入攻击方 baseAttack、formationDef 进入守方 baseDefense；
   * 负修正原值保留（实际为负增量）。未传等价无阵型加成。
   */
  formationAtk?: number;
  formationDef?: number;
}

/** 兵种克制系数：攻方克制守方 → 1.3；被克制 → 0.7；互无关系 → 1.0 */
export function getUnitMatchup(
  attackerType: UnitType,
  defenderType: UnitType,
  strongAgainst: Record<string, UnitType[]>,
): number {
  const strong = strongAgainst[attackerType] ?? [];
  const weak = strongAgainst[defenderType] ?? [];
  if (strong.includes(defenderType)) return 1.3;
  if (weak.includes(attackerType)) return 0.7;
  return 1.0;
}

/** 05 §6.1 core formula (demo-proven simplified path) */
export function calcDamage(
  attacker: DamageInput,
  defender: DamageInput,
  rng: () => number,
): number {
  const baseAttack = attacker.unitAttack + attacker.officerWar / 10 + (attacker.formationAtk ?? 0);
  const baseDefense = defender.unitDefense + defender.officerLeadership / 10 + (defender.armorDefense ?? 0) + (defender.formationDef ?? 0);

  const troopFactor = 0.3 + 0.7 * (attacker.troops / Math.max(1, attacker.maxTroops));
  const moraleFactor = 0.6 + 0.4 * (attacker.morale / 100);
  const atkTerrain = 1 + TERRAIN_TABLE[attacker.terrain].attackMod;
  const matchup = attacker.matchup ?? 1.0;

  const finalAttack = baseAttack * matchup * atkTerrain * troopFactor * moraleFactor;
  const defTerrain = 1 + TERRAIN_TABLE[defender.terrain].defenseMod;
  const finalDefense = baseDefense * defTerrain;

  // floor so near-parity stats still deal meaningful troop loss (05 §6.1 structure)
  const raw = Math.max(1.5, finalAttack - finalDefense + 2);
  const roll = 0.9 + rng() * 0.2;
  return Math.max(1, Math.round(raw * (attacker.troops / 30) * roll));
}
