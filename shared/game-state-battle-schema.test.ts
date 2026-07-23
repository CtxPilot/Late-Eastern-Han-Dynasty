// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { FormationType, TerrainType, UnitType, Weather } from './enums/index.js';
import { BattlefieldMapRuntimeSchema, BattleStateRuntimeSchema, GameStateBattleSchema, MeleeStateRuntimeSchema } from './game-state-battle-schema.js';

const emptyCombatSlice = { activeBattles: [], activeBattlefield: null, activeMelee: null };

function validBattlefield() {
  return {
    id: 'bf-13-15', warId: 'war-13', attackerFactionId: 2, defenderFactionId: 1, targetCityId: 13,
    nodes: [
      { id: 15, name: '襄阳', type: 'major_city' as const, x: 0, y: 0, ruler: 2, adjacentNodeIds: [13], garrison: 1000, wallDurability: 100, maxWallDurability: 100, armyIds: ['atk'], traps: [] },
      { id: 13, name: '宛', type: 'major_city' as const, x: 1, y: 0, ruler: 1, adjacentNodeIds: [15], garrison: 1000, wallDurability: 100, maxWallDurability: 100, armyIds: ['def'], traps: [] },
    ],
    armyIds: ['atk', 'def'], turn: 0, phase: 'active' as const,
  };
}

function validMelee() {
  return {
    battlefieldId: 'bf-13-15', attackerArmyId: 'atk', defenderArmyId: 'def', attackerFactionId: 2, defenderFactionId: 1,
    round: 0, maxRounds: 20, attackerTroops: 3000, attackerMorale: 85, attackerFatigue: 0, attackerFormation: FormationType.WEDGE,
    defenderTroops: 2000, defenderMorale: 85, defenderFatigue: 0, defenderFormation: FormationType.SQUARE,
    tacticalPoints: 6, tacticalPointsUsed: 0, phase: 'active' as const, eventLog: [],
  };
}

function validBattle() {
  return {
    id: 'battle-13-1', turn: 1, weather: Weather.CLEAR,
    attackerFaction: 2, defenderFaction: 1, isSiege: true,
    cityId: 13, fromCityId: 15, settled: false,
    units: [
      { id: 'atk-1', armyId: 'a1', commanderId: 6, commanderName: '关羽', factionId: 2, side: 'attacker' as const,
        unitType: UnitType.HEAVY_CAVALRY, formation: FormationType.WEDGE,
        troopCount: 4000, maxTroops: 4000, morale: 90, food: 1000,
        position: { q: 2, r: 3 }, mp: 6, maxMp: 6, energy: 100, maxEnergy: 100,
        hasActed: false, isRetreated: false, isDestroyed: false, statusEffects: [] },
      { id: 'def-1', armyId: 'd1', commanderId: 1, commanderName: '曹操', factionId: 1, side: 'defender' as const,
        unitType: UnitType.HEAVY_INFANTRY, formation: FormationType.SQUARE,
        troopCount: 3000, maxTroops: 3000, morale: 80, food: 1000,
        position: { q: 16, r: 11 }, mp: 3, maxMp: 3, energy: 100, maxEnergy: 100,
        hasActed: false, isRetreated: false, isDestroyed: false, statusEffects: [] },
    ],
    phase: 'player' as const, winner: null,
    hexGrid: { width: 2, height: 2, terrain: [[TerrainType.PLAIN, TerrainType.FOREST], [TerrainType.PLAIN, TerrainType.WATER]] },
    log: [{ turn: 1, message: '开战' }], message: '开战',
  };
}

describe('GameStateBattleSchema', () => {
  it('parses an active tactical battle', () => {
    const battle = validBattle();
    battle.units[0]!.position = { q: 0, r: 0 };
    battle.units[1]!.position = { q: 1, r: 1 };
    expect(GameStateBattleSchema.parse({ ...emptyCombatSlice, activeBattles: [battle] }).activeBattles).toHaveLength(1);
  });

  it('rejects resource values above runtime capacity', () => {
    const battle = validBattle();
    battle.units[0]!.troopCount = 4001;
    expect(() => BattleStateRuntimeSchema.parse(battle)).toThrow(/兵力不能超过上限/);
  });

  it('requires a non-empty commander name snapshot for battle presentation', () => {
    const battle = validBattle();
    battle.units[1]!.commanderName = '';
    expect(() => BattleStateRuntimeSchema.parse(battle)).toThrow();
  });

  it('rejects malformed terrain dimensions and out-of-bounds units', () => {
    expect(() => BattleStateRuntimeSchema.parse(validBattle())).toThrow(/坐标超出战场边界/);
    const battle = validBattle();
    battle.units[0]!.position = { q: 0, r: 0 };
    battle.units[1]!.position = { q: 1, r: 1 };
    battle.hexGrid.terrain = [[TerrainType.PLAIN]];
    expect(() => BattleStateRuntimeSchema.parse(battle)).toThrow(/地形尺寸/);
  });

  it('rejects inconsistent phase, winner, faction and duplicate ids', () => {
    const base = validBattle();
    base.units[0]!.position = { q: 0, r: 0 };
    base.units[1]!.position = { q: 1, r: 1 };
    expect(() => BattleStateRuntimeSchema.parse({ ...base, phase: 'over', winner: null })).toThrow(/必须有胜方/);
    expect(() => BattleStateRuntimeSchema.parse({ ...base, units: [base.units[0], { ...base.units[1], factionId: 2 }] })).toThrow(/攻守方不一致/);
    expect(() => GameStateBattleSchema.parse({ ...emptyCombatSlice, activeBattles: [base, { ...base }] })).toThrow(/id 不能重复/);
  });

  it('parses a battlefield and its active melee child', () => {
    expect(BattlefieldMapRuntimeSchema.parse(validBattlefield()).nodes).toHaveLength(2);
    expect(MeleeStateRuntimeSchema.parse(validMelee()).tacticalPoints).toBe(6);
    expect(GameStateBattleSchema.parse({ activeBattles: [], activeBattlefield: validBattlefield(), activeMelee: validMelee() }).activeMelee?.battlefieldId).toBe('bf-13-15');
  });

  it('rejects orphaned or mismatched melee state and invalid battlefield references', () => {
    expect(() => GameStateBattleSchema.parse({ activeBattles: [], activeBattlefield: null, activeMelee: validMelee() })).toThrow(/必须归属于活跃战场/);
    expect(() => GameStateBattleSchema.parse({ activeBattles: [], activeBattlefield: validBattlefield(), activeMelee: { ...validMelee(), battlefieldId: 'other' } })).toThrow(/必须匹配活跃战场/);
    expect(() => BattlefieldMapRuntimeSchema.parse({ ...validBattlefield(), armyIds: ['atk'] })).toThrow(/必须属于当前战场/);
  });
});
