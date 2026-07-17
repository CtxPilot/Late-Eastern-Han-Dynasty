// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { SkillCategory, SkillType } from '../enums/index.js';
import type { OfficerStats } from './common.js';

export interface SkillEffect {
  type: string;
  value: number;
  range?: number;
  condition?: string;
  description?: string;
}

export interface SkillLevelRequirement {
  minStats?: Partial<OfficerStats>;
  useCount?: number;
  prevLevel?: number;
  itemRequired?: number;
}

export interface SkillLevel {
  level: number;
  name: string;
  effects: SkillEffect[];
  requirement: SkillLevelRequirement;
}

/** Static JSON record (skills.json) */
export interface SkillTemplate {
  id: SkillType;
  name: string;
  category: SkillCategory;
  description: string;
  maxLevel: number;
  levels: SkillLevel[];
}
