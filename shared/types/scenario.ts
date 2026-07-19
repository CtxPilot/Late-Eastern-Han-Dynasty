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
import type { EventSourceClass } from './event.js';

export interface ScenarioFactionSetup {
  id: FactionId;
  name: string;
  color: string;
  rulerId: number;
  capitalCityId: number;
  /** 0-A historical scenarios may use a supply-seat abstraction for mobile commands. */
  mode: 'territorial' | 'expeditionary' | 'hosted';
  headquartersLabel: string;
  historicalNote?: string;
}

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
  factionSetups: ScenarioFactionSetup[];
  eventIds: number[];
  availableOfficerIds: number[];
  availableFemaleIds: number[];
  childEventIds: number[];
  availableEventLayers: EventSourceClass[];
  defaultEventLayers: EventSourceClass[];
  /** Explicitly distinguishes a playable technical slice from a full historical setup. */
  scopeNote?: string;
  playableFactions: number[];
  recommendedFaction?: number;
}
