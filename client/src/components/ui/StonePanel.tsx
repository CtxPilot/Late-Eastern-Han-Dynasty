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
  children,
  className = '',
  bodyClassName = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`rounded border border-ink-700 bg-ink-900/90 ${className}`}>
      {title != null && (
        <div className="px-3 py-2 border-b border-l-2 border-ink-700/70 border-l-seal-600">
          <h3 className="text-[15px] font-bold text-wen-100 tracking-wide">{title}</h3>
        </div>
      )}
      <div className={`p-3 ${bodyClassName}`}>{children}</div>
    </section>
  );
}
