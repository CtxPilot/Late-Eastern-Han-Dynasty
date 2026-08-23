// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { TerrainType, Weather, type BattleState, type BattleUnit } from './index.js';
import { BASE_SIGHT_RANGE, computeVisibleEnemyUnitIds, effectiveSightRange, hexDistance } from './battle-sight.js';

function unit(id: string, side: 'attacker' | 'defender', q: number, r: number, extra: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id,
    armyId: `${side}-army`,
    commanderId: Number(id.replace(/\D/g, '')) || 1,
    commanderName: id,
    factionId: side === 'attacker' ? 1 : 2,
    side,
    position: { q, r },
    facing: 0,
    formation: 0,
    maxMp: 6,
    mp: 0,
    hasActed: false,
    isRetreated: false,
    troopCount: 1000,
    ...extra,
  } as BattleUnit;
}

function battle(units: BattleUnit[], terrain: TerrainType[][], weather = Weather.CLEAR): Pick<BattleState, 'units' | 'hexGrid' | 'weather'> {
  return {
    units,
    hexGrid: { width: terrain[0]?.length ?? 1, height: terrain.length, terrain },
    weather,
  };
}

const PLAIN_10x10 = Array.from({ length: 10 }, () => Array.from({ length: 10 }, () => TerrainType.PLAIN));

describe('effectiveSightRange（08 §三十）', () => {
  it('基线：平原晴天视野 4', () => {
    expect(effectiveSightRange(TerrainType.PLAIN, Weather.CLEAR)).toBe(4);
    expect(BASE_SIGHT_RANGE).toBe(4);
  });

  it('地形修正：山地 +1、森林 −1、其余中性', () => {
    expect(effectiveSightRange(TerrainType.MOUNTAIN, Weather.CLEAR)).toBe(5);
    expect(effectiveSightRange(TerrainType.FOREST, Weather.CLEAR)).toBe(3);
    expect(effectiveSightRange(TerrainType.WATER, Weather.CLEAR)).toBe(4);
    expect(effectiveSightRange(TerrainType.CITY, Weather.CLEAR)).toBe(4);
  });

  it('天气修正：雾 −2、雪 −3，雨/暴雨/阴中性', () => {
    expect(effectiveSightRange(TerrainType.PLAIN, Weather.FOG)).toBe(2);
    expect(effectiveSightRange(TerrainType.PLAIN, Weather.SNOW)).toBe(1);
    expect(effectiveSightRange(TerrainType.PLAIN, Weather.RAIN)).toBe(4);
    expect(effectiveSightRange(TerrainType.PLAIN, Weather.STORM)).toBe(4);
    expect(effectiveSightRange(TerrainType.PLAIN, Weather.CLOUDY)).toBe(4);
  });

  it('下限夹紧：森林雪天 max(1, 4-1-3)=1', () => {
    expect(effectiveSightRange(TerrainType.FOREST, Weather.SNOW)).toBe(1);
  });
});

describe('hexDistance', () => {
  it('轴向坐标六角距离', () => {
    expect(hexDistance({ q: 0, r: 0 }, { q: 3, r: 0 })).toBe(3);
    expect(hexDistance({ q: 0, r: 0 }, { q: 2, r: -2 })).toBe(2);
    expect(hexDistance({ q: 1, r: 1 }, { q: 3, r: 3 })).toBe(4);
    expect(hexDistance({ q: 2, r: 2 }, { q: 2, r: 2 })).toBe(0);
  });
});

describe('computeVisibleEnemyUnitIds', () => {
  it('距离 ≤ 视野的敌军可见，超出不可见', () => {
    const b = battle(
      [unit('a1', 'attacker', 0, 0), unit('d1', 'defender', 4, 0), unit('d2', 'defender', 5, 0)],
      PLAIN_10x10,
    );
    const vis = computeVisibleEnemyUnitIds(b, 'attacker');
    expect(vis.has('d1')).toBe(true);
    expect(vis.has('d2')).toBe(false);
  });

  it('山地观察者 +1：距离 5 的敌军可见', () => {
    const grid = PLAIN_10x10.map((row, r) => row.map((t, q) => (r === 0 && q === 0 ? TerrainType.MOUNTAIN : t)));
    const b = battle([unit('a1', 'attacker', 0, 0), unit('d1', 'defender', 5, 0)], grid);
    expect(computeVisibleEnemyUnitIds(b, 'attacker').has('d1')).toBe(true);
  });

  it('森林观察者 −1：距离 4 的敌军不可见', () => {
    const grid = PLAIN_10x10.map((row, r) => row.map((t, q) => (r === 0 && q === 0 ? TerrainType.FOREST : t)));
    const b = battle([unit('a1', 'attacker', 0, 0), unit('d1', 'defender', 4, 0)], grid);
    expect(computeVisibleEnemyUnitIds(b, 'attacker').has('d1')).toBe(false);
  });

  it('雪天平原视野 1：距离 2 即不可见', () => {
    const b = battle(
      [unit('a1', 'attacker', 0, 0), unit('d1', 'defender', 1, 0), unit('d2', 'defender', 2, 0)],
      PLAIN_10x10,
      Weather.SNOW,
    );
    const vis = computeVisibleEnemyUnitIds(b, 'attacker');
    expect(vis.has('d1')).toBe(true);
    expect(vis.has('d2')).toBe(false);
  });

  it('多观察者取最近：任一我方看见即整队可见', () => {
    const grid = PLAIN_10x10.map((row, r) => row.map((t, q) => (r === 5 && q === 5 ? TerrainType.MOUNTAIN : t)));
    const b = battle(
      [unit('a1', 'attacker', 0, 0), unit('a2', 'attacker', 5, 5), unit('d1', 'defender', 9, 5)],
      grid,
    );
    // a1(平原,视野4)：dist 9 不可见；a2(山地,视野5)：dist 4 可见
    expect(computeVisibleEnemyUnitIds(b, 'attacker').has('d1')).toBe(true);
  });

  it('己方单位与已溃/重创敌军不进入可见集', () => {
    const b = battle(
      [
        unit('a1', 'attacker', 0, 0),
        unit('d1', 'defender', 1, 0),
        unit('d2', 'defender', 1, 1, { isDestroyed: true }),
        unit('d3', 'defender', 2, 0, { isRetreated: true }),
      ],
      PLAIN_10x10,
    );
    const vis = computeVisibleEnemyUnitIds(b, 'attacker');
    expect(vis.size).toBe(1);
    expect(vis.has('d1')).toBe(true);
  });

  it('防守方视角对称可用', () => {
    const b = battle([unit('d1', 'defender', 0, 0), unit('a1', 'attacker', 3, 0)], PLAIN_10x10);
    expect(computeVisibleEnemyUnitIds(b, 'defender').has('a1')).toBe(true);
  });
});
