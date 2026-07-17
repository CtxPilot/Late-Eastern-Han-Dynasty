// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect } from 'react';
import { useGameStore } from './stores/gameStore';
import { GameLayout } from './components/layout/GameLayout';
import { BattleView } from './components/battle/BattleView';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const game = useGameStore((s) => s.game);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const boot = useGameStore((s) => s.boot);

  useEffect(() => {
    void boot();
  }, [boot]);

  if (screen === 'boot' || !game) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-3 bg-stone-950">
        <h1 className="text-2xl text-amber-400 font-semibold">LateEasternHanDynasty · 可玩 Demo</h1>
        <p className="text-stone-400 text-sm">{loading ? '正在创建游戏…' : error ?? '启动中'}</p>
        {error && (
          <button
            type="button"
            className="px-4 py-2 rounded bg-amber-900 border border-amber-600"
            onClick={() => void boot()}
          >
            重试
          </button>
        )}
      </div>
    );
  }

  if (screen === 'battle') {
    return (
      <div className="h-full flex flex-col">
        <BattleView />
      </div>
    );
  }

  return <GameLayout />;
}
