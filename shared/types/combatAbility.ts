// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { UnitProficiency } from '../enums/index.js';

/** Special effect applied when a combat ability hits */
export type CombatEffectType =
  | 'knockback'
  | 'stun'
  | 'charge'
  | 'pierce'
  | 'aoe'
  | 'fire'
  | 'morale'
  | 'confusion'
  | 'none';

/**
 * leveled: base units — explicit Lv1~5, unlocked by unit proficiency
 * proficiency: special units — no levels, power scales with use-count (engine later)
 */
export type CombatAbilityLeveling = 'leveled' | 'proficiency';

export interface CombatAbilityLevel {
  level: number;
  energyCost: number;
  power: number;
  hitRateBonus: number;
  requiredProficiency: UnitProficiency;
}

/** Static ability definition (embedded in units.json) */
export interface CombatAbilityDef {
  id: string;
  name: string;
  description: string;
  leveling: CombatAbilityLeveling;
  /** Present when leveling === 'leveled' (typically 5 entries Lv1~5) */
  perLevel?: CombatAbilityLevel[];
  /** Present when leveling === 'proficiency' */
  energyCost?: number;
  basePower?: number;
  maxPower?: number;
  hitRateBonus?: number;
  specialEffect: CombatEffectType;
  effectValue?: number;
  minRange: number;
  maxRange: number;
  /** Coop chain placeholder; relationship engine deferred */
  coopAllowed: boolean;
}
