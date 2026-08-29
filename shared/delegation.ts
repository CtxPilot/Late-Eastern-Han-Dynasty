// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 委任军团系统 · 共享常量与纯函数（docs/04 §39 + docs/42 D1~D6）。
 * 双端单点：服务端引擎校验、离线 worker 镜像与 UI 上限显示同源。
 * 全部确定性，零 RNG。
 */
import {
  CivilPosition,
  DelegationPolicy,
  MilitaryPosition,
  NobilityRank,
} from './enums/index.js';
import type { City } from './types/city.js';
import type { Officer } from './types/officer.js';

/** D1（docs/42）：出征军数上限 = clamp(2 + floor(城/5), 2, 6)，玩家与 AI 同规则。 */
export function maxFieldArmies(ownCityCount: number): number {
  return Math.max(2, Math.min(6, 2 + Math.floor(ownCityCount / 5)));
}

/** 势力当前在外的出征军数（garrison 郡域增援与 retreating 撤退军不占额，docs/42 D1）。 */
export function countFieldArmies(
  armies: ReadonlyArray<{ factionId: number; phase: string }>,
  factionId: number,
): number {
  return armies.filter(
    (army) => army.factionId === factionId && army.phase !== 'garrison' && army.phase !== 'retreating',
  ).length;
}

/** D3（docs/42 §39.3）：君主爵位 → 委任区基准数。 */
export const NOBILITY_REGION_BASE: Record<string, number | null> = {
  [NobilityRank.NONE]: 0,
  [NobilityRank.GUANNEI_MARQUIS]: 1,
  [NobilityRank.TING_MARQUIS]: 2,
  [NobilityRank.XIANG_MARQUIS]: 3,
  [NobilityRank.XIAN_MARQUIS]: 4,
  [NobilityRank.DUKE]: 5,
  [NobilityRank.KING]: 6,
  [NobilityRank.EMPEROR]: null, // 无上限（以城数封顶，此表项只作展示）
};

/** 总委任区上限 = 爵位基准 + floor(城/5)（docs/04 §39.3 原公式）。 */
export function maxDelegationRegions(rulerRank: string, ownCityCount: number): number {
  const base = NOBILITY_REGION_BASE[rulerRank];
  if (base == null) return Number.POSITIVE_INFINITY;
  return base + Math.floor(ownCityCount / 5);
}

/** D2（docs/42 §39.3）：文/武两轨官职各自可管辖的城数上限，取高者。 */
export function governorCityCap(civilPosition: string, militaryPosition: string): number {
  const civilCap =
    civilPosition === CivilPosition.CHANCELLOR
      ? 8
      : civilPosition === CivilPosition.GOVERNOR
        ? 4
        : civilPosition === CivilPosition.PREFECT
          ? 1
          : 0;
  const militaryCap =
    militaryPosition === MilitaryPosition.GRAND_GENERAL
      ? 6
      : militaryPosition === MilitaryPosition.GENERAL
        ? 4
        : 0;
  return Math.max(civilCap, militaryCap);
}

/** D2：官职是否足以出任都督（prefect 或 general 及以上）。 */
export function governorPositionQualified(officer: Pick<Officer, 'civilPosition' | 'militaryPosition'>): boolean {
  return governorCityCap(String(officer.civilPosition), String(officer.militaryPosition)) >= 1;
}

/** D4：委任效率 = 0.6 + 统/1000 + 政/1000 + 方针系数（docs/04 §39.5）。 */
export const DELEGATION_POLICY_EFFICIENCY_COEF: Record<string, number> = {
  development: 0.05,
  armament: 0.05,
  balanced: 0,
  offensive: 0.1,
};

export function delegationEfficiency(
  leadership: number,
  politics: number,
  policy: DelegationPolicy,
): number {
  const coef = DELEGATION_POLICY_EFFICIENCY_COEF[policy] ?? 0;
  return 0.6 + leadership / 1000 + politics / 1000 + coef;
}

/** D5：方针变更季度键（同构 grandStrategist getSeasonQuarter）。 */
export function delegationSeasonKey(year: number, month: number): string {
  return `y${year}q${Math.floor((month - 1) / 3)}`;
}

/** 方针中文名（UI 与日志共用）。 */
export function delegationPolicyLabel(policy: DelegationPolicy): string {
  return (
    {
      [DelegationPolicy.DEVELOPMENT]: '发展优先',
      [DelegationPolicy.ARMAMENT]: '军备优先',
      [DelegationPolicy.BALANCED]: '平衡型',
      [DelegationPolicy.OFFENSIVE]: '攻略型',
    } as Record<DelegationPolicy, string>
  )[policy];
}

/** 全部方针（UI 枚举下拉用）。 */
export const DELEGATION_POLICIES: readonly DelegationPolicy[] = Object.values(DelegationPolicy);

/** 区内城池金粮兵合计（报告与 UI 摘要用）。 */
export function sumRegionCities(cities: Readonly<Record<number, City>>, cityIds: readonly number[]): {
  troops: number;
  gold: number;
  food: number;
} {
  let troops = 0;
  let gold = 0;
  let food = 0;
  for (const id of cityIds) {
    const city = cities[id];
    if (!city) continue;
    troops += city.troops;
    gold += city.gold;
    food += city.food;
  }
  return { troops, gold, food };
}
