// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_SIZE,
  buildNextRound,
  buildOpeningBracket,
  seedTournamentFighters,
  tournamentQuotaForFaction,
} from './tournament.js';

describe('S19 tournament pure helpers', () => {
  it('quota bands', () => {
    expect(tournamentQuotaForFaction(8)).toBe(5);
    expect(tournamentQuotaForFaction(4)).toBe(3);
    expect(tournamentQuotaForFaction(3)).toBe(2);
  });

  it('seeds and opening bracket cover 16 fighters', () => {
    const officers = Array.from({ length: TOURNAMENT_SIZE }, (_, i) => ({
      id: i + 1,
      stats: { war: 100 - i },
    })) as never[];
    const fighters = seedTournamentFighters(officers);
    expect(fighters).toHaveLength(16);
    expect(fighters[0].seed).toBe(1);
    const opening = buildOpeningBracket(fighters);
    expect(opening).toHaveLength(8);
    expect(opening[0].fighterAId).toBe(fighters.find((f) => f.seed === 1)!.officerId);
    expect(opening[0].fighterBId).toBe(fighters.find((f) => f.seed === 16)!.officerId);
  });

  it('next round pairs winners in order', () => {
    const next = buildNextRound(1, [1, 2, 3, 4]);
    expect(next).toEqual([
      { round: 1, matchIndex: 0, fighterAId: 1, fighterBId: 2, narrativeLog: [] },
      { round: 1, matchIndex: 1, fighterAId: 3, fighterBId: 4, narrativeLog: [] },
    ]);
  });
});
