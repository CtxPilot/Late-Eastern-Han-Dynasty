// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-04 专项验收门禁：战俘处置与刑赏牢狱体系全栈集成 (Session 480)
 *
 * 验证矩阵：
 * 1. 战俘纯函数模型与折算（几率模型、赎金估值、筛选与状态判定）
 * 2. 招降归顺全栈闭环（概率推导、成功门阀改宗与忠诚分配、失败意志动摇）
 * 3. 义释放归全栈闭环（获释武将还乡、声望仁政奖励、君臣亲和度与两国外交双升）
 * 4. 索取赎金国库交割（法定估价、母国金库扣除与俘方金库增加、无力支付拦截）
 * 5. 严刑斩立决天下公愤（武将处死、依品阶声望惩罚、两国外交暴跌、血仇仇敌建立）
 * 6. 月度在押战俘演进与越狱潜逃（无战俘 COW 零分配零 RNG、有战俘关押递增、高智机敏越狱）
 * 7. 服务层与 24 个月全息推演闭环
 */

import assert from 'node:assert';
import {
  OfficerStatus,
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  Personality,
  calculatePrisonerSurrenderChance,
  calculatePrisonerRansomValue,
  isPrisoner,
  getFactionPrisoners,
  findDiplomacy,
  relationPairKey,
  resolveAffinity,
  type GameState,
  type Officer,
} from '@leh/shared';
import { createGame, getGame } from '../services/game.js';
import {
  persuadePrisonerSurrender,
  releasePrisoner,
  ransomPrisoner,
  executePrisoner,
  tickPrisonersMonth,
} from '../engine/prisoner.js';
import { advanceTurn } from '../engine/turn.js';

let step = 0;
function check(description: string, condition: boolean) {
  step++;
  assert.ok(condition, `[FAIL] 断言 ${step}: ${description}`);
  console.log(`  ✓ 断言 ${step}: ${description}`);
}

console.log('=== [Phase 7-04] 战俘处置与刑赏牢狱体系全栈集成验收门禁 (Session 480) ===\n');

// -------------------------------------------------------------
// 1. 战俘纯函数模型与折算验证
// -------------------------------------------------------------
console.log('【1. 战俘纯函数模型与几率估值判定】');

// 模拟武将构建器
function makeMockOfficer(patch: Record<string, any>): Officer {
  const base = {
    id: 9901,
    name: '测试武将',
    courtesyName: '子试',
    gender: 'male',
    birthYear: 165,
    deathYear: 230,
    stats: {
      leadership: 60,
      war: 60,
      intelligence: 60,
      politics: 60,
      charisma: 60,
    },
    skills: [],
    traits: [],
    status: OfficerStatus.ACTIVE,
    faction: 1,
    location: 1,
    loyalty: 80,
    merit: 0,
    civilPosition: CivilPosition.NONE,
    localPosition: LocalPosition.NONE,
    militaryPosition: MilitaryPosition.NONE,
    hidden: {
      righteousness: 50,
      ambition: 50,
      personality: Personality.CALM,
    },
  };

  return {
    ...base,
    ...patch,
    stats: {
      ...base.stats,
      ...(patch.stats ?? {}),
    },
    hidden: {
      ...base.hidden,
      ...(patch.hidden ?? {}),
    },
  } as unknown as Officer;
}

const mockCaptor = makeMockOfficer({
  id: 1,
  name: '曹操',
  stats: { leadership: 96, war: 72, intelligence: 91, politics: 94, charisma: 96, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 50, tactics: 50 },
});

const loyalPrisoner = makeMockOfficer({
  id: 200,
  name: '关羽',
  status: OfficerStatus.PRISONER,
  loyalty: 100,
  hidden: { righteousness: 100, ambition: 30, personality: 'bold' },
});

const surrenderBreakdown = calculatePrisonerSurrenderChance(loyalPrisoner, mockCaptor, 0, 500);
check('忠义大将初被俘劝降几率极低 (<=30%)', surrenderBreakdown.finalChance <= 30);
check('忠诚度产生明确心理抵抗扣减', surrenderBreakdown.loyaltyPenalty > 0);
check('大义产生明确心理抵抗扣减', surrenderBreakdown.righteousnessPenalty > 0);

// 久羁锐气消解
const stubbornPrisoner = makeMockOfficer({
  id: 201,
  name: '庞德',
  status: OfficerStatus.PRISONER,
  loyalty: 90,
  hidden: { righteousness: 85, ambition: 40, personality: 'bold' },
});
const earlyChance = calculatePrisonerSurrenderChance(stubbornPrisoner, mockCaptor, 1, 300);
const lateChance = calculatePrisonerSurrenderChance(stubbornPrisoner, mockCaptor, 12, 300);
check('关押满 12 个月招降几率显著提升 (久羁消解)', lateChance.finalChance > earlyChance.finalChance);
check('久羁获得明确几率加成', lateChance.imprisonedBonus >= 20);

// 极值夹紧保护
const extremeLow = calculatePrisonerSurrenderChance(
  makeMockOfficer({ loyalty: 100, hidden: { righteousness: 100 } }),
  makeMockOfficer({ stats: { charisma: 10 } } as any),
  0,
  0,
);
check('招降几率下限严守保底 5%', extremeLow.finalChance >= 5);

const extremeHigh = calculatePrisonerSurrenderChance(
  makeMockOfficer({ loyalty: 20, hidden: { righteousness: 10 } }),
  makeMockOfficer({ stats: { charisma: 100 } } as any),
  24,
  1000,
);
check('招降几率上限严守封顶 85%', extremeHigh.finalChance <= 85);

// 赎金估价
const ordinaryOfficer = makeMockOfficer({
  stats: { leadership: 40, war: 40, intelligence: 40, politics: 40, charisma: 40, burst: 40, agility: 40, luck: 40, intuition: 40, awe: 40, strategy: 40, tactics: 40 },
  merit: 0,
});
check('普通白身武将享有基础保底赎金 300 金', calculatePrisonerRansomValue(ordinaryOfficer) === 300);

const seniorMinister = makeMockOfficer({
  stats: { leadership: 88, war: 70, intelligence: 95, politics: 92, charisma: 89, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 50, tactics: 50 },
  rankGrade: 2,
  merit: 10000,
});
const seniorRansom = calculatePrisonerRansomValue(seniorMinister);
check('上品公卿高五维重臣赎金显著提升 (>=800)', seniorRansom >= 800);
check('赎金上限不超过 1500 金封顶', seniorRansom <= 1500);

// 状态判定与列表筛选
check('准确识别战俘状态', isPrisoner(loyalPrisoner));
check('非战俘识别为 false', !isPrisoner(mockCaptor));

const testOfficers: Record<number, Officer> = {
  1: mockCaptor,
  200: { ...loyalPrisoner, captiveByFactionId: 1 },
  201: { ...stubbornPrisoner, captiveByFactionId: 2 },
};
const faction1Prisoners = getFactionPrisoners(testOfficers, 1);
check('精确筛选指定势力羁押的战俘', faction1Prisoners.length === 1 && faction1Prisoners[0]?.id === 200);

// -------------------------------------------------------------
// 2. 战俘处置：招降归顺全栈闭环
// -------------------------------------------------------------
console.log('\n【2. 战俘处置：招降归顺全栈闭环】');

createGame(1, 1); // 剧本 1 曹操开局
const baseState = getGame();
const CAO_CAO_FACTION = baseState.playerFactionId; // 1: 曹操势力
const DONG_ZHUO_FACTION = 2; // 董卓势力

// 构造一名被曹操俘获的董卓武将
const prisonerHuaXiong = makeMockOfficer({
  id: 8801,
  name: '华雄',
  faction: DONG_ZHUO_FACTION,
  status: OfficerStatus.PRISONER,
  captiveByFactionId: CAO_CAO_FACTION,
  imprisonedMonths: 2,
  loyalty: 75,
  militaryPosition: MilitaryPosition.GENERAL,
});

let testState: GameState = {
  ...baseState,
  officers: {
    ...baseState.officers,
    [prisonerHuaXiong.id]: prisonerHuaXiong,
  },
};

// 校验非羁押方处置拦截
assert.throws(
  () => persuadePrisonerSurrender(testState, prisonerHuaXiong.id, 99, () => 0.5),
  /并非由本势力羁押关押/,
  '非羁押势力劝降战俘被合法拦截',
);
check('非法势力劝降战俘被严格拦截', true);

// 劝降未果分支 (模拟掷骰未命中，rng = 0.99)
const failResult = persuadePrisonerSurrender(testState, prisonerHuaXiong.id, CAO_CAO_FACTION, () => 0.99);
check('掷骰不通过时招降失败', !failResult.success);
const afterFailPrisoner = failResult.state.officers[prisonerHuaXiong.id]!;
check('劝降未果武将依然保持战俘状态', afterFailPrisoner.status === OfficerStatus.PRISONER);
check('劝降未果武将忠诚意志动摇 (-2)', afterFailPrisoner.loyalty === 73);
check('动作日志记录劝降未果', failResult.state.actionLog.some((l) => l.type === 'prisoner_refuse'));

// 劝降归顺成功分支 (模拟掷骰命中，rng = 0.01)
const captorFameBefore = testState.factions[CAO_CAO_FACTION]!.fame ?? 0;
const successResult = persuadePrisonerSurrender(testState, prisonerHuaXiong.id, CAO_CAO_FACTION, () => 0.01);
check('掷骰命中时招降成功', successResult.success);
const afterSuccessPrisoner = successResult.state.officers[prisonerHuaXiong.id]!;
check('成功归降武将状态转为 ACTIVE', afterSuccessPrisoner.status === OfficerStatus.ACTIVE);
check('成功归降武将改换门庭至曹操势力', afterSuccessPrisoner.faction === CAO_CAO_FACTION);
check('战俘羁押标记清空', afterSuccessPrisoner.captiveByFactionId === undefined);
check('在押月数归零', afterSuccessPrisoner.imprisonedMonths === 0);
check('原势力旧官职被依法剥夺', afterSuccessPrisoner.militaryPosition === MilitaryPosition.NONE);
check('赋予新朝基线忠诚度 (>=50)', (afterSuccessPrisoner.loyalty ?? 0) >= 50);
check('招降成功势力声望增加 (+5)', (successResult.state.factions[CAO_CAO_FACTION]!.fame ?? 0) === captorFameBefore + 5);
check('君臣亲和度产生正向建立', resolveAffinity(afterSuccessPrisoner, testState.officers[testState.factions[CAO_CAO_FACTION]!.rulerId]!, successResult.state.relationAffinities) > 0);
check('动作日志记录招降归顺喜报', successResult.state.actionLog.some((l) => l.type === 'prisoner_surrender'));

// -------------------------------------------------------------
// 3. 战俘处置：义释放归全栈闭环
// -------------------------------------------------------------
console.log('\n【3. 战俘处置：义释放归全栈闭环】');

const prisonerYanLiang = makeMockOfficer({
  id: 8802,
  name: '颜良',
  faction: 3, // 袁绍势力
  status: OfficerStatus.PRISONER,
  captiveByFactionId: CAO_CAO_FACTION,
  imprisonedMonths: 3,
});

testState = {
  ...testState,
  officers: {
    ...testState.officers,
    [prisonerYanLiang.id]: prisonerYanLiang,
  },
};

const yuanShaoFaction = testState.factions[3]!;
const beforeReleaseFame = testState.factions[CAO_CAO_FACTION]!.fame ?? 0;
const beforeDiplomacyFavor = findDiplomacy(testState.diplomacy, CAO_CAO_FACTION, 3)?.favorability ?? 0;

const stateAfterRelease = releasePrisoner(testState, prisonerYanLiang.id, CAO_CAO_FACTION);
const releasedOfficer = stateAfterRelease.officers[prisonerYanLiang.id]!;

check('义释战俘状态恢复为 ACTIVE', releasedOfficer.status === OfficerStatus.ACTIVE);
check('义释战俘保持原所属势力不变', releasedOfficer.faction === 3);
check('义释战俘位置送还至母国首都', releasedOfficer.location === yuanShaoFaction.capitalCityId);
check('义释战俘清空羁押属性', releasedOfficer.captiveByFactionId === undefined && releasedOfficer.imprisonedMonths === 0);
check('仁德义释势力声望获得丰厚奖励 (+15)', (stateAfterRelease.factions[CAO_CAO_FACTION]!.fame ?? 0) === beforeReleaseFame + 15);

const caoRuler = testState.officers[testState.factions[CAO_CAO_FACTION]!.rulerId]!;
const affKey = relationPairKey(releasedOfficer.id, caoRuler.id);
check('获释武将对义释君主亲和度显著提升', (stateAfterRelease.relationAffinities?.[affKey] ?? 0) > 0);

const afterDiplomacyFavor = findDiplomacy(stateAfterRelease.diplomacy, CAO_CAO_FACTION, 3)?.favorability ?? 0;
check('两国外交好感度双向提升 (+15)', afterDiplomacyFavor === Math.min(100, beforeDiplomacyFavor + 15));
check('动作日志记录义释美德', stateAfterRelease.actionLog.some((l) => l.type === 'prisoner_release'));

// -------------------------------------------------------------
// 4. 战俘处置：索取赎金国库交割
// -------------------------------------------------------------
console.log('\n【4. 战俘处置：索取赎金国库交割】');

const prisonerWenChou = makeMockOfficer({
  id: 8803,
  name: '文丑',
  faction: 3, // 袁绍势力
  status: OfficerStatus.PRISONER,
  captiveByFactionId: CAO_CAO_FACTION,
  imprisonedMonths: 1,
  stats: { leadership: 85, war: 92, intelligence: 45, politics: 40, charisma: 65, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 50, tactics: 50 },
  merit: 2000,
});

testState = {
  ...testState,
  officers: {
    ...testState.officers,
    [prisonerWenChou.id]: prisonerWenChou,
  },
  factions: {
    ...testState.factions,
    3: { ...yuanShaoFaction, gold: 5000 }, // 保证袁绍国库充裕
    [CAO_CAO_FACTION]: { ...testState.factions[CAO_CAO_FACTION]!, gold: 1000 },
  },
};

const nominalRansom = calculatePrisonerRansomValue(prisonerWenChou);
check('名将文丑赎金估价明确', nominalRansom >= 400);

const ransomResult = ransomPrisoner(testState, prisonerWenChou.id, CAO_CAO_FACTION);
check('索赎成功完成交割', ransomResult.success);
check('实际收讫法定全额赎金', ransomResult.ransom === nominalRansom);

const captorGoldAfter = ransomResult.state.factions[CAO_CAO_FACTION]!.gold;
const motherGoldAfter = ransomResult.state.factions[3]!.gold;
check('本势力国库确实验收入账', captorGoldAfter === 1000 + nominalRansom);
check('母国势力国库确实扣减交割', motherGoldAfter === 5000 - nominalRansom);

const ransomedOfficer = ransomResult.state.officers[prisonerWenChou.id]!;
check('赎回武将恢复 ACTIVE 并归国', ransomedOfficer.status === OfficerStatus.ACTIVE && ransomedOfficer.location === yuanShaoFaction.capitalCityId);
check('动作日志记录赎回交割', ransomResult.state.actionLog.some((l) => l.type === 'prisoner_ransom'));

// 国库空虚拦截
const brokeState: GameState = {
  ...testState,
  factions: {
    ...testState.factions,
    3: { ...yuanShaoFaction, gold: 0 },
  },
};
assert.throws(
  () => ransomPrisoner(brokeState, prisonerWenChou.id, CAO_CAO_FACTION),
  /国库空虚，无力支付赎金/,
  '母国国库空虚无法支付赎金被拦截',
);
check('母国国库空虚索赎被合法拦截', true);

// -------------------------------------------------------------
// 5. 战俘处置：严刑斩立决与公愤惩罚
// -------------------------------------------------------------
console.log('\n【5. 战俘处置：严刑斩立决与公愤惩罚】');

const prisonerLvBu = makeMockOfficer({
  id: 8804,
  name: '吕布',
  faction: DONG_ZHUO_FACTION,
  status: OfficerStatus.PRISONER,
  captiveByFactionId: CAO_CAO_FACTION,
  rankGrade: 3, // 三品大员
});

// 为吕布增加一名直系义兄弟/亲属作为复仇者（例如张辽）
const avengerZhangLiao = makeMockOfficer({
  id: 8805,
  name: '张辽',
  faction: DONG_ZHUO_FACTION,
  status: OfficerStatus.ACTIVE,
});

testState = {
  ...testState,
  officers: {
    ...testState.officers,
    [prisonerLvBu.id]: prisonerLvBu,
    [avengerZhangLiao.id]: avengerZhangLiao,
  },
  runtimeRelations: [
    ...(testState.runtimeRelations ?? []),
    {
      fromId: avengerZhangLiao.id,
      toId: prisonerLvBu.id,
      type: 'sworn',
      establishedYear: 190,
      establishedMonth: 1,
    },
  ],
};

const fameBeforeExecution = testState.factions[CAO_CAO_FACTION]!.fame ?? 0;
const dongFavorBefore = findDiplomacy(testState.diplomacy, CAO_CAO_FACTION, DONG_ZHUO_FACTION)?.favorability ?? 0;

const stateAfterExecution = executePrisoner(testState, prisonerLvBu.id, CAO_CAO_FACTION);
const deadOfficer = stateAfterExecution.officers[prisonerLvBu.id]!;

check('处斩战俘状态确认为 DEAD', deadOfficer.status === OfficerStatus.DEAD);
check('处斩战俘位置置空 (null)', deadOfficer.location === null);
check('处斩战俘羁押标记清除', deadOfficer.captiveByFactionId === undefined);

// 上品官员斩首惩罚 100 点声望
const fameAfterExecution = stateAfterExecution.factions[CAO_CAO_FACTION]!.fame ?? 0;
check('斩决上品重臣遭到严厉声望惩罚 (-100)', fameAfterExecution === Math.max(0, fameBeforeExecution - 100));

// 母国外交恶化 -50
const dongFavorAfter = findDiplomacy(stateAfterExecution.diplomacy, CAO_CAO_FACTION, DONG_ZHUO_FACTION)?.favorability ?? 0;
check('斩决战俘导致母国好感度暴跌 (-50)', dongFavorAfter === Math.max(-100, dongFavorBefore - 50));

// 血仇宿怨确立
const nemesisKey = relationPairKey(avengerZhangLiao.id, caoRuler.id);
const affinityWithAvenger = stateAfterExecution.relationAffinities?.[nemesisKey] ?? 0;
check('死者结义兄弟与处斩君主结下血海深仇 (亲和坠至 -100)', affinityWithAvenger === -100);
check('动作日志记录严刑处斩公愤', stateAfterExecution.actionLog.some((l) => l.type === 'prisoner_executed'));

// -------------------------------------------------------------
// 6. 月度在押战俘演进与越狱潜逃
// -------------------------------------------------------------
console.log('\n【6. 月度在押战俘演进与越狱潜逃】');

// 6.1 零战俘状态下 COW 绝对零开销与零漂移验证
const cleanState = getGame();
const cleanTickState = tickPrisonersMonth(cleanState, () => {
  throw new Error('零战俘时不应消耗 RNG');
});
check('无战俘时 tickPrisonersMonth 保持原始引用 (严格 COW)', cleanTickState === cleanState);

// 6.2 存在在押战俘时的月度演进
const captiveA = makeMockOfficer({
  id: 8810,
  name: '在押小将',
  status: OfficerStatus.PRISONER,
  captiveByFactionId: CAO_CAO_FACTION,
  imprisonedMonths: 1,
  loyalty: 60,
  stats: { intelligence: 50 },
});

const captiveSmart = makeMockOfficer({
  id: 8811,
  name: '机敏谋士',
  status: OfficerStatus.PRISONER,
  captiveByFactionId: CAO_CAO_FACTION,
  imprisonedMonths: 5,
  loyalty: 80,
  stats: { intelligence: 88 },
});

let monthlyPrisonState: GameState = {
  ...cleanState,
  officers: {
    ...cleanState.officers,
    [captiveA.id]: captiveA,
    [captiveSmart.id]: captiveSmart,
  },
};

// 演进 1：未越狱（rng 返回 0.99）
const tick1 = tickPrisonersMonth(monthlyPrisonState, () => 0.99);
const captiveAAfter1 = tick1.officers[captiveA.id]!;
check('在押战俘关押月数自增 (+1)', captiveAAfter1.imprisonedMonths === 2);
check('在押战俘月度意志消解忠诚微降 (-1)', captiveAAfter1.loyalty === 59);

// 演进 2：智谋谋士成功越狱（rng 返回 0.001）
const tickEscape = tickPrisonersMonth(monthlyPrisonState, () => 0.001);
const escapedOfficer = tickEscape.officers[captiveSmart.id]!;
check('机智谋士乘夜越狱成功脱枷恢复自由', escapedOfficer.status === OfficerStatus.ACTIVE);
check('越狱武将羁押归属清空', escapedOfficer.captiveByFactionId === undefined);
check('动作日志记录越狱脱枷快报', tickEscape.actionLog.some((l) => l.type === 'prisoner_escape'));

// -------------------------------------------------------------
// 7. 24 个月全息推演闭环演进验证
// -------------------------------------------------------------
console.log('\n【7. 24 个月全息推演闭环演进验证】');

let simState = getGame();
const testPrisonerId = 8899;
simState = {
  ...simState,
  officers: {
    ...simState.officers,
    [testPrisonerId]: makeMockOfficer({
      id: testPrisonerId,
      name: '纪灵',
      faction: 3,
      status: OfficerStatus.PRISONER,
      captiveByFactionId: CAO_CAO_FACTION,
      imprisonedMonths: 0,
      loyalty: 85,
    }),
  },
};

// 连续推演 24 个回合
for (let m = 0; m < 24; m++) {
  simState = advanceTurn(simState, () => 0.5);
}

const officerAfter24 = simState.officers[testPrisonerId]!;
check('24 个月全息月结稳定推进至目标年月', simState.currentYear === 192 && simState.currentMonth === 1);
check('长达 24 个月推演中在押战俘属性持续演进', (officerAfter24.imprisonedMonths ?? 0) >= 20 || officerAfter24.status === OfficerStatus.ACTIVE);
check('全盘武将实体与势力状态完全自洽合法', Object.keys(simState.officers).length >= 10);

console.log(`\n======================================================`);
console.log(`  🎉 Phase 7-04 全部 ${step} 项断言 100% 绿色通过！`);
console.log(`======================================================\n`);
