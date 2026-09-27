// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { InkButton } from '../ui/buttons';
import { SealBadge } from '../ui/SealBadge';

/**
 * S14 事件对话弹窗（P4-07）
 * 遵循 DESIGN.md §五 终审确认与古籍奏折装帧。
 * 流程：逐段对话 → 选项按钮 → POST /event/choose
 */
export function EventDialog() {
  const game = useGameStore((s) => s.game);
  const catalog = useGameStore((s) => s.eventsCatalog);
  const chooseEvent = useGameStore((s) => s.chooseEvent);
  const loading = useGameStore((s) => s.loading);

  const pendingId = game?.pendingEvents?.[0] ?? null;
  const evt = useMemo(
    () => (pendingId != null ? catalog.find((e) => e.id === pendingId) : undefined),
    [catalog, pendingId],
  );

  const [dialogueIdx, setDialogueIdx] = useState(0);

  useEffect(() => {
    setDialogueIdx(0);
  }, [pendingId]);

  if (pendingId == null) return null;
  if (!evt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm text-red-300 font-song text-sm">
        事件目录缺失，请刷新后重试；系统不会代替玩家选择。
      </div>
    );
  }

  const dialogues = evt.dialogues ?? [];
  const showChoices = dialogueIdx >= dialogues.length;
  const current = dialogues[dialogueIdx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none"
      data-testid="event-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-dialog-title"
    >
      <div
        className="w-full max-w-lg rounded border border-amber-800/80 bg-stone-950/98 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-hidden motion-safe:animate-[ink-fade-in_180ms_ease-out]"
        data-testid="event-dialog"
      >
        {/* 顶部奏折封泥标题 */}
        <header className="border-b border-amber-900/60 bg-gradient-to-r from-stone-900 via-stone-850 to-stone-900 px-5 py-3.5">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs text-amber-600 font-song tracking-widest flex items-center gap-1.5">
              <SealBadge char="史" color="gold" size={14} /> 汉末风云 · 纪事
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded border border-amber-800/60 bg-amber-950/40 text-amber-300 font-song">
              〔{SOURCE_LABEL[evt.sourceClass] ?? evt.sourceClass}〕
            </span>
          </div>
          <h2 id="event-dialog-title" className="text-xl text-amber-200 font-seal tracking-wider">
            {evt.name}
          </h2>
          {evt.sources.length > 0 && (
            <p className="mt-1 text-xs text-stone-400 font-song">
              考据出处：{evt.sources.join(' · ')}
            </p>
          )}
          {evt.description && (
            <p className="mt-1.5 text-xs text-stone-400 font-song leading-relaxed border-t border-stone-800/60 pt-1.5">
              {evt.description}
            </p>
          )}
        </header>

        {/* 对话正文区 */}
        <div className="min-h-[140px] px-5 py-5 text-sm text-stone-200 font-song leading-relaxed bg-stone-950/80">
          {!showChoices && current && (
            <div data-testid="event-dialogue" className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-3.5 bg-amber-500/80 rounded-xs" aria-hidden />
                <p className="text-amber-300 font-semibold tracking-wide">【{current.speakerName}】</p>
              </div>
              <p className="pl-3 border-l border-stone-800 text-stone-200 leading-relaxed whitespace-pre-wrap">
                {current.text}
              </p>
            </div>
          )}
          {showChoices && (
            <div className="space-y-1">
              <p className="text-stone-400 text-xs font-semibold tracking-wider mb-2">时势所趋 · 请定决断：</p>
            </div>
          )}
        </div>

        {/* 底部交互区 */}
        <footer className="flex flex-col gap-2 border-t border-amber-900/40 bg-stone-900/60 px-5 py-3.5">
          {!showChoices ? (
            <InkButton
              type="button"
              data-testid="event-continue"
              className="px-4 py-2.5 rounded bg-amber-900/90 border border-amber-600 text-amber-100 text-sm hover:bg-amber-800 font-song font-medium shadow-md tracking-wider"
              onClick={() => setDialogueIdx((i) => i + 1)}
            >
              继续
            </InkButton>
          ) : (
            evt.choices.map((c, i) => (
              <InkButton
                key={`${evt.id}-${i}`}
                type="button"
                data-testid={`event-choice-${i}`}
                disabled={loading}
                className="px-3.5 py-2.5 rounded bg-stone-900 border border-stone-700 hover:border-amber-600 hover:bg-amber-950/50 text-amber-100 text-sm disabled:opacity-50 text-left font-song transition-all flex items-center justify-between group"
                onClick={() => void chooseEvent(evt.id, i)}
              >
                <span>{c.label}</span>
                <span className="text-xs text-stone-500 group-hover:text-amber-300 font-seal">下决 →</span>
              </InkButton>
            ))
          )}
          {(game?.pendingEvents?.length ?? 0) > 1 && (
            <p className="text-xs text-stone-500 text-center font-song pt-1">
              尚有 {(game?.pendingEvents?.length ?? 1) - 1} 件待决事件
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  official_history: '正史',
  annotated_history: '裴注异闻',
  literature: '文学演义',
  legend: '民间传说',
  gameplay: '玩法改编',
};
