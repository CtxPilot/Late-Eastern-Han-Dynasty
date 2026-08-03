// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { FormationType, TerrainType, UnitProficiency, UnitType, Weather, type BattleUnit, type Officer, type UnitTemplate } from '@leh/shared';
import { runSimpleEnemyAi } from '../battle/simpleAi.js';

let passed = 0;
function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`✗ ${label}`);
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const template = (type: UnitType, attack = 7, abilities: UnitTemplate['abilities'] = []): UnitTemplate => ({
  name: type, type, isSpecial: false, attack, defense: 5, mobility: 3, range: 1,
  traits: [], strongAgainst: [], weakAgainst: [], recruitRequirement: null, abilities,
  terrainModifiers: {}, recruitCost: { gold: 0, population: 0, food: 0 },
});
const templates: Record<string, UnitTemplate> = {
  [UnitType.LIGHT_INFANTRY]: template(UnitType.LIGHT_INFANTRY, 5),
  [UnitType.HEAVY_INFANTRY]: template(UnitType.HEAVY_INFANTRY, 9),
  [UnitType.SPEARMAN]: template(UnitType.SPEARMAN, 8),
};
const terrain = Array.from({ length: 5 }, () => Array.from({ length: 6 }, () => TerrainType.PLAIN));
const unit = (id: string, side: 'attacker' | 'defender', q: number, r: number, troops: number, commanderId: number, type = UnitType.LIGHT_INFANTRY): BattleUnit => ({
  id, armyId: id, commanderId, commanderName: id, factionId: side === 'attacker' ? 1 : 2,
  side, unitType: type, formation: FormationType.SQUARE, troopCount: troops, maxTroops: 1000,
  morale: 80, food: 1000, position: { q, r }, mp: 3, maxMp: 3, energy: 100, maxEnergy: 100,
  hasActed: false, isRetreated: false, isDestroyed: false, statusEffects: [],
});
const officer = (id: number, name: string, intelligence: number, fireLevel = 0): Officer => ({
  id, name, stats: { leadership: 80, war: 80, intelligence, politics: 50, charisma: 50 },
  skills: fireLevel ? [{ skillId: 'fire', level: fireLevel }] : [], unitProficiency: {},
} as unknown as Officer);

console.log('\n=== S10 战术 AI 验证 ===');

const targetResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('healthy', 'attacker', 1, 2, 1000, 1), unit('weak', 'attacker', 3, 2, 100, 3)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '甲' }, 2: { war: 80, leadership: 80, name: '敌' }, 3: { war: 70, leadership: 70, name: '乙' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
assert(targetResult.units.find((u) => u.id === 'weak')!.troopCount < 100, '同距离时优先击破残兵目标');
assert(targetResult.units.find((u) => u.id === 'healthy')!.troopCount === 1000, '不会机械攻击列表中的首个目标');

const fireOfficers = { 1: officer(1, '守将', 55), 2: officer(2, '军师', 98, 5) };
const fireResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 3000, 1)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '守将' }, 2: { war: 70, leadership: 80, name: '军师' } },
  6, 5, 'defender', 'attacker', () => 0, {}, fireOfficers, 1, Weather.CLEAR,
);
assert(fireResult.message.includes('火计'), '高智火计将会主动施放火计');
assert(fireResult.units.find((u) => u.id === 'enemy')!.energy === 70, '火计消耗30气力');
assert(fireResult.units.find((u) => u.id === 'player')!.statusEffects.some((e) => e.type === 'burn'), '成功火计附加灼烧');

const snowResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '守将' }, 2: { war: 70, leadership: 80, name: '军师' } },
  6, 5, 'defender', 'attacker', () => 0.5, {}, fireOfficers, 1, Weather.SNOW,
);
assert(!snowResult.message.includes('火计'), '雪天遵守禁用火计规则');

const ability = {
  id: 'test_strike', name: '试锋', description: 'test', leveling: 'leveled' as const,
  perLevel: [{ level: 1, energyCost: 20, power: 1.5, hitRateBonus: 10, requiredProficiency: UnitProficiency.C }],
  specialEffect: 'stun' as const, effectValue: 2, minRange: 1, maxRange: 1, coopAllowed: false,
};
const abilityTemplates = { ...templates, [UnitType.LIGHT_INFANTRY]: template(UnitType.LIGHT_INFANTRY, 5, [ability]) };
const abilityOfficers = { 1: officer(1, '前锋', 50), 2: { ...officer(2, '守将', 50), unitProficiency: { [UnitType.LIGHT_INFANTRY]: UnitProficiency.S } } as Officer };
const abilityResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, abilityTemplates, { 1: { war: 70, leadership: 70, name: '前锋' }, 2: { war: 70, leadership: 80, name: '守将' } },
  6, 5, 'defender', 'attacker', () => 0, {}, abilityOfficers, 1, Weather.CLEAR,
);
assert(abilityResult.message.includes('试锋'), '敌军会按适性主动施放兵种战法');
assert(abilityResult.units.find((u) => u.id === 'enemy')!.energy === 80, '敌军战法消耗对应气力');
assert(abilityResult.units.find((u) => u.id === 'player')!.statusEffects.some((e) => e.type === 'stun'), '敌军战法保留状态效果');

let missRolls = 0;
const missResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, abilityTemplates, { 1: { war: 70, leadership: 70, name: '前锋' }, 2: { war: 70, leadership: 80, name: '守将' } },
  6, 5, 'defender', 'attacker', () => { missRolls += 1; return 0.99; }, {}, abilityOfficers, 1, Weather.CLEAR,
);
assert(missResult.message.includes('失手'), '战法命中失败会结束该部队行动');
assert(missRolls === 1, '战法失手只消费命中 RNG，不提前消费伤害 RNG');

const fireAbility = { ...ability, id: 'test_fire', name: '试火', specialEffect: 'fire' as const };
const fireAbilityTemplates = { ...templates, [UnitType.LIGHT_INFANTRY]: template(UnitType.LIGHT_INFANTRY, 5, [fireAbility]) };
const fireAbilityResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, fireAbilityTemplates, { 1: { war: 70, leadership: 70, name: '前锋' }, 2: { war: 70, leadership: 80, name: '守将' } },
  6, 5, 'defender', 'attacker', () => 0, {}, abilityOfficers, 1, Weather.CLEAR,
);
assert(fireAbilityResult.units.find((u) => u.id === 'player')!.statusEffects.some((e) => e.type === 'burn'), '敌军 fire 战法与玩家路径统一落成 burn 灼烧');

const noProficiencyResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, fireAbilityTemplates, { 1: { war: 70, leadership: 70, name: '前锋' }, 2: { war: 70, leadership: 80, name: '守将' } },
  6, 5, 'defender', 'attacker', () => 0, {}, { 1: officer(1, '前锋', 50), 2: officer(2, '守将', 50) }, 1, Weather.CLEAR,
);
assert(!noProficiencyResult.message.includes('试火'), 'NONE 适性敌军不会施放 proficiency 战法');
assert(!noProficiencyResult.units.find((u) => u.id === 'player')!.statusEffects.some((e) => e.type === 'burn'), 'NONE 适性保持普通行动，不产生战法灼烧');

const specialAbility = {
  id: 'test_volley', name: '试箭雨', description: 'test', leveling: 'proficiency' as const,
  energyCost: 30, basePower: 1.0, maxPower: 2.0, hitRateBonus: 5,
  specialEffect: 'aoe' as const, minRange: 1, maxRange: 3, coopAllowed: false,
};
const specialTemplates = {
  ...templates,
  [UnitType.LIGHT_INFANTRY]: template(UnitType.LIGHT_INFANTRY, 5, [specialAbility]),
};
const specialOfficers = {
  1: officer(1, '箭手', 50),
  2: { ...officer(2, '精锐将', 50), unitProficiency: { [UnitType.LIGHT_INFANTRY]: UnitProficiency.S } } as Officer,
  3: officer(3, '旁军', 50),
};
const specialResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1), unit('nearby', 'attacker', 3, 3, 1000, 3)],
  terrain, specialTemplates, { 1: { war: 70, leadership: 70, name: '箭手' }, 2: { war: 70, leadership: 80, name: '精锐将' }, 3: { war: 70, leadership: 70, name: '旁军' } },
  6, 5, 'defender', 'attacker', () => 0, {}, specialOfficers, 1, Weather.CLEAR,
);
assert(specialResult.message.includes('试箭雨'), '特殊兵种可按适性施放 proficiency 战法');
assert(specialResult.message.includes('波及1队'), 'aoe 战法会命中目标周围的第二支敌军');
assert(specialResult.units.find((u) => u.id === 'nearby')!.troopCount < 1000, '范围战法对邻格目标造成溅射伤害');
assert(specialResult.units.find((u) => u.id === 'enemy')!.energy === 70, '特殊战法消耗静态气力');

console.log(`\n=== 结果: ${passed} passed, 0 failed ===`);
