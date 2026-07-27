// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import { OfficerStatus, calculateRecruitChance, type GameState, type Officer } from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

export type RecruitmentAvailability = {
  playerCities: GameState['cities'][number][];
  freeOfficers: Officer[];
  ruler: Officer | null;
  hasSearcher: boolean;
  canPayRecruit: boolean;
};

export function getRecruitmentAvailability(game: GameState): RecruitmentAvailability {
  const playerCities = Object.values(game.cities).filter((city) => city.ruler === game.playerFactionId);
  const freeOfficers = Object.values(game.officers)
    .filter((officer) => officer.faction == null && officer.status === OfficerStatus.FREE)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const rulerId = game.factions[game.playerFactionId]?.rulerId;
  const ruler = rulerId == null ? null : game.officers[rulerId] ?? null;
  const hasSearcher = ruler != null || Object.values(game.officers).some(
    (officer) => officer.faction === game.playerFactionId && officer.status === OfficerStatus.ACTIVE,
  );
  return {
    playerCities,
    freeOfficers,
    ruler,
    hasSearcher,
    canPayRecruit: playerCities.some((city) => city.gold >= 200),
  };
}

function recruitmentFixture(): 'no-executor' | null {
  if (!import.meta.env.DEV) return null;
  return new URLSearchParams(window.location.search).get('cmdP8RecruitmentFixture') === 'no-executor'
    ? 'no-executor'
    : null;
}

type RecruitmentDraft =
  | { type: 'search'; cityId: number }
  | { type: 'recruit'; officerId: number }
  | null;

export function PersonnelRecruitDrawer() {
  const game = useGameStore((state) => state.game);
  const selectedCityId = useGameStore((state) => state.selectedCityId);
  const searchTalent = useGameStore((state) => state.searchTalent);
  const recruitOfficer = useGameStore((state) => state.recruitOfficer);
  const clearError = useGameStore((state) => state.clearError);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const [cityDraft, setCityDraft] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<RecruitmentDraft>(null);

  const availability = useMemo(() => {
    if (!game) return null;
    const actual = getRecruitmentAvailability(game);
    // CMD-P8 浏览器禁用态夹具：只覆盖派生可用性，不改 Zustand/服务端权威状态。
    return recruitmentFixture() === 'no-executor'
      ? { ...actual, ruler: null, hasSearcher: false }
      : actual;
  }, [game]);
  if (!game || !availability) return <p>尚未载入剧本。</p>;

  const preferredCityId =
    selectedCityId != null && game.cities[selectedCityId]?.ruler === game.playerFactionId
      ? selectedCityId
      : game.factions[game.playerFactionId]?.capitalCityId ?? availability.playerCities[0]?.id ?? null;
  const searchCityId =
    cityDraft != null && game.cities[cityDraft]?.ruler === game.playerFactionId
      ? cityDraft
      : preferredCityId;
  const searchCity = searchCityId == null ? null : game.cities[searchCityId] ?? null;
  const searchReason =
    availability.playerCities.length === 0
      ? '无己方城池，无法搜索人才。'
      : !availability.hasSearcher
        ? '无可用搜索武将。'
        : !searchCity || searchCity.gold < 80
          ? `城中金钱不足（需80，当前${searchCity?.gold ?? 0}）。`
          : null;
  const recruitReason =
    availability.freeOfficers.length === 0
      ? '暂无在野武将。可先搜索或等待跟随。'
      : !availability.ruler
        ? '无可用说客。'
        : !availability.canPayRecruit
          ? '没有己方城池能够支付登用所需金200。'
          : null;
  const confirmOfficer =
    confirm?.type === 'recruit' ? game.officers[confirm.officerId] ?? null : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="command-personnel-recruitment">
      <p className="mb-3 border border-stone-800 bg-stone-900/40 px-2 py-2 text-[10px] leading-4 text-stone-500">
        人才搜索耗金80；登用在野男将耗金200。规则、概率与结算继续由原人事 API 权威处理。
      </p>

      <section className="space-y-2 border-b border-stone-800 pb-3">
        <div className="flex items-center justify-between"><h3 className="text-rose-300">搜索人才</h3><span className="text-[10px] text-stone-600">立即结算</span></div>
        <select
          data-testid="command-recruit-search-city"
          value={searchCityId ?? ''}
          onChange={(event) => setCityDraft(Number(event.target.value))}
          className="w-full border border-stone-700 bg-stone-900 px-2 py-1.5 text-stone-300"
        >
          {availability.playerCities.length === 0 ? <option value="">无己方城池</option> : null}
          {availability.playerCities.map((city) => <option key={city.id} value={city.id}>{city.name} · 金{city.gold}</option>)}
        </select>
        {searchReason ? <p data-testid="command-recruit-search-disabled-reason" className="text-[10px] text-red-300">{searchReason}</p> : null}
        <button
          type="button"
          data-testid="command-recruit-search"
          disabled={loading || searchReason != null}
          onClick={() => {
            if (searchCityId == null) return;
            clearError();
            setConfirm({ type: 'search', cityId: searchCityId });
          }}
          className="w-full border border-rose-900/70 bg-rose-950/30 px-2 py-1.5 text-rose-100 disabled:opacity-40"
        >
          搜索人才（80金）
        </button>
      </section>

      <section className="flex min-h-0 flex-1 flex-col pt-3">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-amber-300">在野可登用</h3><span data-testid="command-recruit-free-count" className="text-stone-500">{availability.freeOfficers.length} 人</span></div>
        {recruitReason ? <p data-testid="command-recruit-disabled-reason" className="mb-2 text-[10px] text-red-300">{recruitReason}</p> : null}
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" data-testid="command-recruit-candidates">
          {availability.freeOfficers.map((officer) => {
            const chance = availability.ruler == null ? null : calculateRecruitChance(availability.ruler, officer);
            return (
              <article key={officer.id} className="border border-stone-800 bg-stone-900/50 px-2 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="text-stone-100">{officer.name}</strong>
                    <p className="text-[10px] text-stone-500">
                      {officer.location != null ? game.cities[officer.location]?.name ?? '未知' : '未知'}
                      {' · '}统{officer.stats.leadership}/武{officer.stats.war}/智{officer.stats.intelligence}
                    </p>
                    <p className="text-[10px] text-amber-500">君主说客 · 成功率{chance == null ? '—' : `${Math.round(chance)}%`}</p>
                  </div>
                  <button
                    type="button"
                    data-testid={`command-recruit-officer-${officer.id}`}
                    disabled={loading || recruitReason != null}
                    onClick={() => {
                      clearError();
                      setConfirm({ type: 'recruit', officerId: officer.id });
                    }}
                    className="shrink-0 border border-amber-800 bg-amber-950/40 px-2 py-1 text-amber-100 disabled:opacity-40"
                  >
                    登用
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <CommandConfirmDialog
        open={confirm?.type === 'search'}
        category="人事"
        command={`确认搜索人才：${confirm?.type === 'search' ? game.cities[confirm.cityId]?.name ?? '未选城池' : '未选城池'}`}
        summary="派员访求在野人才或遗落宝物。"
        items={confirm?.type === 'search' ? [
          { label: '执行地', value: game.cities[confirm.cityId]?.name ?? '—' },
          { label: '目标', value: '在野人才／宝物' },
          { label: '立即消耗', value: '金 80' },
          { label: '耗时', value: '立即结算' },
          { label: '可能结果', value: '发现人才、宝物，或无所获' },
        ] : []}
        loading={loading}
        error={error}
        fallbackFocusSelector="[data-testid='command-recruit-search']"
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          if (!latest || confirm?.type !== 'search') return '搜索草稿已失效，请返回修改。';
          if (!getRecruitmentAvailability(latest).hasSearcher) return '无可用搜索武将。';
          const city = latest.cities[confirm.cityId];
          if (!city || city.ruler !== latest.playerFactionId) return '搜索城池已失效，请返回修改。';
          return city.gold < 80 ? `城中金钱不足（需80，当前${city.gold}）。` : null;
        }}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.type !== 'search') return;
          await searchTalent(confirm.cityId);
          if (!useGameStore.getState().error) {
            setConfirm(null);
            setCityDraft(null);
          }
        }}
      />
      <CommandConfirmDialog
        open={confirm?.type === 'recruit'}
        category="人事"
        command={`确认登用：${confirmOfficer?.name ?? '未选武将'}`}
        summary="遣使劝说在野武将归属本势力。"
        items={confirmOfficer ? [
          { label: '执行者', value: availability.ruler?.name ?? '君主府' },
          { label: '目标', value: `${confirmOfficer.name}（${game.cities[confirmOfficer.location ?? -1]?.name ?? '未知'}）` },
          { label: '立即消耗', value: '金 200' },
          { label: '耗时', value: '立即结算' },
          { label: '成功率', value: availability.ruler == null ? '—' : `${Math.round(calculateRecruitChance(availability.ruler, confirmOfficer))}%`, tone: 'warning' },
        ] : []}
        loading={loading}
        error={error}
        fallbackFocusSelector={confirm?.type === 'recruit' ? `[data-testid='command-recruit-officer-${confirm.officerId}']` : undefined}
        validateBeforeConfirm={() => {
          const latest = useGameStore.getState().game;
          if (!latest || confirm?.type !== 'recruit') return '登用草稿已失效，请返回修改。';
          const officer = latest.officers[confirm.officerId];
          if (!officer || officer.faction != null || officer.status !== OfficerStatus.FREE) return '目标已不再是在野可登用状态。';
          const canPay = Object.values(latest.cities).some((city) => city.ruler === latest.playerFactionId && city.gold >= 200);
          return canPay ? null : '没有己方城池能够支付登用所需金200。';
        }}
        onCancel={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm?.type !== 'recruit') return;
          await recruitOfficer(confirm.officerId, availability.ruler?.id);
          if (!useGameStore.getState().error) setConfirm(null);
        }}
      />
    </div>
  );
}
