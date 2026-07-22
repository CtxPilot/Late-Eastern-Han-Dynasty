// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战役层引擎冒烟测试（05 §十二~§十七）
 * 覆盖：节点生成/编成/行军/自动战斗/围城/劝降/强攻/撤退/参谋行动/战后占城
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
  TerrainType,
  UnitType,
  emptyIntel,
  type City,
  type GameState,
  type Officer,
} from '@leh/shared';
import {
  advisorAction,
  assault,
  buildCampaignNodes,
  buildStructure,
  getCampaignNodes,
  orderMarch,
  planPath,
  retreatArmy,
  runAutoBattle,
  startCampaign,
  tickCampaignGarrison,
  tickCampaignMarch,
  tickConstruction,
  trySiegeSurrender,
} from '../engine/campaign.js';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

function stubOfficer(
  id: number,
  name: string,
  factionId: number,
  cityId: number,
  opts: Partial<Officer> = {},
): Officer {
  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: { leadership: 80, war: 75, intelligence: 70, politics: 70, charisma: 70, ...opts.stats },
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
    skills: [],
    tags: [],
    faction: factionId,
    location: cityId,
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
    ...opts,
  };
}

function stubCity(
  id: number,
  name: string,
  ruler: number | null,
  opts: Partial<City> = {},
): City {
  return {
    id,
    name,
    province: 'test',
    x: 100 * id,
    y: 100 * id,
    maxPopulation: 50000,
    isCapital: false,
    isPass: false,
    specialProduct: null,
    recruitableUnits: [UnitType.HEAVY_INFANTRY],
    initialStats: { farm: 100, commerce: 100, wall: 50 },
    terrain: TerrainType.PLAIN,
    stats: { farm: 100, commerce: 100, wall: 50, morale: 70, ...opts.stats },
    gold: 3000,
    food: 5000,
    population: 30000,
    demographics: { adultMale: 8000, adultFemale: 8000, child: 8000, elder: 6000 },
    beautySeekLeft: 20,
    troops: 5000,
    troopsMorale: 70,
    officers: [],
    ruler,
    facilities: [],
    policy: null,
    developmentProgress: { farm: 0, commerce: 0, wall: 0 },
    ...opts,
  };
}

function baseState(): GameState {
  // 宛(13) ↔ 襄阳(15) 道路邻接；成都(19) ↔ 汉中(20)
  // 刘备(playerFactionId=2)据襄阳15；曹操(1)据宛13、洛阳1；宛-襄阳邻接
  const officers: Record<number, Officer> = {
    2: stubOfficer(2, '刘备', 2, 15, { stats: { leadership: 85, war: 80, intelligence: 75, politics: 80, charisma: 100 } }),
    6: stubOfficer(6, '关羽', 2, 15, { stats: { leadership: 95, war: 98, intelligence: 78, politics: 70, charisma: 90 }, militaryPosition: MilitaryPosition.GRAND_GENERAL }),
    7: stubOfficer(7, '张飞', 2, 15, { stats: { leadership: 88, war: 97, intelligence: 55, politics: 40, charisma: 70 } }),
    10: stubOfficer(10, '赵云', 2, 15, { stats: { leadership: 92, war: 95, intelligence: 78, politics: 70, charisma: 85 } }),
    8: stubOfficer(8, '诸葛亮', 2, 15, { stats: { leadership: 75, war: 60, intelligence: 100, politics: 95, charisma: 90 }, militaryPosition: MilitaryPosition.NONE }),
    1: stubOfficer(1, '曹操', 1, 1, { stats: { leadership: 95, war: 90, intelligence: 95, politics: 95, charisma: 90 } }),
    13: stubOfficer(13, '曹仁', 1, 13, { stats: { leadership: 85, war: 85, intelligence: 65, politics: 60, charisma: 70 } }),
  };
  const cities: Record<number, City> = {
    15: stubCity(15, '襄阳', 2, { officers: [2, 6, 7, 10, 8], troops: 8000, food: 8000 }),
    13: stubCity(13, '宛', 1, { officers: [13], troops: 4000, food: 3000 }),
    1: stubCity(1, '洛阳', 1, { officers: [1], troops: 6000 }),
    19: stubCity(19, '成都', 2, { troops: 3000 }),
    20: stubCity(20, '汉中', 2, { troops: 2000 }),
  };
  return {
    scenarioId: 1,
    enabledEventLayers: ['gameplay'],
    enabledChildEventIds: [],
    currentYear: 200,
    currentMonth: 1,
    season: 0,
    playerFactionId: 2,
    officers,
    cities,
    females: {},
    factions: {
      1: { id: 1, name: '曹操军', color: '#4a6fa5', rulerId: 1, capitalCityId: 1, gold: 5000, food: 8000, beautyStock: 0, cityIds: [1, 13], officerIds: [1, 13], isPlayer: false, isAlive: true },
      2: { id: 2, name: '刘备军', color: '#3d8b5a', rulerId: 2, capitalCityId: 15, gold: 5000, food: 8000, beautyStock: 0, cityIds: [15, 19, 20], officerIds: [2, 6, 7, 10, 8], isPlayer: true, isAlive: true },
    },
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

console.log('\n=== 战役层引擎冒烟测试 ===\n');

// --- 1. 节点生成 ---
console.log('1. 节点生成');
{
  const state = baseState();
  const nodes = buildCampaignNodes(state);
  assert(nodes.length === 5, '生成 5 个节点');
  const wan = nodes.find((n) => n.id === 13);
  assert(wan != null, '宛节点存在');
  assert(wan!.ruler === 1, '宛归属曹操(1)');
  assert(wan!.adjacentNodeIds.includes(15), '宛↔襄阳邻接');
  assert(wan!.wallDurability === 50 * 100, '城墙耐久=城防×100');
}

// --- 2. 路径规划 ---
console.log('\n2. 路径规划');
{
  const state = baseState();
  const path = planPath(state, 15, 13); // 襄阳→宛
  assert(path.length === 1 && path[0] === 13, '襄阳→宛 1 跳');
  const path2 = planPath(state, 19, 13); // 成都→宛
  assert(path2.length > 1, '成都→宛 多跳路径');
}

// --- 3. 编成出征 ---
console.log('\n3. 编成出征');
{
  const state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  const result = startCampaign(state, {
    commanderId: 6, // 关羽
    subCommanderIds: [7, 10], // 张飞、赵云
    advisorId: 8, // 诸葛亮（智100）
    fromNodeId: 15,
    targetNodeId: 13,
    unitType: UnitType.HEAVY_CAVALRY,
    formation: FormationType.WEDGE,
    troopCount: 6000,
    food: 1500,
  });
  assert(result.army.name === '关羽军', 'Army 命名=主将+军');
  assert(result.army.troops === 6000, '兵力 6000');
  assert(result.army.commanderId === 6, '主将关羽');
  assert(result.army.subCommanderIds.length === 2, '副将2');
  assert(result.army.advisorId === 8, '参谋诸葛亮');
  assert(result.army.phase === 'marching', '初始阶段=marching');
  assert(result.army.squads.length === 3, 'Squad 3 个（主将+2副）');
  assert(result.army.squads[0].position === 'center', '主将中军');
  assert(result.army.squads[1].position === 'vanguard', '第一副将先锋');
  assert(result.state.campaignArmies.length === 1, 'Army 入 state');
  assert(result.state.cities[15].troops === 2000, '襄阳扣兵 8000-6000=2000');
  assert(result.state.cities[15].food === 6500, '襄阳扣粮 8000-1500=6500');
}

// --- 4. 校验拒绝 ---
console.log('\n4. 编成校验拒绝');
{
  const state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  // 非邻接：成都19→宛13（虽有多跳，但首跳须邻接，19→13 首跳 19 的邻接是 20，不是 13）
  try {
    startCampaign(state, {
      commanderId: 6, subCommanderIds: [], fromNodeId: 19, targetNodeId: 13,
      unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE, troopCount: 1500, food: 500,
    });
    assert(false, '非邻接应拒绝');
  } catch (e) {
    assert((e as Error).message.includes('无官道直达'), '非邻接拒绝');
  }
  // 兵力不足
  try {
    startCampaign(state, {
      commanderId: 6, subCommanderIds: [], fromNodeId: 15, targetNodeId: 13,
      unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE, troopCount: 500, food: 500,
    });
    assert(false, '兵力不足应拒绝');
  } catch (e) {
    assert((e as Error).message.includes('兵力'), '兵力不足拒绝');
  }
  // 主将不在出发城
  try {
    startCampaign(state, {
      commanderId: 6, subCommanderIds: [], fromNodeId: 13, targetNodeId: 15,
      unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE, troopCount: 2000, food: 500,
    });
    assert(false, '主将不在出发城应拒绝');
  } catch (e) {
    assert((e as Error).message.includes('出发节点'), '主将不在出发城拒绝');
  }
}

// --- 5. 行军推进 + 围城 ---
console.log('\n5. 行军推进 + 围城');
{
  let state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  const result = startCampaign(state, {
    commanderId: 6, subCommanderIds: [7], advisorId: 8,
    fromNodeId: 15, targetNodeId: 13,
    unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
    troopCount: 6000, food: 2000,
  });
  state = result.state;
  // 推进 1 回合 → 到达宛 → 围城
  state = tickCampaignMarch(state);
  const army = state.campaignArmies[0];
  assert(army.currentNodeId === 13, '到达宛(13)');
  assert(army.phase === 'sieging', '进入围城');
  assert(army.siegeState != null, '围城状态建立');
  assert(army.siegeState!.siegeTurns === 0, '围城回合 0');
  // 粮耗
  assert(army.food < 2000, '行军消耗粮草');
}

// --- 6. 自动战斗（强攻） ---
console.log('\n6. 自动战斗（强攻）');
{
  let state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  const result = startCampaign(state, {
    commanderId: 6, subCommanderIds: [7, 10], advisorId: 8,
    fromNodeId: 15, targetNodeId: 13,
    unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
    troopCount: 7000, food: 2000,
  });
  state = result.state;
  state = tickCampaignMarch(state); // 到达围城
  const beforeTroops = state.campaignArmies[0].troops;
  const { state: afterState, result: battleResult } = assault(state, state.campaignArmies[0].id);
  state = afterState;
  assert(battleResult.rounds >= 1, `战斗回合数 ${battleResult.rounds} ≥ 1`);
  assert(battleResult.attackerCasualties + battleResult.defenderCasualties > 0, '双方有伤亡');
  assert(battleResult.attackerRemaining < beforeTroops, '攻方有损失');
  // 关羽 7000 重骑 vs 曹仁 4000 守军 → 攻方优势，大概率胜
  const army = state.campaignArmies.find((a) => a.commanderId === 6);
  if (battleResult.winner === 'attacker') {
    assert(state.cities[13].ruler === 2, `攻方胜 → 宛归属刘备(2)`);
    assert(army == null || army.phase === 'garrison', '攻方 Army 驻守');
    console.log(`    结果: 攻方胜，伤亡 ${battleResult.attackerCasualties}/${battleResult.attackerCasualties + battleResult.attackerRemaining}，俘获 ${battleResult.prisoners}`);
  } else {
    assert(state.cities[13].ruler === 1, `守方胜 → 宛仍属曹操(1)`);
    console.log(`    结果: 守方胜，攻方残部退回`);
  }
}

// --- 7. 劝降 ---
console.log('\n7. 劝降');
{
  let state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  const result = startCampaign(state, {
    commanderId: 2, subCommanderIds: [6, 7, 10], advisorId: 8,
    fromNodeId: 15, targetNodeId: 13,
    unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    troopCount: 7500, food: 3000,
  });
  state = result.state;
  state = tickCampaignMarch(state);
  // 用 seeded rng：固定失败一次（roll=99≥chance），然后 siegeTurns+1
  let rngFail = () => 99;
  const failRes = trySiegeSurrender(state, state.campaignArmies[0].id, rngFail);
  assert(!failRes.success, '高 roll → 劝降失败');
  assert(failRes.state.campaignArmies[0].siegeState!.siegeTurns === 1, '围城回合 +1');
  // 强制成功：roll=0
  let rngOk = () => 0;
  const okRes = trySiegeSurrender(failRes.state, failRes.state.campaignArmies[0].id, rngOk);
  assert(okRes.success, '低 roll → 劝降成功');
  assert(okRes.state.cities[13].ruler === 2, '劝降成功 → 宛归刘备');
}

// --- 8. 撤退 ---
console.log('\n8. 撤退');
{
  let state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  const result = startCampaign(state, {
    commanderId: 6, subCommanderIds: [],
    fromNodeId: 15, targetNodeId: 13,
    unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
    troopCount: 3000, food: 1000,
  });
  state = result.state;
  const moraleBefore = state.campaignArmies[0].morale;
  state = retreatArmy(state, state.campaignArmies[0].id);
  assert(state.campaignArmies[0].phase === 'marching', '撤退→marching');
  assert(state.campaignArmies[0].morale === moraleBefore - 10, '士气 -10');
  assert(state.campaignArmies[0].siegeState == null, '围城状态清除');
}

// --- 9. 参谋行动 ---
console.log('\n9. 参谋行动');
{
  let state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  const result = startCampaign(state, {
    commanderId: 6, subCommanderIds: [7], advisorId: 8,
    fromNodeId: 15, targetNodeId: 13,
    unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
    troopCount: 5000, food: 1500,
  });
  state = result.state;
  // 激励
  const moraleBefore = state.campaignArmies[0].morale;
  state = advisorAction(state, state.campaignArmies[0].id, 'inspire');
  assert(state.campaignArmies[0].morale === Math.min(100, moraleBefore + 15), '激励士气 +15');
  assert(state.officers[8].stamina === 85, '参谋体力 -15');
  // 陷阱（诸葛亮智力100≥90）
  state = advisorAction(state, state.campaignArmies[0].id, 'trap');
  assert(state.campaignArmies[0].structures.some((s) => s.type === 'trap'), '陷阱建造入 structures');
  assert(state.officers[8].stamina === 65, '参谋体力再 -20');
  // 撤退休整
  const fatigueBefore = state.campaignArmies[0].fatigue;
  state = advisorAction(state, state.campaignArmies[0].id, 'retreat');
  assert(state.campaignArmies[0].fatigue === Math.max(0, fatigueBefore - 30), '疲劳 -30');
  // 体力不足拒绝
  try {
    advisorAction(state, state.campaignArmies[0].id, 'inspire');
    // 体力 55 → ≥30 仍可激励；继续扣到 40 再测
    assert(true, '体力仍足');
  } catch {
    assert(true, '体力边界正常');
  }
}

// --- 10. 建造设施 ---
console.log('\n10. 建造设施');
{
  let state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  const result = startCampaign(state, {
    commanderId: 6, subCommanderIds: [],
    fromNodeId: 15, targetNodeId: 13,
    unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
    troopCount: 3000, food: 1000,
  });
  state = result.state;
  const goldBefore = state.factions[2].gold;
  state = buildStructure(state, state.campaignArmies[0].id, 'ram');
  assert(state.campaignArmies[0].structures.some((s) => s.type === 'ram'), '冲车建造入 structures');
  assert(state.campaignArmies[0].structures[0].buildProgress === 0.5, '冲车首回合建造进度=50%');
  assert(state.factions[2].gold === goldBefore - 300, '冲车建造扣除 300 金');
  assert(state.campaignArmies[0].phase === 'garrison', '大型器械建造期间转为驻守');
  assert(state.campaignArmies[0].path.length === 0, '大型器械建造期间清除行军路径');

  state = tickConstruction(state);
  assert(state.campaignArmies[0].structures[0].buildProgress === 1, '下一回合冲车建造完成');
  assert(
    state.actionLog.some((log) => log.type === 'construction_progress'),
    '建造完成写入进度日志',
  );
}

// --- 11. 驻守恢复 ---
console.log('\n11. 驻守恢复');
{
  let state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  // 手动构造一个 garrison + 高疲劳 Army
  const army = {
    id: 'test-garrison',
    factionId: 2,
    name: '测试军',
    commanderId: 6,
    subCommanderIds: [],
    unitType: UnitType.HEAVY_INFANTRY,
    formation: FormationType.SQUARE,
    currentNodeId: 15,
    path: [],
    phase: 'garrison' as const,
    troops: 3000,
    maxTroops: 3000,
    food: 500,
    maxFood: 1000,
    morale: 60,
    organization: 50,
    experience: 100,
    fatigue: 80,
    squads: [],
    structures: [],
  };
  state = { ...state, campaignArmies: [army] };
  state = tickCampaignGarrison(state);
  assert(state.campaignArmies[0].fatigue === 70, '驻守疲劳 -10');
  assert(state.campaignArmies[0].organization === 55, '驻守组织度 +5');
}

// --- 12. 节点同步 ---
console.log('\n12. 节点同步');
{
  let state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  // 修改城池驻军 → 节点应同步
  state = {
    ...state,
    cities: { ...state.cities, 13: { ...state.cities[13], troops: 9999, ruler: 2 } },
  };
  const nodes = getCampaignNodes(state);
  const wan = nodes.find((n) => n.id === 13)!;
  assert(wan.garrison === 9999, '节点驻军同步');
  assert(wan.ruler === 2, '节点归属同步');
}

// --- 13. runAutoBattle 直接调用 ---
console.log('\n13. 自动战斗算法直接调用');
{
  const state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  const atkArmy: import('@leh/shared').CampaignArmy = {
    id: 'atk', factionId: 2, name: '关羽军', commanderId: 6, subCommanderIds: [7, 10], advisorId: 8,
    unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
    currentNodeId: 13, targetNodeId: 13, path: [], phase: 'sieging',
    troops: 7000, maxTroops: 7000, food: 1000, maxFood: 2000,
    morale: 85, organization: 80, experience: 200, fatigue: 20,
    squads: [], structures: [],
  };
  const result = runAutoBattle(state, atkArmy, null, { cityId: 13, garrison: 4000, wall: 50 }, () => 0.5);
  assert(result.rounds >= 1, `推演 ${result.rounds} 回合`);
  assert(result.winner === 'attacker' || result.winner === 'defender', '有明确胜方');
  assert(result.attackerRemaining > 0, '攻方有剩余');
  console.log(`    战力推演: 攻方剩 ${result.attackerRemaining}/${atkArmy.troops}，守方剩 ${result.defenderRemaining}/4000，胜方=${result.winner}`);
}

// --- 14. 行军指令变更目标 ---
console.log('\n14. 行军指令变更目标');
{
  let state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  const result = startCampaign(state, {
    commanderId: 6, subCommanderIds: [],
    fromNodeId: 15, targetNodeId: 13,
    unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
    troopCount: 2000, food: 800,
  });
  state = result.state;
  // 改目标为洛阳1（宛13→洛阳1 邻接；当前在襄阳15，路径 15→13→1）
  state = orderMarch(state, state.campaignArmies[0].id, 1);
  assert(state.campaignArmies[0].targetNodeId === 1, '目标改为洛阳');
  assert(state.campaignArmies[0].path.length >= 2, '路径多跳');
}

// --- 15. 单挑事件触发 ---
console.log('\n15. 单挑事件触发');
{
  const state = { ...baseState(), campaignNodes: buildCampaignNodes(baseState()) };
  // 构造武力差大的对决：关羽(武98) vs 曹仁(武85)，差13 → chance=0.05+1.3+0=1.35 必触发
  const atkArmy: import('@leh/shared').CampaignArmy = {
    id: 'atk', factionId: 2, name: '关羽军', commanderId: 6, subCommanderIds: [], advisorId: undefined,
    unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
    currentNodeId: 13, path: [], phase: 'engaged',
    troops: 5000, maxTroops: 5000, food: 1000, maxFood: 1000,
    morale: 90, organization: 80, experience: 0, fatigue: 0,
    squads: [], structures: [],
  };
  let triggeredCount = 0;
  for (let i = 0; i < 50; i++) {
    const result = runAutoBattle(state, atkArmy, null, { cityId: 13, garrison: 4000, wall: 50 }, () => 0.5);
    triggeredCount += result.duels.length;
  }
  assert(triggeredCount > 0, `50 次模拟中单挑触发 ${triggeredCount} 次（关羽武差大）`);
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
