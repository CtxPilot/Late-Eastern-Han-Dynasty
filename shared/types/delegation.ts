// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { DelegationPolicy, Season } from '../enums/index.js';

/**
 * 委任军团系统（docs/04 §39 实装规格化见 docs/42，Session 420 S1）。
 * 委任区挂 Faction.delegationRegions（optional 旧档兼容）；仅玩家势力使用。
 */

/** 每季报告（docs/04 §39.7 / docs/42 D9）：季度首月生成并覆盖 lastReport。 */
export interface DelegationReport {
  season: Season;
  year: number;
  /** 本季行动摘要（≤8 条，截断风格同 famineNotes）。 */
  actionSummary: string[];
  troopDelta: number;
  goldDelta: number;
  foodDelta: number;
  battlesWon: number;
  battlesLost: number;
  citiesCaptured: number;
  warnings: string[];
}

/** 区内季度累计（月度 tick 推入，季度报告后清零；optional 旧档兼容）。 */
export interface DelegationSeasonAccumulator {
  actions: string[];
  battlesWon: number;
  battlesLost: number;
  citiesCaptured: number;
  /** 报告基准（季度首月记录，delta = 期末 − 基准）。 */
  baselineTroops: number;
  baselineGold: number;
  baselineFood: number;
}

/** 委任区（docs/04 §39.1 / docs/42 D9）：玩家将城池划区委任都督自动管理。 */
export interface DelegationRegion {
  /** 势力内自增 id（配合 factionId 全局定位）。 */
  id: number;
  name: string;
  /** 归属城池 id（升序维护）。 */
  cityIds: number[];
  governorId: number;
  /** 当前生效方针。 */
  policy: DelegationPolicy;
  /** 待生效方针（D5：切换每季一次、下季生效）。 */
  pendingPolicy?: DelegationPolicy;
  /** 方针变更的季度键（y<year>q<0~3>，同季二次变更拒绝）。 */
  policyChangedSeasonKey?: string;
  /** 自动搜录在野（首切片字段落库、引擎不消费，0-B 启用）。 */
  autoRecruit: boolean;
  /** 自动赏赐低忠诚（同上）。 */
  autoReward: boolean;
  createdYear: number;
  seasonAccumulator?: DelegationSeasonAccumulator;
  lastReport?: DelegationReport;
}
