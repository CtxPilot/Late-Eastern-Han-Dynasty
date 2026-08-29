// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * 三级按钮（ArtDirection.md §3.2）：
 * - InkButton 次令【结构基座】：统一 flex/圆角/禁用行为；颜色类留在调用点
 *   （批次② codemod 全量替换时与既有条件态类零冲突）。
 * - SealButton 主令：朱砂底 + 金文 + 金双框；确认下令/结束回合/进入剧本，一屏 ≤1。
 * - DangerButton 危令：深朱底朱边，宣战/处决/解盟/覆盖存档。
 * 禁用态必须传 reason（title 提示），禁止仅置灰。
 */

type BaseProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** 禁用原因（无障碍与 §3.2 纪律：不得仅置灰） */
  reason?: string;
} & { [key: `data-${string}`]: string | number | undefined };

const STRUCTURAL_BASE =
  'inline-flex items-center justify-center gap-1 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

export const InkButton = forwardRef<HTMLButtonElement, BaseProps>(function InkButton(
  { children, className = '', reason, disabled, ...rest },
  ref,
) {
  return (
    <button {...rest} ref={ref} type="button" disabled={disabled} title={reason} className={`${STRUCTURAL_BASE} ${className}`}>
      {children}
    </button>
  );
});

export const SealButton = forwardRef<HTMLButtonElement, BaseProps>(function SealButton(
  { children, className = '', reason, disabled, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      disabled={disabled}
      title={reason}
      className={`${STRUCTURAL_BASE} bg-seal-600 text-gold-200 border-2 border-gold-400 border-double font-semibold hover:bg-seal-400 px-3 py-1.5 ${className}`}
    >
      {children}
    </button>
  );
});

export const DangerButton = forwardRef<HTMLButtonElement, BaseProps>(function DangerButton(
  { children, className = '', reason, disabled, ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      disabled={disabled}
      title={reason}
      className={`${STRUCTURAL_BASE} bg-seal-900 text-gold-200 border border-seal-600 hover:bg-seal-600/70 px-3 py-1.5 ${className}`}
    >
      {children}
    </button>
  );
});
