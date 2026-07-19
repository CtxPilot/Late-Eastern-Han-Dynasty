// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { Ideal, Personality } from '../enums/index.js';

export type EventSourceClass =
  | 'official_history'
  | 'annotated_history'
  | 'literature'
  | 'legend'
  | 'gameplay';

export interface EventCondition {
  type: 'year' | 'officer' | 'city' | 'faction' | 'event';
  field: string;
  targetId?: number;
  operator: 'equals' | 'gte' | 'lte' | 'in' | 'hasItem' | 'notHas' | 'probability';
  value: unknown;
}

export interface EventEffect {
  type: 'recruit' | 'loyalty' | 'develop' | 'relation' | 'war' | 'capital' | 'troops' | 'gold' | 'food' | 'population';
  target: 'faction' | 'officer' | 'city' | 'global';
  targetId?: number;
  field: string;
  value: unknown;
}

export interface EventChoice {
  label: string;
  effects: EventEffect[];
  aiWeight?: number;
  aiPersonalityWeights?: Partial<Record<Personality, number>>;
  aiIdealWeights?: Partial<Record<Ideal, number>>;
}

export interface EventDialogue {
  speakerId?: number;
  speakerName: string;
  text: string;
  portrait?: string;
}

/** Static JSON record (events.json) */
export interface EventTemplate {
  id: number;
  name: string;
  description: string;
  category: 'historical' | 'random' | 'marriage' | 'diplomacy' | 'battle';
  sourceClass: EventSourceClass;
  sources: string[];
  scenarioIds: number[];
  dateWindow: {
    startYear: number;
    startMonth: number;
    endYear: number;
    endMonth: number;
  };
  decisionFactionId?: number;
  /** 动态绑定：指定武将决策，运行时解析其当前所属势力 */
  decisionOfficerId?: number;
  prerequisiteEventIds?: number[];
  mutexGroup?: string;
  conditions: EventCondition[];
  dialogues: EventDialogue[];
  choices: EventChoice[];
  autoChoice?: number;
}
