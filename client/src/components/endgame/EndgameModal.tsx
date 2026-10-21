// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 天下一统与战役终局史诗结算组件（HC-P2，docs/50）。
 * 遵循 DESIGN.md「金石水墨·拓片简册·印信官职」最高美学。
 */

import type { EndgameResult } from '@leh/shared';
import { InkButton, SealButton } from '../ui/buttons';

interface EndgameModalProps {
  result: EndgameResult;
  onContinue: () => void;
  onRestart: () => void;
}

export function EndgameModal({ result, onContinue, onRestart }: EndgameModalProps) {
  const isVictory = result.type === 'unification_victory';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/85 p-4 backdrop-blur-sm ink-fade-in"
      data-testid="endgame-modal"
    >
      <div
        className={`relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded border p-6 shadow-2xl ${
          isVictory
            ? 'border-amber-600/80 bg-stone-900/95 tex-paper'
            : 'border-stone-700 bg-stone-900/95'
        }`}
        data-testid={isVictory ? 'endgame-victory-content' : 'endgame-defeat-content'}
      >
        {/* 印信徽章与标题 */}
        <div className="text-center">
          <div className="mb-2 inline-flex items-center justify-center">
            <span
              className={`inline-block border-2 px-3 py-1 font-seal text-2xl tracking-[0.25em] ${
                isVictory
                  ? 'border-seal-500 bg-seal-900/30 text-seal-400 shadow-[0_0_15px_rgba(185,28,28,0.4)]'
                  : 'border-stone-600 bg-stone-800 text-stone-400'
              }`}
            >
              {isVictory ? '天下一统' : '身死国灭'}
            </span>
          </div>
          <h2 className="font-seal text-2xl tracking-widest text-amber-200">
            {isVictory ? '《汉末纪事 · 统一大典》' : '《汉末纪事 · 败亡志》'}
          </h2>
          <p className="mt-1 text-xs tracking-wider text-stone-400 font-serif">
            {isVictory
              ? '四海毕极，九州同风。八荒宾服，定鼎神州。'
              : '山河倾覆，运去英雄不自由。霸业中道崩殂。'}
          </p>
        </div>

        {/* 核心国政档案 */}
        <div className="mt-5 rounded border border-amber-900/50 bg-stone-950/50 p-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div>
              <span className="text-stone-500">开国之君</span>
              <div className="font-serif text-sm font-semibold text-amber-100">
                {result.rulerName}
              </div>
            </div>
            <div>
              <span className="text-stone-500">国统尊号</span>
              <div className="font-serif text-sm font-semibold text-amber-200">
                {result.politicalTitle ?? (isVictory ? '开国皇帝' : '雄主')}
              </div>
            </div>
            <div>
              <span className="text-stone-500">开国年号</span>
              <div className="font-serif text-sm font-semibold text-amber-300">
                {result.eraName ? `「${result.eraName}」元年` : '—'}
              </div>
            </div>
            <div>
              <span className="text-stone-500">平定疆宇</span>
              <div className="font-serif text-sm font-semibold text-emerald-400">
                {result.totalCitiesConquered} 城 · 历时 {result.totalYearsElapsed} 载
              </div>
            </div>
          </div>
        </div>

        {/* 开国功臣榜 */}
        {isVictory && result.topMeritOfficers.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs tracking-widest text-amber-400 font-serif border-b border-stone-800 pb-1">
              【开国元勋功臣榜】
            </h3>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {result.topMeritOfficers.map((officer, idx) => (
                <div
                  key={officer.officerId}
                  className="flex items-center justify-between rounded border border-stone-800 bg-stone-950/40 px-2.5 py-1.5 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-amber-500 font-bold">#{idx + 1}</span>
                    <span className="font-serif text-stone-200">{officer.name}</span>
                    {officer.officialPosition && (
                      <span className="text-[10px] text-stone-400">· {officer.officialPosition}</span>
                    )}
                  </div>
                  <span className="rounded bg-amber-950/60 px-1.5 py-0.5 text-[11px] text-amber-300 border border-amber-900/40">
                    Lv.{officer.meritLevel} {officer.meritTitle}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 霸业史诗年谱 */}
        <div className="mt-4">
          <h3 className="text-xs tracking-widest text-amber-400 font-serif border-b border-stone-800 pb-1">
            【霸业风云史诗年表】
          </h3>
          <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
            {result.chronicle.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 border-l-2 border-amber-800/60 bg-stone-950/30 px-2 py-1 text-stone-300"
              >
                <span className="text-amber-500 font-serif">◆</span>
                <span className="font-serif leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 底部操作主令 */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-stone-800 pt-4">
          {isVictory && (
            <InkButton
              type="button"
              data-testid="btn-endgame-continue"
              onClick={onContinue}
              className="px-4 py-1.5 text-xs text-stone-300 hover:text-stone-100"
            >
              继续推演（沙盒）
            </InkButton>
          )}
          <SealButton
            type="button"
            data-testid="btn-endgame-restart"
            onClick={onRestart}
            className="px-5 py-1.5 text-xs text-amber-100"
          >
            {isVictory ? '青史永存 · 荣归主选' : '重整旗鼓 · 重启征程'}
          </SealButton>
        </div>
      </div>
    </div>
  );
}
