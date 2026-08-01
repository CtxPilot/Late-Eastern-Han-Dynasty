// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S12 功绩获取点扩展冒烟测试（docs/04 §十 6.1 内政/人事/外交条，Session 262）：
 *   1. grantMeritTo 统一发放守卫（存在性 / 君主不发 / 三字段同步）
 *   2. 内政：开发启动 +4（指派将）；施米/征兵/训练 +3（城主 city.officers[0]）
 *   3. 人事：搜索寻得在野 +8（searcher）；登用成功 +4（recruiter）；联姻 +10（officerId）
 *   4. 外交：同盟成功 +10（使节，非君主）；劝降成功 +30（Army 主将）
 *      selectAllianceEnvoy 君主不出使（小势力回退君主）
 *
 * 确定性：全部动作用固定 RNG 值（0/1）走通/走败分支；功绩数值为固定值不消耗权威 RNG。
 *
 * 运行: pnpm verify-merit-grants
 */
import {
  CivilPosition,
  DipRelation,
  FamilyTier,
  GrowthPotential,
  Ideal,
  LocalPosition,
  MaritalStatus,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Personality,
  SpouseInfluenceType,
  TerrainType,
  UnitType,
  emptyIntel,
  meritLevelFor,
  type City,
  type GameState,
  type Officer,
} from '@leh/shared';
import { developCity, conscript, relief, trainTroops } from '../engine/civil.js';
import { searchTalent, recruitOfficer, marryFemale } from '../engine/personnel.js';
import { formAlliance } from '../engine/diplomacy.js';
import { trySiegeSurrender } from '../engine/campaign.js';
import { grantMeritTo } from '../engine/meritGrant.js';
import { selectAllianceEnvoy } from '@leh/shared';

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
  factionId: number | null,
  cityId: number | null,
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

function baseState(): GameState {
  // 刘备军（fid 2）：君主刘备(2)，诸葛亮(8)/关羽(6)/老将(99)驻襄阳 15；
  // 曹操军（fid 1）：君主曹操(1)驻洛阳 1；敌方城 20（袁术军 fid 3 虚构）。
  const officers: Record<number, Officer> = {
    2: stubOfficer(2, '刘备', 2, 15, { stats: { leadership: 85, war: 80, intelligence: 75, politics: 80, charisma: 100 } }),
    8: stubOfficer(8, '诸葛亮', 2, 15, { stats: { leadership: 75, war: 60, intelligence: 100, politics: 95, charisma: 90 } }),
    6: stubOfficer(6, '关羽', 2, 15, { stats: { leadership: 95, war: 98, intelligence: 78, politics: 70, charisma: 90 }, militaryPosition: MilitaryPosition.GRAND_GENERAL }),
    99: stubOfficer(99, '老将甲', 2, 15, { stats: { leadership: 70, war: 70, intelligence: 70, politics: 70, charisma: 70 } }),
    1: stubOfficer(1, '曹操', 1, 1, { stats: { leadership: 95, war: 90, intelligence: 95, politics: 95, charisma: 90 } }),
    // 在野
    50: stubOfficer(50, '在野甲', null, 15, { status: OfficerStatus.FREE, faction: null }),
    // 敌方（城 20 守将）
    70: stubOfficer(70, '敌将乙', 3, 20, { stats: { leadership: 60, war: 60, intelligence: 60, politics: 60, charisma: 70 } }),
  };
  const cities: Record<number, City> = {
    15: stubCity(15, '襄阳', 2, { officers: [2, 8, 6, 99], troops: 8000, food: 8000 }),
    1: stubCity(1, '洛阳', 1, { officers: [1], troops: 6000 }),
    20: stubCity(20, '敌城', 3, { officers: [70], troops: 4000 }),
  };
  const factions: GameState['factions'] = {
    1: { id: 1, name: '曹操军', color: '#4a6fa5', rulerId: 1, capitalCityId: 1, gold: 5000, food: 8000, courtNetwork: 0, cityIds: [1], officerIds: [1], isPlayer: false, isAlive: true },
    2: { id: 2, name: '刘备军', color: '#3d8b5a', rulerId: 2, capitalCityId: 15, gold: 5000, food: 8000, courtNetwork: 0, cityIds: [15], officerIds: [2, 8, 6, 99], isPlayer: true, isAlive: true },
    3: { id: 3, name: '袁术军', color: '#8a5a3d', rulerId: 70, capitalCityId: 20, gold: 2000, food: 4000, courtNetwork: 0, cityIds: [20], officerIds: [70], isPlayer: false, isAlive: true },
  };
  return {
    scenarioId: 1,
    enabledEventLayers: ['gameplay'],
    enabledChildEventIds: [],
    currentYear: 190,
    currentMonth: 1,
    season: 0,
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
      { factionA: 2, factionB: 3, relation: DipRelation.HOSTILE, favorability: -50 },
      { factionA: 1, factionB: 3, relation: DipRelation.NEUTRAL, favorability: 0 },
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

const zero = () => 0;
const one = () => 1;

console.log('\n=== S12 功绩获取点扩展冒烟测试（docs/04 §6.1 内政/人事/外交）===\n');

// --- 1. grantMeritTo 统一发放守卫 ---
console.log('1. 统一发放守卫 grantMeritTo');
{
  const state = baseState();
  const withMerit = grantMeritTo(state, 8, 100);
  assert(withMerit.officers[8]?.merit === 100, '诸葛亮 +100 → merit=100');
  assert(withMerit.officers[8]?.meritLevel === meritLevelFor(100), '三字段同步（meritLevel 按表）');
  assert(withMerit.officers[8]?.peakMeritLevel === meritLevelFor(100), 'peakMeritLevel 同步');

  const ruler = grantMeritTo(state, 2, 100); // 刘备=君主
  assert(ruler === state, '君主不发放：返回原 state（引用相等）');
  assert(ruler.officers[2]?.merit === 0, '君主 merit 保持 0');

  const none = grantMeritTo(state, 999, 100);
  assert(none === state, '武将不存在：返回原 state 不抛错');
}

// --- 2. 内政功绩 ---
console.log('\n2. 内政功绩（开发启动 +4 / 施米 +3 / 征兵 +3 / 训练 +3）');
{
  // 2a. 开发：指派将诸葛亮 +4
  let state = baseState();
  state = developCity(state, 15, 'farm', 8);
  assert(state.officers[8]?.merit === 4, `开发启动：诸葛亮 +4（实际 ${state.officers[8]?.merit}）`);
  assert(state.officers[6]?.merit === 0, '开发功绩只给指派将，他人不受影响');

  // 2b~2d. 施米/征兵/训练：城主 = city.officers[0]。去掉君主刘备 → 诸葛亮为城主
  let cState = baseState();
  cState = {
    ...cState,
    cities: { ...cState.cities, [15]: { ...cState.cities[15], officers: [8, 6, 99] } },
  };
  cState = conscript(cState, 15, zero);
  assert(cState.officers[8]?.merit === 3, `征兵：城主诸葛亮 +3（实际 ${cState.officers[8]?.merit}）`);
  cState = relief(cState, 15, zero);
  assert(cState.officers[8]?.merit === 6, `施米：城主诸葛亮 +3（累计 ${cState.officers[8]?.merit}）`);
  cState = trainTroops(cState, 15, zero);
  assert(cState.officers[8]?.merit === 9, `训练：城主诸葛亮 +3（累计 ${cState.officers[8]?.merit}）`);
  assert(cState.officers[6]?.merit === 0, '非城主不获内政功绩');

  // 2e. 无城主城：动作照常执行，无人获功绩
  let eState = baseState();
  eState = {
    ...eState,
    cities: { ...eState.cities, [15]: { ...eState.cities[15], officers: [] } },
  };
  const before = eState.cities[15].troops;
  eState = conscript(eState, 15, zero);
  assert(eState.cities[15].troops > before, '无城主时征兵照常执行');
  assert(Object.values(eState.officers).every((o) => (o.merit ?? 0) === 0), '无城主时不发放功绩（不伪造归属）');
}

// --- 3. 人事功绩 ---
console.log('\n3. 人事功绩（搜索 +8 / 登用 +4 / 联姻 +10）');
{
  // 3a. 搜索寻得在野（rng=0 强制成功；同城在野 50 号；searcher=智+魅最高诸葛亮）
  let sState = baseState();
  sState = searchTalent(sState, 15, zero);
  const searcherMerit = sState.officers[8]?.merit ?? 0;
  assert(searcherMerit === 8, `搜索寻得在野：诸葛亮 +8（实际 ${searcherMerit}）`);
  assert(sState.officers[50]?.location === 15, '在野武将吸引至搜索城');
  assert(sState.officers[50]?.faction == null, '在野武将仍未入势力');

  // 3b. 搜索无果：rng=1 强制失败 → 无发放
  let fState = baseState();
  fState = searchTalent(fState, 15, one);
  assert(Object.values(fState.officers).every((o) => (o.merit ?? 0) === 0), '搜索无果不发放');

  // 3c. 登用成功：recruiter=诸葛亮 +4（rng=0 强制成功）
  let rState = baseState();
  rState = recruitOfficer(rState, 50, zero, 8);
  assert(rState.officers[8]?.merit === 4, `登用成功：说客诸葛亮 +4（实际 ${rState.officers[8]?.merit}）`);
  assert(rState.officers[50]?.faction === 2, '在野武将成功入势力');

  // 3d. 登用失败：rng=1 → 无发放
  let rFail = baseState();
  rFail = recruitOfficer(rFail, 50, one, 8);
  assert((rFail.officers[8]?.merit ?? 0) === 0, '登用失败不发放');
  assert(rFail.officers[50]?.faction == null, '登用失败武将仍为在野');

  // 3e. 联姻：成婚武将关羽 +10
  let mState = baseState();
  mState = {
    ...mState,
    females: {
      7: {
        id: 7, name: '甄氏', birthYear: 170, deathYear: 220,
        family: FamilyTier.LOCAL_POWER, clanName: '甄', factionId: 2, locationId: 15,
        initialStatus: MaritalStatus.SINGLE,
        influence: {
          [SpouseInfluenceType.HOUSEHOLD]: 0,
          [SpouseInfluenceType.COUNSEL]: 3,
          [SpouseInfluenceType.MARTIAL]: 0,
          [SpouseInfluenceType.PRESTIGE]: 0,
          [SpouseInfluenceType.FORTITUDE]: 0,
          [SpouseInfluenceType.SCHOLARSHIP]: 1,
        },
        statBonus: { charisma: 2 },
        teachableSkills: [], enhanceableSkills: [],
        talents: [], relatedEvents: [],
        status: MaritalStatus.SINGLE, giftedToOfficerId: null,
        canCommand: false, description: '测试',
      },
    },
  };
  mState = marryFemale(mState, 7, 6);
  assert(mState.officers[6]?.merit === 10, `联姻：关羽 +10（实际 ${mState.officers[6]?.merit}）`);
  assert(mState.officers[6]?.wifeId === 7, '婚配生效');
  assert(mState.officers[6]?.loyalty! > 90, '联姻忠诚加成保持');
  assert(mState.officers[6]?.meritLevel === meritLevelFor(10), '三字段随联姻功绩同步');
  // 3f. 搜索寻得宝物（稀有 5%）：rng 序列 [0, 0.96]——0 通过失败判定、0.96 ∈ [0.95,1) 宝物分支
  let tState = baseState();
  const treasureSeq = [0, 0.96];
  tState = searchTalent(tState, 15, () => treasureSeq.shift() ?? 0);
  assert(tState.officers[8]?.merit === 5, `搜索寻得宝物：诸葛亮 +5（实际 ${tState.officers[8]?.merit}）`);
  const treasureLog = tState.actionLog.find((l) => l.message.includes('寻得宝物'));
  assert(treasureLog != null, '搜索日志含「寻得宝物」');
}

// --- 4. 外交功绩 ---
console.log('\n4. 外交功绩（同盟 +10 / 劝降 +30）+ 使节君主守卫');
{
  // 4a. 使节选择：刘备军君主刘备(2) 魅100 最高，但不出使 → 使者为关羽(6)（非君主魅最高）
  const envoyState = baseState();
  const envoy = selectAllianceEnvoy(envoyState, 2);
  assert(envoy.id === 6, `君主不出使：使者=关羽(6)（实际 ${envoy.name}(${envoy.id})）`);

  // 4b. 同盟成功：friendly+30 前提下 rng=0 强制成功 → 使者关羽 +10
  let aState = baseState();
  aState = {
    ...aState,
    diplomacy: [
      { factionA: 1, factionB: 2, relation: DipRelation.FRIENDLY, favorability: 30 },
      { factionA: 2, factionB: 3, relation: DipRelation.HOSTILE, favorability: -50 },
      { factionA: 1, factionB: 3, relation: DipRelation.NEUTRAL, favorability: 0 },
    ],
  };
  aState = formAlliance(aState, 1, zero);
  assert(aState.officers[6]?.merit === 10, `同盟成功：使者关羽 +10（实际 ${aState.officers[6]?.merit}）`);
  const rel = aState.diplomacy.find(
    (l) => (l.factionA === 1 && l.factionB === 2) || (l.factionA === 2 && l.factionB === 1),
  );
  assert(rel?.relation === DipRelation.ALLIED, '盟约缔结生效');

  // 4c. 同盟失败：rng=1 → 无发放
  let aFail = baseState();
  aFail = {
    ...aFail,
    diplomacy: [
      { factionA: 1, factionB: 2, relation: DipRelation.FRIENDLY, favorability: 30 },
      { factionA: 2, factionB: 3, relation: DipRelation.HOSTILE, favorability: -50 },
      { factionA: 1, factionB: 3, relation: DipRelation.NEUTRAL, favorability: 0 },
    ],
  };
  aFail = formAlliance(aFail, 1, one);
  assert(Object.values(aFail.officers).every((o) => (o.merit ?? 0) === 0), '同盟失败不发放');

  // 4d. 劝降成功：Army 主将关羽 +30（rng=0 强制成功）
  let uState = baseState();
  uState = {
    ...uState,
    campaignArmies: [{
      id: 'atk', factionId: 2, name: '关羽军', commanderId: 6, subCommanderIds: [], advisorId: 8,
      unitType: UnitType.HEAVY_CAVALRY, formation: 6,
      currentNodeId: 20, targetNodeId: 20, path: [], phase: 'sieging',
      troops: 7000, maxTroops: 7000, food: 1000, maxFood: 2000,
      morale: 85, organization: 80, experience: 200, fatigue: 20,
      squads: [], structures: [],
    }],
  };
  const result = trySiegeSurrender(uState, 'atk', zero);
  assert(result.success, '劝降成功');
  const finalState = result.state;
  // 劝降 30（外交条）+ 破城 30（占城结算）+ 灭国 50（敌城为袁术军唯一城，势力覆灭）
  assert(finalState.officers[6]?.merit === 110, `劝降成功：主将关羽 30+30+50=110（实际 ${finalState.officers[6]?.merit}）`);
  assert(finalState.cities[20]?.ruler === 2, '劝降占城生效');
  assert(finalState.officers[70]?.faction == null, '敌方守将沦为在野');
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
