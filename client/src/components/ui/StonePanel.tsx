// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { ReactNode } from 'react';

/**
 * 石板面板（批次② · Session 408，ArtDirection.md §3.1 标准配方）：
 * ink-900 底 + ink-700 边 + 圆角 ≤4px；分组标题 15px/700 + 2px 朱砂左缘竖条。
 * 层级最多三层（面板→分组→字段），标题省略时退化为纯容器。
 */
export function StonePanel({
  title,
  subTitle,
  headerAction,
  goldBorder = false,
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: string;
  subTitle?: string;
  headerAction?: ReactNode;
  goldBorder?: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`rounded border ${
        goldBorder ? 'border-amber-700/60 shadow-[0_4px_20px_rgba(0,0,0,0.5)]' : 'border-ink-700'
      } bg-ink-900/95 backdrop-blur-sm ${className}`}
    >
      {title != null && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-l-2 border-ink-700/70 border-l-seal-600 bg-gradient-to-r from-ink-900 via-ink-850 to-ink-900">
          <div className="flex items-baseline gap-2 min-w-0">
            <h3 className="text-[15px] font-bold text-wen-100 tracking-wide font-song truncate">{title}</h3>
            {subTitle && <span className="text-xs text-stone-500 font-normal truncate">{subTitle}</span>}
          </div>
          {headerAction && <div className="shrink-0 ml-2">{headerAction}</div>}
        </div>
      )}
      <div className={`p-3 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
