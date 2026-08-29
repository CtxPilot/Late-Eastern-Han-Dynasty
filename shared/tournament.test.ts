// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import {
  TOURNAMENT_SIZE,
  WUKUI_DIPLOMACY_INITIAL_FAVOR,
  POJUN_DIPLOMACY_INITIAL_FAVOR,
  buildNextRound,
  buildOpeningBracket,
  currentWukuiOfficerId,
  findPojunOfficerId,
  initialDiplomacyFavorBonus,
  initialDiplomacyFavorForPojun,
  initialDiplomacyFavorForWukui,
  resolveTournamentPreferredMode,
  seedTournamentFighters,
  selectTournamentParticipants,
  setTournamentPreferredMode,
  setTournamentPlayerEntries,
  playerTournamentQuota,
  tournamentQuotaForFaction,
  tournamentChampionOdds,
  tournamentBetGoldCap,
  placeTournamentChampionBet,
  clearTournamentChampionBet,
  settleTournamentChampionBet,
  computeTournamentChampionBetPayout,
  tournamentPlacementLosers,
  boostFactionArmyMorale,
  TOURNAMENT_FAME_CHAMPION,
  TOURNAMENT_FAME_QUARTERFINAL,
  TOURNAMENT_FAME_SEMIFINAL,
  TOURNAMENT_CHAMPION_FACTION_MORALE,
  pickTournamentPrizeItemId,
  TOURNAMENT_CHAMPION_PRIZE_POOL,
  TOURNAMENT_RUNNER_PRIZE_POOL,
  TOURNAMENT_MERIT_CHAMPION,
  TOURNAMENT_MERIT_RUNNER_UP,
  TOURNAMENT_MERIT_SEMIFINAL,
  TOURNAMENT_HEAL_ITEM_ID,
  TOURNAMENT_HEAL_HP,
  applyTournamentBetweenRoundHeal,
} from './tournament.js';
import type { GameState } from './types/game.js';
import { OfficerStatus } from './enums/index.js';

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

  it('previous champion becomes seed 1 even if not highest war', () => {
    const officers = Array.from({ length: 4 }, (_, i) => ({
      id: i + 1,
      stats: { war: 100 - i },
    })) as never[];
    const fighters = seedTournamentFighters(officers, 4);
    expect(fighters[0]).toMatchObject({ officerId: 4, seed: 1 });
    expect(fighters[1]).toMatchObject({ officerId: 1, seed: 2 });
  });

  it('next round pairs winners in order', () => {
    const next = buildNextRound(1, [1, 2, 3, 4]);
    expect(next).toEqual([
      { round: 1, matchIndex: 0, fighterAId: 1, fighterBId: 2, narrativeLog: [] },
      { round: 1, matchIndex: 1, fighterAId: 3, fighterBId: 4, narrativeLog: [] },
    ]);
  });

  it('wukui diplomacy initial favor', () => {
    const state = {
      tournament: {
        year: 190,
        mode: 'fair',
        phase: 'finished',
        hostCityId: 1,
        participants: [],
        bracket: [],
        currentRound: 0,
        championId: 7,
        history: [],
      },
      officers: { 7: { id: 7, faction: 2 } },
    } as unknown as GameState;
    expect(currentWukuiOfficerId(state)).toBe(7);
    expect(initialDiplomacyFavorForWukui(state, 1, 2)).toBe(WUKUI_DIPLOMACY_INITIAL_FAVOR);
    expect(initialDiplomacyFavorForWukui(state, 1, 3)).toBe(0);
  });

  it('findPojunOfficerId and pojun diplomacy', () => {
    const bracket = [
      [
        {
          round: 0,
          matchIndex: 0,
          fighterAId: 5,
          fighterBId: 6,
          winnerId: 6,
          narrativeLog: [],
        },
      ],
    ];
    expect(findPojunOfficerId(bracket, 'fair')).toBe(6);
    expect(findPojunOfficerId(bracket, 'unrestricted')).toBeNull();

    const state = {
      tournament: {
        year: 190,
        mode: 'fair',
        phase: 'finished',
        hostCityId: 1,
        participants: [],
        bracket: [],
        currentRound: 0,
        championId: 9,
        pojunOfficerId: 6,
        history: [],
      },
      officers: {
        5: { id: 5, name: '吕布', faction: 3 },
        6: { id: 6, name: '关羽', faction: 1 },
        9: { id: 9, name: '曹操', faction: 2 },
      },
    } as unknown as GameState;
    expect(initialDiplomacyFavorForPojun(state, 1, 3)).toBe(POJUN_DIPLOMACY_INITIAL_FAVOR);
    expect(initialDiplomacyFavorBonus(state, 1, 3)).toBe(POJUN_DIPLOMACY_INITIAL_FAVOR);
    expect(initialDiplomacyFavorBonus(state, 2, 4)).toBe(WUKUI_DIPLOMACY_INITIAL_FAVOR);
  });

  it('preferred mode defaults fair and can switch', () => {
    const base = {
      currentYear: 190,
      currentMonth: 3,
      actionLog: [],
    } as unknown as GameState;
    expect(resolveTournamentPreferredMode(base)).toBe('fair');
    const next = setTournamentPreferredMode(base, 'unrestricted');
    expect(next.tournamentPreferredMode).toBe('unrestricted');
    expect(resolveTournamentPreferredMode(next)).toBe('unrestricted');
    expect(next.actionLog[0]?.message).toContain('无特殊保护');
    const same = setTournamentPreferredMode(next, 'unrestricted');
    expect(same).toBe(next);
  });

  it('player entries prefer nominations and refuse low loyalty', () => {
    const mk = (id: number, war: number, loyalty: number, faction: number) => ({
      id,
      name: `将${id}`,
      faction,
      status: OfficerStatus.ACTIVE,
      loyalty,
      stamina: 100,
      stats: { war, leadership: 80, intelligence: 50, politics: 50, charisma: 50 },
      hidden: { compatibility: 50 },
    });
    const state = {
      playerFactionId: 1,
      currentYear: 190,
      currentMonth: 6,
      actionLog: [],
      factions: {
        1: { id: 1, name: '曹', rulerId: 1, cityIds: [1, 2, 3] },
        2: { id: 2, name: '袁', rulerId: 10, cityIds: [4] },
      },
      cities: {
        1: { id: 1, ruler: 1 },
        2: { id: 2, ruler: 1 },
        3: { id: 3, ruler: 1 },
        4: { id: 4, ruler: 2 },
      },
      officers: {
        1: mk(1, 90, 100, 1),
        2: mk(2, 88, 95, 1),
        3: mk(3, 99, 70, 1), // low loyalty → refuse
        10: mk(10, 85, 90, 2),
        11: mk(11, 84, 90, 2),
      },
    } as unknown as GameState;

    expect(playerTournamentQuota(state)).toBe(2);
    const refused = setTournamentPlayerEntries(state, [3, 1]);
    expect(refused.refusedNames).toEqual(['将3']);
    expect(refused.acceptedIds).toEqual([1]);
    expect(refused.state.officers[3]!.loyalty).toBe(55);
    expect(refused.state.tournamentPlayerEntryIds).toEqual([1]);

    const withEntries = {
      ...refused.state,
      tournamentPlayerEntryIds: [2],
    } as GameState;
    const picked = selectTournamentParticipants(withEntries);
    expect(picked.some((o) => o.id === 2)).toBe(true);
    // 指派优先：2 虽武力低于 1/3，仍占玩家名额；1、3 可由武力补满或全局补位
    const playerPicked = picked.filter((o) => o.faction === 1).map((o) => o.id);
    expect(playerPicked[0]).toBe(2);
  });

  it('champion bet odds cap payout and settle', () => {
    expect(tournamentChampionOdds(100, 100)).toBe(1.05);
    expect(tournamentChampionOdds(50, 100)).toBe(2);
    expect(tournamentBetGoldCap(1000)).toBe(200);

    const mk = (id: number, war: number) => ({
      id,
      name: `将${id}`,
      faction: 1,
      status: OfficerStatus.ACTIVE,
      loyalty: 100,
      stamina: 100,
      stats: { war, leadership: 80, intelligence: 50, politics: 50, charisma: 50 },
      hidden: { compatibility: 50 },
    });
    const base = {
      playerFactionId: 1,
      currentYear: 190,
      currentMonth: 11,
      actionLog: [],
      factions: { 1: { id: 1, name: '曹', rulerId: 1, cityIds: [1], gold: 1000 } },
      cities: { 1: { id: 1, ruler: 1 } },
      officers: {
        1: mk(1, 100),
        2: mk(2, 80),
      },
    } as unknown as GameState;

    const placed = placeTournamentChampionBet(base, 2, 100);
    expect(placed.factions[1]!.gold).toBe(900);
    expect(placed.tournamentChampionBet).toMatchObject({
      officerId: 2,
      amount: 100,
      officerWar: 80,
      fieldTopWar: 100,
    });
    expect(placed.tournamentChampionBet!.odds).toBe(1.25);

    const cleared = clearTournamentChampionBet(placed);
    expect(cleared.tournamentChampionBet).toBeNull();
    expect(cleared.factions[1]!.gold).toBe(1000);

    const win = computeTournamentChampionBetPayout(placed.tournamentChampionBet!, 2);
    expect(win.won).toBe(true);
    expect(win.upset).toBe(true);
    expect(win.payout).toBe(Math.floor(100 * 1.25 * 3));

    const settled = settleTournamentChampionBet(placed, 2);
    expect(settled.result?.won).toBe(true);
    expect(settled.state.tournamentChampionBet).toBeNull();
    expect(settled.state.factions[1]!.gold).toBe(900 + win.payout);

    const lose = settleTournamentChampionBet(placed, 1);
    expect(lose.result?.won).toBe(false);
    expect(lose.result?.payout).toBe(0);
    expect(lose.state.factions[1]!.gold).toBe(900);
  });

  it('placement losers split 八强 / 四强', () => {
    const mk = (round: number, matchIndex: number, a: number, b: number, w: number) => ({
      round,
      matchIndex,
      fighterAId: a,
      fighterBId: b,
      winnerId: w,
      narrativeLog: [],
    });
    // 简化：仅 八进四 + 半决赛 + 决赛三层
    const bracket = [
      [], // round0 unused in this fixture
      [
        mk(1, 0, 1, 2, 1),
        mk(1, 1, 3, 4, 3),
        mk(1, 2, 5, 6, 5),
        mk(1, 3, 7, 8, 7),
      ],
      [
        mk(2, 0, 1, 3, 1),
        mk(2, 1, 5, 7, 5),
      ],
      [mk(3, 0, 1, 5, 1)],
    ];
    const { semifinalLosers, quarterfinalLosers } = tournamentPlacementLosers(bracket, 1, 5);
    expect(semifinalLosers.sort()).toEqual([3, 7]);
    expect(quarterfinalLosers.sort()).toEqual([2, 4, 6, 8]);
    expect(TOURNAMENT_FAME_CHAMPION).toBe(50);
    expect(TOURNAMENT_FAME_SEMIFINAL).toBe(15);
    expect(TOURNAMENT_FAME_QUARTERFINAL).toBe(5);
  });

  it('boosts faction army morale capped at 100', () => {
    const state = {
      officers: { 1: { id: 1, faction: 2 }, 9: { id: 9, faction: 3 } },
      armys: [
        { id: 'a1', commanderId: 1, morale: 95 },
        { id: 'a2', commanderId: 9, morale: 40 },
      ],
      campaignArmies: [
        { id: 'c1', factionId: 2, morale: 50 },
        { id: 'c2', factionId: 3, morale: 60 },
      ],
    } as unknown as GameState;
    const next = boostFactionArmyMorale(state, 2, TOURNAMENT_CHAMPION_FACTION_MORALE);
    expect(next.armys[0]!.morale).toBe(100);
    expect(next.armys[1]!.morale).toBe(40);
    expect(next.campaignArmies[0]!.morale).toBe(60);
    expect(next.campaignArmies[1]!.morale).toBe(60);
  });

  it('picks prize from pool deterministically', () => {
    expect(TOURNAMENT_CHAMPION_PRIZE_POOL).toEqual([1, 2, 4]);
    expect(TOURNAMENT_RUNNER_PRIZE_POOL).toEqual([19, 20, 17]);
    expect(pickTournamentPrizeItemId(TOURNAMENT_CHAMPION_PRIZE_POOL, () => 0)).toBe(1);
    expect(pickTournamentPrizeItemId(TOURNAMENT_CHAMPION_PRIZE_POOL, () => 0.99)).toBe(4);
    expect(pickTournamentPrizeItemId([], () => 0.5)).toBeNull();
  });

  it('defines tournament merit rewards per 05 §8.17.9', () => {
    expect(TOURNAMENT_MERIT_CHAMPION).toBe(30);
    expect(TOURNAMENT_MERIT_RUNNER_UP).toBe(20);
    expect(TOURNAMENT_MERIT_SEMIFINAL).toBe(10);
  });

  it('applies between-round heal capped at maxHp', () => {
    expect(TOURNAMENT_HEAL_ITEM_ID).toBe(17);
    expect(TOURNAMENT_HEAL_HP).toBe(30);
    expect(applyTournamentBetweenRoundHeal(40, 100)).toBe(70);
    expect(applyTournamentBetweenRoundHeal(90, 100)).toBe(100);
    expect(applyTournamentBetweenRoundHeal(100, 100)).toBe(100);
    expect(applyTournamentBetweenRoundHeal(50, 100, 0)).toBe(50);
  });
});
