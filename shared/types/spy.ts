// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { SpyMissionType, SpyStatus } from '../enums/index.js';

export type SpyRank = 1 | 2 | 3 | 4 | 5;

export interface SpySkills {
  recon: number;
  sabotage: number;
  lethal: number;
  tradecraft: number;
}

export interface SpyAgent {
  id: string;
  factionId: number;
  name: string;
  rank: SpyRank;
  exp: number;
  skills: SpySkills;
  status: SpyStatus;
  homeCityId: number;
  locationCityId: number | null;
  captiveByFactionId?: number | null;
  cooldownMonths: number;
  missionsDone: number;
  coverIdentity?: string;
  /** Agent kind: 'male' (default) or 'female' (trained from beauty resource, S07∩S09) */
  agentKind?: 'male' | 'female';
}

export interface CityCounterIntel {
  level: 0 | 1 | 2 | 3;
  untilYear: number;
  untilMonth: number;
  stationAgentId?: string | null;
}

export interface SpyMissionLog {
  year: number;
  month: number;
  type: SpyMissionType | 'station' | 'unstation' | 'recruit' | 'captive';
  agentId: string;
  agentName: string;
  factionId: number;
  targetCityId?: number;
  success: boolean;
  captured: boolean;
  dead: boolean;
  message: string;
}
