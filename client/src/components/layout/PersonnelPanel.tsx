// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { OfficerStatus, type Officer } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

/**
 * S11 人事：搜索 / 登用在野男将（历史女角禁止）
 */
export function PersonnelPanel() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const searchTalent = useGameStore((s) => s.searchTalent);
  const recruitOfficer = useGameStore((s) => s.recruitOfficer);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const [confirm, setConfirm] = useState<{ type: 'search' } | { type: 'recruit'; officer: Officer } | null>(null);

  const freeOfficers = useMemo(() => {
    if (!game) return [];
    return Object.values(game.officers)
      .filter((o) => o.faction == null && o.status === OfficerStatus.FREE)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  if (!game) return null;

  const playerCities = Object.values(game.cities).filter(
    (c) => c.ruler === game.playerFactionId,
  );
  const searchCityId =
    selectedCityId != null && game.cities[selectedCityId]?.ruler === game.playerFactionId
      ? selectedCityId
      : game.factions[game.playerFactionId]?.capitalCityId ?? playerCities[0]?.id;

  const searchCity = searchCityId != null ? game.cities[searchCityId] : null;
  const canSearch = searchCity != null && searchCity.gold >= 80;

  const ruler = game.officers[game.factions[game.playerFactionId]?.rulerId];

  return (
    <div className="px-2 space-y-2 text-[11px]" data-testid="personnel-panel">
      <p className="text-stone-500 px-1 leading-snug">
        搜索耗<strong className="text-stone-400">80金</strong>；登用耗
        <strong className="text-stone-400">200金</strong>。仅
        <strong className="text-amber-400/90">在野男将</strong>
        ；历史女角见「家族」。
      </p>

      <div className="space-y-1">
        <div className="text-rose-400/80 px-0.5">搜索</div>
        <div className="flex items-center gap-1 px-0.5 text-stone-400">
          <span>城：{searchCity?.name ?? '—'}</span>
          <span className="text-stone-600">金{searchCity?.gold ?? 0}</span>
        </div>
        <button
          type="button"
          data-testid="btn-personnel-search"
          disabled={loading || !canSearch}
          className="w-full px-2 py-1.5 rounded border border-rose-900/60 bg-rose-950/30 text-rose-100 disabled:opacity-40"
          onClick={() => setConfirm({ type: 'search' })}
        >
          搜索人才（80金）
        </button>
      </div>

      <div className="border-t border-stone-800 pt-1.5 space-y-1">
        <div className="text-rose-400/80 px-0.5">
          在野可登用（{freeOfficers.length}）
        </div>
        {freeOfficers.length === 0 && (
          <p className="text-stone-600 px-1">暂无在野武将。可先搜索或等待跟随。</p>
        )}
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {freeOfficers.map((o) => {
            const loc = o.location != null ? game.cities[o.location]?.name : '未知';
            const compatDiff =
              ruler != null
                ? Math.abs(o.hidden.compatibility - ruler.hidden.compatibility)
                : null;
            return (
              <div
                key={o.id}
                className="px-2 py-1 rounded border border-stone-800 flex items-center justify-between gap-1"
              >
                <div className="min-w-0">
                  <div className="text-stone-200 font-medium truncate">{o.name}</div>
                  <div className="text-[10px] text-stone-500">
                    {loc} · 统{o.stats.leadership}/武{o.stats.war}/智
                    {o.stats.intelligence}
                    {compatDiff != null ? ` · 相性差${compatDiff}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  data-testid={`btn-recruit-${o.id}`}
                  disabled={loading}
                  className="shrink-0 px-1.5 py-0.5 rounded border border-amber-800/70 bg-amber-950/40 text-amber-100 text-[10px] disabled:opacity-40"
                  onClick={() => setConfirm({ type: 'recruit', officer: o })}
                >
                  登用
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <CommandConfirmDialog
        open={confirm?.type === 'search'}
        category="人事"
        command="搜索人才"
        summary="派员访求在野人才或遗落宝物。"
        items={[
          { label: '执行地', value: searchCity?.name ?? '—' },
          { label: '目标', value: '在野人才／宝物' },
          { label: '立即消耗', value: '金 80' },
          { label: '耗时', value: '立即结算' },
          { label: '可能结果', value: '发现人才、宝物，或无所获' },
        ]}
        loading={loading}
        error={error}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (searchCityId == null) return;
          await searchTalent(searchCityId);
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
      <CommandConfirmDialog
        open={confirm?.type === 'recruit'}
        category="人事"
        command="登用武将"
        summary="遣使劝说在野武将归属本势力。"
        items={confirm?.type === 'recruit' ? [
          { label: '执行者', value: ruler?.name ?? '君主府' },
          { label: '目标', value: `${confirm.officer.name}（${game.cities[confirm.officer.location ?? -1]?.name ?? '未知'}）` },
          { label: '立即消耗', value: '金 200' },
          { label: '耗时', value: '立即结算' },
          { label: '可能结果', value: '受相性与魅力影响，可能拒绝', tone: 'warning' },
        ] : []}
        loading={loading}
        error={error}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.type !== 'recruit') return;
          await recruitOfficer(confirm.officer.id);
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
    </div>
  );
}
