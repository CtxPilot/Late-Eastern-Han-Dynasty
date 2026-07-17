// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { TerrainType, UnitType } from '../enums/index.js';
import type { CombatAbilityDef } from './combatAbility.js';

export interface UnitTrait {
  name: string;
  description: string;
  modifier: {
    type: string;
    value: number;
    condition?: string;
  };
}

export interface UnitRecruitCost {
  gold: number;
  food: number;
  population: number;
}

/** Static JSON record (units.json) */
export interface UnitTemplate {
  type: UnitType;
  name: string;
  isSpecial: boolean;
  attack: number;
  defense: number;
  mobility: number;
  range: number;
  traits: UnitTrait[];
  strongAgainst: UnitType[];
  weakAgainst: UnitType[];
  recruitRequirement: Record<string, unknown> | null;
  terrainModifiers: Partial<Record<TerrainType, number>>;
  recruitCost: UnitRecruitCost;
  abilities: CombatAbilityDef[];
}
