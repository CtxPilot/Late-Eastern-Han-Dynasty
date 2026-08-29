// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战略世界屏：天下→州→城 层级卡片（取代 MapCanvas 大地图交互）。
 * 选城仍写入 selectedCityId，供 RightPanel / 命令坞复用。
 */

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useEffect, useMemo } from 'react';
import { buildCommanderyWorldGraph, nanjun190 } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { buildCityCards, buildProvinceCards } from './buildProvinceCards';
import { ProvinceTopology } from './ProvinceTopology';

function formatCompact(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000) / 10}万`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}千`;
  return String(n);
}

export function StrategicWorldView() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const strategicView = useGameStore((s) => s.strategicView);
  const mapFocusCityId = useGameStore((s) => s.mapFocusCityId);
  const openStrategicRealm = useGameStore((s) => s.openStrategicRealm);
  const openStrategicProvince = useGameStore((s) => s.openStrategicProvince);
  const selectCity = useGameStore((s) => s.selectCity);
  const clearMapFocus = useGameStore((s) => s.clearMapFocus);

  // LeftPanel / focusMapOnCity：若请求聚焦某城，切到该州并选中
  useEffect(() => {
    if (mapFocusCityId == null || !game) return;
    const city = game.cities[mapFocusCityId];
    if (city) {
      openStrategicProvince(city.province);
      selectCity(mapFocusCityId);
    }
    clearMapFocus();
  }, [mapFocusCityId, game, openStrategicProvince, selectCity, clearMapFocus]);

  const provinceCards = useMemo(() => (game ? buildProvinceCards(game) : []), [game]);

  const cityCards = useMemo(() => {
    if (!game || strategicView.level !== 'province' || !strategicView.province) return [];
    return buildCityCards(game, strategicView.province, selectedCityId);
  }, [game, strategicView, selectedCityId]);

  const nanjunOverlay = useMemo(() => {
    if (strategicView.level !== 'province' || strategicView.province !== '荆州') return null;
    return buildCommanderyWorldGraph(nanjun190);
  }, [strategicView]);

  if (!game) return null;

  const isRealm = strategicView.level === 'realm';
  const provinceName = strategicView.level === 'province' ? strategicView.province : undefined;

  return (
    <div
      className="w-full h-full overflow-y-auto bg-stone-950 relative"
      data-testid="strategic-world-view"
      style={{ fontFamily: 'HanDynastySerif, serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 20% 10%, #a16207 0%, transparent 50%), radial-gradient(ellipse at 80% 90%, #7f1d1d 0%, transparent 45%)',
        }}
      />

      <div className="relative z-10 p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-amber-900/50 pb-3">
          <div>
            <p className="text-xs tracking-[0.35em] text-amber-700/90">天下大势</p>
            <h1 className="text-2xl md:text-3xl text-amber-400 font-semibold tracking-widest font-seal">
              {isRealm ? '天下形势' : `${provinceName}`}
            </h1>
            <p className="text-xs text-stone-500 mt-1">
              {isRealm
                ? '层级卡片览天下 · 点州入城'
                : '点城查看详情与下令；道路邻接见各卡底部'}
            </p>
          </div>
          {!isRealm && (
            <InkButton
              type="button"
              data-testid="strategic-back-realm"
              className="px-3 py-1.5 text-xs border border-amber-800/70 text-amber-300/90 rounded hover:bg-amber-950/60"
              onClick={() => openStrategicRealm()}
            >
              ← 返回天下
            </InkButton>
          )}
        </header>

        {isRealm ? (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            data-testid="strategic-province-grid"
          >
            {provinceCards.map((p) => (
              <InkButton
                key={p.province}
                type="button"
                data-testid={`strategic-province-${p.province}`}
                className="text-left rounded border border-stone-700/80 bg-stone-900/80 hover:border-amber-700/80 hover:bg-stone-900 p-3 transition-colors shadow-sm"
                onClick={() => openStrategicProvince(p.province)}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-lg text-amber-300 tracking-wider">{p.province}</h2>
                  {p.atWar && (
                    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-red-950 text-red-300 border border-red-900">
                      战事
                    </span>
                  )}
                </div>
                {p.dominant ? (
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: p.dominant.color }}
                      aria-hidden
                    />
                    <span className="text-xs text-stone-300">
                      主控 {p.dominant.name}
                      <span className="text-stone-500">
                        {' '}
                        · {p.dominant.sharePct}%（{p.dominant.cityCount}/{p.cityCount}）
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-stone-500 mb-2">无主控势力</div>
                )}
                {p.shares.length > 0 && (
                  <div className="mb-2 h-1.5 w-full rounded-sm overflow-hidden flex bg-stone-800" aria-hidden>
                    {p.shares.map((s) => (
                      <span
                        key={s.factionId}
                        style={{ width: `${s.sharePct}%`, backgroundColor: s.color }}
                        className="h-full"
                      />
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-400">
                  <span>城 {p.cityCount}</span>
                  <span>兵 {formatCompact(p.troops)}</span>
                  <span>口 {formatCompact(p.population)}</span>
                  <span>粮 {formatCompact(p.food)}</span>
                </div>
                {p.shares.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.shares.slice(0, 4).map((s) => (
                      <span
                        key={s.factionId}
                        className="text-xs px-1.5 py-0.5 rounded border border-stone-700 text-stone-400"
                        style={{ borderLeftColor: s.color, borderLeftWidth: 3 }}
                      >
                        {s.name} {s.sharePct}%
                      </span>
                    ))}
                  </div>
                )}
              </InkButton>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {provinceName && (
              <ProvinceTopology
                cities={game.cities}
                province={provinceName}
                selectedCityId={selectedCityId}
                onSelectCity={selectCity}
                overlay={nanjunOverlay}
                title={`${provinceName} · 官道拓扑`}
              />
            )}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
            data-testid="strategic-city-grid"
          >
            {cityCards.map((c) => (
              <InkButton
                key={c.id}
                type="button"
                data-testid={`strategic-city-${c.id}`}
                className={`text-left rounded border p-3 transition-colors ${
                  c.selected
                    ? 'border-amber-500 bg-amber-950/50 ring-1 ring-amber-700/40'
                    : c.isPlayer
                      ? 'border-emerald-900/70 bg-stone-900/80 hover:border-emerald-700'
                      : 'border-stone-700/80 bg-stone-900/80 hover:border-amber-800/60'
                }`}
                onClick={() => selectCity(c.id)}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="text-base text-amber-200 tracking-wide">
                    {c.name}
                    {c.adminName && c.adminName !== c.name && (
                      <span className="text-stone-500 text-xs ml-1">（{c.adminName}）</span>
                    )}
                  </h2>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {c.isCapital && (
                      <span className="text-xs px-1 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-900">
                        治所
                      </span>
                    )}
                    {c.isPass && (
                      <span className="text-xs px-1 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-600">
                        关隘
                      </span>
                    )}
                    {c.isPlayer && (
                      <span className="text-xs px-1 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-900">
                        己方
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mb-2 text-xs text-stone-300">
                  {c.rulerColor && (
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ backgroundColor: c.rulerColor }}
                      aria-hidden
                    />
                  )}
                  <span>{c.rulerName ?? '无主'}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-400">
                  <span>兵 {formatCompact(c.troops)}</span>
                  <span>口 {formatCompact(c.population)}</span>
                  <span>粮 {formatCompact(c.food)}</span>
                  <span>金 {formatCompact(c.gold)}</span>
                </div>
                {c.neighborNames.length > 0 && (
                  <p className="mt-2 text-xs text-stone-500 leading-snug">
                    官道邻：{c.neighborNames.join('、')}
                  </p>
                )}
              </InkButton>
            ))}
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
