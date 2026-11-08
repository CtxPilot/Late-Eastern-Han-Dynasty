// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-08 主地图关隘要塞防御要冲体系 (Session 484)
 * 对应 docs/04 §6 关隘系统 与 docs/08 §十一 passes.json
 */
export interface PassEntity {
  /** 关隘唯一ID (1~25) */
  id: number;
  /** 关隘名 (如 虎牢关, 剑阁, 阳平关) */
  name: string;
  /** 所属州 (如 司隶, 益州, 凉州) */
  province: string;
  /** 大地图坐标 X */
  x: number;
  /** 大地图坐标 Y */
  y: number;
  /** 占领/控制势力 ID (0 为中立汉廷/无主) */
  factionId: number;
  /** 当前守备军力 (0 ~ maxGarrison) */
  troops: number;
  /** 驻军士气 (0 ~ 100) */
  morale: number;
  /** 当前城墙/关防耐久 (0 ~ maxWall) */
  wall: number;
  /** 最大城防耐久 (2000 ~ 5000) */
  maxWall: number;
  /** 最大驻军容量 (3000 ~ 5000) */
  maxGarrison: number;
  /** 驻守关隘主将 ID */
  commanderId?: number;
  /** 是否山地险隘 (骑兵攻坚衰减 40%) */
  isMountainPass: boolean;
  /** 是否水关津渡 (江淮要冲渡口) */
  isRiverPass: boolean;
  /** 是否雄关要冲 (守军防御 +50%，普通关隘 +30%) */
  isFortressPass: boolean;
  /** 封锁的城市间官道道路 [cityIdA, cityIdB] */
  blocksRoutes: [number, number][];
  /** 警戒侦察辐射的周边城市 ID */
  providesIntel: number[];
}

/** 关隘宏观摘要用于 UI/报告 */
export interface PassSummaryItem {
  id: number;
  name: string;
  province: string;
  factionId: number;
  troops: number;
  morale: number;
  wall: number;
  maxWall: number;
  commanderName?: string;
  isFortressPass: boolean;
  isMountainPass: boolean;
  isRiverPass: boolean;
  blocksRoutes: [number, number][];
}
