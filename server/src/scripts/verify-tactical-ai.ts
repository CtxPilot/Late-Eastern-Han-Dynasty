// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { directionTo, FormationType, isUnitSurrounded, TerrainType, UnitProficiency, UnitType, Weather, type BattleUnit, type Officer, type UnitTemplate } from '@leh/shared';
import { runSimpleEnemyAi } from '../battle/simpleAi.js';
import { hexDistance } from '../battle/hex.js';
import { effectiveMovement, effectiveUnitRange, hasMovedThisTurn } from '../battle/weather.js';

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
const officer = (id: number, name: string, intelligence: number, fireLevel = 0, merit = 0): Officer => ({
  id, name, stats: { leadership: 80, war: 80, intelligence, politics: 50, charisma: 50 },
  skills: fireLevel ? [{ skillId: 'fire', level: fireLevel }] : [], unitProficiency: {}, merit,
} as unknown as Officer);

console.log('\n=== S10 战术 AI 验证 ===');

assert(effectiveMovement(3, Weather.CLEAR) === 3, '晴天保持基础移动力');
assert(effectiveMovement(3, Weather.RAIN) === 2, '雨天移动力减少1');
assert(effectiveMovement(3, Weather.SNOW) === 1, '雪天移动力减少2');
assert(effectiveUnitRange(3, Weather.CLEAR) === 3, '晴天保持远程兵种射程');
assert(effectiveUnitRange(3, Weather.RAIN) === 2, '雨天一般射程减少1');
assert(effectiveUnitRange(3, Weather.FOG) === 1, '雾天一般射程减少2且保留最低值1');
assert(effectiveUnitRange(3, Weather.SNOW) === 2, '雪天一般射程减少1');
assert(!hasMovedThisTurn(1, 3, Weather.SNOW), '雪天按有效上限恢复后不误判为已移动');
assert(hasMovedThisTurn(0, 3, Weather.SNOW), '雪天实际消耗移动力后标记为已移动');

const forcedMarchOfficer = {
  ...officer(2, '雪地骑将', 50),
  skills: [{ skillId: 'forcedMarch', level: 1 }],
  unitProficiency: { [UnitType.HEAVY_CAVALRY]: UnitProficiency.C },
} as Officer;
const forcedMarchTemplates = {
  ...templates,
  [UnitType.HEAVY_CAVALRY]: template(UnitType.HEAVY_CAVALRY, 7),
  [UnitType.ARCHER]: template(UnitType.ARCHER, 5),
};
const forcedMarchRun = (mp: number) => {
  const rolls = [0.5, 0.99, 0.12, 0.99];
  return runSimpleEnemyAi(
    [{ ...unit('snow-cavalry', 'defender', 2, 2, 1000, 2, UnitType.HEAVY_CAVALRY), mp }, unit('snow-target', 'attacker', 3, 2, 1000, 1, UnitType.ARCHER)],
    terrain,
    forcedMarchTemplates,
    { 1: { war: 70, leadership: 70, name: '目标' }, 2: { war: 80, leadership: 80, name: '雪地骑将' } },
    6, 5, 'defender', 'attacker', () => rolls.shift() ?? 0.99,
    {}, { 1: officer(1, '目标', 50), 2: forcedMarchOfficer }, 2, Weather.SNOW,
  );
};
assert(!forcedMarchRun(1).message.includes('连击'), '雪天原地攻击不误触发强行军连击加成');
assert(forcedMarchRun(0).message.includes('连击'), '雪天实际移动后仍可触发强行军连击加成');

const targetResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('healthy', 'attacker', 1, 2, 1000, 1), unit('weak', 'attacker', 3, 2, 100, 3)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '甲' }, 2: { war: 80, leadership: 80, name: '敌' }, 3: { war: 70, leadership: 70, name: '乙' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
assert(targetResult.units.find((u) => u.id === 'weak')!.troopCount < 100, '同距离时优先击破残兵目标');
assert(targetResult.units.find((u) => u.id === 'healthy')!.troopCount === 1000, '不会机械攻击列表中的首个目标');
assert(targetResult.units.find((u) => u.id === 'enemy')!.hasActed, '敌军普攻后标记已行动');
assert(targetResult.units.find((u) => u.id === 'enemy')!.mp === 0, '敌军普攻后移动力归零');
const movingEnemyResult = runSimpleEnemyAi(
  [unit('moving-enemy', 'defender', 0, 2, 1000, 2), unit('distant-target', 'attacker', 5, 2, 1000, 1)],
  terrain, templates,
  { 1: { war: 70, leadership: 70, name: '远方目标' }, 2: { war: 80, leadership: 80, name: '行军敌将' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('仅走位不应消费攻击 RNG'); },
);
const movingEnemy = movingEnemyResult.units.find((u) => u.id === 'moving-enemy')!;
const distantTarget = movingEnemyResult.units.find((u) => u.id === 'distant-target')!;
assert(movingEnemy.position.q > 0, '敌军走位会向目标推进');
assert(movingEnemy.facing === directionTo(movingEnemy.position, distantTarget.position), '敌军走位后朝向真正目标');

const surroundTarget = unit('surround-target', 'attacker', 3, 3, 1000, 1);
const surroundFront = {
  ...unit('surround-front', 'defender', 3, 2, 1000, 2),
  facing: directionTo({ q: 3, r: 2 }, surroundTarget.position),
};
const surroundFlank = unit('surround-flank', 'defender', 0, 3, 1000, 2);
const surroundResult = runSimpleEnemyAi(
  [surroundTarget, surroundFront, surroundFlank],
  terrain, templates,
  { 1: { war: 70, leadership: 70, name: '被围目标' }, 2: { war: 80, leadership: 80, name: '包围敌军' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
const surroundTargetAfter = surroundResult.units.find((u) => u.id === surroundTarget.id)!;
const surroundFlankAfter = surroundResult.units.find((u) => u.id === surroundFlank.id)!;
assert(surroundResult.message.includes('迂回包抄'), '已有接战方向时敌军优先执行迂回包抄');
assert(hexDistance(surroundFlankAfter.position, surroundTargetAfter.position) === 1, '包抄敌军占据目标另一邻接格');
assert(isUnitSurrounded(surroundResult.units, surroundTarget.id), '敌军协同走位后派生为受围态势');
assert(surroundFlankAfter.facing === directionTo(surroundFlankAfter.position, surroundTargetAfter.position), '包抄走位后朝向目标');

const breakoutEnemy = { ...unit('breakout-enemy', 'defender', 3, 3, 1000, 2), facing: 0 as const };
const breakoutWingA = {
  ...unit('breakout-wing-a', 'attacker', 3, 2, 1000, 1),
  facing: directionTo({ q: 3, r: 2 }, breakoutEnemy.position),
};
const breakoutWingB = {
  ...unit('breakout-wing-b', 'attacker', 4, 3, 1000, 1),
  facing: directionTo({ q: 4, r: 3 }, breakoutEnemy.position),
};
assert(isUnitSurrounded([breakoutEnemy, breakoutWingA, breakoutWingB], breakoutEnemy.id), '突围前敌军确实处于两翼包围');
const breakoutResult = runSimpleEnemyAi(
  [breakoutEnemy, breakoutWingA, breakoutWingB], terrain, templates,
  { 1: { war: 70, leadership: 70, name: '包围我军' }, 2: { war: 80, leadership: 80, name: '突围敌将' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
const breakoutAfter = breakoutResult.units.find((u) => u.id === breakoutEnemy.id)!;
assert(breakoutResult.message.includes('突围走位'), '受围敌军优先写入突围走位战报');
assert(breakoutAfter.position.q !== 3 || breakoutAfter.position.r !== 3, '受围敌军离开原包围中心');
assert(!isUnitSurrounded(breakoutResult.units, breakoutEnemy.id), '突围走位后解除派生包围');

const moraleRetreatEnemy = { ...unit('morale-retreat-enemy', 'defender', 2, 2, 1000, 2), morale: 20 };
const moraleRetreatResult = runSimpleEnemyAi(
  [moraleRetreatEnemy, unit('retreat-target', 'attacker', 5, 2, 1000, 1)], terrain, templates,
  { 1: { war: 70, leadership: 70, name: '追击目标' }, 2: { war: 80, leadership: 80, name: '低士气守将' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('主动撤退不应消费 RNG'); },
);
assert(moraleRetreatResult.message.includes('低士气守将 撤退'), '低士气敌军优先主动撤退');
assert(moraleRetreatResult.over && moraleRetreatResult.winner === 'attacker', '敌军全数撤退后判定我军胜利');
assert(moraleRetreatResult.units.find((u) => u.id === moraleRetreatEnemy.id)?.isRetreated === true, '主动撤退复用既有 isRetreated 终态');

const troopRetreatEnemy = { ...unit('troop-retreat-enemy', 'defender', 2, 2, 250, 2), morale: 80 };
const troopRetreatResult = runSimpleEnemyAi(
  [troopRetreatEnemy, unit('troop-retreat-target', 'attacker', 5, 2, 1000, 1)], terrain, templates,
  { 1: { war: 70, leadership: 70, name: '残兵目标' }, 2: { war: 80, leadership: 80, name: '残兵守将' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('重创撤退不应消费 RNG'); },
);
assert(troopRetreatResult.units.find((u) => u.id === troopRetreatEnemy.id)?.isRetreated === true, '兵力降至25%时敌军主动撤退');

const interceptedRetreatEnemy = { ...unit('intercepted-retreat-enemy', 'defender', 2, 2, 1000, 2), morale: 20 };
const interceptor = unit('interceptor', 'attacker', 3, 2, 1000, 1);
const interceptedRetreatResult = runSimpleEnemyAi(
  [interceptedRetreatEnemy, interceptor], terrain, templates,
  { 1: { war: 70, leadership: 70, name: '截击将' }, 2: { war: 80, leadership: 80, name: '被截低士气守将' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
assert(interceptedRetreatResult.message.includes('被截击'), '相邻我军存在时敌军主动撤退先写入截击战报');
assert(interceptedRetreatResult.units.find((u) => u.id === interceptedRetreatEnemy.id)?.isRetreated === false, '被相邻我军截击的敌军不能瞬时撤退');
assert(interceptedRetreatResult.units.find((u) => u.id === interceptedRetreatEnemy.id)?.hasActed === true, '被截击敌军继续既有接战链并结束行动');
assert(interceptedRetreatResult.message.includes('追击'), '被截击时追加一次追击伤害');
assert((interceptedRetreatResult.units.find((u) => u.id === interceptedRetreatEnemy.id)?.troopCount ?? 1000) < 1000, '追击削减被截单位兵力（0.6 系数，中位值，不消费 RNG）');
assert((interceptedRetreatResult.units.find((u) => u.id === interceptedRetreatEnemy.id)?.morale ?? 20) < 20, '追击附加士气 -2');

// 极残血被截击时追击可直接溃灭
const fragileIntercepted = { ...unit('fragile-intercepted', 'defender', 2, 2, 5, 2), morale: 20 };
const fragileResult = runSimpleEnemyAi(
  [fragileIntercepted, unit('fragile-interceptor', 'attacker', 3, 2, 1000, 1)], terrain, templates,
  { 1: { war: 80, leadership: 80, name: '强截击将' }, 2: { war: 70, leadership: 70, name: '残血被截将' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
assert(fragileResult.message.includes('追击'), '残血被截击仍触发追击');
assert(fragileResult.units.find((u) => u.id === fragileIntercepted.id)?.isDestroyed === true, '追击可致残血被截单位直接溃灭');
assert(fragileResult.units.find((u) => u.id === fragileIntercepted.id)?.isRetreated === false, '被追击溃灭的单位不再标记撤退');

const interceptionPriorityTemplates = {
  ...templates,
  [UnitType.HEAVY_INFANTRY]: template(UnitType.HEAVY_INFANTRY, 1),
  [UnitType.SPEARMAN]: template(UnitType.SPEARMAN, 120),
};
const interceptionPriorityEnemy = { ...unit('interception-priority-enemy', 'defender', 2, 2, 1000, 2), morale: 20 };
const interceptionPriorityResult = runSimpleEnemyAi(
  [
    interceptionPriorityEnemy,
    unit('adjacent-interceptor', 'attacker', 3, 2, 1000, 1, UnitType.HEAVY_INFANTRY),
    unit('distant-high-threat', 'attacker', 4, 2, 1000, 3, UnitType.SPEARMAN),
  ], terrain, interceptionPriorityTemplates,
  { 1: { war: 70, leadership: 70, name: '相邻截击者' }, 2: { war: 80, leadership: 80, name: '被截敌将' }, 3: { war: 70, leadership: 70, name: '远处高威胁' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
assert(interceptionPriorityResult.message.includes('攻击 相邻截击者'), '截击时优先攻击相邻截击者而非远处高威胁目标');
assert(interceptionPriorityResult.units.find((u) => u.id === 'adjacent-interceptor')!.troopCount < 1000, '截击者确实承受被截后的反击');
assert(interceptionPriorityResult.units.find((u) => u.id === 'distant-high-threat')!.troopCount === 1000, '截击优先级不波及远处目标');

const surroundedRetreatEnemy = { ...unit('surrounded-retreat-enemy', 'defender', 3, 3, 1000, 2), morale: 20, facing: 0 as const };
const surroundedRetreatWingA = {
  ...unit('surrounded-retreat-wing-a', 'attacker', 3, 2, 1000, 1),
  facing: directionTo({ q: 3, r: 2 }, surroundedRetreatEnemy.position),
};
const surroundedRetreatWingB = {
  ...unit('surrounded-retreat-wing-b', 'attacker', 4, 3, 1000, 1),
  facing: directionTo({ q: 4, r: 3 }, surroundedRetreatEnemy.position),
};
const surroundedRetreatResult = runSimpleEnemyAi(
  [surroundedRetreatEnemy, surroundedRetreatWingA, surroundedRetreatWingB], terrain, templates,
  { 1: { war: 70, leadership: 70, name: '包围我军' }, 2: { war: 80, leadership: 80, name: '受围低士气敌将' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
assert(surroundedRetreatResult.units.find((u) => u.id === surroundedRetreatEnemy.id)?.isRetreated === false, '受围低士气敌军不会跳过包围态势直接撤退');
assert(surroundedRetreatResult.message.includes('突围走位'), '受围低士气敌军先沿既有突围逻辑行动');

const withdrawnEnemy = { ...unit('withdrawn-enemy', 'defender', 2, 2, 1000, 2), isRetreated: true };
const withdrawnEnemyResult = runSimpleEnemyAi(
  [withdrawnEnemy, unit('active-target', 'attacker', 3, 2, 1000, 1)], terrain, templates,
  { 1: { war: 70, leadership: 70, name: '目标' }, 2: { war: 80, leadership: 80, name: '已撤敌将' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('撤退敌军不应消费 RNG'); },
);
assert(withdrawnEnemyResult.over && withdrawnEnemyResult.winner === 'attacker', '敌军仅剩撤退单位时判定我军胜利');
assert(withdrawnEnemyResult.units.find((u) => u.id === withdrawnEnemy.id)?.isRetreated === true, '敌军撤退快照保持原标记');

const withdrawnPlayer = { ...unit('withdrawn-player', 'attacker', 3, 2, 1000, 1), isRetreated: true };
const withdrawnPlayerResult = runSimpleEnemyAi(
  [unit('active-enemy', 'defender', 2, 2, 1000, 2), withdrawnPlayer], terrain, templates,
  { 1: { war: 70, leadership: 70, name: '已撤我军' }, 2: { war: 80, leadership: 80, name: '敌将' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('敌军已无活跃目标时不应消费 RNG'); },
);
assert(withdrawnPlayerResult.over && withdrawnPlayerResult.winner === 'defender', '我军仅剩撤退单位时判定敌军胜利');

const withdrawnTarget = { ...unit('a-retreated-target', 'attacker', 3, 2, 1000, 1), isRetreated: true };
const activeTarget = unit('b-active-target', 'attacker', 2, 3, 1000, 1);
const withdrawnTargetResult = runSimpleEnemyAi(
  [unit('targeting-enemy', 'defender', 2, 2, 1000, 2), withdrawnTarget, activeTarget], terrain, templates,
  { 1: { war: 70, leadership: 70, name: '我军' }, 2: { war: 80, leadership: 80, name: '敌将' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
assert(withdrawnTargetResult.units.find((u) => u.id === withdrawnTarget.id)?.troopCount === withdrawnTarget.troopCount, '敌军不会攻击已撤退目标');
assert(withdrawnTargetResult.units.find((u) => u.id === activeTarget.id)!.troopCount < activeTarget.troopCount, '敌军会改选仍在场的活跃目标');

const replayResult = runSimpleEnemyAi(
  targetResult.units, terrain, templates,
  { 1: { war: 70, leadership: 70, name: '甲' }, 2: { war: 80, leadership: 80, name: '敌' }, 3: { war: 70, leadership: 70, name: '乙' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('已行动敌军不应再次消费 RNG'); },
);
assert(replayResult.message === '敌军待机', '已行动敌军重入 AI 时保持待机');
assert(replayResult.units.find((u) => u.id === 'weak')!.troopCount === targetResult.units.find((u) => u.id === 'weak')!.troopCount, 'AI 重入不重复结算伤害');

const blockedUnits = [
  unit('blocked-enemy', 'defender', 2, 2, 1000, 2),
  unit('blocked-target', 'attacker', 4, 2, 1000, 1),
  { ...unit('block-a', 'defender', 3, 2, 1000, 2), hasActed: true, mp: 0 },
  { ...unit('block-b', 'defender', 1, 2, 1000, 2), hasActed: true, mp: 0 },
  { ...unit('block-c', 'defender', 2, 1, 1000, 2), hasActed: true, mp: 0 },
  { ...unit('block-d', 'defender', 2, 3, 1000, 2), hasActed: true, mp: 0 },
  { ...unit('block-e', 'defender', 1, 3, 1000, 2), hasActed: true, mp: 0 },
  { ...unit('block-f', 'defender', 3, 1, 1000, 2), hasActed: true, mp: 0 },
];
const blockedResult = runSimpleEnemyAi(
  blockedUnits, terrain, templates,
  { 1: { war: 70, leadership: 70, name: '目标' }, 2: { war: 80, leadership: 80, name: '受阻敌军' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('被阻挡待机不应消费攻击 RNG'); },
);
assert(blockedResult.message.includes('无法接近目标'), '完全阻挡时敌军写入待机战报');
assert(blockedResult.units.find((u) => u.id === 'blocked-enemy')!.hasActed, '完全阻挡时敌军结束本回合行动');
assert(blockedResult.units.find((u) => u.id === 'blocked-enemy')!.mp === 0, '完全阻挡时敌军移动力归零');
const blockedReplay = runSimpleEnemyAi(
  blockedResult.units, terrain, templates,
  { 1: { war: 70, leadership: 70, name: '目标' }, 2: { war: 80, leadership: 80, name: '受阻敌军' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('完全阻挡的敌军不应重入行动'); },
);
assert(blockedReplay.message === '敌军待机', '完全阻挡敌军重入时保持待机');

const missingTemplateUnit = unit('missing-template', 'defender', 2, 2, 1000, 2, 'missing-unit' as UnitType);
const missingTemplateResult = runSimpleEnemyAi(
  [missingTemplateUnit, unit('template-target', 'attacker', 4, 2, 1000, 1)], terrain, templates,
  { 1: { war: 70, leadership: 70, name: '目标' }, 2: { war: 80, leadership: 80, name: '残缺敌军' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('缺失兵种模板待机不应消费 RNG'); },
);
assert(missingTemplateResult.message.includes('兵种数据缺失'), '缺失兵种模板时敌军写入异常待机战报');
assert(missingTemplateResult.units.find((u) => u.id === 'missing-template')!.hasActed, '缺失兵种模板时结束敌军行动');

const plainDefenseResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '甲' }, 2: { war: 80, leadership: 80, name: '敌' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
const armoredDefenseResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '甲', armorDefense: 100 }, 2: { war: 80, leadership: 80, name: '敌' } },
  6, 5, 'defender', 'attacker', () => 0.5,
);
assert(armoredDefenseResult.units.find((u) => u.id === 'player')!.troopCount > plainDefenseResult.units.find((u) => u.id === 'player')!.troopCount, '敌军 AI 普攻读取守方装备护甲减伤');

const clearWeatherResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '甲' }, 2: { war: 80, leadership: 80, name: '敌' } },
  6, 5, 'defender', 'attacker', () => 0.5, {}, undefined, 1, Weather.CLEAR,
);
const snowWeatherResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '甲' }, 2: { war: 80, leadership: 80, name: '敌' } },
  6, 5, 'defender', 'attacker', () => 0.5, {}, undefined, 1, Weather.SNOW,
);
assert(snowWeatherResult.units.find((u) => u.id === 'player')!.troopCount > clearWeatherResult.units.find((u) => u.id === 'player')!.troopCount, '雪天同时降低敌军攻击并提高守方防御');

const plainCritOfficer = officer(2, '无装敌将', 50);
const equippedCritOfficer = { ...plainCritOfficer, name: '装备敌将', equipment: { weaponPrimary: 1 } } as Officer;
const rangedTemplates = { ...templates, [UnitType.ARCHER]: template(UnitType.ARCHER, 5) };
const plainCritResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1, UnitType.ARCHER)],
  terrain, rangedTemplates, { 1: { war: 70, leadership: 70, name: '前锋' }, 2: { war: 80, leadership: 80, name: '无装敌将' } },
  6, 5, 'defender', 'attacker', () => 0.08, {}, { 1: officer(1, '前锋', 50), 2: plainCritOfficer }, 1, Weather.CLEAR,
);
const equippedCritResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1, UnitType.ARCHER)],
  terrain, rangedTemplates, { 1: { war: 70, leadership: 70, name: '前锋' }, 2: { war: 80, leadership: 80, name: '装备敌将' } },
  6, 5, 'defender', 'attacker', () => 0.08, {}, { 1: officer(1, '前锋', 50), 2: equippedCritOfficer }, 1, Weather.CLEAR,
);
assert(!plainCritResult.message.includes('暴击'), '敌军 AI 普攻未装备宝物时不虚增暴击');
assert(equippedCritResult.message.includes('暴击'), '敌军 AI 普攻读取装备暴击率');

const fireOfficers = { 1: officer(1, '守将', 55), 2: officer(2, '军师', 98, 5) };
const fireResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 3000, 1)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '守将' }, 2: { war: 70, leadership: 80, name: '军师' } },
  6, 5, 'defender', 'attacker', () => 0, {}, fireOfficers, 1, Weather.CLEAR,
);
assert(fireResult.message.includes('火计'), '高智火计将会主动施放火计');
assert(fireResult.units.find((u) => u.id === 'enemy')!.energy === 70, '火计消耗30气力');
assert(fireResult.units.find((u) => u.id === 'enemy')!.hasActed, '敌军火计后标记已行动');
assert(fireResult.units.find((u) => u.id === 'player')!.statusEffects.some((e) => e.type === 'burn'), '成功火计附加灼烧');

const snowResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, templates, { 1: { war: 70, leadership: 70, name: '守将' }, 2: { war: 70, leadership: 80, name: '军师' } },
  6, 5, 'defender', 'attacker', () => 0.5, {}, fireOfficers, 1, Weather.SNOW,
);
assert(!snowResult.message.includes('火计'), '雪天遵守禁用火计规则');

const fogArcherTemplates = { ...templates, [UnitType.ARCHER]: { ...template(UnitType.ARCHER, 5), range: 3 } };
const fogArcherResult = runSimpleEnemyAi(
  [unit('enemy-archer', 'defender', 2, 2, 1000, 2, UnitType.ARCHER), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, fogArcherTemplates,
  { 1: { war: 70, leadership: 70, name: '前锋' }, 2: { war: 80, leadership: 80, name: '雾中弓将' } },
  6, 5, 'defender', 'attacker', () => { throw new Error('雾天弓兵不应消费攻击 RNG'); },
  {}, undefined, 1, Weather.FOG,
);
assert(fogArcherResult.units.find((u) => u.id === 'player')!.troopCount === 1000, '雾天弓兵不可射击');
assert(fogArcherResult.message.includes('雾中无法射击'), '雾天弓兵写入待机战报');
assert(fogArcherResult.units.find((u) => u.id === 'enemy-archer')!.hasActed, '雾天弓兵仍结束本回合行动');

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
assert(abilityResult.units.find((u) => u.id === 'enemy')!.hasActed, '敌军战法后标记已行动');
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

const specialWithdrawnNearby = { ...unit('withdrawn-nearby', 'attacker', 3, 3, 1000, 3), isRetreated: true };
const specialWithdrawnResult = runSimpleEnemyAi(
  [unit('enemy-withdrawn-check', 'defender', 2, 2, 1000, 2), unit('active-aoe-target', 'attacker', 3, 2, 1000, 1), specialWithdrawnNearby],
  terrain, specialTemplates, { 1: { war: 70, leadership: 70, name: '活跃目标' }, 2: { war: 70, leadership: 80, name: '精锐将' }, 3: { war: 70, leadership: 70, name: '已撤旁军' } },
  6, 5, 'defender', 'attacker', () => 0, {}, specialOfficers, 1, Weather.CLEAR,
);
assert(specialWithdrawnResult.units.find((u) => u.id === specialWithdrawnNearby.id)!.troopCount === specialWithdrawnNearby.troopCount, 'AOE 战法不会波及已撤退部队');
assert(specialWithdrawnResult.units.find((u) => u.id === 'active-aoe-target')!.troopCount < 1000, 'AOE 战法仍会命中活跃目标');

const meritAbilityOfficers = {
  1: officer(1, '前锋', 50),
  2: { ...officer(2, '百战将', 50, 0, 32000), unitProficiency: { [UnitType.LIGHT_INFANTRY]: UnitProficiency.A } } as Officer,
};
const meritAbilityResult = runSimpleEnemyAi(
  [unit('enemy', 'defender', 2, 2, 1000, 2), unit('player', 'attacker', 3, 2, 1000, 1)],
  terrain, specialTemplates, { 1: { war: 70, leadership: 70, name: '前锋' }, 2: { war: 70, leadership: 80, name: '百战将' } },
  6, 5, 'defender', 'attacker', () => 0, {}, meritAbilityOfficers, 1, Weather.CLEAR,
);
assert(meritAbilityResult.message.includes('试箭雨'), '敌军 AI 复用功绩 Lv14 适性升档');

const siegeTemplates = {
  ...templates,
  [UnitType.HEAVY_CAVALRY]: template(UnitType.HEAVY_CAVALRY, 30),
};
const siegeRetreaterBase = { ...unit('siege-retreater', 'defender', 2, 2, 1000, 2), morale: 20 };
const siegeInterceptorUnit = unit('siege-interceptor', 'attacker', 3, 2, 1000, 1, UnitType.HEAVY_CAVALRY);
const noSiegePursuitResult = runSimpleEnemyAi(
  [siegeRetreaterBase, siegeInterceptorUnit], terrain, siegeTemplates,
  { 1: { war: 70, leadership: 70, name: '截击将' }, 2: { war: 70, leadership: 70, name: '守城将' } },
  6, 5, 'defender', 'attacker', () => 0.5, {}, undefined, 1, Weather.CLEAR, false,
);
const siegePursuitResult = runSimpleEnemyAi(
  [{ ...unit('siege-retreater', 'defender', 2, 2, 1000, 2), morale: 20 }, siegeInterceptorUnit], terrain, siegeTemplates,
  { 1: { war: 70, leadership: 70, name: '截击将' }, 2: { war: 70, leadership: 70, name: '守城将' } },
  6, 5, 'defender', 'attacker', () => 0.5, {}, undefined, 1, Weather.CLEAR, true,
);
const noSiegeTroops = noSiegePursuitResult.units.find((u) => u.id === 'siege-retreater')!.troopCount;
const siegeTroops = siegePursuitResult.units.find((u) => u.id === 'siege-retreater')!.troopCount;
assert(noSiegeTroops < siegeTroops, '攻城守军追击承受的伤害降低（守城防御 +3 生效）');
assert(siegePursuitResult.message.includes('追击'), '攻城时被截击仍触发追击');

console.log(`\n=== 结果: ${passed} passed, 0 failed ===`);
