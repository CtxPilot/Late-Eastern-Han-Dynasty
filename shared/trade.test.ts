// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  PROVINCE_SPECIALTIES,
  calculateSpecialtyPriceMultiplier,
  calculateTradeRouteQuarterlyIncome,
  canEstablishTradeRoute,
  getCityActiveTradeRoutes,
  type TradeRoute,
} from './trade.js';
import { DipRelation } from './enums/index.js';
import type { City } from './types/city.js';
import type { Officer } from './types/officer.js';

function mockCity(patch: Record<string, any>): City {
  return {
    id: patch.id ?? 1,
    name: patch.name ?? '测试城',
    province: patch.province ?? '司隶',
    x: 100,
    y: 100,
    population: 50000,
    stats: {
      farm: 200,
      commerce: patch.commerce ?? 200,
      wall: 100,
      morale: 80,
      ...(patch.stats ?? {}),
    },
    ruler: patch.ruler ?? 1,
    officers: [],
    ...patch,
  } as unknown as City;
}

function mockRoute(patch: Partial<TradeRoute>): TradeRoute {
  return {
    id: patch.id ?? 'route_1_2',
    fromCityId: patch.fromCityId ?? 1,
    toCityId: patch.toCityId ?? 2,
    distance: patch.distance ?? 1,
    isCrossFaction: patch.isCrossFaction ?? false,
    factionA: patch.factionA ?? 1,
    factionB: patch.factionB ?? 1,
    status: patch.status ?? 'active',
    establishedYear: 190,
    establishedMonth: 1,
    ...patch,
  };
}

describe('trade.ts (Phase 7-05)', () => {
  describe('十三州特产矩阵与异地溢价 (PROVINCE_SPECIALTIES & calculateSpecialtyPriceMultiplier)', () => {
    it('覆盖史实十三州特产定义', () => {
      const provinces = [
        '幽州', '并州', '凉州', '冀州', '司隶', '兖州',
        '豫州', '徐州', '青州', '荆州', '扬州', '益州', '交州',
      ];
      for (const p of provinces) {
        expect(PROVINCE_SPECIALTIES[p]).toBeDefined();
        expect(PROVINCE_SPECIALTIES[p]!.length).toBeGreaterThanOrEqual(2);
      }
    });

    it('益州独有蜀锦异地运销享有 +80% 绝品溢价 (1.8x)', () => {
      const mul = calculateSpecialtyPriceMultiplier('益州', '司隶', '蜀锦');
      expect(mul).toBe(1.8);
    });

    it('交州象牙玳瑁等南洋异珍北运享有 +70% 溢价 (1.7x)', () => {
      const mul = calculateSpecialtyPriceMultiplier('交州', '冀州', '象牙');
      expect(mul).toBe(1.7);
    });

    it('北疆战马南运至荆扬交少马水乡享有 +60% 溢价 (1.6x)', () => {
      const mul = calculateSpecialtyPriceMultiplier('凉州', '扬州', '良马');
      expect(mul).toBe(1.6);
    });

    it('同州境内商路无异地溢价 (1.0x)', () => {
      const mul = calculateSpecialtyPriceMultiplier('司隶', '司隶');
      expect(mul).toBe(1.0);
    });
  });

  describe('商路季收益模型 (calculateTradeRouteQuarterlyIncome)', () => {
    const cityA = mockCity({ id: 1, name: '洛阳', province: '司隶', commerce: 300, ruler: 1 });
    const cityB = mockCity({ id: 2, name: '长安', province: '司隶', commerce: 300, ruler: 1 });
    const routeLocal = mockRoute({ fromCityId: 1, toCityId: 2, isCrossFaction: false });

    it('同势力城际商道免除关税损耗，两城平分全额收益', () => {
      const result = calculateTradeRouteQuarterlyIncome({
        route: routeLocal,
        cityA,
        cityB,
      });

      expect(result.isBlockaded).toBe(false);
      expect(result.tariffLoss).toBe(0);
      expect(result.totalIncome).toBeGreaterThan(0);
      expect(result.incomeA).toBe(result.incomeB);
    });

    it('长江/黄河水运干线享受 x1.3 运载增益', () => {
      const landRoute = mockRoute({ fromCityId: 1, toCityId: 2, isWaterWay: false });
      const waterRoute = mockRoute({ fromCityId: 1, toCityId: 2, isWaterWay: true });

      const landIncome = calculateTradeRouteQuarterlyIncome({ route: landRoute, cityA, cityB }).totalIncome;
      const waterIncome = calculateTradeRouteQuarterlyIncome({ route: waterRoute, cityA, cityB }).totalIncome;

      expect(waterIncome).toBeGreaterThan(landIncome);
    });

    it('跨势力商道遭受关税损耗，两国友好度越高通关关税损耗越低', () => {
      const cityForeign = mockCity({ id: 3, name: '邺城', province: '冀州', commerce: 300, ruler: 2 });
      const crossRoute = mockRoute({ fromCityId: 1, toCityId: 3, isCrossFaction: true, factionA: 1, factionB: 2 });

      const lowFavorResult = calculateTradeRouteQuarterlyIncome({
        route: crossRoute,
        cityA,
        cityB: cityForeign,
        diplomacyLink: { factionA: 1, factionB: 2, relation: DipRelation.NEUTRAL, favorability: 0 },
      });

      const highFavorResult = calculateTradeRouteQuarterlyIncome({
        route: crossRoute,
        cityA,
        cityB: cityForeign,
        diplomacyLink: { factionA: 1, factionB: 2, relation: DipRelation.NEUTRAL, favorability: 90 },
      });

      expect(lowFavorResult.tariffLoss).toBeGreaterThan(0);
      expect(highFavorResult.totalIncome).toBeGreaterThan(lowFavorResult.totalIncome);
    });

    it('战时兵戎相见导致商路关卡封锁，收益归零', () => {
      const cityEnemy = mockCity({ id: 4, name: '许昌', ruler: 3 });
      const warRoute = mockRoute({ fromCityId: 1, toCityId: 4, isCrossFaction: true, factionA: 1, factionB: 3 });

      const warResult = calculateTradeRouteQuarterlyIncome({
        route: warRoute,
        cityA,
        cityB: cityEnemy,
        diplomacyLink: { factionA: 1, factionB: 3, relation: DipRelation.WAR, favorability: -80 },
      });

      expect(warResult.isBlockaded).toBe(true);
      expect(warResult.totalIncome).toBe(0);
      expect(warResult.incomeA).toBe(0);
    });

    it('主管文官高才智提供贸易增益', () => {
      const plainResult = calculateTradeRouteQuarterlyIncome({
        route: routeLocal,
        cityA,
        cityB,
      });

      const officer = {
        id: 10,
        name: '荀彧',
        stats: { politics: 95, intelligence: 92 },
      } as unknown as Officer;

      const managedResult = calculateTradeRouteQuarterlyIncome({
        route: routeLocal,
        cityA,
        cityB,
        merchantOfficer: officer,
      });

      expect(managedResult.totalIncome).toBeGreaterThan(plainResult.totalIncome);
    });
  });

  describe('商路配额校验与筛选 (canEstablishTradeRoute & getCityActiveTradeRoutes)', () => {
    it('禁止在同一城池之间建立商路', () => {
      const check = canEstablishTradeRoute([], 1, 1);
      expect(check.allowed).toBe(false);
    });

    it('禁止重复开辟已存在通商的商路', () => {
      const existing = [mockRoute({ fromCityId: 1, toCityId: 2 })];
      const check1 = canEstablishTradeRoute(existing, 1, 2);
      const check2 = canEstablishTradeRoute(existing, 2, 1);
      expect(check1.allowed).toBe(false);
      expect(check2.allowed).toBe(false);
    });

    it('单城商路达配额上限 (3条) 时拦截建立', () => {
      const existing = [
        mockRoute({ fromCityId: 1, toCityId: 2 }),
        mockRoute({ fromCityId: 1, toCityId: 3 }),
        mockRoute({ fromCityId: 1, toCityId: 4 }),
      ];
      const check = canEstablishTradeRoute(existing, 1, 5, 3);
      expect(check.allowed).toBe(false);
    });

    it('准确筛选指定城池参与的活跃商路', () => {
      const existing = [
        mockRoute({ fromCityId: 1, toCityId: 2 }),
        mockRoute({ fromCityId: 2, toCityId: 3 }),
        mockRoute({ fromCityId: 4, toCityId: 5 }),
      ];
      const routesForCity2 = getCityActiveTradeRoutes(existing, 2);
      expect(routesForCity2.length).toBe(2);
    });
  });
});
