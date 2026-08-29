// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { FactionId } from '../enums/index.js';
import type { ItemInventory } from './item.js';
import type { DelegationRegion } from './delegation.js';

/**
 * 政治阶段状态机（docs/26 霸府/称王/称帝主线，Q5 已批准）。
 * vassal=诸侯（默认），hegemon=霸府（挟天子开府），king=王，emperor=帝。
 * 线性链不可跳级，开府/称王/称帝一旦发生不可撤销。
 */
export type PoliticalStage = 'vassal' | 'hegemon' | 'king' | 'emperor';

export interface Faction {
  id: FactionId;
  name: string;
  color: string;
  rulerId: number;
  capitalCityId: number;
  scenarioMode?: 'territorial' | 'expeditionary' | 'hosted';
  headquartersLabel?: string;
  gold: number;
  food: number;
  /** 宫廷人脉库存：结交/战后接管增加；赏赐、交涉、谍报掩护和美人计消耗。 */
  courtNetwork: number;
  cityIds: number[];
  officerIds: number[];
  isPlayer: boolean;
  isAlive: boolean;
  /** 势力声望（0~1000）；旧存档缺失时相关结算按 0 兜底。 */
  fame?: number;
  /**
   * 政治阶段（docs/26，HC-P0-2）。optional 追加，旧存档无此字段时按 'vassal' 兜底。
   * 不升 schema 版本，沿用 activeBattlefieldInstance 无损追加经验。
   */
  politicalStage?: PoliticalStage;
  /**
   * 政治头衔（docs/26，HC-P0-3，Q7 方案B）。与 politicalStage 一一对应：
   * vassal→undefined、hegemon→"丞相"/"大将军"等、king→"X王"、emperor→"X帝"。
   * 独立于 rulerId，头衔变化不动 Officer 实体。
   */
  politicalTitle?: string;
  /** 开府/称王/称帝的年份记录（docs/26，HC-P0-3）。 */
  politicalStageChangedYear?: number;
  /**
   * 当前政治阶段已经完整维持的月数（docs/28，HC-P1-1）。
   * 开府/称王/称帝时归零；旧存档缺失时按 0 处理。
   */
  politicalStageAgeMonths?: number;
  /**
   * 首次称王时确定并固定的王号（不含“王”字）。
   * optional 追加，旧存档缺失不改变既有阶段语义。
   */
  kingdomName?: string;
  /** 皇权点数（0~100），霸府能力资源；诸侯按 0 处理。 */
  imperialAuthority?: number;
  /** 伪诏宣战剩余冷却季数；每逢季度开始减 1。 */
  imperialDecreeCooldown?: number;
  /** 势力宝物库存（宝物 id → 数量；未分配宝物，S13 Session 266 实装）。 */
  inventory?: ItemInventory;
  /** 天命值 0~100，势力宏观运势（S26 天命-人心双轨系统）。 */
  mandate?: number;
  /** 人心值 0~100，微观人际关系聚合（S26 天命-人心双轨系统）。 */
  popularWill?: number;
  /**
   * 兵装库存（件，S27，docs/34 §五）。月产首都+8/每城防≥150城+2，
   * 采购 10 金/件；旧存档缺失按 0 处理。
   */
  arms?: number;
  /**
   * 委任区列表（docs/04 §39 + docs/42，Session 420 S1）。仅玩家势力使用；
   * optional 追加，旧存档缺失按无委任处理。
   */
  delegationRegions?: DelegationRegion[];
}
