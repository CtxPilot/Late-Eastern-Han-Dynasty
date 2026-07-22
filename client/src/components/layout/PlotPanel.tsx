// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { PlotStage, PlotType, SpyStatus } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

const PLOT_LABEL: Record<string, string> = {
  honeyTrap: '美人计',
  sowDiscord: '离间计',
  falseIntel: '假情报',
  emptyFort: '空城疑兵',
};

/**
 * 计谋 S17：美人计 / 离间 / 假情报 / 空城疑兵
 */
export function PlotPanel() {
  const game = useGameStore((s) => s.game);
  const launchPlot = useGameStore((s) => s.launchPlot);
  const loading = useGameStore((s) => s.loading);

  const [plotType, setPlotType] = useState<string>(PlotType.HONEY_TRAP);
  const [targetCityId, setTargetCityId] = useState<number | ''>('');
  const [targetFactionId, setTargetFactionId] = useState<number | ''>('');
  const [agentId, setAgentId] = useState<string>('');

  const myPlots = useMemo(() => {
    if (!game?.plots) return [];
    return game.plots
      .filter((p) => p.casterFactionId === game.playerFactionId)
      .sort((a, b) => b.year - a.year || b.month - a.month);
  }, [game]);

  const enemyCities = useMemo(() => {
    if (!game) return [];
    return Object.values(game.cities)
      .filter((c) => c.ruler !== game.playerFactionId && c.ruler != null)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  const ownWeakCities = useMemo(() => {
    if (!game) return [];
    return Object.values(game.cities)
      .filter(
        (c) =>
          c.ruler === game.playerFactionId &&
          c.troops < 3500 &&
          c.food >= 150,
      )
      .sort((a, b) => a.troops - b.troops);
  }, [game]);

  const enemyFactions = useMemo(() => {
    if (!game) return [];
    return Object.values(game.factions).filter(
      (f) => f.id !== game.playerFactionId && f.isAlive,
    );
  }, [game]);

  const femaleAgents = useMemo(() => {
    if (!game?.intel?.agents) return [];
    return Object.values(game.intel.agents).filter(
      (a) =>
        a.factionId === game.playerFactionId &&
        a.agentKind === 'female' &&
        a.status === SpyStatus.IDLE &&
        a.cooldownMonths <= 0,
    );
  }, [game]);

  if (!game) return null;

  const beautyStock = game.factions[game.playerFactionId]?.beautyStock ?? 0;
  const isHoney = plotType === PlotType.HONEY_TRAP;
  const isDiscord = plotType === PlotType.SOW_DISCORD;
  const isFalse = plotType === PlotType.FALSE_INTEL;
  const isEmpty = plotType === PlotType.EMPTY_FORT;

  const canLaunch = isHoney
    ? targetCityId !== '' && beautyStock >= 2
    : isDiscord
      ? targetFactionId !== ''
      : isFalse
        ? targetCityId !== ''
        : isEmpty
          ? targetCityId !== ''
          : false;

  return (
    <div className="px-2 space-y-2 text-[11px]" data-testid="plot-panel">
      <p className="text-stone-500 px-1 leading-snug">
        <strong className="text-pink-400">美人计</strong>：需探秘情报 + 美女≥2 + 金150
        <br />
        <strong className="text-amber-400">离间计</strong>：金200
        <br />
        <strong className="text-sky-400">假情报</strong>：需探秘情报 + 金120 → 诱敌攻该城
        <br />
        <strong className="text-emerald-400">空城疑兵</strong>：己方寡兵 + 粮150 → 暂缓被攻
      </p>

      <div className="max-h-28 overflow-y-auto space-y-0.5">
        {myPlots.length === 0 && (
          <p className="text-stone-600 px-1">尚无计谋记录。</p>
        )}
        {myPlots.map((p) => (
          <div
            key={p.id}
            className={`px-2 py-1 rounded border ${
              p.stage === PlotStage.RESOLVED
                ? 'border-stone-800 text-stone-500'
                : p.stage === PlotStage.ACTIVE
                  ? 'border-sky-800 bg-sky-950/30 text-sky-100'
                  : 'border-amber-800 bg-amber-950/30 text-amber-100'
            }`}
          >
            <span className="font-medium">{PLOT_LABEL[p.type] ?? p.type}</span>
            <span className="text-stone-500 ml-1">
              {p.stage === PlotStage.PREP
                ? `准备中（${p.monthsLeft}月）`
                : p.stage === PlotStage.ACTIVE
                  ? `生效中（余${p.monthsLeft}月${p.result?.inverted ? '·已识破' : ''}）`
                  : p.result?.success
                    ? '成功'
                    : '失败'}
            </span>
            {p.result?.message && (
              <span className="block text-stone-500 text-[10px]">{p.result.message}</span>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-stone-800 pt-1.5 space-y-1">
        <div className="text-amber-400/80 px-0.5">发起计谋</div>
        <select
          className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
          value={plotType}
          onChange={(e) => {
            setPlotType(e.target.value);
            setTargetCityId('');
            setTargetFactionId('');
          }}
        >
          <option value={PlotType.HONEY_TRAP}>美人计（美女2+金150）</option>
          <option value={PlotType.SOW_DISCORD}>离间计（金200）</option>
          <option value={PlotType.FALSE_INTEL}>假情报（金120+探秘情报）</option>
          <option value={PlotType.EMPTY_FORT}>空城疑兵（粮150+寡兵）</option>
        </select>

        {(isHoney || isFalse) && (
          <select
            className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
            value={targetCityId}
            onChange={(e) => setTargetCityId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">目标城（须探秘情报）…</option>
            {enemyCities.map((c) => {
              const report = game.intel?.cities?.[c.id];
              const hasDetailed = report?.depth === 'detailed';
              return (
                <option key={c.id} value={c.id} disabled={!hasDetailed}>
                  {c.name} {hasDetailed ? '✓' : '（需探秘）'}
                </option>
              );
            })}
          </select>
        )}

        {isEmpty && (
          <select
            className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
            value={targetCityId}
            onChange={(e) => setTargetCityId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">己方寡兵城（兵&lt;3500，粮≥150）…</option>
            {ownWeakCities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} 兵{c.troops} 粮{c.food}
              </option>
            ))}
          </select>
        )}

        {isDiscord && (
          <select
            className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
            value={targetFactionId}
            onChange={(e) => setTargetFactionId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">目标势力…</option>
            {enemyFactions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}

        {isHoney && (
          <select
            className="w-full rounded border border-stone-700 bg-stone-900 px-1 py-1 text-stone-200"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            <option value="">不派女间谍</option>
            {femaleAgents.map((a) => (
              <option key={a.id} value={a.id}>
                ♀ {a.name} Lv{a.rank}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          data-testid="btn-plot-launch"
          disabled={loading || !canLaunch}
          className="w-full px-2 py-1.5 rounded border border-amber-800 bg-amber-950/40 text-amber-100 disabled:opacity-40"
          onClick={() => {
            if (isHoney && targetCityId !== '') {
              void launchPlot(PlotType.HONEY_TRAP, {
                targetCityId: Number(targetCityId),
                agentId: agentId || undefined,
              });
            } else if (isDiscord && targetFactionId !== '') {
              void launchPlot(PlotType.SOW_DISCORD, {
                targetFactionId: Number(targetFactionId),
              });
            } else if (isFalse && targetCityId !== '') {
              void launchPlot(PlotType.FALSE_INTEL, {
                targetCityId: Number(targetCityId),
              });
            } else if (isEmpty && targetCityId !== '') {
              void launchPlot(PlotType.EMPTY_FORT, {
                targetCityId: Number(targetCityId),
              });
            }
          }}
        >
          发起{PLOT_LABEL[plotType] ?? plotType}
        </button>
        {isHoney && (
          <p className="text-stone-600 text-[10px] px-0.5">
            当前美女：{beautyStock}（需≥2）
          </p>
        )}
        {isEmpty && ownWeakCities.length === 0 && (
          <p className="text-stone-600 text-[10px] px-0.5">
            无符合条件的己方城（需兵&lt;3500 且粮≥150；可先分兵）
          </p>
        )}
      </div>
    </div>
  );
}
