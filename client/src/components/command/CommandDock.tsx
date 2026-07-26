// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { CommandDomain } from './commandShellState';

export type CommandDomainAvailability = 'available' | 'legacy' | 'planned';

export type CommandDockItem = {
  domain: CommandDomain;
  label: string;
  availability: CommandDomainAvailability;
  reason: string;
};

export const COMMAND_DOCK_ITEMS: readonly CommandDockItem[] = [
  { domain: 'civil', label: '内政', availability: 'legacy', reason: '仍在右侧城池面板' },
  { domain: 'military', label: '军事', availability: 'legacy', reason: '仍在战役与城池面板' },
  { domain: 'personnel', label: '人事', availability: 'legacy', reason: '仍在左侧人事面板' },
  { domain: 'diplomacy', label: '外交', availability: 'legacy', reason: '仍在左侧外交面板' },
  { domain: 'strategy', label: '计略', availability: 'legacy', reason: '仍在左侧计谋面板' },
  { domain: 'intel', label: '情报', availability: 'legacy', reason: '仍在左侧谍报面板' },
  { domain: 'farming', label: '屯田', availability: 'planned', reason: '设计中，尚未提供运行时入口' },
  { domain: 'family', label: '家族', availability: 'legacy', reason: '仍在左侧家族面板' },
  { domain: 'court', label: '朝廷', availability: 'available', reason: '朝廷功能已接入；旧君主入口过渡保留至 CMD-P4' },
] as const;

export function CommandDock({
  activeDomain,
  onDomainToggle,
  registerButton,
  drawerId = 'command-drawer',
}: {
  activeDomain: CommandDomain | null;
  onDomainToggle: (domain: CommandDomain) => void;
  registerButton?: (domain: CommandDomain, element: HTMLButtonElement | null) => void;
  drawerId?: string;
}) {
  return (
    <nav
      aria-label="大地图命令坞"
      data-testid="command-dock"
      className="shrink-0 border-t border-amber-950/80 bg-stone-950/95 px-3 py-2 shadow-[0_-6px_20px_rgba(0,0,0,0.35)]"
    >
      <div className="mx-auto flex min-w-[76rem] max-w-[90rem] items-stretch gap-1.5">
        {COMMAND_DOCK_ITEMS.map((item) => {
          const active = item.domain === activeDomain;
          return (
            <button
              key={item.domain}
              type="button"
              data-testid={`command-domain-${item.domain}`}
              aria-expanded={active}
              aria-controls={drawerId}
              ref={(element) => registerButton?.(item.domain, element)}
              title={item.reason}
              onClick={() => onDomainToggle(item.domain)}
              className={`min-w-[5.5rem] flex-1 border px-2 py-1.5 text-xs transition-colors ${
                active
                  ? 'border-amber-500 bg-amber-950/70 text-amber-100'
                  : 'border-stone-800 bg-stone-900/75 text-stone-300 hover:border-stone-600'
              }`}
            >
              <span className="block">{item.label}</span>
              <span className="mt-0.5 block text-[9px] text-stone-500">
                {item.availability === 'available'
                  ? '可用'
                  : item.availability === 'planned'
                    ? '设计中'
                    : '原面板'}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          disabled
          title="本阶段继续使用顶部“结束回合”"
          className="min-w-[7rem] border border-red-950 bg-red-950/25 px-3 py-1.5 text-xs text-stone-600"
        >
          进行
          <span className="mt-0.5 block text-[9px]">仍在顶部</span>
        </button>
      </div>
    </nav>
  );
}
