// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import type { CommandDomainAvailability } from './CommandDock';

export function CommandDrawer({
  id = 'command-drawer',
  title,
  availability,
  onClose,
  triggerElement,
  children,
  footer,
}: {
  id?: string;
  title: string;
  availability: CommandDomainAvailability;
  onClose: () => void;
  triggerElement?: HTMLButtonElement | null;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
    return () => triggerElement?.focus();
  }, [triggerElement]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <aside
      id={id}
      aria-labelledby={`${id}-title`}
      data-testid="command-drawer"
      className="absolute bottom-0 left-0 z-20 flex max-h-full w-[min(26.25rem,calc(100vw-2rem))] flex-col border border-amber-900/60 bg-stone-950/95 shadow-2xl motion-safe:animate-[command-drawer-in_180ms_ease-out]"
    >
      <header className="flex items-center justify-between gap-3 border-b border-stone-800 px-4 py-3">
        <div>
          <h2
            id={`${id}-title`}
            ref={titleRef}
            tabIndex={-1}
            className="text-sm tracking-[0.2em] text-amber-200 outline-none"
          >
            {title}
          </h2>
          <span className="text-[10px] text-stone-500">
            {availability === 'available' ? '可用' : availability === 'legacy' ? '仍在原面板' : '设计中'}
          </span>
        </div>
        <button
          type="button"
          data-testid="command-drawer-close"
          aria-label={`关闭${title}抽屉`}
          onClick={onClose}
          className="border border-stone-700 px-2 py-1 text-xs text-stone-400 hover:border-stone-500 hover:text-stone-200"
        >
          收起
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-xs leading-5 text-stone-400">
        {children}
      </div>
      {footer ? <footer className="border-t border-stone-800 px-4 py-3">{footer}</footer> : null}
    </aside>
  );
}
