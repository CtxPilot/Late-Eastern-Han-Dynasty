// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战略世界屏：天下→州→城 层级卡片（取代 MapCanvas 大地图交互）。
 * 遵循 DESIGN.md §6.2 金石水墨拓片风。
 * 选城仍写入 selectedCityId，供 RightPanel / 命令坞复用。
 */

import { InkButton } from './../ui/buttons';
import { useEffect, useMemo } from 'react';
import { buildCommanderyWorldGraph, nanjun190 } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { buildCityCards, buildProvinceCards } from './buildProvinceCards';
import { ProvinceTopology } from './ProvinceTopology';
import { SealBadge, SealIcon } from '../ui/SealBadge';

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
      className="w-full h-full overflow-y-auto bg-stone-950 relative select-none"
      data-testid="strategic-world-view"
      style={{ fontFamily: 'HanDynastySerif, serif' }}
    >
      {/* 水墨暗晕背景 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 25% 15%, #b45309 0%, transparent 55%), radial-gradient(ellipse at 75% 85%, #991b1b 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10 p-4 md:p-6 max-w-5xl mx-auto space-y-4">
        {/* 顶部标题栏 */}
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-amber-900/50 pb-3 bg-gradient-to-b from-stone-900/60 to-transparent p-3 rounded-t">
          <div>
            <p className="text-xs tracking-[0.35em] text-amber-600 font-song">汉家山河 · 天下大势</p>
            <h1 className="text-2xl md:text-3xl text-amber-300 font-semibold tracking-widest font-seal mt-1">
              {isRealm ? '天下十三州' : `${provinceName}诸郡`}
            </h1>
            <p className="text-xs text-stone-500 mt-1 font-song">
              {isRealm
                ? '金石拓片总览寰宇 · 点击州府巡视郡国治所'
                : '点击城池查阅防务政经并下令 · 道路邻接与关隘见卡片底部'}
            </p>
          </div>
          {!isRealm && (
            <InkButton
              type="button"
              data-testid="strategic-back-realm"
              className="px-3 py-1.5 text-xs border border-amber-800/80 text-amber-300/90 rounded bg-stone-900/90 hover:bg-amber-950/70 hover:border-amber-600 font-song"
              onClick={() => openStrategicRealm()}
            >
              ← 返回天下
            </InkButton>
          )}
        </header>

        {/* 天下十三州网格 */}
        {isRealm ? (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5"
            data-testid="strategic-province-grid"
          >
            {provinceCards.map((p) => (
              <InkButton
                key={p.province}
                type="button"
                data-testid={`strategic-province-${p.province}`}
                className="text-left rounded border border-stone-800/90 bg-stone-900/75 hover:border-amber-700 hover:bg-stone-900/95 p-3.5 transition-all shadow-md relative overflow-hidden group"
                onClick={() => openStrategicProvince(p.province)}
              >
                {/* 州名水印篆字 */}
                <span
                  className="absolute right-2 -bottom-2 text-5xl font-seal text-stone-800/20 group-hover:text-amber-500/10 transition-colors pointer-events-none"
                  aria-hidden
                >
                  {p.province.slice(0, 1)}
                </span>

                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <SealBadge char={p.province.slice(0, 1)} color="gold" size={17} />
                    <h2 className="text-lg text-amber-300 tracking-wider font-seal">{p.province}</h2>
                  </div>
                  {p.atWar && (
                    <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-red-950/90 text-red-300 border border-red-800 font-song">
                      烽烟激战
                    </span>
                  )}
                </div>

                {/* 主控势力状态 */}
                {p.dominant ? (
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/40"
                      style={{ backgroundColor: p.dominant.color }}
                      aria-hidden
                    />
                    <span className="text-xs text-stone-300 font-song">
                      主控 <strong className="text-amber-200">{p.dominant.name}</strong>
                      <span className="text-stone-500">
                        {' '}
                        · {p.dominant.sharePct}%（{p.dominant.cityCount}/{p.cityCount}城）
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-stone-500 mb-2 font-song">群雄交错 · 无单一主控</div>
                )}

                {/* 势力占比水墨进度条 */}
                {p.shares.length > 0 && (
                  <div className="mb-2.5 h-1.5 w-full rounded-sm overflow-hidden flex bg-stone-950 border border-stone-800" aria-hidden>
                    {p.shares.map((s) => (
                      <span
                        key={s.factionId}
                        style={{ width: `${s.sharePct}%`, backgroundColor: s.color }}
                        className="h-full opacity-90"
                      />
                    ))}
                  </div>
                )}

                {/* 四项战略指标 */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-stone-400 font-song border-t border-stone-800/80 pt-2">
                  <span className="flex items-center gap-1">
                    <SealIcon kind="city" size={12} /> 城池 {p.cityCount}
                  </span>
                  <span className="flex items-center gap-1 text-rose-300/90">
                    <SealIcon kind="troops" size={12} /> 守卒 {formatCompact(p.troops)}
                  </span>
                  <span className="flex items-center gap-1">
                    <SealIcon kind="pop" size={12} /> 户口 {formatCompact(p.population)}
                  </span>
                  <span className="flex items-center gap-1 text-amber-200/90">
                    <SealIcon kind="food" size={12} /> 积粟 {formatCompact(p.food)}
                  </span>
                </div>

                {/* 各势力简报 */}
                {p.shares.length > 1 && (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {p.shares.slice(0, 4).map((s) => (
                      <span
                        key={s.factionId}
                        className="text-[11px] px-1.5 py-0.5 rounded border border-stone-800 bg-stone-950/70 text-stone-400 font-song"
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
            {/* 官道拓扑图 */}
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

            {/* 州内城池卡片网格 */}
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              data-testid="strategic-city-grid"
            >
              {cityCards.map((c) => (
                <InkButton
                  key={c.id}
                  type="button"
                  data-testid={`strategic-city-${c.id}`}
                  className={`text-left rounded border p-3.5 transition-all shadow-sm ${
                    c.selected
                      ? 'border-amber-500 bg-amber-950/60 ring-1 ring-amber-500/80 shadow-[0_4px_16px_rgba(217,119,6,0.25)]'
                      : c.isPlayer
                        ? 'border-emerald-800/80 bg-stone-900/80 hover:border-emerald-600'
                        : 'border-stone-800 bg-stone-900/70 hover:border-amber-800/70'
                  }`}
                  onClick={() => selectCity(c.id)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h2 className="text-base text-amber-200 tracking-wide font-song font-semibold flex items-center gap-1">
                      {c.name}
                      {c.adminName && c.adminName !== c.name && (
                        <span className="text-stone-500 text-xs ml-0.5 font-normal">（{c.adminName}）</span>
                      )}
                    </h2>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {c.isCapital && (
                        <span className="text-xs px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 font-song">
                          治所
                        </span>
                      )}
                      {c.isPass && (
                        <span className="text-xs px-1.5 py-0.2 rounded bg-stone-800 text-stone-300 border border-stone-600 font-song">
                          要隘
                        </span>
                      )}
                      {c.isPlayer && (
                        <span className="text-xs px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-song">
                          己方
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 统治势力 */}
                  <div className="flex items-center gap-2 mb-2 text-xs text-stone-300 font-song">
                    {c.rulerColor && (
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0 border border-black/50"
                        style={{ backgroundColor: c.rulerColor }}
                        aria-hidden
                      />
                    )}
                    <span>{c.rulerName ? `执掌：${c.rulerName}` : '无主之城'}</span>
                  </div>

                  {/* 资源简览 */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-stone-400 font-song border-t border-stone-800/60 pt-2">
                    <span className="text-rose-300/80">兵 {formatCompact(c.troops)}</span>
                    <span>口 {formatCompact(c.population)}</span>
                    <span className="text-amber-200/80">粮 {formatCompact(c.food)}</span>
                    <span className="text-amber-100">金 {formatCompact(c.gold)}</span>
                  </div>

                  {c.neighborNames.length > 0 && (
                    <p className="mt-2 text-[11px] text-stone-500 leading-snug font-song truncate">
                      官道邻接：{c.neighborNames.join(' · ')}
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
