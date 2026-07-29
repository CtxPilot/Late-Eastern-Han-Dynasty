// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { ensureDemographics, maxConscriptable, type GameState } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import type { MilitaryOverview } from './MilitaryOverviewDrawer';

export type ReadinessOrder = 'conscript' | 'train';

export function validateReadinessOrder(
  game: GameState,
  cityId: number,
  order: ReadinessOrder,
): string | null {
  const city = game.cities[cityId];
  if (!city || city.ruler !== game.playerFactionId) return '所选城市已不存在或归属已经变化。';
  if (order === 'conscript') {
    if (city.gold < 80) return `城市金不足（需80，当前${city.gold}）。`;
    if (city.food < 120) return `城市粮不足（需120，当前${city.food}）。`;
    const available = maxConscriptable(ensureDemographics(city));
    if (available < 50) return `成年男丁不足（可征${available}，需保留劳作人口）。`;
  } else {
    if (city.food < 60) return `城市粮不足（需60，当前${city.food}）。`;
    if (city.troops < 100) return `兵力不足（当前${city.troops}，至少100方可训练）。`;
  }
  return null;
}

export function MilitaryReadinessPanel({ overview }: { overview: MilitaryOverview }) {
  const game = useGameStore((state) => state.game);
  const selectedCityId = useGameStore((state) => state.selectedCityId);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const conscript = useGameStore((state) => state.conscript);
  const trainTroops = useGameStore((state) => state.trainTroops);
  const [cityId, setCityId] = useState<number>(() =>
    overview.cities.some((city) => city.cityId === selectedCityId)
      ? selectedCityId as number
      : overview.cities[0]?.cityId ?? 0,
  );
  const [draft, setDraft] = useState<ReadinessOrder | null>(null);
  const city = game?.cities[cityId] ?? null;
  const availableMen = useMemo(
    () => city ? maxConscriptable(ensureDemographics(city)) : 0,
    [city],
  );
  if (!game) return null;

  return (
    <section className="flex min-h-0 flex-1 flex-col" data-testid="command-military-readiness">
      <div className="mb-2 grid grid-cols-3 gap-2 text-[10px]">
        <Metric label="总兵力" value={overview.totalTroops.toLocaleString('zh-CN')} />
        <Metric label="总粮草" value={overview.totalFood.toLocaleString('zh-CN')} />
        <Metric label="驻军均士气" value={String(overview.averageMorale)} />
      </div>
      {overview.cities.length === 0 ? (
        <p className="border border-stone-800 px-3 py-3 text-stone-500">当前没有可整备的己方城市。</p>
      ) : (
        <>
          <label className="mb-2 block text-[10px] text-stone-500">
            整备城市
            <select
              data-testid="command-military-readiness-city"
              value={cityId}
              onChange={(event) => setCityId(Number(event.target.value))}
              className="mt-1 w-full border border-stone-700 bg-stone-950 px-2 py-1.5 text-stone-200"
            >
              {overview.cities.map((item) => (
                <option key={item.cityId} value={item.cityId}>{item.name}</option>
              ))}
            </select>
          </label>
          {city ? (
            <article className="mb-2 border border-stone-800 bg-stone-900/60 px-3 py-2 text-[10px]">
              <div className="flex justify-between"><strong className="text-stone-100">{city.name}</strong><span className="text-stone-500">可征男丁 {availableMen}</span></div>
              <p className="mt-1 text-stone-400">兵 {city.troops} · 士气 {city.troopsMorale} · 粮 {city.food} · 金 {city.gold}</p>
            </article>
          ) : null}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button type="button" data-testid="military-readiness-conscript" onClick={() => setDraft('conscript')} className="border border-red-900 bg-red-950/20 px-3 py-2 text-red-100">
              征兵
              <span className="mt-0.5 block text-[10px] text-stone-500">80金 + 120粮</span>
            </button>
            <button type="button" data-testid="military-readiness-train" onClick={() => setDraft('train')} className="border border-red-900 bg-red-950/20 px-3 py-2 text-red-100">
              训练
              <span className="mt-0.5 block text-[10px] text-stone-500">60粮 · 士气+5～10</span>
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {overview.cities.map((item) => (
              <article key={item.cityId} data-testid={`command-military-city-${item.cityId}`} className="border border-stone-800 bg-stone-900/60 px-3 py-2">
                <div className="flex items-center justify-between"><strong className="text-stone-100">{item.name}</strong><span className="text-[10px] text-stone-500">将 {item.officerCount}</span></div>
                <div className="mt-1 grid grid-cols-4 gap-1 text-[10px] text-stone-400"><span>兵 {item.troops}</span><span>气 {item.morale}</span><span>粮 {item.food}</span><span>金 {item.gold}</span></div>
              </article>
            ))}
          </div>
        </>
      )}
      <CommandConfirmDialog
        open={draft != null}
        category="军事"
        command={draft === 'conscript' ? `确认在${city?.name ?? '所选城市'}征兵` : `确认训练${city?.name ?? '所选城市'}驻军`}
        summary={draft === 'conscript' ? '兵力增量由权威随机流决定，并同步扣减成年男丁与民心。' : '训练将消耗粮食，并由权威随机流提升驻军士气。'}
        items={[
          { label: '城市', value: city?.name ?? '—' },
          { label: '当前军备', value: city ? `兵${city.troops} / 士气${city.troopsMorale}` : '—' },
          { label: '资源消耗', value: draft === 'conscript' ? '80金 / 120粮 / 成年男丁' : '60粮', tone: 'warning' },
        ]}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return !latest || !draft ? '军备草稿已失效，请返回修改。' : validateReadinessOrder(latest, cityId, draft);
        }}
        onCancel={() => setDraft(null)}
        onConfirm={async () => {
          if (draft === 'conscript') await conscript(cityId);
          if (draft === 'train') await trainTroops(cityId);
          if (!useGameStore.getState().error) setDraft(null);
        }}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-stone-800 bg-stone-900/60 px-2 py-1.5"><span className="block text-stone-500">{label}</span><strong className="text-stone-100">{value}</strong></div>;
}
