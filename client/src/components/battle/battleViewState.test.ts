// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { FormationType, UnitType, Weather, type BattleState, type BattleUnit } from '@leh/shared';
import { filterVisibleTacticalUnits, isActiveTacticalUnit, isBattleSideCardUnit, visibleEnemyIdsForPlayer } from './battleViewState';

function unit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'unit-1',
    armyId: 'army-1',
    commanderId: 1,
    commanderName: '测试将',
    factionId: 1,
    side: 'attacker',
    unitType: UnitType.LIGHT_INFANTRY,
    formation: FormationType.SQUARE,
    troopCount: 500,
    maxTroops: 1000,
    morale: 20,
    food: 100,
    position: { q: 1, r: 1 },
    facing: 0,
    mp: 0,
    maxMp: 4,
    energy: 80,
    maxEnergy: 100,
    hasActed: true,
    isRetreated: false,
    isDestroyed: false,
    statusEffects: [],
    ...overrides,
  };
}

describe('BattleView tactical unit boundary', () => {
  it('does not expose a retreated unit as an active tactical unit', () => {
    const retreated = unit({ isRetreated: true });

    expect(isActiveTacticalUnit(retreated)).toBe(false);
    expect(isBattleSideCardUnit(retreated)).toBe(true);
  });

  it('keeps destroyed or empty units out of both active actions and side cards', () => {
    expect(isActiveTacticalUnit(unit({ isDestroyed: true }))).toBe(false);
    expect(isBattleSideCardUnit(unit({ isDestroyed: true }))).toBe(false);
    expect(isActiveTacticalUnit(unit({ troopCount: 0 }))).toBe(false);
    expect(isBattleSideCardUnit(unit({ troopCount: 0 }))).toBe(false);
  });
});

describe('BattleView tactical sight projection（S10 §三十）', () => {
  const plainGrid = {
    width: 10,
    height: 10,
    terrain: Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => 'plain' as const)),
  };

  function battleOf(units: BattleUnit[], weather = Weather.CLEAR): BattleState {
    return {
      units,
      hexGrid: plainGrid,
      weather,
    } as unknown as BattleState;
  }

  it('视野外守方单位被投影过滤，视野内保留；攻方单位永不过滤', () => {
    const nearEnemy = unit({ id: 'd-near', side: 'defender', position: { q: 4, r: 0 } });
    const farEnemy = unit({ id: 'd-far', side: 'defender', position: { q: 9, r: 0 } });
    const ally = unit({ id: 'a-1', side: 'attacker', position: { q: 0, r: 0 } });
    const battle = battleOf([ally, nearEnemy, farEnemy]);

    const ids = visibleEnemyIdsForPlayer(battle);
    expect(ids.has('d-near')).toBe(true);
    expect(ids.has('d-far')).toBe(false);

    const visibleUnits = filterVisibleTacticalUnits(battle.units, ids);
    expect(visibleUnits.map((u) => u.id)).toEqual(['a-1', 'd-near']);
  });

  it('雪天视野收紧：距离 2 的守方也不可见', () => {
    const enemy = unit({ id: 'd-2', side: 'defender', position: { q: 2, r: 0 } });
    const ally = unit({ id: 'a-1', side: 'attacker', position: { q: 0, r: 0 } });
    const battle = battleOf([ally, enemy], Weather.SNOW);

    const ids = visibleEnemyIdsForPlayer(battle);
    expect(ids.has('d-2')).toBe(false);
    expect(filterVisibleTacticalUnits([enemy], ids)).toEqual([]);
  });
});
