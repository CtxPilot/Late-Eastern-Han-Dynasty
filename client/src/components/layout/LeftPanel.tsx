// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useMemo, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { CampaignPanel } from '../campaign/CampaignPanel';
import { GrandStrategistPanel } from '../strategist/GrandStrategistPanel';
import { HegemonyPanel } from './HegemonyPanel';
import { AccSection } from '../ui/AccSection';

type AccordionKey =
  | 'hegemony'
  | 'campaign'
  | 'strategist'
  | 'cities'
  | null;

/** 左侧政务：霸业、战役、总军师与城池；已迁域不再重复挂载。 */
export function LeftPanel() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const selectCity = useGameStore((s) => s.selectCity);
  const focusMapOnCity = useGameStore((s) => s.focusMapOnCity);
  const clearError = useGameStore((s) => s.clearError);
  // focusMapOnCity：切战略屏到该城所属州并选中（不再驱动 Konva 缩放）
  // 霸业面板默认展开（P0-1）：给玩家一个常驻的「为什么而战」读数。
  const [open, setOpen] = useState<AccordionKey>('hegemony');

  const armyCount = useMemo(() => {
    if (!game) return 0;
    return game.campaignArmies.filter((a) => a.factionId === game.playerFactionId).length;
  }, [game]);

  if (!game) return null;

  const playerCities = Object.values(game.cities).filter(
    (c) => c.ruler === game.playerFactionId,
  );
  const selected = selectedCityId != null ? game.cities[selectedCityId] : null;
  const isPlayerCity = selected != null && selected.ruler === game.playerFactionId;

  const toggle = (k: AccordionKey) => {
    clearError();
    setOpen((prev) => (prev === k ? null : k));
  };
  return (
    <aside
      className="w-60 shrink-0 border-r border-amber-900/40 bg-stone-950/95 flex flex-col text-xs overflow-hidden"
      data-testid="left-panel"
    >
      <div className="px-3 py-2 border-b border-stone-800 text-amber-500/90 font-semibold tracking-wide">
        政务
      </div>

      <div className="px-2 py-1.5 text-xs text-stone-500 border-b border-stone-900 leading-snug">
        {isPlayerCity
          ? `当前城：${selected!.name}（命令请用底部命令坞）`
          : selected
            ? `已选：${selected.name}`
            : '先选己方城，再从底部命令坞下令'}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <AccSection
          title="霸业"
          badge={playerCities.length}
          accent="civil"
          open={open === 'hegemony'}
          onToggle={() => toggle('hegemony')}
        >
          <HegemonyPanel />
        </AccSection>

        <AccSection
          title="战役"
          badge={armyCount}
          accent="military"
          open={open === 'campaign'}
          onToggle={() => toggle('campaign')}
        >
          <CampaignPanel />
        </AccSection>

        <AccSection
          title="总军师"
          accent="military"
          open={open === 'strategist'}
          onToggle={() => toggle('strategist')}
        >
          <div className="px-2 py-1">
            <GrandStrategistPanel />
          </div>
        </AccSection>

        <AccSection
          title="己方城池"
          badge={playerCities.length}
          accent="civil"
          open={open === 'cities'}
          onToggle={() => toggle('cities')}
        >
          <div className="px-2 flex flex-col gap-0.5 max-h-56 overflow-y-auto">
            {playerCities.map((c) => (
              <InkButton
                key={c.id}
                type="button"
                className={`text-left px-2 py-1.5 rounded border text-xs ${
                  c.id === selectedCityId
                    ? 'border-amber-500 bg-amber-950 text-amber-100'
                    : 'border-stone-800 bg-stone-900/80 text-stone-300 hover:border-emerald-800'
                }`}
                onClick={() => {
                  selectCity(c.id);
                  focusMapOnCity(c.id);
                }}
              >
                {c.name}
                <span className="text-stone-500 ml-1">
                  农{c.stats.farm} 兵{c.troops}
                </span>
              </InkButton>
            ))}
          </div>
        </AccSection>
      </div>
    </aside>
  );
}
