// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useGameStore } from '../../stores/gameStore';

/**
 * 回合反馈（P0-3 · Session 407，`docs/40-game-evaluation.md`）：
 * - TurnProgressOverlay：结束回合期间的全屏结算遮罩（年月 + 推演文案）。
 * - MonthReportCard：月结完成后展示「本月纪要」（本次新增的 actionLog 聚合），可关闭。
 * 均为客户端瞬态（store 的 monthSettling/monthReport），不写存档字段。
 */

export function TurnProgressOverlay() {
  const monthSettling = useGameStore((s) => s.monthSettling);
  const game = useGameStore((s) => s.game);
  if (!monthSettling || !game) return null;
  return (
    <div
      className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      data-testid="turn-progress-overlay"
    >
      <div className="rounded border border-gold-400/60 bg-stone-950/95 px-8 py-6 text-center shadow-2xl min-w-[260px]">
        <p className="text-xs tracking-[0.35em] text-amber-700/90 mb-1">天道推演</p>
        <p className="text-2xl text-amber-300 font-seal tracking-widest">
          {game.currentYear}年{game.currentMonth}月
        </p>
        <p className="mt-2 text-xs text-stone-400">正在结算内政、军事与四方动静…</p>
        <div className="mt-3 h-1 w-40 mx-auto overflow-hidden rounded-sm bg-stone-800">
          <div className="h-full w-1/3 bg-amber-500 animate-pulse" />
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
      className="fixed bottom-3 right-3 z-40 w-[min(92vw,360px)] rounded border border-amber-900/70 bg-stone-950/95 shadow-xl"
      data-testid="month-report"
    >
      <div className="flex items-center justify-between border-b border-stone-800 px-3 py-2">
        <p className="text-sm text-amber-300 font-semibold">
          本月纪要 · {monthReport.year}年{monthReport.month}月
        </p>
        <InkButton
          type="button"
          className="text-stone-500 hover:text-stone-300 text-sm leading-none"
          aria-label="关闭本月纪要"
          onClick={clearMonthReport}
        >
          ×
        </InkButton>
      </div>
      {monthReport.entries.length === 0 ? (
        <p className="px-3 py-3 text-xs text-stone-500">本月四方无事。</p>
      ) : (
        <ul className="max-h-56 overflow-y-auto px-3 py-2 space-y-1">
          {monthReport.entries.slice(0, 30).map((e, i) => (
            <li key={i} className="text-xs text-stone-300 leading-snug">
              <span className="text-stone-600 mr-1">·</span>
              {e.message}
            </li>
          ))}
          {monthReport.entries.length > 30 && (
            <li className="text-xs text-stone-600">（其余 {monthReport.entries.length - 30} 条见行动日志）</li>
          )}
        </ul>
      )}
    </div>
  );
}
