// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { SkillType } from '../enums/index.js';
import type { OfficerStats } from './common.js';

/** Static JSON record (children.json) */
export interface ChildBirthDef {
  childId: number;
  childName: string;
  fatherId: number;
  motherId: number;
  birthYear: number;
  appearYear: number;
  source: 'history' | 'romance' | 'folklore';
  baseStats: OfficerStats;
  motherBonus?: {
    fromScholarship?: Partial<OfficerStats>;
    fromBloodline?: Partial<OfficerStats>;
    extraSkills?: SkillType[];
    extraTalents?: string[];
  };
}
