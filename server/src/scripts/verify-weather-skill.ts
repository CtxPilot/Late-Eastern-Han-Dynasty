// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 天气主动技能冒烟：诸葛亮/司马懿专属、气力、同天气拒绝、倒计时重置、交权敌军。
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
  WEATHER_ACTIVE_TIMER_RESET,
  emptyIntel,
  weatherActiveEnergyCost,
  type BattleState,
  type GameState,
  type Officer,
} from '@leh/shared';
import { castWeatherSkill } from '../engine/battle.js';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean): void {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function stubOfficer(id: number, name: string): Officer {
  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: {
      leadership: 90,
      war: 40,
      intelligence: 100,
      politics: 90,
      charisma: 80,
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
    skills: [],
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

function baseBattle(commanderId: number, weather: Weather = Weather.CLEAR, energy = 100): BattleState {
  const name = commanderId === 4 ? '诸葛亮' : commanderId === 12 ? '司马懿' : '普通将';
  return {
    id: 't',
    turn: 1,
    weather,
    weatherChangeTimer: 3,
    attackerFaction: 1,
    defenderFaction: 2,
    isSiege: true,
    cityId: 1,
    units: [
      {
        id: 'atk-1',
        armyId: 'a',
        commanderId,
        commanderName: name,
        factionId: 1,
        side: 'attacker',
        unitType: UnitType.SPEARMAN,
        formation: FormationType.SQUARE,
        troopCount: 5000,
        maxTroops: 5000,
        morale: 80,
        food: 1000,
        position: { q: 4, r: 7 },
        facing: 0,
        mp: 5,
        maxMp: 5,
        energy,
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
        commanderName: '守将',
        factionId: 2,
        side: 'defender',
        unitType: UnitType.SPEARMAN,
        formation: FormationType.SQUARE,
        troopCount: 4000,
        maxTroops: 4000,
        morale: 70,
        food: 800,
        position: { q: 10, r: 7 },
        facing: 3,
        mp: 5,
        maxMp: 5,
        energy: 100,
        maxEnergy: 100,
        hasActed: false,
        isRetreated: false,
        isDestroyed: false,
        statusEffects: [],
      },
    ],
    hexGrid: {
      width: 20,
      height: 15,
      terrain: Array.from({ length: 15 }, () => Array.from({ length: 20 }, () => TerrainType.PLAIN)),
    },
    phase: 'player',
    winner: null,
    message: '',
    log: [],
  };
}

function baseState(officers: Officer[]): GameState {
  const map: Record<number, Officer> = {};
  for (const o of officers) map[o.id] = o;
  return {
    scenarioId: 1,
    enabledEventLayers: ['gameplay'],
    enabledChildEventIds: [],
    currentYear: 190,
    currentMonth: 1,
    season: 0,
    playerFactionId: 1,
    officers: map,
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
  } as unknown as GameState;
}

console.log('verify-weather-skill');

check('诸葛亮气力半额（神算代理）', weatherActiveEnergyCost(4) === 20);
check('司马懿气力全额', weatherActiveEnergyCost(12) === 40);

{
  const state = baseState([stubOfficer(4, '诸葛亮'), stubOfficer(99, '守将')]);
  const next = castWeatherSkill(baseBattle(4), 'atk-1', Weather.RAIN, state);
  check('诸葛亮可切雨', next.weather === Weather.RAIN);
  check('倒计时重置为 5', next.weatherChangeTimer === WEATHER_ACTIVE_TIMER_RESET);
  check('扣气 20', next.units.find((u) => u.id === 'atk-1')!.energy === 80);
  check('已行动', next.units.find((u) => u.id === 'atk-1')!.hasActed === true);
  check('交权敌军', next.phase === 'enemy');
  check('战报含借东风', next.log.some((e) => e.message.includes('借东风') && e.message.includes('雨')));
}

{
  const state = baseState([stubOfficer(12, '司马懿'), stubOfficer(99, '守将')]);
  const next = castWeatherSkill(baseBattle(12, Weather.FOG), 'atk-1', Weather.SNOW, state);
  check('司马懿可切雪', next.weather === Weather.SNOW);
  check('司马懿扣气 40', next.units.find((u) => u.id === 'atk-1')!.energy === 60);
  check('战报含观天', next.log.some((e) => e.message.includes('观天')));
}

{
  const state = baseState([stubOfficer(4, '诸葛亮'), stubOfficer(99, '守将')]);
  let rejected = false;
  try {
    castWeatherSkill(baseBattle(4), 'atk-1', Weather.CLEAR, state);
  } catch {
    rejected = true;
  }
  check('同天气拒绝', rejected);
}

{
  const state = baseState([stubOfficer(1, '普通将'), stubOfficer(99, '守将')]);
  let rejected = false;
  try {
    castWeatherSkill(baseBattle(1), 'atk-1', Weather.RAIN, state);
  } catch (e) {
    rejected = e instanceof Error && e.message.includes('观天专属');
  }
  check('非专属将拒绝', rejected);
}

{
  const state = baseState([stubOfficer(4, '诸葛亮'), stubOfficer(99, '守将')]);
  let rejected = false;
  try {
    castWeatherSkill(baseBattle(4, Weather.CLEAR, 10), 'atk-1', Weather.RAIN, state);
  } catch (e) {
    rejected = e instanceof Error && e.message.includes('气力不足');
  }
  check('气力不足拒绝', rejected);
}

{
  const state = baseState([stubOfficer(4, '诸葛亮'), stubOfficer(99, '守将')]);
  const paused = { ...baseBattle(4), duel: { phase: 'dueling' } as never };
  let rejected = false;
  try {
    castWeatherSkill(paused, 'atk-1', Weather.RAIN, state);
  } catch (e) {
    rejected = e instanceof Error && e.message.includes('DUEL_BATTLE_PAUSED');
  }
  check('单挑暂停拒绝', rejected);
}

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
if (failed > 0) process.exit(1);
