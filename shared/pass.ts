// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { PassEntity } from './types/pass.js';

export const PASS_WALL_REPAIR_GOLD = 200;
export const PASS_WALL_REPAIR_GAIN = 300;
export const MIN_CITY_TROOPS_RESERVE = 1000;

/**
 * 25 座历史关隘静态基准表 (Session 484)
 * 对应 docs/04 §5.1 与 docs/08 §十一
 */
export const DEFAULT_PASSES: readonly PassEntity[] = [
  // 司隶 (7)
  {
    id: 1,
    name: '虎牢关',
    province: '司隶',
    x: 4120,
    y: 2420,
    factionId: 0,
    troops: 3000,
    morale: 80,
    wall: 5000,
    maxWall: 5000,
    maxGarrison: 5000,
    isMountainPass: false,
    isRiverPass: false,
    isFortressPass: true,
    blocksRoutes: [[1, 7], [1, 3]],
    providesIntel: [1, 7, 3],
  },
  {
    id: 2,
    name: '汜水关',
    province: '司隶',
    x: 4150,
    y: 2410,
    factionId: 0,
    troops: 2500,
    morale: 75,
    wall: 4000,
    maxWall: 4000,
    maxGarrison: 4000,
    isMountainPass: false,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[1, 7]],
    providesIntel: [1, 7],
  },
  {
    id: 3,
    name: '函谷关',
    province: '司隶',
    x: 3800,
    y: 2450,
    factionId: 0,
    troops: 3000,
    morale: 80,
    wall: 5000,
    maxWall: 5000,
    maxGarrison: 5000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: true,
    blocksRoutes: [[1, 2]],
    providesIntel: [1, 2],
  },
  {
    id: 4,
    name: '武关',
    province: '司隶',
    x: 3500,
    y: 2700,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3500,
    maxWall: 3500,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[2, 13]],
    providesIntel: [2, 13],
  },
  {
    id: 5,
    name: '孟津',
    province: '司隶',
    x: 4070,
    y: 2350,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3000,
    maxWall: 3000,
    maxGarrison: 4000,
    isMountainPass: false,
    isRiverPass: true,
    isFortressPass: false,
    blocksRoutes: [[1, 5], [1, 8]],
    providesIntel: [1, 5, 8],
  },
  {
    id: 6,
    name: '大谷关',
    province: '司隶',
    x: 4050,
    y: 2480,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3500,
    maxWall: 3500,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[1, 13]],
    providesIntel: [1, 13],
  },
  {
    id: 7,
    name: '旋门关',
    province: '司隶',
    x: 4180,
    y: 2440,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3500,
    maxWall: 3500,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[1, 7]],
    providesIntel: [1, 7],
  },
  // 凉州 (3)
  {
    id: 8,
    name: '大散关',
    province: '凉州',
    x: 3100,
    y: 2550,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 4000,
    maxWall: 4000,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: true,
    blocksRoutes: [[2, 20]],
    providesIntel: [2, 20],
  },
  {
    id: 9,
    name: '萧关',
    province: '凉州',
    x: 3200,
    y: 2150,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3500,
    maxWall: 3500,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[2, 22]],
    providesIntel: [2, 22],
  },
  {
    id: 10,
    name: '陇关',
    province: '凉州',
    x: 3000,
    y: 2480,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 4000,
    maxWall: 4000,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[2, 22]],
    providesIntel: [2, 22],
  },
  // 益州 (6)
  {
    id: 11,
    name: '阳平关',
    province: '益州',
    x: 2600,
    y: 2850,
    factionId: 0,
    troops: 2500,
    morale: 80,
    wall: 4500,
    maxWall: 4500,
    maxGarrison: 5000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: true,
    blocksRoutes: [[2, 20], [20, 21]],
    providesIntel: [20, 21],
  },
  {
    id: 12,
    name: '剑阁',
    province: '益州',
    x: 2550,
    y: 2950,
    factionId: 0,
    troops: 3000,
    morale: 85,
    wall: 5000,
    maxWall: 5000,
    maxGarrison: 5000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: true,
    blocksRoutes: [[20, 21]],
    providesIntel: [20, 21],
  },
  {
    id: 13,
    name: '白水关',
    province: '益州',
    x: 2580,
    y: 2900,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3500,
    maxWall: 3500,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[20, 21]],
    providesIntel: [20, 21],
  },
  {
    id: 14,
    name: '葭萌关',
    province: '益州',
    x: 2560,
    y: 3000,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3500,
    maxWall: 3500,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[20, 21]],
    providesIntel: [20, 21],
  },
  {
    id: 15,
    name: '江关',
    province: '益州',
    x: 3300,
    y: 3200,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 4000,
    maxWall: 4000,
    maxGarrison: 4000,
    isMountainPass: false,
    isRiverPass: true,
    isFortressPass: false,
    blocksRoutes: [[14, 21]],
    providesIntel: [14, 21],
  },
  {
    id: 16,
    name: '绵竹关',
    province: '益州',
    x: 2500,
    y: 3150,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 4000,
    maxWall: 4000,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[20, 21]],
    providesIntel: [20, 21],
  },
  // 荆州 (2)
  {
    id: 17,
    name: '夏口',
    province: '荆州',
    x: 4100,
    y: 3100,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3500,
    maxWall: 3500,
    maxGarrison: 4000,
    isMountainPass: false,
    isRiverPass: true,
    isFortressPass: false,
    blocksRoutes: [[14, 18], [15, 18]],
    providesIntel: [14, 15, 18],
  },
  {
    id: 18,
    name: '夷陵',
    province: '荆州',
    x: 3500,
    y: 3150,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 4000,
    maxWall: 4000,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: true,
    isFortressPass: true,
    blocksRoutes: [[14, 21]],
    providesIntel: [14, 21],
  },
  // 扬州 (3)
  {
    id: 19,
    name: '濡须口',
    province: '扬州',
    x: 4600,
    y: 3100,
    factionId: 0,
    troops: 2500,
    morale: 80,
    wall: 4500,
    maxWall: 4500,
    maxGarrison: 5000,
    isMountainPass: false,
    isRiverPass: true,
    isFortressPass: true,
    blocksRoutes: [[17, 18]],
    providesIntel: [17, 18],
  },
  {
    id: 20,
    name: '合肥',
    province: '扬州',
    x: 4550,
    y: 2950,
    factionId: 0,
    troops: 2500,
    morale: 80,
    wall: 4500,
    maxWall: 4500,
    maxGarrison: 5000,
    isMountainPass: false,
    isRiverPass: false,
    isFortressPass: true,
    blocksRoutes: [[17, 18]],
    providesIntel: [17, 18],
  },
  {
    id: 21,
    name: '牛渚',
    province: '扬州',
    x: 4700,
    y: 3150,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3500,
    maxWall: 3500,
    maxGarrison: 4000,
    isMountainPass: false,
    isRiverPass: true,
    isFortressPass: false,
    blocksRoutes: [[16, 17]],
    providesIntel: [16, 17],
  },
  // 并州 (2)
  {
    id: 22,
    name: '壶关',
    province: '并州',
    x: 4000,
    y: 2100,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 4000,
    maxWall: 4000,
    maxGarrison: 4000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [[1, 25], [5, 25]],
    providesIntel: [1, 5, 25],
  },
  {
    id: 23,
    name: '雁门关',
    province: '并州',
    x: 3950,
    y: 1600,
    factionId: 0,
    troops: 2500,
    morale: 80,
    wall: 4500,
    maxWall: 4500,
    maxGarrison: 5000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: true,
    blocksRoutes: [[24, 26]],
    providesIntel: [24, 26],
  },
  // 冀州 (2)
  {
    id: 24,
    name: '界桥',
    province: '冀州',
    x: 4300,
    y: 1950,
    factionId: 0,
    troops: 2000,
    morale: 75,
    wall: 3500,
    maxWall: 3500,
    maxGarrison: 4000,
    isMountainPass: false,
    isRiverPass: true,
    isFortressPass: false,
    blocksRoutes: [[5, 11], [11, 26]],
    providesIntel: [5, 11, 26],
  },
  {
    id: 25,
    name: '井陉关',
    province: '冀州',
    x: 4100,
    y: 1900,
    factionId: 0,
    troops: 2500,
    morale: 80,
    wall: 4500,
    maxWall: 4500,
    maxGarrison: 5000,
    isMountainPass: true,
    isRiverPass: false,
    isFortressPass: true,
    blocksRoutes: [[6, 24]],
    providesIntel: [6, 24],
  },
];

/**
 * 计算关隘防御修饰倍率
 * - 守军防御加成：雄关 +50%, 普通关隘 +30% (城防破损归零失效)
 * - 攻坚阻绝：山地关隘骑兵攻击削减 40%
 */
export function calculatePassDefenseModifier(
  pass: PassEntity,
  attackerIsCavalry = false,
): { defBonus: number; attackerPenalty: number } {
  if (pass.wall <= 0) {
    return { defBonus: 0, attackerPenalty: 0 };
  }
  const defBonus = pass.isFortressPass ? 0.50 : 0.30;
  const attackerPenalty = pass.isMountainPass && attackerIsCavalry ? 0.40 : 0;
  return { defBonus, attackerPenalty };
}

/**
 * 判定两城间道路是否被敌对/中立且有驻军的关隘所封锁阻截
 */
export function isRouteBlockedByPass(
  cityA: number,
  cityB: number,
  factionId: number,
  passes: Record<number, PassEntity>,
): { blocked: boolean; blockingPass?: PassEntity } {
  for (const pass of Object.values(passes)) {
    if (pass.troops <= 0) continue;
    // 己方或中立空兵不阻拦；若为非己方势力控制且有守军
    if (pass.factionId === factionId) continue;

    const blocks = pass.blocksRoutes.some(
      ([a, b]) => (a === cityA && b === cityB) || (a === cityB && b === cityA),
    );
    if (blocks) {
      return { blocked: true, blockingPass: pass };
    }
  }
  return { blocked: false };
}

/**
 * 校验城池是否可以向关隘调拨驻军
 */
export function canGarrisonPass(
  cityTroops: number,
  pass: PassEntity,
  dispatchCount: number,
): { allowed: boolean; reason?: string } {
  if (dispatchCount <= 0) {
    return { allowed: false, reason: '调拨兵力必须大于 0' };
  }
  if (cityTroops - dispatchCount < MIN_CITY_TROOPS_RESERVE) {
    return {
      allowed: false,
      reason: `城池至少须保留 ${MIN_CITY_TROOPS_RESERVE} 名守军维持治安`,
    };
  }
  if (pass.troops + dispatchCount > pass.maxGarrison) {
    return {
      allowed: false,
      reason: `关隘驻军超过上限 (${pass.maxGarrison})`,
    };
  }
  return { allowed: true };
}

/**
 * 校验关隘城防修缮工本与增益
 */
export function calculatePassWallRepairCost(pass: PassEntity): {
  goldCost: number;
  wallGain: number;
} {
  const missing = Math.max(0, pass.maxWall - pass.wall);
  const wallGain = Math.min(PASS_WALL_REPAIR_GAIN, missing);
  return {
    goldCost: PASS_WALL_REPAIR_GOLD,
    wallGain,
  };
}
