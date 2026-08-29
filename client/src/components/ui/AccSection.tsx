// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from '././buttons'; // 批次② 三级按钮基座
import type { ReactNode } from 'react';

/** 统一折叠大项（左右栏共用） */
export function AccSection({
  title,
  badge,
  open,
  onToggle,
  children,
  accent = 'civil',
}: {
  title: string;
  /** 标题右侧小计数，如美人人数 */
  badge?: string | number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  /** 语义色别名（ArtDirection.md §1.2：军=朱红 / 政=金 / 人=宣 / 谍=青）。
   * 批次①（Session 407）：legacy amber/rose/emerald/sky 键已删除（全库无调用方）；
   * accent 走 index.css 的 --accent-* CSS 变量（与 tailwind 具名色等值双通道）。 */
  accent?: 'military' | 'civil' | 'personnel' | 'intel';
}) {
  const semanticAccent: Record<'military' | 'civil' | 'personnel' | 'intel', string> = {
    military: 'var(--accent-military)',
    civil: 'var(--accent-civil)',
    personnel: 'var(--accent-personnel)',
    intel: 'var(--accent-intel)',
  };

  return (
    <div className="border-b border-stone-800/80">
      <InkButton
        type="button"
        className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-stone-900/80"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="font-medium text-xs tracking-wide" style={{ color: semanticAccent[accent] }}>
          {title}
          {badge != null && badge !== '' && (
            <span className="ml-1.5 text-stone-500 font-normal">({badge})</span>
          )}
        </span>
        <span className="text-stone-600 text-xs shrink-0">{open ? '▾' : '▸'}</span>
      </InkButton>
      {open && <div className="pb-2 bg-stone-950/40">{children}</div>}
    </div>
  );
}
