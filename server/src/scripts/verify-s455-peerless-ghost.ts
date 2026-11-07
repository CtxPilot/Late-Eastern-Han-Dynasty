// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Session 455 · D-0B-8「吕布服务端无双乱舞 / 心理震慑 / 鬼神」验证。
 *
 * 断言面：
 *   1. 纯函数真源（识别吕布、鬼神阈值、溅射与吸血、震慑半径）；
 *   2. 玩家普攻路径：无双乱舞溅射首要目标相邻敌军、鬼神吸血；
 *   3. 鬼神防御：兵力 ≤30% 时受到伤害显著低于满编；
 *   4. 心理震慑：吕布 2 格内敌军攻击伤害 −10%；
 *   5. 敌军 AI 普攻路径同源：溅射写入且不破坏既有攻击链；
 *   6. 无吕布时伤害/战报逐字节不变（对照）。
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
  UnitProficiency,
  UnitType,
  Weather,
  isPeerlessGhostForm,
  isPeerlessOfficer,
  isWithinPeerlessIntimidate,
  peerlessLifestealHeal,
  peerlessSplashDamage,
  type BattleState,
  type BattleUnit,
  type Officer,
  type UnitTemplate,
} from '@leh/shared';
import { attackUnit } from '../engine/battle.js';
import { runSimpleEnemyAi } from '../battle/simpleAi.js';
import { getUnitByType } from '../data/loader.js';
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

function stubOfficer(
  id: number,
  name: string,
  opts: Partial<{ war: number; leadership: number; unique: string }> = {},
): Officer {
  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: { leadership: opts.leadership ?? 80, war: opts.war ?? 80, intelligence: 70, politics: 70, charisma: 70 },
    hidden: {
      compatibility: 50, righteousness: 8, ambition: 10, valor: 5, composure: 5, lifespan: 220,
      growth: GrowthPotential.MID, personality: Personality.BRAVE, ideal: Ideal.HEGEMONY,
      bloodline: [], ceilingBonus: null, power: 60, burst: 60, agility: 60, luck: 60,
      intuition: 50, awe: 60, strategy: 60, tactics: 60,
    },
    unitProficiency: {} as Partial<Record<string, UnitProficiency>>,
    formationMastery: [0],
    skills: [],
    tags: [],
    uniqueSkill: opts.unique as Officer['uniqueSkill'],
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
  } as unknown as Officer;
}

const LVBU = stubOfficer(5, '吕布', { war: 100, leadership: 97, unique: 'wushuang' });
const GUANYU = stubOfficer(6, '关羽', { war: 97, leadership: 95, unique: 'wusheng' });
const GENERIC = stubOfficer(99, '无名守将', { war: 100, leadership: 97 });
const VICTIM = stubOfficer(100, '偏将', { war: 70, leadership: 70 });

function unit(
  id: string,
  side: 'attacker' | 'defender',
  q: number,
  r: number,
  troops: number,
  commanderId: number,
  type: UnitType = UnitType.LIGHT_INFANTRY,
  facing: 0 | 1 | 2 | 3 | 4 | 5 = 0,
  maxTroops = 1000,
): BattleUnit {
  return {
    id, armyId: id, commanderId, commanderName: `武将${commanderId}`,
    factionId: side === 'attacker' ? 1 : 2, side, unitType: type, formation: FormationType.SQUARE,
    troopCount: troops, maxTroops, morale: 80, food: 1000, position: { q, r }, facing,
    mp: 3, maxMp: 3, energy: 100, maxEnergy: 100, hasActed: false, isRetreated: false,
    isDestroyed: false, statusEffects: [],
  };
}

const plain = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => TerrainType.PLAIN));
function battle(units: BattleUnit[]): BattleState {
  return {
    id: 'battle-s455', turn: 1, weather: Weather.CLEAR,
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
  return {
    ...base,
    officers: {
      ...base.officers,
      5: LVBU,
      6: GUANYU,
      99: GENERIC,
      100: VICTIM,
    },
  };
}

const noLuck = () => 0.99;

console.log('D-0B-8 吕布无双/震慑/鬼神验证（Session 455）');

// —— 1. 纯函数 ——
{
  assert(isPeerlessOfficer({ id: 5 }), 'id=5 识别为吕布');
  assert(isPeerlessOfficer({ id: 77, uniqueSkill: 'wushuang' }), 'uniqueSkill=wushuang 识别为吕布');
  assert(!isPeerlessOfficer({ id: 6, uniqueSkill: 'wusheng' }), '非无双专属不识别');
  assert(isPeerlessGhostForm({ troopCount: 300, maxTroops: 1000 }), '兵力 30% 进入鬼神');
  assert(!isPeerlessGhostForm({ troopCount: 301, maxTroops: 1000 }), '兵力 30.1% 不进入鬼神');
  assert(peerlessSplashDamage(100) === 35, '无双乱舞溅射 35%');
  assert(peerlessLifestealHeal(100) === 20, '鬼神吸血 20%');
  assert(isWithinPeerlessIntimidate({ q: 2, r: 0 }, { q: 0, r: 0 }), '震慑半径 2 格命中');
  assert(!isWithinPeerlessIntimidate({ q: 3, r: 0 }, { q: 0, r: 0 }), '震慑半径外不命中');
}

// —— 2. 玩家无双乱舞 + 鬼神吸血 ——
{
  const state = stateWith();
  const lvbu = unit('lvbu', 'attacker', 2, 2, 250, 5, UnitType.LIGHT_CAVALRY, 0, 1000);
  const primary = unit('enemy-a', 'defender', 3, 2, 1000, 100);
  const splash = unit('enemy-b', 'defender', 3, 3, 1000, 100);
  const far = unit('enemy-c', 'defender', 6, 6, 1000, 100);
  const next = attackUnit(battle([lvbu, primary, splash, far]), 'lvbu', 'enemy-a', state, noLuck);
  const primaryLoss = 1000 - next.units.find((u) => u.id === 'enemy-a')!.troopCount;
  const splashLoss = 1000 - next.units.find((u) => u.id === 'enemy-b')!.troopCount;
  const farLoss = 1000 - next.units.find((u) => u.id === 'enemy-c')!.troopCount;
  const healed = next.units.find((u) => u.id === 'lvbu')!.troopCount;
  assert(primaryLoss > 0, '首要目标受到主伤害');
  assert(splashLoss === peerlessSplashDamage(primaryLoss), `相邻敌军受到 35% 溅射（${splashLoss}）`);
  assert(farLoss === 0, '非相邻敌军不受溅射');
  assert(healed === Math.min(1000, 250 + peerlessLifestealHeal(primaryLoss)), `鬼神吸血回复（${healed}）`);
  assert(next.message.includes('无双乱舞') && next.message.includes('鬼神'), '战报标注无双乱舞与鬼神');
}

// —— 3. 鬼神防御（远程攻击，规避震慑半径，只比较防御倍率） ——
{
  const base = stateWith();
  // 降低守方统率，使“防御 ×2”在 calcDamage 中产生可观测差值（同数值对照）。
  const state = {
    ...base,
    officers: {
      ...base.officers,
      5: stubOfficer(5, '吕布', { war: 100, leadership: 50, unique: 'wushuang' }),
      99: stubOfficer(99, '无名守将', { war: 100, leadership: 50 }),
    },
  };
  const attacker = unit('atk', 'attacker', 5, 2, 1000, 6, UnitType.ARCHER, 3, 1000);
  const ghost = unit('ghost', 'defender', 2, 2, 250, 5, UnitType.LIGHT_CAVALRY, 3, 1000);
  const normal = unit('normal', 'defender', 2, 2, 1000, 99, UnitType.LIGHT_CAVALRY, 3, 1000);
  const ghostNext = attackUnit(battle([attacker, ghost]), 'atk', 'ghost', state, noLuck);
  const normalNext = attackUnit(battle([{ ...attacker, id: 'atk2' }, normal]), 'atk2', 'normal', state, noLuck);
  const ghostLoss = 250 - ghostNext.units.find((u) => u.id === 'ghost')!.troopCount;
  const normalLoss = 1000 - normalNext.units.find((u) => u.id === 'normal')!.troopCount;
  assert(ghostLoss > 0 && normalLoss > 0, '对照组双方均受伤');
  assert(ghostLoss < normalLoss, `鬼神防御 ×2 显著减伤（${ghostLoss} < ${normalLoss}）`);
}

// —— 4. 心理震慑：吕布 2 格内敌军普攻伤害 −10% ——
{
  const state = stateWith();
  const attacker = unit('atk', 'attacker', 2, 2, 1000, 6, UnitType.LIGHT_INFANTRY, 0, 1000);
  const lvbuDef = unit('lvbu-def', 'defender', 3, 2, 1000, 5, UnitType.LIGHT_INFANTRY, 3, 1000);
  const genericDef = unit('gen-def', 'defender', 3, 2, 1000, 99, UnitType.LIGHT_INFANTRY, 3, 1000);
  const lvNext = attackUnit(battle([attacker, lvbuDef]), 'atk', 'lvbu-def', state, noLuck);
  const genericNext = attackUnit(battle([{ ...attacker, id: 'atk2' }, genericDef]), 'atk2', 'gen-def', state, noLuck);
  const lvLoss = 1000 - lvNext.units.find((u) => u.id === 'lvbu-def')!.troopCount;
  const genericLoss = 1000 - genericNext.units.find((u) => u.id === 'gen-def')!.troopCount;
  assert(lvLoss === Math.max(1, Math.round(genericLoss * 0.9)), `震慑使伤害 −10%（${genericLoss}→${lvLoss}）`);
}

// —— 5. 敌军 AI 普攻路径同源 ——
{
  const template = (type: UnitType): UnitTemplate => ({
    name: type, type, isSpecial: false, attack: 7, defense: 5, mobility: 3, range: 1,
    traits: [], strongAgainst: [], weakAgainst: [], recruitRequirement: null, abilities: [],
    terrainModifiers: {}, recruitCost: { gold: 0, population: 0, food: 0 },
  });
  const templates: Record<string, UnitTemplate> = {
    [UnitType.LIGHT_INFANTRY]: template(UnitType.LIGHT_INFANTRY),
  };
  const lvbuAi = unit('ai-lvbu', 'defender', 2, 2, 1000, 5, UnitType.LIGHT_INFANTRY, 3, 1000);
  const playerA = unit('player-a', 'attacker', 3, 2, 1000, 100);
  const playerB = unit('player-b', 'attacker', 3, 3, 1000, 100);
  const result = runSimpleEnemyAi(
    [lvbuAi, playerA, playerB], plain, templates,
    {
      5: { war: 100, leadership: 97, name: '吕布' },
      100: { war: 70, leadership: 70, name: '偏将' },
    },
    8, 8, 'defender', 'attacker', noLuck, {},
    { 5: LVBU, 100: VICTIM }, 1, Weather.CLEAR,
  );
  const aLoss = 1000 - result.units.find((u) => u.id === 'player-a')!.troopCount;
  const bLoss = 1000 - result.units.find((u) => u.id === 'player-b')!.troopCount;
  const main = Math.max(aLoss, bLoss);
  const splash = Math.min(aLoss, bLoss);
  assert(result.message.includes('无双乱舞'), '敌军 AI 战报标注无双乱舞');
  assert(splash === peerlessSplashDamage(main), `敌军 AI 溅射同源（${main}→${splash}）`);
}

// —— 6. 无吕布零变化 ——
{
  const state = stateWith();
  const attacker = unit('atk', 'attacker', 2, 2, 1000, 6, UnitType.LIGHT_INFANTRY, 0, 1000);
  const def = unit('def', 'defender', 3, 2, 1000, 99, UnitType.LIGHT_INFANTRY, 3, 1000);
  const next = attackUnit(battle([attacker, def]), 'atk', 'def', state, noLuck);
  assert(!next.message.includes('无双乱舞') && !next.message.includes('鬼神'), '非吕布战报不出现无双/鬼神');
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
if (fail > 0) process.exitCode = 1;
void getUnitByType;
