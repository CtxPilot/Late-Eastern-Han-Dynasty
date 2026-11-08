// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-03 专项验收门禁：天下大势演进与九品中正制门阀政治全栈集成 (Session 479)
 *
 * 验证矩阵：
 * 1. 天下大势宏观演进（GeneralTrendStage 年份推导、格局动态演进、元数据自洽）
 * 2. 九品中正制中正考评算法（evaluateOfficerRankGrade：名门士族优势、寒门壁垒、功绩打破门阀）
 * 3. 官职体系中正品阶门槛校验（PositionReq minRankGrade、appointOfficer 拦截与破格）
 * 4. 势力九品中正大定品与官绅分布摘要（conductNineRanksEvaluation & getNineRanksSummary）
 * 5. 24 个月全息月结推演演进与岁首定品重核闭环
 */

import assert from 'node:assert';
import {
  GeneralTrendStage,
  deriveTrendStage,
  getTrendStage,
  TREND_STAGE_INFO,
  rankGradeLabel,
  isUpperRank,
  isMiddleRank,
  isLowerRank,
  evaluateOfficerRankGrade,
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  HegemonyPosition,
  CIVIL_REQ,
  LOCAL_REQ,
  MILITARY_REQ,
  HEGEMONY_REQ,
  meetsPositionReq,
  formatReq,
  type GameState,
} from '@leh/shared';
import { createGame, getGame } from '../services/game.js';
import { appointOfficer } from '../engine/appoint.js';
import { conductNineRanksEvaluation, getNineRanksSummary } from '../engine/nineRanks.js';

let step = 0;
function check(description: string, condition: boolean) {
  step++;
  assert.ok(condition, `[FAIL] 断言 ${step}: ${description}`);
  console.log(`  ✓ 断言 ${step}: ${description}`);
}

console.log('=== [Phase 7-03] 天下大势演进与九品中正制门阀政治专项门禁 (Session 479) ===\n');

// -------------------------------------------------------------
// 1. 天下大势演进推导与宏观政局判定
// -------------------------------------------------------------
console.log('【1. 天下大势演进推导与宏观政局判定】');

// 1.1 年份编年区间推导
check('190 年为群雄割据阶段', deriveTrendStage(190) === GeneralTrendStage.WARLORDS_DISORDER);
check('199 年为群雄割据阶段', deriveTrendStage(199) === GeneralTrendStage.WARLORDS_DISORDER);
check('200 年推进至中原争霸阶段', deriveTrendStage(200) === GeneralTrendStage.HEGEMONY_CONTEST);
check('207 年仍为中原争霸阶段', deriveTrendStage(207) === GeneralTrendStage.HEGEMONY_CONTEST);
check('208 年赤壁烽起推进至三分鼎立阶段', deriveTrendStage(208) === GeneralTrendStage.THREE_KINGDOMS_FORMING);
check('219 年仍为三分鼎立阶段', deriveTrendStage(219) === GeneralTrendStage.THREE_KINGDOMS_FORMING);
check('220 年黄初称制推进至三国对峙阶段', deriveTrendStage(220) === GeneralTrendStage.THREE_KINGDOMS_RIVALRY);
check('264 年对峙甲子仍为三国对峙阶段', deriveTrendStage(264) === GeneralTrendStage.THREE_KINGDOMS_RIVALRY);
check('265 年晋代曹魏推进至九州归一阶段', deriveTrendStage(265) === GeneralTrendStage.UNIFICATION_CLIMAX);
check('280 年天下一统仍为九州归一阶段', deriveTrendStage(280) === GeneralTrendStage.UNIFICATION_CLIMAX);

// 1.2 元数据完整性
check('群雄割据阶段元数据标签正确', TREND_STAGE_INFO[GeneralTrendStage.WARLORDS_DISORDER].label === '群雄割据');
check('三国对峙阶段元数据描述非空', TREND_STAGE_INFO[GeneralTrendStage.THREE_KINGDOMS_RIVALRY].description.includes('建号'));
check('九州归一阶段历史时期为 265+', TREND_STAGE_INFO[GeneralTrendStage.UNIFICATION_CLIMAX].period === '265+');

// 1.3 动态格局提前流转判定
const mockedUnifiedState = {
  currentYear: 205,
  factions: {
    1: { id: 1, isAlive: true, cityIds: [1, 2, 3] },
    2: { id: 2, isAlive: false, cityIds: [] },
  },
  cities: { 1: {}, 2: {}, 3: {} },
} as unknown as GameState;
check('全图唯有一存活领地势力时提前步入九州归一', deriveTrendStage(205, mockedUnifiedState) === GeneralTrendStage.UNIFICATION_CLIMAX);

const mockedDualEmperorsState = {
  currentYear: 215,
  factions: {
    1: { id: 1, isAlive: true, cityIds: [1], politicalStage: 'emperor' },
    2: { id: 2, isAlive: true, cityIds: [2], politicalStage: 'emperor' },
  },
  cities: { 1: {}, 2: {} },
} as unknown as GameState;
check('多势力称帝且年份超过208提前确立三国对峙大势', deriveTrendStage(215, mockedDualEmperorsState) === GeneralTrendStage.THREE_KINGDOMS_RIVALRY);

// 1.4 getTrendStage 状态读取
const explicitState = {
  currentYear: 190,
  trendStage: GeneralTrendStage.THREE_KINGDOMS_RIVALRY,
  factions: {},
  cities: {},
} as unknown as GameState;
check('getTrendStage 优先读取显式 trendStage 字段', getTrendStage(explicitState) === GeneralTrendStage.THREE_KINGDOMS_RIVALRY);

// -------------------------------------------------------------
// 2. 九品中正法定品体系与门阀考评算法
// -------------------------------------------------------------
console.log('\n【2. 九品中正法定品体系与门阀考评算法】');

// 2.1 品阶层级分类函数
check('1 品为上品', isUpperRank(1));
check('3 品为上品', isUpperRank(3));
check('4 品非上品', !isUpperRank(4));
check('4 品为中品', isMiddleRank(4));
check('6 品为中品', isMiddleRank(6));
check('7 品为下品', isLowerRank(7));
check('9 品为下品', isLowerRank(9));
check('品阶标签格式清晰规范', rankGradeLabel(1).includes('一品') && rankGradeLabel(9).includes('九品'));

// 2.2 考评算法实测：世家名门顶级文武（一品~二品）
const mockNoblePrime = {
  id: 101,
  name: '荀彧',
  tags: ['名门', '士族', '海内名士', '经学大师'],
  merit: 2000,
  stats: { leadership: 70, war: 30, intelligence: 96, politics: 98, charisma: 95, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 90, tactics: 85 },
} as any;
const noblePrimeGrade = evaluateOfficerRankGrade(mockNoblePrime);
check('名门士族海内名士得评一品极品', noblePrimeGrade === 1);
check('一品官员符合上品标准', isUpperRank(noblePrimeGrade));

// 2.3 普通士族中品起阶（3~4 品）与下品不流保护
const mockOrdinaryNoble = {
  id: 102,
  name: '士族常卿',
  tags: ['士族'],
  merit: 100,
  stats: { leadership: 55, war: 45, intelligence: 68, politics: 70, charisma: 65, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 50, tactics: 50 },
} as any;
const ordinaryNobleGrade = evaluateOfficerRankGrade(mockOrdinaryNoble);
check('普通士族官员定品为四品', ordinaryNobleGrade === 4);
check('普通士族官员符合中品标准', isMiddleRank(ordinaryNobleGrade));

const mockIncompetentNoble = {
  id: 103,
  name: '门阀劣质子弟',
  tags: ['士族', '名门'],
  merit: 0,
  stats: { leadership: 42, war: 42, intelligence: 45, politics: 45, charisma: 45, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 50, tactics: 50 },
} as any;
const incompetentNobleGrade = evaluateOfficerRankGrade(mockIncompetentNoble);
check('下品无势族：无能名门子弟受门阀底线保护不堕入下品 (≤6品)', incompetentNobleGrade <= 6);

// 2.4 寒门壁垒与打破门阀机制
const mockCommonerSoldier = {
  id: 104,
  name: '寒门走卒',
  tags: ['寒门', '平民'],
  merit: 0,
  stats: { leadership: 60, war: 65, intelligence: 40, politics: 35, charisma: 40, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 50, tactics: 50 },
} as any;
const commonerSoldierGrade = evaluateOfficerRankGrade(mockCommonerSoldier);
check('寒门低才官员定为八~九品下品', commonerSoldierGrade >= 8);
check('寒门低才官员属于下品', isLowerRank(commonerSoldierGrade));

const mockCommonerSkilled = {
  id: 105,
  name: '寒门能吏',
  tags: ['寒门'],
  merit: 500,
  stats: { leadership: 78, war: 75, intelligence: 82, politics: 80, charisma: 60, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 60, tactics: 60 },
} as any;
const commonerSkilledGrade = evaluateOfficerRankGrade(mockCommonerSkilled);
check('上品无寒门：寒门中材武将被门阀壁垒拦截于上品之外 (≥4品)', commonerSkilledGrade >= 4);

const mockCommonerLegend = {
  id: 106,
  name: '寒门名将',
  tags: ['寒门'],
  merit: 25000, // Lv13 功绩 (>= Lv12 突破门槛)
  stats: { leadership: 95, war: 98, intelligence: 60, politics: 40, charisma: 80, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 70, tactics: 70 },
} as any;
const commonerLegendGrade = evaluateOfficerRankGrade(mockCommonerLegend);
check('寒门名将以卓越才德与功绩打破门阀壁垒跻身中坚四品', commonerLegendGrade <= 4);

// -------------------------------------------------------------
// 3. 官职体系中正品阶门槛校验与任命拦截
// -------------------------------------------------------------
console.log('\n【3. 官职体系中正品阶门槛校验与任命拦截】');

// 3.1 官职配置表 minRankGrade 规则对齐
check('丞相要求 2 品及以上', CIVIL_REQ[CivilPosition.CHANCELLOR]?.minRankGrade === 2);
check('尚书令要求 2 品及以上', CIVIL_REQ[CivilPosition.SHANGSHU_CHIEF]?.minRankGrade === 2);
check('六曹尚书要求 3 品及以上', CIVIL_REQ[CivilPosition.SECRETARY_MINISTER]?.minRankGrade === 3);
check('州牧要求 2 品及以上', LOCAL_REQ[LocalPosition.PROV_GOVERNOR]?.minRankGrade === 2);
check('刺史要求 3 品及以上', LOCAL_REQ[LocalPosition.PROV_INSPECTOR]?.minRankGrade === 3);
check('太守要求 5 品及以上', LOCAL_REQ[LocalPosition.PREFECT]?.minRankGrade === 5);
check('都尉要求 6 品及以上', LOCAL_REQ[LocalPosition.COMMANDERY_COMMANDANT]?.minRankGrade === 6);
check('县令要求 7 品及以上', LOCAL_REQ[LocalPosition.COUNTY_MAGISTRATE]?.minRankGrade === 7);
check('大将军要求 2 品及以上', MILITARY_REQ[MilitaryPosition.GRAND_GENERAL]?.minRankGrade === 2);
check('四方将军要求 3 品及以上', MILITARY_REQ[MilitaryPosition.SENIOR_GENERAL]?.minRankGrade === 3);
check('偏将军要求 6 品及以上', MILITARY_REQ[MilitaryPosition.SUB_GENERAL]?.minRankGrade === 6);
check('大司马霸府官职要求 1 品极品', HEGEMONY_REQ[HegemonyPosition.GRAND_COMMANDER]?.minRankGrade === 1);
check('录尚书事要求 2 品及以上', HEGEMONY_REQ[HegemonyPosition.REGENT_SECRETARY]?.minRankGrade === 2);

// 3.2 formatReq 提示文案包含品阶要求
const chancellorReqText = formatReq(CIVIL_REQ[CivilPosition.CHANCELLOR]!);
check('门槛格式化提示文本包含需2品及以上', chancellorReqText.includes('需2品及以上'));

// 3.3 meetsPositionReq 纯函数校验
const highStats = { leadership: 90, war: 90, intelligence: 90, politics: 90, charisma: 90, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 50, tactics: 50 };
check('属性功绩充足且品阶合格(2品)满足丞相门槛', meetsPositionReq(highStats, CIVIL_REQ[CivilPosition.CHANCELLOR]!, 10, 2));
check('品阶不足(4品)无法满足丞相门槛(需2品)', !meetsPositionReq(highStats, CIVIL_REQ[CivilPosition.CHANCELLOR]!, 10, 4));

// 3.4 引擎层 appointOfficer 实装拦截检验
const YUAN_SHAO = 2; // 剧本 4 袁绍
createGame(4, YUAN_SHAO);
let state = getGame();

// 给沮授 (id=157) 和审配 (id=158) 配置测试数据
// 沮授: 设为 4 品；审配: 设为 2 品
state.officers[157].merit = 2000; // Lv7
state.officers[158].merit = 2000; // Lv7
state.officers[157].stats = { ...state.officers[157].stats, politics: 85, intelligence: 85 };
state.officers[158].stats = { ...state.officers[158].stats, politics: 85, intelligence: 85 };
state.officers[157].rankGrade = 4; // 4 品
state.officers[158].rankGrade = 2; // 2 品

// 3.4.1 沮授 (4品) 任命丞相 (需2品及以上) 应被拦截
let caughtError = false;
try {
  appointOfficer(state, 157, 'civil', CivilPosition.CHANCELLOR);
} catch (e: any) {
  caughtError = true;
  check('品阶不足被成功拦截并抛出精准文案', e.message.includes('门阀品阶不足') && e.message.includes('需2品及以上'));
}
check('四品官员任丞相被品阶门槛拦截', caughtError);

// 3.4.2 审配 (2品) 任命丞相顺利通过
state = appointOfficer(state, 158, 'civil', CivilPosition.CHANCELLOR);
check('二品官员成功任命为丞相', state.officers[158].civilPosition === CivilPosition.CHANCELLOR);

// 3.4.3 君主任命豁免品阶门槛验证
const rulerId = state.factions[YUAN_SHAO].rulerId;
state.officers[rulerId].stats = { ...state.officers[rulerId].stats, leadership: 90, war: 90 };
state.officers[rulerId].rankGrade = 9; // 故意给君主设置 9 品（而车骑将军需 2 品）
const afterRulerAppoint = appointOfficer(state, rulerId, 'military', MilitaryPosition.CHARIOT_CAVALRY_GENERAL);
check('君主任命官职豁免九品门槛限制顺利就职', afterRulerAppoint.officers[rulerId].militaryPosition === MilitaryPosition.CHARIOT_CAVALRY_GENERAL);

// -------------------------------------------------------------
// 4. 势力中正大巡查定品与摘要服务
// -------------------------------------------------------------
console.log('\n【4. 势力中正大巡查定品与摘要服务】');

// 初始化剧本 4 曹操势力 (id=3)
const CAO_CAO = 3;
createGame(4, CAO_CAO);
let ccState = getGame();

// 巡查前验证
const ccOfficersBefore = Object.values(ccState.officers).filter((o) => o.faction === CAO_CAO && o.status === 'active');
check('曹操麾下拥有多名在职武将', ccOfficersBefore.length > 5);

// 执行九品中正全员定品
ccState = conductNineRanksEvaluation(ccState, CAO_CAO);
const ccOfficersAfter = Object.values(ccState.officers).filter((o) => o.faction === CAO_CAO && o.status === 'active');
check('巡查定品后全部在任百官完成 rankGrade 赋值', ccOfficersAfter.every((o) => o.rankGrade != null && o.rankGrade >= 1 && o.rankGrade <= 9));

// 检查天下大势同步
check('定品后自动同步天下大势 trendStage 为群雄割据', ccState.trendStage === GeneralTrendStage.WARLORDS_DISORDER);

// 检查日志记录
const latestLog = ccState.actionLog[0];
check('actionLog 正确登记九品官人给定品诏令', latestLog.type === 'nine_ranks_evaluation' && latestLog.message.includes('九品官人'));

// 获取九品分布摘要
const summary = getNineRanksSummary(ccState, CAO_CAO);
console.log('  [DEBUG] 曹操初始九品分布摘要:', JSON.stringify(summary));
check('摘要准确统计总官员数', summary.totalOfficers === ccOfficersAfter.length);
check('摘要包含中品或上品官员计数', summary.upperCount + summary.middleCount > 0);
check('摘要包含中品官员计数', summary.middleCount > 0);
check('上品+中品+下品总和与总官员数完全一致', summary.upperCount + summary.middleCount + summary.lowerCount === summary.totalOfficers);
check('1~9品分布字典格式健全', Object.keys(summary.gradeDistribution).length === 9);

// -------------------------------------------------------------
// 5. 24 个月全息推演闭环、跨大势阶段与岁首定品重核
// -------------------------------------------------------------
console.log('\n【5. 24 个月全息推演闭环、跨大势阶段与岁首定品重核】');

import { advanceTurn } from '../engine/turn.js';

// 初始年份 190 年 1 月，曹操
let simState = ccState;
const startYear = simState.currentYear;
const startMonth = simState.currentMonth;

// 为某位武将特意赋予功绩，观察岁首重核品阶提升
const testOfficer = ccOfficersAfter.find((o) => o.id !== simState.factions[CAO_CAO].rulerId)!;
const initialGrade = testOfficer.rankGrade!;
// 赋予巨额功绩
simState.officers[testOfficer.id].merit = 35000; // Lv14 功绩

// 连续推进 24 回合
for (let i = 0; i < 24; i++) {
  simState = advanceTurn(simState, () => 0.5);
}

check('24 回合月结推进成功，年份前进恰好 2 年', simState.currentYear === startYear + 2 && simState.currentMonth === startMonth);
check('在任官员 rankGrade 保持有效健全', Object.values(simState.officers).filter((o) => o.faction === CAO_CAO).every((o) => o.rankGrade == null || (o.rankGrade >= 1 && o.rankGrade <= 9)));
check('大功将领历经岁首考评品阶得到晋升或保持高阶', simState.officers[testOfficer.id].rankGrade! <= initialGrade);

// 验证跨大势流转：将年份推进到 200 年（中原争霸）
const leapState = {
  ...simState,
  currentYear: 200,
  currentMonth: 1,
  trendStage: GeneralTrendStage.WARLORDS_DISORDER, // 故意设为旧阶段
};
// 推进一回合，验证月结自动更新 trendStage
const nextLeapState = advanceTurn(leapState, () => 0.5);
check('跨越至 200 年后，月结管线自动演进天下大势至中原争霸', nextLeapState.trendStage === GeneralTrendStage.HEGEMONY_CONTEST);

console.log('\n=============================================================');
console.log(`[PASS] 全部 ${step} 项天下大势演进与九品中正制门阀政治断言 100% 通过！`);
console.log('=============================================================');
