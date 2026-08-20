// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 正式特殊兵种熟练度：使用次数→威力，记账，适性门禁。
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
  emptyIntel,
  getUnitAbilityUses,
  resolveProficiencyPower,
  type BattleState,
  type GameState,
  type Officer,
} from '@leh/shared';
import { castAbility, getUsableAbilities } from '../engine/battle.js';
import { getUnitByType, staticData } from '../data/loader.js';

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

console.log('verify-special-proficiency');
console.log(`  data units=${staticData.units.length}`);

const rush = (getUnitByType()[UnitType.LIGHT_CAVALRY]?.abilities ?? []).find((a) => a.id === 'cav_proficient_rush');
check('轻骑兵含骑突 proficiency 演示战法', Boolean(rush && rush.leveling === 'proficiency'));
check('威力公式 0 次=base', Math.abs(resolveProficiencyPower(1.2, 1.8, 0) - 1.2) < 1e-9);
check('威力公式 50 次=max', Math.abs(resolveProficiencyPower(1.2, 1.8, 50) - 1.8) < 1e-9);

function stubOfficer(id: number, name: string, cav: UnitProficiency, uses = 0): Officer {
  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: { leadership: 80, war: 80, intelligence: 70, politics: 60, charisma: 60 },
    hidden: {
      compatibility: 50, righteousness: 5, ambition: 5, valor: 5, composure: 5,
      lifespan: 220, growth: GrowthPotential.MID, personality: Personality.CALM, ideal: Ideal.HEGEMONY,
      bloodline: [], ceilingBonus: null, power: 50, burst: 50, agility: 50, luck: 50,
      intuition: 50, awe: 50, strategy: 50, tactics: 50,
    },
    unitProficiency: { [UnitType.LIGHT_CAVALRY]: cav },
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
    unitUsageRecords: uses > 0
      ? [{ unitType: UnitType.LIGHT_CAVALRY, battlesUsed: 0, breakpointsHit: 0, bestFormationMatches: 0, abilityUses: uses }]
      : undefined,
  };
}

function baseBattle(): BattleState {
  return {
    id: 't',
    turn: 1,
    weather: Weather.CLEAR,
    attackerFaction: 1,
    defenderFaction: 2,
    isSiege: false,
    cityId: 1,
    units: [
      {
        id: 'atk-1', armyId: 'a', commanderId: 1, commanderName: '骑将', factionId: 1, side: 'attacker',
        unitType: UnitType.LIGHT_CAVALRY, formation: FormationType.WEDGE, troopCount: 4000, maxTroops: 4000,
        morale: 80, food: 1000, position: { q: 5, r: 5 }, facing: 0, mp: 7, maxMp: 7, energy: 100, maxEnergy: 100,
        hasActed: false, isRetreated: false, isDestroyed: false, statusEffects: [],
      },
      {
        id: 'def-1', armyId: 'd', commanderId: 99, commanderName: '守将', factionId: 2, side: 'defender',
        unitType: UnitType.SPEARMAN, formation: FormationType.SQUARE, troopCount: 3000, maxTroops: 3000,
        morale: 70, food: 800, position: { q: 6, r: 5 }, facing: 3, mp: 4, maxMp: 4, energy: 100, maxEnergy: 100,
        hasActed: false, isRetreated: false, isDestroyed: false, statusEffects: [],
      },
    ],
    hexGrid: {
      width: 20, height: 15,
      terrain: Array.from({ length: 15 }, () => Array.from({ length: 20 }, () => TerrainType.PLAIN)),
    },
    phase: 'player',
    winner: null,
    message: '',
    log: [],
  };
}

function baseState(officer: Officer): GameState {
  return {
    scenarioId: 1,
    enabledEventLayers: ['gameplay'],
    enabledChildEventIds: [],
    currentYear: 190,
    currentMonth: 1,
    season: 0,
    playerFactionId: 1,
    officers: { 1: officer, 99: stubOfficer(99, '守将', UnitProficiency.C) },
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

{
  const o = stubOfficer(1, '骑将', UnitProficiency.NONE);
  const usable = getUsableAbilities(baseState(o), baseBattle(), 'atk-1');
  check('NONE 适性不可用任何战法', usable.length === 0);
}

{
  const o = stubOfficer(1, '骑将', UnitProficiency.A, 0);
  const usable = getUsableAbilities(baseState(o), baseBattle(), 'atk-1');
  const rushRow = usable.find((u) => u.ability.id === 'cav_proficient_rush');
  check('A 适性可列出骑突', Boolean(rushRow));
  check('0 次威力≈basePower', Boolean(rushRow && Math.abs(rushRow.levelData.power - 1.2) < 1e-6));
}

{
  const o = stubOfficer(1, '骑将', UnitProficiency.A, 50);
  const usable = getUsableAbilities(baseState(o), baseBattle(), 'atk-1');
  const rushRow = usable.find((u) => u.ability.id === 'cav_proficient_rush');
  check('50 次威力≈maxPower', Boolean(rushRow && Math.abs(rushRow.levelData.power - 1.8) < 1e-6));
}

{
  const o = stubOfficer(1, '骑将', UnitProficiency.B, 0);
  const state = baseState(o);
  const next = castAbility(baseBattle(), 'atk-1', 'def-1', 'cav_proficient_rush', state, () => 0.01);
  check('施放后交权敌军', next.phase === 'enemy');
  check('扣气并记账', getUnitAbilityUses(state.officers[1], UnitType.LIGHT_CAVALRY) === 1);
  check('失手也记账', (() => {
    const o2 = stubOfficer(1, '骑将', UnitProficiency.B, 3);
    const s2 = baseState(o2);
    castAbility(baseBattle(), 'atk-1', 'def-1', 'cav_proficient_rush', s2, () => 0.99);
    return getUnitAbilityUses(s2.officers[1], UnitType.LIGHT_CAVALRY) === 4;
  })());
}

console.log(`\n结果：${passed} 通过 / ${failed} 失败`);
if (failed > 0) process.exit(1);
