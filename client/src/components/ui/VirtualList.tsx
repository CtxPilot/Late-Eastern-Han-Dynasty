// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useState, type ReactNode } from 'react';

/**
 * 零依赖窗口化列表（P2-3 · Session 415，D-0B-4）：大名单（0-B 1000+ 武将）只渲染
 * 视口 ± overscan 的行。固定行高模型：首尾 spacer 撑起总高。
 * 1000 行 → 实际挂载 ≈ 视口行数 + 2×overscan。
 */
export function VirtualList<T>({
  items,
  itemHeight,
  getKey,
  renderItem,
  className = '',
  overscan = 6,
  testId,
  empty,
}: {
  items: readonly T[];
  /** 固定行高（px）；行内容超出会被裁剪，调用方自行保证行内布局适配 */
  itemHeight: number;
  getKey: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  overscan?: number;
  testId?: string;
  empty?: ReactNode;
}) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(320);

  // 回调 ref：挂载/容器高度变化时校准视口高度（首帧 clientHeight 可能为 0）
  const attach = (node: HTMLDivElement | null) => {
    if (node && Math.abs(node.clientHeight - viewport) > 1) setViewport(node.clientHeight);
  };

  if (items.length === 0) {
    return (
      <div className={`min-h-0 flex-1 overflow-y-auto ${className}`} data-testid={testId}>
        {empty ?? null}
      </div>
    );
  }

  const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const end = Math.min(items.length, Math.ceil((scrollTop + viewport) / itemHeight) + overscan);
  const slice = items.slice(start, end);

  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto ${className}`}
      data-testid={testId}
      ref={attach}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: start * itemHeight }} aria-hidden />
      {slice.map((item, i) => (
        <div key={getKey(item, start + i)} style={{ height: itemHeight }}>
          {renderItem(item, start + i)}
        </div>
      ))}
      <div style={{ height: (items.length - end) * itemHeight }} aria-hidden />
    </div>
  );
}
