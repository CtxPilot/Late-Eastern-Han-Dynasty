// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { Season } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

const SEASON_LABEL: Record<number, string> = {
  [Season.SPRING]: '春',
  [Season.SUMMER]: '夏',
  [Season.AUTUMN]: '秋',
  [Season.WINTER]: '冬',
};

export function TopBar() {
  const game = useGameStore((s) => s.game);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const endTurn = useGameStore((s) => s.endTurn);
  const screen = useGameStore((s) => s.screen);
  const openScenarioSelect = useGameStore((s) => s.openScenarioSelect);

  if (!game) return null;

  const hasPendingEvent = (game.pendingEvents?.length ?? 0) > 0;
  const faction = game.factions[game.playerFactionId];
  // 金/粮/兵：从己方城池汇总（城池为资源真源）
  let gold = 0;
  let food = 0;
  let troops = 0;
  let cityCount = 0;
  for (const c of Object.values(game.cities)) {
    if (c.ruler === game.playerFactionId) {
      cityCount += 1;
      troops += c.troops;
      gold += c.gold;
      food += c.food;
    }
  }

  const season = SEASON_LABEL[game.season] ?? '';

  return (
    <header
      className="flex items-center gap-3 px-4 py-2 border-b border-amber-900/40 bg-gradient-to-b from-stone-900 to-stone-950 shrink-0 text-sm"
      data-testid="top-bar"
    >
      <h1 className="text-amber-400 font-semibold tracking-wide shrink-0">晚东汉末 · Demo</h1>
      <span className="text-stone-500">|</span>
      <span className="text-emerald-300/90 font-medium">{faction?.name ?? '—'}</span>
      <span className="text-stone-300">
        {game.currentYear}年 {season}
        {game.currentMonth}月
      </span>
      <span className="text-stone-500">|</span>
      <span className="text-amber-200/90" title="金">
        金 {gold.toLocaleString()}
      </span>
      <span className="text-lime-200/80" title="粮">
        粮 {food.toLocaleString()}
      </span>
      <span className="text-sky-200/80" title="兵力">
        兵 {troops.toLocaleString()}
      </span>
      <span className="text-rose-200/80" title="美女资源（势力库存）">
        美女 {faction?.beautyStock ?? 0}
      </span>
      <span className="text-stone-500" title="城池数">
        城 {cityCount}
      </span>
      <span className="flex-1" />
      {error && <span className="text-red-400 text-xs mr-2">{error}</span>}
      <button
        type="button"
        className="px-2 py-1 rounded border border-stone-700 text-stone-300 hover:border-amber-700"
        onClick={openScenarioSelect}
      >
        更换剧本
      </button>
      {screen === 'world' && (
        <button
          type="button"
          data-testid="btn-end-turn"
          className="px-3 py-1.5 rounded bg-amber-900 border border-amber-600 text-amber-100 text-sm hover:bg-amber-800 disabled:opacity-50"
          disabled={loading || hasPendingEvent}
          title={hasPendingEvent ? '请先处理待决事件' : undefined}
          onClick={() => void endTurn()}
        >
          {hasPendingEvent ? '待决事件…' : '结束回合'}
        </button>
      )}
    </header>
  );
}
