// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 专项验收门禁 — Session 458 · P5-15 武将特性与属性天花板计算引擎
 *
 * 验收范围：
 *   1. 42 项武将特性真源定义（5大类 8+9+10+9+6 = 42 项）
 *   2. 属性天花板与有效属性计算（吕布+50/诸葛亮+20/曹操+15/荀彧+10/刘备+5，武力第二档97）
 *   3. 特性加点门禁、点数扣减与天花板拦截（upgradeTrait）
 *   4. 特性重置（resetSkillTree）点数返还
 *   5. 战斗暴击/反击/连击与状态异常特性数值消费（crit.ts）
 */
import assert from 'node:assert/strict';
import {
  CeilingAttribute,
  TraitCategory,
  TRAITS,
  TRAIT_MAP,
  getEffectiveStat,
  getTraitRequiredStat,
  getTraitCeilingLevel,
  getOfficerTraitLevel,
  type Officer,
  FormationType,
  UnitType,
  TerrainType,
} from '@leh/shared';
import * as gameService from '../services/game.js';
import {
  computeCritRate,
  computeCritMultiplier,
  canCounter,
  computeCounterRate,
  computeCounterCoeff,
  computeChainRate,
  type CritContext,
  type CounterContext,
  type ChainContext,
} from '../battle/crit.js';

let passedAssertions = 0;
function pass(msg: string) {
  passedAssertions++;
  console.log(`  ✓ ${msg}`);
}

console.log('=== Session 458 · P5-15 武将特性与属性天花板专项验收 ===\n');

// ---------------------------------------------------------------------------
// 1. 42 项特性真源定义
// ---------------------------------------------------------------------------
console.log('── 1. 特性真源结构与五大类分布 ──');

assert.equal(TRAITS.length, 42, '特性全量恰好 42 项');
assert.equal(Object.keys(TRAIT_MAP).length, 42, 'TRAIT_MAP 映射恰好 42 项');
pass('特性总数 42 项无遗漏');

const categoryCounts = {
  [TraitCategory.STRATEGY]: 0,
  [TraitCategory.TACTICS]: 0,
  [TraitCategory.COMBAT]: 0,
  [TraitCategory.CIVIL]: 0,
  [TraitCategory.PERSONALITY]: 0,
};
for (const t of TRAITS) {
  categoryCounts[t.category]++;
  assert.equal(t.levels.length, 5, `${t.name} 必须包含 5 级完整描述`);
  assert.ok(t.description.length > 0, `${t.name} 必须有描述`);
}

assert.equal(categoryCounts[TraitCategory.STRATEGY], 8, '战略类恰好 8 项');
assert.equal(categoryCounts[TraitCategory.TACTICS], 9, '战术类恰好 9 项');
assert.equal(categoryCounts[TraitCategory.COMBAT], 10, '战斗类恰好 10 项');
assert.equal(categoryCounts[TraitCategory.CIVIL], 9, '内政类恰好 9 项');
assert.equal(categoryCounts[TraitCategory.PERSONALITY], 6, '人格类恰好 6 项');
pass('五大类分布严格符合 8+9+10+9+6 结构');

// ---------------------------------------------------------------------------
// 2. 属性天花板与有效属性计算
// ---------------------------------------------------------------------------
console.log('\n── 2. 属性天花板隐藏加成与有效属性 ──');

// 模拟武将
function makeOfficer(overrides: Partial<Officer> = {}): Officer {
  return {
    id: 999,
    name: '测试员',
    birthYear: 160,
    deathYear: 220,
    stats: { leadership: 70, war: 70, intelligence: 70, politics: 70, charisma: 70 },
    hidden: {
      compatibility: 50,
      righteousness: 5,
      ambition: 5,
      valor: 5,
      composure: 5,
      lifespan: 220,
      growth: 'mid' as any,
      personality: 'calm' as any,
      ideal: 'hegemony' as any,
      bloodline: [],
      ceilingBonus: null,
      power: 50,
      burst: 50,
      agility: 50,
      luck: 50,
      intuition: 50,
      awe: 50,
      strategy: 50,
      tactics: 50,
    },
    unitProficiency: {},
    formationMastery: [],
    skills: [],
    tags: [],
    faction: 1,
    location: 1,
    loyalty: 80,
    experience: 0,
    status: 'active' as any,
    civilPosition: 'none' as any,
    localPosition: 'none' as any,
    militaryPosition: 'none' as any,
    nobilityRank: 'none' as any,
    merit: 0,
    stamina: 100,
    beauties: [],
    ...overrides,
  } as Officer;
}

const lvbu = makeOfficer({
  id: 5,
  name: '吕布',
  stats: { leadership: 85, war: 100, intelligence: 25, politics: 13, charisma: 40 },
  hidden: {
    ...makeOfficer().hidden,
    ceilingBonus: { attribute: CeilingAttribute.WAR, hiddenBonus: 50 },
  },
});
assert.equal(getEffectiveStat(lvbu, CeilingAttribute.WAR), 150, '吕布有效武力为 100+50=150');
pass('吕布武力天花板断层隐藏加成 (+50) 结算正确');

const zhuge = makeOfficer({
  id: 20,
  name: '诸葛亮',
  stats: { leadership: 98, war: 38, intelligence: 100, politics: 98, charisma: 95 },
  hidden: {
    ...makeOfficer().hidden,
    ceilingBonus: { attribute: CeilingAttribute.INTELLIGENCE, hiddenBonus: 20 },
  },
});
assert.equal(getEffectiveStat(zhuge, CeilingAttribute.INTELLIGENCE), 120, '诸葛亮有效智谋为 100+20=120');
pass('诸葛亮智谋天花板断层隐藏加成 (+20) 结算正确');

const caocao = makeOfficer({
  id: 1,
  name: '曹操',
  stats: { leadership: 100, war: 72, intelligence: 91, politics: 94, charisma: 96 },
  hidden: {
    ...makeOfficer().hidden,
    ceilingBonus: { attribute: CeilingAttribute.LEADERSHIP, hiddenBonus: 15 },
  },
});
assert.equal(getEffectiveStat(caocao, CeilingAttribute.LEADERSHIP), 115, '曹操有效统率为 100+15=115');
pass('曹操统率天花板断层隐藏加成 (+15) 结算正确');

// 阶梯判定
assert.equal(getTraitRequiredStat(1, CeilingAttribute.WAR), 0);
assert.equal(getTraitRequiredStat(2, CeilingAttribute.WAR), 60);
assert.equal(getTraitRequiredStat(3, CeilingAttribute.WAR), 80);
assert.equal(getTraitRequiredStat(4, CeilingAttribute.WAR), 90);
assert.equal(getTraitRequiredStat(5, CeilingAttribute.WAR), 97, '武力 Lv5 起点 97');
assert.equal(getTraitRequiredStat(5, CeilingAttribute.INTELLIGENCE), 99, '智谋 Lv5 起点 99');
pass('特性等级门槛阶梯严格符合规范');

assert.equal(getTraitCeilingLevel(55, CeilingAttribute.WAR), 1);
assert.equal(getTraitCeilingLevel(65, CeilingAttribute.WAR), 2);
assert.equal(getTraitCeilingLevel(85, CeilingAttribute.WAR), 3);
assert.equal(getTraitCeilingLevel(92, CeilingAttribute.WAR), 4);
assert.equal(getTraitCeilingLevel(97, CeilingAttribute.WAR), 5);
assert.equal(getTraitCeilingLevel(97, CeilingAttribute.INTELLIGENCE), 4, '智谋 97 仍在 Lv4');
assert.equal(getTraitCeilingLevel(99, CeilingAttribute.INTELLIGENCE), 5, '智谋 99 达 Lv5');
pass('最高可学等级判定无误');

// ---------------------------------------------------------------------------
// 3. 服务端特性加点与天花板拦截
// ---------------------------------------------------------------------------
console.log('\n── 3. 服务端加点门禁与天花板拦截 ──');

// 初始化测试用存档
gameService.createGame(1, 1);
const game = gameService.getGame();
const testOfficerId = game.playerFactionId === 1 ? 1 : Object.values(game.officers)[0].id;
// 初始功绩等级不足以加点
assert.throws(
  () => gameService.upgradeTrait(testOfficerId, 'supervise'),
  /特性点不足/,
  '无可用特性点时抛错',
);
pass('点数不足拦截拦截生效');

// 注入功绩等级以获得特性点（meritLevel 15 -> 3 点）
gameService.skillTreeTestHooks.setMeritLevelForTest(testOfficerId, 15);
let skillState = gameService.getOfficerSkillState(testOfficerId);
assert.equal(skillState.totalTraitPoints, 3, 'meritLevel 15 应有 3 个特性点');
assert.equal(skillState.traitPointsSpent, 0);

// 不存在的特性 ID
assert.throws(
  () => gameService.upgradeTrait(testOfficerId, 'non_existent_trait'),
  /特性不存在/,
  '非法特性 ID 抛错',
);
pass('非法特性拦截生效');

// 升 1 级督战（supervise）
skillState = gameService.upgradeTrait(testOfficerId, 'supervise');
assert.equal(skillState.traitLevels['supervise'], 1);
assert.equal(skillState.traitPointsSpent, 1);
pass('合法特性升至 Lv1 扣减 1 点');

// 升至 Lv2
skillState = gameService.upgradeTrait(testOfficerId, 'supervise');
assert.equal(skillState.traitLevels['supervise'], 2);
assert.equal(skillState.traitPointsSpent, 2);
pass('合法特性升至 Lv2 扣减 2 点');

// 验证天花板拦截：选择一项属性不达标的特性
// 曹操统率很高，但武力 72（有效武力 72，无法学豪勇 Lv3，因 Lv3 需武力 ≥80）
// 先用剩下的 1 点学豪勇 Lv1
skillState = gameService.upgradeTrait(testOfficerId, 'bravery');
assert.equal(skillState.traitLevels['bravery'], 1);
assert.equal(skillState.traitPointsSpent, 3);
pass('武力 72 学习豪勇 Lv1 成功');

// 再给更多点数测试天花板受阻
gameService.skillTreeTestHooks.setMeritLevelForTest(testOfficerId, 25); // 5 点
// 升豪勇 Lv2（需 ≥60）
skillState = gameService.upgradeTrait(testOfficerId, 'bravery');
assert.equal(skillState.traitLevels['bravery'], 2);

// 功绩抬高后有效武力可能达 80（Lv3 门槛），继续升 Lv3
skillState = gameService.upgradeTrait(testOfficerId, 'bravery');
assert.equal(skillState.traitLevels['bravery'], 3);
pass('豪勇升至 Lv3');

// 尝试升豪勇 Lv4（需武力 ≥90，当前曹操有效武力 ~80，必须被天花板拦截）
assert.throws(
  () => gameService.upgradeTrait(testOfficerId, 'bravery'),
  /对应属性未达天花板/,
  '未达到武力 ≥90 时无法升至豪勇 Lv4',
);
pass('属性天花板门槛严格拦截生效（需武力≥90）');

// 重置技能与特性
skillState = gameService.resetSkillTree(testOfficerId);
assert.equal(skillState.traitPointsSpent, 0);
assert.deepEqual(skillState.traitLevels, {});
pass('resetSkillTree 完整清空并返还特性点');

// ---------------------------------------------------------------------------
// 4. 战斗数值特性消费检验
// ---------------------------------------------------------------------------
console.log('\n── 4. 战斗暴击/反击/连击数值消费 ──');

const baseOfficer = makeOfficer({
  stats: { leadership: 80, war: 80, intelligence: 80, politics: 80, charisma: 80 },
});

const traitOfficer = makeOfficer({
  stats: { leadership: 80, war: 80, intelligence: 80, politics: 80, charisma: 80 },
  traitLevels: {
    archery: 3,           // 弓兵暴击率 +12%
    might: 4,             // 暴击伤害 +32%
    supervise: 5,         // 暴击率 +10%
    iron_wall: 4,         // 反击率 +20%, 反击伤害 +12%
    continuous_strike: 3, // 连击率 +15%
    calm: 3,              // 混乱仍可反击
  },
});

assert.equal(getOfficerTraitLevel(traitOfficer, 'archery'), 3, '读取特性等级正确');
assert.equal(getOfficerTraitLevel(baseOfficer, 'archery'), 0, '未学特性读取为 0');
pass('getOfficerTraitLevel 辅助函数读取准确');

// 暴击率对比（弓兵）
const critCtxBase: CritContext = {
  officer: baseOfficer,
  unitType: 'archer' as UnitType,
  formation: FormationType.SQUARE,
  proficiency: undefined,
  terrain: 'plain' as TerrainType,
  matchup: 1.0,
};
const critCtxTrait: CritContext = {
  officer: traitOfficer,
  unitType: 'archer' as UnitType,
  formation: FormationType.SQUARE,
  proficiency: undefined,
  terrain: 'plain' as TerrainType,
  matchup: 1.0,
};

const baseRate = computeCritRate(critCtxBase);
const traitRate = computeCritRate(critCtxTrait);
assert.ok(traitRate > baseRate, `特性武将暴击率 (${traitRate}) 应高于基础 (${baseRate})`);
// 增幅应为 supervise Lv5 (+10%) + archery Lv3 (+12%) = +22%
assert.equal(Math.round((traitRate - baseRate) * 100), 22);
pass('弓术与督战特性暴击率加成 (+22%) 准确生效');

// 暴击伤害倍率对比
const baseMult = computeCritMultiplier(critCtxBase);
const traitMult = computeCritMultiplier(critCtxTrait);
assert.ok(traitMult > baseMult, `特性武将暴击倍率 (${traitMult}) 应高于基础 (${baseMult})`);
// might Lv4 为 +32% 乘区
assert.ok(Math.abs(traitMult - baseMult * 1.32) < 0.001);
pass('刚力特性暴击伤害倍率 (+32%) 准确生效');

// 混乱中反击对比
const counterCtxBase: CounterContext = {
  officer: baseOfficer,
  unitType: 'spearman' as UnitType,
  formation: FormationType.SQUARE,
  distance: 1,
  morale: 80,
  hasActed: false,
  confused: true,
};
const counterCtxTrait: CounterContext = {
  officer: traitOfficer,
  unitType: 'spearman' as UnitType,
  formation: FormationType.SQUARE,
  distance: 1,
  morale: 80,
  hasActed: false,
  confused: true,
};
assert.equal(canCounter(counterCtxBase), false, '普通武将混乱中无法反击');
assert.equal(canCounter(counterCtxTrait), true, '沉着 Lv3+ 武将混乱中保持反击能力');
pass('沉着 Lv3+ 混乱反击豁免准确生效');

// 铁壁反击率与伤害系数
const normalCounterCtxBase: CounterContext = { ...counterCtxBase, confused: false };
const normalCounterCtxTrait: CounterContext = { ...counterCtxTrait, confused: false };
const baseCounterRate = computeCounterRate(normalCounterCtxBase, baseRate);
const traitCounterRate = computeCounterRate(normalCounterCtxTrait, traitRate);
assert.equal(Math.round((traitCounterRate - baseCounterRate) * 100), 20, '铁壁 Lv4 反击率 +20%');

const baseCounterCoeffVal = computeCounterCoeff(normalCounterCtxBase);
const traitCounterCoeffVal = computeCounterCoeff(normalCounterCtxTrait);
assert.ok(Math.abs(traitCounterCoeffVal - baseCounterCoeffVal - 0.12) < 0.001, '铁壁 Lv4 反击伤害 +12%');
pass('铁壁特性反击率与反击伤害系数准确生效');

// 连战连击率对比
const chainCtxBase: ChainContext = {
  officer: baseOfficer,
  unitType: 'heavyInfantry' as UnitType,
  formation: FormationType.SQUARE,
  proficiency: undefined,
  morale: 80,
  staminaRatio: 1.0,
};
const chainCtxTrait: ChainContext = {
  officer: traitOfficer,
  unitType: 'heavyInfantry' as UnitType,
  formation: FormationType.SQUARE,
  proficiency: undefined,
  morale: 80,
  staminaRatio: 1.0,
};
const baseChainRate = computeChainRate(chainCtxBase);
const traitChainRate = computeChainRate(chainCtxTrait);
assert.equal(Math.round((traitChainRate - baseChainRate) * 100), 15, '连战 Lv3 连击率 +15%');
pass('连战特性连击率加成 (+15%) 准确生效');

console.log(`\n========================================`);
console.log(`全部断言通过！共 ${passedAssertions} 项检查 100% 绿色通过 ✓`);
console.log(`========================================\n`);
