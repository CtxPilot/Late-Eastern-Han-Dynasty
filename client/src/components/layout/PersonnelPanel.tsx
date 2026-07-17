// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo } from 'react';
import { OfficerStatus } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

/**
 * S11 人事：搜索 / 登用在野男将（历史女角禁止）
 */
export function PersonnelPanel() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const searchTalent = useGameStore((s) => s.searchTalent);
  const recruitOfficer = useGameStore((s) => s.recruitOfficer);
  const loading = useGameStore((s) => s.loading);

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
          onClick={() => {
            if (searchCityId != null) void searchTalent(searchCityId);
          }}
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
                  onClick={() => void recruitOfficer(o.id)}
                >
                  登用
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
