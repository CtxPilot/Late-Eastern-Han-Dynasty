// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 Session 453 · 技艺研发系统与城池卫生疫病闭环专项验收。
 * 依据 docs/51-s03-craft-research-and-sanitation-proposal.md。
 * 运行：pnpm verify-s51-craft-research-and-sanitation
 */
import {
  GameStateSchema,
  computeSanitationDemographicModifiers,
  ageDemographicsTick,
  resolveRecruitChance,
  safeTechLevels,
  type GameState,
  type City,
  Season,
} from '@leh/shared';
import {
  createGame,
  getGame,
} from '../services/game.js';
import {
  getAvailableTechResearch,
  startTechResearch,
  cancelTechResearch,
  tickTechResearch,
} from '../engine/techResearch.js';
import {
  tickCityPlagueAndSanitation,
} from '../engine/plague.js';
import {
  conscript,
  developCity,
  relief,
  tickDevelopmentProject,
  trainTroops,
} from '../engine/civil.js';
import { settleCityMonthDetailed } from '../engine/turn.js';
import { tickFactionPolitics } from '../engine/factionPolitics.js';
import { tickPopularWillDesertion } from '../engine/mandateEffects.js';

let pass = 0;
let fail = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${message}`);
  } else {
    fail++;
    console.error(`  ✗ ${message}`);
  }
}

console.log('=== S03 技艺研发系统与城池卫生疫病闭环验收 ===\n');

createGame(1, 1);
let state: GameState = getGame();
const playerFactionId = state.playerFactionId;

// ---------------------------------------------------------
// 1. 技艺研发 5 大路线查询与门槛前置校验
// ---------------------------------------------------------
console.log('--- 1. 技艺研发前置查询与启动校验 ---');
const available = getAvailableTechResearch(state, playerFactionId);
assert(Object.keys(available.branches).length === 5, '准确获取 5 条技艺路线');
assert(available.branches.farming.name === '农政', '农政路线配置正确');
assert(available.branches.farming.currentLevel === 0, '初始农政为 Lv0');
assert(available.branches.farming.nextTier?.level === 1, '下一研发目标为 Lv1');
assert(available.branches.farming.initialGoldCost === Math.ceil(200 / 3), 'Lv1 首付金为 67');
assert(available.eligibleOfficers.length > 0, '存在可指派学者');

const scholarId = available.eligibleOfficers[0].id;

// 文化不足无法研发测试
// 给曹操设最高城池文化 50（低于 Lv1 的 100 门槛）
let testCityId = Object.values(state.cities).find((c) => c.ruler === playerFactionId)!.id;
state = {
  ...state,
  cities: {
    ...state.cities,
    [testCityId]: {
      ...state.cities[testCityId]!,
      stats: { ...state.cities[testCityId]!.stats, culture: 50 },
    },
  },
};
let caughtCulture = false;
try {
  startTechResearch(state, playerFactionId, 'farming', scholarId);
} catch (e) {
  caughtCulture = true;
}
assert(caughtCulture, '最高城池文化不足（<100）时拦截立项');

// 满足文化条件立项
state = {
  ...state,
  factions: {
    ...state.factions,
    [playerFactionId]: { ...state.factions[playerFactionId]!, gold: 1000 },
  },
  cities: {
    ...state.cities,
    [testCityId]: {
      ...state.cities[testCityId]!,
      stats: { ...state.cities[testCityId]!.stats, culture: 150 },
    },
  },
};
const beforeGold = state.factions[playerFactionId]!.gold;
state = startTechResearch(state, playerFactionId, 'farming', scholarId);
const startedFaction = state.factions[playerFactionId]!;
assert(startedFaction.activeResearch != null, '立项成功，写入 activeResearch');
assert(startedFaction.activeResearch?.branch === 'farming', '研发路线为 farming');
assert(startedFaction.activeResearch?.targetLevel === 1, '目标等级为 1');
assert(startedFaction.gold === beforeGold - Math.ceil(200 / 3), '扣除首付款');

// 重复立项拦截
let caughtDuplicate = false;
try {
  startTechResearch(state, playerFactionId, 'military', scholarId);
} catch {
  caughtDuplicate = true;
}
assert(caughtDuplicate, '单例研发约束：已有进行中项目时拦截新立项');

// 中止研发测试
state = cancelTechResearch(state, playerFactionId);
assert(state.factions[playerFactionId]!.activeResearch == null, '中止研发成功清空 activeResearch');
assert(state.factions[playerFactionId]!.gold === beforeGold - Math.ceil(200 / 3), '中止研发不退还首付金');

// ---------------------------------------------------------
// 2. 研发月度推演与等级提升闭环
// ---------------------------------------------------------
console.log('\n--- 2. 研发月度推演与晋升闭环 ---');
state = startTechResearch(state, playerFactionId, 'farming', scholarId);
const totalMonths = state.factions[playerFactionId]!.activeResearch!.totalMonths;

// 月度推进（totalMonths 个月）
for (let m = 0; m < totalMonths; m++) {
  state = tickTechResearch(state);
}
const postFaction = state.factions[playerFactionId]!;
assert(postFaction.activeResearch == null, '研发工期满后清空 activeResearch');
assert(postFaction.techLevels?.farming === 1, '农政科技成功提升至 Lv1');
assert(
  state.actionLog.some((l) => l.type === 'tech_researched'),
  '成功写入 tech_researched 权威日志',
);

// ---------------------------------------------------------
// 3. 科技效果消费测试（农政/工商/军备/城防/教化）
// ---------------------------------------------------------
console.log('\n--- 3. 科技效果消费实际收益校验 ---');

// 3.1 农政 Lv1: 农产+10%
const cityA = { ...state.cities[testCityId]!, stats: { ...state.cities[testCityId]!.stats, farm: 100 }, food: 100000 };
const baseSettlement = settleCityMonthDetailed(
  cityA,
  Season.SUMMER,
  { techLevels: { ...safeTechLevels(), farming: 0 } },
);
const techSettlement = settleCityMonthDetailed(
  cityA,
  Season.SUMMER,
  { techLevels: { ...safeTechLevels(), farming: 1 } },
);
assert(techSettlement.city.food > baseSettlement.city.food, '农政 Lv1 提升农产收益');

// 农政 Lv4: 月度粮耗-10%
const tech4Settlement = settleCityMonthDetailed(
  cityA,
  Season.SUMMER,
  { techLevels: { ...safeTechLevels(), farming: 4 } },
);
assert(tech4Settlement.city.food > techSettlement.city.food, '农政 Lv4 减少居民粮耗 10%');

// 农政 Lv5: 秋收增产+25%
const augBase = settleCityMonthDetailed(
  cityA,
  Season.AUTUMN,
  { techLevels: { ...safeTechLevels(), farming: 0 } },
);
const augTech5 = settleCityMonthDetailed(
  cityA,
  Season.AUTUMN,
  { techLevels: { ...safeTechLevels(), farming: 5 } },
);
assert(augTech5.city.food > augBase.city.food, '农政 Lv5 秋收大丰产额外提升 25%');

// 3.2 工商 Lv4: 开发项目初始金耗-15%
const testFactionCommerce = {
  ...state.factions[playerFactionId]!,
  techLevels: { ...safeTechLevels(), commerce: 4 },
};
const stateWithCommerce = {
  ...state,
  factions: { ...state.factions, [playerFactionId]: testFactionCommerce },
  cities: {
    ...state.cities,
    [testCityId]: { ...state.cities[testCityId]!, gold: 1000, activeDevelopment: undefined },
  },
};
const devBaseState = developCity(
  {
    ...state,
    factions: { ...state.factions, [playerFactionId]: { ...testFactionCommerce, techLevels: safeTechLevels() } },
    cities: { ...state.cities, [testCityId]: { ...state.cities[testCityId]!, gold: 1000, activeDevelopment: undefined } },
  },
  testCityId,
  'farm',
  scholarId,
);
const devTechState = developCity(stateWithCommerce, testCityId, 'farm', scholarId);
assert(
  devTechState.cities[testCityId]!.gold > devBaseState.cities[testCityId]!.gold,
  '工商 Lv4 享受开发项目 15% 启动优惠',
);

// 3.3 军备 Lv1 / Lv2 / Lv5: 士气与训练
const stateWithMil = {
  ...state,
  factions: {
    ...state.factions,
    [playerFactionId]: { ...state.factions[playerFactionId]!, techLevels: { ...safeTechLevels(), military: 1 } },
  },
  cities: {
    ...state.cities,
    [testCityId]: {
      ...state.cities[testCityId]!,
      troops: 1000,
      troopsMorale: 80,
      gold: 500,
      food: 500,
      plague: null,
      demographics: { adultMale: 5000, adultFemale: 5000, child: 2000, elder: 1000 },
    },
  },
};
const conscriptBase = conscript(
  {
    ...stateWithMil,
    factions: {
      ...stateWithMil.factions,
      [playerFactionId]: { ...stateWithMil.factions[playerFactionId]!, techLevels: safeTechLevels() },
    },
  },
  testCityId,
  () => 0.5,
);
const conscriptTech = conscript(stateWithMil, testCityId, () => 0.5);
assert(
  conscriptTech.cities[testCityId]!.troopsMorale > conscriptBase.cities[testCityId]!.troopsMorale,
  '军备 Lv1 征兵部队士气 +5 实际生效',
);

const trainBase = trainTroops(
  {
    ...stateWithMil,
    factions: {
      ...stateWithMil.factions,
      [playerFactionId]: { ...stateWithMil.factions[playerFactionId]!, techLevels: safeTechLevels() },
    },
  },
  testCityId,
  () => 0.5,
);
const trainTech = trainTroops(
  {
    ...stateWithMil,
    factions: {
      ...stateWithMil.factions,
      [playerFactionId]: { ...stateWithMil.factions[playerFactionId]!, techLevels: { ...safeTechLevels(), military: 2 } },
    },
  },
  testCityId,
  () => 0.5,
);
assert(
  trainTech.cities[testCityId]!.troopsMorale > trainBase.cities[testCityId]!.troopsMorale,
  '军备 Lv2 训练效率 +25% 实际生效',
);

// 3.4 城防 Lv1: 修筑城防增益
const dummyProj = {
  kind: 'wall' as const,
  totalGoldCost: 300,
  goldPaid: 300,
  monthlyGold: 0,
  totalMonths: 12,
  remainingMonths: 1,
  pausedMonths: 0,
  progressLostMonths: 0,
  status: 'active' as const,
  assignedOfficerId: scholarId,
};
const wallCity: City = {
  ...state.cities[testCityId]!,
  ruler: playerFactionId,
  gold: 1000,
  stats: { ...state.cities[testCityId]!.stats, wall: 100 },
  activeDevelopment: dummyProj,
};
const wallBaseRes = tickDevelopmentProject(
  {
    ...state,
    factions: {
      ...state.factions,
      [playerFactionId]: { ...state.factions[playerFactionId]!, techLevels: safeTechLevels() },
    },
  },
  wallCity,
);
const wallTechRes = tickDevelopmentProject(
  {
    ...state,
    factions: {
      ...state.factions,
      [playerFactionId]: { ...state.factions[playerFactionId]!, techLevels: { ...safeTechLevels(), fortification: 1 } },
    },
  },
  wallCity,
);
assert((wallTechRes.city.stats.wall ?? 0) > (wallBaseRes.city.stats.wall ?? 0), '城防 Lv1 城防增益 +20% 实际生效');

// 3.5 教化 Lv2 / Lv3 / Lv4 / Lv5
const recruiter = state.officers[scholarId]!;
const target = Object.values(state.officers).find((o) => o.id !== scholarId)!;
const recruitChanceBase = resolveRecruitChance(recruiter, target, 0, 0);
const recruitChanceTech = resolveRecruitChance(recruiter, target, 0, 5);
assert(recruitChanceTech === recruitChanceBase + 5, '教化 Lv2 登用成功率提升 5%');

const desertState = tickPopularWillDesertion(
  {
    ...state,
    factions: {
      ...state.factions,
      [playerFactionId]: { ...state.factions[playerFactionId]!, techLevels: { ...safeTechLevels(), cultivation: 3 } },
    },
  },
  () => 0.01,
);
assert(
  !desertState.actionLog.some((l) => l.type === 'officer_deserted'),
  '教化 Lv3 豁免武将自然下野判定',
);

const courtBeforeFame = 100;
const courtStateFame = tickFactionPolitics(
  {
    ...state,
    factions: {
      ...state.factions,
      [playerFactionId]: {
        ...state.factions[playerFactionId]!,
        fame: courtBeforeFame,
        techLevels: { ...safeTechLevels(), cultivation: 4 },
      },
    },
  },
  () => 0.5,
  true,
);
assert(
  courtStateFame.factions[playerFactionId]!.fame === courtBeforeFame,
  '教化 Lv4 豁免季度声望自然衰减',
);

// ---------------------------------------------------------
// 4. 城池卫生与人口动态调节校验
// ---------------------------------------------------------
console.log('\n--- 4. 城池卫生等级与人口动态调节 ---');
const highSanMod = computeSanitationDemographicModifiers(600); // Lv3
const lowSanMod = computeSanitationDemographicModifiers(40); // 极低卫生
assert(highSanMod.childDeathMultiplier < 1.0, '高卫生降低孩童死亡率');
assert(highSanMod.elderDeathMultiplier < 1.0, '高卫生降低老者死亡率');
assert(highSanMod.birthMultiplier > 1.0, '高卫生提高出生率');
assert(lowSanMod.childDeathMultiplier > 1.0, '低卫生惩罚性提高孩童死亡率');
assert(lowSanMod.elderDeathMultiplier > 1.0, '低卫生惩罚性提高老者死亡率');

const testDemo = { adultMale: 5000, adultFemale: 5000, child: 2000, elder: 1000 };
const highAgeResult = ageDemographicsTick(testDemo, { sanitation: 600 });
const lowAgeResult = ageDemographicsTick(testDemo, { sanitation: 40 });
assert(
  highAgeResult.next.child + highAgeResult.next.elder >
    lowAgeResult.next.child + lowAgeResult.next.elder,
  '相同初始人口下，高卫生城池留存更多孩童与老者',
);

// ---------------------------------------------------------
// 5. 疫病流行、重度/轻度、征兵受阻与治愈拔除闭环
// ---------------------------------------------------------
console.log('\n--- 5. 疫病爆发、征兵受阻与救灾拔除闭环 ---');

// 夏秋 + 人口>10000 + 卫生<60 => 爆发重度疫病
let plagueCityState: GameState = {
  ...state,
  currentMonth: 7, // 秋首月
  season: Season.AUTUMN,
  cities: {
    ...state.cities,
    [testCityId]: {
      ...state.cities[testCityId]!,
      population: 15000,
      stats: { ...state.cities[testCityId]!.stats, sanitation: 50 },
      plague: null,
      food: 500,
      officers: [scholarId],
    },
  },
  officers: {
    ...state.officers,
    [scholarId]: { ...state.officers[scholarId]!, stamina: 100, location: testCityId },
  },
};

plagueCityState = tickCityPlagueAndSanitation(plagueCityState);
const eruptedCity = plagueCityState.cities[testCityId]!;
assert(eruptedCity.plague != null, '低卫生（50）在夏秋季爆发疫病');
assert(eruptedCity.plague?.severity === 'severe', '卫生<60 确认为重度疫病');
assert(eruptedCity.plague?.remainingMonths === 3, '重度疫病基础工期为 3 个月');

// 疫区禁止征兵
let conscriptBlocked = false;
try {
  conscript(plagueCityState, testCityId, () => 0.5);
} catch (e) {
  conscriptBlocked = true;
}
assert(conscriptBlocked, '疫病流行期间严禁征兵');

// 疫病月度折损：武将体力-15
assert(
  plagueCityState.officers[scholarId]!.stamina === 85,
  '疫区驻留武将每月损失 15 点体力（100 -> 85）',
);

// 施米赈济：减轻疫病 1 月并恢复武将体力
const preReliefRemaining = plagueCityState.cities[testCityId]!.plague!.remainingMonths;
plagueCityState = relief(plagueCityState, testCityId, () => 0.5);
const relievedCity = plagueCityState.cities[testCityId]!;
assert(
  relievedCity.plague?.remainingMonths === preReliefRemaining - 1,
  '施米赈济成功缩短疫期 1 个月',
);
assert(
  plagueCityState.officers[scholarId]!.stamina === 95,
  '施米赈济为驻留武将恢复体力（85 -> 95）',
);

// 卫生项目结项彻底拔除疫病
const sanProject = {
  kind: 'sanitation' as const,
  totalGoldCost: 360,
  goldPaid: 360,
  monthlyGold: 0,
  totalMonths: 6,
  remainingMonths: 1,
  pausedMonths: 0,
  progressLostMonths: 0,
  status: 'active' as const,
  assignedOfficerId: scholarId,
};
const devSanCity: City = {
  ...relievedCity,
  gold: 1000,
  activeDevelopment: sanProject,
};
const cleanedRes = tickDevelopmentProject(plagueCityState, devSanCity);
assert(cleanedRes.city.plague == null, '发展卫生结项成功彻底拔除城池疫病');
assert(
  Boolean(cleanedRes.note?.includes('疫病彻底拔除')),
  '成功生成卫生除秽拔除疫病通报日志',
);

// ---------------------------------------------------------
// 6. GameState 实体 Schema 校验
// ---------------------------------------------------------
console.log('\n--- 6. GameStateSchema 完整性校验 ---');
const parsed = GameStateSchema.safeParse(plagueCityState);
assert(parsed.success, 'GameStateSchema 解析成功，完全向下兼容');

console.log(`\n验收结果: ${pass} 项通过, ${fail} 项失败`);
if (fail > 0) {
  process.exit(1);
} else {
  console.log('✓ S03 技艺研发与城池卫生疫病闭环验收全部通过！');
}
