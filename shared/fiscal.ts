// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  Season,
} from './enums/index.js';
import type { City, TaxPolicy } from './types/city.js';
import type { Faction } from './types/faction.js';
import type { Officer } from './types/officer.js';
import type { TechLevels } from './types/faction.js';
import { merchantCommerceMultiplier } from './city-factions.js';

export { TaxPolicy };

/**
 * S35 财政税收政策基准税率（docs/04 §35.2）。
 * 标准 30% 为基线（1.0x 产出锚定）。
 */
export const TAX_POLICY_RATES: Record<TaxPolicy, number> = {
  light: 0.20,
  standard: 0.30,
  heavy: 0.50,
  martial: 0.70,
};

export const TAX_POLICY_LABELS: Record<TaxPolicy, string> = {
  light: '轻徭薄赋',
  standard: '标准税赋',
  heavy: '重税严敛',
  martial: '战时征敛',
};

export const TAX_POLICY_DESCRIPTIONS: Record<TaxPolicy, string> = {
  light: '税率20%，民心+3/季，人口+2%/年，休养生息，固本培元',
  standard: '税率30%，遵循汉制旧典，收支稳健，民生安定',
  heavy: '税率50%，民心-5/季，人口-2%/年，急征钱粮以充军费',
  martial: '税率70%，民心-10/季，人口-5%/年，战时特令，不可超过2季',
};

/** 官职年俸真源对照表（docs/04 §35.3，金/年）。君主为 0。 */
export const OFFICER_SALARY_TABLE: Record<string, number> = {
  [CivilPosition.CHANCELLOR]: 800,
  [CivilPosition.GOVERNOR]: 500,
  [MilitaryPosition.GRAND_GENERAL]: 500,
  [LocalPosition.INTENDANT]: 500,
  [CivilPosition.PREFECT]: 180,
  [MilitaryPosition.GENERAL]: 180,
  [CivilPosition.MAGISTRATE]: 60,
  [MilitaryPosition.COLONEL]: 60,
  [CivilPosition.CLERK]: 20,
  [MilitaryPosition.CAPTAIN]: 20,
  [LocalPosition.ADVISOR]: 20,
};

export const APPEASE_MAGNATE_COST = 300;
export const INSPECT_CENSUS_COST = 200;
export const INSPECT_CENSUS_LOYALTY_PENALTY = 15;
export const REFORM_COINAGE_COST = 300;
export const REFORM_COINAGE_GAIN = 0.10;
export const DEBASE_COINAGE_DROP = 0.10;
export const DEBASE_COINAGE_EMERGENCY_GOLD = 300;

/**
 * 计算武将年俸（金/年）。君主领取 0。多重官职取最高俸禄。
 */
export function getOfficerAnnualSalary(
  officer: Pick<Officer, 'id' | 'civilPosition' | 'militaryPosition' | 'localPosition'>,
  isRuler: boolean,
): number {
  if (isRuler) return 0;
  const civil = OFFICER_SALARY_TABLE[officer.civilPosition ?? ''] ?? 0;
  const mil = OFFICER_SALARY_TABLE[officer.militaryPosition ?? ''] ?? 0;
  const loc = OFFICER_SALARY_TABLE[officer.localPosition ?? ''] ?? 0;
  return Math.max(civil, mil, loc);
}

/**
 * 获取势力货币成色（0.50~1.00，docs/04 §35.1）。
 * 魏 1.00（五铢钱），蜀 0.70（直百五铢），吴 0.50（大泉五百/当千），群雄默认 1.00。
 */
export function getFactionCoinQuality(
  faction: Pick<Faction, 'id' | 'name' | 'rulerId' | 'coinQuality' | 'kingdomName'>,
): number {
  if (typeof faction.coinQuality === 'number' && faction.coinQuality >= 0.5 && faction.coinQuality <= 1.0) {
    return faction.coinQuality;
  }
  const name = faction.name ?? '';
  const king = faction.kingdomName ?? '';
  if (name.includes('曹') || name.includes('魏') || king === '魏') return 1.00;
  if (name.includes('刘备') || name.includes('蜀') || name.includes('汉') || king === '汉' || king === '汉中') return 0.70;
  if (name.includes('孙') || name.includes('吴') || king === '吴') return 0.50;
  return 1.00;
}

/**
 * 判断武将是否为豪强/豪族（docs/04 §4.1、§35.2）。
 */
export function isMagnateOfficer(officer: Pick<Officer, 'tags'>): boolean {
  if (!officer.tags || !Array.isArray(officer.tags)) return false;
  return officer.tags.some((t) => t === '豪族' || t === '豪强');
}

export interface CityTaxRevenueResult {
  grossIncome: number;
  taxPolicy: TaxPolicy;
  taxRate: number;
  hasMagnate: boolean;
  hasUnappeasedMagnate: boolean;
  baseTax: number;
  actualTax: number;
  treasuryGold: number;
  privateReserve: number;
}

/**
 * 计算城市单月税收（docs/04 §35.2）。
 * 毛收入 = (commerce / 9) * (0.7 + adultShare) * goldMul * merchantMod * techMul
 * 税率   = 城市税赋政策决定（以 standard 30% 为 1.0 基线映射）
 * 豪强隐匿 = 若城中任职武将有豪强且未安抚/检籍，基础税收 -15%
 * 金库收入 = floor(实际税收 × coinQuality)
 * 民间留存 = 毛收入 - 实际税收
 */
export function calculateCityTaxRevenue(params: {
  city: City;
  officersInCity?: Officer[];
  coinQuality?: number;
  season: Season;
  techLevels?: TechLevels;
  isScorched?: boolean;
}): CityTaxRevenueResult {
  const { city, officersInCity = [], coinQuality = 1.0, season, techLevels, isScorched = false } = params;
  if (isScorched) {
    return {
      grossIncome: 0,
      taxPolicy: city.taxPolicy ?? 'standard',
      taxRate: city.taxRate ?? TAX_POLICY_RATES.standard,
      hasMagnate: false,
      hasUnappeasedMagnate: false,
      baseTax: 0,
      actualTax: 0,
      treasuryGold: 0,
      privateReserve: 0,
    };
  }

  const d = city.demographics;
  const totalPop = Math.max(1, city.population);
  const adultShare = (d.adultMale + d.adultFemale) / totalPop;
  const goldMul = season === Season.WINTER ? 1.1 : season === Season.SUMMER ? 1.1 : 1.0;

  const merchantMod = 1 + merchantCommerceMultiplier(city.cityFactions ?? []);
  const commerceTech = techLevels?.commerce ?? 0;
  const commerceTechMul = commerceTech >= 3 ? 1.3 : commerceTech >= 2 ? 1.2 : commerceTech >= 1 ? 1.1 : 1.0;
  const taxExtraMul = commerceTech >= 5 ? 1.3 : commerceTech >= 3 ? 1.1 : 1.0;

  const grossIncome = Math.floor(
    (city.stats.commerce / 9) * (0.7 + adultShare) * goldMul * merchantMod * commerceTechMul * taxExtraMul,
  );

  const policy = city.taxPolicy ?? 'standard';
  const taxRate = city.taxRate ?? (TAX_POLICY_RATES[policy] ?? 0.30);

  const hasMagnate = officersInCity.some(isMagnateOfficer);
  const hasUnappeasedMagnate = hasMagnate && !(city.appeasedMagnate ?? false);

  // 标准税赋 30% 对准旧系统 baseline
  const rateScalar = taxRate / 0.30;
  const baseTax = Math.floor(grossIncome * rateScalar);
  const actualTax = hasUnappeasedMagnate ? Math.floor(baseTax * 0.85) : baseTax;

  const treasuryGold = Math.floor(actualTax * coinQuality);
  const privateReserve = Math.max(0, grossIncome - actualTax);

  return {
    grossIncome,
    taxPolicy: policy,
    taxRate,
    hasMagnate,
    hasUnappeasedMagnate,
    baseTax,
    actualTax,
    treasuryGold,
    privateReserve,
  };
}

export interface FactionSalaryResult {
  totalSalary: number;
  officerCount: number;
  breakdown: Record<number, number>;
}

/**
 * 汇总计算势力所有非君主武将岁首年俸（docs/04 §35.3）。
 */
export function calculateFactionSalaries(
  officers: Officer[],
  faction: Pick<Faction, 'id' | 'rulerId'>,
): FactionSalaryResult {
  const factionOfficers = officers.filter((o) => o.faction === faction.id);
  const breakdown: Record<number, number> = {};
  let totalSalary = 0;
  for (const o of factionOfficers) {
    const isRuler = o.id === faction.rulerId;
    const salary = getOfficerAnnualSalary(o, isRuler);
    breakdown[o.id] = salary;
    totalSalary += salary;
  }
  return {
    totalSalary,
    officerCount: factionOfficers.length,
    breakdown,
  };
}

/**
 * 欠俸惩罚梯度（docs/04 §35.3）。
 * 欠俸1季 → 忠诚 -2；欠俸2季 → 忠诚 -5；欠俸3季及以上 → 忠诚 -10。
 */
export function getSalaryArrearsLoyaltyPenalty(arrearsQuarters: number): number {
  if (arrearsQuarters <= 0) return 0;
  if (arrearsQuarters === 1) return 2;
  if (arrearsQuarters === 2) return 5;
  return 10;
}
