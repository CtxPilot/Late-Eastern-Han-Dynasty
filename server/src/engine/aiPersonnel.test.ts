// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  OfficerStatus,
  type GameState,
} from '@leh/shared';
import {
  decideAiLoyaltyReward,
  decideAiRecruitWandering,
  getAffinityDistance,
  runAllAiPersonnel,
} from './aiPersonnel.js';

function createMockPersonnelState(): GameState {
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
      },
      2: {
        id: 2,
        name: '刘备军',
        isPlayer: false,
        isAlive: true,
        rulerId: 2,
      },
    },
    cities: {
      1: {
        id: 1,
        name: '许昌',
        ruler: 1,
        gold: 2000,
        troops: 5000,
      } as any,
      2: {
        id: 2,
        name: '平原',
        ruler: 2,
        gold: 1000,
        troops: 3000,
      } as any,
    },
    officers: {
      1: {
        id: 1,
        name: '曹操',
        faction: 1,
        location: 1,
        status: OfficerStatus.ACTIVE,
        loyalty: 100,
        stats: { leadership: 96, war: 72, intelligence: 91, politics: 94, charisma: 96 },
        hidden: { compatibility: 25 } as any,
      } as any,
      2: {
        id: 2,
        name: '刘备',
        faction: 2,
        location: 2,
        status: OfficerStatus.ACTIVE,
        loyalty: 100,
        stats: { leadership: 75, war: 73, intelligence: 74, politics: 78, charisma: 99 },
        hidden: { compatibility: 75 } as any,
      } as any,
      3: {
        id: 3,
        name: '简雍',
        faction: 2,
        location: 2,
        status: OfficerStatus.ACTIVE,
        loyalty: 55, // 低忠诚将领
        stats: { leadership: 42, war: 38, intelligence: 75, politics: 72, charisma: 76 },
        hidden: { compatibility: 75 } as any,
      } as any,
      4: {
        id: 4,
        name: '赵云',
        faction: null,
        location: 2, // 在野于平原
        status: OfficerStatus.FREE,
        loyalty: 0,
        stats: { leadership: 91, war: 96, intelligence: 76, politics: 65, charisma: 88 },
        hidden: { compatibility: 68 } as any,
      } as any,
    },
    diplomacy: [],
    campaignArmies: [],
    actionLog: [],
  } as any;
}

describe('aiPersonnel (P5-01 AI 人事决策引擎)', () => {
  it('相性差环状距离计算准确', () => {
    expect(getAffinityDistance(10, 20)).toBe(10);
    expect(getAffinityDistance(5, 145)).toBe(10); // 跨 0/150 边界环状
    expect(getAffinityDistance(0, 75)).toBe(75);
  });

  it('AI 成功在同城登用在野武将并初始化忠诚度', () => {
    const state = createMockPersonnelState();
    const nextState = decideAiRecruitWandering(state, 2); // 刘备在平原登用赵云
    expect(nextState).not.toBeNull();
    if (nextState) {
      expect(nextState.cities[2].gold).toBe(800); // 扣 200 金
      const zhaoyun = nextState.officers[4];
      expect(zhaoyun.status).toBe(OfficerStatus.ACTIVE);
      expect(zhaoyun.faction).toBe(2);
      expect(zhaoyun.loyalty).toBeGreaterThanOrEqual(60);
      expect(nextState.actionLog.length).toBeGreaterThan(0);
      expect(nextState.actionLog[0].message).toContain('寻访并登用在野名士赵云');
    }
  });

  it('AI 成功对低忠诚将领颁赐金帛维稳', () => {
    const state = createMockPersonnelState();
    const nextState = decideAiLoyaltyReward(state, 2); // 对简雍（忠诚 55）赏赐
    expect(nextState).not.toBeNull();
    if (nextState) {
      expect(nextState.cities[2].gold).toBe(950); // 扣 50 金
      const jianyong = nextState.officers[3];
      expect(jianyong.loyalty).toBe(63); // 55 + 8
      expect(nextState.actionLog[0].message).toContain('颁赐金帛以彰勤绩');
    }
  });

  it('runAllAiPersonnel 全局管线按部就班运行', () => {
    const state = createMockPersonnelState();
    const nextState = runAllAiPersonnel(state);
    expect(nextState).toBeDefined();
    // 应当登用了赵云
    expect(nextState.officers[4].status).toBe(OfficerStatus.ACTIVE);
  });
});
