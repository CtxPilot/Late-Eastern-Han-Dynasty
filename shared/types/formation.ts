// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { TerrainType, UnitType } from '../enums/index.js';

export interface FormationEffect {
  name: string;
  description: string;
  modifier: {
    type: string;
    value: number;
    condition?: string;
  };
}

export interface FormationModifiers {
  attack: number;
  defense: number;
  mobility: number;
  range: number;
}

/** Static JSON record (formations.json) */
export interface FormationTemplate {
  id: number;
  name: string;
  description: string;
  historicalSource: string;
  modifiers: FormationModifiers;
  effects: FormationEffect[];
  allowedUnits: UnitType[];
  bestUnits: UnitType[];
  restrictedUnits: UnitType[];
  terrainModifiers: Partial<Record<TerrainType, number>>;
}
