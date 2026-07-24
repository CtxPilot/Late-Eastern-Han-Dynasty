// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { calculateAllianceChance, findDiplomacy } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { BeautyPanel } from './BeautyPanel';
import { FamilyPanel } from './FamilyPanel';
import { SpyPanel } from './SpyPanel';
import { PlotPanel } from './PlotPanel';
import { PersonnelPanel } from './PersonnelPanel';
import { AppointPanel } from './AppointPanel';
import { OfficerRosterPanel } from './OfficerRosterPanel';
import { CampaignPanel } from '../campaign/CampaignPanel';
import { GrandStrategistPanel } from '../strategist/GrandStrategistPanel';
import { AccSection } from '../ui/AccSection';

type AccordionKey =
  | 'campaign'
  | 'personnel'
  | 'family'
  | 'intel'
  | 'plot'
  | 'strategist'
  | 'diplomacy'
  | 'monarch'
  | 'cities'
  | null;

const REL_LABEL: Record<string, string> = {
  war: '交战',
  hostile: '敌对',
  neutral: '中立',
  friendly: '友好',
  allied: '同盟',
};

/**
 * 左侧政务：导航、人事、外交（与谍报联动）；不重复右侧内政。
 * 所有折叠默认收起。
 */
export function LeftPanel() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const selectCity = useGameStore((s) => s.selectCity);
  const focusMapOnCity = useGameStore((s) => s.focusMapOnCity);
  const endTurn = useGameStore((s) => s.endTurn);
  const tribute = useGameStore((s) => s.tribute);
  const giftBeautyDip = useGameStore((s) => s.giftBeautyDip);
  const plantFemale = useGameStore((s) => s.plantFemale);
  const formAlliance = useGameStore((s) => s.formAlliance);
  const loading = useGameStore((s) => s.loading);
  const [open, setOpen] = useState<AccordionKey>(null);

  const familyCount = useMemo(() => {
    if (!game) return 0;
    return Object.values(game.females).filter((f) => f.factionId === game.playerFactionId)
      .length;
  }, [game]);

  const armyCount = useMemo(() => {
    if (!game) return 0;
    return game.campaignArmies.filter((a) => a.factionId === game.playerFactionId).length;
  }, [game]);

  const beautyStock = game?.factions[game.playerFactionId]?.beautyStock ?? 0;

  if (!game) return null;

  const playerCities = Object.values(game.cities).filter(
    (c) => c.ruler === game.playerFactionId,
  );
  const selected = selectedCityId != null ? game.cities[selectedCityId] : null;
  const isPlayerCity = selected != null && selected.ruler === game.playerFactionId;

  const toggle = (k: AccordionKey) =>
    setOpen((prev) => (prev === k ? null : k));

  return (
    <aside
      className="w-60 shrink-0 border-r border-amber-900/40 bg-stone-950/95 flex flex-col text-xs overflow-hidden"
      data-testid="left-panel"
    >
      <div className="px-3 py-2 border-b border-stone-800 text-amber-500/90 font-semibold tracking-wide">
        政务
      </div>

      <div className="px-2 py-1.5 text-[10px] text-stone-500 border-b border-stone-900 leading-snug">
        {isPlayerCity
          ? `当前城：${selected!.name}（内政请用右侧）`
          : selected
            ? `已选：${selected.name}`
            : '先选己方城，再在右侧做内政/军事'}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        <AccSection
          title="战役"
          badge={armyCount}
          accent="amber"
          open={open === 'campaign'}
          onToggle={() => toggle('campaign')}
        >
          <CampaignPanel />
        </AccSection>

        <AccSection
          title="谍报"
          accent="sky"
          open={open === 'intel'}
          onToggle={() => toggle('intel')}
        >
          <SpyPanel />
        </AccSection>

        <AccSection
          title="计谋"
          accent="amber"
          open={open === 'plot'}
          onToggle={() => toggle('plot')}
        >
          <PlotPanel />
        </AccSection>

        <AccSection
          title="总军师"
          accent="amber"
          open={open === 'strategist'}
          onToggle={() => toggle('strategist')}
        >
          <div className="px-2 py-1">
            <GrandStrategistPanel />
          </div>
        </AccSection>

        <AccSection
          title="家族"
          badge={familyCount}
          accent="amber"
          open={open === 'family'}
          onToggle={() => toggle('family')}
        >
          <FamilyPanel />
        </AccSection>

        <AccSection
          title="人事"
          badge={beautyStock > 0 ? `美${beautyStock}` : undefined}
          accent="rose"
          open={open === 'personnel'}
          onToggle={() => toggle('personnel')}
        >
          <div className="px-3 py-1 text-[10px] text-rose-400/80 font-medium">
            武将名册
          </div>
          <OfficerRosterPanel />
          <div className="border-t border-stone-800 mt-0.5 pt-0.5">
            <div className="px-3 py-1 text-[10px] text-rose-400/80 font-medium">
              搜索与登用
            </div>
          <PersonnelPanel />
          </div>
          <div className="border-t border-stone-800 mt-0.5 pt-0.5">
            <div className="px-3 py-1 text-[10px] text-rose-400/80 font-medium">
              任命
            </div>
            <AppointPanel />
          </div>
          <div className="border-t border-stone-800 mt-0.5 pt-0.5">
            <div className="px-3 py-1 text-[10px] text-rose-400/80 font-medium">
              美女资源
            </div>
            <BeautyPanel />
          </div>
        </AccSection>

        <AccSection
          title="外交"
          accent="sky"
          open={open === 'diplomacy'}
          onToggle={() => toggle('diplomacy')}
        >
          <p className="px-3 py-1 text-[10px] text-stone-600 leading-snug">
            进贡抬友好；<strong className="text-rose-400/80">献美</strong>
            耗美女库存+友好；献美后可<strong className="text-pink-400/80">点化</strong>
            为女间谍；友好≥30 可结盟。库存 {beautyStock}。
          </p>
          <div className="px-2 space-y-1.5 pb-1">
            {Object.values(game.factions)
              .filter((f) => f.id !== game.playerFactionId && f.isAlive)
              .map((f) => {
                const link = findDiplomacy(
                  game.diplomacy,
                  game.playerFactionId,
                  f.id,
                );
                const rel = (link?.relation as string) ?? 'neutral';
                const fav = link?.favorability ?? 0;
                const atWar = rel === 'war';
                const plantable =
                  game.intel?.plantableBeauty?.[f.id] ?? 0;
                const alliance =
                  !atWar && rel !== 'allied'
                    ? calculateAllianceChance(game, f.id)
                    : null;
                return (
                  <div
                    key={f.id}
                    className="rounded border border-stone-800 bg-stone-900/60 px-2 py-1.5"
                    data-testid={`dip-faction-${f.id}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-stone-200 font-medium">{f.name}</span>
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: f.color }}
                      />
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">
                      {REL_LABEL[rel] ?? rel} · 友好 {fav}
                      {alliance
                        ? ` · 结盟率 ${Math.round(alliance.chance)}%`
                        : ''}
                      {plantable > 0 ? ` · 可点化${plantable}` : ''}
                    </div>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      <button
                        type="button"
                        disabled={loading}
                        className="flex-1 min-w-[3.5rem] px-1.5 py-1 rounded border border-amber-900/60 text-[10px] text-amber-100 hover:bg-amber-950 disabled:opacity-40"
                        title="200金，友好+15"
                        onClick={() => void tribute(f.id)}
                      >
                        进贡
                      </button>
                      <button
                        type="button"
                        data-testid={`btn-gift-beauty-${f.id}`}
                        disabled={loading || beautyStock < 1 || atWar}
                        className="flex-1 min-w-[3.5rem] px-1.5 py-1 rounded border border-rose-900/60 text-[10px] text-rose-100 hover:bg-rose-950 disabled:opacity-40"
                        title="献美×1：友好+12，需美女库存≥1"
                        onClick={() => void giftBeautyDip(f.id, 1)}
                      >
                        献美
                      </button>
                      <button
                        type="button"
                        data-testid={`btn-plant-female-${f.id}`}
                        disabled={loading || plantable < 1}
                        className="flex-1 min-w-[3.5rem] px-1.5 py-1 rounded border border-pink-900/60 text-[10px] text-pink-100 hover:bg-pink-950 disabled:opacity-40"
                        title="点化女间谍：需先献美，耗金80"
                        onClick={() => void plantFemale(f.id)}
                      >
                        点化
                      </button>
                      <button
                        type="button"
                        disabled={loading || rel === 'allied'}
                        className="flex-1 min-w-[3.5rem] px-1.5 py-1 rounded border border-sky-900/60 text-[10px] text-sky-100 hover:bg-sky-950 disabled:opacity-40"
                        title={
                          alliance
                            ? `500金，友好≥30；使者魅力${alliance.envoyCharisma}，成功率${Math.round(alliance.chance)}%`
                            : '500金，友好≥30'
                        }
                        onClick={() => void formAlliance(f.id)}
                      >
                        {rel === 'allied' ? '已同盟' : '结盟'}
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </AccSection>

        <AccSection
          title="君主"
          open={open === 'monarch'}
          onToggle={() => toggle('monarch')}
        >
          <MenuBtn
            label="结束回合"
            hint="收获+AI"
            disabled={loading}
            onClick={() => void endTurn()}
            emphasize
          />
        </AccSection>

        <AccSection
          title="己方城池"
          badge={playerCities.length}
          accent="emerald"
          open={open === 'cities'}
          onToggle={() => toggle('cities')}
        >
          <div className="px-2 flex flex-col gap-0.5 max-h-56 overflow-y-auto">
            {playerCities.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`text-left px-2 py-1.5 rounded border text-[11px] ${
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
              </button>
            ))}
          </div>
        </AccSection>
      </div>
    </aside>
  );
}

function MenuBtn({
  label,
  hint,
  disabled,
  onClick,
  emphasize,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onClick?: () => void;
  emphasize?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 border-b border-stone-900/80 ${
        disabled
          ? 'text-stone-600 cursor-not-allowed'
          : emphasize
            ? 'text-amber-200 hover:bg-amber-950/40'
            : 'text-stone-300 hover:bg-stone-900'
      }`}
      title={hint}
    >
      {label}
      {hint && <span className="text-stone-600 ml-1 text-[10px]">{hint}</span>}
    </button>
  );
}
