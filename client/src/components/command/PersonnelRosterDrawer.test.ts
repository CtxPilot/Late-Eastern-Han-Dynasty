// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import type { GameState, Officer } from '@leh/shared';
import { makeSyntheticRoster, selectPersonnelRoster } from './PersonnelRosterDrawer';

function officer(id: number, name: string, faction: number | null, status: 'active' | 'free', leadership: number): Officer {
  return {
    id, name, faction, status, loyalty: 70, location: 1,
    stats: { leadership, war: 50, intelligence: 50, politics: 50, charisma: 50 },
  } as Officer;
}

const game = {
  playerFactionId: 1,
  officers: {
    1: officer(1, '甲', 1, 'active', 60),
    2: officer(2, '乙', 1, 'active', 80),
    3: officer(3, '丙', null, 'free', 70),
    4: officer(4, '丁', 2, 'active', 99),
  },
} as unknown as GameState;

describe('personnel roster read-only model', () => {
  it('filters player active/free summaries without exposing another faction', () => {
    expect(selectPersonnelRoster(game, '', 'all', 'leadership').map((entry) => entry.id)).toEqual([2, 3, 1]);
    expect(selectPersonnelRoster(game, '', 'active', 'leadership').map((entry) => entry.id)).toEqual([2, 1]);
    expect(selectPersonnelRoster(game, '', 'free', 'leadership').map((entry) => entry.id)).toEqual([3]);
    expect(selectPersonnelRoster(game, '甲', 'all', 'name').map((entry) => entry.id)).toEqual([1]);
  });

  it.each([100, 1000])('builds a %i-row synthetic fixture with stable unique keys', (count) => {
    const fixture = makeSyntheticRoster(Object.values(game.officers).slice(0, 3), count);
    expect(fixture).toHaveLength(count);
    expect(new Set(fixture.map((entry) => entry.id))).toHaveLength(count);
    expect(new Set(fixture.map((entry) => entry.name))).toHaveLength(count);
  });
});
