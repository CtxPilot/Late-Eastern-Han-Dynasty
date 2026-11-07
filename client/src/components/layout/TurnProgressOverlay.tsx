// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useGameStore } from '../../stores/gameStore';
import { useBroadcast, type BroadcastState } from '../../hooks/useBroadcast';
import { SealBadge } from '../ui/SealBadge';
import type { GameState } from '@leh/shared';

/**
 * S20-W1: TurnProgressOverlay 回合推演全屏遮罩
 *
 * 规格：
 * - docs/07-ui-design.md §11.1.1 规范；
 * - 结合 useBroadcast WS 信道与 useGameStore.monthSettling 双通道触发；
 * - 展现当前推演年月、动态 phase 文言标签、实时百分比进度条与信道指示；
 * - 金石宣纸典雅水墨装帧，支持离线/Worker 纯本地自适应平滑推进。
 */

export interface TurnProgressOverlayProps {
  monthSettling?: boolean;
  game?: GameState | null;
  broadcast?: Partial<BroadcastState>;
}

export function TurnProgressOverlay({
  monthSettling: propMonthSettling,
  game: propGame,
  broadcast: propBroadcast,
}: TurnProgressOverlayProps = {}) {
  const storeMonthSettling = useGameStore((s) => s.monthSettling);
  const storeGame = useGameStore((s) => s.game);
  const hookBroadcast = useBroadcast();

  const monthSettling = propMonthSettling ?? storeMonthSettling;
  const game = propGame ?? storeGame;
  const broadcast = { ...hookBroadcast, ...propBroadcast };

  const isVisible = monthSettling || broadcast.active;

  if (!isVisible || !game) return null;

  const progress = Math.max(0, Math.min(100, broadcast.progress));

  return (
    <div
      className="fixed inset-0 z-40 bg-black/75 backdrop-blur-md flex items-center justify-center select-none"
      data-testid="turn-progress-overlay"
    >
      <div className="rounded border-2 border-double border-amber-600/80 bg-stone-950/98 px-9 py-7 text-center shadow-[0_0_50px_rgba(215,170,98,0.25)] min-w-[320px] max-w-[440px] motion-safe:animate-[ink-fade-in_180ms_ease-out]">
        {/* 1. 顶头题签 */}
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <SealBadge char="运" color="gold" size={16} />
          <p className="text-xs tracking-[0.35em] text-amber-500 font-song font-medium">
            天道流转 · 乾坤推演
          </p>
        </div>

        {/* 2. 当前年月与阶段标签 */}
        <p className="text-3xl text-amber-200 font-seal tracking-[0.2em] drop-shadow-md">
          {game.currentYear}年{game.currentMonth}月
        </p>

        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-stone-900 border border-amber-900/60 text-[11px] text-amber-300 font-song">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
          <span>[ {broadcast.phase || '乾坤推演'} ]</span>
        </div>

        {/* 3. 详细文言推演战报 */}
        <p className="mt-3 text-xs text-stone-300 font-song tracking-wide min-h-[32px] flex items-center justify-center px-2">
          {broadcast.message || '正在结算各方城池政务、军团调度与天下烽烟…'}
        </p>

        {/* 4. 百分比进度条 */}
        <div className="mt-3.5 space-y-1">
          <div className="h-2 w-56 mx-auto overflow-hidden rounded-full bg-stone-900 border border-stone-800 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-700 via-amber-400 to-amber-500 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(245,158,11,0.5)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between w-56 mx-auto text-[10px] text-stone-500 font-mono">
            <span className="flex items-center gap-1">
              {broadcast.connected ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-emerald-400">实时信道</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-600" />
                  <span>离线推演</span>
                </>
              )}
            </span>
            <span className="text-amber-400/90 font-semibold">{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TurnProgressOverlay as default };
