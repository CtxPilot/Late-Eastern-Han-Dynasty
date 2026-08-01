// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S12 功绩等级系统冒烟测试（docs/04 §十）：
 *   1. 初始化同步：syncMerit 填充 meritLevel/peakMeritLevel/meritPath
 *   2. 任命功绩门槛：属性足而功绩不足 → 拒绝；发放功绩后 → 放行
 *   3. 季度功绩衰减：70+/75+/80+ 按档扣减、保底 min(10, peak)、
 *      advanceTurn 季度首月写 merit_decay 日志
 *
 * 运行: pnpm verify-merit
 */
import {
  CivilPosition,
  DipRelation,
  GameStateSchema,
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
  grantMerit,
  meritLevelFor,
  syncMerit,
  type City,
  type GameState,
  type Officer,
} from '@leh/shared';
import { appointOfficer } from '../engine/appoint.js';
import { advanceTurn, applyMeritDecayQuarter } from '../engine/turn.js';
import { makeSeededRng } from '../battle/crit.js';

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
    courtNetworkOpportunities: 20,
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

function baseState(month = 1, year = 190): GameState {
  const officers: Record<number, Officer> = {
    2: stubOfficer(2, '刘备', 2, 15, { stats: { leadership: 85, war: 80, intelligence: 75, politics: 80, charisma: 100 } }),
    8: stubOfficer(8, '诸葛亮', 2, 15, { stats: { leadership: 75, war: 60, intelligence: 100, politics: 95, charisma: 90 } }),
    6: stubOfficer(6, '关羽', 2, 15, { stats: { leadership: 95, war: 98, intelligence: 78, politics: 70, charisma: 90 }, militaryPosition: MilitaryPosition.GRAND_GENERAL }),
    // 老将：190 年时 80 岁（birthYear 110），merit 12000 → Lv11
    99: stubOfficer(99, '老将甲', 2, 15, { birthYear: 110, merit: 12000, peakMeritLevel: 11, meritLevel: 11 }),
    1: stubOfficer(1, '曹操', 1, 1, { stats: { leadership: 95, war: 90, intelligence: 95, politics: 95, charisma: 90 } }),
  };
  const cities: Record<number, City> = {
    15: stubCity(15, '襄阳', 2, { officers: [2, 8, 6, 99], troops: 8000, food: 8000 }),
    1: stubCity(1, '洛阳', 1, { officers: [1], troops: 6000 }),
  };
  const factions: GameState['factions'] = {
    1: { id: 1, name: '曹操军', color: '#4a6fa5', rulerId: 1, capitalCityId: 1, gold: 5000, food: 8000, courtNetwork: 0, cityIds: [1], officerIds: [1], isPlayer: false, isAlive: true },
    2: { id: 2, name: '刘备军', color: '#3d8b5a', rulerId: 2, capitalCityId: 15, gold: 5000, food: 8000, courtNetwork: 0, cityIds: [15], officerIds: [2, 8, 6, 99], isPlayer: true, isAlive: true },
  };
  return {
    scenarioId: 1,
    enabledEventLayers: ['gameplay'],
    enabledChildEventIds: [],
    currentYear: year,
    currentMonth: month,
    season: Math.floor((month - 1) / 3) as GameState['season'],
    playerFactionId: 2,
    officers,
    cities,
    females: {},
    factions,
    armys: [],
    campaignArmies: [],
    campaignNodes: [],
    grandStrategists: [],
    activeBattles: [],
    activeBattlefield: null,
    activeMelee: null,
    diplomacy: [
      { factionA: 1, factionB: 2, relation: DipRelation.HOSTILE, favorability: -50 },
    ],
    intel: emptyIntel(),
    plots: [],
    completedEvents: [],
    pendingEvents: [],
    invalidatedEvents: [],
    eventChoices: {},
    actionLog: [],
  };
}

console.log('\n=== S12 功绩等级系统冒烟测试 ===\n');

// --- 1. 初始化同步 ---
console.log('1. 初始化同步（syncMerit 填充三字段）');
{
  const state = baseState();
  const liubei = syncMerit(state.officers[2]);
  assert(liubei.meritLevel === 1, `刘备 merit0 → Lv1（实际 Lv${liubei.meritLevel}）`);
  assert(liubei.peakMeritLevel === 1, '刘备 peak=Lv1');
  assert(liubei.meritPath === 'neutral', '刘备无官职 → neutral');
  const guanyu = syncMerit({ ...state.officers[6], merit: 5000 });
  assert(guanyu.meritLevel === 9, `关羽 merit5000 → Lv9（实际 Lv${guanyu.meritLevel}）`);
  assert(guanyu.meritPath === 'warrior', '关羽任大将军 → warrior');
  assert(guanyu.peakMeritLevel === 9, '关羽 peak=Lv9');
  assert(meritLevelFor(5000) === 9, 'meritLevelFor(5000)=9');
}

// --- 2. 任命功绩门槛 ---
console.log('\n2. 任命功绩门槛（docs/04 §十 6.4-3）');
{
  let state = baseState();
  // 诸葛亮 智100/政95 满足丞相属性，但 merit=0（Lv1）< 丞相门槛 Lv6
  let rejected = false;
  try {
    state = appointOfficer(state, 8, 'civil', CivilPosition.CHANCELLOR);
  } catch (e) {
    rejected = String(e).includes('功绩不足');
    assert(String(e).includes('功绩不足'), `功绩不足被拒：${String(e)}`);
  }
  assert(rejected, '丞相：功绩不足时任命被拒绝');

  // 发放功绩到 5000（Lv9）后放行
  let withMerit: GameState = { ...state, officers: { ...state.officers, [8]: grantMerit(state.officers[8], 5000) } };
  withMerit = { ...withMerit, officers: { ...withMerit.officers, [8]: syncMerit(withMerit.officers[8]) } };
  let ok = true;
  try {
    withMerit = appointOfficer(withMerit, 8, 'civil', CivilPosition.CHANCELLOR);
  } catch (e) {
    ok = false;
    console.error(`  ✗ 放行失败：${String(e)}`);
  }
  assert(ok, '丞相：功绩达 Lv9 后任命放行');
  assert(withMerit.officers[8]?.civilPosition === CivilPosition.CHANCELLOR, '任命生效（civilPosition=丞相）');
  assert(withMerit.officers[8]?.meritPath === 'scholar', '任命丞相后 meritPath → scholar');

  // 属性不足仍拒绝（既有规则不回归）
  let attrRejected = false;
  try {
    withMerit = appointOfficer(withMerit, 6, 'civil', CivilPosition.CHANCELLOR); // 关羽 政70 < 80
  } catch (e) {
    attrRejected = String(e).includes('属性不足');
  }
  assert(attrRejected, '属性不足仍被拒（既有规则不回归）');
}

// --- 3. 季度功绩衰减 ---
console.log('\n3. 季度功绩衰减（docs/04 §十 6.3）');
{
  // 3a. 直接调用衰减纯逻辑（exported）
  const state = baseState();
  const old = state.officers[99];
  assert(old.merit === 12000, '老将甲初始功绩 12000');
  assert(meritLevelFor(old.merit) === 11, '12000 → Lv11');
  const decay = applyMeritDecayQuarter(state, 190);
  const aged = decay.officers[99];
  assert(aged.merit < 12000, `80 岁老将功绩衰减（${aged.merit} < 12000）`);
  assert(aged.merit === 11880, '80 岁按 1.0%/季 → 11880');
  assert(aged.peakMeritLevel === 11, 'peakMeritLevel 保持 11（只升不降）');
  assert(decay.notes.length === 1 && decay.notes[0].message.includes('老将甲'), '衰减日志含老将甲');
  assert(decay.officers[6].merit === 0, '非老将不受影响');

  // 3b. 保底：到过 Lv11 的老将长期衰减不会跌破 Lv10 阈值（7500）
  let floorState: GameState = {
    ...state,
    officers: {
      ...state.officers,
      [99]: { ...state.officers[99], merit: 7600 },
    },
  };
  for (let i = 0; i < 40; i += 1) {
    floorState = { ...floorState, officers: applyMeritDecayQuarter(floorState, 190).officers };
  }
  assert(floorState.officers[99].merit === 7500, '长期衰减保底 Lv10 阈值 7500');

  // 3c. advanceTurn 季度首月写入 merit_decay 日志
  const turnState = baseState(12, 189); // 189/12 → 190/1 季度首月
  const next = advanceTurn(turnState, makeSeededRng(42));
  const decayLog = next.actionLog.find((l) => l.type === 'merit_decay');
  assert(decayLog != null, 'advanceTurn 190/1 产生 merit_decay 日志');
  assert(next.officers[99]?.merit === 11880, 'advanceTurn 后老将功绩 12000→11880');
  assert(meritLevelFor(next.officers[99]?.merit ?? 0) === 11, '衰减后仍 Lv11（未跌破阈值）');
}

// --- 4. 完整 GameState 过 Schema（三字段可存档） ---
console.log('\n4. 三字段可序列化（GameStateSchema 通过）');
{
  const state = baseState();
  const withFields: GameState = {
    ...state,
    officers: Object.fromEntries(
      Object.entries(state.officers).map(([id, o]) => [id, syncMerit(o)]),
    ),
  };
  const parsed = GameStateSchema.safeParse(withFields);
  assert(parsed.success, '带三字段的 GameState 通过完整 Schema');
  if (!parsed.success) {
    console.error(parsed.error.issues.slice(0, 3).map((i) => i.message).join('; '));
  }
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
