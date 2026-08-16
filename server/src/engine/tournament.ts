// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S19 单挑大会引擎最小闭环（Session 338）
 * - 每年正月自动触发，16 人单败淘汰瞬时结算
 * - 复用 duel 全自动规则；大会胜负不改武将生死/俘获
 * - 押注、观战 UI、公平模式吕布降级后置
 */
import {
  TOURNAMENT_SIZE,
  buildNextRound,
  buildOpeningBracket,
  seedTournamentFighters,
  selectTournamentParticipants,
  type GameState,
  type TournamentMatch,
  type TournamentState,
} from '@leh/shared';
import {
  createDuel,
  DEFAULT_DUEL_CONFIG,
  runDuelToCompletion,
} from '../battle/duel.js';
import { grantFame } from './factionPolitics.js';

const FAME_CHAMPION = 30;
const FAME_RUNNER_UP = 15;
const MORALE_CHAMPION_CITY = 3;

function resolveMatchWinner(
  state: GameState,
  match: TournamentMatch,
  rng: () => number,
): { winnerId: number; narrative: string } {
  const a = state.officers[match.fighterAId];
  const b = state.officers[match.fighterBId];
  if (!a || !b) {
    const winnerId = a ? match.fighterAId : match.fighterBId;
    return { winnerId, narrative: `${a?.name ?? b?.name ?? '？'}不战而胜` };
  }
  const duel = createDuel(
    `tournament-${state.currentYear}-r${match.round}-m${match.matchIndex}`,
    a,
    b,
    DEFAULT_DUEL_CONFIG,
    rng,
    'delegate',
    'delegate',
  );
  const ended = runDuelToCompletion(duel, a, b, DEFAULT_DUEL_CONFIG, rng);
  const resolvedWinner =
    ended.result?.winnerId
    ?? ((ended.combatants[a.id]?.hp ?? 0) >= (ended.combatants[b.id]?.hp ?? 0) ? a.id : b.id);
  const winner = state.officers[resolvedWinner];
  const loser = state.officers[resolvedWinner === a.id ? b.id : a.id];
  const upset =
    (winner?.stats.war ?? 0) + 15 <= (loser?.stats.war ?? 0)
      ? `全场哗然！${winner?.name}击败了${loser?.name}！`
      : '';
  return {
    winnerId: resolvedWinner,
    narrative:
      ended.result?.epilogue
      ?? `${winner?.name ?? '？'}战胜${loser?.name ?? '？'}${upset ? `——${upset}` : ''}`,
  };
}

/**
 * 举办并瞬时结算当年大会。人数不足 16 则跳过。
 * 上届冠军势力都城为举办地；首届洛阳（id=1）若存在否则玩家首都。
 */
export function runAnnualTournament(
  state: GameState,
  rng: () => number,
): GameState {
  const participants = selectTournamentParticipants(state);
  if (participants.length < TOURNAMENT_SIZE) {
    return {
      ...state,
      actionLog: [
        {
          year: state.currentYear,
          month: state.currentMonth,
          type: 'tournament',
          message: `${state.currentYear}年单挑大会因合格武将不足${TOURNAMENT_SIZE}人而停办（现有${participants.length}）`,
        },
        ...state.actionLog,
      ].slice(0, 80),
    };
  }

  const prev = state.tournament;
  const hostCityId =
    (prev?.championId != null
      ? state.officers[prev.championId]?.location
        ?? (state.officers[prev.championId]?.faction != null
          ? state.factions[state.officers[prev.championId]!.faction!]?.capitalCityId
          : undefined)
      : undefined)
    ?? (state.cities[1] ? 1 : state.factions[state.playerFactionId]?.capitalCityId ?? 1);

  const fighters = seedTournamentFighters(participants);
  const bracket: TournamentMatch[][] = [];
  let roundMatches = buildOpeningBracket(fighters);
  let currentFighters = [...fighters];
  const narratives: string[] = [
    `${state.currentYear}年${state.currentMonth}月，${state.cities[hostCityId]?.name ?? '洛阳'}内人声鼎沸——天下英雄齐聚，单挑大会即将开始！`,
  ];

  let round = 0;
  while (roundMatches.length > 0) {
    const winners: number[] = [];
    const resolved: TournamentMatch[] = [];
    for (const match of roundMatches) {
      const { winnerId, narrative } = resolveMatchWinner(state, match, rng);
      resolved.push({
        ...match,
        winnerId,
        narrativeLog: [narrative],
      });
      winners.push(winnerId);
      currentFighters = currentFighters.map((f) =>
        f.officerId === match.fighterAId || f.officerId === match.fighterBId
          ? { ...f, eliminated: f.officerId !== winnerId }
          : f,
      );
      narratives.push(`第${round + 1}轮：${narrative}`);
    }
    bracket.push(resolved);
    if (winners.length === 1) break;
    round += 1;
    roundMatches = buildNextRound(round, winners);
  }

  const finalRound = bracket[bracket.length - 1]?.[0];
  const championId = finalRound?.winnerId;
  const runnerUpId =
    finalRound == null || championId == null
      ? undefined
      : finalRound.fighterAId === championId
        ? finalRound.fighterBId
        : finalRound.fighterAId;
  const semi = bracket.length >= 2
    ? bracket[bracket.length - 2].flatMap((m) => [m.fighterAId, m.fighterBId]).filter((id) => id !== championId && id !== runnerUpId)
    : [];

  if (championId == null || runnerUpId == null) {
    return state;
  }

  const history = [
    ...(prev?.history ?? []),
    {
      year: state.currentYear,
      championId,
      runnerUpId,
      semifinalistIds: semi.slice(0, 2),
      championTitle: '武魁' as const,
    },
  ].slice(-20);

  const tournament: TournamentState = {
    year: state.currentYear,
    mode: 'fair',
    phase: 'finished',
    hostCityId,
    participants: currentFighters,
    bracket,
    currentRound: round,
    championId,
    runnerUpId,
    history,
  };

  let next: GameState = {
    ...state,
    tournament,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type: 'tournament',
        message: `${narratives[0]} 武魁——${state.officers[championId]?.name ?? championId}！亚军 ${state.officers[runnerUpId]?.name ?? runnerUpId}`,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };

  // 奖励：冠军势力 fame+30、亚军+15；举办城民心+3（不导致死亡）
  const champFaction = state.officers[championId]?.faction;
  const runnerFaction = state.officers[runnerUpId]?.faction;
  if (champFaction != null) next = grantFame(next, champFaction, FAME_CHAMPION);
  if (runnerFaction != null) next = grantFame(next, runnerFaction, FAME_RUNNER_UP);
  if (next.cities[hostCityId]) {
    const city = next.cities[hostCityId];
    next = {
      ...next,
      cities: {
        ...next.cities,
        [hostCityId]: {
          ...city,
          stats: {
            ...city.stats,
            morale: Math.min(100, (city.stats.morale ?? 70) + MORALE_CHAMPION_CITY),
          },
        },
      },
    };
  }

  return next;
}
