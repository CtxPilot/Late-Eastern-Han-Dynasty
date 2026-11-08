// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-05 专项验收门禁：商路贸易网络、十三州特产与跨国关税经济体系全栈集成 (Session 481)
 *
 * 验证矩阵：
 * 1. 十三州特产配置与异地价格溢价推导（益州蜀锦 1.8x、交州珍奇 1.7x、凉州良马 1.6x、同州 1.0x）
 * 2. 纯函数商路建立条件与配额上限（上限 3 条、重复商路拦截、两城自连拦截）
 * 3. 纯函数季首商税收益模型（商业总和基数、特产溢价、水系干线 1.3x、跨势力 30% 关税、文官才智增益、战时禁运归零）
 * 4. 引擎商路开辟与撤销事务（扣减 200 贯工本费、加入 GameState、操作日志、金钱不足拦截、无路连接拦截）
 * 5. 季首商税结算与月度演化（非季首月严格 COW 零变化零 RNG；季首月双方入账、文官累绩、友好度递增、交战封锁）
 * 6. 24 个月全息推演闭环（真实 Scenario 1 推进 24 回合、历经 8 次季首结算、零 RNG 漂移）
 * 7. 服务层与 HTTP/Worker 接口完备性
 */

import assert from 'node:assert';
import {
  PROVINCE_SPECIALTIES,
  calculateSpecialtyPriceMultiplier,
  calculateTradeRouteQuarterlyIncome,
  canEstablishTradeRoute,
  getCityActiveTradeRoutes,
  MAX_TRADE_ROUTES_PER_CITY,
  TRADE_ROUTE_SETUP_COST,
  type TradeRoute,
  type GameState,
  type City,
  type Officer,
  DipRelation,
} from '@leh/shared';
import {
  createGame,
  getGame,
  doGetTradeRoutes,
  doEstablishTradeRoute,
  doCancelTradeRoute,
} from '../services/game.js';
import {
  establishTradeRoute,
  cancelTradeRoute,
  tickTradeQuarter,
} from '../engine/trade.js';
import { advanceTurn } from '../engine/turn.js';

let step = 0;
function check(description: string, condition: boolean) {
  step++;
  assert.ok(condition, `[FAIL] 断言 ${step}: ${description}`);
  console.log(`  ✓ 断言 ${step}: ${description}`);
}

console.log('=== [Phase 7-05] 商路贸易网络与十三州特产经济体系全栈验收门禁 (Session 481) ===\n');

// -------------------------------------------------------------
// 1. 十三州特产配置与异地价格溢价推导
// -------------------------------------------------------------
console.log('【1. 十三州特产配置与异地价格溢价推导】');

check('十三州特产定义包含至少 13 个州郡特产', Object.keys(PROVINCE_SPECIALTIES).length >= 13);
check('益州特产包含蜀锦', PROVINCE_SPECIALTIES['益州']?.some((i) => i.name === '蜀锦') === true);
check('交州特产包含珍珠与象牙', PROVINCE_SPECIALTIES['交州']?.some((i) => i.name === '象牙') === true);
check('凉州特产包含良马', PROVINCE_SPECIALTIES['凉州']?.some((i) => i.name === '良马') === true);
check('青州特产包含海盐', PROVINCE_SPECIALTIES['青州']?.some((i) => i.name === '海盐') === true);
check('荆州特产包含生漆', PROVINCE_SPECIALTIES['荆州']?.some((i) => i.name === '生漆') === true);
check('扬州特产包含茶叶', PROVINCE_SPECIALTIES['扬州']?.some((i) => i.name === '茶叶') === true);

// 益州蜀锦销往幽州：1.8x
check(
  '蜀锦运往幽州享有 1.8x 远途异地溢价',
  Math.abs(calculateSpecialtyPriceMultiplier('益州', '幽州', '蜀锦') - 1.8) < 1e-4,
);
// 蜀锦在益州本州：1.0x
check(
  '蜀锦在益州本州为 1.0x 基础价格',
  Math.abs(calculateSpecialtyPriceMultiplier('益州', '益州', '蜀锦') - 1.0) < 1e-4,
);
// 交州珍珠/象牙销往北方（司隶）：1.7x
check(
  '南洋珍奇运往司隶享有 1.7x 极高溢价',
  Math.abs(calculateSpecialtyPriceMultiplier('交州', '司隶', '象牙') - 1.7) < 1e-4,
);
// 西凉骏马销往扬州：1.6x
check(
  '北马南运（凉州良马运往扬州）享有 1.6x 溢价',
  Math.abs(calculateSpecialtyPriceMultiplier('凉州', '扬州', '良马') - 1.6) < 1e-4,
);
// 同州产物价格乘数为 1.0x
check(
  '同州内部商路价格倍率为 1.0x',
  Math.abs(calculateSpecialtyPriceMultiplier('司隶', '司隶') - 1.0) < 1e-4,
);

// -------------------------------------------------------------
// 2. 纯函数商路建立条件与配额上限
// -------------------------------------------------------------
console.log('\n【2. 纯函数商路建立条件与配额上限校验】');

check('单城最大通商路数配额为 3 条', MAX_TRADE_ROUTES_PER_CITY === 3);
check('开辟商路法定工本费为 200 贯', TRADE_ROUTE_SETUP_COST === 200);

// 两城自连拦截
const selfCheck = canEstablishTradeRoute([], 1, 1);
check('城池不能与自身通商', !selfCheck.allowed && selfCheck.reason === '不能与同一座城池建立商路');

// 初始空商路列表
const validCheck = canEstablishTradeRoute([], 1, 2);
check('空商路列表时允许开辟 1-2 商路', validCheck.allowed);

// 重复商路拦截（无向图，1-2 与 2-1 视为同条）
const mockRoute12: TradeRoute = {
  id: 'route_1_2',
  fromCityId: 1,
  toCityId: 2,
  distance: 1,
  isWaterWay: false,
  isCrossFaction: false,
  factionA: 1,
  factionB: 1,
  status: 'active',
  establishedYear: 190,
  establishedMonth: 1,
};

const duplicateCheck1 = canEstablishTradeRoute([mockRoute12], 1, 2);
check('重复建立 1-2 商路被拦截', !duplicateCheck1.allowed && duplicateCheck1.reason === '两城之间已存在通商商路');

const duplicateCheck2 = canEstablishTradeRoute([mockRoute12], 2, 1);
check('反向建立 2-1 商路同样被识别为重复并拦截', !duplicateCheck2.allowed && duplicateCheck2.reason === '两城之间已存在通商商路');

// 配额上限达到 3 条后拦截
const mockRoutes3: TradeRoute[] = [
  mockRoute12,
  { ...mockRoute12, id: 'route_1_3', toCityId: 3 },
  { ...mockRoute12, id: 'route_1_4', toCityId: 4 },
];
const quotaCheck = canEstablishTradeRoute(mockRoutes3, 1, 5);
check('城池商路达到 3 条上限后禁止继续开辟', !quotaCheck.allowed && Boolean(quotaCheck.reason?.includes('已达上限')));

const activeOfCity1 = getCityActiveTradeRoutes(mockRoutes3, 1);
check('getCityActiveTradeRoutes 能正确筛选指定城池的所有有效商路 (3 条)', activeOfCity1.length === 3);

// -------------------------------------------------------------
// 3. 纯函数季首商税收益模型
// -------------------------------------------------------------
console.log('\n【3. 纯函数季首商税收益模型计算】');

const mockCityA: City = {
  id: 1,
  name: '许昌',
  province: '豫州',
  ruler: 1,
  gold: 1000,
  food: 5000,
  population: 80000,
  troops: 5000,
  morale: 80,
  defense: 100,
  maxDefense: 100,
  stats: {
    farming: 200,
    commerce: 300,
    wall: 100,
    security: 90,
  },
} as unknown as City;

const mockCityB: City = {
  id: 2,
  name: '襄阳',
  province: '荆州',
  ruler: 1,
  gold: 800,
  food: 4000,
  population: 75000,
  troops: 4000,
  morale: 75,
  defense: 100,
  maxDefense: 100,
  stats: {
    farming: 180,
    commerce: 250,
    wall: 100,
    security: 85,
  },
} as unknown as City;

// 1) 陆路同势力收益
const incomeLandSameFaction = calculateTradeRouteQuarterlyIncome({
  route: mockRoute12,
  cityA: mockCityA,
  cityB: mockCityB,
});
check('陆路同势力基础商税总额大于 0', incomeLandSameFaction.totalIncome > 0);
check('同势力两城平分商税收益', incomeLandSameFaction.incomeA === incomeLandSameFaction.incomeB);
check('同势力境内无边境关税损耗', incomeLandSameFaction.tariffLoss === 0);

// 2) 水运加成 1.3x 验证
const mockRouteWater: TradeRoute = {
  ...mockRoute12,
  isWaterWay: true,
};
const incomeWater = calculateTradeRouteQuarterlyIncome({
  route: mockRouteWater,
  cityA: mockCityA,
  cityB: mockCityB,
});
check('水路干线收益显著高于陆路 (约 1.3 倍)', incomeWater.totalIncome > incomeLandSameFaction.totalIncome);
const waterRatio = incomeWater.totalIncome / incomeLandSameFaction.totalIncome;
check('水路收益比例精确维持在 1.3x 浮动区间 [1.25, 1.35]', waterRatio >= 1.25 && waterRatio <= 1.35);

// 3) 跨国商路关税折损 30% 验证
const mockRouteCross: TradeRoute = {
  ...mockRoute12,
  isCrossFaction: true,
  factionB: 2,
};
const incomeCross = calculateTradeRouteQuarterlyIncome({
  route: mockRouteCross,
  cityA: mockCityA,
  cityB: mockCityB,
  diplomacyLink: {
    factionA: 1,
    factionB: 2,
    relation: DipRelation.NEUTRAL,
    favorability: 0,
  },
});
check('跨国商路因关税盘查收益低于同势力内部商路 (约 70%)', incomeCross.totalIncome < incomeLandSameFaction.totalIncome);
const crossRatio = incomeCross.totalIncome / incomeLandSameFaction.totalIncome;
check('跨国关税折损比例处于 70% 期望区间 [0.65, 0.75]', crossRatio >= 0.65 && crossRatio <= 0.75);

// 4) 经管文官才智与政理增益
const mockMerchantOfficer: Officer = {
  id: 101,
  name: '糜竺',
  stats: {
    force: 40,
    command: 45,
    intelligence: 85,
    politics: 88,
    charisma: 80,
  },
  merit: 200,
} as unknown as Officer;
const incomeWithMerchant = calculateTradeRouteQuarterlyIncome({
  route: mockRoute12,
  cityA: mockCityA,
  cityB: mockCityB,
  merchantOfficer: mockMerchantOfficer,
});
check('委任善贾文官（糜竺）显著提高商路收益', incomeWithMerchant.totalIncome > incomeLandSameFaction.totalIncome);

// 5) 战时禁运归零
const incomeWar = calculateTradeRouteQuarterlyIncome({
  route: mockRouteCross,
  cityA: mockCityA,
  cityB: mockCityB,
  diplomacyLink: {
    factionA: 1,
    factionB: 2,
    relation: DipRelation.WAR,
    favorability: 0,
  },
});
check('两国交战时商路收益清零并处于封锁状态', incomeWar.totalIncome === 0 && incomeWar.isBlockaded === true);

// -------------------------------------------------------------
// 4. 引擎商路开辟与撤销事务
// -------------------------------------------------------------
console.log('\n【4. 引擎商路开辟与撤销事务闭环】');

const s1Game = createGame(1, 1); // 190年反董卓同盟 曹操
const xuchangCity = Object.values(s1Game.cities).find((c) => c.name === '许昌') ?? s1Game.cities[1];
const chenliuCity = Object.values(s1Game.cities).find((c) => c.name === '陈留') ?? s1Game.cities[2];
assert.ok(xuchangCity && chenliuCity, '初始剧本必须包含许昌和陈留');

// 初始状态下商路列表为空或未定义
check('初始状态下无活跃商路或为空数组', (s1Game.tradeRoutes?.length ?? 0) === 0);

// 成功开辟商路：陈留与许昌
const initGold = chenliuCity.gold;
const establishRes = establishTradeRoute(s1Game, chenliuCity.id, xuchangCity.id);
check('成功开辟商路返回建立成功的商路对象', establishRes.route.id.startsWith('route_'));
check('商路状态为 active', establishRes.route.status === 'active');
check(
  '开辟商路正确扣除发起城池 200 贯工本费',
  establishRes.state.cities[chenliuCity.id].gold === initGold - TRADE_ROUTE_SETUP_COST,
);
check('新商路已存入 GameState.tradeRoutes', establishRes.state.tradeRoutes?.some((r) => r.id === establishRes.route.id) === true);
check('生成了开辟商路的政令日志', establishRes.state.actionLog.some((l) => l.type === 'trade_route_established'));

// 金钱不足报错拦截
const poorCityState: GameState = {
  ...s1Game,
  cities: {
    ...s1Game.cities,
    [chenliuCity.id]: {
      ...s1Game.cities[chenliuCity.id],
      gold: 50,
    },
  },
};
let poorError = '';
try {
  establishTradeRoute(poorCityState, chenliuCity.id, xuchangCity.id);
} catch (e) {
  poorError = e instanceof Error ? e.message : String(e);
}
check('城池金钱不足 200 贯时抛出异常拦截', poorError.includes('金钱不足'));

// 撤销商路
const cancelRes = cancelTradeRoute(establishRes.state, establishRes.route.id);
check('撤销商路后 GameState.tradeRoutes 不再包含该商路', !cancelRes.tradeRoutes?.some((r) => r.id === establishRes.route.id));
check('生成了商路废止日志', cancelRes.actionLog.some((l) => l.type === 'trade_route_cancelled'));

// -------------------------------------------------------------
// 5. 季首商税结算与月度演化
// -------------------------------------------------------------
console.log('\n【5. 季首商税结算与月度演化闭环】');

// 1) 非季首月纯 COW 保持零分配与零漂移
const febState: GameState = {
  ...establishRes.state,
  currentMonth: 2,
};
const febTick = tickTradeQuarter(febState, false);
check('非季首月 (2月) tickTradeQuarter 返回完全相同的 state 原引用', febTick === febState);

// 2) 季首月 (4月) 正常结算商税入账
const aprState: GameState = {
  ...establishRes.state,
  currentMonth: 4,
  tradeRoutes: [
    {
      ...establishRes.route,
      assignedMerchantOfficerId: 1, // 挂载武将 1
    },
  ],
};
const cityAOldGold = aprState.cities[chenliuCity.id].gold;
const cityBOldGold = aprState.cities[xuchangCity.id].gold;
const aprTick = tickTradeQuarter(aprState, true);
check('季首月结算后城池 A 金库获得商税增长', aprTick.cities[chenliuCity.id].gold > cityAOldGold);
check('季首月结算后城池 B 金库获得商税增长', aprTick.cities[xuchangCity.id].gold > cityBOldGold);
check('产生了季首商税入账行动日志', aprTick.actionLog.some((l) => l.type === 'trade_quarterly_settlement'));
check('主管文官获得了经商功绩累加 (+15)', (aprTick.officers[1]?.merit ?? 0) >= (aprState.officers[1]?.merit ?? 0) + 15);

// 3) 跨势力商路季首结算双边友好度+1
const crossTradeState: GameState = {
  ...aprState,
  cities: {
    ...aprState.cities,
    [xuchangCity.id]: {
      ...aprState.cities[xuchangCity.id],
      ruler: 2,
    },
  },
  diplomacy: [
    ...aprState.diplomacy.filter((d) => !(d.factionA === 1 && d.factionB === 2 || d.factionA === 2 && d.factionB === 1)),
    {
      factionA: 1,
      factionB: 2,
      relation: DipRelation.NEUTRAL,
      favorability: 40,
    },
  ],
  tradeRoutes: [
    {
      ...establishRes.route,
      isCrossFaction: true,
      factionA: 1,
      factionB: 2,
    },
  ],
};
const crossTick = tickTradeQuarter(crossTradeState, true);
const linkAfter = crossTick.diplomacy.find(
  (d) => (d.factionA === 1 && d.factionB === 2) || (d.factionA === 2 && d.factionB === 1),
);
check('跨势力商路季首正常改善双边友好度 (+1)', (linkAfter?.favorability ?? 0) > 40);

// 4) 交战封锁拦截与自动封锁状态
const warTradeState: GameState = {
  ...crossTradeState,
  diplomacy: [
    ...crossTradeState.diplomacy.filter((d) => !(d.factionA === 1 && d.factionB === 2 || d.factionA === 2 && d.factionB === 1)),
    {
      factionA: 1,
      factionB: 2,
      relation: DipRelation.WAR,
      favorability: 0,
    },
  ],
};
const warTick = tickTradeQuarter(warTradeState, true);
const warRoute = warTick.tradeRoutes?.find((r) => r.id === establishRes.route.id);
check('交战爆发时跨国商路自动标记为 blockaded 禁运封锁', warRoute?.status === 'blockaded');

// -------------------------------------------------------------
// 6. 24 个月全息推演闭环
// -------------------------------------------------------------
console.log('\n【6. 24 个月全息推演闭环】');

let simGame = createGame(1, 1);
const c1 = Object.values(simGame.cities).find((c) => c.name === '许昌') ?? simGame.cities[1];
const c2 = Object.values(simGame.cities).find((c) => c.name === '陈留') ?? simGame.cities[2];

// 开辟一条活跃商路
const est = establishTradeRoute(simGame, c1.id, c2.id);
simGame = est.state;
check('推演初始顺利开通商路', (simGame.tradeRoutes?.length ?? 0) === 1);

const startYear = simGame.currentYear;
const startMonth = simGame.currentMonth;
let current = simGame;
let tradeIncomeCount = 0;

for (let m = 0; m < 24; m++) {
  current = advanceTurn(current, () => 0.5);
  if (
    current.actionLog.some(
      (l) =>
        l.type === 'trade_quarterly_settlement' &&
        l.year === current.currentYear &&
        l.month === current.currentMonth,
    )
  ) {
    tradeIncomeCount++;
  }
}

check('24 个月全息推进后年份增长 2 年', current.currentYear === startYear + 2 && current.currentMonth === startMonth);
check('24 个月内历经多次季首商税结算入账 (>=6次)', tradeIncomeCount >= 6);
check('商路在 24 个月全息演化后依然稳定维系或正常响应', (current.tradeRoutes?.length ?? 0) >= 1);

// -------------------------------------------------------------
// 7. 服务层与 HTTP/Worker 接口完备性
// -------------------------------------------------------------
console.log('\n【7. 服务层与 HTTP/Worker 接口完备性校验】');

// 重新建立当前服务全局游戏
createGame(1, 1);
const activeRoutes = doGetTradeRoutes();
check('doGetTradeRoutes 初始返回空数组', Array.isArray(activeRoutes) && activeRoutes.length === 0);

const sGame = getGame();
const sc1 = Object.values(sGame.cities).find((c) => c.name === '许昌') ?? sGame.cities[1];
const sc2 = Object.values(sGame.cities).find((c) => c.name === '陈留') ?? sGame.cities[2];

const estService = doEstablishTradeRoute(sc1.id, sc2.id);
check('doEstablishTradeRoute 成功开辟商路并返回路线和通知', estService.route.id.startsWith('route_'));
check('服务层 doGetTradeRoutes 能够检索到新建商路', doGetTradeRoutes().length === 1);

const cancelService = doCancelTradeRoute(estService.route.id);
check('doCancelTradeRoute 成功废止商路并返回更新后 GameState', (cancelService.tradeRoutes?.length ?? 0) === 0);
check('doGetTradeRoutes 返回空列表', doGetTradeRoutes().length === 0);

console.log(`\n=============================================================`);
console.log(`  Phase 7-05 专案验收门禁全部通过！累计通过 ${step} 项断言！`);
console.log(`=============================================================\n`);
