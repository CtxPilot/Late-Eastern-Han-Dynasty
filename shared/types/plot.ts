// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { PlotType, PlotStage } from '../enums/index.js';

export interface PlotCost {
  gold: number;
  food?: number;
  beauty?: number;
  /** Requires intel depth on the target city */
  requiresIntel?: 'surface' | 'detailed';
}

export interface PlotResult {
  success: boolean;
  detected: boolean;
  message: string;
  /** Faction favor deltas applied (for logging) */
  favorChanges?: Array<{ a: number; b: number; delta: number }>;
  /**
   * 空城疑兵识破：效果反转（敌 AI 优先进攻）
   * 假情报无此字段（识破=无效）
   */
  inverted?: boolean;
}

export interface Plot {
  id: string;
  type: PlotType;
  /** Faction launching the plot */
  casterFactionId: number;
  /** Target faction (for inter-faction plots like sowDiscord) */
  targetFactionId?: number;
  /** Target city (for honey trap targeting an officer in a city) */
  targetCityId?: number;
  /** Target officer (optional, for honey trap) */
  targetOfficerId?: number;
  /** Female spy agent assigned to this plot (optional, boosts success) */
  agentId?: string;
  stage: PlotStage;
  /** Months remaining in preparation; 0 = ready to resolve */
  monthsLeft: number;
  cost: PlotCost;
  /** Result filled when stage === 'resolved' */
  result?: PlotResult;
  year: number;
  month: number;
}