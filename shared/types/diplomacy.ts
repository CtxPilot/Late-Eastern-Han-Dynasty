// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { DipRelation, FactionId } from '../enums/index.js';

export interface DiplomacyLink {
  factionA: FactionId;
  factionB: FactionId;
  relation: DipRelation;
  favorability: number;
  marriageBond?: boolean;
}
