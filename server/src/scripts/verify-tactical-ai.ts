// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { FormationType, TerrainType, UnitType, Weather, type BattleUnit, type Officer, type UnitTemplate } from '@leh/shared';
import { runSimpleEnemyAi } from '../battle/simpleAi.js';

let passed = 0;
function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`✗ ${label}`);
  passed += 1;
  console.log(`  ✓ ${label}`);
}

const template = (type: UnitType, attack = 7): UnitTemplate => ({
  name: type, type, isSpecial: false, attack, defense: 5, mobility: 3, range: 1,
  traits: [], strongAgainst: [], weakAgainst: [], recruitRequirement: null,
  terrainModifiers: {}, recruitCost: { gold: 0, population: 0, food: 0 }, abilities: [],
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

console.log(`\n=== 结果: ${passed} passed, 0 failed ===`);
