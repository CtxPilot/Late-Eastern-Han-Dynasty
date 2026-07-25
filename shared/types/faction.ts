// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { FactionId } from '../enums/index.js';

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
  /**
   * 美女资源库存（势力级，像金；04§30）
   * 寻访/抢夺增加；赏赐/献美/女间谍消耗
   */
  beautyStock: number;
  cityIds: number[];
  officerIds: number[];
  isPlayer: boolean;
  isAlive: boolean;
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
}
