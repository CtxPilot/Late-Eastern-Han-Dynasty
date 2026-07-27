// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { OfficerStatus, type GameState, type Officer } from '@leh/shared';
import { getRecruitmentAvailability } from './PersonnelRecruitDrawer';

const active = (id: number, faction: number | null, status = OfficerStatus.ACTIVE) => ({
  id,
  name: `武将${id}`,
  faction,
  status,
  hidden: { compatibility: 50 },
  stats: { leadership: 50, war: 50, intelligence: 50, politics: 50, charisma: 50 },
} as Officer);

function state({
  cityGold = 300,
  free = true,
  ruler = true,
}: {
  cityGold?: number;
  free?: boolean;
  ruler?: boolean;
} = {}): GameState {
  return {
    playerFactionId: 1,
    factions: { 1: { id: 1, rulerId: ruler ? 1 : 99 } },
    cities: { 1: { id: 1, ruler: 1, gold: cityGold } },
    officers: {
      ...(ruler ? { 1: active(1, 1) } : {}),
      ...(free ? { 2: active(2, null, OfficerStatus.FREE) } : {}),
    },
  } as unknown as GameState;
}

describe('personnel recruitment availability', () => {
  it('derives the same authority inputs used by search and recruit', () => {
    const result = getRecruitmentAvailability(state());
    expect(result.playerCities).toHaveLength(1);
    expect(result.freeOfficers.map((officer) => officer.id)).toEqual([2]);
    expect(result.ruler?.id).toBe(1);
    expect(result.hasSearcher).toBe(true);
    expect(result.canPayRecruit).toBe(true);
  });

  it('exposes no candidate, no executor, and insufficient-resource gates', () => {
    expect(getRecruitmentAvailability(state({ free: false })).freeOfficers).toHaveLength(0);
    expect(getRecruitmentAvailability(state({ ruler: false })).hasSearcher).toBe(false);
    expect(getRecruitmentAvailability(state({ cityGold: 199 })).canPayRecruit).toBe(false);
  });
});
