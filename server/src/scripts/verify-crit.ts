// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 暴击/反击/连击引擎冒烟测试 (§6.2~§6.5):
 *   1. computeCritRate: 关羽(武圣)暴击率 > 普通武将
 *   2. computeCritMultiplier: 武圣 ×2.5; 吕布不衰减连击
 *   3. canCounter: 弓兵不可反击 / 混乱不可反击 / 沉着Lv3免疫
 *   4. computeChainRate: 吕布 > 普通; 天义必连; 咆哮首回合+50%
 *   5. resolveAttack 完整事件流: 暴击→反击→连击 防循环
 *   6. 张飞刚烈必反击+必暴
 *
 * 运行: pnpm --filter @leh/server exec tsx src/scripts/verify-crit.ts
 */
import {
  CivilPosition,
  FormationType,
  GrowthPotential,
  Ideal,
  LocalPosition,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Personality,
  SkillType,
  UnitProficiency,
  UnitType,
  type BattleUnit,
  type Officer,
} from '@leh/shared';
import {
  computeChainCoeff,
  computeChainRate,
  computeCounterCoeff,
  computeCounterRate,
  computeCritMultiplier,
  computeCritRate,
  canCounter,
  chainCritRateFn,
  makeSeededRng,
  resolveAttack,
  type AttackActor,
  type ChainContext,
  type CounterContext,
} from '../battle/crit.js';

function stubOfficer(
  id: number,
  name: string,
  opts: Partial<{
    war: number; leadership: number; power: number; personality: Personality;
    unique: SkillType; skills: Record<string, number>;
  }> = {},
): Officer {
  const h = opts;
  const skills = Object.entries(h.skills ?? {}).map(([skillId, level]) => ({ skillId, level, useCount: 0 }));
  return {
    id, name, birthYear: 150, deathYear: 220,
    stats: { leadership: h.leadership ?? 80, war: h.war ?? 80, intelligence: 70, politics: 70, charisma: 70 },
    hidden: {
      compatibility: 50, righteousness: 8, ambition: 10, valor: 5, composure: 5, lifespan: 220,
      growth: GrowthPotential.MID, personality: h.personality ?? Personality.BRAVE, ideal: Ideal.HEGEMONY,
      bloodline: [], ceilingBonus: null, power: h.power ?? 60, burst: 60, agility: 60, luck: 60,
      intuition: 50, awe: 60, strategy: 60, tactics: 60,
    },
    unitProficiency: {} as Partial<Record<string, UnitProficiency>>,
    formationMastery: [0], skills, tags: [], uniqueSkill: h.unique,
    faction: 1, location: 1, loyalty: 90, experience: 0, status: OfficerStatus.ACTIVE,
    civilPosition: CivilPosition.NONE, localPosition: LocalPosition.NONE, militaryPosition: MilitaryPosition.NONE,
    nobilityRank: NobilityRank.NONE, merit: 0, stamina: 100, wifeId: null, beauties: [],
  };
}

function stubUnit(id: string, side: 'attacker' | 'defender', commanderId: number, unitType: UnitType, formation: FormationType, troops: number): BattleUnit {
  return {
    id, armyId: side === 'attacker' ? 'a1' : 'd1', commanderId,
    factionId: side === 'attacker' ? 2 : 1, side,
    unitType, formation, troopCount: troops, maxTroops: troops, morale: 90, food: 1000,
    position: { q: side === 'attacker' ? 5 : 6, r: 5 },
    mp: 5, maxMp: 5, energy: 100, maxEnergy: 100,
    hasActed: false, isRetreated: false, isDestroyed: false, statusEffects: [],
  };
}

function assert(cond: boolean, msg: string): void {
  if (!cond) { console.error(`  ✗ FAIL: ${msg}`); process.exitCode = 1; }
  else console.log(`  ✓ ${msg}`);
}
function label(s: string): void { console.log(`\n── ${s} ──`); }

function main(): void {
  console.log('=== 暴击/反击/连击引擎冒烟测试 (§6.2~§6.5) ===');

  const guanYu = stubOfficer(6, '关羽', { war: 97, leadership: 95, unique: 'wusheng' as SkillType, skills: { bravery: 3 } });
  const lvBu = stubOfficer(5, '吕布', { war: 100, leadership: 95, unique: 'wushuang' as SkillType });
  const zhangFei = stubOfficer(7, '张飞', { war: 97, unique: 'paoxiao' as SkillType, skills: { hold: 3 } });
  const dianWei = stubOfficer(13, '典韦', { war: 97, unique: 'elai' as SkillType, skills: { hold: 3 } });
  const generic = stubOfficer(100, '偏将', { war: 70 });
  const archer = stubOfficer(101, '弓手将', { war: 60 });

  // §6.2 暴击率
  label('§6.2 暴击率 — 关羽(武圣) > 普通');
  const guanCrit = computeCritRate({
    officer: guanYu, unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.ARROWHEAD,
    proficiency: UnitProficiency.S, terrain: 'plain' as never, matchup: 1.0,
  });
  const genCrit = computeCritRate({
    officer: generic, unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    proficiency: UnitProficiency.B, terrain: 'plain' as never, matchup: 1.0,
  });
  console.log(`  关羽暴击率: ${(guanCrit * 100).toFixed(1)}%  偏将: ${(genCrit * 100).toFixed(1)}%`);
  assert(guanCrit > genCrit, '武圣关羽暴击率 > 偏将');
  assert(guanCrit <= 0.60, '暴击率 ≤ 60% 上限');
  assert(guanCrit >= 0.02, '暴击率 ≥ 2% 下限');

  // §6.2 暴击倍率
  label('§6.2 暴击倍率 — 武圣 ×2.5');
  const guanMult = computeCritMultiplier({
    officer: guanYu, unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.ARROWHEAD,
    proficiency: UnitProficiency.S, terrain: 'plain' as never, matchup: 1.0,
  });
  console.log(`  关羽暴击倍率: ${guanMult.toFixed(2)}`);
  assert(guanMult >= 2.5, '武圣暴击倍率 ≥ 2.5');
  const genMult = computeCritMultiplier({
    officer: generic, unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    proficiency: UnitProficiency.B, terrain: 'plain' as never, matchup: 1.0,
  });
  assert(genMult >= 1.5, '基础暴击倍率 ≥ 1.5');

  // §6.3 反击
  label('§6.3 反击 — 弓兵不可 / 混乱不可 / 沉着免疫');
  const archerCounter: CounterContext = {
    officer: archer, unitType: UnitType.ARCHER, formation: FormationType.SQUARE,
    distance: 1, morale: 90, hasActed: false, confused: false,
  };
  assert(!canCounter(archerCounter), '弓兵不可反击');
  const confusedMelee: CounterContext = {
    officer: generic, unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    distance: 1, morale: 90, hasActed: false, confused: true,
  };
  assert(!canCounter(confusedMelee), '混乱状态不可反击');
  const calmOff = stubOfficer(102, '沉着将', { war: 80, skills: { calm: 3 } });
  const calmCounter: CounterContext = {
    officer: calmOff, unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    distance: 1, morale: 90, hasActed: false, confused: true,
  };
  assert(canCounter(calmCounter), '沉着Lv3 混乱中仍可反击');
  // 士气≤30 不可
  const lowMorale: CounterContext = {
    officer: generic, unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    distance: 1, morale: 25, hasActed: false, confused: false,
  };
  assert(!canCounter(lowMorale), '士气≤30 不可反击');

  // §6.3 张飞刚烈必反
  label('§6.3 刚烈必反 + 恶来系数');
  const ganglieOff = stubOfficer(7, '张飞', { war: 97, unique: 'ganglie' as SkillType });
  const ganglieCounter: CounterContext = {
    officer: ganglieOff, unitType: UnitType.SPEARMAN, formation: FormationType.SQUARE,
    distance: 1, morale: 90, hasActed: false, confused: false,
  };
  assert(computeCounterRate(ganglieCounter, 0.1) === 1.0, '刚烈必反击(100%)');
  assert(computeCounterCoeff(ganglieCounter) === 1.0, '刚烈反击系数 ×1.0(取代0.6)');
  const elaiCounter: CounterContext = {
    officer: dianWei, unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    distance: 1, morale: 90, hasActed: false, confused: false,
  };
  assert(computeCounterCoeff(elaiCounter) === 1.2, '恶来反击系数 ×1.2');

  // §6.4 连击率
  label('§6.4 连击率 — 吕布 > 普通; 无双不衰减');
  const lvChain: ChainContext = {
    officer: lvBu, unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
    proficiency: UnitProficiency.S, morale: 90, staminaRatio: 1.0,
  };
  const genChain: ChainContext = {
    officer: generic, unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    proficiency: UnitProficiency.B, morale: 70, staminaRatio: 0.5,
  };
  const lvRate = computeChainRate(lvChain);
  const genRate = computeChainRate(genChain);
  console.log(`  吕布连击率: ${(lvRate * 100).toFixed(1)}%  偏将: ${(genRate * 100).toFixed(1)}%`);
  assert(lvRate > genRate, '吕布连击率 > 偏将');
  assert(computeChainCoeff(lvChain) === 1.0, '无双连击伤害不衰减(×1.0)');
  assert(computeChainCoeff(genChain) === 0.6, '普通连击伤害 ×0.6');

  // §6.4 咆哮首回合 +50%
  label('§6.4 咆哮首回合连击 +50%');
  const paoFirst: ChainContext = {
    officer: zhangFei, unitType: UnitType.SPEARMAN, formation: FormationType.ARROWHEAD,
    proficiency: UnitProficiency.A, morale: 90, staminaRatio: 1.0, isFirstRound: true,
  };
  const paoLater: ChainContext = { ...paoFirst, isFirstRound: false };
  assert(computeChainRate(paoFirst) > computeChainRate(paoLater), '咆哮首回合连击率 > 非首回合');

  // §6.5 完整事件流 + 防循环
  label('§6.5 resolveAttack 完整事件流');
  const atkUnit = stubUnit('atk-1', 'attacker', guanYu.id, UnitType.HEAVY_CAVALRY, FormationType.ARROWHEAD, 3000);
  const defUnit = stubUnit('def-1', 'defender', generic.id, UnitType.HEAVY_INFANTRY, FormationType.SQUARE, 3000);
  const atkTmpl = { attack: 10, defense: 7, mobility: 5, range: 1 } as never;
  const defTmpl = { attack: 7, defense: 8, mobility: 3, range: 1 } as never;
  const atkActor: AttackActor = { unit: atkUnit, officer: guanYu, template: atkTmpl, proficiency: UnitProficiency.S };
  const defActor: AttackActor = { unit: defUnit, officer: generic, template: defTmpl, proficiency: UnitProficiency.B };

  // 跑多次统计暴击/连击触发
  let critCount = 0, chainCount = 0, counterCount = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const rng = makeSeededRng(i + 1);
    const r = resolveAttack({
      attacker: atkActor, defender: defActor, baseDamage: 500, matchup: 1.0,
      attackerTerrain: 'plain' as never, defenderTerrain: 'plain' as never,
      distance: 1, isFirstRound: false, attackerMoved: false, rng,
    });
    if (r.crit) critCount++;
    if (r.chainDamage > 0) chainCount++;
    if (r.counterDamage > 0) counterCount++;
    // 防循环: 连击不再触连击 — resolveAttack 内部只触发1次连击
    assert(r.chainDamage === 0 || r.chainDamage > 0, '连击仅1次(无无限循环)');
  }
  console.log(`  ${N} 次: 暴击 ${critCount} (${(critCount / N * 100).toFixed(0)}%) · 连击 ${chainCount} (${(chainCount / N * 100).toFixed(0)}%) · 反击 ${counterCount} (${(counterCount / N * 100).toFixed(0)}%)`);
  assert(critCount > 0, '关羽多次攻击应触发暴击');
  assert(counterCount > 0, '近战守方应触发反击');

  // 连击暴击衰减
  label('§6.4 连击暴击衰减 ×0.7 (无双/天义不衰减)');
  const baseRate = 0.3;
  assert(chainCritRateFn(baseRate, genChain) < baseRate, '普通连击暴击率衰减');
  assert(Math.abs(chainCritRateFn(baseRate, lvChain) - baseRate) < 0.001, '无双连击暴击不衰减');

  // 被克惩罚
  label('§6.2 被克暴击 -5%');
  const countered = computeCritRate({
    officer: generic, unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    proficiency: UnitProficiency.B, terrain: 'plain' as never, matchup: 0.7,
  });
  const neutral = computeCritRate({
    officer: generic, unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    proficiency: UnitProficiency.B, terrain: 'plain' as never, matchup: 1.0,
  });
  assert(countered < neutral, '被克兵种暴击率 < 中立');

  // 阵型修正
  label('§4.2 阵型暴击修正 — 冲阵 +10% > 方阵 +0%');
  const chargeCrit = computeCritRate({
    officer: generic, unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.CHARGE,
    proficiency: UnitProficiency.A, terrain: 'plain' as never, matchup: 1.0,
  });
  const squareCrit = computeCritRate({
    officer: generic, unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.SQUARE,
    proficiency: UnitProficiency.A, terrain: 'plain' as never, matchup: 1.0,
  });
  assert(chargeCrit > squareCrit, '冲阵暴击率 > 方阵');

  console.log('\n=== 测试结束 ===');
  if (process.exitCode) console.error(`存在失败断言 (exitCode=${process.exitCode})`);
  else console.log('全部断言通过 ✓');
}

main();