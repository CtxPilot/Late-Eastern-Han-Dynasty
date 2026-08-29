// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo } from 'react';
import { useGameStore } from '../../stores/gameStore';

/**
 * 霸业面板（P0-1 · Session 407，`docs/40-game-evaluation.md`）：
 * 战役目标 0-A 版的只读派生视图——占城进度 / 天命人心 / 政治阶段 / 天下势力排行。
 * 全部字段由 GameState 客户端派生，零存档字段、零 API、零 RNG 变化。
 */

const STAGE_LABEL: Record<string, string> = {
  vassal: '诸侯',
  hegemon: '霸府',
  king: '王',
  emperor: '帝',
};

const STAGE_NEXT: Record<string, string> = {
  vassal: '下一阶：开霸府（朝廷抽屉）',
  hegemon: '下一阶：称王（朝廷抽屉 · 王命）',
  king: '下一阶：称帝',
  emperor: '已至帝业',
};

export function HegemonyPanel() {
  const game = useGameStore((s) => s.game);

  const model = useMemo(() => {
    if (!game) return null;
    const player = game.factions[game.playerFactionId];
    if (!player) return null;
    const allCities = Object.values(game.cities);
    const total = allCities.length;
    const owned = player.cityIds.length;
    const ranking = Object.values(game.factions)
      .filter((f) => f.isAlive)
      .map((f) => ({ id: f.id, name: f.name, color: f.color, cities: f.cityIds.length }))
      .sort((a, b) => b.cities - a.cities)
      .slice(0, 5);
    const stage = player.politicalStage ?? 'vassal';
    return {
      player,
      total,
      owned,
      mandate: player.mandate ?? 0,
      popularWill: player.popularWill ?? 0,
      fame: player.fame ?? 0,
      stage,
      stageLabel: STAGE_LABEL[stage] ?? '诸侯',
      stageNext: STAGE_NEXT[stage] ?? '',
      stageAgeMonths: player.politicalStageAgeMonths ?? 0,
      title: player.politicalTitle,
      kingdomName: player.kingdomName,
      ranking,
      aliveCount: Object.values(game.factions).filter((f) => f.isAlive).length,
    };
  }, [game]);

  if (!game || !model) return null;

  return (
    <div className="px-3 py-2 space-y-2 text-xs" data-testid="hegemony-panel">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-stone-400">霸业 · 占城</span>
          <span className="text-amber-300">
            {model.owned}/{model.total}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-sm overflow-hidden bg-stone-800">
          <div
            className="h-full bg-gradient-to-r from-amber-700 to-amber-400"
            style={{ width: `${model.total > 0 ? Math.round((model.owned / model.total) * 100) : 0}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="text-stone-500">
          天命 <span className="text-stone-300">{model.mandate}</span>/100
        </span>
        <span className="text-stone-500">
          人心 <span className="text-stone-300">{model.popularWill}</span>/100
        </span>
        <span className="text-stone-500">
          声望 <span className="text-stone-300">{model.fame}</span>
        </span>
        <span className="text-stone-500">
          存势力 <span className="text-stone-300">{model.aliveCount}</span>
        </span>
      </div>

      <div className="border border-stone-800 bg-stone-900/60 px-2 py-1.5">
        <span className="text-amber-300 font-semibold">
          {model.title ?? model.stageLabel}
          {model.kingdomName ? `（${model.kingdomName}）` : ''}
        </span>
        <span className="ml-1 text-stone-500">
          · 已维持 {model.stageAgeMonths} 月
        </span>
        <p className="mt-0.5 text-stone-500">{model.stageNext}</p>
      </div>

      <div>
        <p className="text-stone-500 mb-1">天下大势（存势力城池排行）</p>
        <ul className="space-y-1">
          {model.ranking.map((f) => (
            <li key={f.id} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: f.color }}
                aria-hidden
              />
              <span className={`min-w-0 flex-1 truncate ${f.id === game.playerFactionId ? 'text-amber-300' : 'text-stone-300'}`}>
                {f.name}
                {f.id === game.playerFactionId ? '（我）' : ''}
              </span>
              <span className="text-stone-500">{f.cities} 城</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
