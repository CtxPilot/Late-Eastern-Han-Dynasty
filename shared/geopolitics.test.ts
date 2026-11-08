// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  buildProvinceGeoSummary,
  buildRealmGeoOverview,
  evaluateCityGeopolitics,
  getPassControl,
  getTribeThreatLabel,
  resolveGamePasses,
} from './geopolitics.js';
import { DEFAULT_PASSES } from './pass.js';
import { TribeThreatLevel } from './types/minority.js';
import type { GameState } from './types/game.js';
import type { City } from './types/city.js';
import type { PassEntity } from './types/pass.js';

function city(over: Partial<City> & { id: number; name: string; province: string }): City {
  return {
    terrain: 'plain',
    isCapital: false,
    isPass: false,
    ruler: null,
    specialties: [],
    ...over,
  } as unknown as City;
}

function pass(over: Partial<PassEntity> & { id: number; name: string; province: string }): PassEntity {
  return {
    x: 0,
    y: 0,
    factionId: 0,
    troops: 0,
    morale: 75,
    wall: 4000,
    maxWall: 4000,
    maxGarrison: 5000,
    isMountainPass: false,
    isRiverPass: false,
    isFortressPass: false,
    blocksRoutes: [],
    providesIntel: [],
    ...over,
  };
}

function game(over: Partial<GameState> = {}): GameState {
  return {
    playerFactionId: 1,
    currentYear: 190,
    currentMonth: 1,
    season: 0,
    cities: {},
    factions: {
      1: { id: 1, name: '曹操', color: '#3366cc' },
      2: { id: 2, name: '董卓', color: '#cc3333' },
    },
    officers: {
      101: { id: 101, name: '曹操' },
      102: { id: 102, name: '曹仁' },
    },
    minorityTribes: {},
    tradeRoutes: [],
    ...over,
  } as unknown as GameState;
}

function coreGame(passes: Record<number, PassEntity>): GameState {
  return game({
    cities: {
      1: city({ id: 1, name: '洛阳', province: '司隶', isCapital: true, ruler: 1, specialties: ['绢帛'] }),
      2: city({ id: 2, name: '长安', province: '司隶', ruler: 2 }),
      3: city({ id: 3, name: '阳翟', province: '豫州', ruler: 1 }),
      7: city({ id: 7, name: '陈留', province: '兖州', ruler: 2 }),
      13: city({ id: 13, name: '宛', province: '荆州', ruler: null }),
      25: city({ id: 25, name: '壶关', province: '并州', ruler: 1, isPass: true }),
    },
    passes,
  });
}

describe('Phase 7-09 百城地缘战略卡片与宏观沙盘纯函数 (shared/geopolitics.ts)', () => {
  it('关隘控制状态按空关、己方、中立、敌对优先级判定', () => {
    const fake = pass({ id: 1, name: '虎牢关', province: '司隶', troops: 1000, factionId: 1 });
    expect(getPassControl(fake, 1)).toBe('friendly');
    expect(getPassControl({ ...fake, factionId: 2 }, 1)).toBe('hostile');
    expect(getPassControl({ ...fake, factionId: 0 }, 1)).toBe('neutral');
    expect(getPassControl({ ...fake, troops: 0, factionId: 2 }, 1)).toBe('empty');
  });

  it('旧档缺省关隘字典时回落到 25 座名关静态基准表', () => {
    const fallback = resolveGamePasses(game());
    expect(Object.keys(fallback)).toHaveLength(DEFAULT_PASSES.length);
    expect(fallback[1]?.name).toBe('虎牢关');
  });

  it('单城画像：京畿重镇、临敌态势、敌关锁道与险阻加成联动', () => {
    const passes = {
      1: pass({
        id: 1,
        name: '虎牢关',
        province: '司隶',
        factionId: 2,
        troops: 3000,
        wall: 5000,
        maxWall: 5000,
        isFortressPass: true,
        blocksRoutes: [[1, 7]],
        providesIntel: [1, 7],
      }),
      2: pass({
        id: 2,
        name: '汜水关',
        province: '司隶',
        factionId: 1,
        troops: 2500,
        blocksRoutes: [[1, 7]],
        providesIntel: [1, 7],
      }),
    };
    const g = coreGame(passes);
    const profile = evaluateCityGeopolitics(g, 1)!;
    expect(profile).not.toBeNull();
    expect(profile.tier).toBe('capital');
    expect(profile.tierLabel).toBe('京畿重镇');
    expect(profile.exposure).toBe('frontline');
    expect(profile.hostileNeighborCount).toBe(2);
    expect(profile.friendlyNeighborCount).toBe(2);
    expect(profile.neutralNeighborCount).toBe(1);
    expect(profile.linkedPasses).toHaveLength(2);
    expect(profile.hostileLinkedPassCount).toBe(1);
    expect(profile.blockedRoutes).toHaveLength(1);
    expect(profile.blockedRoutes[0]).toMatchObject({
      passName: '虎牢关',
      fromCityId: 1,
      toCityId: 7,
    });

    const hulao = profile.linkedPasses.find((p) => p.passId === 1)!;
    expect(hulao.control).toBe('hostile');
    expect(hulao.controlLabel).toBe('敌控锁关');
    expect(hulao.defenseBonusPct).toBe(50);
    expect(hulao.wallPct).toBe(100);
    const sishui = profile.linkedPasses.find((p) => p.passId === 2)!;
    expect(sishui.control).toBe('friendly');
    expect(sishui.defenseBonusPct).toBe(30);

    expect(profile.tags).toContain('京畿重镇');
    expect(profile.tags).toContain('接壤敌境');
    expect(profile.tags).toContain('敌关锁道1');
    expect(profile.tags).toContain('敌踞关隘');
    expect(profile.tags).toContain('雄关拱卫');
    expect(profile.tags).toContain('特产绢帛');
    expect(profile.specialties).toEqual(['绢帛']);
  });

  it('单城画像：己方掌控的关隘不产生封锁，城防破损时加成归零', () => {
    const passes = {
      1: pass({
        id: 1,
        name: '虎牢关',
        province: '司隶',
        factionId: 1,
        troops: 3000,
        wall: 0,
        maxWall: 5000,
        isFortressPass: true,
        blocksRoutes: [[1, 7]],
        providesIntel: [1, 7],
      }),
    };
    const profile = evaluateCityGeopolitics(coreGame(passes), 1)!;
    expect(profile.blockedRoutes).toHaveLength(0);
    expect(profile.linkedPasses[0].control).toBe('friendly');
    expect(profile.linkedPasses[0].defenseBonusPct).toBe(0);
    expect(profile.linkedPasses[0].wallPct).toBe(0);
  });

  it('战略层级：锁钥要冲 / 通衢枢纽 / 边陲前线 / 腹地安稳 / 偏远僻壤', () => {
    const chokepointPass = pass({
      id: 4,
      name: '武关',
      province: '司隶',
      factionId: 1,
      troops: 1000,
      isFortressPass: true,
      blocksRoutes: [[2, 13]],
      providesIntel: [2, 13],
    });
    const chokepoint = evaluateCityGeopolitics(coreGame({ 4: chokepointPass }), 13)!;
    expect(chokepoint.tier).toBe('chokepoint');
    expect(chokepoint.tierLabel).toBe('锁钥要冲');

    const hubPasses = {
      5: pass({
        id: 5,
        name: '大谷关',
        province: '司隶',
        factionId: 1,
        troops: 1000,
        blocksRoutes: [[1, 13]],
        providesIntel: [1, 13],
      }),
      6: pass({
        id: 6,
        name: '旋门关',
        province: '司隶',
        factionId: 1,
        troops: 1000,
        blocksRoutes: [[2, 13]],
        providesIntel: [2, 13],
      }),
    };
    const hub = evaluateCityGeopolitics(coreGame(hubPasses), 13)!;
    expect(hub.tier).toBe('hub');

    const frontierGame = game({
      cities: {
        3: city({ id: 3, name: '阳翟', province: '豫州', ruler: 1 }),
        4: city({ id: 4, name: '平舆', province: '豫州', ruler: 1 }),
        7: city({ id: 7, name: '陈留', province: '兖州', ruler: 2 }),
        18: city({ id: 18, name: '寿春', province: '扬州', ruler: 1 }),
      },
    });
    const frontier = evaluateCityGeopolitics(frontierGame, 4)!;
    expect(frontier.tier).toBe('frontier');
    expect(frontier.exposure).toBe('frontline');

    const heartlandGame = game({
      cities: {
        3: city({ id: 3, name: '阳翟', province: '豫州', ruler: 1 }),
        4: city({ id: 4, name: '平舆', province: '豫州', ruler: 1 }),
        7: city({ id: 7, name: '陈留', province: '兖州', ruler: 1 }),
        18: city({ id: 18, name: '寿春', province: '扬州', ruler: 1 }),
      },
    });
    const heartland = evaluateCityGeopolitics(heartlandGame, 4)!;
    expect(heartland.tier).toBe('heartland');
    expect(heartland.exposure).toBe('safe');

    const remoteGame = game({
      cities: { 999: city({ id: 999, name: '孤城', province: '交州', ruler: null }) },
    });
    const remote = evaluateCityGeopolitics(remoteGame, 999)!;
    expect(remote.tier).toBe('remote');
    expect(remote.neighborCityIds).toHaveLength(0);
  });

  it('异族边患映射到关联州部，入侵级威胁抬升态势并进入标签', () => {
    const g = game({
      cities: {
        1: city({ id: 1, name: '洛阳', province: '司隶', isCapital: true, ruler: 1 }),
        2: city({ id: 2, name: '长安', province: '司隶', ruler: 1 }),
      },
      minorityTribes: {
        qiang: {
          id: 'qiang',
          name: '羌族',
          regionName: '凉州',
          relatedProvinces: ['凉州', '司隶'],
          tension: 85,
          specialUnitName: '羌族骑兵',
          specialtyTribute: '良马',
        },
      },
    });
    const profile = evaluateCityGeopolitics(g, 1)!;
    expect(profile.tribalThreats).toHaveLength(1);
    expect(profile.tribalThreats[0]).toMatchObject({
      tribeId: 'qiang',
      name: '羌族',
      threatLevel: TribeThreatLevel.INVASION,
      threatLabel: '入侵',
    });
    expect(profile.exposure).toBe('watch');
    expect(profile.tags).toContain('羌族入侵');
    expect(getTribeThreatLabel(TribeThreatLevel.RAIDING)).toBe('劫掠');
  });

  it('商路联动：活跃与封锁商路分别计数', () => {
    const g = game({
      cities: {
        1: city({ id: 1, name: '洛阳', province: '司隶', isCapital: true, ruler: 1 }),
        2: city({ id: 2, name: '长安', province: '司隶', ruler: 1 }),
      },
      tradeRoutes: [
        { id: 'r1', fromCityId: 1, toCityId: 2, status: 'active' } as any,
        { id: 'r2', fromCityId: 1, toCityId: 3, status: 'blockaded' } as any,
        { id: 'r3', fromCityId: 2, toCityId: 3, status: 'active' } as any,
      ],
    });
    const profile = evaluateCityGeopolitics(g, 1)!;
    expect(profile.activeTradeRouteCount).toBe(1);
    expect(profile.blockadedTradeRouteCount).toBe(1);
    expect(profile.tags).toContain('商路1');
  });

  it('战略评分确定性、夹紧 0~100，且渲染不修改 GameState', () => {
    const passes = {
      1: pass({
        id: 1,
        name: '虎牢关',
        province: '司隶',
        factionId: 2,
        troops: 3000,
        isFortressPass: true,
        blocksRoutes: [[1, 7]],
        providesIntel: [1, 7],
      }),
    };
    const g = coreGame(passes);
    const before = JSON.stringify(g);
    const a = evaluateCityGeopolitics(g, 1)!;
    const b = evaluateCityGeopolitics(g, 1)!;
    expect(a).toEqual(b);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
    expect(JSON.stringify(g)).toBe(before);
  });

  it('天下总览：106 城规模、关隘态势、封锁官道去重与战略节点降序', () => {
    const passes = {
      1: pass({
        id: 1,
        name: '虎牢关',
        province: '司隶',
        factionId: 2,
        troops: 3000,
        isFortressPass: true,
        blocksRoutes: [[1, 7]],
        providesIntel: [1, 7],
      }),
      2: pass({
        id: 2,
        name: '汜水关',
        province: '司隶',
        factionId: 2,
        troops: 2500,
        blocksRoutes: [[1, 7]],
        providesIntel: [1, 7],
      }),
      3: pass({
        id: 3,
        name: '函谷关',
        province: '司隶',
        factionId: 1,
        troops: 3000,
        wall: 4500,
        maxWall: 5000,
        isMountainPass: true,
        blocksRoutes: [[1, 2]],
        providesIntel: [1, 2],
      }),
      4: pass({ id: 4, name: '武关', province: '司隶', factionId: 0, troops: 0 }),
      5: pass({ id: 5, name: '孟津', province: '司隶', factionId: 0, troops: 2000 }),
    };
    const overview = buildRealmGeoOverview(coreGame(passes));

    expect(overview.totalCityCount).toBe(6);
    expect(overview.passStats).toMatchObject({
      total: 5,
      friendly: 1,
      hostile: 2,
      neutral: 1,
      empty: 1,
      fortress: 1,
      mountain: 1,
      wallDamaged: 1,
    });
    // 同一对城被两座敌关封锁，去重后仍为 1 条 1—7 官道
    expect(overview.blockedRoutes).toHaveLength(1);
    expect(overview.blockedRoutes[0]).toMatchObject({ fromCityId: 1, toCityId: 7 });

    expect(new Set(overview.provinces.map((p) => p.province))).toEqual(
      new Set(['司隶', '豫州', '兖州', '荆州', '并州']),
    );
    const scores = overview.strategicNodes.map((n) => n.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(overview.frontlineCityCount).toBeGreaterThan(0);
    expect(overview.strategicNodes[0].cityId).toBe(1);
  });

  it('州部聚合：平均分、层级计数、关隘/封锁/临敌统计与顶级层级', () => {
    const passes = {
      1: pass({
        id: 1,
        name: '虎牢关',
        province: '司隶',
        factionId: 2,
        troops: 3000,
        isFortressPass: true,
        blocksRoutes: [[1, 7]],
        providesIntel: [1, 7],
      }),
    };
    const summary = buildProvinceGeoSummary(coreGame(passes), '司隶')!;
    expect(summary.province).toBe('司隶');
    expect(summary.cityCount).toBe(2);
    expect(summary.passCount).toBe(1);
    expect(summary.hostilePassCount).toBe(1);
    // 洛阳—陈留横跨司隶/兖州，两侧州部各计一条
    expect(summary.blockedRouteCount).toBe(1);
    expect(summary.tierCounts.capital).toBe(1);
    expect(summary.topTier).toBe('capital');
    expect(summary.averageScore).toBeGreaterThan(0);
    expect(summary.strategicNodes.map((n) => n.cityId)).toContain(1);

    expect(buildProvinceGeoSummary(coreGame(passes), '幽州')).toBeNull();
  });
});
