// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import type { GameState, TournamentState } from '@leh/shared';
import { OfficerStatus } from '@leh/shared';
import {
  buildTournamentOverview,
  buildTournamentPlaybackSteps,
} from './TournamentOverview';

function baseGame(tournament?: TournamentState): GameState {
  return {
    currentYear: 190,
    currentMonth: 1,
    playerFactionId: 1,
    officers: {
      1: { id: 1, name: '关羽', faction: 1 },
      2: { id: 2, name: '张飞', faction: 1 },
      3: { id: 3, name: '吕布', faction: 2 },
      4: { id: 4, name: '赵云', faction: 1 },
    },
    factions: {
      1: { id: 1, name: '刘备军' },
      2: { id: 2, name: '吕布军' },
    },
    cities: {
      1: { id: 1, name: '洛阳' },
    },
    tournament,
  } as unknown as GameState;
}

describe('buildTournamentOverview', () => {
  it('returns empty hint when no tournament', () => {
    const model = buildTournamentOverview(baseGame());
    expect(model.status).toBe('none');
    expect(model.emptyHint).toContain('正月');
    expect(model.rounds).toHaveLength(0);
    expect(model.champion).toBeNull();
    expect(model.preferredMode).toBe('fair');
    expect(model.preferredModeLabel).toBe('公平竞技');
    expect(model.entryQuota).toBeGreaterThan(0);
    expect(model.pendingBet).toBeNull();
    expect(model.betCap).toBeGreaterThanOrEqual(0);
  });

  it('reads tournamentPreferredMode unrestricted', () => {
    const model = buildTournamentOverview({
      ...baseGame(),
      tournamentPreferredMode: 'unrestricted',
    });
    expect(model.preferredMode).toBe('unrestricted');
    expect(model.preferredModeLabel).toBe('无特殊保护');
  });

  it('projects entry candidates from player officers', () => {
    const game = {
      ...baseGame(),
      officers: {
        1: {
          id: 1,
          name: '关羽',
          faction: 1,
          status: OfficerStatus.ACTIVE,
          loyalty: 95,
          stamina: 100,
          stats: { war: 97 },
          hidden: { compatibility: 50 },
        },
        2: {
          id: 2,
          name: '张飞',
          faction: 1,
          status: OfficerStatus.ACTIVE,
          loyalty: 70,
          stamina: 100,
          stats: { war: 96 },
          hidden: { compatibility: 50 },
        },
      },
      factions: {
        1: { id: 1, name: '刘备军', rulerId: 1, cityIds: [1] },
      },
      cities: { 1: { id: 1, name: '洛阳', ruler: 1 } },
      tournamentPlayerEntryIds: [1],
    } as unknown as GameState;
    const model = buildTournamentOverview(game);
    expect(model.entryQuota).toBe(2);
    expect(model.entrySelectedCount).toBe(1);
    expect(model.entryCandidates.map((c) => c.id)).toEqual([1, 2]);
    expect(model.entryCandidates.find((c) => c.id === 2)?.mayRefuse).toBe(true);
  });

  it('projects finished bracket champion and narratives', () => {
    const tournament: TournamentState = {
      year: 190,
      mode: 'fair',
      phase: 'finished',
      hostCityId: 1,
      participants: [
        { officerId: 1, seed: 1, eliminated: false },
        { officerId: 3, seed: 2, eliminated: true },
      ],
      bracket: [
        [
          {
            round: 0,
            matchIndex: 0,
            fighterAId: 1,
            fighterBId: 2,
            winnerId: 1,
            narrativeLog: ['关羽战胜张飞'],
          },
          {
            round: 0,
            matchIndex: 1,
            fighterAId: 3,
            fighterBId: 4,
            winnerId: 3,
            narrativeLog: ['吕布战胜赵云'],
          },
        ],
        [
          {
            round: 1,
            matchIndex: 0,
            fighterAId: 1,
            fighterBId: 3,
            winnerId: 1,
            narrativeLog: ['关羽战胜吕布——全场哗然！'],
          },
        ],
      ],
      currentRound: 1,
      championId: 1,
      runnerUpId: 3,
      history: [
        {
          year: 190,
          championId: 1,
          runnerUpId: 3,
          semifinalistIds: [],
          championTitle: '武魁',
        },
      ],
    };

    const model = buildTournamentOverview(baseGame(tournament));
    expect(model.status).toBe('finished');
    expect(model.year).toBe(190);
    expect(model.hostCityName).toBe('洛阳');
    expect(model.modeLabel).toBe('公平竞技');
    expect(model.champion).toEqual({
      id: 1,
      name: '关羽',
      factionName: '刘备军',
      hpLabel: null,
    });
    expect(model.runnerUp).toEqual({
      id: 3,
      name: '吕布',
      factionName: '吕布军',
    });
    expect(model.pojun).toBeNull();
    expect(model.championPrizeName).toBeNull();
    expect(model.runnerUpPrizeName).toBeNull();
    expect(model.rounds).toHaveLength(2);
    expect(model.rounds[0].label).toBe('十六进八');
    expect(model.rounds[1].label).toBe('八进四');
    expect(model.rounds[1].matches[0].winnerName).toBe('关羽');
    expect(model.rounds[1].matches[0].narrative).toContain('关羽战胜吕布');
    expect(model.playbackSteps).toHaveLength(3);
    expect(model.playbackSteps[0]).toMatchObject({
      stepIndex: 0,
      round: 0,
      roundLabel: '十六进八',
      match: { winnerName: '关羽', narrative: '关羽战胜张飞' },
    });
    expect(model.playbackSteps[2]).toMatchObject({
      stepIndex: 2,
      round: 1,
      roundLabel: '八进四',
      match: { winnerName: '关羽' },
    });
    expect(model.history[0]).toMatchObject({
      year: 190,
      championName: '关羽',
      runnerUpName: '吕布',
      title: '武魁',
    });
  });
  it('projects pending champion bet', () => {
    const game = {
      ...baseGame(),
      factions: {
        1: { id: 1, name: '刘备军', gold: 2000, rulerId: 1, cityIds: [1] },
        2: { id: 2, name: '吕布军' },
      },
      officers: {
        1: {
          id: 1,
          name: '关羽',
          faction: 1,
          status: OfficerStatus.ACTIVE,
          loyalty: 95,
          stamina: 100,
          stats: { war: 97 },
        },
        3: {
          id: 3,
          name: '吕布',
          faction: 2,
          status: OfficerStatus.ACTIVE,
          loyalty: 90,
          stamina: 100,
          stats: { war: 100 },
        },
      },
      tournamentChampionBet: {
        officerId: 1,
        amount: 100,
        odds: 1.05,
        officerWar: 97,
        fieldTopWar: 100,
      },
    } as unknown as GameState;
    const model = buildTournamentOverview(game);
    expect(model.pendingBet).toEqual({
      officerId: 1,
      officerName: '关羽',
      amount: 100,
      odds: 1.05,
    });
    expect(model.betCandidates.some((c) => c.id === 1)).toBe(true);
    expect(model.betCap).toBe(420); // (2000+100)*0.2
  });
});

describe('buildTournamentPlaybackSteps', () => {
  it('flattens rounds in order', () => {
    const steps = buildTournamentPlaybackSteps([
      {
        round: 0,
        label: '十六进八',
        matches: [
          {
            matchIndex: 0,
            fighterAName: 'A',
            fighterBName: 'B',
            winnerName: 'A',
            narrative: null,
          },
          {
            matchIndex: 1,
            fighterAName: 'C',
            fighterBName: 'D',
            winnerName: 'C',
            narrative: null,
          },
        ],
      },
      {
        round: 1,
        label: '八进四',
        matches: [
          {
            matchIndex: 0,
            fighterAName: 'A',
            fighterBName: 'C',
            winnerName: 'A',
            narrative: '终局',
          },
        ],
      },
    ]);
    expect(steps.map((s) => s.stepIndex)).toEqual([0, 1, 2]);
    expect(steps[1].roundLabel).toBe('十六进八');
    expect(steps[2].match.narrative).toBe('终局');
  });

  it('returns empty for no rounds', () => {
    expect(buildTournamentPlaybackSteps([])).toEqual([]);
  });
});
