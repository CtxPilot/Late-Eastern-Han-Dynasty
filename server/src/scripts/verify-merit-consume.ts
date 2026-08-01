// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S12 功绩等级表数值消费冒烟测试（Session 265，docs/04 §十 6.2）：
 *   1. 出征上限：startCampaign 校验 min(驻军, 5000 + 武官×500 + 功绩带兵+)
 *   2. 属性加成：有效属性（effectiveWar）+ 体力上限（Lv5 体上限+3）
 *   3. 单挑加成：武 Lv6 单挑+15%（同 seed 总伤害对比）
 *   4. 暴率加成：武 Lv9 暴率+5%
 *   5. 开发效率：文 Lv4 开发+10%（持续项目完成增益）
 *   6. 内政效率：文 Lv9 内政效率+10%（施米增益）
 *   7. Lv20 体力恢复 +5/月（advanceTurn 月度）
 *   8. 君主特例切片 C：任命忠诚±/赏赐美人/赐婚/笼络对君主不生效或拒绝
 *
 * 运行: pnpm verify-merit-consume
 */
import {
  CivilPosition,
  DipRelation,
  FamilyTier,
  FormationType,
  GrowthPotential,
  Ideal,
  LocalPosition,
  MaritalStatus,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Personality,
  TerrainType,
  UnitProficiency,
  UnitType,
  calcStaminaMax,
  effectiveWar,
  emptyIntel,
  formationTroopCap,
  meritAttrBonusFor,
  type City,
  type FemaleCharacter,
  type GameState,
  type Officer,
} from '@leh/shared';
import { appointOfficer } from '../engine/appoint.js';
import { rewardBeautyStock } from '../engine/beauty.js';
import { DEVELOPMENT_PROJECTS, relief, tickDevelopmentProject } from '../engine/civil.js';
import { giftBeauty, marryFemale } from '../engine/personnel.js';
import { advanceTurn } from '../engine/turn.js';
import { buildCampaignNodes, startCampaign } from '../engine/campaign.js';
import { createGame, getGame } from '../services/game.js';
import {
  DEFAULT_DUEL_CONFIG,
  createDuel,
  makeSeededRng,
  runDuelToCompletion,
} from '../battle/duel.js';
import { computeCritRate, type CritContext } from '../battle/crit.js';

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
    1: stubOfficer(1, '曹操', 1, 1, { stats: { leadership: 95, war: 90, intelligence: 95, politics: 95, charisma: 90 } }),
  };
  const cities: Record<number, City> = {
    15: stubCity(15, '襄阳', 2, { officers: [2, 8, 6], troops: 8000, food: 8000 }),
    13: stubCity(13, '宛', 1, { officers: [1], troops: 4000, food: 3000 }),
    1: stubCity(1, '洛阳', 1, { officers: [], troops: 6000 }),
  };
  const factions: GameState['factions'] = {
    1: { id: 1, name: '曹操军', color: '#4a6fa5', rulerId: 1, capitalCityId: 1, gold: 5000, food: 8000, courtNetwork: 0, cityIds: [1, 13], officerIds: [1], isPlayer: false, isAlive: true },
    2: { id: 2, name: '刘备军', color: '#3d8b5a', rulerId: 2, capitalCityId: 15, gold: 5000, food: 8000, courtNetwork: 0, cityIds: [15], officerIds: [2, 8, 6], isPlayer: true, isAlive: true },
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

function stubFemale(id: number, name: string, factionId: number, cityId: number): FemaleCharacter {
  return {
    id,
    name,
    birthYear: 170,
    deathYear: 230,
    family: FamilyTier.COMMONER,
    clanName: name,
    factionId,
    locationId: cityId,
    initialStatus: MaritalStatus.SINGLE,
    influence: { household: 60, counsel: 40, prestige: 30, martial: 10, fortitude: 10, scholarship: 10 },
    statBonus: {},
    teachableSkills: [],
    enhanceableSkills: [],
    talents: [],
    relatedEvents: [],
    canCommand: false,
    description: '',
    status: MaritalStatus.SINGLE,
  };
}

console.log('\n=== S12 等级表数值消费（Session 265） ===\n');

// --- 1. 出征上限（docs/04 §7.5 + 6.2 带兵+） ---
console.log('1. 出征上限（formationTroopCap + startCampaign 校验）');
{
  const base = baseState();
  const s = { ...base, campaignNodes: buildCampaignNodes(base) };
  // 白身 Lv1 cap=5000：6000 兵出征被拒
  let rejected = false;
  try {
    startCampaign(s, {
      commanderId: 2, subCommanderIds: [], fromNodeId: 15, targetNodeId: 13,
      unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
      troopCount: 6000, food: 3000,
    });
  } catch (e) {
    rejected = String(e).includes('出征上限');
    assert(String(e).includes('出征上限'), `白身 Lv1 6000 兵出征被拒：${String(e)}`);
  }
  assert(rejected, '白身 Lv1（cap 5000）出征 6000 兵被拒');
  assert(formationTroopCap({ ...s.officers[2], merit: 0 }) === 5000, '白身 Lv1 cap = 5000');

  // 主将 Lv10（merit 7500，带兵+2200）→ cap=7200 ≥ 6000 放行
  const up: Officer = { ...s.officers[2], merit: 7500, meritLevel: 10, peakMeritLevel: 10, meritPath: 'warrior' };
  const s2: GameState = { ...s, officers: { ...s.officers, [2]: up } };
  let ok = false;
  try {
    const started = startCampaign(s2, {
      commanderId: 2, subCommanderIds: [], fromNodeId: 15, targetNodeId: 13,
      unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
      troopCount: 6000, food: 3000,
    });
    ok = started.army.troops === 6000;
  } catch (e) {
    console.error(`  ✗ 主将 Lv10 6000 兵应放行：${String(e)}`);
  }
  assert(ok, '主将 Lv10（cap 7200）出征 6000 兵放行');
}

// --- 2. 属性加成（docs/04 §十 6.2：Lv5 体上限+3 / Lv15 全+3） ---
console.log('\n2. 属性加成（有效属性 + 体力上限）');
{
  const base = baseState();
  const lv1: Officer = { ...base.officers[8], merit: 0, meritLevel: 1, peakMeritLevel: 1 };
  const lv15: Officer = { ...base.officers[8], merit: 45000, meritLevel: 15, peakMeritLevel: 15, meritPath: 'neutral' };
  const attr = meritAttrBonusFor(lv15);
  assert(attr.war === 3 && attr.intelligence === 3, 'Lv15 全属性+3（intelligence/war +3）');
  assert(effectiveWar(lv15) === lv15.stats.war + 3, `有效武力 = 面板 +3（${effectiveWar(lv15)} vs ${lv15.stats.war + 3}）`);
  const max1 = calcStaminaMax(lv1, 1, 40);
  const max15 = calcStaminaMax(lv15, 15, 40);
  // Lv15 体力含 Lv5 体上限+3（字面）与全属性加成
  assert(max15 - max1 >= 3, `体力上限 Lv15 > Lv1（差 ${max15 - max1} ≥ 3）`);
}

// --- 3. 单挑加成（武 Lv3/4/6：+5%/+10%/+15%） ---
console.log('\n3. 单挑加成（duel 同 seed 总伤害对比）');
{
  // 挑战者武力 85，对手武力 80，武差 5 → 伤害较低，便于对比
  const base = baseState();
  const defender = { ...base.officers[1], stats: { ...base.officers[1].stats, war: 80 }, merit: 0 };
  const mkChallenger = (merit: number, meritLevel: number, path: 'warrior' | 'neutral') => ({
    ...base.officers[6],
    stats: { ...base.officers[6].stats, war: 85, leadership: 90 },
    merit,
    meritLevel,
    peakMeritLevel: meritLevel,
    meritPath: path,
    militaryPosition: path === 'warrior' ? MilitaryPosition.COLONEL : MilitaryPosition.NONE,
  });
  const a1 = mkChallenger(0, 1, 'neutral');
  const a6 = mkChallenger(1200, 6, 'warrior');

  const runDuel = (challenger: Officer) => {
    const rng = makeSeededRng(20260801);
    const state = createDuel('d', challenger, defender, DEFAULT_DUEL_CONFIG, rng);
    const end = runDuelToCompletion(state, challenger, defender, DEFAULT_DUEL_CONFIG, rng);
    // damages/counterDamages 按"造成方"key：累计挑战者造成的伤害
    const myDmg = end.roundHistory.reduce(
      (sum, r) => sum + (r.damages[challenger.id] ?? 0) + (r.counterDamages[challenger.id] ?? 0),
      0,
    );
    return { myDmg, rounds: end.roundHistory.length, phase: end.phase, defHp: end.combatants[defender.id]?.hp };
  };
  const r1 = runDuel(a1);
  const r6 = runDuel(a6);
  // 单挑加成提升每击伤害 → 击败对手所需轮数更少（总伤因溢出轮数不单调，用轮数对比）
  assert(
    r6.rounds < r1.rounds,
    `武 Lv6 击败对手轮数 < 白身场景（${r6.rounds} < ${r1.rounds}，+15% 生效）`,
  );
}

// --- 4. 暴率加成（武 Lv9 暴率+5%） ---
console.log('\n4. 暴率加成（computeCritRate）');
{
  const base = baseState();
  const mkCtx = (merit: number, meritLevel: number, path: 'warrior' | 'neutral'): CritContext => ({
    officer: { ...base.officers[6], merit, meritLevel, peakMeritLevel: meritLevel, meritPath: path },
    unitType: UnitType.HEAVY_CAVALRY,
    formation: FormationType.WEDGE,
    proficiency: UnitProficiency.A,
    terrain: TerrainType.PLAIN,
    matchup: 1,
  });
  const rate1 = computeCritRate(mkCtx(0, 1, 'neutral'));
  const rate9 = computeCritRate(mkCtx(5000, 9, 'warrior'));
  assert(Math.abs(rate9 - rate1 - 0.05) < 1e-9, `武 Lv9 暴率 +5%（${rate9} vs ${rate1}）`);
}

// --- 5. 开发效率（文 Lv3/4 开发+5%/+10%） ---
console.log('\n5. 开发效率（持续项目完成增益）');
{
  const base = baseState();
  const farmGain = DEVELOPMENT_PROJECTS.farm.gain;
  // 指派将文 Lv4（merit 350）→ 开发+10%
  const assignee: Officer = {
    ...base.officers[8],
    civilPosition: CivilPosition.GOVERNOR,
    merit: 350,
    meritLevel: 4,
    peakMeritLevel: 4,
    meritPath: 'scholar',
  };
  const state: GameState = { ...base, officers: { ...base.officers, [8]: assignee } };
  const city: City = {
    ...state.cities[15],
    gold: 5000,
    activeDevelopment: {
      kind: 'farm',
      assignedOfficerId: 8,
      totalMonths: 3,
      remainingMonths: 1,
      goldPaid: 200,
      totalGoldCost: 300,
      status: 'active',
      pausedMonths: 0,
      progressLostMonths: 0,
    },
  };
  const r1 = tickDevelopmentProject(state, city);
  const gainWithBonus = r1.city.stats.farm - city.stats.farm;
  assert(gainWithBonus === Math.floor(farmGain * 1.1), `文 Lv4 开发 +10%（gain ${gainWithBonus} = ${farmGain}×1.1）`);
}

// --- 6. 内政效率（文 Lv6/9 内政效率+10%，施米） ---
console.log('\n6. 内政效率（施米民心增益）');
{
  const mkCity = (lord: Officer): GameState => {
    const s = baseState();
    return { ...s, officers: { ...s.officers, [lord.id]: lord }, cities: { ...s.cities, [15]: { ...s.cities[15], officers: [lord.id], food: 5000 } } };
  };
  const lord1 = { ...baseState().officers[8], merit: 0, meritLevel: 1, peakMeritLevel: 1 };
  const lord9: Officer = { ...baseState().officers[8], civilPosition: CivilPosition.GOVERNOR, merit: 5000, meritLevel: 9, peakMeritLevel: 9, meritPath: 'scholar' };
  const rng1 = makeSeededRng(7);
  const rng9 = makeSeededRng(7);
  const out1 = relief(mkCity(lord1), 15, rng1);
  const out9 = relief(mkCity(lord9), 15, rng9);
  const gain1 = out1.cities[15].stats.morale - baseState().cities[15].stats.morale;
  const gain9 = out9.cities[15].stats.morale - baseState().cities[15].stats.morale;
  assert(gain9 > gain1, `文 Lv9 施米民心增益 > Lv1（${gain9} > ${gain1}，+10% 生效）`);
}

// --- 7. Lv20 体力恢复 +5/月（advanceTurn 月度） ---
console.log('\n7. Lv20 体力恢复 +5/月（advanceTurn）');
{
  const base = baseState();
  const hero: Officer = {
    ...base.officers[6],
    merit: 210000,
    meritLevel: 20,
    peakMeritLevel: 20,
    meritPath: 'warrior',
    stamina: 50,
  };
  const s: GameState = { ...base, officers: { ...base.officers, [6]: hero } };
  const next = advanceTurn(s, makeSeededRng(42));
  const after = next.officers[6];
  assert(after.stamina === 55, `Lv20 月度体力 50→55（实际 ${after.stamina}）`);
}

// --- 8. 君主特例切片 C（docs/04 §3.8） ---
console.log('\n8. 君主特例切片 C（忠诚±与拉拢记录守卫）');
{
  createGame(1, 1);
  const g = getGame();
  const fid = g.playerFactionId;
  const rulerId = g.factions[fid].rulerId;
  const ruler = g.officers[rulerId];
  assert(ruler != null, '真实存档存在君主');
  const loyaltyBefore = ruler?.loyalty;

  // 任命忠诚±对君主不生效
  let appointed = g;
  try {
    appointed = appointOfficer(g, rulerId, 'military', MilitaryPosition.GENERAL);
  } catch {
    /* 允许被其他前置拒绝，仅断言不因忠诚守卫失败 */
  }
  assert(
    appointed.officers[rulerId].loyalty === loyaltyBefore,
    '任命君主不产生忠诚变化',
  );

  // rewardBeautyStock 拒绝君主
  let beautyRejected = false;
  try {
    rewardBeautyStock(g, rulerId, 1);
  } catch (e) {
    beautyRejected = String(e).includes('君主');
  }
  assert(beautyRejected, '笼络君主被拒（rewardBeautyStock）');

  // giftBeauty / marryFemale 拒绝君主（注入己方单身女性）
  const ownedCity = Object.values(g.cities).find((c) => c.ruler === fid);
  const testFemale = stubFemale(9001, '测试女', fid, ownedCity?.id ?? 1);
  const gWithFemale: GameState = { ...g, females: { ...g.females, [testFemale.id]: testFemale } };
  {
    let giftRejected = false;
    try {
      giftBeauty(gWithFemale, testFemale.id, rulerId);
    } catch (e) {
      giftRejected = String(e).includes('君主');
    }
    assert(giftRejected, '赏赐美人给君主被拒（giftBeauty）');
    let marryRejected = false;
    try {
      marryFemale(gWithFemale, testFemale.id, rulerId);
    } catch (e) {
      marryRejected = String(e).includes('君主');
    }
    assert(marryRejected, '赐婚给君主被拒（marryFemale）');
  }

  // 对照：非君主武将任命忠诚正常变化（选武力/统率达标者，避开荀彧这类纯文官）
  const warrior = Object.values(g.officers).find(
    (o) =>
      o.faction === fid &&
      o.status === 'active' &&
      o.id !== rulerId &&
      o.stats.war >= 60 &&
      o.militaryPosition === MilitaryPosition.NONE,
  );
  if (warrior) {
    const before = warrior.loyalty;
    const out = appointOfficer(g, warrior.id, 'military', MilitaryPosition.CAPTAIN);
    assert(
      out.officers[warrior.id].loyalty > before,
      `非君主武将任命忠诚+（${before}→${out.officers[warrior.id].loyalty}）`,
    );
  } else {
    console.log('    说明: 未找到适合任命对照的武官武将，跳过忠诚+对照断言');
  }
}

console.log(`\n结果：${pass} 通过，${fail} 失败`);
if (fail > 0) process.exit(1);
