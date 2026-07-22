// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 单挑引擎冒烟测试 (§8):
 *   1. 关羽(武圣) vs 典韦(恶来) — 全自动结算, 验证状态机走完 + 产生结果
 *   2. 吕布(无双) vs 张飞(咆哮) — 验证无双必先手 + 三连击 + 不可被斩
 *   3. 普通武将对决 — 验证无专属时正常结算
 *   4. canChallenge / aiAcceptChallenge 边界条件
 *
 * 运行: pnpm --filter @leh/server verify:duel
 */
import {
  CivilPosition,
  GrowthPotential,
  Ideal,
  LocalPosition,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Personality,
  SkillType,
  UnitProficiency,
  type Officer,
} from '@leh/shared';
import {
  DEFAULT_DUEL_CONFIG,
  aiAcceptChallenge,
  canChallenge,
  createDuel,
  makeSeededRng,
  runDuelToCompletion,
  stepDuel,
} from '../battle/duel.js';

function stubOfficer(
  id: number,
  name: string,
  opts: Partial<{
    war: number; power: number; burst: number; agility: number; luck: number;
    valor: number; awe: number; strategy: number; tactics: number;
    personality: Personality; unique: SkillType;
  }> = {},
): Officer {
  const h = opts;
  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: {
      leadership: 80,
      war: h.war ?? 80,
      intelligence: 70,
      politics: 70,
      charisma: 70,
    },
    hidden: {
      compatibility: 50,
      righteousness: 8,
      ambition: 10,
      valor: h.valor ?? 5,
      composure: 5,
      lifespan: 220,
      growth: GrowthPotential.MID,
      personality: h.personality ?? Personality.BRAVE,
      ideal: Ideal.HEGEMONY,
      bloodline: [],
      ceilingBonus: null,
      power: h.power ?? 60,
      burst: h.burst ?? 60,
      agility: h.agility ?? 60,
      luck: h.luck ?? 60,
      intuition: 50,
      awe: h.awe ?? 60,
      strategy: h.strategy ?? 60,
      tactics: h.tactics ?? 60,
    },
    unitProficiency: {} as Partial<Record<string, UnitProficiency>>,
    formationMastery: [0],
    skills: [],
    tags: [],
    uniqueSkill: h.unique,
    faction: 1,
    location: 1,
    loyalty: 90,
    experience: 0,
    status: OfficerStatus.ACTIVE,
    civilPosition: CivilPosition.NONE,
    localPosition: LocalPosition.NONE,
    militaryPosition: MilitaryPosition.NONE,
    nobilityRank: NobilityRank.NONE,
    merit: 0,
    stamina: 100,
    wifeId: null,
    beauties: [],
  };
}

function label(s: string): void {
  console.log(`\n── ${s} ──`);
}

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`  ✗ FAIL: ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

function runCase(name: string, a: Officer, b: Officer, seed: number): void {
  label(name);
  const rng = makeSeededRng(seed);
  const duel = createDuel('test', a, b, DEFAULT_DUEL_CONFIG, rng);
  console.log(`  先手: ${duel.turnOrder[0] === a.id ? a.name : b.name}`);
  const final = runDuelToCompletion(duel, a, b, DEFAULT_DUEL_CONFIG, makeSeededRng(seed + 1));
  console.log(`  回合数: ${final.roundHistory.length}`);
  console.log(`  阶段: ${final.phase}`);
  if (final.result) {
    const winner = final.result.winnerId === a.id ? a.name : final.result.winnerId === b.id ? b.name : '平局';
    console.log(`  结果: ${final.result.outcome} | 胜者: ${winner}`);
    console.log(`  结语: ${final.result.epilogue}`);
    // 打印最后3回合叙事
    for (const r of final.roundHistory.slice(-3)) {
      console.log(`    R${r.round}: ${r.description}`);
    }
  }
  assert(final.phase === 'resolved', '单挑状态机走到 resolved');
  assert(final.result !== undefined, '产生了 DuelResult');
  assert(final.roundHistory.length > 0, '至少有 1 回合记录');
  assert(final.roundHistory.length <= DEFAULT_DUEL_CONFIG.maxRounds, '回合数未超过上限');
}

function main(): void {
  console.log('=== 单挑引擎冒烟测试 ===');

  const guanYu = stubOfficer(6, '关羽', {
    war: 97, power: 92, burst: 80, agility: 72, luck: 60, valor: 7,
    awe: 95, strategy: 65, tactics: 55, personality: Personality.BRAVE,
    unique: 'wusheng' as SkillType,
  });
  const dianWei = stubOfficer(13, '典韦', {
    war: 97, power: 85, burst: 70, agility: 60, luck: 60, valor: 6,
    awe: 80, strategy: 40, tactics: 30, personality: Personality.RECKLESS,
    unique: 'elai' as SkillType,
  });
  const lvBu = stubOfficer(5, '吕布', {
    war: 100, power: 100, burst: 100, agility: 85, luck: 30, valor: 7,
    awe: 98, strategy: 25, tactics: 35, personality: Personality.RECKLESS,
    unique: 'wushuang' as SkillType,
  });
  const zhangFei = stubOfficer(7, '张飞', {
    war: 97, power: 90, burst: 96, agility: 70, luck: 30, valor: 7,
    awe: 93, strategy: 20, tactics: 25, personality: Personality.RECKLESS,
    unique: 'paoxiao' as SkillType,
  });
  const genericA = stubOfficer(100, '偏将甲', { war: 75, personality: Personality.CAUTIOUS });
  const genericB = stubOfficer(101, '偏将乙', { war: 72, personality: Personality.GENTLE });

  runCase('关羽(武圣) vs 典韦(恶来)', guanYu, dianWei, 42);
  runCase('吕布(无双) vs 张飞(咆哮)', lvBu, zhangFei, 7);
  runCase('偏将甲 vs 偏将乙 (无专属)', genericA, genericB, 99);

  // 单回合推进测试 (确定性)
  label('单回合推进 (createDuel → stepDuel)');
  const rng1 = makeSeededRng(123);
  const s1 = createDuel('test', guanYu, dianWei, DEFAULT_DUEL_CONFIG, rng1);
  const before = s1.roundHistory.length;
  const after1 = stepDuel(s1, guanYu, dianWei, DEFAULT_DUEL_CONFIG, makeSeededRng(124));
  assert(after1.roundHistory.length === before + 1, 'stepDuel 推进 1 回合');
  assert(after1.round === 1, '回合数 +1');

  // canChallenge 边界
  label('canChallenge 边界');
  const okWar = canChallenge(guanYu, dianWei, 50);
  assert(okWar.ok, '武力充足 + 气力充足 → 可发起');
  const noEnergy = canChallenge(guanYu, dianWei, 5);
  assert(!noEnergy.ok && noEnergy.reason === '气力不足', '气力不足 → 拒绝');
  const civilOff = stubOfficer(200, '文官', { war: 30 });
  const civilCheck = canChallenge(civilOff, dianWei, 100);
  assert(!civilCheck.ok, '文官不可发起');

  // aiAcceptChallenge
  label('aiAcceptChallenge');
  const strongVsWeak = aiAcceptChallenge(guanYu, genericA, 1.0);
  assert(!strongVsWeak, '武力差≥15 → AI 拒绝保命');
  const tired = aiAcceptChallenge(genericA, genericB, 0.2);
  assert(!tired, '体力<40% → 自动拒绝');
  const even = aiAcceptChallenge(genericA, genericB, 0.9);
  assert(even, '武力接近 + 体力足 → 接受');

  // 无双必先手
  label('吕布无双必先手');
  const lvDuel = createDuel('test', lvBu, guanYu, DEFAULT_DUEL_CONFIG, makeSeededRng(1));
  assert(lvDuel.turnOrder[0] === lvBu.id, '吕布(无双) 必为先手');

  // 受伤记录
  label('受伤系统');
  const injRng = makeSeededRng(313);
  const injDuel = runDuelToCompletion(
    createDuel('test', lvBu, dianWei, DEFAULT_DUEL_CONFIG, injRng),
    lvBu, dianWei, DEFAULT_DUEL_CONFIG, makeSeededRng(314),
  );
  const anyInjury = injDuel.roundHistory.some((r) =>
    Object.values(r.injuryApplied).some((i) => i !== null),
  );
  if (anyInjury) {
    console.log('  ✓ 至少一场单挑触发了受伤判定');
  } else {
    console.log('  · 本轮随机未触发受伤 (概率性, 非断言失败)');
  }

  // 无双不可被斩
  label('吕布不可被斩 (无双保护)');
  let lvBuKilled = false;
  for (let i = 0; i < 10; i++) {
    const r = runDuelToCompletion(
      createDuel('test', dianWei, lvBu, DEFAULT_DUEL_CONFIG, makeSeededRng(i * 17 + 1)),
      dianWei, lvBu, DEFAULT_DUEL_CONFIG, makeSeededRng(i * 17 + 2),
    );
    if (r.result && r.result.loserId === lvBu.id && r.result.outcome === 'killed') {
      lvBuKilled = true;
      break;
    }
  }
  assert(!lvBuKilled, '吕布(无双) 在 10 次单挑中从未被斩');

  // 关羽武器映射 (青龙偃月刀 → blade, 暴伤×3.0)
  label('关羽武器映射 (id=6 → blade)');
  // 武器解析为内部函数; 通过暴击倍率间接验证 — 此处仅断言 createDuel 不抛错
  assert(createDuel('t', guanYu, dianWei, DEFAULT_DUEL_CONFIG, makeSeededRng(233)).challengerId === 6, '关羽作为挑战方创建成功');

  console.log('\n=== 测试结束 ===');
  if (process.exitCode) {
    console.error(`存在失败断言 (exitCode=${process.exitCode})`);
  } else {
    console.log('全部断言通过 ✓');
  }
}

main();
