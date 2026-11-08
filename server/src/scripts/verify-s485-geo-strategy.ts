// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-09 百城地缘战略卡片与宏观沙盘联动深化全栈验收门禁 (Session 485)
 *
 * 验证维度：
 * 1. 106 郡国逐城地缘画像（战略层级、临敌态势、地缘标签、战略评分）
 * 2. 25 座名关防御联动（归属、守备、险阻加成、所扼官道、敌关封锁）
 * 3. 异族边患与商路联动（关联州部张力、活跃/封锁商路）
 * 4. 十三州与天下两级宏观聚合
 * 5. 纯只读确定性、零状态变更、零 RNG
 * 6. 服务层、HTTP 路由与离线 Web Worker 镜像完备性
 */

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_PASSES,
  buildProvinceGeoSummary,
  buildRealmGeoOverview,
  evaluateCityGeopolitics,
  getPassControl,
  getTribeThreatLabel,
  resolveGamePasses,
} from '@leh/shared';
import type { CityGeoProfile, GameState, PassEntity } from '@leh/shared';
import { TribeThreatLevel } from '@leh/shared';
import { createGame } from '../services/game.js';
import * as gameService from '../services/game.js';

console.log('=== [Phase 7-09] 百城地缘战略卡片与宏观沙盘联动全栈验收门禁 (Session 485) ===\n');

let passedCount = 0;
const TIER_VALUES = new Set(['capital', 'chokepoint', 'hub', 'frontier', 'heartland', 'remote']);
const EXPOSURE_VALUES = new Set(['safe', 'watch', 'frontline']);

function testAssert(condition: boolean, desc: string) {
  assert.ok(condition, `[FAIL] ${desc}`);
  passedCount++;
  console.log(`  ✓ 断言 ${passedCount}: ${desc}`);
}

function makePass(over: Partial<PassEntity> & { id: number; name: string; province: string }): PassEntity {
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

// ---------------------------------------------------------
console.log('\n【1. 关隘控制状态与旧档回落】');
const basePass = makePass({ id: 1, name: '虎牢关', province: '司隶', troops: 1000, factionId: 1 });
testAssert(getPassControl(basePass, 1) === 'friendly', '己方驻军关隘判定为己方掌控');
testAssert(getPassControl({ ...basePass, factionId: 2 }, 1) === 'hostile', '敌方驻军关隘判定为敌控锁关');
testAssert(getPassControl({ ...basePass, factionId: 0 }, 1) === 'neutral', '中立势力驻军关隘判定为中立');
testAssert(getPassControl({ ...basePass, troops: 0, factionId: 2 }, 1) === 'empty', '无驻军关隘优先判定为空关');
testAssert(getTribeThreatLabel(TribeThreatLevel.UNSETTLED) === '骚动', '异族威胁等级文案映射正确');

const fallbackPasses = resolveGamePasses({ playerFactionId: 1 } as unknown as GameState);
testAssert(Object.keys(fallbackPasses).length === 25, '旧档缺省关隘字典回落 25 座名关基准表');
testAssert(fallbackPasses[1]?.name === '虎牢关', '回落字典关隘名称正确');

// ---------------------------------------------------------
console.log('\n【2. 真实 190 年百城沙盘（106 城 / 13 州 / 25 关）】');
createGame(4, 1);
gameService.doInitPasses();
const authState = gameService.getGame();
const overview = buildRealmGeoOverview(authState);

testAssert(overview.totalCityCount === 106, '天下地缘总览覆盖全部 106 座郡国城池');
testAssert(overview.provinces.length === 13, '天下地缘总览聚合成十三州部');
testAssert(overview.passStats.total === 25, '关隘态势统计覆盖 25 座名关');
testAssert(overview.passStats.fortress === 10, '雄关数量与静态基准表一致 (10 座)');
testAssert(overview.strategicNodes.length === 106, '天下战略节点覆盖全部城池');

const profiles = Object.keys(authState.cities)
  .map((id) => evaluateCityGeopolitics(authState, Number(id)))
  .filter((profile): profile is CityGeoProfile => profile != null);
testAssert(profiles.length === 106, '逐城画像覆盖全部 106 城');
testAssert(
  profiles.every((profile) => TIER_VALUES.has(profile.tier)),
  '全部城池战略层级落在六档合法枚举内',
);
testAssert(
  profiles.every((profile) => EXPOSURE_VALUES.has(profile.exposure)),
  '全部城池临敌态势落在三档合法枚举内',
);
testAssert(
  profiles.every(
    (profile) =>
      Number.isInteger(profile.score) && profile.score >= 0 && profile.score <= 100,
  ),
  '全部城池战略评分均为 0~100 的整数',
);

const sortedScores = overview.strategicNodes.map((node) => node.score);
testAssert(
  sortedScores.every((score, index) => index === 0 || sortedScores[index - 1] >= score),
  '天下战略节点严格按战略评分降序排列',
);
const topNode = overview.strategicNodes[0];
testAssert(
  topNode.tier === 'capital' || topNode.tier === 'chokepoint',
  '天下战略之首为京畿重镇或锁钥要冲',
);
testAssert(
  overview.strategicNodes.some((node) => node.tier === 'chokepoint'),
  '天下节点中至少包含一处锁钥要冲',
);

const luoyang = evaluateCityGeopolitics(authState, 1)!;
testAssert(luoyang.name === '洛阳', '洛阳单城地缘画像可解析');
testAssert(luoyang.tier === 'capital', '洛阳判定为京畿重镇');
testAssert(luoyang.neighborCityIds.length >= 5, '洛阳官道邻接不少于五城');
testAssert(luoyang.linkedPasses.length >= 1, '洛阳关联至少一座名关');
testAssert(luoyang.tags.includes('京畿重镇'), '洛阳地缘标签包含京畿重镇');
const chengdu = evaluateCityGeopolitics(authState, 19)!;
testAssert(chengdu.specialties.includes('蜀锦'), '成都地缘画像纳入州部特产蜀锦');
testAssert(chengdu.tags.includes('特产蜀锦'), '成都地缘标签包含特产蜀锦');

// ---------------------------------------------------------
console.log('\n【3. 州部聚合与关隘防御联动】');
const sili = buildProvinceGeoSummary(authState, '司隶')!;
testAssert(sili.province === '司隶', '州部聚合返回司隶');
testAssert(
  sili.cityCount === Object.values(authState.cities).filter((city) => city.province === '司隶').length,
  '司隶城数与真实城池表一致',
);
testAssert(sili.passCount === 7, '司隶聚合纳入 7 座名关');
testAssert(sili.hostilePassCount === 0, '初始 190 年司隶无敌对驻军关隘');
testAssert(sili.strategicNodes.length === sili.cityCount, '州部战略节点覆盖州内全部城池');
testAssert(sili.tierCounts.capital >= 1, '司隶州部层级计数包含京畿重镇');
testAssert(sili.topTier === 'capital', '司隶最高战略层级为京畿重镇');
testAssert(buildProvinceGeoSummary(authState, '不存在州') === null, '无城池州部返回 null');

// 关卡联动：将虎牢关改为敌控，验证封锁与态势
const hostilePass: PassEntity = {
  ...authState.passes![1],
  factionId: 2,
  troops: 3000,
  morale: 80,
};
const hostileState = {
  ...authState,
  passes: { ...authState.passes!, 1: hostilePass },
} as GameState;
const hostileLuoyang = evaluateCityGeopolitics(hostileState, 1)!;
testAssert(hostileLuoyang.hostileLinkedPassCount >= 1, '敌控虎牢关计入洛阳敌控关隘数');
testAssert(
  hostileLuoyang.linkedPasses.some(
    (pass) => pass.passId === 1 && pass.control === 'hostile' && pass.defenseBonusPct === 50,
  ),
  '敌控虎牢关保留雄关 +50% 防御加成投影',
);
testAssert(
  hostileLuoyang.blockedRoutes.some((route) => route.passId === 1 && route.toCityId === 7),
  '敌控虎牢关封锁洛阳—陈留官道',
);
testAssert(
  hostileLuoyang.blockedRoutes.some((route) => route.passId === 1 && route.toCityId === 3),
  '敌控虎牢关封锁洛阳—阳翟官道',
);
testAssert(hostileLuoyang.exposure === 'frontline', '敌关封锁与接壤敌境共同抬升洛阳为临敌态势');
testAssert(hostileLuoyang.tags.includes('敌关锁道2'), '洛阳标签记录两条敌关封锁');
testAssert(hostileLuoyang.tags.includes('敌踞关隘'), '洛阳标签记录敌踞关隘');
testAssert(hostileLuoyang.tags.includes('雄关拱卫'), '洛阳标签记录雄关拱卫');

const hostileOverview = buildRealmGeoOverview(hostileState);
testAssert(hostileOverview.passStats.hostile >= 1, '敌控关隘进入天下关隘态势统计');
testAssert(hostileOverview.blockedRoutes.length >= 2, '天下封锁官道清单纳入敌关封锁');
const damagedPass: PassEntity = { ...hostilePass, wall: 0 };
const brokenLuoyang = evaluateCityGeopolitics(
  { ...hostileState, passes: { ...hostileState.passes!, 1: damagedPass } } as GameState,
  1,
)!;
testAssert(
  brokenLuoyang.linkedPasses.find((pass) => pass.passId === 1)?.defenseBonusPct === 0,
  '关防耐久归零时险阻防御加成全数失效',
);

// ---------------------------------------------------------
console.log('\n【4. 异族边患与商路联动】');
const tribalState = {
  ...authState,
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
} as GameState;
const qiangLuoyang = evaluateCityGeopolitics(tribalState, 1)!;
testAssert(qiangLuoyang.tribalThreats.length === 1, '关联州部异族边患进入单城画像');
testAssert(
  qiangLuoyang.tribalThreats[0].threatLevel === TribeThreatLevel.INVASION,
  '羌族张力 85 映射为入侵级边患',
);
testAssert(qiangLuoyang.tags.includes('羌族入侵'), '羌族入侵进入洛阳地缘标签');

const tradeState = {
  ...authState,
  tradeRoutes: [
    {
      id: 'route_1_2',
      fromCityId: 1,
      toCityId: 2,
      distance: 1,
      isCrossFaction: false,
      factionA: 1,
      factionB: 1,
      status: 'active',
      establishedYear: 190,
      establishedMonth: 1,
    },
    {
      id: 'route_1_7',
      fromCityId: 1,
      toCityId: 7,
      distance: 1,
      isCrossFaction: false,
      factionA: 1,
      factionB: 1,
      status: 'blockaded',
      establishedYear: 190,
      establishedMonth: 1,
    },
  ],
} as GameState;
const tradeLuoyang = evaluateCityGeopolitics(tradeState, 1)!;
testAssert(tradeLuoyang.activeTradeRouteCount === 1, '洛阳活跃商路计数为 1');
testAssert(tradeLuoyang.blockadedTradeRouteCount === 1, '洛阳封锁商路计数为 1');
testAssert(tradeLuoyang.tags.includes('商路1'), '活跃商路进入洛阳地缘标签');

// ---------------------------------------------------------
console.log('\n【5. 纯只读确定性与零漂移】');
const snapshot = JSON.stringify(authState);
void buildRealmGeoOverview(authState);
void evaluateCityGeopolitics(authState, 1);
void buildProvinceGeoSummary(authState, '司隶');
testAssert(JSON.stringify(authState) === snapshot, '地缘派生全程不修改 GameState');

const overviewA = buildRealmGeoOverview(authState);
const overviewB = buildRealmGeoOverview(authState);
testAssert(JSON.stringify(overviewA) === JSON.stringify(overviewB), '天下总览同态复算完全确定');
const luoyangA = evaluateCityGeopolitics(authState, 1);
const luoyangB = evaluateCityGeopolitics(authState, 1);
testAssert(JSON.stringify(luoyangA) === JSON.stringify(luoyangB), '单城画像同态复算完全确定');
testAssert(evaluateCityGeopolitics(authState, 99999) === null, '不存在城池返回 null');

// 静态基准表与画像层级互相印证
testAssert(DEFAULT_PASSES.length === 25, '静态基准表仍为 25 座名关');
testAssert(
  profiles.every((profile) => profile.linkedPasses.every((pass) => pass.passId >= 1)),
  '全部关联关隘 id 合法',
);

// ---------------------------------------------------------
console.log('\n【6. 服务层、HTTP 路由与离线 Worker 镜像】');
testAssert(typeof gameService.doGetGeopoliticsOverview === 'function', '服务层已导出 doGetGeopoliticsOverview');
const serviceOverviewA = gameService.doGetGeopoliticsOverview();
const serviceOverviewB = gameService.doGetGeopoliticsOverview();
testAssert(JSON.stringify(serviceOverviewA) === JSON.stringify(serviceOverviewB), '服务层总览同态复算完全确定');
testAssert(serviceOverviewA.totalCityCount === 106, '服务层总览覆盖 106 城');
testAssert(serviceOverviewA.passStats.total === 25, '服务层总览覆盖 25 关');

const routeSource = readFileSync(new URL('../routes/game.ts', import.meta.url), 'utf8');
testAssert(
  routeSource.includes("gameRouter.get('/geopolitics/overview'"),
  'HTTP 路由已挂载 GET /geopolitics/overview',
);
const workerSource = readFileSync(
  new URL('../../../client/src/workers/game.worker.ts', import.meta.url),
  'utf8',
);
testAssert(
  workerSource.includes('getGeopoliticsOverview()'),
  '离线 Web Worker 已镜像 getGeopoliticsOverview',
);
testAssert(
  workerSource.includes('buildRealmGeoOverview(getClientGame())'),
  '离线 Web Worker 总览消费迷雾裁剪后的客户端状态',
);

console.log(`\n======================================================`);
console.log(`Phase 7-09 百城地缘战略沙盘全部 ${passedCount} 项断言 100% 绿色通过！`);
console.log(`======================================================\n`);
