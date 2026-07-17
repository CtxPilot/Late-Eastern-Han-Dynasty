// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { TerrainType } from '@leh/shared';

/** Move costs / mods from 05-combat-system §2.1 (post disambiguation) */
export const TERRAIN_TABLE: Record<
  TerrainType,
  { moveCost: number; attackMod: number; defenseMod: number }
> = {
  [TerrainType.PLAIN]: { moveCost: 1, attackMod: 0, defenseMod: 0 },
  [TerrainType.FOREST]: { moveCost: 2, attackMod: -0.1, defenseMod: 0.2 },
  [TerrainType.MOUNTAIN]: { moveCost: 3, attackMod: -0.2, defenseMod: 0.3 },
  [TerrainType.WATER]: { moveCost: 4, attackMod: -0.3, defenseMod: -0.2 },
  [TerrainType.WALL]: { moveCost: 99, attackMod: -0.3, defenseMod: 0.4 },
  [TerrainType.CITY]: { moveCost: 99, attackMod: -0.2, defenseMod: 0.5 },
  [TerrainType.SWAMP]: { moveCost: 3, attackMod: -0.15, defenseMod: -0.1 },
};
