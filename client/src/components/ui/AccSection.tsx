// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { ReactNode } from 'react';

/** 统一折叠大项（左右栏共用） */
export function AccSection({
  title,
  badge,
  open,
  onToggle,
  children,
  accent = 'amber',
}: {
  title: string;
  /** 标题右侧小计数，如美人人数 */
  badge?: string | number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  accent?: 'amber' | 'rose' | 'emerald' | 'sky';
}) {
  const accentCls = {
    amber: 'text-amber-400/90',
    rose: 'text-rose-400/90',
    emerald: 'text-emerald-400/90',
    sky: 'text-sky-400/90',
  }[accent];

  return (
    <div className="border-b border-stone-800/80">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-stone-900/80"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className={`font-medium text-xs tracking-wide ${accentCls}`}>
          {title}
          {badge != null && badge !== '' && (
            <span className="ml-1.5 text-stone-500 font-normal">({badge})</span>
          )}
        </span>
        <span className="text-stone-600 text-[10px] shrink-0">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="pb-2 bg-stone-950/40">{children}</div>}
    </div>
  );
}
