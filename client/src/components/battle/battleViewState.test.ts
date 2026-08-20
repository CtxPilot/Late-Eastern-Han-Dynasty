// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { FormationType, UnitType, type BattleUnit } from '@leh/shared';
import { isActiveTacticalUnit, isBattleSideCardUnit } from './battleViewState';

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
