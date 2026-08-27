// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战役层共享工具函数
 * 从 server/src/engine/campaign.ts 抽出，供战场地图/全局共用
 */
import { planMacroCityPath } from './world-graph.js';

// ====== 常量 ======

/** 每 100 兵力每回合粮耗 × 地形系数 */
export const FOOD_PER_100_PER_TURN = 3;

// ====== 路径规划 ======

/**
 * BFS 最短路径规划（纯函数）
 * Session 381：经 WorldGraph `planMacroCityPath` 表面，行为对齐原官道 BFS。
 * 从 fromId 到 targetId，返回路径节点 ID 序列（不含起点）
 */
export function planPath(_nodes: { id: number; adjacentNodeIds: number[] }[], fromId: number, targetId: number): number[] {
  return planMacroCityPath(fromId, targetId);
}

/** 检查两节点间是否有官道可达 */
export function hasPath(nodes: { id: number; adjacentNodeIds: number[] }[], fromId: number, targetId: number): boolean {
  return planPath(nodes, fromId, targetId).length > 0;
}

// ====== 耗粮计算 ======

/** 计算行军/驻守一回合的粮草消耗 */
export function calcFoodCost(troops: number, terrainMul = 1.0): number {
  return Math.max(1, Math.floor((troops / 100) * FOOD_PER_100_PER_TURN * terrainMul));
}

// ====== 战力系数 ======

/** 兵种基础战力系数（05 §17.2 简化） */
export function unitPower(unitType: string): number {
  switch (unitType) {
    case 'heavyCav': return 1.6;
    case 'lightCav': return 1.2;
    case 'heavyInf': return 1.3;
    case 'lightInf': return 0.9;
    case 'bow': return 1.0;
    case 'crossbow': return 1.1;
    case 'lightNavy': return 0.8;
    case 'mediumNavy': return 1.0;
    case 'heavyNavy': return 1.2;
    default: return 1.0;
  }
}

/** 经验等级系数 Lv1~7（05 §17.2） */
export function expLevelCoeff(experience: number): number {
  if (experience >= 2500) return 1.8;
  if (experience >= 1800) return 1.5;
  if (experience >= 1200) return 1.3;
  if (experience >= 700) return 1.15;
  if (experience >= 300) return 1.05;
  if (experience >= 100) return 1.0;
  return 0.9;
}
