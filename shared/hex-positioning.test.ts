// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { FormationType, UnitType, type BattleUnit } from './index.js';
import { resolveHexSurround } from './hex-positioning.js';

function unit(
  id: string,
  side: 'attacker' | 'defender',
  position: { q: number; r: number },
  facing: 0 | 1 | 2 | 3 | 4 | 5,
): BattleUnit {
  return {
    id,
    armyId: `${side}-army`,
    commanderId: Number(id.replace(/\D/g, '')) || 1,
    commanderName: id,
    factionId: side === 'attacker' ? 1 : 2,
    side,
    unitType: UnitType.HEAVY_INFANTRY,
    formation: FormationType.SQUARE,
    troopCount: 1000,
    maxTroops: 1000,
    morale: 80,
    food: 100,
    position,
    facing,
    mp: 5,
    maxMp: 5,
    energy: 100,
    maxEnergy: 100,
    hasActed: false,
    isRetreated: false,
    isDestroyed: false,
    statusEffects: [],
  };
}

describe('hex positioning', () => {
  it('单支相邻敌军不构成协同包围', () => {
    const result = resolveHexSurround([
      unit('a1', 'attacker', { q: 3, r: 3 }, 0),
      unit('d1', 'defender', { q: 4, r: 3 }, 3),
    ], 'a1');
    expect(result.isSurrounded).toBe(false);
    expect(result.enemyUnitIds).toEqual(['d1']);
  });

  it('两支不同方向且朝向目标的敌军构成包围', () => {
    const result = resolveHexSurround([
      unit('a1', 'attacker', { q: 3, r: 3 }, 0),
      unit('d1', 'defender', { q: 4, r: 3 }, 3),
      unit('d2', 'defender', { q: 3, r: 4 }, 2),
    ], 'a1');
    expect(result.isSurrounded).toBe(true);
    expect(result.enemyUnitIds).toEqual(['d1', 'd2']);
    expect(result.enemyDirections).toHaveLength(2);
  });

  it('背向目标的贴邻敌军不计入包围', () => {
    const result = resolveHexSurround([
      unit('a1', 'attacker', { q: 3, r: 3 }, 0),
      unit('d1', 'defender', { q: 4, r: 3 }, 0),
      unit('d2', 'defender', { q: 3, r: 4 }, 5),
    ], 'a1');
    expect(result.isSurrounded).toBe(false);
    expect(result.enemyUnitIds).toEqual([]);
  });

  it('被击破或已撤退单位不参与包围', () => {
    const live = unit('d1', 'defender', { q: 4, r: 3 }, 3);
    const destroyed = { ...unit('d2', 'defender', { q: 3, r: 4 }, 2), isDestroyed: true };
    const retreated = { ...unit('d3', 'defender', { q: 2, r: 3 }, 0), isRetreated: true };
    const result = resolveHexSurround([unit('a1', 'attacker', { q: 3, r: 3 }, 0), live, destroyed, retreated], 'a1');
    expect(result.isSurrounded).toBe(false);
    expect(result.enemyUnitIds).toEqual(['d1']);
  });
});
