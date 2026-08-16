// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S25 技能树效果消费冒烟（Session 337）：
 *   1. 加点同步 officer.skills（高于静态基线）
 *   2. 跨树同 skillId 取 max
 *   3. 重置回落静态基线
 *   4. 农政提升持续开发完成增益
 *   5. 征兵技能提升征兵量（固定 RNG）
 *   6. 寻访/辩才/医术消费公式与月度体力
 *
 * 运行: pnpm verify-skill-consume
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
  TerrainType,
  UnitType,
  calculateAllianceChance,
  calculateRecruitChance,
  developSkillBonus,
  discoverSkillRateBonus,
  eloquenceAllianceModifier,
  eloquenceRecruitModifier,
  medicineSkillLevel,
  meritEffects,
  meritLevelFor,
  skillLevelOf,
  type City,
  type GameState,
  type Officer,
} from '@leh/shared';
import { DEVELOPMENT_PROJECTS, conscript, tickDevelopmentProject } from '../engine/civil.js';
import { calcRecruitChance } from '../engine/personnel.js';
import { advanceTurn } from '../engine/turn.js';
import {
  createGame,
  getGame,
  getOfficerSkillState,
  resetSkillTree,
  skillTreeTestHooks,
  upgradeSkillNode,
} from '../services/game.js';

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
  cityId: number,
  opts: Partial<Officer> = {},
): Officer {
  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: {
      leadership: 70,
      war: 70,
      intelligence: 80,
      politics: 70,
      charisma: 70,
      ...(opts.stats ?? {}),
    },
    hidden: {
      compatibility: 50,
      righteousness: 5,
      ambition: 5,
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
      ...(opts.hidden ?? {}),
    },
    unitProficiency: {},
    formationMastery: [0],
    skills: opts.skills ?? [],
    tags: [],
    faction: factionId,
    location: cityId,
    loyalty: 90,
    experience: 0,
    status: opts.status ?? OfficerStatus.ACTIVE,
    civilPosition: CivilPosition.NONE,
    localPosition: LocalPosition.NONE,
    militaryPosition: MilitaryPosition.NONE,
    nobilityRank: NobilityRank.NONE,
    merit: 5000,
    meritLevel: 12,
    meritPath: 'scholar',
    stamina: 50,
    wifeId: null,
    beauties: [],
    ...opts,
  };
}

function stubCity(id: number, name: string, ruler: number, opts: Partial<City> = {}): City {
  return {
    id,
    name,
    province: 'test',
    x: 100,
    y: 100,
    maxPopulation: 50000,
    isCapital: true,
    isPass: false,
    specialProduct: null,
    recruitableUnits: [UnitType.HEAVY_INFANTRY],
    initialStats: { farm: 100, commerce: 100, wall: 50 },
    terrain: TerrainType.PLAIN,
    stats: { farm: 100, commerce: 100, wall: 50, morale: 70, ...(opts.stats ?? {}) },
    gold: 5000,
    food: 8000,
    population: 30000,
    demographics: { adultMale: 8000, adultFemale: 8000, child: 8000, elder: 6000 },
    courtNetworkOpportunities: 5,
    troops: 2000,
    troopsMorale: 70,
    officers: opts.officers ?? [9001],
    ruler,
    facilities: [],
    policy: null,
    developmentProgress: { farm: 0, commerce: 0, wall: 0 },
    ...opts,
  };
}

console.log('\n=== S25 skill-consume ===\n');

createGame(1, 1);
let game = getGame();

const playerId = game.playerFactionId;
const candidate = Object.values(game.officers).find(
  (o) => o.faction === playerId && o.status === OfficerStatus.ACTIVE && skillLevelOf(o, 'fire') < 5,
);
assert(!!candidate, `找到可加点玩家武将（实际 ${candidate?.name ?? '无'}）`);
if (!candidate) {
  console.error(`FAIL ${fail} / PASS ${pass}`);
  process.exit(1);
}

const officerId = candidate.id;
skillTreeTestHooks.setMeritLevelForTest(officerId, 16);
game = getGame();
const baselineFire = skillLevelOf(game.officers[officerId], 'fire');
const beforeSpent = getOfficerSkillState(officerId).skillPointsSpent;

upgradeSkillNode(officerId, 'strategy_fire');
game = getGame();
let o = game.officers[officerId];
assert((o.skillTreeState?.strategy_fire ?? 0) === 1, '加点后 skillTreeState.strategy_fire === 1');
assert(skillLevelOf(o, 'fire') === Math.max(baselineFire, 1), '火计至少升到树等级 1');

for (let i = 0; i < 4; i++) {
  try {
    upgradeSkillNode(officerId, 'strategy_fire');
  } catch {
    break;
  }
}
game = getGame();
o = game.officers[officerId];
const treeFire = o.skillTreeState?.strategy_fire ?? 0;
assert(treeFire >= 1, `火计树等级 ≥1（实际 ${treeFire}）`);
assert(
  skillLevelOf(o, 'fire') === Math.max(baselineFire, treeFire),
  `officer.skills 火计 = max(基线${baselineFire}, 树${treeFire}) → ${skillLevelOf(o, 'fire')}`,
);
assert(getOfficerSkillState(officerId).skillPointsSpent > beforeSpent, '技能点已消耗');

const rapidBase = skillLevelOf(o, 'rapidAttack');
try {
  upgradeSkillNode(officerId, 'duel_bravery');
  upgradeSkillNode(officerId, 'duel_rapidAttack');
  upgradeSkillNode(officerId, 'duel_rapidAttack');
} catch {
  /* 点数不足 */
}
try {
  upgradeSkillNode(officerId, 'cmd_gallop');
  upgradeSkillNode(officerId, 'cmd_rapidAttack');
  upgradeSkillNode(officerId, 'cmd_rapidAttack');
  upgradeSkillNode(officerId, 'cmd_rapidAttack');
} catch {
  /* ignore */
}
game = getGame();
o = game.officers[officerId];
const duelRapid = o.skillTreeState?.duel_rapidAttack ?? 0;
const cmdRapid = o.skillTreeState?.cmd_rapidAttack ?? 0;
const expectRapid = Math.max(rapidBase, duelRapid, cmdRapid);
assert(
  skillLevelOf(o, 'rapidAttack') === expectRapid,
  `跨树急攻取 max（duel=${duelRapid}, cmd=${cmdRapid}, skills=${skillLevelOf(o, 'rapidAttack')}）`,
);

resetSkillTree(officerId);
game = getGame();
o = game.officers[officerId];
assert((o.skillTreeState?.strategy_fire ?? 0) === 0, '重置后树状态清空');
assert(skillLevelOf(o, 'fire') === baselineFire, `重置后火计回到基线 ${baselineFire}`);
assert(getOfficerSkillState(officerId).skillPointsSpent === 0, '重置后技能点消耗归零');

const farmer = stubOfficer(9001, '农政试将', 1, 1, {
  skills: [{ skillId: 'farming' as never, level: 4, useCount: 0 }],
  meritLevel: 8,
  meritPath: 'scholar',
});
const city = stubCity(1, '试城', 1, {
  officers: [9001],
  activeDevelopment: {
    kind: 'farm',
    assignedOfficerId: 9001,
    totalMonths: 1,
    remainingMonths: 1,
    totalGoldCost: 300,
    goldPaid: 100,
    pausedMonths: 0,
    progressLostMonths: 0,
    status: 'active',
  },
});
const gs: GameState = {
  ...game,
  playerFactionId: 1,
  officers: { ...game.officers, [9001]: farmer },
  cities: { ...game.cities, [1]: city },
};
const done = tickDevelopmentProject(gs, city);
const baseGain = DEVELOPMENT_PROJECTS.farm.gain;
const meritDev = meritEffects(
  meritLevelFor(farmer.merit ?? 0),
  farmer.meritPath ?? 'neutral',
).developBonus;
const expectGain = Math.floor(baseGain * (1 + meritDev + developSkillBonus(farmer, 'farm')));
assert(
  done.city.stats.farm === city.stats.farm + expectGain,
  `农政 Lv4 开发增益含功绩 ${baseGain}→${expectGain}（实际 +${done.city.stats.farm - city.stats.farm}）`,
);

const recruiterLord = stubOfficer(9002, '征兵城主', 1, 2, {
  skills: [{ skillId: 'recruit' as never, level: 5, useCount: 0 }],
});
const recruitCity = stubCity(2, '征兵城', 1, {
  officers: [9002],
  gold: 5000,
  food: 8000,
  demographics: { adultMale: 9000, adultFemale: 8000, child: 8000, elder: 6000 },
});
const afterRecruit = conscript(
  {
    ...game,
    playerFactionId: 1,
    officers: { ...game.officers, [9002]: recruiterLord },
    cities: { ...game.cities, [2]: recruitCity },
  },
  2,
  () => 0,
);
const withoutSkill = stubOfficer(9003, '无技能城主', 1, 3, { skills: [] });
const cityNoSkill = stubCity(3, '对照城', 1, {
  officers: [9003],
  gold: 5000,
  food: 8000,
  demographics: { adultMale: 9000, adultFemale: 8000, child: 8000, elder: 6000 },
});
const afterNoSkill = conscript(
  {
    ...game,
    playerFactionId: 1,
    officers: { ...game.officers, [9003]: withoutSkill },
    cities: { ...game.cities, [3]: cityNoSkill },
  },
  3,
  () => 0,
);
assert(
  afterRecruit.cities[2].troops > afterNoSkill.cities[3].troops,
  `征兵技能提升兵力（有技 ${afterRecruit.cities[2].troops} > 无技 ${afterNoSkill.cities[3].troops}）`,
);

const discoverer = stubOfficer(9004, '寻访官', 1, 1, {
  skills: [{ skillId: 'discover' as never, level: 5, useCount: 0 }],
});
assert(discoverSkillRateBonus(discoverer) === 0.15, '寻访 Lv5 → +15% 成功率');

const talker = stubOfficer(9005, '辩士', 1, 1, {
  skills: [{ skillId: 'eloquence' as never, level: 3, useCount: 0 }],
  stats: { leadership: 60, war: 50, intelligence: 70, politics: 70, charisma: 80 },
});
const target = stubOfficer(9006, '在野', null, 1, {
  status: OfficerStatus.FREE,
  skills: [],
  stats: { leadership: 60, war: 60, intelligence: 60, politics: 60, charisma: 60 },
});
assert(eloquenceRecruitModifier(talker) === 6, '辩才 Lv3 → 登用 +6 百分点');
assert(
  calcRecruitChance(talker, target) ===
    calculateRecruitChance(talker, target, eloquenceRecruitModifier(talker)),
  'personnel.calcRecruitChance 与 shared 公式同源含辩才',
);
assert(eloquenceAllianceModifier(talker) === 3, '辩才 Lv3 → 结盟 +3 百分点');

createGame(1, 1);
const live = getGame();
const otherFactionId =
  Object.values(live.factions).find((f) => f.id !== live.playerFactionId && f.isAlive)?.id ?? 2;
const ally = calculateAllianceChance(live, otherFactionId);
assert(
  typeof ally.eloquenceModifier === 'number',
  `结盟 breakdown 含 eloquenceModifier=${ally.eloquenceModifier}`,
);

createGame(1, 1);
const medGame = getGame();
const medic = Object.values(medGame.officers).find(
  (x) => x.faction === medGame.playerFactionId && x.status === OfficerStatus.ACTIVE,
);
assert(!!medic, '找到医术测试武将');
if (medic) {
  const patched: GameState = {
    ...medGame,
    officers: {
      ...medGame.officers,
      [medic.id]: {
        ...medic,
        stamina: 40,
        skills: [
          ...medic.skills.filter((s) => s.skillId !== 'medicine'),
          { skillId: 'medicine' as never, level: 3, useCount: 0 },
        ],
      },
    },
  };
  const afterTurn = advanceTurn(patched, () => 0.5);
  const nextStamina = afterTurn.officers[medic.id]?.stamina ?? 0;
  const medLv = medicineSkillLevel(patched.officers[medic.id]);
  assert(
    nextStamina >= 40 + medLv,
    `医术 Lv3 月度体力 40→≥${40 + medLv}（实际 ${nextStamina}）`,
  );
}

console.log(`\n=== skill-consume ${pass} pass / ${fail} fail ===\n`);
if (fail > 0) process.exit(1);
