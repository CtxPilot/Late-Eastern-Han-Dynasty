// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 火计冒烟：castFireTactic 成功路径 + 气力消耗 + 雪天禁用
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
  Weather,
  emptyIntel,
  type BattleState,
  type GameState,
  type Officer,
} from '@leh/shared';
import { castFireTactic } from '../engine/battle.js';

function stubOfficer(id: number, name: string, intelligence: number, fireLv: number): Officer {
  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: {
      leadership: 80,
      war: 70,
      intelligence,
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
    skills: fireLv > 0 ? [{ skillId: 'fire', level: fireLv, useCount: 0 }] : [],
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

function baseBattle(weather: Weather = Weather.CLEAR): BattleState {
  return {
    id: 't',
    turn: 1,
    weather,
    attackerFaction: 1,
    defenderFaction: 2,
    isSiege: true,
    cityId: 1,
    units: [
      {
        id: 'atk-1',
        armyId: 'a',
        commanderId: 4,
        factionId: 1,
        side: 'attacker',
        unitType: UnitType.HEAVY_CAVALRY,
        formation: FormationType.WEDGE,
        troopCount: 5000,
        maxTroops: 5000,
        morale: 90,
        food: 1000,
        position: { q: 5, r: 5 },
        mp: 5,
        maxMp: 5,
        energy: 100,
        maxEnergy: 100,
        hasActed: false,
        isRetreated: false,
        isDestroyed: false,
        statusEffects: [],
      },
      {
        id: 'def-1',
        armyId: 'd',
        commanderId: 99,
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
      terrain: Array.from({ length: 15 }, () =>
        Array.from({ length: 20 }, () => TerrainType.FOREST),
      ),
    },
    log: [],
    message: '',
  };
}

function baseState(): GameState {
  return {
    scenarioId: 1,
    enabledEventLayers: ['gameplay'],
    enabledChildEventIds: [],
    currentYear: 190,
    currentMonth: 1,
    season: 0,
    playerFactionId: 1,
    officers: {
      4: stubOfficer(4, '诸葛亮', 100, 3),
      99: stubOfficer(99, '守将', 50, 0),
    },
    cities: {},
    factions: {},
    females: {},
    armys: [],
    campaignArmies: [],
    campaignNodes: [],
    grandStrategists: [],
    activeBattles: [],
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

function assert(c: unknown, m: string): asserts c {
  if (!c) throw new Error(m);
}

// 成功命中
{
  const next = castFireTactic(baseBattle(), 'atk-1', 'def-1', baseState(), () => 0.01);
  const atk = next.units.find((u) => u.id === 'atk-1')!;
  const def = next.units.find((u) => u.id === 'def-1')!;
  assert(atk.energy === 70, `气力应扣30 得 ${atk.energy}`);
  assert(atk.hasActed, '应已行动');
  assert(def.troopCount < 5000, '应造成伤害');
  assert(next.message.includes('火计'), `消息应含火计: ${next.message}`);
}

// 失手
{
  const next = castFireTactic(baseBattle(), 'atk-1', 'def-1', baseState(), () => 0.99);
  assert(next.message.includes('失败'), next.message);
  assert(next.units.find((u) => u.id === 'atk-1')!.energy === 70, '失败也耗气');
}

// 雪天
{
  let threw = false;
  try {
    castFireTactic(baseBattle(Weather.SNOW), 'atk-1', 'def-1', baseState(), () => 0);
  } catch {
    threw = true;
  }
  assert(threw, '雪天应抛错');
}

// 气力不足
{
  const b = baseBattle();
  b.units[0].energy = 10;
  let threw = false;
  try {
    castFireTactic(b, 'atk-1', 'def-1', baseState(), () => 0);
  } catch {
    threw = true;
  }
  assert(threw, '气力不足应抛错');
}

console.log('OK verify-fire-tactic: 4 cases passed');
