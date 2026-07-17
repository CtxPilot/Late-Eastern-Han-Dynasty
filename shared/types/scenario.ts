// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type {
  CivilPosition,
  DipRelation,
  FactionId,
  LocalPosition,
  MaritalStatus,
  MilitaryPosition,
  NobilityRank,
} from '../enums/index.js';

export interface ScenarioOfficerPosition {
  officerId: number;
  cityId: number;
  factionId: FactionId;
  civilPosition?: CivilPosition;
  localPosition?: LocalPosition;
  militaryPosition?: MilitaryPosition;
  nobilityRank?: NobilityRank;
  merit?: number;
  loyalty: number;
}

export interface ScenarioFemalePosition {
  femaleId: number;
  cityId: number;
  status: MaritalStatus;
  husbandId?: number;
  factionId?: FactionId;
}

export interface ScenarioDiplomacy {
  factionA: FactionId;
  factionB: FactionId;
  relation: DipRelation;
  favorability: number;
  marriageBond?: boolean;
}

export interface ScenarioStartingState {
  year: number;
  month: number;
  factions: number[];
  activeFactionIds: FactionId[];
  cityOwnership: Record<string, FactionId>;
  officerPositions: ScenarioOfficerPosition[];
  femalePositions: ScenarioFemalePosition[];
  initialDiplomacy: ScenarioDiplomacy[];
  completedEvents: number[];
}

/** Static JSON record (scenarios.json) */
export interface ScenarioStatic {
  id: number;
  name: string;
  type?: 'historical' | 'whatif';
  noLifespan?: boolean;
  description: string;
  startYear: number;
  endYear: number;
  startState: ScenarioStartingState;
  playableFactions: number[];
  recommendedFaction?: number;
}
