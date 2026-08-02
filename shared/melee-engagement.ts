// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { tacticalHexDistance, type TacticalHex } from './tactical-grid.js';

export type MeleeWeaponClass = 'sword' | 'spear' | 'axe';
export type HexFacing = 0 | 1 | 2 | 3 | 4 | 5;
export interface MeleeRangeRule { min: number; max: number; frontalArc: number; flankAttack: number }

export const MELEE_RANGE_RULES: Record<MeleeWeaponClass, MeleeRangeRule> = {
  sword: { min: 1, max: 1, frontalArc: 1, flankAttack: 0.12 },
  spear: { min: 1, max: 2, frontalArc: 1, flankAttack: 0.08 },
  axe: { min: 1, max: 1, frontalArc: 0, flankAttack: 0.18 },
};

const FACING_DIRECTIONS: readonly TacticalHex[] = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

/** 把目标向量归入最近的六方向，用于前/侧/背朝向判定。 */
export function directionTo(from: TacticalHex, to: TacticalHex): HexFacing {
  const dq = to.q - from.q; const dr = to.r - from.r;
  let best: HexFacing = 0; let score = -Infinity;
  FACING_DIRECTIONS.forEach((dir, index) => {
    const dot = dq * dir.q + dr * dir.r + (dq + dr) * (dir.q + dir.r);
    if (dot > score) { score = dot; best = index as HexFacing; }
  });
  return best;
}

export function facingDelta(a: HexFacing, b: HexFacing): number {
  const raw = Math.abs(a - b); return Math.min(raw, 6 - raw);
}

export interface MeleeTargetCheck { inRange: boolean; arc: 'front' | 'flank' | 'rear'; attackModifier: number; distance: number }
export function checkMeleeTarget(from: TacticalHex, facing: HexFacing, target: TacticalHex, weapon: MeleeWeaponClass): MeleeTargetCheck {
  const rule = MELEE_RANGE_RULES[weapon]; const distance = tacticalHexDistance(from, target); const delta = facingDelta(facing, directionTo(from, target));
  const arc = delta <= rule.frontalArc ? 'front' : delta === 2 ? 'flank' : 'rear';
  return { inRange: distance >= rule.min && distance <= rule.max && arc !== 'rear', arc, attackModifier: arc === 'flank' ? rule.flankAttack : arc === 'rear' ? -1 : 0, distance };
}
