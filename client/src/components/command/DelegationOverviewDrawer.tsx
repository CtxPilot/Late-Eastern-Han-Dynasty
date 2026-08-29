// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { InkButton } from './../ui/buttons'; // 批次② 三级按钮基座
import { useMemo, useState } from 'react';
import {
  DELEGATION_POLICIES,
  DelegationPolicy,
  delegationPolicyLabel,
  delegationSeasonKey,
  maxDelegationRegions,
  type GameState,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';
import { SealBadge } from '../ui/SealBadge';

/**
 * 命令坞「军团」域：委任区 CRUD（docs/04 §39 + docs/42，Session 420 S1）。
 * 读模型全部由 GameState 派生，无本地缓存；autoRecruit/autoReward 为 0-B 预留置灰。
 */

export function buildDelegationView(game: GameState) {
  const faction = game.factions[game.playerFactionId];
  const regions = faction?.delegationRegions ?? [];
  const ownCities = Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId)
    .sort((a, b) => a.id - b.id);
  const assignedCityIds = new Set(regions.flatMap((region) => region.cityIds));
  const availableCities = ownCities.filter(
    (city) => city.id !== faction?.capitalCityId && !assignedCityIds.has(city.id),
  );
  const governorIds = new Set(regions.map((region) => region.governorId));
  const deployed = new Set(
    game.campaignArmies.flatMap((army) => [
      army.commanderId,
      ...army.subCommanderIds,
      ...(army.advisorId == null ? [] : [army.advisorId]),
      ...(army.subAdvisorId == null ? [] : [army.subAdvisorId]),
    ]),
  );
  const eligibleGovernors = Object.values(game.officers)
    .filter(
      (officer) =>
        officer.faction === game.playerFactionId &&
        officer.id !== faction?.rulerId &&
        officer.status === 'active' &&
        officer.loyalty >= 80 &&
        !deployed.has(officer.id) &&
        !governorIds.has(officer.id) &&
        (String(officer.civilPosition) === 'governor' ||
          String(officer.civilPosition) === 'chancellor' ||
          String(officer.civilPosition) === 'prefect' ||
          String(officer.militaryPosition) === 'general' ||
          String(officer.militaryPosition) === 'grandGeneral'),
    )
    .sort((a, b) => a.id - b.id);
  const rulerRank = String(game.officers[faction?.rulerId ?? 0]?.nobilityRank ?? 'none');
  return { faction, regions, availableCities, eligibleGovernors, rulerRank };
}

export function DelegationOverviewDrawer() {
  const game = useGameStore((state) => state.game);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const createDelegationRegion = useGameStore((state) => state.createDelegationRegion);
  const updateDelegationRegion = useGameStore((state) => state.updateDelegationRegion);
  const assignDelegationCity = useGameStore((state) => state.assignDelegationCity);
  const disbandDelegationRegion = useGameStore((state) => state.disbandDelegationRegion);

  const view = useMemo(() => (game ? buildDelegationView(game) : null), [game]);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [draftCityIds, setDraftCityIds] = useState<number[]>([]);
  const [draftGovernorId, setDraftGovernorId] = useState<number | null>(null);
  const [draftPolicy, setDraftPolicy] = useState<DelegationPolicy>(DelegationPolicy.BALANCED);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | { kind: 'create' } | { kind: 'disband'; regionId: number }>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!game || !view) return <p data-testid="command-delegation-empty">尚未载入剧本。</p>;

  const { regions, availableCities, eligibleGovernors, rulerRank } = view;
  const activeRegion =
    regions.find((region) => region.id === selectedRegionId) ?? regions[0] ?? null;
  const regionCap = maxDelegationRegions(rulerRank, view.faction?.cityIds.length ?? 0);
  const capText = regionCap === Number.POSITIVE_INFINITY ? '∞' : String(regionCap);
  const policyLocked =
    activeRegion != null &&
    activeRegion.policyChangedSeasonKey === delegationSeasonKey(game.currentYear, game.currentMonth);

  const openCreateConfirm = () => {
    if (draftCityIds.length === 0 || draftGovernorId == null) return;
    setActionError(null);
    setPendingAction({ kind: 'create' });
    setConfirmOpen(true);
  };

  const runPending = async () => {
    try {
      if (pendingAction?.kind === 'create') {
        await createDelegationRegion({
          cityIds: draftCityIds,
          governorId: draftGovernorId ?? 0,
          policy: draftPolicy,
        });
        setDraftCityIds([]);
        setDraftGovernorId(null);
      } else if (pendingAction?.kind === 'disband') {
        await disbandDelegationRegion(pendingAction.regionId);
        setSelectedRegionId(null);
      }
      setConfirmOpen(false);
      setPendingAction(null);
    } catch (e) {
      setConfirmOpen(false);
      setPendingAction(null);
      setActionError(e instanceof Error ? e.message : '操作失败');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="command-delegation-drawer">
      <p className="text-xs leading-relaxed text-stone-500">
        委任军团（docs/04 §39）：将城池划区委任都督自动管理，都督按方针经营内政与出征（S2/S3 接入）。
        首都不可委任；一将只任一区都督；方针每季可改一次、下季生效。
        当前委任区上限 {capText}（随爵位与城数成长）。
      </p>

      {regions.length === 0 ? (
        <p className="border border-stone-800 bg-stone-900/50 px-3 py-3 text-stone-500" data-testid="command-delegation-none">
          尚无委任区：选择城池与都督后建立。
        </p>
      ) : (
        <ul className="min-h-0 space-y-2 overflow-y-auto" data-testid="command-delegation-region-list">
          {regions.map((region) => {
            const governor = game.officers[region.governorId];
            return (
              <li key={region.id}>
                <InkButton
                  type="button"
                  data-testid={`command-delegation-region-${region.id}`}
                  onClick={() => setSelectedRegionId(region.id)}
                  className={`w-full border px-3 py-2 text-left text-xs ${
                    activeRegion?.id === region.id
                      ? 'border-amber-600 bg-amber-950/40 text-amber-50'
                      : 'border-stone-800 bg-stone-900/60 text-stone-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <SealBadge char="督" color="military" size={15} />
                      <strong>{region.name}</strong>
                    </span>
                    <span className="text-stone-500">
                      {delegationPolicyLabel(region.policy)}
                      {region.pendingPolicy
                        ? ` → ${delegationPolicyLabel(region.pendingPolicy)}（下季生效）`
                        : ''}
                    </span>
                  </div>
                  <div className="mt-0.5 text-stone-500">
                    都督 {governor?.name ?? '？'} · 辖城 {region.cityIds.length} 座 ·
                    {' '}
                    {region.cityIds.map((id) => game.cities[id]?.name ?? id).join('、')}
                  </div>
                </InkButton>
              </li>
            );
          })}
        </ul>
      )}

      {activeRegion ? (
        <div className="space-y-2 border border-stone-800 bg-stone-900/60 px-3 py-2" data-testid="command-delegation-detail">
          <div className="text-amber-400/80">{activeRegion.name} · 区政</div>
          <div className="text-xs text-stone-400">划入城池（点击划出）：</div>
          <div className="flex flex-wrap gap-1">
            {activeRegion.cityIds.map((cityId) => (
              <InkButton
                key={cityId}
                type="button"
                data-testid={`command-delegation-remove-${cityId}`}
                disabled={loading}
                title="划出该城"
                onClick={() => {
                  setActionError(null);
                  void assignDelegationCity({ regionId: activeRegion.id, cityId, remove: true });
                }}
                className="border border-stone-700 bg-stone-900 px-2 py-0.5 text-xs text-stone-300 hover:border-red-800"
              >
                {game.cities[cityId]?.name ?? cityId} ×
              </InkButton>
            ))}
          </div>
          <div className="text-xs text-stone-400">
            改方针（每季一次，下季生效）{policyLocked ? '——本季已改，按钮锁定' : ''}：
          </div>
          <div className="flex flex-wrap gap-1">
            {DELEGATION_POLICIES.map((policy) => {
              const active = policy === activeRegion.policy;
              const locked = policyLocked && !active;
              return (
                <InkButton
                  key={policy}
                  type="button"
                  data-testid={`command-delegation-policy-${policy}`}
                  disabled={loading || active || locked}
                  title={
                    active
                      ? '当前生效方针'
                      : locked
                        ? '方针本季已切换，下季方可再改'
                        : undefined
                  }
                  onClick={() => {
                    setActionError(null);
                    void updateDelegationRegion({ regionId: activeRegion.id, policy });
                  }}
                  className={`border px-2 py-0.5 text-xs ${
                    active
                      ? 'border-amber-600 text-amber-200'
                      : 'border-stone-700 bg-stone-900 text-stone-300 hover:border-amber-800 disabled:opacity-40'
                  }`}
                >
                  {delegationPolicyLabel(policy)}
                </InkButton>
              );
            })}
          </div>
          <InkButton
            type="button"
            data-testid="command-delegation-disband"
            disabled={loading}
            onClick={() => {
              setActionError(null);
              setPendingAction({ kind: 'disband', regionId: activeRegion.id });
              setConfirmOpen(true);
            }}
            className="border border-red-900 bg-red-950/30 px-2 py-1 text-xs text-red-200"
          >
            解散委任区
          </InkButton>
        </div>
      ) : null}

      <div className="space-y-2 border border-stone-800 bg-stone-900/60 px-3 py-2" data-testid="command-delegation-create">
        <div className="text-amber-400/80">建立新委任区（{regions.length}/{capText}）</div>
        <div className="text-xs text-stone-400">选择直辖城池（首都不可划入）：</div>
        <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
          {availableCities.map((city) => {
            const picked = draftCityIds.includes(city.id);
            return (
              <InkButton
                key={city.id}
                type="button"
                data-testid={`command-delegation-pick-${city.id}`}
                onClick={() =>
                  setDraftCityIds((prev) =>
                    prev.includes(city.id) ? prev.filter((id) => id !== city.id) : [...prev, city.id],
                  )
                }
                className={`border px-2 py-0.5 text-xs ${
                  picked
                    ? 'border-amber-600 bg-amber-950/40 text-amber-100'
                    : 'border-stone-700 bg-stone-900 text-stone-300 hover:border-amber-800'
                }`}
              >
                {city.name}
              </InkButton>
            );
          })}
          {availableCities.length === 0 ? (
            <span className="text-xs text-stone-600">无可用城池</span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-400">都督：</span>
          <select
            data-testid="command-delegation-governor"
            value={draftGovernorId ?? ''}
            onChange={(event) => setDraftGovernorId(event.target.value ? Number(event.target.value) : null)}
            className="border border-stone-700 bg-stone-900 px-2 py-1 text-stone-200"
          >
            <option value="">选择都督…</option>
            {eligibleGovernors.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.name}（统{officer.stats.leadership} 政{officer.stats.politics}）
              </option>
            ))}
          </select>
          <span className="text-stone-400">方针：</span>
          <select
            data-testid="command-delegation-policy-new"
            value={draftPolicy}
            onChange={(event) => setDraftPolicy(event.target.value as DelegationPolicy)}
            className="border border-stone-700 bg-stone-900 px-2 py-1 text-stone-200"
          >
            {DELEGATION_POLICIES.map((policy) => (
              <option key={policy} value={policy}>
                {delegationPolicyLabel(policy)}
              </option>
            ))}
          </select>
        </div>
        <InkButton
          type="button"
          data-testid="command-delegation-create-submit"
          disabled={loading || draftCityIds.length === 0 || draftGovernorId == null}
          onClick={openCreateConfirm}
          className="border border-amber-700 bg-amber-950/40 px-3 py-1 text-xs text-amber-100 disabled:opacity-40"
        >
          建立委任区
        </InkButton>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-600">自动搜录在野 / 自动赏赐：0-B 启用</span>
        </div>
      </div>

      {actionError || error ? (
        <p className="text-xs text-red-400" data-testid="command-delegation-error">
          {actionError ?? error}
        </p>
      ) : null}

      <CommandConfirmDialog
        open={confirmOpen}
        category="军团"
        command={pendingAction?.kind === 'disband' ? '解散委任区' : '建立委任区'}
        summary={
          pendingAction?.kind === 'disband'
            ? '解散后辖区城池回归君主直辖。'
            : `将 ${draftCityIds.length} 座城委任给都督，方针 ${delegationPolicyLabel(draftPolicy)}。`
        }
        items={
          pendingAction?.kind === 'disband'
            ? [{ label: '委任区', value: regions.find((r) => r.id === pendingAction.regionId)?.name ?? '' }]
            : [
                {
                  label: '城池',
                  value: draftCityIds.map((id) => game.cities[id]?.name ?? id).join('、'),
                },
                {
                  label: '都督',
                  value: game.officers[draftGovernorId ?? -1]?.name ?? '？',
                },
                { label: '方针', value: delegationPolicyLabel(draftPolicy) },
              ]
        }
        loading={loading}
        danger={pendingAction?.kind === 'disband'}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingAction(null);
        }}
        onConfirm={() => runPending()}
      />
    </div>
  );
}
