// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useState } from 'react';
import {
  ensureDemographics,
  foodNeedBreakdown,
  formatEconomyForView,
  formatTroopsForView,
  getCityVisibility,
  maxConscriptable,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { AccSection } from '../ui/AccSection';

type RightAcc =
  | 'basic'
  | 'population'
  | 'food'
  | 'log'
  | null;

/** 城池只读详情：按谍报可见性脱敏；所有命令统一由底部命令坞进入。 */
export function RightPanel() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const lastAction = useGameStore((s) => s.lastActionOk);
  const error = useGameStore((s) => s.error);
  const [open, setOpen] = useState<RightAcc>(null);

  if (!game) return null;

  const selected = selectedCityId != null ? game.cities[selectedCityId] : null;
  const isPlayerCity = selected != null && selected.ruler === game.playerFactionId;
  const vis = selected ? getCityVisibility(game, selected.id) : null;
  const seekLeft =
    selected != null && (isPlayerCity || vis?.showEconomy)
      ? (selected.courtNetworkOpportunities ?? 0)
      : null;
  const playerBeauty = game.factions[game.playerFactionId]?.courtNetwork ?? 0;
  const d = selected && vis?.showDemographics ? ensureDemographics(selected) : null;
  const br =
    selected && d && vis?.showDemographics
      ? foodNeedBreakdown(d, selected.troops, game.season)
      : null;
  const canConscript = d ? maxConscriptable(d) : 0;

  const toggle = (k: RightAcc) => setOpen((prev) => (prev === k ? null : k));

  const visBadge =
    vis?.kind === 'own'
      ? '己方·全知'
      : vis?.kind === 'ally'
        ? '盟友·部分'
        : vis?.kind === 'scouted'
          ? '已侦查'
          : '未探明';

  return (
    <aside
      className="w-72 shrink-0 border-l border-amber-900/50 bg-stone-950/98 flex flex-col text-sm overflow-hidden select-none"
      data-testid="right-panel"
    >
      <div className="px-3 py-2 border-b border-stone-800 bg-gradient-to-r from-stone-900/90 to-stone-950 flex items-center justify-between">
        <span className="text-amber-400 font-song font-semibold tracking-wider flex items-center gap-1.5 text-xs">
          <span className="w-1.5 h-3 bg-amber-500 rounded-xs" aria-hidden />
          舆情郡邑
        </span>
        <span className="text-[11px] text-stone-500 font-song">城防图志</span>
      </div>

      {!selected ? (
        <div className="p-4 text-stone-400 text-xs leading-relaxed space-y-3 font-song">
          <p className="border-l-2 border-stone-700 pl-2.5 text-stone-300">
            请点击中央天下战图或左侧城池以巡察郡邑。
          </p>
          <p className="text-amber-600/90 text-[11px]">
            未遣密谍探明之城邑，军民虚实皆隐于迷雾中；经结盟或细作刺探方显其详。
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0" data-testid="city-panel">
          <div className="px-3.5 py-2.5 border-b border-stone-900 bg-stone-900/40">
            <h2 className="text-lg text-amber-300 font-song font-bold flex items-center gap-2 flex-wrap">
              {selected.name}
              {isPlayerCity ? (
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-200 border border-emerald-800 font-song">
                  己方
                </span>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded bg-stone-900 text-stone-400 border border-stone-700 font-song">
                  他方
                </span>
              )}
              <span
                className={`text-xs px-2 py-0.5 rounded border font-song ${
                  vis?.kind === 'fog'
                    ? 'border-stone-700 text-stone-500 bg-stone-900/50'
                    : vis?.kind === 'ally'
                      ? 'border-sky-850 text-sky-300 bg-sky-950/40'
                      : vis?.kind === 'scouted'
                        ? 'border-amber-850 text-amber-200 bg-amber-950/40'
                        : 'border-emerald-850 text-emerald-300 bg-emerald-950/40'
                }`}
                data-testid="intel-badge"
              >
                {visBadge}
              </span>
            </h2>
            <p className="text-[11px] text-stone-500 mt-1 font-song">
              点击下方诸项展开查阅民生、仓廪与兵防
            </p>
          </div>

          <AccSection
            title="基本信息"
            accent="civil"
            open={open === 'basic'}
            onToggle={() => toggle('basic')}
          >
            <div className="px-3 space-y-0.5 text-stone-300 text-xs">
              <Row label="州" value={selected.province} />
              {selected.adminName && selected.adminName !== selected.name && (
                <Row label="郡国" value={selected.adminName} />
              )}
              <Row
                label="势力"
                value={
                  vis?.showFaction
                    ? selected.ruler != null
                      ? game.factions[selected.ruler]?.name ?? '—'
                      : '无主'
                    : '???'
                }
              />
              <Row
                label="金/粮"
                value={
                  vis
                    ? `${formatEconomyForView(selected.gold, vis)} / ${formatEconomyForView(selected.food, vis)}`
                    : '??? / ???'
                }
              />
              {isPlayerCity && (
                <Row label="宫廷人脉" value={String(playerBeauty)} />
              )}
              <Row
                label="人脉机会"
                value={
                  seekLeft != null
                    ? String(seekLeft)
                    : vis?.kind === 'fog'
                      ? '???'
                      : String(selected.courtNetworkOpportunities ?? '???')
                }
              />
              <Row
                label="农/商/城"
                value={
                  vis?.showEconomy
                    ? `${selected.stats.farm}/${selected.stats.commerce}/${
                        vis.showWall ? selected.stats.wall : '???'
                      }`
                    : vis?.showWall
                      ? `???/???/${selected.stats.wall}`
                      : '???/???/???'
                }
              />
              <Row
                label="民心"
                value={
                  vis?.showMorale ? String(selected.stats.morale ?? 70) : '???'
                }
              />
              <Row
                label="兵力"
                value={vis ? formatTroopsForView(selected, vis) : '???'}
              />
              <Row
                label="士气"
                value={
                  vis?.showMorale
                    ? String(selected.troopsMorale ?? 70)
                    : '???'
                }
              />
            </div>
          </AccSection>

          <AccSection
            title="人口结构"
            accent="civil"
            open={open === 'population'}
            onToggle={() => toggle('population')}
          >
            <div className="px-3 space-y-0.5 text-stone-300 text-xs">
              {vis?.showDemographics && d ? (
                <>
                  <Row
                    label="总人口"
                    value={`${selected.population} / ${selected.maxPopulation}`}
                  />
                  <Row label="成年男" value={`${d.adultMale}（耗粮重）`} />
                  <Row label="成年女" value={String(d.adultFemale)} />
                  <Row label="儿童" value={String(d.child)} />
                  <Row label="老人" value={String(d.elder)} />
                  <Row label="可征男丁" value={String(canConscript)} />
                </>
              ) : (
                <p className="text-xs text-stone-600 py-1 leading-snug">
                  人口细目属机密。己方城可见；侦查/盟友不公开户籍。
                </p>
              )}
            </div>
          </AccSection>

          <AccSection
            title="粮耗预估"
            open={open === 'food'}
            onToggle={() => toggle('food')}
          >
            <div className="px-3 space-y-0.5 text-stone-300 text-xs">
              {br && vis?.showDemographics ? (
                <>
                  <Row label="男成耗粮" value={String(br.adultMale)} />
                  <Row
                    label="女成/童/老"
                    value={`${br.adultFemale}/${br.child}/${br.elder}`}
                  />
                  <Row label="驻军耗粮" value={String(br.troops)} />
                  <Row label="合计耗粮" value={String(br.total)} />
                </>
              ) : (
                <p className="text-stone-600 text-xs px-1">情报不足</p>
              )}
            </div>
          </AccSection>

          <AccSection
            title="行动日志"
            open={open === 'log'}
            onToggle={() => toggle('log')}
          >
            <div className="px-2 max-h-40 overflow-y-auto text-xs text-stone-500">
              {game.actionLog.slice(0, 12).map((a, i) => (
                <div
                  key={i}
                  className="leading-snug py-0.5 border-b border-stone-900/50"
                >
                  {a.message}
                </div>
              ))}
            </div>
          </AccSection>

          <div className="px-3 py-2 space-y-1">
            {error && (
              <p className="text-xs text-red-400" data-testid="action-error">
                {error}
              </p>
            )}
            {lastAction && (
              <p className="text-xs text-emerald-400" data-testid="action-feedback">
                {lastAction}
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-stone-800/80 py-0.5">
      <span className="text-stone-500">{label}</span>
      <span className={value === '???' ? 'text-stone-600' : ''}>{value}</span>
    </div>
  );
}
