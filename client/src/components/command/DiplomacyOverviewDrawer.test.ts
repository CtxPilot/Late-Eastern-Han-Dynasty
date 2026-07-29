// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { DipRelation, type GameState } from '@leh/shared';
import { selectDiplomacyTargets } from './DiplomacyOverviewDrawer';

const game = {
  playerFactionId: 1,
  factions: {
    1: { id: 1, name: '曹操军', rulerId: 1, capitalCityId: 1, color: '#111', isAlive: true },
    2: { id: 2, name: '刘备军', rulerId: 2, capitalCityId: 2, color: '#222', isAlive: true },
    3: { id: 3, name: '孙权军', rulerId: 3, capitalCityId: 3, color: '#333', isAlive: false },
  },
  officers: {
    1: { id: 1, name: '曹操' },
    2: { id: 2, name: '刘备' },
    3: { id: 3, name: '孙权' },
  },
  cities: {
    1: { id: 1, name: '洛阳', ruler: 1, troops: 1000, gold: 0, food: 0 },
    2: { id: 2, name: '汉中', ruler: 2, troops: 1200, gold: 0, food: 0 },
    4: { id: 4, name: '成都', ruler: 2, troops: 800, gold: 0, food: 0 },
    3: { id: 3, name: '建业', ruler: 3, troops: 900, gold: 0, food: 0 },
  },
  diplomacy: [
    { factionA: 1, factionB: 2, relation: DipRelation.FRIENDLY, favorability: 35 },
  ],
} as unknown as GameState;

describe('diplomacy read-only overview model', () => {
  it('selects only living non-player factions and derives current authority fields', () => {
    expect(selectDiplomacyTargets(game)).toEqual([
      {
        factionId: 2,
        name: '刘备军',
        color: '#222',
        relation: 'friendly',
        relationLabel: '友好',
        favorability: 35,
        rulerName: '刘备',
        capitalName: '汉中',
        cityCount: 2,
        troops: 2000,
      },
    ]);
  });
});
