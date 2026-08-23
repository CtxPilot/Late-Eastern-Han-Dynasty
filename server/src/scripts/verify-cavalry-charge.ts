// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** Session 371：S10 移动后冲锋（骑兵冲锋最小切片，docs/08 §二十九）验证。 */
import {
  FormationType,
  TerrainType,
  UnitProficiency,
  UnitType,
  Weather,
  directionTo,
  type BattleUnit,
  type Officer,
  type UnitTemplate,
} from '@leh/shared';
import { runSimpleEnemyAi } from '../battle/simpleAi.js';
import {
  applyChargeToBaseDamage,
  computeChainCoeff,
  computeChainRate,
  resolveChargeBonus,
} from '../battle/crit.js';
import { attackUnit } from '../engine/battle.js';
import { createGame, getGame, startBattle } from '../services/game.js';

let passed = 0;
function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`✗ ${label}`);
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const template = (type: UnitType, attack = 7): UnitTemplate => ({
  name: type, type, isSpecial: false, attack, defense: 5, mobility: 3, range: 1,
  traits: [], strongAgainst: [], weakAgainst: [], recruitRequirement: null, abilities: [],
  terrainModifiers: {}, recruitCost: { gold: 0, population: 0, food: 0 },
});
const templates: Record<string, UnitTemplate> = {
  [UnitType.LIGHT_INFANTRY]: template(UnitType.LIGHT_INFANTRY, 5),
  [UnitType.HEAVY_INFANTRY]: template(UnitType.HEAVY_INFANTRY, 9),
  [UnitType.LIGHT_CAVALRY]: template(UnitType.LIGHT_CAVALRY, 7),
  [UnitType.HEAVY_CAVALRY]: template(UnitType.HEAVY_CAVALRY, 8),
};
const plainMap = Array.from({ length: 5 }, () => Array.from({ length: 6 }, () => TerrainType.PLAIN));
const unit = (id: string, side: 'attacker' | 'defender', q: number, r: number, troops: number, commanderId: number, type = UnitType.LIGHT_INFANTRY): BattleUnit => ({
  id, armyId: id, commanderId, commanderName: id, factionId: side === 'attacker' ? 1 : 2,
  side, unitType: type, formation: FormationType.SQUARE, troopCount: troops, maxTroops: 1000,
  morale: 80, food: 1000, position: { q, r }, mp: 3, maxMp: 3, energy: 100, maxEnergy: 100,
  hasActed: false, isRetreated: false, isDestroyed: false, statusEffects: [],
});
const officer = (id: number, name: string, war = 40): Officer => ({
  id, name, stats: { leadership: 60, war, intelligence: 50, politics: 50, charisma: 50 },
  skills: [], unitProficiency: { [UnitType.LIGHT_CAVALRY]: UnitProficiency.C, [UnitType.HEAVY_CAVALRY]: UnitProficiency.C },
} as unknown as Officer);

console.log('\n=== S10 移动后冲锋验证 ===');

// ---- 纯函数：加成来源叠加 ----
assert(resolveChargeBonus({ unitType: UnitType.LIGHT_INFANTRY, terrain: TerrainType.PLAIN, formation: FormationType.SQUARE }).bonusPct === 0, '非骑兵不触发冲锋');
assert(resolveChargeBonus({ unitType: UnitType.LIGHT_CAVALRY, terrain: TerrainType.PLAIN, formation: FormationType.SQUARE }).bonusPct === 20, '轻骑平原冲锋 +20%');
assert(resolveChargeBonus({ unitType: UnitType.LIGHT_CAVALRY, terrain: TerrainType.FOREST, formation: FormationType.SQUARE }).bonusPct === 0, '森林轻骑无平原加成（pct=0 不触发）');
assert(resolveChargeBonus({ unitType: UnitType.HEAVY_CAVALRY, terrain: TerrainType.PLAIN, formation: FormationType.SQUARE }).bonusPct === 70, '重骑平原 = 平原20 + 兵种50');
assert(resolveChargeBonus({ unitType: UnitType.LIGHT_CAVALRY, terrain: TerrainType.PLAIN, formation: FormationType.CHARGE }).bonusPct === 100, '冲阵轻骑平原 = 平原20 + 阵型80');
assert(resolveChargeBonus({ unitType: UnitType.HEAVY_CAVALRY, terrain: TerrainType.PLAIN, formation: FormationType.CHARGE }).bonusPct === 150, '冲阵重骑平原三源叠加 = 150');
assert(resolveChargeBonus({ unitType: UnitType.LIGHT_CAVALRY, terrain: TerrainType.PLAIN, formation: FormationType.WEDGE }).bonusPct === 70, '锥形轻骑平原 = 平原20 + 突击50（Session 377）');
assert(resolveChargeBonus({ unitType: UnitType.HEAVY_CAVALRY, terrain: TerrainType.PLAIN, formation: FormationType.WEDGE }).bonusPct === 120, '锥形重骑平原三源叠加 = 120');
assert(resolveChargeBonus({ unitType: UnitType.LIGHT_CAVALRY, terrain: TerrainType.FOREST, formation: FormationType.WEDGE }).bonusPct === 50, '森林锥形骑兵仅阵型突击50（无平原来源仍触发）');

assert(applyChargeToBaseDamage(100, 0) === 100, '未触发冲锋原伤害返回');
assert(applyChargeToBaseDamage(100, 20) === 120, '冲锋乘区按百分比放大');
assert(applyChargeToBaseDamage(10, 70) === 17, '冲锋乘区四舍五入且至少为1');

// ---- 连击联动纯函数（骑神）----
const qishen = { ...officer(900, '骑神试将'), uniqueSkill: 'qishen' } as unknown as Officer;
const chainCtx = (isCharging: boolean, formation = FormationType.SQUARE) => ({
  officer: qishen, unitType: UnitType.LIGHT_CAVALRY, formation,
  proficiency: undefined, morale: 80, staminaRatio: 1, movedThisTurn: true, isCharging,
});
assert(Math.abs(computeChainRate(chainCtx(true)) - computeChainRate(chainCtx(false)) - 0.2) < 1e-9, '骑神冲锋连击率恰 +20%');
assert(computeChainCoeff(chainCtx(true, FormationType.CHARGE)) === 0.72, '骑神+冲阵冲锋连击系数 0.72（×1.2）');
assert(computeChainCoeff(chainCtx(true, FormationType.SQUARE)) === 0.6, '骑神非冲阵冲锋连击系数保持 0.6');
assert(computeChainCoeff(chainCtx(false, FormationType.CHARGE)) === 0.6, '骑神未冲锋时冲阵连击系数保持 0.6');

// ---- 敌军 AI 普攻集成（固定 RNG=0.99：不暴击/不反击/不连击，伤害即冲锋乘区结果）----
const aiRun = (type: UnitType, attackerFormation: FormationType, mp: number, map = plainMap) => {
  const cavalry = { ...unit('ai-cav', 'defender', 2, 2, 1000, 2, type), formation: attackerFormation, mp };
  const target = unit('ai-target', 'attacker', 3, 2, 1000, 1);
  const before = target.troopCount;
  const result = runSimpleEnemyAi(
    [cavalry, target],
    map, templates,
    { 1: { war: 70, leadership: 70, name: '目标' }, 2: { war: 80, leadership: 80, name: '突袭敌将' } },
    6, 5, 'defender', 'attacker', () => 0.99,
    {}, { 1: officer(1, '目标'), 2: officer(2, '突袭敌将', 80) }, 2, Weather.CLEAR,
  );
  const loss = before - result.units.find((u) => u.id === 'ai-target')!.troopCount;
  return { loss, message: result.message };
};
const lightStayed = aiRun(UnitType.LIGHT_CAVALRY, FormationType.SQUARE, 3);
const lightMoved = aiRun(UnitType.LIGHT_CAVALRY, FormationType.SQUARE, 0);
assert(lightMoved.message.includes('冲锋') && !lightStayed.message.includes('冲锋'), '轻骑已移动普攻写「冲锋」标签、原地不写');
assert(lightMoved.loss === Math.max(1, Math.round(lightStayed.loss * 1.2)), `轻骑平原冲锋伤害 ×1.2（${lightStayed.loss}→${lightMoved.loss}）`);
const heavyStayed = aiRun(UnitType.HEAVY_CAVALRY, FormationType.SQUARE, 3);
const heavyMoved = aiRun(UnitType.HEAVY_CAVALRY, FormationType.SQUARE, 0);
assert(heavyMoved.message.includes('冲锋'), '重骑已移动普攻写「冲锋」标签');
assert(heavyMoved.loss === Math.max(1, Math.round(heavyStayed.loss * 1.7)), `重骑平原冲锋伤害 ×1.7（${heavyStayed.loss}→${heavyMoved.loss}）`);
const chongzhenStayed = aiRun(UnitType.LIGHT_CAVALRY, FormationType.CHARGE, 3);
const chongzhenMoved = aiRun(UnitType.LIGHT_CAVALRY, FormationType.CHARGE, 0);
assert(chongzhenMoved.message.includes('冲锋'), '冲阵轻骑已移动普攻写「冲锋」标签');
assert(chongzhenMoved.loss === Math.max(1, Math.round(chongzhenStayed.loss * 2)), `冲阵轻骑平原冲锋伤害 ×2.0（${chongzhenStayed.loss}→${chongzhenMoved.loss}）`);
const infantryStayed = aiRun(UnitType.LIGHT_INFANTRY, FormationType.SQUARE, 3);
const infantryMoved = aiRun(UnitType.LIGHT_INFANTRY, FormationType.SQUARE, 0);
assert(!infantryMoved.message.includes('冲锋'), '步兵移动后普攻不触发冲锋');
assert(infantryMoved.loss === infantryStayed.loss, '步兵移动前后伤害一致');
const forestMap = plainMap.map((row, rIdx) => row.map((cell, qIdx) => (qIdx === 2 && rIdx === 2 ? TerrainType.FOREST : cell)));
const forestStayed = aiRun(UnitType.LIGHT_CAVALRY, FormationType.SQUARE, 3, forestMap);
const forestMoved = aiRun(UnitType.LIGHT_CAVALRY, FormationType.SQUARE, 0, forestMap);
assert(!forestMoved.message.includes('冲锋'), '森林骑兵移动后不触发冲锋');
assert(forestMoved.loss === forestStayed.loss, '森林骑兵移动前后伤害一致');

// ---- 玩家 attackUnit 普攻路径集成 ----
createGame(1, 2);
const enemyCity = Object.values(getGame().cities).find((city) => city.ruler !== getGame().playerFactionId);
if (!enemyCity) throw new Error('没有可用于玩家冲锋验证的敌城');
const realBattle = startBattle(enemyCity.id);
const playerAtk = realBattle.units.find((u) => u.side === 'attacker')!;
const playerDef = realBattle.units.find((u) => u.side === 'defender')!;
const flatGrid = {
  ...realBattle.hexGrid,
  terrain: Array.from({ length: realBattle.hexGrid.height }, () =>
    Array.from({ length: realBattle.hexGrid.width }, () => TerrainType.PLAIN)),
};
const playerSnapshot = (mp: number, formation: FormationType) => ({
  ...realBattle,
  weather: Weather.CLEAR,
  phase: 'player' as const,
  hexGrid: flatGrid,
  units: realBattle.units.map((u) => {
    if (u.id === playerAtk.id) {
      return { ...u, unitType: UnitType.LIGHT_CAVALRY, position: { q: 3, r: 2 }, facing: directionTo({ q: 3, r: 2 }, { q: 4, r: 2 }), mp, maxMp: 3, formation, hasActed: false };
    }
    return { ...u, position: { q: 4, r: 2 }, hasActed: true, mp: 0 };
  }),
});
const defBefore = playerSnapshot(0, FormationType.SQUARE).units.find((u) => u.id === playerDef.id)!.troopCount;
const playerStayed = attackUnit(playerSnapshot(3, FormationType.SQUARE), playerAtk.id, playerDef.id, getGame(), () => 0.99);
const lossStayed = defBefore - playerStayed.units.find((u) => u.id === playerDef.id)!.troopCount;
const playerMovedBattle = attackUnit(playerSnapshot(0, FormationType.SQUARE), playerAtk.id, playerDef.id, getGame(), () => 0.99);
const lossMoved = defBefore - playerMovedBattle.units.find((u) => u.id === playerDef.id)!.troopCount;
assert(lossMoved === Math.max(1, Math.round(lossStayed * 1.2)), `玩家轻骑平原冲锋伤害 ×1.2（${lossStayed}→${lossMoved}）`);
assert(playerMovedBattle.message.includes('冲锋'), '玩家冲锋攻击战报含「冲锋」标签');
const chongzhenPlayerStayed = attackUnit(playerSnapshot(3, FormationType.CHARGE), playerAtk.id, playerDef.id, getGame(), () => 0.99);
const chongzhenLossStayed = defBefore - chongzhenPlayerStayed.units.find((u) => u.id === playerDef.id)!.troopCount;
const chongzhenPlayerMoved = attackUnit(playerSnapshot(0, FormationType.CHARGE), playerAtk.id, playerDef.id, getGame(), () => 0.99);
const chongzhenLossMoved = defBefore - chongzhenPlayerMoved.units.find((u) => u.id === playerDef.id)!.troopCount;
assert(chongzhenLossMoved === Math.max(1, Math.round(chongzhenLossStayed * 2)), `玩家冲阵轻骑平原冲锋伤害 ×2.0（${chongzhenLossStayed}→${chongzhenLossMoved}）`);

console.log(`\n${passed} passed, 0 failed`);
if (passed === 0) process.exit(1);
