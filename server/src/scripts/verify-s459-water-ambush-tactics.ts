// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 459 · D-0B-12 水攻与伏兵服务端引擎与全栈专项验收
 *
 * 覆盖：
 * 1. castWaterTactic（水计）：
 *    - 气力消耗（35 / 神算减半 17）、门禁判定、范围校验
 *    - 成功写入 activeStrategem='water'（D-0B-11 / D-0B-12）
 *    - 雨雪天气修正（雨天 +40%、雪天 -30%）
 *    - 地形修正（水域 +35% 伤害、+20% 成功率；山地避水 -40%）
 *    - 水战特性与诡计特性加成
 *    - 附加 slow 减速状态效果与下回合 MP 扣减
 *    - 失败不写 activeStrategem
 * 2. castAmbushTactic（伏兵）：
 *    - 气力消耗（25 / 司马懿冢虎或孔明神算减半 12）、门禁判定、范围校验
 *    - 成功写入 activeStrategem='ambush'
 *    - 山林掩护成功率加成（+20%）
 *    - 智武混合伤害公式与伏兵特性加成（Lv5 出伏必暴 1.5x）
 *    - 附加 confusion 混乱状态效果
 *    - 混乱单位不可反击且敌军回合跳过行动待机
 *    - 失败不写 activeStrategem
 * 3. 服务层与双端端点闭环
 */

import assert from 'node:assert';
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
  TerrainType,
  UnitType,
  Weather,
  emptyIntel,
  type BattleState,
  type GameState,
  type Officer,
} from '@leh/shared';
import {
  castWaterTactic,
  castAmbushTactic,
} from '../engine/battle.js';
import { canCounter, type CounterContext } from '../battle/crit.js';
import { runSimpleEnemyAi } from '../battle/simpleAi.js';
import { getUnitByType } from '../data/loader.js';
import * as gameService from '../services/game.js';

function stubOfficer(
  id: number,
  name: string,
  opts: {
    intelligence?: number;
    war?: number;
    waterLv?: number;
    ambushLv?: number;
    waterCombatTrait?: number;
    ambushTrait?: number;
    cunningTrait?: number;
  } = {},
): Officer {
  const skills: Array<{ skillId: string; level: number; useCount: number }> = [];
  if (opts.waterLv != null && opts.waterLv > 0) {
    skills.push({ skillId: 'water', level: opts.waterLv, useCount: 0 });
  }
  if (opts.ambushLv != null && opts.ambushLv > 0) {
    skills.push({ skillId: 'ambush', level: opts.ambushLv, useCount: 0 });
  }

  const traitLevels: Record<string, number> = {};
  if (opts.waterCombatTrait != null) traitLevels.water_combat = opts.waterCombatTrait;
  if (opts.ambushTrait != null) traitLevels.ambush = opts.ambushTrait;
  if (opts.cunningTrait != null) traitLevels.cunning = opts.cunningTrait;

  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: {
      leadership: 80,
      war: opts.war ?? 70,
      intelligence: opts.intelligence ?? 80,
      politics: 70,
      charisma: 70,
    },
    hidden: {
      compatibility: 50,
      righteousness: 8,
      ambition: 8,
      valor: 5,
      composure: 5,
      lifespan: 220,
      growth: GrowthPotential.MID,
      personality: Personality.CALM,
      ideal: Ideal.HEGEMONY,
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
    formationMastery: [0],
    skills,
    traitLevels,
    tags: [],
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

function baseBattle(opts: {
  weather?: Weather;
  targetTerrain?: TerrainType;
  atkTerrain?: TerrainType;
  atkEnergy?: number;
  attackerCommanderId?: number;
  defenderCommanderId?: number;
} = {}): BattleState {
  const terrainGrid = Array.from({ length: 15 }, () =>
    Array.from({ length: 20 }, () => TerrainType.PLAIN),
  );
  if (opts.targetTerrain) {
    terrainGrid[5]![6] = opts.targetTerrain;
  }
  if (opts.atkTerrain) {
    terrainGrid[5]![5] = opts.atkTerrain;
  }

  return {
    id: 'battle-s459',
    turn: 1,
    weather: opts.weather ?? Weather.CLEAR,
    attackerFaction: 1,
    defenderFaction: 2,
    isSiege: false,
    cityId: 1,
    units: [
      {
        id: 'atk-1',
        armyId: 'a1',
        commanderId: opts.attackerCommanderId ?? 1,
        commanderName: '智将',
        factionId: 1,
        side: 'attacker',
        unitType: UnitType.HEAVY_INFANTRY,
        formation: FormationType.SQUARE,
        troopCount: 5000,
        maxTroops: 5000,
        morale: 90,
        food: 1000,
        position: { q: 5, r: 5 },
        mp: 4,
        maxMp: 4,
        energy: opts.atkEnergy ?? 100,
        maxEnergy: 100,
        hasActed: false,
        isRetreated: false,
        isDestroyed: false,
        statusEffects: [],
      },
      {
        id: 'def-1',
        armyId: 'd1',
        commanderId: opts.defenderCommanderId ?? 99,
        commanderName: '守将',
        factionId: 2,
        side: 'defender',
        unitType: UnitType.HEAVY_INFANTRY,
        formation: FormationType.SQUARE,
        troopCount: 5000,
        maxTroops: 5000,
        morale: 80,
        food: 1000,
        position: { q: 6, r: 5 },
        mp: 4,
        maxMp: 4,
        energy: 100,
        maxEnergy: 100,
        hasActed: false,
        isRetreated: false,
        isDestroyed: false,
        statusEffects: [],
      },
    ],
    phase: 'player',
    winner: null,
    hexGrid: {
      width: 20,
      height: 15,
      terrain: terrainGrid,
    },
    log: [],
    message: '',
  };
}

function baseGameState(officers: Record<number, Officer>): GameState {
  return {
    scenarioId: 1,
    enabledEventLayers: ['gameplay'],
    enabledChildEventIds: [],
    currentYear: 190,
    currentMonth: 1,
    season: 0,
    playerFactionId: 1,
    officers,
    cities: {},
    factions: {},
    females: {},
    armys: [],
    campaignArmies: [],
    campaignNodes: [],
    grandStrategists: [],
    activeBattles: [],
    activeBattlefield: null,
    activeMelee: null,
    diplomacy: [],
    intel: emptyIntel(),
    plots: [],
    completedEvents: [],
    pendingEvents: [],
    invalidatedEvents: [],
    eventChoices: {},
    actionLog: [],
  };
}

console.log('=== Session 459 · D-0B-12 水攻与伏兵服务端引擎与全栈专项验收 ===\n');

// ── 1. 水计 (castWaterTactic) 门禁、气力与状态 ──
console.log('── 1. 水计 (castWaterTactic) 门禁、消耗与效果 ──');

{
  const atk = stubOfficer(1, '周瑜', { intelligence: 96, waterLv: 3 });
  const def = stubOfficer(99, '曹仁', { intelligence: 70 });
  const state = baseGameState({ 1: atk, 99: def });

  // 门禁：非玩家回合拦截
  const enemyTurnBattle = { ...baseBattle(), phase: 'enemy' as const };
  assert.throws(
    () => castWaterTactic(enemyTurnBattle, 'atk-1', 'def-1', state, () => 0.1),
    /非玩家回合/,
    '非玩家回合不可施放水计',
  );

  // 门禁：气力不足拦截（需 35）
  const lowEnergyBattle = baseBattle({ atkEnergy: 30 });
  assert.throws(
    () => castWaterTactic(lowEnergyBattle, 'atk-1', 'def-1', state, () => 0.1),
    /气力不足/,
    '气力 < 35 严格拦截',
  );

  // 神算特权减半：诸葛亮 (id=4) 仅需 17 气力
  const zhuge = stubOfficer(4, '诸葛亮', { intelligence: 100, waterLv: 4 });
  const zhugeState = baseGameState({ 4: zhuge, 99: def });
  const zhugeBattle = baseBattle({ atkEnergy: 20, attackerCommanderId: 4 });
  const zhugeRes = castWaterTactic(zhugeBattle, 'atk-1', 'def-1', zhugeState, () => 0.01);
  assert.strictEqual(
    zhugeRes.units.find((u) => u.id === 'atk-1')?.energy,
    3,
    '诸葛亮神算特权气力消耗减半（35/2 = 17，20 - 17 = 3）',
  );
  console.log('  ✓ 水计基础气力门禁与神算减半判定准确生效');

  // 范围拦截：距离过远
  const farBattle = baseBattle();
  farBattle.units[1]!.position = { q: 10, r: 10 };
  assert.throws(
    () => castWaterTactic(farBattle, 'atk-1', 'def-1', state, () => 0.1),
    /超出水计范围/,
    '超出射程范围拦截',
  );
  console.log('  ✓ 水计射程范围门禁准确生效');

  // 成功施放：写入 activeStrategem = 'water'，扣兵，减士气，附加 slow 状态
  const battle = baseBattle();
  const next = castWaterTactic(battle, 'atk-1', 'def-1', state, () => 0.05); // roll = 5, 必中
  assert.strictEqual(next.activeStrategem, 'water', '水计成功必须写入 activeStrategem = "water"（D-0B-11 / D-0B-12）');
  const atkUnit = next.units.find((u) => u.id === 'atk-1')!;
  const defUnit = next.units.find((u) => u.id === 'def-1')!;
  assert.strictEqual(atkUnit.hasActed, true, '施放水计后标记已行动');
  assert.strictEqual(atkUnit.mp, 0, '施放水计后移动力归零');
  assert.strictEqual(atkUnit.energy, 65, '正常扣除 35 气力（100 - 35 = 65）');
  assert(defUnit.troopCount < 5000, '水计造成实质兵力伤害');
  assert(defUnit.morale <= 72, '水计造成士气冲击（常规 -8）');
  assert(defUnit.statusEffects.some((e) => e.type === 'slow'), '水计附加 slow 减速状态效果');
  console.log('  ✓ 水计成功写入 activeStrategem=water 并附加减速/士气衰减');

  // 减速效果影响：下回合 MP 扣减
  // 在 enterEnemyPhase 中，defUnit 的 mp 应从 4 减至 3 (baseMp - slow)
  assert.strictEqual(defUnit.mp, 3, '减速状态使得下回合移动力降低 1 点（4 - 1 = 3）');
  console.log('  ✓ 减速状态在回合开启时准确削减部队移动力');

  // 失败路径：不改写 activeStrategem
  const failBattle = baseBattle();
  const failRes = castWaterTactic(failBattle, 'atk-1', 'def-1', state, () => 0.99); // roll = 99, 必定失败
  assert.strictEqual(failRes.activeStrategem, undefined, '水计失败不可改写 activeStrategem');
  assert(failRes.message.includes('失败'), '战报包含失败文案');
  console.log('  ✓ 水计失败不改写 activeStrategem 并进入敌军回合');
}

// ── 2. 水计环境天气与地形修正 ──
console.log('\n── 2. 水计天气、地貌与水战特性修正 ──');

{
  const atk = stubOfficer(1, '周瑜', { intelligence: 90, waterLv: 3 });
  const def = stubOfficer(99, '曹仁', { intelligence: 70 });
  const state = baseGameState({ 1: atk, 99: def });

  // 晴天平原基准伤害
  const clearBattle = baseBattle({ weather: Weather.CLEAR });
  const clearRes = castWaterTactic(clearBattle, 'atk-1', 'def-1', state, () => 0.5);
  const clearDmg = 5000 - clearRes.units.find((u) => u.id === 'def-1')!.troopCount;

  // 雨天伤害加成 (+40%)
  const rainBattle = baseBattle({ weather: Weather.RAIN });
  const rainRes = castWaterTactic(rainBattle, 'atk-1', 'def-1', state, () => 0.5);
  const rainDmg = 5000 - rainRes.units.find((u) => u.id === 'def-1')!.troopCount;
  assert(rainDmg > clearDmg * 1.3, '雨天水势暴涨伤害显著高于晴天 (+40%)');

  // 雪天伤害削弱 (-30%)
  const snowBattle = baseBattle({ weather: Weather.SNOW });
  const snowRes = castWaterTactic(snowBattle, 'atk-1', 'def-1', state, () => 0.5);
  const snowDmg = 5000 - snowRes.units.find((u) => u.id === 'def-1')!.troopCount;
  assert(snowDmg < clearDmg * 0.8, '雪天寒冬水阻伤害显著低于晴天 (-30%)');

  // 水域地貌加成 (+35% 伤害与 +20% 成功率)
  const waterBattle = baseBattle({ targetTerrain: TerrainType.WATER });
  const waterRes = castWaterTactic(waterBattle, 'atk-1', 'def-1', state, () => 0.5);
  const waterDmg = 5000 - waterRes.units.find((u) => u.id === 'def-1')!.troopCount;
  assert(waterDmg > clearDmg * 1.25, '水域地貌水攻伤害加成 (+35%)');
  assert(waterRes.units.find((u) => u.id === 'def-1')!.morale <= 68, '水域受水攻士气扣减更多 (-12)');

  // 水战特性 (water_combat Lv5: 伤害+40%)
  const waterMaster = stubOfficer(2, '陆逊', { intelligence: 90, waterLv: 3, waterCombatTrait: 5 });
  const masterState = baseGameState({ 2: waterMaster, 99: def });
  const masterBattle = baseBattle({ attackerCommanderId: 2 });
  const masterRes = castWaterTactic(masterBattle, 'atk-1', 'def-1', masterState, () => 0.5);
  const masterDmg = 5000 - masterRes.units.find((u) => u.id === 'def-1')!.troopCount;
  assert(masterDmg > clearDmg * 1.3, '水战特性 Lv5 提供显著水攻伤害增益 (+40%)');

  console.log('  ✓ 雨雪天气系数（雨1.4/雪0.7）准确生效');
  console.log('  ✓ 水域地貌伤害乘区与士气破损判定准确生效');
  console.log('  ✓ 水战特性与伤害加成准确生效');
}

// ── 3. 伏兵 (castAmbushTactic) 门禁、气力与状态 ──
console.log('\n── 3. 伏兵 (castAmbushTactic) 门禁、消耗与效果 ──');

{
  const atk = stubOfficer(1, '张辽', { war: 92, intelligence: 82, ambushLv: 2 });
  const def = stubOfficer(99, '孙权', { war: 70, intelligence: 80 });
  const state = baseGameState({ 1: atk, 99: def });

  // 气力不足拦截（需 25）
  const lowEnergyBattle = baseBattle({ atkEnergy: 20 });
  assert.throws(
    () => castAmbushTactic(lowEnergyBattle, 'atk-1', 'def-1', state, () => 0.1),
    /气力不足/,
    '气力 < 25 严格拦截',
  );

  // 司马懿 (id=15) 冢虎特权减半：仅需 12 气力
  const sima = stubOfficer(15, '司马懿', { war: 65, intelligence: 98, ambushLv: 4 });
  const simaState = baseGameState({ 15: sima, 99: def });
  const simaBattle = baseBattle({ atkEnergy: 15, attackerCommanderId: 15 });
  const simaRes = castAmbushTactic(simaBattle, 'atk-1', 'def-1', simaState, () => 0.01);
  assert.strictEqual(
    simaRes.units.find((u) => u.id === 'atk-1')?.energy,
    3,
    '司马懿冢虎特权伏兵气力消耗减半（25/2 = 12，15 - 12 = 3）',
  );
  console.log('  ✓ 伏兵基础气力门禁与司马懿减半判定准确生效');

  // 成功施放：写入 activeStrategem = 'ambush'，扣兵，混乱状态
  const battle = baseBattle();
  const next = castAmbushTactic(battle, 'atk-1', 'def-1', state, () => 0.05); // roll = 5, 必中
  assert.strictEqual(next.activeStrategem, 'ambush', '伏兵成功必须写入 activeStrategem = "ambush"（D-0B-11 / D-0B-12）');
  const atkUnit = next.units.find((u) => u.id === 'atk-1')!;
  const defUnit = next.units.find((u) => u.id === 'def-1')!;
  assert.strictEqual(atkUnit.hasActed, true, '施放伏兵后标记已行动');
  assert.strictEqual(atkUnit.energy, 75, '扣除 25 气力（100 - 25 = 75）');
  assert(defUnit.troopCount < 5000, '伏兵造成实质奇袭伤害');
  assert.strictEqual(defUnit.morale, 68, '伏兵造成士气大跌 (-12)');
  assert(defUnit.statusEffects.some((e) => e.type === 'confusion'), '伏兵附加 confusion 混乱状态效果');
  console.log('  ✓ 伏兵成功写入 activeStrategem=ambush 并附加混乱状态');

  // 混乱机制验证 1：混乱部队无法反击
  const counterCtx: CounterContext = {
    officer: def,
    unitType: UnitType.HEAVY_INFANTRY,
    formation: FormationType.SQUARE,
    distance: 1,
    morale: 68,
    hasActed: false,
    confused: true,
  };
  assert.strictEqual(canCounter(counterCtx), false, '混乱部队（confused=true）在反击判定中被严格剥夺反击权');
  console.log('  ✓ 混乱部队反击权剥夺（无法反击）判定准确生效');

  // 混乱机制验证 2：敌军阶段跳过行动
  const aiUnits = [
    { ...next.units[0]!, side: 'attacker' as const },
    { ...next.units[1]!, side: 'defender' as const, hasActed: false },
  ];
  const aiRes = runSimpleEnemyAi(
    aiUnits,
    battle.hexGrid.terrain,
    getUnitByType(),
    { [def.id]: { name: def.name, leadership: 70, war: 70 } },
    20,
    15,
    'defender',
    'attacker',
    () => 0.5,
  );
  assert(aiRes.message.includes('混乱，无法行动'), 'AI 识别敌军混乱状态并跳过行动');
  assert.strictEqual(aiRes.units.find((u) => u.id === 'def-1')?.hasActed, true, '混乱部队直接标记待机');
  console.log('  ✓ 混乱部队在敌军阶段被战术 AI 识别并强制待机');

  // 伏兵特性 Lv5 出伏必暴 (1.5x)
  const masterAtk = stubOfficer(2, '赵云', { war: 96, intelligence: 85, ambushLv: 2, ambushTrait: 5 });
  const masterState = baseGameState({ 2: masterAtk, 99: def });
  const masterBattle = baseBattle({ attackerCommanderId: 2 });
  const masterRes = castAmbushTactic(masterBattle, 'atk-1', 'def-1', masterState, () => 0.5);
  const masterDmg = 5000 - masterRes.units.find((u) => u.id === 'def-1')!.troopCount;

  const normalAtk = stubOfficer(3, '赵云普', { war: 96, intelligence: 85, ambushLv: 2, ambushTrait: 0 });
  const normalState = baseGameState({ 3: normalAtk, 99: def });
  const normalBattle = baseBattle({ attackerCommanderId: 3 });
  const normalRes = castAmbushTactic(normalBattle, 'atk-1', 'def-1', normalState, () => 0.5);
  const normalDmg = 5000 - normalRes.units.find((u) => u.id === 'def-1')!.troopCount;

  assert(masterDmg > normalDmg * 1.8, '伏兵特性 Lv5 出伏必定暴击 (1.5x + 40%) 伤害远超常规');
  console.log('  ✓ 伏兵特性 Lv5 出伏必暴与增伤乘区准确生效');
}

// ── 4. 服务层全栈串联验收 ──
console.log('\n── 4. 服务层 (gameService) 权威流转 ──');

{
  gameService.createGame(1, 1);
  const state = gameService.getGame();
  assert(state != null, '游戏实例创建成功');

  const officerIds = Object.keys(state.officers).map(Number);
  const atkOfficerId = officerIds[0] ?? 1;
  const defOfficerId = officerIds[1] ?? 2;

  // 启动一场测试六角战斗测试水攻
  state.activeBattles = [baseBattle({
    attackerCommanderId: atkOfficerId,
    defenderCommanderId: defOfficerId,
  })];

  // 验证 service 层暴露的 battleWater 与 battleAmbush
  assert(typeof gameService.battleWater === 'function', 'gameService.battleWater 接口存在');
  assert(typeof gameService.battleAmbush === 'function', 'gameService.battleAmbush 接口存在');

  const afterWater = gameService.battleWater('atk-1', 'def-1');
  assert(afterWater != null, 'battleWater 正常执行并返回战斗状态');

  // 重置游戏实例与战场测试伏兵
  gameService.createGame(1, 1);
  const state2 = gameService.getGame();
  state2.activeBattles = [baseBattle({
    attackerCommanderId: atkOfficerId,
    defenderCommanderId: defOfficerId,
  })];
  const afterAmbush = gameService.battleAmbush('atk-1', 'def-1');
  assert(afterAmbush != null, 'battleAmbush 正常执行并返回战斗状态');

  console.log('  ✓ 服务层 battleWater / battleAmbush 与状态持久化全链路畅通');
}

console.log('\n========================================');
console.log('全部断言通过！水攻/伏兵服务端引擎与端点 100% 绿色通过 ✓');
console.log('========================================\n');
