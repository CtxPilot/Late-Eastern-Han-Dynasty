// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import assert from 'node:assert/strict';
import {
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  Season,
  TerrainType,
  calculateCityTaxRevenue,
  calculateFactionSalaries,
  getFactionCoinQuality,
  getOfficerAnnualSalary,
  getSalaryArrearsLoyaltyPenalty,
  maskGameStateForPlayer,
  FactionRuntimeSchema,
  CityRuntimeSchema,
  type City,
  type Faction,
  type GameState,
  type Officer,
} from '@leh/shared';
import {
  setCityTaxPolicy,
  appeaseMagnates,
  inspectCensus,
  reformCoinage,
  debaseCoinage,
  settleAnnualSalaries,
  settleSalaryArrearsQuarterly,
  applyQuarterlyTaxMorale,
} from '../engine/fiscal.js';
import { advanceTurn } from '../engine/turn.js';
import { createGame, getGame } from '../services/game.js';

let passed = 0;
function check(label: string, cond: unknown): asserts cond {
  assert.ok(cond, `FAIL: ${label}`);
  passed += 1;
  console.log(`  ✓ 断言 ${passed}: ${label}`);
}

console.log('=== D-0B-9 §35 财政税收俸禄系统全栈集成与验收 ===\n');

// ── 1. D-0B-9a: 数据模型与 Schema 契约 ──
console.log('【1. 数据模型与 Schema 契约】');

const testFaction: Faction = {
  id: 1,
  name: '曹操军',
  color: '#4a6fa5',
  rulerId: 1,
  capitalCityId: 1,
  gold: 5000,
  food: 8000,
  courtNetwork: 0,
  cityIds: [1],
  officerIds: [1],
  isPlayer: true,
  isAlive: true,
  coinQuality: 1.0,
  salaryArrears: 0,
};
const parsedFaction = FactionRuntimeSchema.parse(testFaction);
check('FactionRuntimeSchema 支持 coinQuality 与 salaryArrears 字段严格校验', parsedFaction.coinQuality === 1.0 && parsedFaction.salaryArrears === 0);

const testCity: City = {
  id: 1,
  name: '许昌',
  province: '豫州',
  x: 10,
  y: 10,
  maxPopulation: 50000,
  isCapital: true,
  isPass: false,
  specialProduct: null,
  recruitableUnits: [],
  initialStats: { farm: 100, commerce: 100, wall: 100 },
  terrain: TerrainType.PLAIN,
  stats: { farm: 100, commerce: 100, wall: 100, morale: 70 },
  gold: 1000,
  food: 1000,
  population: 10000,
  demographics: { adultMale: 3000, adultFemale: 3000, child: 2000, elder: 2000 },
  courtNetworkOpportunities: 0,
  troops: 5000,
  troopsMorale: 70,
  officers: [1],
  ruler: 1,
  facilities: [],
  policy: null,
  developmentProgress: { farm: 0, commerce: 0, wall: 0 },
  taxPolicy: 'standard',
  taxRate: 0.30,
  appeasedMagnate: false,
};
const parsedCity = CityRuntimeSchema.parse(testCity);
check('CityRuntimeSchema 支持 taxPolicy, taxRate, appeasedMagnate 字段严格校验', parsedCity.taxPolicy === 'standard' && parsedCity.taxRate === 0.30 && parsedCity.appeasedMagnate === false);

// 视野脱敏检验
createGame(1, 1);
const rawState = getGame();
const masked = maskGameStateForPlayer(rawState);
const playerFac = masked.factions[masked.playerFactionId];
const enemyFac = Object.values(masked.factions).find((f) => f.id !== masked.playerFactionId && f.isAlive);
check('己方势力保留内部财政指标', playerFac?.coinQuality != null);
check('敌方势力脱敏 salaryArrears 设为 0', enemyFac?.salaryArrears === 0);

// ── 2. D-0B-9b: 货币成色与购买力折算 ──
console.log('\n【2. 货币成色机制与购买力折算】');

check('曹魏势力默认货币成色为 1.00（五铢钱）', getFactionCoinQuality({ id: 1, name: '曹操军', rulerId: 1, kingdomName: '魏' }) === 1.00);
check('蜀汉势力默认货币成色为 0.70（直百五铢）', getFactionCoinQuality({ id: 2, name: '刘备军', rulerId: 2, kingdomName: '汉中' }) === 0.70);
check('东吴势力默认货币成色为 0.50（大泉当千）', getFactionCoinQuality({ id: 3, name: '孙权军', rulerId: 3, kingdomName: '吴' }) === 0.50);
check('群雄势力默认货币成色为 1.00（杂用旧钱）', getFactionCoinQuality({ id: 4, name: '袁绍军', rulerId: 4 }) === 1.00);

let state = getGame();
const pFid = state.playerFactionId;
const facBefore = state.factions[pFid]!;
const goldBefore = facBefore.gold;
const reformed = reformCoinage({
  ...state,
  factions: { ...state.factions, [pFid]: { ...facBefore, coinQuality: 0.70 } },
}, pFid);
check('铸币改革提升成色 +0.10 并扣除 300 金', reformed.factions[pFid]!.coinQuality === 0.80 && reformed.factions[pFid]!.gold === goldBefore - 300);

const debased = debaseCoinage({
  ...state,
  factions: { ...state.factions, [pFid]: { ...facBefore, coinQuality: 0.80 } },
}, pFid);
check('滥发虚值大钱成色 -0.10 并立即获 300 金应急', debased.factions[pFid]!.coinQuality === 0.70 && debased.factions[pFid]!.gold === goldBefore + 300);

// 成色折扣折算对比
const weiTax = calculateCityTaxRevenue({ city: testCity, season: Season.SPRING, coinQuality: 1.0 });
const shuTax = calculateCityTaxRevenue({ city: testCity, season: Season.SPRING, coinQuality: 0.70 });
const wuTax = calculateCityTaxRevenue({ city: testCity, season: Season.SPRING, coinQuality: 0.50 });
check('魏蜀吴三国货币成色实际金库入账严格符合成色比例（蜀 70%、吴 50%）', shuTax.treasuryGold === Math.floor(weiTax.treasuryGold * 0.70) && wuTax.treasuryGold === Math.floor(weiTax.treasuryGold * 0.50));

// ── 3. D-0B-9c: 四档税收政策与豪强隐匿 ──
console.log('\n【3. 四档税收政策与豪强隐匿】');

const lightCity = setCityTaxPolicy(state, testCity.id, 'light');
check('调整税收政策指令正确将城市置为轻徭薄赋（20%）', lightCity.cities[testCity.id]!.taxPolicy === 'light' && lightCity.cities[testCity.id]!.taxRate === 0.20);

const customCity = setCityTaxPolicy(state, testCity.id, 'martial', 0.65);
check('战时征敛支持自定义税率且受夹紧控制', customCity.cities[testCity.id]!.taxPolicy === 'martial' && customCity.cities[testCity.id]!.taxRate === 0.65);

// 季首税赋民心变动
const quarterlyMoraleState = applyQuarterlyTaxMorale({
  ...state,
  cities: {
    ...state.cities,
    1: { ...state.cities[1]!, taxPolicy: 'light', stats: { ...state.cities[1]!.stats, morale: 70 } },
    2: { ...state.cities[2]!, taxPolicy: 'heavy', stats: { ...state.cities[2]!.stats, morale: 70 } },
    3: { ...state.cities[3]!, taxPolicy: 'martial', stats: { ...state.cities[3]!.stats, morale: 70 } },
    4: { ...state.cities[4]!, taxPolicy: 'standard', stats: { ...state.cities[4]!.stats, morale: 70 } },
  },
});
check('轻徭薄赋季首民心 +3', quarterlyMoraleState.cities[1]!.stats.morale === 73);
check('重税严敛季首民心 -5', quarterlyMoraleState.cities[2]!.stats.morale === 65);
check('战时征敛季首民心 -10', quarterlyMoraleState.cities[3]!.stats.morale === 60);
check('标准税赋季首民心不增不减', quarterlyMoraleState.cities[4]!.stats.morale === 70);

// 豪强隐匿机制
const magnateOfficer: Officer = {
  id: 888,
  name: '豪强测试将',
  tags: ['豪族'],
  faction: pFid,
  location: testCity.id,
} as any;

const taxWithUnappeased = calculateCityTaxRevenue({
  city: { ...testCity, appeasedMagnate: false },
  season: Season.SPRING,
  coinQuality: 1.0,
  officersInCity: [magnateOfficer],
});
const taxStandardNoMagnate = calculateCityTaxRevenue({
  city: testCity,
  season: Season.SPRING,
  coinQuality: 1.0,
  officersInCity: [],
});
check('城中有豪强且未安抚时税收严格扣减 15%', taxWithUnappeased.actualTax === Math.floor(taxStandardNoMagnate.actualTax * 0.85));

// 检籍清田
const stateWithMagnate: GameState = {
  ...state,
  cities: {
    ...state.cities,
    [testCity.id]: {
      ...state.cities[testCity.id]!,
      ruler: pFid,
      gold: 1000,
      officers: [magnateOfficer.id],
      appeasedMagnate: false,
    },
  },
  officers: {
    ...state.officers,
    [magnateOfficer.id]: { ...magnateOfficer, loyalty: 80 },
  },
};
const inspected = inspectCensus(stateWithMagnate, testCity.id);
check('检籍清田扣除 200 金并将豪强安抚状态置 true', inspected.cities[testCity.id]!.appeasedMagnate === true && inspected.cities[testCity.id]!.gold === 800);
check('检籍清田后城内豪族武将忠诚严格扣减 15 点', inspected.officers[magnateOfficer.id]!.loyalty === 65);

// 安抚豪强
const appeasedState = appeaseMagnates(stateWithMagnate, testCity.id);
check('安抚豪强扣除 300 金豁免隐匿且武将忠诚不损', appeasedState.cities[testCity.id]!.appeasedMagnate === true && appeasedState.cities[testCity.id]!.gold === 700 && appeasedState.officers[magnateOfficer.id]!.loyalty === 80);

// ── 4. D-0B-9d: 百官年俸发放体系与欠俸惩罚链 ──
console.log('\n【4. 百官年俸发放体系与欠俸惩罚链】');

check('官位年俸对照表：丞相 800', getOfficerAnnualSalary({ id: 1, civilPosition: CivilPosition.CHANCELLOR, militaryPosition: MilitaryPosition.NONE, localPosition: LocalPosition.NONE }, false) === 800);
check('官位年俸对照表：都督/大将军 500', getOfficerAnnualSalary({ id: 2, civilPosition: CivilPosition.NONE, militaryPosition: MilitaryPosition.GRAND_GENERAL, localPosition: LocalPosition.NONE }, false) === 500);
check('官位年俸对照表：太守/将军 180', getOfficerAnnualSalary({ id: 3, civilPosition: CivilPosition.PREFECT, militaryPosition: MilitaryPosition.GENERAL, localPosition: LocalPosition.NONE }, false) === 180);
check('官位年俸对照表：县令/校尉 60', getOfficerAnnualSalary({ id: 4, civilPosition: CivilPosition.MAGISTRATE, militaryPosition: MilitaryPosition.NONE, localPosition: LocalPosition.NONE }, false) === 60);
check('官位年俸对照表：书吏/军候 20', getOfficerAnnualSalary({ id: 5, civilPosition: CivilPosition.NONE, militaryPosition: MilitaryPosition.CAPTAIN, localPosition: LocalPosition.NONE }, false) === 20);
check('君主俸禄严格为 0', getOfficerAnnualSalary({ id: 1, civilPosition: CivilPosition.CHANCELLOR, militaryPosition: MilitaryPosition.GRAND_GENERAL, localPosition: LocalPosition.NONE }, true) === 0);

// 年俸统发（富裕状态）
const richState: GameState = {
  ...state,
  cities: {
    ...state.cities,
    [facBefore.capitalCityId]: { ...state.cities[facBefore.capitalCityId]!, ruler: pFid, gold: 10000 },
  },
  officers: {
    ...state.officers,
    [facBefore.rulerId]: { ...state.officers[facBefore.rulerId]!, faction: pFid, civilPosition: CivilPosition.CHANCELLOR },
    201: { id: 201, name: '大将军测试将', faction: pFid, civilPosition: CivilPosition.NONE, militaryPosition: MilitaryPosition.GRAND_GENERAL, localPosition: LocalPosition.NONE, loyalty: 90 } as any,
    202: { id: 202, name: '太守测试将', faction: pFid, civilPosition: CivilPosition.PREFECT, militaryPosition: MilitaryPosition.NONE, localPosition: LocalPosition.NONE, loyalty: 90 } as any,
  },
};
const expectedSalary = calculateFactionSalaries(Object.values(richState.officers), richState.factions[pFid]!).totalSalary;
const paidSalaries = settleAnnualSalaries(richState);
check(`国库充足时岁首足额统发年俸（共扣除 ${expectedSalary} 金）`, paidSalaries.cities[facBefore.capitalCityId]!.gold === 10000 - expectedSalary);
check('足额统发后 salaryArrears 保持为 0', paidSalaries.factions[pFid]!.salaryArrears === 0);

// 年俸统发（国库赤字状态）
const brokeCities = { ...richState.cities };
for (const cid of Object.keys(brokeCities).map(Number)) {
  if (brokeCities[cid]?.ruler === pFid) {
    brokeCities[cid] = { ...brokeCities[cid]!, gold: 0 };
  }
}
brokeCities[facBefore.capitalCityId] = { ...brokeCities[facBefore.capitalCityId]!, gold: 100 };

const brokeState: GameState = {
  ...richState,
  cities: brokeCities,
};
const brokeSalaries = settleAnnualSalaries(brokeState);
check('国库不足时扣除全部现有资金', brokeSalaries.cities[facBefore.capitalCityId]!.gold === 0);
check('国库不足时累计欠俸加 1 季（salaryArrears = 1）', brokeSalaries.factions[pFid]!.salaryArrears === 1);

// 季首欠俸忠诚惩罚链
check('欠俸 1 季忠诚惩罚梯度为 -2', getSalaryArrearsLoyaltyPenalty(1) === 2);
check('欠俸 2 季忠诚惩罚梯度为 -5', getSalaryArrearsLoyaltyPenalty(2) === 5);
check('欠俸 3 季及以上忠诚惩罚梯度为 -10', getSalaryArrearsLoyaltyPenalty(3) === 10);

const penalized1 = settleSalaryArrearsQuarterly(brokeSalaries);
check('季首检定：欠俸 1 季武将忠诚扣减 2 点', penalized1.officers[201]!.loyalty === 88 && penalized1.officers[202]!.loyalty === 88);
check('君主忠诚不受欠俸惩罚扣减', penalized1.officers[facBefore.rulerId]!.loyalty === state.officers[facBefore.rulerId]!.loyalty);

const arrears3State: GameState = {
  ...brokeSalaries,
  factions: {
    ...brokeSalaries.factions,
    [pFid]: { ...brokeSalaries.factions[pFid]!, salaryArrears: 3 },
  },
};
const penalized3 = settleSalaryArrearsQuarterly(arrears3State);
check('季首检定：欠俸 3 季武将忠诚严格扣减 10 点', penalized3.officers[201]!.loyalty === 80 && penalized3.officers[202]!.loyalty === 80);

// ── 5. D-0B-9e: 确定性、零 RNG 漂移与全仓月结闭环 ──
console.log('\n【5. 确定性、零 RNG 漂移与全仓月结闭环】');

createGame(1, 2);
const startState = getGame();
let simA = startState;
let simB = startState;

for (let i = 0; i < 12; i++) {
  simA = advanceTurn(simA, () => 0.42);
  simB = advanceTurn(simB, () => 0.42);
}

check('12 个月推演完成（历经岁首年俸发放与四季税收变动）', simA.currentYear === startState.currentYear + 1);
check('双局推演 12 个月金库完全逐字节一致（零 RNG 漂移）', simA.factions[simA.playerFactionId]!.gold === simB.factions[simB.playerFactionId]!.gold);
check('双局推演 12 个月城池金钱与民心完全逐字节一致', JSON.stringify(simA.cities) === JSON.stringify(simB.cities));

console.log(`\n========================================`);
console.log(`D-0B-9 财政税收俸禄系统 40 项断言全部通过 (${passed}/${passed})`);
console.log(`========================================\n`);
