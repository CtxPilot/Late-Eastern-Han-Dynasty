// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect } from 'react';

export interface CommandConfirmItem {
  label: string;
  value: string;
  tone?: 'normal' | 'warning';
}

interface Props {
  open: boolean;
  category: string;
  command: string;
  summary: string;
  items: CommandConfirmItem[];
  loading?: boolean;
  danger?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/** S20 状态变更命令的统一终审询问窗。 */
export function CommandConfirmDialog({
  open,
  category,
  command,
  summary,
  items,
  loading = false,
  danger = false,
  error,
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/80 px-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-confirm-title"
        className="w-full max-w-md overflow-hidden rounded border border-amber-800/70 bg-stone-950 shadow-2xl shadow-black"
        data-testid="command-confirm-dialog"
      >
        <div className="border-b border-amber-900/50 bg-gradient-to-r from-stone-900 via-amber-950/30 to-stone-900 px-5 py-4">
          <div className="text-[10px] tracking-[0.28em] text-amber-600">{category} · 终审</div>
          <h2 id="command-confirm-title" className="mt-1 text-lg font-bold tracking-widest text-amber-100">
            {command}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-stone-400">{summary}</p>
        </div>

        <dl className="divide-y divide-stone-800/80 px-5 py-2 text-xs">
          {items.map((item) => (
            <div key={`${item.label}-${item.value}`} className="grid grid-cols-[5.5rem_1fr] gap-3 py-2.5">
              <dt className="text-stone-500">{item.label}</dt>
              <dd className={item.tone === 'warning' ? 'text-rose-300' : 'text-stone-200'}>{item.value}</dd>
            </div>
          ))}
        </dl>

        {error && <p className="mx-5 mb-2 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p>}

        <div className="flex gap-2 border-t border-stone-800 px-5 py-4">
          <button
            type="button"
            className="flex-1 rounded border border-stone-700 px-3 py-2 text-stone-300 hover:border-stone-500 disabled:opacity-40"
            disabled={loading}
            onClick={onCancel}
          >
            返回修改
          </button>
          <button
            type="button"
            data-testid="command-confirm-submit"
            className={`flex-1 rounded border px-3 py-2 font-semibold tracking-wider disabled:opacity-50 ${
              danger
                ? 'border-red-600 bg-red-950 text-red-100 hover:bg-red-900'
                : 'border-amber-600 bg-amber-900 text-amber-100 hover:bg-amber-800'
            }`}
            disabled={loading}
            onClick={() => void onConfirm()}
          >
            {loading ? '传令中…' : '确认下令'}
          </button>
        </div>
      </section>
    </div>
  );
}
