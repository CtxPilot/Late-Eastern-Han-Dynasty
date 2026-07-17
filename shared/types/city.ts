// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type {
  CityFacility,
  CityPolicy,
  CityTier,
  ResourceType,
  TerrainType,
  UnitType,
} from '../enums/index.js';

export interface CityInitialStats {
  farm: number;
  commerce: number;
  wall: number;
}

export interface CityRuntimeStats {
  farm: number;
  commerce: number;
  wall: number;
  morale: number;
}

/** Static JSON record (cities.json) */
export interface CityStatic {
  id: number;
  /** Display name = 治所/通用地名 (洛阳/长安/成都…) */
  name: string;
  /** Formal 郡国 administrative name when different from display */
  adminName?: string;
  province: string;
  x: number;
  y: number;
  maxPopulation: number;
  isCapital: boolean;
  isPass: boolean;
  specialProduct: string | null;
  recruitableUnits: UnitType[];
  initialStats: CityInitialStats;
  resourceOutput?: Partial<Record<ResourceType, number>>;
  tier?: CityTier;
  latitudeIndex?: number;
  specialties?: string[];
  countyCount?: number;
  facilities?: CityFacility[];
  policy?: CityPolicy | null;
  developmentProgress?: {
    farm: number;
    commerce: number;
    wall: number;
  };
}

/**
 * 城市人口结构（人）— 见 04§28 / shared/demographics.ts
 * population ≡ adultMale+adultFemale+child+elder
 */
export interface CityDemographics {
  adultMale: number;
  adultFemale: number;
  child: number;
  elder: number;
}

/** Runtime city entity */
export interface City extends CityStatic {
  terrain: TerrainType;
  stats: CityRuntimeStats;
  gold: number;
  food: number;
  /** 总人口（与 demographics 同步） */
  population: number;
  /** 人口四桶；开局必填 */
  demographics: CityDemographics;
  /**
   * 潜在可寻次数（04§30）：寻访成功 −1；抢夺可多扣
   * 开局 ≈ floor(adultFemale/400)；不随人口每月强制重刷
   */
  beautySeekLeft: number;
  /**
   * @deprecated 旧 Demo 字段；请用 beautySeekLeft / Faction.beautyStock
   * 保留可选以免旧存档；新局不写
   */
  beautyPool?: number;
  troops: number;
  troopsMorale: number;
  officers: number[];
  ruler: number | null;
  facilities: CityFacility[];
  policy: CityPolicy | null;
  developmentProgress: {
    farm: number;
    commerce: number;
    wall: number;
  };
}
