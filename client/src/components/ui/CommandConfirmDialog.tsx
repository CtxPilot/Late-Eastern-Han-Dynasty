// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useId, useRef, useState } from 'react';

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
  validateBeforeConfirm?: () => string | null;
  fallbackFocusSelector?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function getFocusTrapDestination(
  activeIndex: number,
  focusableCount: number,
  shiftKey: boolean,
): number | null {
  if (focusableCount <= 0) return -1;
  if (shiftKey && activeIndex === 0) return focusableCount - 1;
  if (!shiftKey && activeIndex === focusableCount - 1) return 0;
  return null;
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
  validateBeforeConfirm,
  fallbackFocusSelector,
  onCancel,
  onConfirm,
}: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const loadingRef = useRef(loading);
  const dangerRef = useRef(danger);
  const onCancelRef = useRef(onCancel);
  const [validationError, setValidationError] = useState<string | null>(null);
  loadingRef.current = loading;
  dangerRef.current = danger;
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setValidationError(null);
    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loadingRef.current) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onCancelRef.current();
        return;
      }
      if (event.key === 'Enter' && dangerRef.current) {
        event.preventDefault();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const activeIndex = focusable.findIndex((element) => element === document.activeElement);
      const destination = getFocusTrapDestination(activeIndex, focusable.length, event.shiftKey);
      if (destination != null) {
        event.preventDefault();
        if (destination < 0) dialogRef.current?.focus();
        else focusable[destination]?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      const returnTarget = returnFocusRef.current;
      requestAnimationFrame(() => {
        const returnable =
          returnTarget?.isConnected &&
          !(returnTarget instanceof HTMLButtonElement && returnTarget.disabled);
        if (returnable) returnTarget.focus();
        else if (fallbackFocusSelector) {
          document.querySelector<HTMLElement>(fallbackFocusSelector)?.focus();
        }
      });
    };
  }, [fallbackFocusSelector, open]);

  if (!open) return null;

  const submit = () => {
    const reason = validateBeforeConfirm?.() ?? null;
    setValidationError(reason);
    if (reason) return;
    void onConfirm();
  };
  const liveValidationError = validateBeforeConfirm?.() ?? null;
  const displayedError = liveValidationError ?? validationError ?? error;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/80 px-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading && !danger) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-md overflow-hidden rounded border border-amber-800/70 bg-stone-950 shadow-2xl shadow-black"
        data-testid="command-confirm-dialog"
      >
        <div className="border-b border-amber-900/50 bg-gradient-to-r from-stone-900 via-amber-950/30 to-stone-900 px-5 py-4">
          <div className="text-[10px] tracking-[0.28em] text-amber-600">{category} · 终审</div>
          <h2 id={titleId} className="mt-1 text-lg font-bold tracking-widest text-amber-100">
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

        {displayedError && (
          <p
            className="mx-5 mb-2 rounded border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300"
            role="alert"
            data-testid="command-confirm-error"
          >
            {displayedError}
          </p>
        )}

        <div className="flex gap-2 border-t border-stone-800 px-5 py-4">
          <button
            ref={cancelRef}
            type="button"
            data-testid="command-confirm-cancel"
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
            disabled={loading || liveValidationError != null}
            onClick={submit}
          >
            {loading ? '传令中…' : '确认下令'}
          </button>
        </div>
      </section>
    </div>
  );
}
