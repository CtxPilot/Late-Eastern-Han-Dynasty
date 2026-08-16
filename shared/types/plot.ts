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

/** L2 分期投入（docs/04 §31.3） */
export interface PlotInstallments {
  goldPerMonth: number;
  months: number;
  /** 已完投月数（用于成功率 +5%/期） */
  paidMonths: number;
}

export type PlotLayer = 'tactical' | 'strategic' | 'policy';

export interface Plot {
  id: string;
  type: PlotType;
  /** Faction launching the plot */
  casterFactionId: number;
  /** Executing officer (Session 263; absent in legacy saves) */
  casterOfficerId?: number;
  /** Target faction (for inter-faction plots like sowDiscord) */
  targetFactionId?: number;
  /** Target city (for honey trap targeting an officer in a city) */
  targetCityId?: number;
  /**
   * L2 暗渡陈仓：明修城（吸引守备/AI 牵制）。
   * `targetCityId` 为暗渡城（出征攻防加成方向）。
   */
  feintCityId?: number;
  /** Target officer (optional, for honey trap) */
  targetOfficerId?: number;
  /** Female spy agent assigned to this plot (optional, boosts success) */
  agentId?: string;
  stage: PlotStage;
  /** Months remaining in preparation; 0 = ready to resolve */
  monthsLeft: number;
  cost: PlotCost;
  /** Result filled when stage === 'resolved' (or ACTIVE after resolve) */
  result?: PlotResult;
  year: number;
  month: number;
  /** 所属层级；缺省视为 L1 tactical（旧存档兼容） */
  layer?: PlotLayer;
  /** L2 进度 0~100 */
  progress?: number;
  /** L2 分期投入 */
  installments?: PlotInstallments;
}
