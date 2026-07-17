// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useState, type ReactNode } from 'react';
import {
  areCitiesRoadAdjacent,
  ensureDemographics,
  foodNeedBreakdown,
  formatEconomyForView,
  formatTroopsForView,
  getCityVisibility,
  maxConscriptable,
  playerCitiesAdjacentTo,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { AccSection } from '../ui/AccSection';

type RightAcc =
  | 'basic'
  | 'population'
  | 'food'
  | 'civil'
  | 'military'
  | 'log'
  | null;

/**
 * 城池详情：按谍报可见性脱敏；侦查在军事操作。
 */
export function RightPanel() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const selectCity = useGameStore((s) => s.selectCity);
  const develop = useGameStore((s) => s.develop);
  const conscript = useGameStore((s) => s.conscript);
  const relief = useGameStore((s) => s.relief);
  const trainTroops = useGameStore((s) => s.trainTroops);
  const seekBeauty = useGameStore((s) => s.seekBeauty);
  const marchOnCity = useGameStore((s) => s.marchOnCity);
  const lastAction = useGameStore((s) => s.lastActionOk);
  const loading = useGameStore((s) => s.loading);
  const error = useGameStore((s) => s.error);
  const [open, setOpen] = useState<RightAcc>(null);

  if (!game) return null;

  const selected = selectedCityId != null ? game.cities[selectedCityId] : null;
  const isPlayerCity = selected != null && selected.ruler === game.playerFactionId;
  const canAct = isPlayerCity && !loading;
  const vis = selected ? getCityVisibility(game, selected.id) : null;
  const seekLeft =
    selected != null && (isPlayerCity || vis?.showEconomy)
      ? (selected.beautySeekLeft ?? 0)
      : null;
  const playerBeauty = game.factions[game.playerFactionId]?.beautyStock ?? 0;
  const canSeekBeauty =
    canAct && (selected?.beautySeekLeft ?? 0) >= 1 && (selected?.gold ?? 0) >= 60;
  const playerCityIds = Object.values(game.cities)
    .filter((c) => c.ruler === game.playerFactionId)
    .map((c) => c.id);
  const adjacentFrom =
    selected != null ? playerCitiesAdjacentTo(playerCityIds, selected.id) : [];
  const marchFromWithTroops = adjacentFrom.filter(
    (id) => (game.cities[id]?.troops ?? 0) >= 1000,
  );
  const canMarch =
    selected != null &&
    !isPlayerCity &&
    selected.ruler != null &&
    !loading &&
    marchFromWithTroops.length > 0;
  const marchHint = (() => {
    if (!selected || isPlayerCity) return '请选择他方城';
    if (adjacentFrom.length === 0) return '无官道邻接己方城，不可出征';
    if (marchFromWithTroops.length === 0) {
      const names = adjacentFrom.map((id) => game.cities[id]?.name).join('、');
      return `邻接 ${names} 兵力不足（需≥1000）`;
    }
    const names = marchFromWithTroops.map((id) => game.cities[id]?.name).join('、');
    return `可自 ${names} 出征（道路邻接）`;
  })();

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
      className="w-72 shrink-0 border-l border-amber-900/40 bg-stone-950/95 flex flex-col text-sm overflow-hidden"
      data-testid="right-panel"
    >
      <div className="px-3 py-2 border-b border-stone-800 text-amber-500/90 font-semibold tracking-wide">
        城池详情
      </div>

      {!selected ? (
        <div className="p-4 text-stone-500 text-xs leading-relaxed space-y-2">
          <p>点城查看。他方城默认情报不明，需侦查或盟友共享。</p>
          <p className="text-amber-700/80">
            左侧外交可进贡/结盟；结盟后可见盟友城部分信息。
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0" data-testid="city-panel">
          <div className="px-3 py-2 border-b border-stone-900">
            <h2 className="text-lg text-amber-400 font-semibold flex items-center gap-2 flex-wrap">
              {selected.name}
              {isPlayerCity ? (
                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-200 border border-emerald-600">
                  己方
                </span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-600">
                  他方
                </span>
              )}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  vis?.kind === 'fog'
                    ? 'border-stone-700 text-stone-500'
                    : vis?.kind === 'ally'
                      ? 'border-sky-800 text-sky-300'
                      : vis?.kind === 'scouted'
                        ? 'border-amber-800 text-amber-200'
                        : 'border-emerald-800 text-emerald-300'
                }`}
                data-testid="intel-badge"
              >
                {visBadge}
              </span>
            </h2>
            <p className="text-[10px] text-stone-600 mt-0.5">
              点下方大项展开 · 再点可收起
            </p>
          </div>

          <AccSection
            title="基本信息"
            accent="amber"
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
                <Row label="势力美女" value={String(playerBeauty)} />
              )}
              <Row
                label="可寻次数"
                value={
                  seekLeft != null
                    ? String(seekLeft)
                    : vis?.kind === 'fog'
                      ? '???'
                      : String(selected.beautySeekLeft ?? '???')
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
            accent="emerald"
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
                <p className="text-[10px] text-stone-600 py-1 leading-snug">
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
                <p className="text-stone-600 text-[10px] px-1">情报不足</p>
              )}
            </div>
          </AccSection>

          <AccSection
            title="内政操作"
            accent="amber"
            open={open === 'civil'}
            onToggle={() => toggle('civil')}
          >
            <div className="px-2 flex flex-wrap gap-1.5">
              <ActBtn
                testId="btn-develop-farm"
                disabled={!canAct}
                title="100金 → 农业↑"
                onClick={() => void develop('farm')}
              >
                开发农业
              </ActBtn>
              <ActBtn
                testId="btn-develop-commerce"
                disabled={!canAct}
                title="100金 → 商业↑"
                onClick={() => void develop('commerce')}
              >
                开发商业
              </ActBtn>
              <ActBtn
                testId="btn-develop-wall"
                disabled={!canAct}
                title="120金 → 城防↑"
                onClick={() => void develop('wall')}
              >
                修筑城墙
              </ActBtn>
              <ActBtn
                testId="btn-relief"
                disabled={!canAct}
                title="150粮 → 民心↑"
                onClick={() => void relief()}
              >
                施米
              </ActBtn>
              <ActBtn
                testId="btn-seek-beauty"
                disabled={!canSeekBeauty}
                title="60金；成功：势力美女+1、本城可寻−1"
                onClick={() => void seekBeauty()}
              >
                寻访
              </ActBtn>
            </div>
            {!isPlayerCity && (
              <p className="px-3 mt-1 text-[10px] text-stone-600">内政仅己方城可用</p>
            )}
          </AccSection>

          <AccSection
            title="军事操作"
            accent="sky"
            open={open === 'military'}
            onToggle={() => toggle('military')}
          >
            <div className="px-2 flex flex-wrap gap-1.5">
              <ActBtn
                testId="btn-conscript"
                disabled={!canAct}
                title="80金+120粮 → 兵力↑"
                onClick={() => void conscript()}
              >
                征兵
              </ActBtn>
              <ActBtn
                testId="btn-train"
                disabled={!canAct}
                title="60粮 → 士气↑"
                onClick={() => void trainTroops()}
              >
                训练
              </ActBtn>
              <ActBtn
                testId="btn-march"
                disabled={!canMarch}
                danger
                title={marchHint}
                onClick={() => void marchOnCity()}
              >
                出征攻城
              </ActBtn>
            </div>
            {!isPlayerCity && (
              <p className="px-3 mt-1 text-[10px] text-stone-500 leading-snug">
                {marchHint}
                {vis?.kind === 'fog' && (
                  <span className="block text-amber-700/80 mt-0.5">
                    情报未明：左侧「谍报」派密探探秘，或外交结盟共享部分信息。
                  </span>
                )}
                {selected &&
                  !playerCityIds.some((id) => areCitiesRoadAdjacent(id, selected.id)) && (
                    <span className="block text-amber-700/80 mt-0.5">
                      仅道路邻接城可出征/派密探。
                    </span>
                  )}
              </p>
            )}
            <div className="px-2 mt-2">
              <button
                type="button"
                className="px-3 py-1 rounded bg-stone-800 border border-stone-600 text-xs"
                onClick={() => selectCity(null)}
              >
                取消选中
              </button>
            </div>
          </AccSection>

          <AccSection
            title="行动日志"
            open={open === 'log'}
            onToggle={() => toggle('log')}
          >
            <div className="px-2 max-h-40 overflow-y-auto text-[11px] text-stone-500">
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

function ActBtn({
  children,
  onClick,
  disabled,
  title,
  testId,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  testId?: string;
  danger?: boolean;
}) {
  const base = danger
    ? 'bg-red-950 border-red-700 text-red-100 hover:bg-red-900'
    : 'bg-amber-900 border-amber-600 text-amber-100 hover:bg-amber-800';
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      title={title}
      className={`px-2.5 py-1 rounded border text-xs ${
        disabled
          ? 'bg-stone-900 border-stone-700 text-stone-500 cursor-not-allowed'
          : base
      }`}
      onClick={onClick}
    >
      {children}
    </button>
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
