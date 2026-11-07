// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons';
import { useGameStore } from '../../stores/gameStore';
import { SealBadge } from '../ui/SealBadge';
import { formatActionLogEntry } from '../common/eventLogParser';

/**
 * 回合反馈（P0-3 · Session 407，`docs/40-game-evaluation.md`）：
 * - TurnProgressOverlay：结束回合期间的全屏结算遮罩（年月 + 推演文案）。
 * - MonthReportCard：月结完成后展示「本月纪要」（本次新增的 actionLog 聚合），可关闭。
 * 遵循 DESIGN.md §5.1 水墨浑天推演与古籍纪要装帧。
 */

export function TurnProgressOverlay() {
  const monthSettling = useGameStore((s) => s.monthSettling);
  const game = useGameStore((s) => s.game);
  if (!monthSettling || !game) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/75 backdrop-blur-md flex items-center justify-center select-none"
      data-testid="turn-progress-overlay"
    >
      <div className="rounded border-2 border-double border-gold-400/80 bg-stone-950/98 px-10 py-8 text-center shadow-[0_0_50px_rgba(215,170,98,0.25)] min-w-[300px] motion-safe:animate-[ink-fade-in_180ms_ease-out]">
        <div className="flex items-center justify-center gap-1.5 mb-2">
          <SealBadge char="运" color="gold" size={16} />
          <p className="text-xs tracking-[0.4em] text-amber-600 font-song">天道流转 · 乾坤推演</p>
        </div>
        <p className="text-3xl text-amber-300 font-seal tracking-[0.25em] drop-shadow-md">
          {game.currentYear}年{game.currentMonth}月
        </p>
        <p className="mt-3 text-xs text-stone-400 font-song tracking-wide">
          正在结算各方城池政务、军团调度与天下烽烟…
        </p>
        <div className="mt-4 h-1.5 w-48 mx-auto overflow-hidden rounded-full bg-stone-900 border border-stone-800">
          <div className="h-full w-2/5 bg-gradient-to-r from-amber-700 via-amber-400 to-amber-600 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function MonthReportCard() {
  const monthReport = useGameStore((s) => s.monthReport);
  const monthSettling = useGameStore((s) => s.monthSettling);
  const clearMonthReport = useGameStore((s) => s.clearMonthReport);
  if (!monthReport || monthSettling) return null;
  return (
    <div
      className="fixed bottom-3 right-3 z-40 w-[min(92vw,380px)] rounded border border-amber-800/80 bg-stone-950/98 shadow-[0_8px_30px_rgba(0,0,0,0.7)] select-none motion-safe:animate-[feedback-card-in_200ms_ease-out]"
      data-testid="month-report"
    >
      <div className="flex items-center justify-between border-b border-stone-800 px-3.5 py-2.5 bg-gradient-to-r from-stone-900/90 to-stone-950">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-seal-600 rounded-xs" aria-hidden />
          <p className="text-xs text-amber-300 font-semibold font-song tracking-wide">
            本月纪要 · {monthReport.year}年{monthReport.month}月
          </p>
        </div>
        <InkButton
          type="button"
          className="text-stone-400 hover:text-stone-200 text-sm leading-none px-1.5 py-0.5 rounded hover:bg-stone-800"
          aria-label="关闭本月纪要"
          onClick={clearMonthReport}
        >
          ×
        </InkButton>
      </div>
      {monthReport.entries.length === 0 ? (
        <p className="px-4 py-3 text-xs text-stone-500 font-song">本月四方承平，无重大奏报。</p>
      ) : (
        <ul className="max-h-64 overflow-y-auto px-3.5 py-3 space-y-1.5 font-mono">
          {monthReport.entries.slice(0, 30).map((e, i) => {
            const item = formatActionLogEntry(e, i, monthReport.year, monthReport.month);
            return (
              <li
                key={i}
                className="text-xs text-stone-300 leading-snug flex items-baseline gap-1.5 border-b border-stone-900/60 pb-1"
              >
                <span className="text-[10px] text-amber-500/90 font-mono font-semibold shrink-0 select-none">
                  {item.categoryTag}
                </span>
                <span className="flex-1 font-song text-stone-200">{item.displayMessage}</span>
                <span
                  className={`text-[9px] font-song font-bold px-1 py-0.2 rounded-xs border shrink-0 select-none ${item.stampColorClass}`}
                  style={item.stampBadgeStyle}
                >
                  [ {item.stampChar} ]
                </span>
              </li>
            );
          })}
          {monthReport.entries.length > 30 && (
            <li className="text-[11px] text-stone-500 pt-1 text-center border-t border-stone-900 font-song">
              （其余 {monthReport.entries.length - 30} 条详见起居注全卷）
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
