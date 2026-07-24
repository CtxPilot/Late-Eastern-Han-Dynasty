// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useState } from 'react';
import { useGameStore } from './stores/gameStore';
import { GameLayout } from './components/layout/GameLayout';
import { BattleView } from './components/battle/BattleView';
import { BattlefieldPanel } from './components/battlefield/BattlefieldPanel';
import { BattlefieldSceneView } from './components/battlefield/BattlefieldSceneView';
import { ScenarioSelect } from './components/scenario/ScenarioSelect';
import { waitForGameFonts } from './utils/fontBarrier';

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const battlefieldInstance = useGameStore((s) => s.battlefieldInstance);
  const enterNanjunBattlefield = useGameStore((s) => s.enterNanjunBattlefield);
  const game = useGameStore((s) => s.game);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const boot = useGameStore((s) => s.boot);
  // FontBarrier：字体加载前拒绝渲染 Canvas，防跨平台乱码/豆腐块
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);
  const [fontRetryNonce, setFontRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFontError(null);
    (async () => {
      const fontsLoaded = await waitForGameFonts();
      if (cancelled) return;
      if (fontsLoaded) {
        setIsEngineReady(true);
        void boot();
      } else {
        setFontError('工程字体资产加载失败。请按 client/public/fonts/README.md 放入 woff2 文件后点击重试。');
      }
    })();
    return () => { cancelled = true; };
  }, [boot, fontRetryNonce]);

  if (!isEngineReady) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-3 bg-stone-950">
        <h1 className="text-2xl text-amber-400 font-semibold">晚东汉末 · 可玩演示</h1>
        <p className="text-stone-400 text-sm">
          {fontError ?? '正在加载工程字体…（跨平台字体防御屏障）'}
        </p>
        {fontError && (
          <>
            <pre className="text-stone-500 text-xs max-w-2xl px-4 text-center whitespace-pre-wrap">
              {fontError}
            </pre>
            <button
              type="button"
              className="px-4 py-2 rounded bg-amber-900 border border-amber-600 text-amber-200"
              onClick={() => setFontRetryNonce((n) => n + 1)}
            >
              重试加载字体
            </button>
          </>
        )}
      </div>
    );
  }

  if (screen === 'boot') {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-3 bg-stone-950">
        <h1 className="text-2xl text-amber-400 font-semibold">晚东汉末 · 可玩演示</h1>
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

  if (screen === 'scenario') return <ScenarioSelect />;

  if (!game) {
    return <div className="h-full flex items-center justify-center bg-stone-950 text-red-300">游戏状态缺失，请重新选择剧本。</div>;
  }

  if (screen === 'battle') {
    return (
      <div className="h-full flex flex-col">
        <BattleView />
      </div>
    );
  }

  if (screen === 'battlefield' && battlefieldInstance) {
    return (
      <div className="h-full flex flex-col">
        <BattlefieldSceneView />
      </div>
    );
  }

  if (screen === 'battlefield' || screen === 'melee') {
    return (
      <div className="h-full flex flex-col">
        <BattlefieldPanel />
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <GameLayout />
      <button
        data-testid="btn-enter-nanjun-battlefield"
        className="fixed top-14 right-2 z-50 px-3 py-1.5 rounded bg-amber-900 border border-amber-600 text-xs text-amber-50 hover:bg-amber-800"
        onClick={() => void enterNanjunBattlefield()}
      >
        进入南郡战场（BF-P1）
      </button>
    </div>
  );
}
