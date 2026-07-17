// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';

/**
 * S14 事件对话弹窗（P4-07）
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

  // F6: catalog 缺失时自动跳过该事件（选 index 0），避免死锁卡死玩家
  useEffect(() => {
    if (pendingId != null && !evt && !loading) {
      void chooseEvent(pendingId, 0);
    }
  }, [pendingId, evt, loading, chooseEvent]);

  if (pendingId == null || !evt) return null;

  const dialogues = evt.dialogues ?? [];
  const showChoices = dialogueIdx >= dialogues.length;
  const current = dialogues[dialogueIdx];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      data-testid="event-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-dialog-title"
    >
      <div
        className="w-full max-w-md rounded-lg border border-amber-800/70 bg-stone-900 shadow-xl"
        data-testid="event-dialog"
      >
        <header className="border-b border-amber-900/50 px-4 py-3">
          <h2 id="event-dialog-title" className="text-amber-300 font-semibold tracking-wide">
            事件：{evt.name}
          </h2>
          {evt.description && (
            <p className="mt-1 text-xs text-stone-400">{evt.description}</p>
          )}
        </header>

        <div className="min-h-[120px] px-4 py-4 text-sm text-stone-200">
          {!showChoices && current && (
            <div data-testid="event-dialogue">
              <p className="mb-2 text-amber-200/90">【{current.speakerName}】</p>
              <p className="leading-relaxed whitespace-pre-wrap">{current.text}</p>
            </div>
          )}
          {showChoices && (
            <p className="text-stone-400 text-xs mb-3">请选择：</p>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-amber-900/40 px-4 py-3">
          {!showChoices ? (
            <button
              type="button"
              data-testid="event-continue"
              className="px-3 py-2 rounded bg-amber-900/80 border border-amber-600 text-amber-100 text-sm hover:bg-amber-800"
              onClick={() => setDialogueIdx((i) => i + 1)}
            >
              继续
            </button>
          ) : (
            evt.choices.map((c, i) => (
              <button
                key={`${evt.id}-${i}`}
                type="button"
                data-testid={`event-choice-${i}`}
                disabled={loading}
                className="px-3 py-2 rounded bg-stone-800 border border-amber-700/60 text-amber-100 text-sm hover:bg-stone-700 disabled:opacity-50 text-left"
                onClick={() => void chooseEvent(evt.id, i)}
              >
                {c.label}
              </button>
            ))
          )}
          {(game?.pendingEvents?.length ?? 0) > 1 && (
            <p className="text-[10px] text-stone-500 text-center">
              尚有 {(game?.pendingEvents?.length ?? 1) - 1} 件待决
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}
