// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  Season,
  TerrainType,
} from './enums/index.js';
import {
  APPEASE_MAGNATE_COST,
  INSPECT_CENSUS_COST,
  INSPECT_CENSUS_LOYALTY_PENALTY,
  OFFICER_SALARY_TABLE,
  TAX_POLICY_RATES,
  calculateCityTaxRevenue,
  calculateFactionSalaries,
  getFactionCoinQuality,
  getOfficerAnnualSalary,
  getSalaryArrearsLoyaltyPenalty,
  isMagnateOfficer,
} from './fiscal.js';
import type { City } from './types/city.js';
import type { Faction } from './types/faction.js';
import type { Officer } from './types/officer.js';

describe('shared/fiscal.ts 财政税收俸禄纯函数引擎', () => {
  it('官职年俸计算：君主为 0，多重官位取最高', () => {
    const mockOfficer: Pick<Officer, 'id' | 'civilPosition' | 'militaryPosition' | 'localPosition'> = {
      id: 10,
      civilPosition: CivilPosition.CHANCELLOR,
      militaryPosition: MilitaryPosition.GENERAL,
      localPosition: LocalPosition.PREFECT,
    };
    // 丞相 800，将军 180，太守 180 -> 取最高 800
    expect(getOfficerAnnualSalary(mockOfficer, false)).toBe(800);
    // 君主领 0
    expect(getOfficerAnnualSalary(mockOfficer, true)).toBe(0);

    const colonelOfficer = {
      id: 11,
      civilPosition: CivilPosition.NONE,
      militaryPosition: MilitaryPosition.COLONEL,
      localPosition: LocalPosition.NONE,
    };
    expect(getOfficerAnnualSalary(colonelOfficer, false)).toBe(60);

    const clerkOfficer = {
      id: 12,
      civilPosition: CivilPosition.CLERK,
      militaryPosition: MilitaryPosition.NONE,
      localPosition: LocalPosition.NONE,
    };
    expect(getOfficerAnnualSalary(clerkOfficer, false)).toBe(20);

    const unranked = {
      id: 13,
      civilPosition: CivilPosition.NONE,
      militaryPosition: MilitaryPosition.NONE,
      localPosition: LocalPosition.NONE,
    };
    expect(getOfficerAnnualSalary(unranked, false)).toBe(0);
  });

  it('势力货币成色：魏 1.00，蜀 0.70，吴 0.50，群雄 1.00', () => {
    expect(getFactionCoinQuality({ id: 1 as any, name: '曹操军', rulerId: 1, kingdomName: '魏' })).toBe(1.00);
    expect(getFactionCoinQuality({ id: 2 as any, name: '刘备军', rulerId: 2, kingdomName: '汉中' })).toBe(0.70);
    expect(getFactionCoinQuality({ id: 3 as any, name: '孙权军', rulerId: 3, kingdomName: '吴' })).toBe(0.50);
    expect(getFactionCoinQuality({ id: 4 as any, name: '袁绍军', rulerId: 4 })).toBe(1.00);
    // 显式指定覆盖
    expect(getFactionCoinQuality({ id: 5 as any, name: '刘备军', rulerId: 2, coinQuality: 0.95 })).toBe(0.95);
  });

  it('豪强/豪族武将识别与标签兼容', () => {
    expect(isMagnateOfficer({ tags: ['豪族', '文官'] } as any)).toBe(true);
    expect(isMagnateOfficer({ tags: ['豪强', '武官'] } as any)).toBe(true);
    expect(isMagnateOfficer({ tags: ['名士', '宗室'] } as any)).toBe(false);
    expect(isMagnateOfficer({} as any)).toBe(false);
  });

  it('四档城市税率基线收益与豪强隐匿衰减（15%）', () => {
    const baseCity: City = {
      id: 1,
      name: '许昌',
      province: '豫州',
      x: 10,
      y: 10,
      maxPopulation: 50000,
      isCapital: false,
      isPass: false,
      specialProduct: null,
      recruitableUnits: [],
      initialStats: { farm: 100, commerce: 180, wall: 100 },
      terrain: TerrainType.PLAINS,
      stats: { farm: 100, commerce: 180, wall: 100, morale: 70 },
      gold: 1000,
      food: 1000,
      population: 10000,
      demographics: { adultMale: 3000, adultFemale: 3000, child: 2000, elder: 2000 },
      courtNetworkOpportunities: 0,
      troops: 5000,
      troopsMorale: 70,
      officers: [1, 2],
      ruler: 1,
      facilities: [],
      policy: null,
      developmentProgress: { farm: 0, commerce: 0, wall: 0 },
    };

    // 1. 标准税率 (30%) 无豪强
    const standard = calculateCityTaxRevenue({
      city: baseCity,
      season: Season.SPRING,
      coinQuality: 1.0,
      officersInCity: [],
    });
    expect(standard.taxPolicy).toBe('standard');
    expect(standard.taxRate).toBe(0.30);
    expect(standard.hasUnappeasedMagnate).toBe(false);
    expect(standard.actualTax).toBe(standard.baseTax);
    expect(standard.treasuryGold).toBe(standard.actualTax);

    // 2. 轻徭薄赋 (20%) -> 约等于标准税的 2/3
    const light = calculateCityTaxRevenue({
      city: { ...baseCity, taxPolicy: 'light' },
      season: Season.SPRING,
      coinQuality: 1.0,
      officersInCity: [],
    });
    expect(light.taxPolicy).toBe('light');
    expect(light.taxRate).toBe(0.20);
    expect(light.treasuryGold).toBe(Math.floor(standard.grossIncome * (0.20 / 0.30)));

    // 3. 豪强隐匿：未安抚状态下税收扣减 15%
    const magnateOfficer: Officer = {
      id: 20,
      name: '李典',
      tags: ['豪族'],
    } as any;
    const unappeased = calculateCityTaxRevenue({
      city: { ...baseCity, appeasedMagnate: false },
      season: Season.SPRING,
      coinQuality: 1.0,
      officersInCity: [magnateOfficer],
    });
    expect(unappeased.hasMagnate).toBe(true);
    expect(unappeased.hasUnappeasedMagnate).toBe(true);
    expect(unappeased.actualTax).toBe(Math.floor(standard.baseTax * 0.85));

    // 4. 已安抚豪强：恢复全额
    const appeased = calculateCityTaxRevenue({
      city: { ...baseCity, appeasedMagnate: true },
      season: Season.SPRING,
      coinQuality: 1.0,
      officersInCity: [magnateOfficer],
    });
    expect(appeased.hasMagnate).toBe(true);
    expect(appeased.hasUnappeasedMagnate).toBe(false);
    expect(appeased.actualTax).toBe(standard.baseTax);

    // 5. 货币成色折算（如蜀汉 0.70）
    const shuHan = calculateCityTaxRevenue({
      city: baseCity,
      season: Season.SPRING,
      coinQuality: 0.70,
      officersInCity: [],
    });
    expect(shuHan.treasuryGold).toBe(Math.floor(standard.actualTax * 0.70));
  });

  it('欠俸惩罚阶梯与常数定义合法', () => {
    expect(getSalaryArrearsLoyaltyPenalty(0)).toBe(0);
    expect(getSalaryArrearsLoyaltyPenalty(1)).toBe(2);
    expect(getSalaryArrearsLoyaltyPenalty(2)).toBe(5);
    expect(getSalaryArrearsLoyaltyPenalty(3)).toBe(10);
    expect(getSalaryArrearsLoyaltyPenalty(5)).toBe(10);

    expect(APPEASE_MAGNATE_COST).toBe(300);
    expect(INSPECT_CENSUS_COST).toBe(200);
    expect(INSPECT_CENSUS_LOYALTY_PENALTY).toBe(15);
  });

  it('势力总年俸汇总计算', () => {
    const officers: Officer[] = [
      { id: 1, faction: 1, civilPosition: CivilPosition.CHANCELLOR } as any, // 800
      { id: 2, faction: 1, militaryPosition: MilitaryPosition.GENERAL } as any, // 180
      { id: 3, faction: 1, civilPosition: CivilPosition.CLERK } as any, // 20
      { id: 99, faction: 1, civilPosition: CivilPosition.GOVERNOR } as any, // ruler -> 0
      { id: 4, faction: 2, civilPosition: CivilPosition.GOVERNOR } as any, // other faction
    ];
    const faction: Pick<Faction, 'id' | 'rulerId'> = { id: 1 as any, rulerId: 99 };
    const res = calculateFactionSalaries(officers, faction);
    expect(res.officerCount).toBe(4);
    expect(res.breakdown[99]).toBe(0);
    expect(res.breakdown[1]).toBe(800);
    expect(res.breakdown[2]).toBe(180);
    expect(res.breakdown[3]).toBe(20);
    expect(res.totalSalary).toBe(1000);
  });
});
