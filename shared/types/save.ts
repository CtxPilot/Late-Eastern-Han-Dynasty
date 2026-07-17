// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { GameState } from './game.js';

export interface SaveSlot {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  scenarioId: number;
  year: number;
  month: number;
  snapshot: GameState;
}
