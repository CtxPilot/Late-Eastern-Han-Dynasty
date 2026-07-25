// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import { controlsEmperor } from './hegemony.js';
import type { GameState } from './types/game.js';

/** 构造最小 GameState 用于 controlsEmperor 纯函数测试（不依赖 server createGame）。 */
function mkState(emperorLocation: number | null | undefined, cityRuler: number | null): GameState {
  return {
    scenarioId: 1,
    enabledEventLayers: [],
    enabledChildEventIds: [],
    currentYear: 190,
    currentMonth: 1,
    season: 0,
    playerFactionId: 1,
    officers: {},
    cities: emperorLocation == null ? {} : {
      [emperorLocation]: { id: emperorLocation, name: '洛阳', ruler: cityRuler } as never,
    },
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
    intel: { cities: {}, agents: {}, cityDefense: {}, nextAgentSeq: 1, recentMissions: [], plantableBeauty: {} } as never,
    plots: [],
    completedEvents: [],
    pendingEvents: [],
    invalidatedEvents: [],
    eventChoices: {},
    actionLog: [],
    emperorLocation,
  } as unknown as GameState;
}

describe('controlsEmperor (HC-P0-1, docs/26 Q1 方案A)', () => {
  it('emperorLocation 指向城池且 faction 占领该城 → true', () => {
    expect(controlsEmperor(mkState(1, 1), 1)).toBe(true);
  });

  it('emperorLocation 指向城池但其他势力占领 → false', () => {
    expect(controlsEmperor(mkState(1, 2), 1)).toBe(false);
  });

  it('城池易主后判定动态响应（emperorLocation 不变，ruler 变）', () => {
    const before = mkState(1, 1);
    expect(controlsEmperor(before, 1)).toBe(true);
    const after = mkState(1, 2);
    expect(controlsEmperor(after, 1)).toBe(false);
    expect(controlsEmperor(after, 2)).toBe(true);
  });

  it('emperorLocation 为 null（未迎奉）→ 任何势力都 false', () => {
    expect(controlsEmperor(mkState(null, null), 1)).toBe(false);
  });

  it('emperorLocation 为 undefined（旧存档降级）→ 任何势力都 false', () => {
    const s = mkState(undefined, null);
    expect(controlsEmperor(s, 1)).toBe(false);
  });

  it('emperorLocation 指向的城池无主（ruler=null）→ false', () => {
    expect(controlsEmperor(mkState(1, null), 1)).toBe(false);
  });

  it('emperorLocation 指向的城池不在 cities 中（脏数据）→ false 不抛错', () => {
    const s = {
      ...mkState(999, null),
      cities: {},
    } as GameState;
    expect(controlsEmperor(s, 1)).toBe(false);
  });
});