// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { ArmyStatus, FormationType, UnitType } from '../enums/index.js';

export interface Army {
  id: string;
  commanderId: number;
  subCommanders: number[];
  unitType: UnitType;
  formation: FormationType;
  troopCount: number;
  maxTroopCount: number;
  morale: number;
  food: number;
  location: number;
  status: ArmyStatus;
  targetCityId?: number;
  arrivalTurn?: number;
}
