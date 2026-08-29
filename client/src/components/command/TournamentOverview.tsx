// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S19 单挑大会：赛果 / 下届模式 / 报名 / 逐步观战 / 赛前押武魁（Session 384~391）
 * 读 GameState.tournament；轮间押注仍后置。逐步观战为已落幕对阵只读回放。
 */
import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useEffect, useMemo, useState } from 'react';
import {
  TOURNAMENT_BET_PRESETS,
  eligiblePlayerTournamentOfficers,
  eligibleTournamentOfficers,
  mayRefuseTournamentEntry,
  playerTournamentQuota,
  resolveTournamentPreferredMode,
  tournamentBetGoldCap,
  tournamentChampionOdds,
  tournamentFieldTopWar,
  type GameState,
  type TournamentMatch,
  type TournamentMode,
  type TournamentState,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

const ROUND_LABELS = ['十六进八', '八进四', '半决赛', '决赛'] as const;
const MODE_LABEL: Record<TournamentState['mode'], string> = {
  fair: '公平竞技',
  unrestricted: '无特殊保护',
};

export type TournamentEntryCandidate = {
  id: number;
  name: string;
  war: number;
  loyalty: number;
  selected: boolean;
  mayRefuse: boolean;
};

export type TournamentBetCandidate = {
  id: number;
  name: string;
  war: number;
  odds: number;
};

export type TournamentMatchView = {
  matchIndex: number;
  fighterAName: string;
  fighterBName: string;
  winnerName: string | null;
  narrative: string | null;
};

export type TournamentRoundView = {
  round: number;
  label: string;
  matches: TournamentMatchView[];
};

/** Session 390：逐步观战单步（按轮次×场次展平） */
export type TournamentPlaybackStep = {
  stepIndex: number;
  round: number;
  roundLabel: string;
  match: TournamentMatchView;
};

export type TournamentOverviewModel = {
  status: 'none' | 'finished';
  emptyHint: string;
  year: number | null;
  hostCityName: string | null;
  modeLabel: string | null;
  phaseLabel: string | null;
  preferredMode: TournamentMode;
  preferredModeLabel: string;
  entryQuota: number;
  entryCandidates: TournamentEntryCandidate[];
  entrySelectedCount: number;
  factionGold: number;
  betCap: number;
  betCandidates: TournamentBetCandidate[];
  pendingBet: {
    officerId: number;
    officerName: string;
    amount: number;
    odds: number;
  } | null;
  lastBetResult: {
    officerName: string;
    amount: number;
    odds: number;
    won: boolean;
    payout: number;
    upset: boolean;
  } | null;
  champion: { id: number; name: string; factionName: string; hpLabel: string | null } | null;
  runnerUp: { id: number; name: string; factionName: string } | null;
  pojun: { id: number; name: string; factionName: string } | null;
  championPrizeName: string | null;
  runnerUpPrizeName: string | null;
  /** Session 396：轮间自动用药次数；无则 null */
  betweenRoundHealCount: number | null;
  rounds: TournamentRoundView[];
  /** 展平后的观战步骤；空态无赛果时为 [] */
  playbackSteps: TournamentPlaybackStep[];
  history: Array<{ year: number; championName: string; runnerUpName: string; title: string }>;
};

function officerName(game: GameState, id: number | undefined): string {
  if (id == null) return '—';
  return game.officers[id]?.name ?? `武将#${id}`;
}

function factionNameOf(game: GameState, officerId: number | undefined): string {
  if (officerId == null) return '—';
  const factionId = game.officers[officerId]?.faction;
  if (factionId == null) return '在野';
  return game.factions[factionId]?.name ?? `势力#${factionId}`;
}

function matchView(game: GameState, match: TournamentMatch): TournamentMatchView {
  return {
    matchIndex: match.matchIndex,
    fighterAName: officerName(game, match.fighterAId),
    fighterBName: officerName(game, match.fighterBId),
    winnerName: match.winnerId != null ? officerName(game, match.winnerId) : null,
    narrative: match.narrativeLog[0] ?? null,
  };
}

/** 将轮次对阵展平为逐步观战序列（十六进八 → … → 决赛） */
export function buildTournamentPlaybackSteps(
  rounds: readonly TournamentRoundView[],
): TournamentPlaybackStep[] {
  const steps: TournamentPlaybackStep[] = [];
  for (const round of rounds) {
    for (const match of round.matches) {
      steps.push({
        stepIndex: steps.length,
        round: round.round,
        roundLabel: round.label,
        match,
      });
    }
  }
  return steps;
}

export function buildTournamentOverview(game: GameState): TournamentOverviewModel {
  const emptyHint = '每年正月自动举办十六人单败大会；推进至正月后可在此查阅武魁与对阵纪要。';
  const preferredMode = resolveTournamentPreferredMode(game);
  const preferredModeLabel = MODE_LABEL[preferredMode];
  const entryQuota = playerTournamentQuota(game);
  const selected = new Set(game.tournamentPlayerEntryIds ?? []);
  const faction = game.factions[game.playerFactionId];
  const ruler = faction != null ? game.officers[faction.rulerId] : undefined;
  const entryCandidates: TournamentEntryCandidate[] = eligiblePlayerTournamentOfficers(game).map((o) => ({
    id: o.id,
    name: o.name,
    war: o.stats.war,
    loyalty: o.loyalty,
    selected: selected.has(o.id),
    mayRefuse: mayRefuseTournamentEntry(o, ruler),
  }));
  const entrySelectedCount = entryCandidates.filter((c) => c.selected).length;

  const factionGold = faction?.gold ?? 0;
  const pendingRaw = game.tournamentChampionBet ?? null;
  // 限额按「当前金 + 已扣挂单」计算，便于 UI 展示可换注上限
  const goldForCap = factionGold + (pendingRaw?.amount ?? 0);
  const betCap = tournamentBetGoldCap(goldForCap);
  const fieldTop = tournamentFieldTopWar(game);
  const betCandidates: TournamentBetCandidate[] = eligibleTournamentOfficers(game)
    .sort((a, b) => b.stats.war - a.stats.war || a.id - b.id)
    .slice(0, 12)
    .map((o) => ({
      id: o.id,
      name: o.name,
      war: o.stats.war,
      odds: tournamentChampionOdds(o.stats.war, fieldTop),
    }));
  const pendingBet = pendingRaw != null
    ? {
        officerId: pendingRaw.officerId,
        officerName: officerName(game, pendingRaw.officerId),
        amount: pendingRaw.amount,
        odds: pendingRaw.odds,
      }
    : null;
  const betResult = game.tournament?.championBetResult;
  const lastBetResult = betResult != null
    ? {
        officerName: officerName(game, betResult.officerId),
        amount: betResult.amount,
        odds: betResult.odds,
        won: betResult.won,
        payout: betResult.payout,
        upset: betResult.upset,
      }
    : null;

  const baseFields = {
    preferredMode,
    preferredModeLabel,
    entryQuota,
    entryCandidates,
    entrySelectedCount,
    factionGold,
    betCap,
    betCandidates,
    pendingBet,
    lastBetResult,
  };

  const t = game.tournament;
  if (!t || t.phase !== 'finished') {
    return {
      status: 'none',
      emptyHint,
      year: t?.year ?? null,
      hostCityName: t?.hostCityId != null
        ? (game.cities[t.hostCityId]?.name ?? `城#${t.hostCityId}`)
        : null,
      modeLabel: t ? MODE_LABEL[t.mode] : null,
      phaseLabel: t?.phase === 'ongoing' ? '进行中' : t?.phase === 'registration' ? '报名中' : null,
      ...baseFields,
      champion: null,
      runnerUp: null,
      pojun: t?.pojunOfficerId != null
        ? {
            id: t.pojunOfficerId,
            name: officerName(game, t.pojunOfficerId),
            factionName: factionNameOf(game, t.pojunOfficerId),
          }
        : null,
      championPrizeName: null,
      runnerUpPrizeName: null,
      betweenRoundHealCount: null,
      rounds: [],
      playbackSteps: [],
      history: (t?.history ?? []).map((record) => ({
        year: record.year,
        championName: officerName(game, record.championId),
        runnerUpName: officerName(game, record.runnerUpId),
        title: record.championTitle,
      })),
    };
  }

  const rounds: TournamentRoundView[] = t.bracket.map((matches, index) => ({
    round: index,
    label: ROUND_LABELS[index] ?? `第${index + 1}轮`,
    matches: matches.map((match) => matchView(game, match)),
  }));
  const playbackSteps = buildTournamentPlaybackSteps(rounds);

  const championId = t.championId;
  const runnerUpId = t.runnerUpId;
  const pojunId = t.pojunOfficerId;

  const champFighter = championId != null
    ? t.participants.find((f) => f.officerId === championId)
    : undefined;
  const champHpLabel =
    champFighter?.currentHp != null && champFighter.maxHp != null
      ? `${champFighter.currentHp}/${champFighter.maxHp}`
      : null;

  return {
    status: 'finished',
    emptyHint,
    year: t.year,
    hostCityName: game.cities[t.hostCityId]?.name ?? `城#${t.hostCityId}`,
    modeLabel: MODE_LABEL[t.mode],
    phaseLabel: '已落幕',
    ...baseFields,
    champion: championId != null
      ? {
          id: championId,
          name: officerName(game, championId),
          factionName: factionNameOf(game, championId),
          hpLabel: champHpLabel,
        }
      : null,
    runnerUp: runnerUpId != null
      ? {
          id: runnerUpId,
          name: officerName(game, runnerUpId),
          factionName: factionNameOf(game, runnerUpId),
        }
      : null,
    pojun: pojunId != null
      ? {
          id: pojunId,
          name: officerName(game, pojunId),
          factionName: factionNameOf(game, pojunId),
        }
      : null,
    championPrizeName: t.championPrizeName ?? null,
    runnerUpPrizeName: t.runnerUpPrizeName ?? null,
    betweenRoundHealCount:
      t.betweenRoundHealCount != null && t.betweenRoundHealCount > 0
        ? t.betweenRoundHealCount
        : null,
    rounds,
    playbackSteps,
    history: t.history.map((record) => ({
      year: record.year,
      championName: officerName(game, record.championId),
      runnerUpName: officerName(game, record.runnerUpId),
      title: record.championTitle,
    })),
  };
}

export function TournamentOverviewSection() {
  const game = useGameStore((state) => state.game);
  const loading = useGameStore((state) => state.loading);
  const setTournamentPreferredMode = useGameStore((state) => state.setTournamentPreferredMode);
  const setTournamentPlayerEntries = useGameStore((state) => state.setTournamentPlayerEntries);
  const placeTournamentChampionBet = useGameStore((state) => state.placeTournamentChampionBet);
  const clearTournamentChampionBet = useGameStore((state) => state.clearTournamentChampionBet);
  const [busyMode, setBusyMode] = useState<TournamentMode | null>(null);
  const [entryBusy, setEntryBusy] = useState(false);
  const [betBusy, setBetBusy] = useState(false);
  const [betOfficerId, setBetOfficerId] = useState<number | null>(null);
  /** 逐步观战：已揭示场数；0=未开始（摘要态） */
  const [revealedCount, setRevealedCount] = useState(0);
  const [playbackActive, setPlaybackActive] = useState(false);
  const model = useMemo(
    () => (game ? buildTournamentOverview(game) : null),
    [game],
  );

  // 换届后重置观战进度
  useEffect(() => {
    setPlaybackActive(false);
    setRevealedCount(0);
  }, [model?.year, model?.status]);

  useEffect(() => {
    if (model?.pendingBet) {
      setBetOfficerId(model.pendingBet.officerId);
    } else if (model?.betCandidates[0] && betOfficerId == null) {
      setBetOfficerId(model.betCandidates[0].id);
    }
  }, [model?.pendingBet, model?.betCandidates, betOfficerId]);

  if (!model) return null;

  const pickMode = async (mode: TournamentMode) => {
    if (model.preferredMode === mode || loading) return;
    setBusyMode(mode);
    try {
      await setTournamentPreferredMode(mode);
    } finally {
      setBusyMode(null);
    }
  };

  const toggleEntry = async (officerId: number) => {
    if (loading || entryBusy) return;
    const current = model.entryCandidates.filter((c) => c.selected).map((c) => c.id);
    const next = current.includes(officerId)
      ? current.filter((id) => id !== officerId)
      : [...current, officerId];
    if (next.length > model.entryQuota) return;
    setEntryBusy(true);
    try {
      await setTournamentPlayerEntries(next);
    } finally {
      setEntryBusy(false);
    }
  };

  const placeBet = async (amount: number) => {
    if (loading || betBusy || betOfficerId == null) return;
    setBetBusy(true);
    try {
      await placeTournamentChampionBet(betOfficerId, amount);
    } finally {
      setBetBusy(false);
    }
  };

  const clearBet = async () => {
    if (loading || betBusy || !model.pendingBet) return;
    setBetBusy(true);
    try {
      await clearTournamentChampionBet();
    } finally {
      setBetBusy(false);
    }
  };

  const totalSteps = model.playbackSteps.length;
  const currentStep = playbackActive && revealedCount > 0
    ? model.playbackSteps[Math.min(revealedCount, totalSteps) - 1] ?? null
    : null;
  const playbackDone = playbackActive && revealedCount >= totalSteps && totalSteps > 0;

  const startPlayback = () => {
    setPlaybackActive(true);
    setRevealedCount(1);
  };
  const nextStep = () => {
    if (!playbackActive) {
      startPlayback();
      return;
    }
    setRevealedCount((n) => Math.min(totalSteps, n + 1));
  };
  const skipRest = () => {
    setPlaybackActive(true);
    setRevealedCount(totalSteps);
  };
  const resetPlayback = () => {
    setPlaybackActive(false);
    setRevealedCount(0);
  };

  return (
    <section className="border-t border-stone-800 pt-3" data-testid="command-court-tournament">
      <h3 className="text-xs tracking-widest text-amber-300">武魁大会</h3>
      <p className="mt-1 text-xs leading-relaxed text-stone-600">
        下届赛制、报名与赛前押武魁可选手动设定；已落幕可逐步观战。轮间押注仍后置。
      </p>

      <div className="mt-2 space-y-1.5" data-testid="tournament-preferred-mode">
        <div className="text-xs text-stone-500">
          下届赛制：
          <span className="ml-1 text-amber-200" data-testid="tournament-preferred-mode-label">
            {model.preferredModeLabel}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <InkButton
            type="button"
            data-testid="tournament-mode-fair"
            disabled={loading || model.preferredMode === 'fair'}
            onClick={() => void pickMode('fair')}
            className={
              model.preferredMode === 'fair'
                ? 'border border-amber-700/80 bg-amber-950/40 px-2 py-1 text-xs text-amber-200'
                : 'border border-stone-700 bg-stone-950/60 px-2 py-1 text-xs text-stone-300 hover:border-amber-800'
            }
          >
            {busyMode === 'fair' ? '切换中…' : '公平竞技'}
          </InkButton>
          <InkButton
            type="button"
            data-testid="tournament-mode-unrestricted"
            disabled={loading || model.preferredMode === 'unrestricted'}
            onClick={() => void pickMode('unrestricted')}
            className={
              model.preferredMode === 'unrestricted'
                ? 'border border-amber-700/80 bg-amber-950/40 px-2 py-1 text-xs text-stone-300 hover:border-amber-800'
                : 'border border-stone-700 bg-stone-950/60 px-2 py-1 text-xs text-stone-300 hover:border-amber-800'
            }
          >
            {busyMode === 'unrestricted' ? '切换中…' : '无特殊保护'}
          </InkButton>
        </div>
        <p className="text-xs leading-relaxed text-stone-600">
          公平竞技：吕布无双降级、可夺破军。无特殊保护：吕布保留无双压迫感。
        </p>
      </div>

      <div className="mt-3 space-y-1.5" data-testid="tournament-entries">
        <div className="text-xs text-stone-500">
          下届报名
          <span className="ml-1 text-amber-200" data-testid="tournament-entry-quota">
            {model.entrySelectedCount}/{model.entryQuota}
          </span>
          <span className="ml-1 text-stone-600">（未指派则按武力自动补满）</span>
        </div>
        {model.entryCandidates.length === 0 ? (
          <p className="text-xs text-stone-600">暂无合格武将（武力≥70 且体力≥80）</p>
        ) : (
          <ul className="max-h-36 space-y-1 overflow-y-auto pr-1">
            {model.entryCandidates.map((c) => {
              const atCap = !c.selected && model.entrySelectedCount >= model.entryQuota;
              return (
                <li key={c.id}>
                  <InkButton
                    type="button"
                    data-testid={`tournament-entry-${c.id}`}
                    disabled={loading || entryBusy || atCap}
                    onClick={() => void toggleEntry(c.id)}
                    className={
                      c.selected
                        ? 'flex w-full items-center justify-between border border-amber-700/80 bg-amber-950/40 px-2 py-1 text-left text-xs text-amber-100'
                        : 'flex w-full items-center justify-between border border-stone-800 bg-stone-950/50 px-2 py-1 text-left text-xs text-stone-300 hover:border-amber-900 disabled:opacity-40'
                    }
                  >
                    <span>
                      {c.name}
                      <span className="ml-1 text-stone-500">武{c.war} · 忠{c.loyalty}</span>
                      {c.mayRefuse ? (
                        <span className="ml-1 text-rose-400/90">可能拒绝</span>
                      ) : null}
                    </span>
                    <span className="text-stone-500">{c.selected ? '已选' : '点选'}</span>
                  </InkButton>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-3 space-y-1.5" data-testid="tournament-champion-bet">
        <div className="text-xs text-stone-500">
          赛前押武魁
          <span className="ml-1 text-stone-600">
            势力金 {model.factionGold} · 限额 {model.betCap}
          </span>
        </div>
        {model.pendingBet ? (
          <p className="text-xs text-amber-200" data-testid="tournament-bet-pending">
            已押 {model.pendingBet.officerName} {model.pendingBet.amount} 金
            （赔率 {model.pendingBet.odds.toFixed(2)}）
          </p>
        ) : (
          <p className="text-xs text-stone-600">正月前可押一人夺魁；落空不退本金。</p>
        )}
        {model.lastBetResult ? (
          <p className="text-xs text-stone-400" data-testid="tournament-bet-last-result">
            上届兑付：{model.lastBetResult.officerName}
            {model.lastBetResult.won
              ? ` +${model.lastBetResult.payout}金${model.lastBetResult.upset ? '（爆冷×3）' : ''}`
              : ` 落空 −${model.lastBetResult.amount}金`}
          </p>
        ) : null}
        {model.betCandidates.length === 0 ? (
          <p className="text-xs text-stone-600">暂无合格押注对象</p>
        ) : (
          <>
            <select
              data-testid="tournament-bet-officer"
              className="w-full border border-stone-700 bg-stone-950 px-2 py-1 text-xs text-stone-200"
              value={betOfficerId ?? ''}
              disabled={loading || betBusy}
              onChange={(e) => setBetOfficerId(Number(e.target.value))}
            >
              {model.betCandidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · 武{c.war} · 赔率 {c.odds.toFixed(2)}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1.5">
              {TOURNAMENT_BET_PRESETS.map((preset) => {
                const disabled =
                  loading || betBusy || betOfficerId == null || preset > model.betCap;
                return (
                  <InkButton
                    key={preset}
                    type="button"
                    data-testid={`tournament-bet-amount-${preset}`}
                    disabled={disabled}
                    onClick={() => void placeBet(preset)}
                    className="border border-stone-700 bg-stone-950/60 px-2 py-1 text-xs text-stone-300 hover:border-amber-800 disabled:opacity-40"
                  >
                    {preset}金
                  </InkButton>
                );
              })}
              {model.pendingBet ? (
                <InkButton
                  type="button"
                  data-testid="tournament-bet-clear"
                  disabled={loading || betBusy}
                  onClick={() => void clearBet()}
                  className="border border-stone-700 bg-stone-950/60 px-2 py-1 text-xs text-stone-400 hover:border-stone-500"
                >
                  撤销
                </InkButton>
              ) : null}
            </div>
          </>
        )}
      </div>

      {model.status === 'none' ? (
        <p className="mt-2 text-xs text-stone-500" data-testid="tournament-empty">
          {model.emptyHint}
        </p>
      ) : (
        <div className="mt-2 space-y-3" data-testid="tournament-finished">
          <dl className="grid grid-cols-[4.5rem_1fr] gap-x-2 gap-y-1 text-xs">
            <dt className="text-stone-600">届次</dt>
            <dd className="text-stone-200">{model.year}年 · {model.hostCityName}</dd>
            <dt className="text-stone-600">本届赛制</dt>
            <dd className="text-stone-200">{model.modeLabel} · {model.phaseLabel}</dd>
            <dt className="text-stone-600">武魁</dt>
            <dd className="text-amber-200" data-testid="tournament-champion">
              {model.champion
                ? `${model.champion.name}（${model.champion.factionName}）`
                : '—'}
              {model.champion?.hpLabel ? (
                <span className="ml-1 text-stone-500" data-testid="tournament-champion-hp">
                  赛末 HP {model.champion.hpLabel}
                </span>
              ) : null}
            </dd>
            <dt className="text-stone-600">亚军</dt>
            <dd className="text-stone-300" data-testid="tournament-runner-up">
              {model.runnerUp
                ? `${model.runnerUp.name}（${model.runnerUp.factionName}）`
                : '—'}
            </dd>
            <dt className="text-stone-600">破军</dt>
            <dd className="text-amber-100" data-testid="tournament-pojun">
              {model.pojun
                ? `${model.pojun.name}（${model.pojun.factionName}）`
                : '本届未产生'}
            </dd>
            {model.championPrizeName || model.runnerUpPrizeName ? (
              <>
                <dt className="text-stone-600">奖赏</dt>
                <dd className="text-stone-300" data-testid="tournament-prizes">
                  {model.championPrizeName ? (
                    <span data-testid="tournament-champion-prize">武魁得 {model.championPrizeName}</span>
                  ) : null}
                  {model.championPrizeName && model.runnerUpPrizeName ? (
                    <span className="text-stone-600"> · </span>
                  ) : null}
                  {model.runnerUpPrizeName ? (
                    <span data-testid="tournament-runner-prize">亚军得 {model.runnerUpPrizeName}</span>
                  ) : null}
                  <span className="ml-1 text-stone-600">（入势力库存）</span>
                </dd>
              </>
            ) : null}
            <dt className="text-stone-600">功绩</dt>
            <dd className="text-stone-500" data-testid="tournament-merit-hint">
              冠+30 · 亚+20 · 四强+10（君主不发）
            </dd>
            {model.betweenRoundHealCount != null ? (
              <>
                <dt className="text-stone-600">轮间药</dt>
                <dd className="text-stone-300" data-testid="tournament-heal-count">
                  金疮药自动用药 {model.betweenRoundHealCount} 次（晋级残血 +30 HP）
                </dd>
              </>
            ) : null}
          </dl>

          {totalSteps > 0 ? (
            <div className="space-y-1.5" data-testid="tournament-playback">
              <div className="flex flex-wrap items-center gap-1.5">
                <h4 className="text-xs tracking-widest text-amber-500">逐步观战</h4>
                <span className="text-xs text-stone-500" data-testid="tournament-playback-progress">
                  {playbackActive ? `${Math.min(revealedCount, totalSteps)}/${totalSteps}` : `共 ${totalSteps} 场`}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!playbackActive ? (
                  <InkButton
                    type="button"
                    data-testid="tournament-playback-start"
                    onClick={startPlayback}
                    className="border border-amber-800/80 bg-amber-950/30 px-2 py-1 text-xs text-amber-200 hover:border-amber-600"
                  >
                    开始观战
                  </InkButton>
                ) : (
                  <>
                    <InkButton
                      type="button"
                      data-testid="tournament-playback-next"
                      disabled={playbackDone}
                      onClick={nextStep}
                      className="border border-amber-800/80 bg-amber-950/30 px-2 py-1 text-xs text-amber-200 hover:border-amber-600 disabled:opacity-40"
                    >
                      {playbackDone ? '已看完' : '下一场'}
                    </InkButton>
                    <InkButton
                      type="button"
                      data-testid="tournament-playback-skip"
                      disabled={playbackDone}
                      onClick={skipRest}
                      className="border border-stone-700 bg-stone-950/60 px-2 py-1 text-xs text-stone-300 hover:border-amber-900 disabled:opacity-40"
                    >
                      跳过余下
                    </InkButton>
                    <InkButton
                      type="button"
                      data-testid="tournament-playback-reset"
                      onClick={resetPlayback}
                      className="border border-stone-700 bg-stone-950/60 px-2 py-1 text-xs text-stone-400 hover:border-stone-500"
                    >
                      重看
                    </InkButton>
                  </>
                )}
              </div>

              {currentStep ? (
                <div
                  className="border border-amber-900/60 bg-stone-950/70 px-2 py-2 text-xs text-stone-200"
                  data-testid="tournament-playback-current"
                >
                  <div className="text-amber-500/90">
                    {currentStep.roundLabel}
                    <span className="ml-1 text-stone-500">
                      · 第 {currentStep.stepIndex + 1} 场
                    </span>
                  </div>
                  <div className="mt-1">
                    {currentStep.match.fighterAName}
                    <span className="text-stone-600"> vs </span>
                    {currentStep.match.fighterBName}
                    {currentStep.match.winnerName ? (
                      <span className="text-amber-300"> · 胜 {currentStep.match.winnerName}</span>
                    ) : null}
                  </div>
                  {currentStep.match.narrative ? (
                    <div className="mt-1 text-stone-400" data-testid="tournament-playback-narrative">
                      {currentStep.match.narrative}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div data-testid="tournament-bracket">
            <h4 className="text-xs tracking-widest text-amber-500">
              {playbackActive ? '已揭示对阵' : '对阵纪要'}
            </h4>
            <div className="mt-1 max-h-48 space-y-2 overflow-y-auto pr-1">
              {model.rounds.map((round) => {
                const visibleMatches = playbackActive
                  ? round.matches.filter((match) => {
                      const globalIdx = model.playbackSteps.findIndex(
                        (s) => s.round === round.round && s.match.matchIndex === match.matchIndex,
                      );
                      return globalIdx >= 0 && globalIdx < revealedCount;
                    })
                  : round.matches;
                if (playbackActive && visibleMatches.length === 0) return null;
                return (
                  <div key={round.round} data-testid={`tournament-round-${round.round}`}>
                    <div className="text-xs text-stone-500">{round.label}</div>
                    <ul className="mt-0.5 space-y-1">
                      {visibleMatches.map((match) => (
                        <li
                          key={`${round.round}-${match.matchIndex}`}
                          className="border border-stone-800/80 bg-stone-950/40 px-2 py-1 text-xs text-stone-300"
                        >
                          <div>
                            {match.fighterAName}
                            <span className="text-stone-600"> vs </span>
                            {match.fighterBName}
                            {match.winnerName ? (
                              <span className="text-amber-300"> · 胜 {match.winnerName}</span>
                            ) : null}
                          </div>
                          {match.narrative ? (
                            <div className="mt-0.5 text-stone-500">{match.narrative}</div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {model.history.length > 0 ? (
        <div className="mt-3" data-testid="tournament-history">
          <h4 className="text-xs tracking-widest text-amber-500">历届武魁</h4>
          <ul className="mt-1 space-y-0.5 text-xs text-stone-400">
            {[...model.history].reverse().map((record) => (
              <li key={record.year}>
                {record.year}年 {record.title} {record.championName}
                <span className="text-stone-600"> · 亚军 {record.runnerUpName}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
