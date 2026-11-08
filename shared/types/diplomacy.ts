// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { DipRelation, FactionId } from '../enums/index.js';

export interface DiplomacyLink {
  factionA: FactionId;
  factionB: FactionId;
  relation: DipRelation;
  favorability: number;
  marriageBond?: boolean;
  /** 停火协议剩余保护月数（0-A/0-B 停战期不可出征，到期归零自然解除） */
  truceMonths?: number;
  /** 所属多方会盟标识（若两势力属于同一联盟） */
  coalitionId?: string;
}

/** 多方会盟实体（如关东反董联军、反曹联军） */
export interface Coalition {
  id: string;
  name: string;
  leaderFactionId: FactionId;
  targetFactionId: FactionId;
  memberFactionIds: FactionId[];
  startYear: number;
  startMonth: number;
  durationMonths: number;
  remainingMonths: number;
  /** 是否已发起共同作战号召 */
  jointWarActive?: boolean;
}
