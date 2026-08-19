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

export type DevelopmentProjectKind = 'farm' | 'commerce' | 'wall';

export interface DevelopmentProject {
  kind: DevelopmentProjectKind;
  assignedOfficerId: number;
  totalMonths: number;
  remainingMonths: number;
  totalGoldCost: number;
  goldPaid: number;
  pausedMonths: number;
  progressLostMonths: number;
  status: 'active' | 'paused';
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
  /** 本城尚可建立的宫廷人脉机会；与人口及历史女角无换算关系。 */
  courtNetworkOpportunities: number;
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
  /** R5：一城同时至多一个持续开发项目；旧存档缺失表示无项目。 */
  activeDevelopment?: DevelopmentProject;
  /**
   * 城级派系与门阀（S27，docs/34）。optional 追加，旧存档缺失时由
   * deriveCityFactions(cityId) 补种；非试点城市保持空数组。
   */
  cityFactions?: import('../city-factions.js').CityFactionEntry[];
  /** S27 巡查标记：当年×12+月；该月豁免叛乱判定。旧存档缺失表示未巡查。 */
  factionPatrolStamp?: number;
  /** S27 深化：官宦弹劾城主事件（docs/34 §十一）。optional，旧档兼容。 */
  pendingImpeachment?: import('../city-factions.js').PendingImpeachment;
  /**
   * 民屯田已分配户数（docs/04 §2.8）。optional，旧档缺省=0。
   * 与 stats.farm 平行：不花金、占人口、月结直接产粮。
   */
  civilianFarmingHouseholds?: number;
  /**
   * 民屯分配季度戳（year*4+quarter）。同季仅可调一次；旧档缺省表示本季未调。
   */
  civilianFarmingAssignQuarter?: number;
  /**
   * 军屯田开关（docs/05 §5.8.1）。optional，旧档缺省=关。
   * 开启时驻军月结产粮、每季士气−3、训练收益减半。
   */
  militaryFarming?: boolean;
  /**
   * 军屯调整季度戳（year*4+quarter）。同季仅可切换一次；旧档缺省表示本季未调。
   */
  militaryFarmingAssignQuarter?: number;
  /**
   * 本城驻军家属人口（docs/05 §5.8.2）。征兵时绑定；旧档缺省=0。
   */
  garrisonFamilies?: number;
  /**
   * 质任制：家属迁往的后方城（空=家属仍在本城）。
   */
  familyBackupCityId?: number;
  /**
   * 迁家属季度戳。每城每季限一次。
   */
  familyRelocateQuarter?: number;
}
