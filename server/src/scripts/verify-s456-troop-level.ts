// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 456 · P5-14 部队等级 0-A 切片验证。
 *
 * 断言面：
 *   1. 经验 → 等级/名称/攻防/暴击/士气上限投影；
 *   2. 全灭经验与补员稀释纯函数；
 *   3. 六角普攻：同属性下 Lv7 攻方伤害高于 Lv1 攻方；
 *   4. 六角普攻：同属性下 Lv7 守方承受伤害低于 Lv1 守方；
 *   5. `BattleUnit.experience` 存档 Schema 往返（旧档缺省兼容、负值拒绝）。
 */
import {
  BattleStateRuntimeSchema,
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
  UnitProficiency,
  UnitType,
  Weather,
  dilutedTroopXp,
  troopLevelFor,
  troopLevelInfo,
  troopLevelLabel,
  troopXpAfterWipe,
  type BattleState,
  type BattleUnit,
  type Officer,
} from '@leh/shared';
import { attackUnit } from '../engine/battle.js';
import { conscript, trainTroops } from '../engine/civil.js';
import { settleBattle } from '../engine/march.js';
import { createGame, getGame } from '../services/game.js';

let pass = 0;
let fail = 0;
function assert(cond: unknown, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

function stubOfficer(id: number, name: string, war: number, leadership: number): Officer {
  return {
    id, name, birthYear: 150, deathYear: 220,
    stats: { leadership, war, intelligence: 70, politics: 70, charisma: 70 },
    hidden: {
      compatibility: 50, righteousness: 8, ambition: 10, valor: 5, composure: 5, lifespan: 220,
      growth: GrowthPotential.MID, personality: Personality.BRAVE, ideal: Ideal.HEGEMONY,
      bloodline: [], ceilingBonus: null, power: 60, burst: 60, agility: 60, luck: 60,
      intuition: 50, awe: 60, strategy: 60, tactics: 60,
    },
    unitProficiency: {} as Partial<Record<string, UnitProficiency>>,
    formationMastery: [0], skills: [], tags: [], uniqueSkill: undefined,
    faction: 1, location: 1, loyalty: 90, experience: 0, status: OfficerStatus.ACTIVE,
    civilPosition: CivilPosition.NONE, localPosition: LocalPosition.NONE, militaryPosition: MilitaryPosition.NONE,
    nobilityRank: NobilityRank.NONE, merit: 0, stamina: 100, wifeId: null, beauties: [],
  } as unknown as Officer;
}

const ATK = stubOfficer(201, '攻将', 95, 90);
const DEF = stubOfficer(202, '守将', 80, 50);

function unit(
  id: string,
  side: 'attacker' | 'defender',
  q: number,
  r: number,
  commanderId: number,
  experience: number,
  type: UnitType = UnitType.LIGHT_INFANTRY,
): BattleUnit {
  return {
    id, armyId: id, commanderId, commanderName: `武将${commanderId}`,
    factionId: side === 'attacker' ? 1 : 2, side, unitType: type, formation: FormationType.SQUARE,
    troopCount: 1000, maxTroops: 1000, morale: 80, food: 1000, position: { q, r }, facing: 0,
    mp: 3, maxMp: 3, energy: 100, maxEnergy: 100, hasActed: false, isRetreated: false,
    isDestroyed: false, experience, statusEffects: [],
  };
}

const plain = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => TerrainType.PLAIN));
function battle(units: BattleUnit[]): BattleState {
  return {
    id: 'battle-s456', turn: 1, weather: Weather.CLEAR,
    attackerFaction: 1 as BattleState['attackerFaction'],
    defenderFaction: 2 as BattleState['defenderFaction'],
    isSiege: false, units, phase: 'player', winner: null,
    hexGrid: { width: 8, height: 8, terrain: plain },
    log: [], tacticalPoints: 5, tacticalPointsUsed: 0, message: '',
  };
}

function stateWith(): ReturnType<typeof getGame> {
  createGame(1, 2);
  const base = getGame();
  return { ...base, officers: { ...base.officers, 201: ATK, 202: DEF } };
}

const noLuck = () => 0.99;

console.log('P5-14 部队等级 0-A 验证（Session 456）');

// —— 1. 纯函数 ——
{
  assert(troopLevelFor(0) === 1 && troopLevelFor(99) === 1 && troopLevelFor(100) === 2, '经验阈值 1→2');
  assert(troopLevelFor(3000) === 7 && troopLevelFor(9999) === 7, '封顶 7 级');
  assert(troopLevelInfo(600).attackPct === 15 && troopLevelInfo(600).defensePct === 15, 'Lv4 攻防 +15%');
  assert(troopLevelInfo(1000).critPct === 4, 'Lv5 暴击 +4 百分点');
  assert(troopLevelInfo(3000).moraleCap === 130, 'Lv7 士气上限 130（展示投影）');
  assert(troopLevelLabel(1800) === 'Lv6 百战', '等级标签');
  assert(troopXpAfterWipe(900) === 0 && troopXpAfterWipe(3000) === 900, '全灭：普通归零/铁军留 30%');
  assert(dilutedTroopXp(800, 600, 200) === 480, '补员稀释 800 老兵 + 200 新兵 → 480');
}

// —— 2. 攻方等级：Lv7 伤害 > Lv1 ——
{
  const state = stateWith();
  const base = attackUnit(battle([unit('atk', 'attacker', 2, 2, 201, 0), unit('def', 'defender', 3, 2, 202, 0)]), 'atk', 'def', state, noLuck);
  const elite = attackUnit(battle([unit('atk', 'attacker', 2, 2, 201, 3000), unit('def', 'defender', 3, 2, 202, 0)]), 'atk', 'def', state, noLuck);
  const baseLoss = 1000 - base.units.find((u) => u.id === 'def')!.troopCount;
  const eliteLoss = 1000 - elite.units.find((u) => u.id === 'def')!.troopCount;
  assert(eliteLoss > baseLoss, `Lv7 攻方伤害更高（${baseLoss}→${eliteLoss}）`);
}

// —— 3. 守方等级：Lv7 承伤 < Lv1 ——
{
  const state = stateWith();
  const base = attackUnit(battle([unit('atk', 'attacker', 2, 2, 201, 0), unit('def', 'defender', 3, 2, 202, 0)]), 'atk', 'def', state, noLuck);
  const elite = attackUnit(battle([unit('atk', 'attacker', 2, 2, 201, 0), unit('def', 'defender', 3, 2, 202, 3000)]), 'atk', 'def', state, noLuck);
  const baseLoss = 1000 - base.units.find((u) => u.id === 'def')!.troopCount;
  const eliteLoss = 1000 - elite.units.find((u) => u.id === 'def')!.troopCount;
  assert(eliteLoss > 0 && eliteLoss < baseLoss, `Lv7 守方承伤更低（${baseLoss}→${eliteLoss}）`);
}

// —— 4. 存档 Schema ——
{
  const b = battle([unit('atk', 'attacker', 2, 2, 201, 3000), unit('def', 'defender', 3, 2, 202, 0)]);
  const parsed = BattleStateRuntimeSchema.safeParse(b);
  assert(parsed.success, 'BattleState 接受 experience 字段');
  const legacy = battle([{ ...unit('atk', 'attacker', 2, 2, 201, 0), experience: undefined }, unit('def', 'defender', 3, 2, 202, 0)]);
  assert(BattleStateRuntimeSchema.safeParse(legacy).success, '旧档缺省 experience 兼容');
  const negative = battle([{ ...unit('atk', 'attacker', 2, 2, 201, 0), experience: -1 }, unit('def', 'defender', 3, 2, 202, 0)]);
  assert(!BattleStateRuntimeSchema.safeParse(negative).success, '负经验被 Schema 拒绝');
}

// —— 5. 六角战结算写回部队经验（P5-14 经验经济） ——
{
  const g = stateWith();
  const target = Object.values(g.cities).find((c) => c.ruler !== g.playerFactionId)!;
  const from = Object.values(g.cities).find((c) => c.ruler === g.playerFactionId)!;
  const commanderId = from.officers[0] ?? Object.values(g.officers).find((o) => o.faction === g.playerFactionId)!.id;
  const army = {
    id: 'test-army', factionId: g.playerFactionId, name: '测试军', commanderId,
    subCommanderIds: [], unitType: UnitType.LIGHT_INFANTRY, formation: FormationType.SQUARE,
    currentNodeId: from.id, path: [], phase: 'garrison' as const,
    troops: 800, maxTroops: 1000, food: 500, maxFood: 1000,
    morale: 80, organization: 80, experience: 50, fatigue: 0,
    squads: [], structures: [], fromNodeId: from.id,
  };
  const atk = {
    ...unit('atk', 'attacker', 2, 2, commanderId, 50),
    armyId: 'test-army', factionId: g.playerFactionId, troopCount: 800, maxTroops: 1000,
  };
  const def = {
    ...unit('def', 'defender', 3, 2, 202, 0),
    armyId: 'garrison-test', factionId: target.ruler ?? 2, troopCount: 0, isDestroyed: true,
  };
  const b: BattleState = {
    ...battle([atk, def]),
    cityId: target.id, fromCityId: from.id,
    attackerFaction: g.playerFactionId as BattleState['attackerFaction'],
    defenderFaction: (target.ruler ?? 2) as BattleState['defenderFaction'],
    phase: 'over', winner: 'attacker',
  };
  const next = settleBattle({ ...g, campaignArmies: [...g.campaignArmies, army] }, b, () => 0.5);
  const updated = next.campaignArmies.find((a) => a.id === 'test-army')!;
  const lead = g.officers[commanderId]!.stats.leadership;
  const expected = 50 + Math.floor((20 + 30) * 1.5 * (1 + lead / 200));
  assert(updated.experience === expected, `六角战胜利写回部队经验（${updated.experience} = ${expected}）`);
}

// —— 6. 城市训练累积驻军经验（P5-14 训练加速） ——
{
  const state = stateWith();
  const city = Object.values(state.cities).find(
    (c) => c.ruler === state.playerFactionId && c.food >= 60 && c.troops >= 100,
  )!;
  assert(city != null, '找到可训练玩家城');
  const beforeXp = city.troopsExperience ?? 0;
  const next = trainTroops(state, city.id, () => 0.5);
  const afterXp = next.cities[city.id]!.troopsExperience ?? 0;
  assert(afterXp === beforeXp + 5, `训练驻军经验 +5（${beforeXp}→${afterXp}）`);
  assert(next.actionLog.some((e) => e.message.includes('驻军经验+5')), '训练日志记录驻军经验');
}

// —— 7. 征兵补员稀释驻军经验（P5-14 §25.3） ——
{
  const state = stateWith();
  const city = Object.values(state.cities).find(
    (c) => c.ruler === state.playerFactionId && c.gold >= 80 && c.food >= 120,
  )!;
  const seeded = { ...state, cities: { ...state.cities, [city.id]: { ...city, troops: 1000, troopsExperience: 300 } } };
  const next = conscript(seeded, city.id, () => 0);
  const updated = next.cities[city.id]!;
  const added = updated.troops - 1000;
  assert(added > 0, '征兵补充新兵');
  assert(
    updated.troopsExperience === dilutedTroopXp(1000, 300, added),
    `新兵补员稀释经验（300 → ${updated.troopsExperience}，+${added} 兵）`,
  );
  assert((updated.troopsExperience ?? 0) < 300, '补员后经验低于原值');
}

// —— 8. Lv6 起战斗士气下限 50 ——
{
  const state = stateWith();
  const atk = unit('atk', 'attacker', 2, 2, 201, 0);
  const vet = { ...unit('vet', 'defender', 3, 2, 202, 1800), morale: 51 };
  const rookie = { ...unit('rook', 'defender', 3, 2, 202, 0), morale: 51 };
  const vetNext = attackUnit(battle([atk, vet]), 'atk', 'vet', state, noLuck);
  const rookieNext = attackUnit(battle([{ ...atk, id: 'atk2' }, rookie]), 'atk2', 'rook', state, noLuck);
  assert(vetNext.units.find((u) => u.id === 'vet')!.morale === 50, 'Lv6 百战士气下限 50');
  assert(rookieNext.units.find((u) => u.id === 'rook')!.morale === 48, 'Lv1 新卒仍按 −3 降至 48');
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
if (fail > 0) process.exitCode = 1;
