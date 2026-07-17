// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

export interface EventCondition {
  type: string;
  field: string;
  operator: 'equals' | 'gte' | 'lte' | 'in' | 'hasItem' | 'notHas' | 'probability';
  value: unknown;
}

export interface EventEffect {
  type: string;
  target: 'faction' | 'officer' | 'city' | 'global';
  targetId?: number;
  field: string;
  value: unknown;
}

export interface EventChoice {
  label: string;
  effects: EventEffect[];
  aiWeight?: number;
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
  conditions: EventCondition[];
  dialogues: EventDialogue[];
  choices: EventChoice[];
  autoChoice?: number;
}
