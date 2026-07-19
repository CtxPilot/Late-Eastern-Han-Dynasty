// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useState } from 'react';
import type { EventSourceClass } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

const LEGEND_LAYERS = new Set<EventSourceClass>(['literature', 'legend']);

export function ScenarioSelect() {
  const scenarios = useGameStore((state) => state.scenariosCatalog);
  const startGame = useGameStore((state) => state.startGame);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? 0);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const [factionId, setFactionId] = useState(scenario?.recommendedFaction ?? scenario?.playableFactions[0] ?? 0);
  const [legendsEnabled, setLegendsEnabled] = useState(true);

  useEffect(() => {
    if (!scenario) return;
    setFactionId(scenario.recommendedFaction ?? scenario.playableFactions[0] ?? 0);
    setLegendsEnabled(scenario.defaultEventLayers.some((layer) => LEGEND_LAYERS.has(layer)));
  }, [scenario]);

  if (!scenario) {
    return <div className="h-full flex items-center justify-center bg-stone-950 text-red-300">没有可用剧本</div>;
  }

  const baseLayers = scenario.defaultEventLayers.filter((layer) => !LEGEND_LAYERS.has(layer));
  const eventLayers = legendsEnabled
    ? [...new Set([...baseLayers, ...scenario.availableEventLayers.filter((layer) => LEGEND_LAYERS.has(layer))])]
    : baseLayers;

  return (
    <main className="min-h-full bg-stone-950 text-stone-200 px-5 py-8 overflow-auto">
      <div className="mx-auto max-w-5xl">
        <header className="mb-7 border-b border-amber-900/50 pb-5">
          <p className="text-xs tracking-[0.3em] text-amber-600">汉末纪事 · 开卷</p>
          <h1 className="mt-2 text-3xl text-amber-300">选择剧本与行军旗号</h1>
          <p className="mt-2 text-sm text-stone-500">历史、裴注异闻、文学演义分层标注；重大事件由条件而非年份单独决定。</p>
        </header>

        <section className="grid gap-3 md:grid-cols-2">
          {scenarios.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`border p-4 text-left transition ${item.id === scenario.id ? 'border-amber-500 bg-amber-950/30' : 'border-stone-800 bg-stone-900/50 hover:border-stone-600'}`}
              onClick={() => setScenarioId(item.id)}
            >
              <span className="text-xs text-stone-500">{item.startYear}年{item.startMonth}月 · {item.type === 'historical' ? '历史' : '假想'}</span>
              <h2 className="mt-1 text-lg text-amber-200">{item.name}</h2>
              <p className="mt-2 text-xs leading-5 text-stone-400">{item.description}</p>
            </button>
          ))}
        </section>

        <section className="mt-6 border border-stone-800 bg-stone-900/60 p-5">
          <h2 className="text-lg text-amber-200">{scenario.name}</h2>
          {scenario.scopeNote && <p className="mt-2 border-l-2 border-amber-800 pl-3 text-xs leading-5 text-stone-400">{scenario.scopeNote}</p>}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {scenario.factionSetups.filter((faction) => scenario.playableFactions.includes(faction.id)).map((faction) => (
              <button
                key={faction.id}
                type="button"
                className={`border px-3 py-3 text-left ${faction.id === factionId ? 'border-amber-500 bg-stone-800' : 'border-stone-700 hover:border-stone-500'}`}
                onClick={() => setFactionId(faction.id)}
              >
                <strong style={{ color: faction.color }}>{faction.name}</strong>
                <span className="mt-1 block text-xs text-stone-500">{faction.headquartersLabel}</span>
                {faction.historicalNote && <span className="mt-2 block text-[11px] leading-4 text-stone-400">{faction.historicalNote}</span>}
              </button>
            ))}
          </div>

          {scenario.availableEventLayers.some((layer) => LEGEND_LAYERS.has(layer)) && (
            <label className="mt-5 flex items-start gap-3 border-t border-stone-800 pt-4 text-sm">
              <input type="checkbox" checked={legendsEnabled} onChange={(event) => setLegendsEnabled(event.target.checked)} />
              <span>
                启用演义与民间传奇
                <small className="mt-1 block text-stone-500">本剧本{scenario.defaultEventLayers.some((layer) => LEGEND_LAYERS.has(layer)) ? '默认开启' : '默认关闭'}；事件界面会明确标注文学来源。</small>
              </span>
            </label>
          )}

          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <button
            type="button"
            disabled={loading || factionId === 0}
            className="mt-5 w-full border border-amber-600 bg-amber-900/70 px-4 py-3 text-amber-100 hover:bg-amber-800 disabled:opacity-50"
            onClick={() => void startGame(scenario.id, factionId, eventLayers)}
          >
            {loading ? '正在展卷…' : '进入剧本'}
          </button>
        </section>
      </div>
    </main>
  );
}
