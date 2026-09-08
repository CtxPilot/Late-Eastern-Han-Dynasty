// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战役层共享工具函数
 * 从 server/src/engine/campaign.ts 抽出，供战场地图/全局共用
 */
import { planMacroCityPath } from './world-graph.js';
import type { CampaignArmy } from './types/campaign.js';

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

// ====== 围城合流（docs/43 S1：D3/D4/D7 纯函数，双端共用） ======

/** 合流组排序：兵力降序 → id 升序（确定性军序，D4 军序=兵力降序）。 */
function byTroopsDescThenId(a: CampaignArmy, b: CampaignArmy): number {
  return b.troops - a.troops || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * docs/43 D3：收集同势力 + 同围城目标（`targetNodeId ?? currentNodeId`）+ `phase='sieging'`
 * 的全部 CampaignArmy，军序=兵力降序 → id 升序；`group[0]` 即主军（兵力最大者）。
 * 非围城军/未知 armyId 返回空数组（调用方自行回退单军语义）。
 * 纯函数、零 RNG：服务端引擎与客户端 UI 共用同一口径。
 */
export function collectSiegeMergeGroup(
  armies: readonly CampaignArmy[],
  armyId: string,
): CampaignArmy[] {
  const army = armies.find((a) => a.id === armyId);
  if (!army || army.phase !== 'sieging') return [];
  const targetId = army.targetNodeId ?? army.currentNodeId;
  return armies
    .filter(
      (a) =>
        a.factionId === army.factionId &&
        a.phase === 'sieging' &&
        (a.targetNodeId ?? a.currentNodeId) === targetId,
    )
    .slice()
    .sort(byTroopsDescThenId);
}

/**
 * docs/43 D4：合成军（**结算期临时对象，不落库**，R1）。
 * `troops/food/maxTroops/maxFood`=Σ；`morale/organization/fatigue/experience`=按兵力加权 floor；
 * `formation/commanderId/unitType/参谋`=主军（`group[0]`）；`subCommanders`=各军主将+副将去重
 * （非主军主将以协同指挥身份参战，其统率参与自动战 `subMod`，且可成为战损对象）；
 * `squads`/`structures`=各军拼接（保 `squadFlankBonus`/`autoFormationMods`/攻城器械语义）。
 * 单军组原样返回真身（R4 单军路径逐字节不变）。
 */
export function buildMergedSiegeArmy(group: readonly CampaignArmy[]): CampaignArmy {
  const primary = group[0];
  if (!primary) throw new Error('合流组为空');
  if (group.length === 1) return primary;

  const totalTroops = group.reduce((n, a) => n + a.troops, 0);
  const weighted = (pick: (a: CampaignArmy) => number): number =>
    totalTroops > 0
      ? Math.floor(group.reduce((n, a) => n + pick(a) * a.troops, 0) / totalTroops)
      : Math.floor(group.reduce((n, a) => n + pick(a), 0) / group.length);

  const subCommanders: number[] = [];
  for (const army of group) {
    for (const id of [army.commanderId, ...army.subCommanderIds]) {
      if (id !== primary.commanderId && !subCommanders.includes(id)) subCommanders.push(id);
    }
  }

  return {
    ...primary,
    troops: totalTroops,
    maxTroops: group.reduce((n, a) => n + a.maxTroops, 0),
    food: group.reduce((n, a) => n + a.food, 0),
    maxFood: group.reduce((n, a) => n + a.maxFood, 0),
    morale: weighted((a) => a.morale),
    organization: weighted((a) => a.organization),
    fatigue: weighted((a) => a.fatigue),
    experience: weighted((a) => a.experience),
    subCommanderIds: subCommanders,
    squads: group.flatMap((a) => a.squads),
    structures: group.flatMap((a) => a.structures),
  };
}

/**
 * docs/43 D7/R2：把自动战总损耗按各军兵力占比分摊（floor），尾差归主军（`group[0]`）。
 * 返回与 `group` 同序的损耗数组；分摊值夹紧到该军兵力（不出现负兵力，退化小兵力场景误差 ≤ 军数−1）。
 */
export function apportionArmyLosses(group: readonly CampaignArmy[], totalLoss: number): number[] {
  const totalTroops = group.reduce((n, a) => n + a.troops, 0);
  if (group.length === 0) return [];
  if (totalTroops <= 0 || totalLoss <= 0) return group.map(() => 0);
  const losses = group.map((a) => Math.floor((totalLoss * a.troops) / totalTroops));
  const assigned = losses.reduce((n, l) => n + l, 0);
  const remainder = totalLoss - assigned;
  if (remainder > 0) losses[0] = (losses[0] ?? 0) + remainder;
  return losses.map((loss, i) => Math.max(0, Math.min(loss, group[i]!.troops)));
}
