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
  { domain: 'civil', label: '内政', availability: 'available', reason: '城市治理与宫廷人脉唯一入口' },
  { domain: 'military', label: '军事', availability: 'available', reason: '军备、编成出征与战役军令唯一入口' },
  { domain: 'personnel', label: '人事', availability: 'available', reason: '名册、招贤、任官、赏罚唯一入口' },
  { domain: 'diplomacy', label: '外交', availability: 'available', reason: '势力、交涉与盟约唯一入口' },
  { domain: 'strategy', label: '计略', availability: 'available', reason: 'S17 L1 四计 + L2 釜底抽薪/暗渡陈仓唯一入口' },
  { domain: 'intel', label: '情报', availability: 'available', reason: 'S07 人员、任务、反间与俘虏唯一入口' },
  { domain: 'farming', label: '屯田', availability: 'available', reason: '民屯田分配与月结产粮唯一入口；军屯仍设计中' },
  { domain: 'family', label: '家族', availability: 'available', reason: '家族总览与婚姻、子嗣操作唯一入口' },
  { domain: 'court', label: '朝廷', availability: 'available', reason: '朝廷功能唯一入口' },
  { domain: 'faction', label: '势力', availability: 'available', reason: '势力总览与天命人心双轨系统唯一入口' },
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
      <div className="mx-auto grid max-w-[90rem] grid-cols-5 items-stretch gap-1.5 lg:grid-cols-10">
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
              className={`min-w-0 border px-2 py-1.5 text-xs transition-colors ${
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
          className="min-w-0 border border-red-950 bg-red-950/25 px-3 py-1.5 text-xs text-stone-600"
        >
          进行
          <span className="mt-0.5 block text-[9px]">仍在顶部</span>
        </button>
      </div>
    </nav>
  );
}
