// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useState } from 'react';
import type { EventSourceClass } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { InkButton, SealButton } from '../ui/buttons';
import { SealBadge } from '../ui/SealBadge';

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
    <main className="min-h-full bg-stone-950 text-stone-200 px-5 py-8 overflow-auto tex-paper select-none">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* 顶部开卷题匾 */}
        <header className="border-b border-amber-900/60 pb-5 bg-gradient-to-b from-stone-900/80 to-transparent p-4 rounded-t border-t border-amber-950/40">
          <div className="flex items-center justify-between">
            <p className="text-xs tracking-[0.35em] text-amber-600/90 font-song">汉末纪事 · 展卷开篇</p>
            <span className="text-xs text-stone-500 font-song">岁在汉祚 · 天下鼎沸</span>
          </div>

          <div className="mt-3 flex items-center justify-between flex-wrap gap-4">
            <h1 className="flex items-center gap-3 text-3xl md:text-4xl text-amber-300 font-seal tracking-[0.2em]">
              晚东汉末
              <span
                className="grid place-items-center align-middle shadow-[0_0_12px_rgba(166,25,25,0.4)]"
                style={{
                  width: 42,
                  height: 42,
                  border: '2px double #d7aa62',
                  borderRadius: 3,
                  background: '#A61919',
                  color: '#FDE68A',
                  fontFamily: "'HanDynastySeal', serif",
                  fontSize: 22,
                  lineHeight: 1,
                }}
                aria-hidden
              >
                漢
              </span>
            </h1>
            <p className="text-xs text-stone-400 font-song max-w-md leading-relaxed text-right hidden sm:block">
              正史、裴注异闻与文学演义分层考据；重大历史事件由时势条件驱动。
            </p>
          </div>

          <p className="mt-2 text-xs text-stone-400 font-song">
            择一剧本以观山河兴替，挑一旗号以立不世功业。
          </p>

          <p
            className="mt-3 border-l-2 border-amber-800/80 bg-stone-900/70 pl-3 py-1 text-xs leading-5 text-stone-400"
            data-testid="scenario-content-notice"
          >
            内容提示：游戏包含战争、死亡、俘虏、疾病、间谍与历史婚姻记载。时代称谓仅在有来源的叙事中保留并标注语境，系统分类采用现代中性表述；玩家婚配仅允许双方均满18岁。
          </p>
        </header>

        {/* 剧本选择网格 */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-l-2 border-seal-600 pl-2">
            <h2 className="text-sm font-bold text-amber-300 tracking-wider font-song">编年史策 · 选定剧本</h2>
            <span className="text-xs text-stone-500">（共 {scenarios.length} 卷史册）</span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {scenarios.map((item) => {
              const isSelected = item.id === scenario.id;
              return (
                <InkButton
                  key={item.id}
                  type="button"
                  className={`p-4 text-left transition-all border ${
                    isSelected
                      ? 'border-amber-500 bg-amber-950/40 ring-1 ring-amber-600/50 shadow-[0_4px_16px_rgba(180,83,9,0.2)]'
                      : 'border-stone-800 bg-stone-900/60 hover:border-amber-800/70 hover:bg-stone-900/90'
                  }`}
                  onClick={() => setScenarioId(item.id)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs text-amber-600/90 font-medium">
                      {item.startYear}年{item.startMonth}月 · {item.type === 'historical' ? '正史纪年' : '假想推演'}
                    </span>
                    {isSelected && (
                      <span className="text-xs px-1.5 py-0.2 rounded border border-amber-600 text-amber-300 bg-amber-950/80 font-seal">
                        已选定
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg text-amber-200 font-semibold tracking-wide font-song">{item.name}</h3>
                  <p className="mt-2 text-xs leading-5 text-stone-400 font-song line-clamp-3">{item.description}</p>
                </InkButton>
              );
            })}
          </div>
        </section>

        {/* 选定剧本的阵营与配置 */}
        <section className="border border-stone-800 bg-stone-900/80 p-5 rounded shadow-xl backdrop-blur-sm space-y-4">
          <div className="border-b border-stone-800 pb-3 flex items-start justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <SealBadge char="卷" color="gold" size={16} />
                <h2 className="text-lg text-amber-200 font-semibold tracking-wide font-song">{scenario.name}</h2>
              </div>
              {scenario.scopeNote && (
                <p className="mt-2 border-l-2 border-amber-800 pl-3 text-xs leading-5 text-stone-400 font-song">
                  {scenario.scopeNote}
                </p>
              )}
            </div>
          </div>

          {/* 势力选择网格 */}
          <div className="space-y-2">
            <p className="text-xs text-stone-400 font-song tracking-wide">行军旗号 · 请选定执掌之势力：</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {scenario.factionSetups
                .filter((faction) => scenario.playableFactions.includes(faction.id))
                .map((faction) => {
                  const isFactionSelected = faction.id === factionId;
                  return (
                    <InkButton
                      key={faction.id}
                      type="button"
                      className={`border p-3 text-left transition-all relative overflow-hidden ${
                        isFactionSelected
                          ? 'border-amber-500 bg-stone-850 ring-1 ring-amber-500/60 shadow-[0_2px_12px_rgba(0,0,0,0.5)]'
                          : 'border-stone-800 bg-stone-900/70 hover:border-stone-600 hover:bg-stone-900'
                      }`}
                      style={isFactionSelected ? { borderLeftColor: faction.color, borderLeftWidth: 4 } : { borderLeftColor: faction.color, borderLeftWidth: 3 }}
                      onClick={() => setFactionId(faction.id)}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <strong className="text-sm font-song tracking-wide" style={{ color: faction.color }}>
                          {faction.name}
                        </strong>
                        {isFactionSelected && (
                          <span className="text-[11px] px-1 rounded bg-seal-900 text-gold-200 border border-seal-600 font-song">
                            统领
                          </span>
                        )}
                      </div>
                      <span className="mt-1 block text-xs text-stone-400 font-song">
                        治所：{faction.headquartersLabel}
                      </span>
                      {faction.historicalNote && (
                        <span className="mt-2 block text-xs leading-4 text-stone-500 font-song line-clamp-2">
                          {faction.historicalNote}
                        </span>
                      )}
                    </InkButton>
                  );
                })}
            </div>
          </div>

          {/* 选项与进入操作 */}
          {scenario.availableEventLayers.some((layer) => LEGEND_LAYERS.has(layer)) && (
            <label className="flex items-start gap-3 border-t border-stone-800 pt-4 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={legendsEnabled}
                className="mt-0.5 accent-amber-600 rounded"
                onChange={(event) => setLegendsEnabled(event.target.checked)}
              />
              <span className="text-stone-300 text-xs leading-relaxed font-song">
                启用演义与民间传奇事件层
                <small className="mt-0.5 block text-stone-500">
                  本剧本{scenario.defaultEventLayers.some((layer) => LEGEND_LAYERS.has(layer)) ? '默认开启' : '默认关闭'}；各事件弹窗将清晰标注文学与传说出处。
                </small>
              </span>
            </label>
          )}

          {error && <p className="mt-3 text-sm text-red-400 bg-red-950/40 border border-red-900 px-3 py-1.5 rounded">{error}</p>}

          <div className="pt-2">
            <SealButton
              type="button"
              disabled={loading || factionId === 0}
              reason={factionId === 0 ? '请先选定一个势力旗号' : undefined}
              className="w-full py-3.5 text-base tracking-[0.2em] font-seal shadow-2xl"
              onClick={() => void startGame(scenario.id, factionId, eventLayers)}
            >
              {loading ? '正在展卷…' : '进入剧本'}
            </SealButton>
          </div>
        </section>
      </div>
    </main>
  );
}
