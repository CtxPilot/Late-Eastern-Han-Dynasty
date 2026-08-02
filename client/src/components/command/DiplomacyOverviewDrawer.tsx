// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useState } from 'react';
import {
  calculateAllianceChance,
  findDiplomacy,
  hegemonyFavorMultiplier,
  type GameState,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { getFactionResourceTotals } from '../../utils/factionResources';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

const RELATION_LABEL: Record<string, string> = {
  war: '交战',
  hostile: '敌对',
  neutral: '中立',
  friendly: '友好',
  allied: '同盟',
};

const RELATION_TONE: Record<string, string> = {
  war: 'border-red-900/70 bg-red-950/30 text-red-200',
  hostile: 'border-orange-900/70 bg-orange-950/25 text-orange-200',
  neutral: 'border-stone-700 bg-stone-900/60 text-stone-300',
  friendly: 'border-emerald-900/70 bg-emerald-950/25 text-emerald-200',
  allied: 'border-sky-900/70 bg-sky-950/25 text-sky-200',
};

export type DiplomacyTargetSummary = {
  factionId: number;
  name: string;
  color: string;
  relation: string;
  relationLabel: string;
  favorability: number;
  rulerName: string;
  capitalName: string;
  cityCount: number;
  troops: number;
};

export function selectDiplomacyTargets(game: GameState): DiplomacyTargetSummary[] {
  return Object.values(game.factions)
    .filter((faction) => faction.id !== game.playerFactionId && faction.isAlive)
    .map((faction) => {
      const link = findDiplomacy(game.diplomacy, game.playerFactionId, faction.id);
      const relation = String(link?.relation ?? 'neutral');
      const resources = getFactionResourceTotals(game, faction.id);
      return {
        factionId: faction.id,
        name: faction.name,
        color: faction.color,
        relation,
        relationLabel: RELATION_LABEL[relation] ?? relation,
        favorability: link?.favorability ?? 0,
        rulerName: game.officers[faction.rulerId]?.name ?? '未知',
        capitalName: game.cities[faction.capitalCityId]?.name ?? faction.headquartersLabel ?? '未知',
        cityCount: resources.cityCount,
        troops: resources.troops,
      };
    })
    .sort((a, b) => a.factionId - b.factionId);
}

export function DiplomacyOverviewDrawer() {
  const game = useGameStore((state) => state.game);
  const tribute = useGameStore((state) => state.tribute);
  const transferCourtNetwork = useGameStore((state) => state.transferCourtNetwork);
  const formAlliance = useGameStore((state) => state.formAlliance);
  const clearError = useGameStore((state) => state.clearError);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const targets = useMemo(() => game ? selectDiplomacyTargets(game) : [], [game]);
  const [selectedFactionId, setSelectedFactionId] = useState<number | null>(null);
  const [facet, setFacet] = useState<'factions' | 'negotiation' | 'treaty'>('factions');
  const [confirm, setConfirm] = useState<'tribute' | 'court-network' | 'alliance' | null>(null);

  useEffect(() => {
    if (targets.length === 0) {
      setSelectedFactionId(null);
      return;
    }
    if (!targets.some((target) => target.factionId === selectedFactionId)) {
      setSelectedFactionId(targets[0].factionId);
    }
  }, [selectedFactionId, targets]);

  if (!game) return <p data-testid="command-diplomacy-empty">尚未载入剧本。</p>;
  const selected = targets.find((target) => target.factionId === selectedFactionId) ?? targets[0];
  const self = game.factions[game.playerFactionId];
  const resources = getFactionResourceTotals(game, game.playerFactionId);
  const favorMultiplier = hegemonyFavorMultiplier(self?.politicalStage);
  const tributeGain = Math.round(15 * favorMultiplier);
  const giftGain = Math.round(12 * favorMultiplier);
  const tributeReason = resources.gold < 200
    ? `金钱不足（需200，当前${resources.gold}）。`
    : null;
  const giftReason = !selected
    ? '没有可交涉的目标势力。'
    : selected.relation === 'war'
      ? '双方已经交战，不能牵线。'
      : (self?.courtNetwork ?? 0) < 1
        ? '宫廷人脉不足（需1）。'
        : null;
  const allianceReason = !selected
    ? '没有可缔盟的目标势力。'
    : selected.relation === 'war'
      ? '交战中不可结盟。'
      : selected.relation === 'allied'
        ? '双方已经是同盟。'
        : selected.favorability < 30
          ? `友好不足（需≥30，当前${selected.favorability}）。`
          : resources.gold < 500
            ? `金钱不足（需500，当前${resources.gold}）。`
            : null;
  const allianceChance = selected && allianceReason == null
    ? calculateAllianceChance(game, selected.factionId)
    : null;
  const validateConfirm = () => {
    const latest = useGameStore.getState().game;
    if (!latest || !selected || !confirm) return '外交草稿已失效，请返回修改。';
    const target = latest.factions[selected.factionId];
    if (!target?.isAlive) return '目标势力已不存在或已经灭亡。';
    const latestResources = getFactionResourceTotals(latest, latest.playerFactionId);
    if (confirm === 'tribute' && latestResources.gold < 200) {
      return `金钱不足（需200，当前${latestResources.gold}）。`;
    }
    if (confirm === 'court-network') {
      const relation = String(
        findDiplomacy(latest.diplomacy, latest.playerFactionId, target.id)?.relation ?? 'neutral',
      );
      if (relation === 'war') return '双方已经交战，不能牵线。';
      if ((latest.factions[latest.playerFactionId]?.courtNetwork ?? 0) < 1) {
        return '宫廷人脉不足（需1）。';
      }
    }
    if (confirm === 'alliance') {
      const link = findDiplomacy(latest.diplomacy, latest.playerFactionId, target.id);
      const relation = String(link?.relation ?? 'neutral');
      if (relation === 'war') return '交战中不可结盟。';
      if (relation === 'allied') return '双方已经是同盟。';
      if ((link?.favorability ?? 0) < 30) {
        return `友好不足（需≥30，当前${link?.favorability ?? 0}）。`;
      }
      if (latestResources.gold < 500) return `金钱不足（需500，当前${latestResources.gold}）。`;
    }
    return null;
  };

  return (
    <div
      className="flex h-[min(34rem,calc(100vh-12rem))] min-h-0 flex-1 flex-col"
      data-testid="command-diplomacy-drawer"
    >
      <nav className="mb-3 grid grid-cols-3 gap-1" aria-label="外交分面">
        <button
          type="button"
          data-testid="command-diplomacy-facet-factions"
          aria-current={facet === 'factions' ? 'page' : undefined}
          onClick={() => setFacet('factions')}
          className={`border py-1.5 ${facet === 'factions' ? 'border-amber-700 bg-amber-950/50 text-amber-100' : 'border-stone-800 text-stone-400'}`}
        >
          势力
        </button>
        <button
          type="button"
          data-testid="command-diplomacy-facet-negotiation"
          aria-current={facet === 'negotiation' ? 'page' : undefined}
          onClick={() => setFacet('negotiation')}
          className={`border py-1.5 ${facet === 'negotiation' ? 'border-amber-700 bg-amber-950/50 text-amber-100' : 'border-stone-800 text-stone-400'}`}
        >
          交涉
        </button>
        <button
          type="button"
          data-testid="command-diplomacy-facet-treaty"
          aria-current={facet === 'treaty' ? 'page' : undefined}
          onClick={() => setFacet('treaty')}
          className={`border py-1.5 ${facet === 'treaty' ? 'border-amber-700 bg-amber-950/50 text-amber-100' : 'border-stone-800 text-stone-400'}`}
        >
          盟约
        </button>
      </nav>

      <p className="mb-2 text-[10px] leading-relaxed text-stone-500">
        {facet === 'factions'
          ? '选择势力查看当前权威关系摘要。'
          : facet === 'negotiation'
            ? '进贡与宫廷牵线从此处送交统一终审；人脉掩护归情报域。'
            : '结盟无论成败均消耗金500和一次权威外交判定。'}
      </p>

      {selected ? (
        <>
          <label className="mb-2 text-[10px] text-stone-500" htmlFor="command-diplomacy-target">
            目标势力
          </label>
          <select
            id="command-diplomacy-target"
            data-testid="command-diplomacy-target"
            value={selected.factionId}
            onChange={(event) => setSelectedFactionId(Number(event.target.value))}
            className="mb-3 border border-stone-700 bg-stone-900 px-2 py-1.5 text-stone-200 outline-none focus:border-amber-600"
          >
            {targets.map((target) => (
              <option key={target.factionId} value={target.factionId}>
                {target.name} · {target.relationLabel} · 友好 {target.favorability}
              </option>
            ))}
          </select>

          {facet === 'factions' ? <section
            data-testid={`command-diplomacy-summary-${selected.factionId}`}
            className="border border-stone-800 bg-stone-900/60 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: selected.color }} />
                <strong className="text-sm text-stone-100">{selected.name}</strong>
              </div>
              <span className={`border px-2 py-0.5 text-[10px] ${RELATION_TONE[selected.relation] ?? RELATION_TONE.neutral}`}>
                {selected.relationLabel}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="border border-stone-800/80 bg-stone-950/40 px-2 py-1.5">
                <span className="text-stone-500">友好</span>
                <strong className="float-right text-amber-200">{selected.favorability}</strong>
              </div>
              <div className="border border-stone-800/80 bg-stone-950/40 px-2 py-1.5">
                <span className="text-stone-500">君主</span>
                <strong className="float-right text-stone-200">{selected.rulerName}</strong>
              </div>
              <div className="border border-stone-800/80 bg-stone-950/40 px-2 py-1.5">
                <span className="text-stone-500">都城</span>
                <strong className="float-right text-stone-200">{selected.capitalName}</strong>
              </div>
              <div className="border border-stone-800/80 bg-stone-950/40 px-2 py-1.5">
                <span className="text-stone-500">领土</span>
                <strong className="float-right text-stone-200">{selected.cityCount} 城</strong>
              </div>
            </div>
            <div className="mt-2 text-right text-[10px] text-stone-500">
              已知总兵力 {selected.troops.toLocaleString('zh-CN')}
            </div>
          </section> : facet === 'negotiation' ? (
            <section className="space-y-2" data-testid="command-diplomacy-negotiation">
              <div className="border border-stone-800 bg-stone-900/60 px-3 py-2">
                <div className="flex items-center justify-between">
                  <strong className="text-stone-100">{selected.name}</strong>
                  <span className="text-[10px] text-stone-500">{selected.relationLabel} · 友好 {selected.favorability}</span>
                </div>
                <p className="mt-1 text-[10px] text-stone-500">
                  己方总金 {resources.gold} · 宫廷人脉 {self?.courtNetwork ?? 0}
                </p>
              </div>
              <article className="border border-amber-900/50 bg-amber-950/15 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-amber-200">进贡</h3>
                    <p className="mt-1 text-[10px] text-stone-500">消耗金200，友好 +{tributeGain}</p>
                  </div>
                  <button
                    type="button"
                    data-testid="command-diplomacy-tribute"
                    disabled={loading || tributeReason != null}
                    title={tributeReason ?? '送交统一终审'}
                    onClick={() => {
                      clearError();
                      setConfirm('tribute');
                    }}
                    className="border border-amber-800 bg-amber-950/40 px-3 py-1.5 text-amber-100 disabled:opacity-40"
                  >
                    进贡
                  </button>
                </div>
                {tributeReason ? <p className="mt-1 text-[10px] text-red-300" data-testid="command-diplomacy-tribute-reason">{tributeReason}</p> : null}
              </article>
              <article className="border border-rose-900/50 bg-rose-950/15 px-3 py-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-rose-200">宫廷牵线</h3>
                    <p className="mt-1 text-[10px] text-stone-500">转移库存1，友好 +{giftGain}，积累点化额度1</p>
                  </div>
                  <button
                    type="button"
                    data-testid="command-diplomacy-court-network"
                    disabled={loading || giftReason != null}
                    title={giftReason ?? '送交统一终审'}
                    onClick={() => {
                      clearError();
                      setConfirm('court-network');
                    }}
                    className="border border-rose-800 bg-rose-950/40 px-3 py-1.5 text-rose-100 disabled:opacity-40"
                  >
                    牵线
                  </button>
                </div>
                {giftReason ? <p className="mt-1 text-[10px] text-red-300" data-testid="command-diplomacy-gift-reason">{giftReason}</p> : null}
              </article>
            </section>
          ) : (
            <section className="space-y-2" data-testid="command-diplomacy-treaty">
              <div className="border border-stone-800 bg-stone-900/60 px-3 py-2">
                <div className="flex items-center justify-between">
                  <strong className="text-stone-100">{selected.name}</strong>
                  <span className="text-[10px] text-stone-500">{selected.relationLabel} · 友好 {selected.favorability}</span>
                </div>
                <p className="mt-1 text-[10px] text-stone-500">己方总金 {resources.gold}</p>
              </div>
              <article className="border border-sky-900/50 bg-sky-950/15 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sky-200">缔结同盟</h3>
                    <p className="mt-1 text-[10px] text-stone-500">
                      消耗金500 · 友好需≥30
                      {allianceChance ? ` · 当前成功率 ${Math.round(allianceChance.chance)}%` : ''}
                    </p>
                    {allianceChance ? (
                      <p className="mt-1 text-[10px] text-stone-600">
                        使者 {game.officers[allianceChance.envoyId]?.name ?? '未知'} · 魅力 {allianceChance.envoyCharisma}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    data-testid="command-diplomacy-alliance"
                    disabled={loading || allianceReason != null}
                    title={allianceReason ?? '送交统一终审'}
                    onClick={() => {
                      clearError();
                      setConfirm('alliance');
                    }}
                    className="border border-sky-800 bg-sky-950/40 px-3 py-1.5 text-sky-100 disabled:opacity-40"
                  >
                    结盟
                  </button>
                </div>
                {allianceReason ? (
                  <p className="mt-2 text-[10px] text-red-300" data-testid="command-diplomacy-alliance-reason">
                    {allianceReason}
                  </p>
                ) : null}
              </article>
              <p className="text-[10px] leading-relaxed text-stone-600">
                停战、互不侵犯、求援与借道尚未实装，本阶段不提供假入口。
              </p>
            </section>
          )}
        </>
      ) : (
        <p className="border border-stone-800 py-10 text-center text-stone-600" data-testid="command-diplomacy-no-targets">
          当前没有存活的其他势力
        </p>
      )}
      <CommandConfirmDialog
        open={confirm != null && selected != null}
        category="外交"
        command={`${confirm === 'tribute' ? '确认进贡' : confirm === 'court-network' ? '确认宫廷牵线' : '确认结盟'}：${selected?.name ?? '未知势力'}`}
        summary={
          confirm === 'tribute'
            ? '将立即支付金钱以改善双方关系。'
            : confirm === 'court-network'
              ? '将永久转移一份宫廷人脉给目标势力，用于交涉牵线。'
              : '结盟交涉无论成败都会立即消耗金钱，并消费一次外交判定。'
        }
        items={confirm && selected ? [
          { label: '目标势力', value: selected.name },
          {
            label: '立即消耗',
            value: confirm === 'tribute' ? '金 200' : confirm === 'court-network' ? '宫廷人脉 1' : '金 500',
            tone: 'warning',
          },
          {
            label: confirm === 'alliance' ? '成功率' : '主要效果',
            value: confirm === 'tribute'
              ? `友好 +${tributeGain}`
              : confirm === 'court-network'
                ? `友好 +${giftGain}，获得点化额度 1`
                : `${Math.round(calculateAllianceChance(game, selected.factionId).chance)}%`,
          },
          ...(confirm === 'alliance' ? [
            { label: '成功后果', value: '双方关系变为同盟，共享部分城池情报' },
            { label: '失败后果', value: '金钱不返还' },
          ] : []),
        ] : []}
        loading={loading}
        error={error}
        validateBeforeConfirm={validateConfirm}
        fallbackFocusSelector={
          confirm === 'tribute'
            ? "[data-testid='command-diplomacy-tribute']"
            : confirm === 'court-network'
              ? "[data-testid='command-diplomacy-court-network']"
              : "[data-testid='command-diplomacy-alliance']"
        }
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (!selected || !confirm) return;
          if (confirm === 'tribute') await tribute(selected.factionId);
          else if (confirm === 'court-network') await transferCourtNetwork(selected.factionId, 1);
          else await formAlliance(selected.factionId);
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
    </div>
  );
}
