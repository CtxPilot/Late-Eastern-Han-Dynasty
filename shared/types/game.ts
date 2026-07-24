// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { FactionId, Season } from '../enums/index.js';
import type { Army } from './army.js';
import type { BattleState } from './battle.js';
import type { BattlefieldInstance } from './battlefield-instance.js';
import type { BattlefieldMap, MeleeState } from './battlefield.js';
import type { CampaignArmy, CampaignNode, GrandStrategist } from './campaign.js';
import type { City } from './city.js';
import type { DiplomacyLink } from './diplomacy.js';
import type { FemaleCharacter } from './female.js';
import type { Faction } from './faction.js';
import type { Officer } from './officer.js';
import type { IntelState } from './intel.js';
import type { Plot } from './plot.js';
import type { EventSourceClass } from './event.js';

export interface GameAction {
  year: number;
  month: number;
  type: string;
  message: string;
}

export interface GameState {
  scenarioId: number;
  enabledEventLayers: EventSourceClass[];
  enabledChildEventIds: number[];
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
  /** 当前战场地图（Tier I；0-A 单实例边界） */
  activeBattlefield: BattlefieldMap | null;
  /** 当前白刃战（Tier II；必须归属于 activeBattlefield） */
  activeMelee: MeleeState | null;
  /**
   * 当前郡域战场实例（Tier II；BF-P2 Q10 接入）。
   * 与 activeBattlefield（Tier I 大地图层）场景栈强制互斥，不可同时非 null。
   * 旧存档无此字段时按 null 处理（Zod 标记为 nullable().optional()）。
   * 参见 docs/25-bf-p2-design.md §三。
   */
  activeBattlefieldInstance?: BattlefieldInstance | null;
  diplomacy: DiplomacyLink[];
  /** 谍报：侦查报告等（盟友可见性由外交实时计算） */
  intel: IntelState;
  /** 计谋 S17：进行中/已结算的计谋列表 */
  plots: Plot[];

  completedEvents: number[];
  pendingEvents: number[];
  invalidatedEvents: number[];
  eventChoices: Record<number, number>;
  actionLog: GameAction[];
}
