// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  DipRelation,
  type GameState,
} from '@leh/shared';
import { rebalanceAiGarrisons } from './aiMilitary.js';

function createMockMilitaryState(): GameState {
  return {
    scenarioId: 1,
    currentYear: 190,
    currentMonth: 5,
    season: 'summer',
    playerFactionId: 1,
    factions: {
      1: { id: 1, name: '曹操军', isPlayer: true, isAlive: true },
      2: { id: 2, name: '袁绍军', isPlayer: false, isAlive: true },
    },
    cities: {
      // 1: 洛阳（曹操）
      1: {
        id: 1,
        name: '洛阳',
        ruler: 1,
        troops: 10000,
        food: 20000,
        stats: { wall: 100 },
      } as any,
      // 2: 长安（董卓前线，直连洛阳 [1, 2]，兵少）
      2: {
        id: 2,
        name: '长安',
        ruler: 2,
        troops: 2000,
        food: 3000,
        stats: { wall: 80 },
      } as any,
      // 34: 高陵（董卓后方安全城，直连长安 [2, 34]，四周无敌军，驻军充裕）
      34: {
        id: 34,
        name: '高陵',
        ruler: 2,
        troops: 8000,
        food: 15000,
        stats: { wall: 80 },
      } as any,
    },
    officers: {},
    diplomacy: [
      { factionA: 1, factionB: 2, relation: DipRelation.WAR, favorability: -50 },
    ],
    activeBattles: [],
    campaignArmies: [],
    actionLog: [],
  } as any;
}

describe('aiMilitaryRebalance (P5-02 AI 战争决策与战略兵力分配)', () => {
  it('单城势力跳过兵力调配', () => {
    const state = createMockMilitaryState();
    // 曹操只有 1 城
    const nextState = rebalanceAiGarrisons(state, 1);
    expect(nextState).toBe(state);
  });

  it('多城势力后方安全城成功向前线危城调拔精兵与军粮', () => {
    const state = createMockMilitaryState();
    // 董卓有 2 城：高陵（后方 8000 兵）和 长安（前线 2000 兵，面对曹操 10000 兵）
    const nextState = rebalanceAiGarrisons(state, 2);
    expect(nextState).not.toBe(state);

    // 高陵（源）调出 2000 兵（最大单次上限）
    expect(nextState.cities[34].troops).toBe(6000);
    expect(nextState.cities[34].food).toBe(11000); // 调出 4000 粮

    // 长安（目标）收到 2000 兵与 4000 粮
    expect(nextState.cities[2].troops).toBe(4000);
    expect(nextState.cities[2].food).toBe(7000);

    // 生成玩家可见军情战报
    expect(nextState.actionLog.length).toBeGreaterThan(0);
    expect(nextState.actionLog[0].type).toBe('ai_military');
    expect(nextState.actionLog[0].message).toContain('加固防线');
  });
});
