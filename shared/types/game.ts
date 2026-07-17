// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { FactionId, Season } from '../enums/index.js';
import type { Army } from './army.js';
import type { BattleState } from './battle.js';
import type { CampaignArmy, CampaignNode, GrandStrategist } from './campaign.js';
import type { City } from './city.js';
import type { DiplomacyLink } from './diplomacy.js';
import type { FemaleCharacter } from './female.js';
import type { Faction } from './faction.js';
import type { Officer } from './officer.js';
import type { IntelState } from './intel.js';
import type { Plot } from './plot.js';

export interface GameAction {
  year: number;
  month: number;
  type: string;
  message: string;
}

export interface GameState {
  scenarioId: number;
  currentYear: number;
  currentMonth: number;
  season: Season;
  playerFactionId: FactionId;

  officers: Record<number, Officer>;
  cities: Record<number, City>;
  factions: Record<number, Faction>;
  females: Record<number, FemaleCharacter>;

  armys: Army[];
  /** 战役层 Army 列表（05 §13 CampaignArmy） */
  campaignArmies: CampaignArmy[];
  /** 战役地图节点（0-A：30 治所 = 30 节点） */
  campaignNodes: CampaignNode[];
  /** 总军师（每势力至多 1 位，05 §14） */
  grandStrategists: GrandStrategist[];
  activeBattles: BattleState[];
  diplomacy: DiplomacyLink[];
  /** 谍报：侦查报告等（盟友可见性由外交实时计算） */
  intel: IntelState;
  /** 计谋 S17：进行中/已结算的计谋列表 */
  plots: Plot[];

  completedEvents: number[];
  pendingEvents: number[];
  actionLog: GameAction[];
}
