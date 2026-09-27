// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons';
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
      className="absolute bottom-full left-0 z-20 flex h-[min(42rem,calc(100vh-8rem))] w-[min(26.25rem,calc(100vw-2rem))] flex-col border border-amber-900/80 border-t-2 border-t-amber-600/90 bg-stone-950/98 shadow-[0_-12px_32px_rgba(0,0,0,0.6)] motion-safe:animate-[command-drawer-in_180ms_ease-out] select-none"
    >
      <header className="flex items-center justify-between gap-3 border-b border-stone-800/90 px-4 py-3 bg-gradient-to-r from-stone-900/90 via-stone-900/50 to-stone-950">
        <div className="flex items-baseline gap-2">
          <span className="w-1.5 h-3.5 bg-seal-600 rounded-xs" aria-hidden />
          <h2
            id={`${id}-title`}
            ref={titleRef}
            tabIndex={-1}
            className="text-base tracking-[0.2em] text-amber-200 font-seal outline-none"
          >
            {title}
          </h2>
          <span className="text-[11px] text-stone-500 font-song">
            {availability === 'available' ? '可用' : availability === 'legacy' ? '仍在原面板' : '设计中'}
          </span>
        </div>
        <InkButton
          type="button"
          data-testid="command-drawer-close"
          aria-label={`关闭${title}抽屉`}
          onClick={onClose}
          className="border border-stone-700 bg-stone-900/80 px-2 py-0.5 text-xs text-stone-400 hover:border-amber-700 hover:text-stone-200 font-song"
        >
          收起
        </InkButton>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 text-xs leading-5 text-stone-300 font-song">
        {children}
      </div>

      <footer className="border-t border-stone-800/80 px-4 py-2 bg-stone-950 flex items-center justify-between text-[11px] text-stone-500 font-song">
        {footer ? <div>{footer}</div> : <span>枢府调度 · 慎决军政大略</span>}
        <span>〔Esc〕可收起</span>
      </footer>
    </aside>
  );
}
