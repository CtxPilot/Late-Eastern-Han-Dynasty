// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import {
  PlotStage,
  PlotType,
  SpyStatus,
  isAllied,
  type GameState,
  type Plot,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { getFactionResourceTotals } from '../../utils/factionResources';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import type { CommandShellAction } from './commandShellState';

const MAX_ACTIVE_PLOTS = 4;

const PLOT_LABEL: Record<PlotType, string> = {
  [PlotType.HONEY_TRAP]: '美人计',
  [PlotType.SOW_DISCORD]: '离间计',
  [PlotType.FALSE_INTEL]: '假情报',
  [PlotType.EMPTY_FORT]: '空城疑兵',
};

const STAGE_LABEL: Record<PlotStage, string> = {
  [PlotStage.PREP]: '准备中',
  [PlotStage.ACTIVE]: '生效中',
  [PlotStage.RESOLVED]: '已结算',
};

const PLOT_COST: Record<PlotType, string> = {
  [PlotType.HONEY_TRAP]: '宫廷人脉 2、金 150',
  [PlotType.SOW_DISCORD]: '金 200',
  [PlotType.FALSE_INTEL]: '金 120',
  [PlotType.EMPTY_FORT]: '目标城粮 150',
};

export type StrategyLaunchDraft = {
  type: PlotType;
  targetCityId: number | null;
  targetFactionId: number | null;
  agentId: string | null;
};

export function validateStrategyLaunch(
  game: GameState,
  draft: StrategyLaunchDraft,
): string | null {
  const factionId = game.playerFactionId;
  const ownCities = Object.values(game.cities).filter((city) => city.ruler === factionId);
  const activeCount = (game.plots ?? []).filter(
    (plot) => plot.casterFactionId === factionId && plot.stage !== PlotStage.RESOLVED,
  ).length;
  const canPayGold = (cost: number) => ownCities.some((city) => city.gold >= cost);
  if (activeCount >= MAX_ACTIVE_PLOTS) return `进行中计谋已达上限 ${MAX_ACTIVE_PLOTS}。`;

  if (draft.type === PlotType.SOW_DISCORD) {
    const target = draft.targetFactionId == null ? null : game.factions[draft.targetFactionId];
    if (!target || !target.isAlive || target.id === factionId) return '请选择仍存续的敌对势力。';
    if (isAllied(game.diplomacy, factionId, target.id)) return '不能对盟友施展离间计。';
    if (!canPayGold(200)) return '没有己方城池能够支付金 200。';
    return null;
  }

  const target = draft.targetCityId == null ? null : game.cities[draft.targetCityId];
  if (!target) {
    return draft.type === PlotType.EMPTY_FORT
      ? '请选择符合条件的己方寡兵城。'
      : '请选择已获探秘情报的敌城。';
  }
  if (draft.type === PlotType.EMPTY_FORT) {
    if (target.ruler !== factionId || target.troops >= 3500 || target.food < 150) {
      return '空城疑兵目标需为己方城，且兵力＜3500、粮≥150。';
    }
    return null;
  }
  if (target.ruler == null || target.ruler === factionId) return '计谋目标必须是敌方城池。';
  if (game.intel?.cities?.[target.id]?.depth !== 'detailed') {
    return '需先对目标城探秘，取得 detailed 情报。';
  }
  if (draft.type === PlotType.FALSE_INTEL) {
    return canPayGold(120) ? null : '没有己方城池能够支付金 120。';
  }
  if ((game.factions[factionId]?.courtNetwork ?? 0) < 2) return '宫廷人脉不足（需 2）。';
  if (!canPayGold(150)) return '没有己方城池能够支付金 150。';
  if (draft.agentId) {
    const agent = game.intel?.agents?.[draft.agentId];
    if (
      !agent
      || agent.factionId !== factionId
      || agent.agentKind !== 'female'
      || agent.status !== SpyStatus.IDLE
      || agent.cooldownMonths > 0
    ) return '所选女间谍已不再空闲，请返回修改。';
  }
  return null;
}

export type StrategyPlotSummary = {
  id: string;
  type: PlotType;
  label: string;
  stage: PlotStage;
  stageLabel: string;
  target: string;
  monthsLeft: number;
  message: string | null;
  detected: boolean;
};

export type StrategyOverview = {
  activeCount: number;
  maxActive: number;
  totalGold: number;
  totalFood: number;
  courtNetwork: number;
  detailedEnemyCities: string[];
  idleFemaleAgents: string[];
  emptyFortCandidates: string[];
  plots: StrategyPlotSummary[];
};

function getPlotTarget(game: GameState, plot: Plot): string {
  if (plot.targetCityId != null) return game.cities[plot.targetCityId]?.name ?? '未知城池';
  if (plot.targetFactionId != null) return game.factions[plot.targetFactionId]?.name ?? '未知势力';
  return '—';
}

export function buildStrategyOverview(game: GameState): StrategyOverview {
  const resources = getFactionResourceTotals(game, game.playerFactionId);
  const playerPlots = (game.plots ?? [])
    .filter((plot) => plot.casterFactionId === game.playerFactionId)
    .sort((a, b) => b.year - a.year || b.month - a.month || a.id.localeCompare(b.id));
  const detailedEnemyCities = Object.values(game.cities)
    .filter((city) =>
      city.ruler != null
      && city.ruler !== game.playerFactionId
      && game.intel?.cities?.[city.id]?.depth === 'detailed')
    .sort((a, b) => a.id - b.id)
    .map((city) => city.name);
  const idleFemaleAgents = Object.values(game.intel?.agents ?? {})
    .filter((agent) =>
      agent.factionId === game.playerFactionId
      && agent.agentKind === 'female'
      && agent.status === SpyStatus.IDLE
      && agent.cooldownMonths <= 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    .map((agent) => agent.name);
  const emptyFortCandidates = Object.values(game.cities)
    .filter((city) =>
      city.ruler === game.playerFactionId
      && city.troops < 3500
      && city.food >= 150)
    .sort((a, b) => a.troops - b.troops || a.id - b.id)
    .map((city) => city.name);

  return {
    activeCount: playerPlots.filter((plot) => plot.stage !== PlotStage.RESOLVED).length,
    maxActive: MAX_ACTIVE_PLOTS,
    totalGold: resources.gold,
    totalFood: resources.food,
    courtNetwork: game.factions[game.playerFactionId]?.courtNetwork ?? 0,
    detailedEnemyCities,
    idleFemaleAgents,
    emptyFortCandidates,
    plots: playerPlots.map((plot) => ({
      id: plot.id,
      type: plot.type,
      label: PLOT_LABEL[plot.type],
      stage: plot.stage,
      stageLabel: STAGE_LABEL[plot.stage],
      target: getPlotTarget(game, plot),
      monthsLeft: plot.monthsLeft,
      message: plot.result?.message ?? null,
      detected: plot.result?.detected ?? false,
    })),
  };
}

type StrategyFacet = 'situation' | 'launch' | 'ongoing';

const FACETS: readonly { id: StrategyFacet; label: string }[] = [
  { id: 'situation', label: '态势' },
  { id: 'launch', label: '发起' },
  { id: 'ongoing', label: '进行中' },
];

export function StrategyOverviewDrawer({
  dispatch,
}: {
  dispatch: React.Dispatch<CommandShellAction>;
}) {
  const game = useGameStore((state) => state.game);
  const launchPlot = useGameStore((state) => state.launchPlot);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const [facet, setFacet] = useState<StrategyFacet>('situation');
  const [draft, setDraft] = useState<StrategyLaunchDraft>({
    type: PlotType.HONEY_TRAP,
    targetCityId: null,
    targetFactionId: null,
    agentId: null,
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const overview = useMemo(() => game ? buildStrategyOverview(game) : null, [game]);

  if (!game || !overview) return <p data-testid="command-strategy-empty">尚未载入剧本。</p>;
  const enemyCities = Object.values(game.cities)
    .filter((city) => city.ruler != null && city.ruler !== game.playerFactionId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const weakCities = Object.values(game.cities)
    .filter((city) =>
      city.ruler === game.playerFactionId && city.troops < 3500 && city.food >= 150)
    .sort((a, b) => a.troops - b.troops || a.id - b.id);
  const enemyFactions = Object.values(game.factions)
    .filter((faction) =>
      faction.id !== game.playerFactionId
      && faction.isAlive
      && !isAllied(game.diplomacy, game.playerFactionId, faction.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const femaleAgents = Object.values(game.intel?.agents ?? {})
    .filter((agent) =>
      agent.factionId === game.playerFactionId
      && agent.agentKind === 'female'
      && agent.status === SpyStatus.IDLE
      && agent.cooldownMonths <= 0)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const isCityTarget = draft.type !== PlotType.SOW_DISCORD;
  const isHoney = draft.type === PlotType.HONEY_TRAP;
  const isEmpty = draft.type === PlotType.EMPTY_FORT;
  const launchReason = validateStrategyLaunch(game, draft);
  const targetName = draft.type === PlotType.SOW_DISCORD
    ? game.factions[draft.targetFactionId ?? -1]?.name ?? '未选目标'
    : game.cities[draft.targetCityId ?? -1]?.name ?? '未选目标';

  return (
    <div
      className="flex h-[min(34rem,calc(100vh-12rem))] min-h-0 flex-1 flex-col"
      data-testid="command-strategy-drawer"
    >
      <nav className="mb-3 grid grid-cols-3 gap-1" aria-label="计略分面">
        {FACETS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`command-strategy-facet-${item.id}`}
            aria-current={facet === item.id ? 'page' : undefined}
            onClick={() => setFacet(item.id)}
            className={`border py-1.5 ${
              facet === item.id
                ? 'border-violet-700 bg-violet-950/40 text-violet-100'
                : 'border-stone-800 text-stone-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <p className="mb-3 text-[10px] leading-relaxed text-stone-500">
        S17 四计由此唯一发起；探秘与女间谍仍归 S07 情报域。
      </p>

      {facet === 'situation' ? (
        <section className="min-h-0 space-y-3 overflow-y-auto" data-testid="command-strategy-situation">
          <div className="grid grid-cols-3 gap-2">
            <Metric label="进行中" value={`${overview.activeCount}/${overview.maxActive}`} />
            <Metric label="势力总金" value={overview.totalGold} />
            <Metric label="宫廷人脉" value={overview.courtNetwork} />
          </div>
          <InfoList title="已获探秘情报的敌城" items={overview.detailedEnemyCities} empty="暂无；美人计与假情报尚无可用敌城。" />
          <InfoList title="空闲女间谍" items={overview.idleFemaleAgents} empty="暂无；美人计仍可不派女间谍。" />
          <InfoList title="空城疑兵候选" items={overview.emptyFortCandidates} empty="暂无兵力＜3500且粮≥150的己方城。" />
          <p className="border border-stone-800 bg-stone-900/50 px-3 py-2 text-[10px] text-stone-500">
            总军师任免归朝廷；未来战略态势与献策才进入计略。
          </p>
        </section>
      ) : facet === 'launch' ? (
        <section className="min-h-0 space-y-2 overflow-y-auto" data-testid="command-strategy-launch">
          <label className="block text-[10px] text-stone-500">
            计略
            <select
              data-testid="command-strategy-plot-type"
              className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
              value={draft.type}
              onChange={(event) => setDraft({
                type: event.target.value as PlotType,
                targetCityId: null,
                targetFactionId: null,
                agentId: null,
              })}
            >
              <option value={PlotType.HONEY_TRAP}>美人计（探秘情报、人脉2、金150）</option>
              <option value={PlotType.SOW_DISCORD}>离间计（非盟友势力、金200）</option>
              <option value={PlotType.FALSE_INTEL}>假情报（探秘情报、金120）</option>
              <option value={PlotType.EMPTY_FORT}>空城疑兵（寡兵城、粮150）</option>
            </select>
          </label>

          {draft.type === PlotType.SOW_DISCORD ? (
            <label className="block text-[10px] text-stone-500">
              目标势力
              <select
                data-testid="command-strategy-target-faction"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.targetFactionId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  targetFactionId: event.target.value ? Number(event.target.value) : null,
                }))}
              >
                <option value="">选择存续的非盟友势力…</option>
                {enemyFactions.map((faction) => <option key={faction.id} value={faction.id}>{faction.name}</option>)}
              </select>
            </label>
          ) : (
            <label className="block text-[10px] text-stone-500">
              {isEmpty ? '己方寡兵城' : '目标敌城'}
              <select
                data-testid="command-strategy-target-city"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.targetCityId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  targetCityId: event.target.value ? Number(event.target.value) : null,
                }))}
              >
                <option value="">{isEmpty ? '兵力＜3500且粮≥150…' : '选择已获 detailed 情报的敌城…'}</option>
                {(isEmpty ? weakCities : enemyCities).map((city) => {
                  const detailed = game.intel?.cities?.[city.id]?.depth === 'detailed';
                  return (
                    <option key={city.id} value={city.id} disabled={!isEmpty && !detailed}>
                      {city.name} {isEmpty ? `兵${city.troops} 粮${city.food}` : detailed ? '✓' : '（需探秘）'}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {isHoney ? (
            <label className="block text-[10px] text-stone-500">
              女间谍（可选）
              <select
                data-testid="command-strategy-agent"
                className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200"
                value={draft.agentId ?? ''}
                onChange={(event) => setDraft((current) => ({
                  ...current,
                  agentId: event.target.value || null,
                }))}
              >
                <option value="">不派女间谍</option>
                {femaleAgents.map((agent) => <option key={agent.id} value={agent.id}>♀ {agent.name} Lv{agent.rank}</option>)}
              </select>
            </label>
          ) : null}

          <div className="border border-stone-800 bg-stone-900/50 px-3 py-2 text-[10px] text-stone-500">
            <p>立即消耗：<span className="text-stone-300">{PLOT_COST[draft.type]}</span></p>
            <p>当前进行中：{overview.activeCount}/{overview.maxActive}</p>
          </div>
          {launchReason ? <p data-testid="command-strategy-launch-reason" className="text-[10px] text-amber-500">{launchReason}</p> : null}
          {!isEmpty && draft.type !== PlotType.SOW_DISCORD ? (
            <button
              type="button"
              data-testid="command-strategy-go-intel"
              className="w-full rounded border border-sky-800 bg-sky-950/30 px-3 py-2 text-sky-100"
              onClick={() => dispatch({
                type: 'select-command',
                domain: 'intel',
                commandId: 'recon',
              })}
            >
              前往情报 · 探秘
            </button>
          ) : null}
          <button
            type="button"
            data-testid="command-strategy-launch-submit"
            data-command-write="true"
            disabled={loading || launchReason != null}
            className="w-full rounded border border-violet-700 bg-violet-950/50 px-3 py-2 text-violet-100 disabled:opacity-40"
            onClick={() => setConfirmOpen(true)}
          >
            送交终审 · {PLOT_LABEL[draft.type]}
          </button>
          <p className="text-[10px] leading-relaxed text-stone-600">
            探秘和女间谍仍属于情报域；跨域导航不复制情报写链。
          </p>
        </section>
      ) : (
        <section className="min-h-0 space-y-2 overflow-y-auto" data-testid="command-strategy-ongoing">
          {overview.plots.length === 0 ? (
            <p className="border border-stone-800 bg-stone-900/50 px-3 py-3 text-stone-500">
              尚无己方计谋记录。
            </p>
          ) : overview.plots.map((plot) => (
            <article
              key={plot.id}
              data-testid={`command-strategy-plot-${plot.id}`}
              className="border border-stone-800 bg-stone-900/60 px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <strong className="text-stone-100">{plot.label} · {plot.target}</strong>
                <span className="text-[10px] text-violet-200">{plot.stageLabel}</span>
              </div>
              <p className="mt-1 text-[10px] text-stone-500">
                {plot.stage === PlotStage.RESOLVED ? '已完成' : `剩余 ${plot.monthsLeft} 月`}
                {plot.detected ? ' · 已暴露' : ''}
              </p>
              {plot.message ? <p className="text-[10px] text-stone-400">{plot.message}</p> : null}
            </article>
          ))}
          <p className="text-[10px] text-stone-600">中止与反制尚无权威规则，不提供占位按钮。</p>
        </section>
      )}
      <CommandConfirmDialog
        open={confirmOpen}
        category="计略"
        command={`确认发起${PLOT_LABEL[draft.type]}：${targetName}`}
        summary="计谋会立即扣除资源并进入准备或结算流程，失败时资源不返还。"
        items={[
          { label: '目标', value: targetName },
          { label: '立即消耗', value: PLOT_COST[draft.type], tone: 'warning' },
          { label: '执行者', value: isHoney && draft.agentId ? game.intel?.agents?.[draft.agentId]?.name ?? '女间谍已失效' : '势力计略（不指定武将）' },
          { label: '结算', value: isEmpty ? '立即布置防御效果' : '进入准备／成功率判定' },
          { label: '失败后果', value: '已消耗资源不返还' },
        ]}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return latest ? validateStrategyLaunch(latest, draft) : '计谋草稿已失效，请返回修改。';
        }}
        fallbackFocusSelector="[data-testid='command-domain-strategy']"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await launchPlot(draft.type, {
            targetCityId: isCityTarget ? draft.targetCityId ?? undefined : undefined,
            targetFactionId: draft.type === PlotType.SOW_DISCORD ? draft.targetFactionId ?? undefined : undefined,
            agentId: isHoney ? draft.agentId ?? undefined : undefined,
          });
          if (!useGameStore.getState().error) {
            setConfirmOpen(false);
            setDraft((current) => ({ ...current, targetCityId: null, targetFactionId: null, agentId: null }));
          }
        }}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-stone-800 bg-stone-900/60 px-2 py-2 text-center">
      <strong className="block text-stone-100">{value}</strong>
      <span className="text-[9px] text-stone-500">{label}</span>
    </div>
  );
}

function InfoList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="border border-stone-800 bg-stone-900/40 px-3 py-2">
      <h3 className="text-stone-300">{title}（{items.length}）</h3>
      <p className="mt-1 text-[10px] text-stone-500">{items.length > 0 ? items.join('、') : empty}</p>
    </div>
  );
}
