// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import type { City, GameState } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

export type CivilCitySummary = {
  cityId: number;
  name: string;
  administration: string;
  province: string;
  gold: number;
  food: number;
  population: number;
  farm: number;
  commerce: number;
  wall: number;
  morale: number;
  adultMale: number;
  adultFemale: number;
  child: number;
  elder: number;
};

export function selectCivilCities(game: GameState): CivilCitySummary[] {
  return Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId)
    .sort((a, b) => a.id - b.id)
    .map(toSummary);
}

function toSummary(city: City): CivilCitySummary {
  return {
    cityId: city.id,
    name: city.name,
    administration: city.adminName ?? city.name,
    province: city.province,
    gold: city.gold,
    food: city.food,
    population: city.population,
    farm: city.stats.farm,
    commerce: city.stats.commerce,
    wall: city.stats.wall,
    morale: city.stats.morale,
    adultMale: city.demographics.adultMale,
    adultFemale: city.demographics.adultFemale,
    child: city.demographics.child,
    elder: city.demographics.elder,
  };
}

type CivilFacet = 'overview' | 'industry' | 'construction' | 'relief';
export type CivilOrder = 'farm' | 'commerce' | 'wall' | 'relief';

const ORDER_CONFIG: Record<CivilOrder, {
  label: string;
  cost: string;
  summary: string;
}> = {
  farm: { label: '开发农业', cost: '100金', summary: '农业开发度由权威随机流提升20～30。' },
  commerce: { label: '开发商业', cost: '100金', summary: '商业开发度由权威随机流提升18～28。' },
  wall: { label: '开发城防', cost: '120金', summary: '城防开发度由权威随机流提升15～25；不等同于耐久修缮。' },
  relief: { label: '施米安民', cost: '150粮', summary: '民心由权威随机流提升8～12，上限100。' },
};

export function validateCivilOrder(
  game: GameState,
  cityId: number,
  order: CivilOrder,
): string | null {
  const city = game.cities[cityId];
  if (!city || city.ruler !== game.playerFactionId) return '所选城市已不存在或归属已经变化。';
  if (order === 'relief') {
    return city.food < 150 ? `城市粮不足（需150，当前${city.food}）。` : null;
  }
  const goldCost = order === 'wall' ? 120 : 100;
  return city.gold < goldCost ? `城市金不足（需${goldCost}，当前${city.gold}）。` : null;
}

export function validateBeautySeek(game: GameState, cityId: number): string | null {
  const city = game.cities[cityId];
  if (!city || city.ruler !== game.playerFactionId) return '所选城市已不存在或归属已经变化。';
  if ((city.beautySeekLeft ?? 0) < 1) return `${city.name}可寻次数已尽。`;
  return city.gold < 60 ? `城市金不足（需60，当前${city.gold}）。` : null;
}

const FACETS: readonly { id: CivilFacet; label: string }[] = [
  { id: 'overview', label: '总览' },
  { id: 'industry', label: '产业' },
  { id: 'construction', label: '城建' },
  { id: 'relief', label: '赈济' },
];

export function CivilOverviewDrawer() {
  const game = useGameStore((state) => state.game);
  const selectedCityId = useGameStore((state) => state.selectedCityId);
  const selectCity = useGameStore((state) => state.selectCity);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const develop = useGameStore((state) => state.develop);
  const relief = useGameStore((state) => state.relief);
  const seekBeauty = useGameStore((state) => state.seekBeauty);
  const [facet, setFacet] = useState<CivilFacet>('overview');
  const [draft, setDraft] = useState<CivilOrder | null>(null);
  const [seekDraft, setSeekDraft] = useState(false);
  const cities = useMemo(() => game ? selectCivilCities(game) : [], [game]);
  const effectiveCityId = cities.some((city) => city.cityId === selectedCityId)
    ? selectedCityId
    : cities[0]?.cityId;
  const city = cities.find((candidate) => candidate.cityId === effectiveCityId);

  if (!game) return <p data-testid="command-civil-empty">尚未载入剧本。</p>;
  if (!city) return <p data-testid="command-civil-empty">当前势力没有可治理城市。</p>;

  return (
    <div
      className="flex h-[min(34rem,calc(100vh-12rem))] min-h-0 flex-1 flex-col"
      data-testid="command-civil-drawer"
    >
      <label className="mb-3 text-[10px] text-stone-500">
        治理城市
        <select
          data-testid="command-civil-city-select"
          value={city.cityId}
          onChange={(event) => selectCity(Number(event.target.value))}
          className="mt-1 block w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-xs text-stone-200"
        >
          {cities.map((option) => (
            <option key={option.cityId} value={option.cityId}>
              {option.name} · {option.province}
            </option>
          ))}
        </select>
      </label>

      <nav className="mb-3 grid grid-cols-4 gap-1" aria-label="内政分面">
        {FACETS.map((item) => (
          <button
            key={item.id}
            type="button"
            data-testid={`command-civil-facet-${item.id}`}
            aria-current={facet === item.id ? 'page' : undefined}
            onClick={() => setFacet(item.id)}
            className={`border py-1.5 ${
              facet === item.id
                ? 'border-amber-700 bg-amber-950/35 text-amber-100'
                : 'border-stone-800 text-stone-400'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <p className="mb-3 text-[10px] leading-relaxed text-stone-500">
        S03 城市治理在此统一提交；总览另提供明确标注的 S09 跨系统寻访入口。
      </p>

      <section className="min-h-0 space-y-2 overflow-y-auto" data-testid={`command-civil-panel-${facet}`}>
        {facet === 'overview' ? (
          <>
            <Fact label="治所" value={city.administration} />
            <Fact label="州域" value={city.province} />
            <Fact label="金" value={city.gold} />
            <Fact label="粮" value={city.food} />
            <Fact label="人口" value={city.population} />
            <Fact label="民心" value={city.morale} />
            <div
              className="mt-3 border border-rose-950/80 bg-rose-950/10 px-3 py-2"
              data-testid="command-civil-s09-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-rose-200">S09 · 宫廷人脉</strong>
                  <p className="mt-1 text-[10px] leading-relaxed text-stone-500">
                    跨系统寻访：消耗60金；成功时势力美女库存+1、此城可寻次数−1。
                  </p>
                  <p className="mt-1 text-[10px] text-stone-400">
                    当前库存 {game.factions[game.playerFactionId]?.beautyStock ?? 0}
                    {' · '}本城可寻 {game.cities[city.cityId]?.beautySeekLeft ?? 0}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="command-civil-seek-beauty"
                  data-command-write="true"
                  onClick={() => setSeekDraft(true)}
                  className="shrink-0 border border-rose-900 bg-rose-950/30 px-3 py-2 text-rose-100"
                >
                  寻访
                  <span className="mt-0.5 block text-[10px] text-stone-500">60金</span>
                </button>
              </div>
            </div>
          </>
        ) : facet === 'industry' ? (
          <>
            <Fact label="农业开发" value={city.farm} testId="command-civil-value-farm" />
            <Fact label="商业开发" value={city.commerce} testId="command-civil-value-commerce" />
            <div className="grid grid-cols-2 gap-2">
              <CivilButton order="farm" onClick={() => setDraft('farm')} />
              <CivilButton order="commerce" onClick={() => setDraft('commerce')} />
            </div>
            <p className="border border-stone-800 px-3 py-2 text-stone-600">
              手工业、交通与卫生尚未实装；农业开发不等同于屯田。
            </p>
          </>
        ) : facet === 'construction' ? (
          <>
            <Fact label="城防开发" value={city.wall} testId="command-civil-value-wall" />
            <CivilButton order="wall" onClick={() => setDraft('wall')} />
            <p className="border border-stone-800 px-3 py-2 text-stone-600">
              当前数值是城市城防开发度，不代表战役城墙耐久；修缮与设施建设尚未实装。
            </p>
          </>
        ) : (
          <>
            <Fact label="民心" value={city.morale} testId="command-civil-value-morale" />
            <Fact label="成年男丁" value={city.adultMale} />
            <Fact label="成年女子" value={city.adultFemale} />
            <Fact label="孩童" value={city.child} />
            <Fact label="老者" value={city.elder} />
            <CivilButton order="relief" onClick={() => setDraft('relief')} />
            <p className="border border-stone-800 px-3 py-2 text-stone-600">
              施米只影响民心；人口四桶保持不变。
            </p>
          </>
        )}
      </section>
      <CommandConfirmDialog
        open={draft != null}
        category="内政"
        command={`确认在${city.name}${draft ? ORDER_CONFIG[draft].label : '执行命令'}`}
        summary={draft ? ORDER_CONFIG[draft].summary : ''}
        items={[
          { label: '城市', value: `${city.name} · ${city.province}` },
          { label: '当前资源', value: `${city.gold}金 / ${city.food}粮` },
          { label: '资源消耗', value: draft ? ORDER_CONFIG[draft].cost : '—', tone: 'warning' },
        ]}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return !latest || !draft
            ? '内政草稿已失效，请返回修改。'
            : validateCivilOrder(latest, city.cityId, draft);
        }}
        onCancel={() => setDraft(null)}
        onConfirm={async () => {
          if (!draft) return;
          if (draft === 'relief') await relief(city.cityId);
          else await develop(draft, city.cityId);
          if (!useGameStore.getState().error) setDraft(null);
        }}
      />
      <CommandConfirmDialog
        open={seekDraft}
        category="S09 宫廷人脉"
        command={`确认在${city.name}寻访`}
        summary="由 S09 权威随机流判定；无论成败均消耗60金，成功时库存+1、可寻次数−1。"
        items={[
          { label: '城市', value: `${city.name} · ${city.province}` },
          {
            label: '当前状态',
            value: `${city.gold}金 / 可寻${game.cities[city.cityId]?.beautySeekLeft ?? 0} / 库存${game.factions[game.playerFactionId]?.beautyStock ?? 0}`,
          },
          { label: '资源消耗', value: '60金', tone: 'warning' },
        ]}
        loading={loading}
        error={error}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          return !latest ? '寻访草稿已失效，请返回修改。' : validateBeautySeek(latest, city.cityId);
        }}
        onCancel={() => setSeekDraft(false)}
        onConfirm={async () => {
          await seekBeauty(city.cityId);
          if (!useGameStore.getState().error) setSeekDraft(false);
        }}
      />
    </div>
  );
}

function CivilButton({ order, onClick }: { order: CivilOrder; onClick: () => void }) {
  const config = ORDER_CONFIG[order];
  return (
    <button
      type="button"
      data-testid={`command-civil-${order}`}
      data-command-write="true"
      onClick={onClick}
      className="border border-amber-900 bg-amber-950/20 px-3 py-2 text-amber-100"
    >
      {config.label}
      <span className="mt-0.5 block text-[10px] text-stone-500">{config.cost}</span>
    </button>
  );
}

function Fact({ label, value, testId }: { label: string; value: string | number; testId?: string }) {
  return (
    <div className="flex justify-between border-b border-stone-800 px-2 py-1.5">
      <span className="text-stone-500">{label}</span>
      <strong className="text-stone-200" data-testid={testId}>{value}</strong>
    </div>
  );
}
