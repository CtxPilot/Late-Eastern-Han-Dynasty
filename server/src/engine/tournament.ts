// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S19 单挑大会引擎（Session 338+）
 * - 每年正月自动触发，16 人单败淘汰瞬时结算
 * - 复用 duel 全自动规则；大会胜负不改武将生死/俘获
 * - Session 387：公平模式大会单挑接入 fairWushuang（吕布无双降级）
 * - Session 391：赛前押武魁兑付
 * - Session 392：跨轮单挑 HP 不恢复（连战消耗）
 * - Session 393：名次名声对齐 + 四强/八强 + 冠军势力部队士气
 * - Session 394：冠亚宝物入势力库存
 * - Session 395：大会功绩（冠+30/亚+20/四强+10）
 * - Session 396：轮间金疮药自动回血（0-A 体力丸占位）
 */
import {
  TOURNAMENT_CHAMPION_FACTION_MORALE,
  TOURNAMENT_CHAMPION_PRIZE_POOL,
  TOURNAMENT_FAME_CHAMPION,
  TOURNAMENT_FAME_POJUN,
  TOURNAMENT_FAME_QUARTERFINAL,
  TOURNAMENT_FAME_RUNNER_UP,
  TOURNAMENT_FAME_SEMIFINAL,
  TOURNAMENT_HEAL_HP,
  TOURNAMENT_HEAL_ITEM_ID,
  TOURNAMENT_MERIT_CHAMPION,
  TOURNAMENT_MERIT_RUNNER_UP,
  TOURNAMENT_MERIT_SEMIFINAL,
  TOURNAMENT_RUNNER_PRIZE_POOL,
  TOURNAMENT_SIZE,
  WUKUI_CITY_MORALE_BONUS,
  applyTournamentBetweenRoundHeal,
  buildNextRound,
  buildOpeningBracket,
  findPojunOfficerId,
  pickTournamentPrizeItemId,
  resolveTournamentPreferredMode,
  seedTournamentFighters,
  selectTournamentParticipants,
  settleTournamentChampionBet,
  tournamentPlacementLosers,
  boostFactionArmyMorale,
  type GameState,
  type TournamentMatch,
  type TournamentMode,
  type TournamentState,
} from '@leh/shared';
import {
  applyDuelCarryoverHp,
  createDuel,
  DEFAULT_DUEL_CONFIG,
  FAIR_TOURNAMENT_DUEL_CONFIG,
  runDuelToCompletion,
} from '../battle/duel.js';
import { grantFame } from './factionPolitics.js';
import {
  getItemById,
  grantItemToFactionInventory,
  tryConsumeFactionInventoryItem,
} from './items.js';
import { grantMeritTo } from './meritGrant.js';

function duelConfigForMode(mode: TournamentMode) {
  return mode === 'fair' ? FAIR_TOURNAMENT_DUEL_CONFIG : DEFAULT_DUEL_CONFIG;
}

/**
 * 晋级者残血且所属势力库存有金疮药 → 耗 1 件、carryHp +30（封顶 maxHp）。
 * 返回更新后的 state 与本批用药次数。
 */
function applyBetweenRoundHeals(
  state: GameState,
  winnerIds: readonly number[],
  carryHp: Map<number, number>,
  maxHpByOfficer: Map<number, number>,
): { state: GameState; healCount: number } {
  let s = state;
  let healCount = 0;
  for (const oid of winnerIds) {
    const hp = carryHp.get(oid);
    const maxHp = maxHpByOfficer.get(oid) ?? DEFAULT_DUEL_CONFIG.baseHp;
    if (hp == null || hp >= maxHp) continue;
    const fid = s.officers[oid]?.faction;
    if (fid == null) continue;
    const healed = applyTournamentBetweenRoundHeal(hp, maxHp, TOURNAMENT_HEAL_HP);
    if (healed <= hp) continue;
    const next = tryConsumeFactionInventoryItem(s, fid, TOURNAMENT_HEAL_ITEM_ID);
    if (next == null) continue;
    s = next;
    carryHp.set(oid, healed);
    healCount += 1;
  }
  return { state: s, healCount };
}

function resolveMatchWinner(
  state: GameState,
  match: TournamentMatch,
  rng: () => number,
  mode: TournamentMode,
  carryHp: Map<number, number>,
): { winnerId: number; narrative: string; winnerHp: number; maxHp: number } {
  const a = state.officers[match.fighterAId];
  const b = state.officers[match.fighterBId];
  if (!a || !b) {
    const winnerId = a ? match.fighterAId : match.fighterBId;
    const maxHp = DEFAULT_DUEL_CONFIG.baseHp;
    const winnerHp = carryHp.get(winnerId) ?? maxHp;
    return {
      winnerId,
      narrative: `${a?.name ?? b?.name ?? '？'}不战而胜`,
      winnerHp,
      maxHp,
    };
  }
  const duelCfg = duelConfigForMode(mode);
  let duel = createDuel(
    `tournament-${state.currentYear}-r${match.round}-m${match.matchIndex}`,
    a,
    b,
    duelCfg,
    rng,
    'delegate',
    'delegate',
  );
  duel = applyDuelCarryoverHp(duel, carryHp);
  const startA = duel.combatants[a.id]?.hp ?? duelCfg.baseHp;
  const startB = duel.combatants[b.id]?.hp ?? duelCfg.baseHp;
  const ended = runDuelToCompletion(duel, a, b, duelCfg, rng);
  const resolvedWinner =
    ended.result?.winnerId
    ?? ((ended.combatants[a.id]?.hp ?? 0) >= (ended.combatants[b.id]?.hp ?? 0) ? a.id : b.id);
  const winner = state.officers[resolvedWinner];
  const loser = state.officers[resolvedWinner === a.id ? b.id : a.id];
  const winnerHp = Math.max(1, ended.combatants[resolvedWinner]?.hp ?? 1);
  const maxHp = ended.combatants[resolvedWinner]?.maxHp ?? duelCfg.baseHp;
  carryHp.set(a.id, Math.max(0, ended.combatants[a.id]?.hp ?? 0));
  carryHp.set(b.id, Math.max(0, ended.combatants[b.id]?.hp ?? 0));

  const weary =
    (resolvedWinner === a.id ? startA : startB) < maxHp * 0.7
    || (resolvedWinner === a.id ? startB : startA) < maxHp * 0.7;
  const upset =
    (winner?.stats.war ?? 0) + 15 <= (loser?.stats.war ?? 0)
      ? `全场哗然！${winner?.name}击败了${loser?.name}！`
      : '';
  const wearyNote = weary && !upset ? '（连战余勇）' : '';
  return {
    winnerId: resolvedWinner,
    narrative:
      ended.result?.epilogue
      ?? `${winner?.name ?? '？'}战胜${loser?.name ?? '？'}${upset ? `——${upset}` : ''}${wearyNote}`,
    winnerHp,
    maxHp,
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

  const fighters = seedTournamentFighters(participants, prev?.championId);
  /** Session 388：读 tournamentPreferredMode；缺省 fair */
  const mode: TournamentMode = resolveTournamentPreferredMode(state);
  const bracket: TournamentMatch[][] = [];
  let roundMatches = buildOpeningBracket(fighters);
  let currentFighters = [...fighters];
  /** Session 392：跨轮 HP 池（officerId → 残余单挑 HP） */
  const carryHp = new Map<number, number>();
  const maxHpByOfficer = new Map<number, number>();
  /** Session 396：轮间用药会改库存，须用可变 working */
  let working: GameState = state;
  let betweenRoundHealCount = 0;
  const narratives: string[] = [
    `${state.currentYear}年${state.currentMonth}月，${state.cities[hostCityId]?.name ?? '洛阳'}内人声鼎沸——天下英雄齐聚，单挑大会即将开始！`,
  ];

  let round = 0;
  while (roundMatches.length > 0) {
    const winners: number[] = [];
    const resolved: TournamentMatch[] = [];
    for (const match of roundMatches) {
      const { winnerId, narrative, winnerHp, maxHp } = resolveMatchWinner(
        working,
        match,
        rng,
        mode,
        carryHp,
      );
      maxHpByOfficer.set(match.fighterAId, maxHp);
      maxHpByOfficer.set(match.fighterBId, maxHp);
      resolved.push({
        ...match,
        winnerId,
        narrativeLog: [narrative],
      });
      winners.push(winnerId);
      // 胜者 carry 已在 resolve 写入；确保晋级 HP ≥1
      carryHp.set(winnerId, Math.max(1, winnerHp));
      currentFighters = currentFighters.map((f) =>
        f.officerId === match.fighterAId || f.officerId === match.fighterBId
          ? {
              ...f,
              eliminated: f.officerId !== winnerId,
              currentHp: carryHp.get(f.officerId),
              maxHp: maxHpByOfficer.get(f.officerId) ?? maxHp,
            }
          : f,
      );
      narratives.push(`第${round + 1}轮：${narrative}`);
    }
    bracket.push(resolved);
    if (winners.length === 1) break;
    // Session 396：进入下一轮前，晋级残血自动用药
    const healed = applyBetweenRoundHeals(working, winners, carryHp, maxHpByOfficer);
    working = healed.state;
    betweenRoundHealCount += healed.healCount;
    if (healed.healCount > 0) {
      currentFighters = currentFighters.map((f) =>
        winners.includes(f.officerId) && !f.eliminated
          ? { ...f, currentHp: carryHp.get(f.officerId) ?? f.currentHp }
          : f,
      );
    }
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

  const newlyPojun = findPojunOfficerId(bracket, mode);
  const pojunOfficerId = newlyPojun ?? prev?.pojunOfficerId;

  // Session 394：冠亚宝物（先抽，写入赛果后再入库）
  const championPrizeItemId = pickTournamentPrizeItemId(TOURNAMENT_CHAMPION_PRIZE_POOL, rng);
  const runnerUpPrizeItemId = pickTournamentPrizeItemId(TOURNAMENT_RUNNER_PRIZE_POOL, rng);
  const championPrizeName = championPrizeItemId != null
    ? (getItemById(championPrizeItemId)?.name ?? undefined)
    : undefined;
  const runnerUpPrizeName = runnerUpPrizeItemId != null
    ? (getItemById(runnerUpPrizeItemId)?.name ?? undefined)
    : undefined;

  const tournament: TournamentState = {
    year: state.currentYear,
    mode,
    phase: 'finished',
    hostCityId,
    participants: currentFighters,
    bracket,
    currentRound: round,
    championId,
    runnerUpId,
    ...(pojunOfficerId != null ? { pojunOfficerId } : {}),
    ...(championPrizeItemId != null ? { championPrizeItemId, championPrizeName } : {}),
    ...(runnerUpPrizeItemId != null ? { runnerUpPrizeItemId, runnerUpPrizeName } : {}),
    ...(betweenRoundHealCount > 0 ? { betweenRoundHealCount } : {}),
    history,
  };

  const pojunNote = newlyPojun != null
    ? ` 破军——${working.officers[newlyPojun]?.name ?? newlyPojun}！`
    : '';

  let next: GameState = {
    ...working,
    tournament,
    actionLog: [
      {
        year: working.currentYear,
        month: working.currentMonth,
        type: 'tournament',
        message: `${narratives[0]} 武魁——${working.officers[championId]?.name ?? championId}！亚军 ${working.officers[runnerUpId]?.name ?? runnerUpId}${pojunNote}${
          betweenRoundHealCount > 0 ? `（轮间用药 ${betweenRoundHealCount} 次）` : ''
        }`,
      },
      ...working.actionLog,
    ].slice(0, 80),
  };

  // Session 391：赛前押武魁兑付
  const settled = settleTournamentChampionBet(next, championId);
  next = settled.state;
  if (settled.result != null) {
    next = {
      ...next,
      tournament: {
        ...next.tournament!,
        championBetResult: settled.result,
      },
    };
  }

  // Session 393：名次名声（势力 fame）对齐 05 §8.17.5
  const champFaction = state.officers[championId]?.faction;
  const runnerFaction = state.officers[runnerUpId]?.faction;
  if (champFaction != null) next = grantFame(next, champFaction, TOURNAMENT_FAME_CHAMPION);
  if (runnerFaction != null) next = grantFame(next, runnerFaction, TOURNAMENT_FAME_RUNNER_UP);
  const { semifinalLosers, quarterfinalLosers } = tournamentPlacementLosers(
    bracket,
    championId,
    runnerUpId,
  );
  for (const oid of semifinalLosers) {
    const fid = state.officers[oid]?.faction;
    if (fid != null) next = grantFame(next, fid, TOURNAMENT_FAME_SEMIFINAL);
  }
  for (const oid of quarterfinalLosers) {
    const fid = state.officers[oid]?.faction;
    if (fid != null) next = grantFame(next, fid, TOURNAMENT_FAME_QUARTERFINAL);
  }
  if (newlyPojun != null) {
    const pojunFaction = state.officers[newlyPojun]?.faction;
    if (pojunFaction != null) next = grantFame(next, pojunFaction, TOURNAMENT_FAME_POJUN);
  }

  // 冠军所属势力部队士气 +10（Army + CampaignArmy，上限 100）
  if (champFaction != null) {
    next = boostFactionArmyMorale(next, champFaction, TOURNAMENT_CHAMPION_FACTION_MORALE);
  }

  // Session 394：冠亚宝物入所属势力库存
  if (championPrizeItemId != null && champFaction != null) {
    const item = getItemById(championPrizeItemId);
    const name = item?.name ?? `#${championPrizeItemId}`;
    next = grantItemToFactionInventory(
      next,
      champFaction,
      championPrizeItemId,
      `武魁奖：${name} 入${next.factions[champFaction]?.name ?? '势力'}库存`,
    );
  }
  if (runnerUpPrizeItemId != null && runnerFaction != null) {
    const item = getItemById(runnerUpPrizeItemId);
    const name = item?.name ?? `#${runnerUpPrizeItemId}`;
    next = grantItemToFactionInventory(
      next,
      runnerFaction,
      runnerUpPrizeItemId,
      `亚军奖：${name} 入${next.factions[runnerFaction]?.name ?? '势力'}库存`,
    );
  }

  // Session 395：大会功绩（05 §8.17.9；君主经 grantMeritTo 豁免）
  next = grantMeritTo(next, championId, TOURNAMENT_MERIT_CHAMPION);
  next = grantMeritTo(next, runnerUpId, TOURNAMENT_MERIT_RUNNER_UP);
  for (const oid of semifinalLosers) {
    next = grantMeritTo(next, oid, TOURNAMENT_MERIT_SEMIFINAL);
  }

  // 举办城 + 武魁所属城民心（同城只加一次）
  const champLoc = state.officers[championId]?.location;
  const moraleCityIds = [...new Set(
    [hostCityId, champLoc].filter((id): id is number => id != null && next.cities[id] != null),
  )];
  if (moraleCityIds.length > 0) {
    const cities = { ...next.cities };
    for (const cityId of moraleCityIds) {
      const city = cities[cityId]!;
      cities[cityId] = {
        ...city,
        stats: {
          ...city.stats,
          morale: Math.min(100, (city.stats.morale ?? 70) + WUKUI_CITY_MORALE_BONUS),
        },
      };
    }
    next = { ...next, cities };
  }

  return next;
}
