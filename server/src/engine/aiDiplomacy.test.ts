// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  DipRelation,
  type GameState,
} from '@leh/shared';
import {
  assessFactionDiplomaticStance,
  decideTributeToStrongNeighbor,
  decideWeakFactionAlliance,
  maintainAlliances,
  runAllAiDiplomacy,
} from './aiDiplomacy.js';

function createMockGameState(): GameState {
  return {
    scenarioId: 1,
    currentYear: 190,
    currentMonth: 5,
    season: 'summer',
    playerFactionId: 1,
    factions: {
      1: {
        id: 1,
        name: '曹操军',
        isPlayer: true,
        isAlive: true,
        rulerId: 1,
        color: '#3b82f6',
        capitalCityId: 1,
      },
      2: {
        id: 2,
        name: '陶谦军',
        isPlayer: false,
        isAlive: true,
        rulerId: 10,
        color: '#10b981',
        capitalCityId: 2,
      },
      3: {
        id: 3,
        name: '公孙瓒军',
        isPlayer: false,
        isAlive: true,
        rulerId: 20,
        color: '#f59e0b',
        capitalCityId: 3,
      },
      4: {
        id: 4,
        name: '董卓军',
        isPlayer: false,
        isAlive: true,
        rulerId: 30,
        color: '#ef4444',
        capitalCityId: 4,
      },
    },
    cities: {
      1: {
        id: 1,
        name: '许昌',
        ruler: 1,
        troops: 12000,
        food: 20000,
        gold: 3000,
        stats: { farm: 100, commerce: 100, wall: 100, morale: 80 },
        population: 50000,
      } as any,
      2: {
        id: 2,
        name: '下邳',
        ruler: 2,
        troops: 3000,
        food: 5000,
        gold: 800,
        stats: { farm: 80, commerce: 80, wall: 60, morale: 65 },
        population: 30000,
      } as any,
      3: {
        id: 3,
        name: '北平',
        ruler: 3,
        troops: 4000,
        food: 6000,
        gold: 1000,
        stats: { farm: 80, commerce: 80, wall: 60, morale: 70 },
        population: 30000,
      } as any,
      4: {
        id: 4,
        name: '洛阳',
        ruler: 4,
        troops: 25000,
        food: 40000,
        gold: 6000,
        stats: { farm: 150, commerce: 150, wall: 150, morale: 85 },
        population: 80000,
      } as any,
    },
    officers: {
      1: {
        id: 1,
        name: '曹操',
        faction: 1,
        location: 1,
        status: 'active' as any,
        stats: { leadership: 96, war: 72, intelligence: 91, politics: 94, charisma: 96 },
        hidden: { compatibility: 25 } as any,
      } as any,
      10: {
        id: 10,
        name: '陶谦',
        faction: 2,
        location: 2,
        status: 'active' as any,
        stats: { leadership: 55, war: 40, intelligence: 62, politics: 70, charisma: 75 },
        hidden: { compatibility: 35 } as any,
      } as any,
      11: {
        id: 11,
        name: '糜竺',
        faction: 2,
        location: 2,
        status: 'active' as any,
        stats: { leadership: 40, war: 30, intelligence: 76, politics: 82, charisma: 84 },
        hidden: { compatibility: 36 } as any,
      } as any,
      20: {
        id: 20,
        name: '公孙瓒',
        faction: 3,
        location: 3,
        status: 'active' as any,
        stats: { leadership: 82, war: 83, intelligence: 68, politics: 58, charisma: 78 },
        hidden: { compatibility: 50 } as any,
      } as any,
    },
    diplomacy: [
      { factionA: 1, factionB: 2, relation: DipRelation.NEUTRAL, favorability: 10 },
      { factionA: 2, factionB: 3, relation: DipRelation.NEUTRAL, favorability: 25 },
      { factionA: 2, factionB: 4, relation: DipRelation.HOSTILE, favorability: -40 },
    ],
    campaignArmies: [],
    actionLog: [],
  } as any;
}

describe('aiDiplomacy (P5-03 AI 外交决策引擎)', () => {
  it('正确识别弱势受威胁势力状态', () => {
    const state = createMockGameState();
    const stance = assessFactionDiplomaticStance(state, 2); // 陶谦军
    expect(stance.cityCount).toBe(1);
    expect(stance.totalTroops).toBe(3000);
    expect(stance.isWeak).toBe(true);
  });

  it('弱势势力面临压倒性强邻时遣使进贡修好并向玩家城注金', () => {
    const state = createMockGameState();
    // 假设陶谦受威胁并向曹操（玩家）进贡
    const stance = {
      factionId: 2,
      cityCount: 1,
      totalTroops: 3000,
      isWeak: true,
      adjacentFactions: [1, 4],
      threatFactions: [1], // 曹操军
    };

    const nextState = decideTributeToStrongNeighbor(state, stance);
    expect(nextState).not.toBeNull();
    if (nextState) {
      // 陶谦城扣金 200
      expect(nextState.cities[2].gold).toBe(600);
      // 曹操（玩家）城收金 200
      expect(nextState.cities[1].gold).toBe(3200);
      // 双方友好度提升 +15（10 -> 25）
      const link = nextState.diplomacy.find(
        (l) => (l.factionA === 1 && l.factionB === 2) || (l.factionA === 2 && l.factionB === 1),
      );
      expect(link?.favorability).toBe(25);
      expect(nextState.actionLog.length).toBeGreaterThan(0);
      expect(nextState.actionLog[0].message).toContain('敬畏我军威容');
    }
  });

  it('弱势势力与友好第三势力成功缔结盟约', () => {
    const state = createMockGameState();
    const stance = {
      factionId: 2,
      cityCount: 1,
      totalTroops: 3000,
      isWeak: true,
      adjacentFactions: [1, 3],
      threatFactions: [1],
    };

    // 强行设一个固定成功 roll（0 -> 100% 成功）
    const nextState = decideWeakFactionAlliance(state, stance, () => 0.1);
    expect(nextState).not.toBeNull();
    if (nextState) {
      // 陶谦扣除 300 金结盟礼金
      expect(nextState.cities[2].gold).toBe(500);
      const link = nextState.diplomacy.find(
        (l) => (l.factionA === 2 && l.factionB === 3) || (l.factionA === 3 && l.factionB === 2),
      );
      expect(link?.relation).toBe(DipRelation.ALLIED);
      expect(link?.favorability).toBeGreaterThanOrEqual(40);
      expect(nextState.actionLog[0].message).toContain('正式缔结盟约');
    }
  });

  it('友好度恶化至阈值以下时同盟自动瓦解', () => {
    const state = createMockGameState();
    state.diplomacy = [
      { factionA: 2, factionB: 3, relation: DipRelation.ALLIED, favorability: -30 },
    ];

    const nextState = maintainAlliances(state);
    const link = nextState.diplomacy[0];
    expect(link.relation).toBe(DipRelation.NEUTRAL);
    expect(nextState.actionLog[0].message).toContain('两家同盟告终');
  });

  it('runAllAiDiplomacy 全局管线平稳执行', () => {
    const state = createMockGameState();
    const nextState = runAllAiDiplomacy(state, () => 0.05);
    expect(nextState).toBeDefined();
    expect(nextState.diplomacy.length).toBeGreaterThanOrEqual(state.diplomacy.length);
  });
});
