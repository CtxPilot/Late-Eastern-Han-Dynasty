// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from '././components/ui/buttons'; // 批次② 三级按钮基座
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
  const openScenarioSelect = useGameStore((s) => s.openScenarioSelect);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);
  const [fontRetryNonce, setFontRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFontError(null);
    void (async () => {
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

  if (!isEngineReady) return (
    <div className="h-full flex items-center justify-center flex-col gap-3 bg-stone-950">
      <h1 className="text-2xl text-amber-400 font-semibold">晚东汉末 · 可玩演示</h1>
      <p className="text-stone-400 text-sm">{fontError ?? '正在加载工程字体…（跨平台字体防御屏障）'}</p>
      {fontError && <>
        <pre className="text-stone-500 text-xs max-w-2xl px-4 text-center whitespace-pre-wrap">{fontError}</pre>
        <InkButton type="button" className="px-4 py-2 rounded bg-amber-900 border border-amber-600 text-amber-200" onClick={() => setFontRetryNonce((n) => n + 1)}>重试加载字体</InkButton>
      </>}
    </div>
  );

  if (screen === 'boot') return (
    <div className="h-full flex items-center justify-center flex-col gap-3 bg-stone-950">
      <h1 className="text-2xl text-amber-400 font-semibold">晚东汉末 · 可玩演示</h1>
      <p className="text-stone-400 text-sm">{loading ? '正在创建游戏…' : error ?? '启动中'}</p>
      {error && <>
        <p className="text-stone-500 text-xs max-w-xl px-4 text-center">
          {`引擎未能启动：可点击重试。离线可玩版无需服务端；联机模式请在本地启动开发服务后刷新。`}
        </p>
        <InkButton type="button" className="px-4 py-2 rounded bg-amber-900 border border-amber-600" onClick={() => void boot()}>重试</InkButton>
      </>}
    </div>
  );
  if (screen === 'scenario') return <ScenarioSelect />;
  if (!game) return <div className="h-full flex items-center justify-center bg-stone-950 text-red-300">游戏状态缺失，请重新选择剧本。</div>;
  if (screen === 'battle') return <div className="h-full flex flex-col"><BattleView /></div>;
  if (screen === 'battlefield' && battlefieldInstance) return <div className="h-full flex flex-col"><BattlefieldSceneView /></div>;
  if (screen === 'battlefield' || screen === 'melee') return <div className="h-full flex flex-col"><BattlefieldPanel /></div>;

  // 覆亡判定（P0-1 · Session 407）：玩家势力灭亡即大势已去，进入终局屏。
  const playerFaction = game.factions[game.playerFactionId];
  if (playerFaction && playerFaction.isAlive === false) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-4 bg-stone-950" data-testid="defeat-screen">
        <h1 className="text-4xl text-seal-400 tracking-[0.3em] font-seal">大势已去</h1>
        <p className="text-stone-400 text-sm">
          {`${playerFaction.name}覆亡于乱世。江山代有才人出，可另择势力重整旗鼓。`}
        </p>
        <InkButton
          type="button"
          data-testid="btn-defeat-restart"
          className="px-4 py-2 rounded bg-amber-900 border border-amber-600 text-amber-100"
          onClick={() => openScenarioSelect()}
        >
          更换剧本
        </InkButton>
      </div>
    );
  }

  // 郡域战场快捷入口（批次① · Session 407）：构建守卫隐藏，仅 dev 或 ?debug=1 显示。
  const showDebugBattlefield =
    import.meta.env.DEV || new URLSearchParams(window.location.search).has('debug');

  return <div className="h-full relative">
    <GameLayout />
    {showDebugBattlefield && (
      <div className="fixed top-14 right-2 z-50 flex gap-2">
        <InkButton data-testid="btn-enter-nanjun-battlefield" className="px-3 py-1.5 rounded bg-amber-900 border border-amber-600 text-xs text-amber-50 hover:bg-amber-800" onClick={() => void enterNanjunBattlefield('nanjun')}>南郡水网</InkButton>
        <InkButton data-testid="btn-enter-yingchuan-battlefield" className="px-3 py-1.5 rounded bg-stone-800 border border-amber-500 text-xs text-amber-50 hover:bg-stone-700" onClick={() => void enterNanjunBattlefield('yingchuan')}>颍川平原</InkButton>
      </div>
    )}
  </div>;
}
