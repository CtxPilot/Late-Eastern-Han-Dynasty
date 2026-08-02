// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type {
  FamilyTier,
  MaritalStatus,
  SkillType,
  SpouseInfluenceType,
} from '../enums/index.js';
import type { OfficerStats } from './common.js';

export type SpouseTalent = string;

/** Static JSON record (females.json) */
export interface FemaleStatic {
  id: number;
  name: string;
  birthYear: number;
  deathYear: number;
  family: FamilyTier;
  clanName: string;
  factionId: number | null;
  locationId: number;
  fatherId?: number;
  motherId?: number;
  initialStatus: MaritalStatus;
  initialHusbandId?: number;
  influence: Record<SpouseInfluenceType, number>;
  statBonus: Partial<OfficerStats>;
  teachableSkills: SkillType[];
  enhanceableSkills: { skill: SkillType; bonus: number }[];
  talents: SpouseTalent[];
  relatedEvents: number[];
  marriageRequirements?: {
    minCharisma?: number;
    minPolitics?: number;
    minMerit?: number;
  };
  canCommand: boolean;
  description: string;
}

export interface FemaleCharacter extends FemaleStatic {
  status: MaritalStatus;
  husbandId?: number;
  /**
   * @deprecated 旧存档兼容字段。具名女性赠与机制已退役；加载后必须清空，禁止产生新值。
   */
  giftedToOfficerId?: number | null;
}
