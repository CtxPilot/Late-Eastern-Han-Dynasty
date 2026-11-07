// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  TROOP_LEVEL_MORALE_FLOOR,
  TROOP_LEVEL_THRESHOLDS,
  TROOP_XP_OUTNUMBERED_RATIO,
  dilutedTroopXp,
  troopBattleXpGain,
  troopLevelFor,
  troopLevelInfo,
  troopLevelLabel,
  troopMoraleFloor,
  troopXpAfterBattle,
  troopXpAfterWipe,
} from './troop-level.js';

describe('P5-14 部队等级（0-A，Session 456）', () => {
  it('七级阈值与等级名称', () => {
    expect(TROOP_LEVEL_THRESHOLDS).toEqual([0, 100, 300, 600, 1000, 1800, 3000]);
    expect(troopLevelFor(0)).toBe(1);
    expect(troopLevelFor(99)).toBe(1);
    expect(troopLevelFor(100)).toBe(2);
    expect(troopLevelFor(299)).toBe(2);
    expect(troopLevelFor(300)).toBe(3);
    expect(troopLevelFor(600)).toBe(4);
    expect(troopLevelFor(1000)).toBe(5);
    expect(troopLevelFor(1800)).toBe(6);
    expect(troopLevelFor(3000)).toBe(7);
    expect(troopLevelFor(99999)).toBe(7);
  });

  it('等级投影：攻防/暴击/士气上限', () => {
    expect(troopLevelInfo(0)).toMatchObject({ level: 1, name: '新卒', attackPct: 0, defensePct: 0, critPct: 0, moraleCap: 100 });
    expect(troopLevelInfo(600)).toMatchObject({ level: 4, name: '劲旅', attackPct: 15, defensePct: 15, critPct: 2, moraleCap: 115 });
    expect(troopLevelInfo(3000)).toMatchObject({ level: 7, name: '铁军', attackPct: 30, defensePct: 30, critPct: 4, moraleCap: 130, nextThreshold: null });
    expect(troopLevelLabel(1000)).toBe('Lv5 精锐');
  });

  it('全灭经验：普通归零、铁军保留 30%', () => {
    expect(troopXpAfterWipe(900)).toBe(0);
    expect(troopXpAfterWipe(3000)).toBe(900);
    expect(troopXpAfterWipe(5000)).toBe(1500);
  });

  it('补员稀释按兵力加权平均', () => {
    expect(dilutedTroopXp(800, 600, 200)).toBe(480);
    expect(dilutedTroopXp(1000, 300, 500)).toBe(200);
    expect(dilutedTroopXp(0, 500, 0)).toBe(0);
  });

  it('战果经验：参战/击破/胜仗/以少胜多/统率加成', () => {
    expect(TROOP_XP_OUTNUMBERED_RATIO).toBe(1.3);
    expect(troopBattleXpGain({ currentXp: 0, survived: true, victory: false, kills: 0, leadership: 0 })).toBe(20);
    expect(troopBattleXpGain({ currentXp: 0, survived: true, victory: false, kills: 1, leadership: 0 })).toBe(50);
    expect(troopBattleXpGain({ currentXp: 0, survived: true, victory: true, kills: 0, leadership: 0 })).toBe(30);
    expect(troopBattleXpGain({ currentXp: 0, survived: true, victory: false, kills: 0, outnumbered: true, leadership: 0 })).toBe(26);
    expect(troopBattleXpGain({ currentXp: 0, survived: true, victory: false, kills: 0, leadership: 100 })).toBe(30);
    expect(troopBattleXpGain({ currentXp: 0, survived: true, victory: true, kills: 2, commanderKilled: true, outnumbered: true, leadership: 100 }))
      .toBe(Math.floor((20 + 60 + 50) * 1.3 * 1.5 * 1.5));
  });

  it('战果经验：全灭归零/铁军保留 30%', () => {
    expect(troopXpAfterBattle({ currentXp: 900, survived: false, victory: false, kills: 0 })).toBe(0);
    expect(troopXpAfterBattle({ currentXp: 3000, survived: false, victory: false, kills: 0 })).toBe(900);
    expect(troopXpAfterBattle({ currentXp: 50, survived: true, victory: true, kills: 0, leadership: 0 })).toBe(80);
  });

  it('Lv6 起战斗士气下限 50', () => {
    expect(TROOP_LEVEL_MORALE_FLOOR).toBe(50);
    expect(troopMoraleFloor(0)).toBe(0);
    expect(troopMoraleFloor(1800)).toBe(50);
    expect(troopMoraleFloor(3000)).toBe(50);
  });
});
