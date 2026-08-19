// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useEffect, useMemo, useState } from 'react';
import {
  Season,
  civilianFarmingFoodProduced,
  maxCivilianFarmingHouseholds,
  militaryFarmingFoodProduced,
  quarterKey,
  FAMILY_RELOCATE_GOLD,
  type City,
  type GameState,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';
import { CommandConfirmDialog } from '../ui/CommandConfirmDialog';

export type FarmingCityRow = {
  cityId: number;
  name: string;
  province: string;
  population: number;
  households: number;
  maxHouseholds: number;
  projectedFood: number;
  assignLocked: boolean;
  militaryFarming: boolean;
  militaryFood: number;
  militaryLocked: boolean;
  garrisonFamilies: number;
  familyBackupCityId: number | null;
  familyLocked: boolean;
};

export function buildFarmingOverview(game: GameState): FarmingCityRow[] {
  const q = quarterKey(game.currentYear, game.currentMonth);
  return Object.values(game.cities)
    .filter((city) => city.ruler === game.playerFactionId)
    .sort((a, b) => a.id - b.id)
    .map((city) => toRow(city, game.season, q));
}

function toRow(city: City, season: Season, currentQuarter: number): FarmingCityRow {
  const households = city.civilianFarmingHouseholds ?? 0;
  const maxHouseholds = maxCivilianFarmingHouseholds(city);
  return {
    cityId: city.id,
    name: city.name,
    province: city.province,
    population: city.population,
    households,
    maxHouseholds,
    projectedFood: civilianFarmingFoodProduced(households, season, city.province),
    assignLocked:
      city.civilianFarmingAssignQuarter != null
      && city.civilianFarmingAssignQuarter === currentQuarter,
    militaryFarming: city.militaryFarming ?? false,
    militaryFood: militaryFarmingFoodProduced(city.troops, city.stats.farm, season),
    militaryLocked:
      city.militaryFarmingAssignQuarter != null
      && city.militaryFarmingAssignQuarter === currentQuarter,
    garrisonFamilies: city.garrisonFamilies ?? 0,
    familyBackupCityId: city.familyBackupCityId ?? null,
    familyLocked:
      city.familyRelocateQuarter != null
      && city.familyRelocateQuarter === currentQuarter,
  };
}

export function FarmingOverviewDrawer() {
  const game = useGameStore((state) => state.game);
  const setCivilianFarming = useGameStore((state) => state.setCivilianFarming);
  const setMilitaryFarming = useGameStore((state) => state.setMilitaryFarming);
  const relocateGarrisonFamilies = useGameStore((state) => state.relocateGarrisonFamilies);
  const loading = useGameStore((state) => state.loading);
  const error = useGameStore((state) => state.error);
  const rows = useMemo(() => (game ? buildFarmingOverview(game) : []), [game]);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);
  const [draftHouseholds, setDraftHouseholds] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [militaryConfirmOpen, setMilitaryConfirmOpen] = useState(false);
  const [familyDestId, setFamilyDestId] = useState<number | null>(null);
  const [familyConfirmOpen, setFamilyConfirmOpen] = useState(false);

  const effectiveCityId = selectedCityId ?? rows[0]?.cityId ?? null;
  const selected = rows.find((row) => row.cityId === effectiveCityId) ?? null;

  useEffect(() => {
    if (selected) setDraftHouseholds(selected.households);
  }, [selected?.cityId, selected?.households]);

  if (!game) return <p data-testid="command-farming-empty">尚未载入剧本。</p>;

  const max = selected?.maxHouseholds ?? 0;
  const locked = selected?.assignLocked ?? false;
  const unchanged = selected != null && draftHouseholds === selected.households;
  const invalid = draftHouseholds < 0 || draftHouseholds > max || !Number.isInteger(draftHouseholds);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3" data-testid="command-farming-drawer">
      <p className="text-[10px] leading-relaxed text-stone-500">
        民屯田与农业开发并行：分配多余人口耕作，月结直接产粮，不花金；占用户口不再计入征兵与农商劳力。
        军屯田：驻军非战时开垦自给，月结产粮；每季士气−3、训练收益减半。均每城每季可调一次。
        质任迁家属：金{FAMILY_RELOCATE_GOLD}，每城每季一次；后方城失陷则前线士气大跌。
      </p>
      {rows.length === 0 ? (
        <p className="border border-stone-800 bg-stone-900/50 px-3 py-3 text-stone-500">无己方城池。</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto" data-testid="command-farming-list">
          {rows.map((row) => (
            <li key={row.cityId}>
              <button
                type="button"
                data-testid={`command-farming-city-${row.cityId}`}
                className={`w-full border px-3 py-2 text-left text-[11px] ${
                  effectiveCityId === row.cityId
                    ? 'border-amber-600 bg-amber-950/40 text-amber-50'
                    : 'border-stone-800 bg-stone-900/60 text-stone-300'
                }`}
                onClick={() => {
                  setSelectedCityId(row.cityId);
                  setDraftHouseholds(row.households);
                }}
              >
                <div className="flex items-center justify-between">
                  <strong>{row.name}</strong>
                  <span className="text-[10px] text-stone-500">{row.province}</span>
                </div>
                <p className="mt-1 text-[10px] text-stone-500">
                  民屯 {row.households}/{row.maxHouseholds} 户 · 估产 {row.projectedFood}/月
                  {row.assignLocked ? ' · 本季已调' : ''}
                </p>
                <p className="mt-1 text-[10px] text-stone-500">
                  军屯 {row.militaryFarming ? '开（估产 ' + row.militaryFood + '/月）' : '关'}
                  {row.militaryLocked ? ' · 本季已调' : ''}
                </p>
                <p className="mt-1 text-[10px] text-stone-500">
                  家属 {row.garrisonFamilies} 口
                  {row.familyBackupCityId != null ? ` · 质任于城${row.familyBackupCityId}` : ''}
                  {row.familyLocked ? ' · 本季已迁' : ''}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected ? (
        <div className="space-y-2 border-t border-stone-800 pt-2" data-testid="command-farming-assign">
          <label className="block text-[10px] text-stone-500">
            分配户数（0～{max}）
            <input
              data-testid="command-farming-households"
              type="number"
              min={0}
              max={max}
              value={draftHouseholds}
              disabled={locked}
              onChange={(event) => setDraftHouseholds(Number(event.target.value))}
              className="mt-1 w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200 disabled:opacity-40"
            />
          </label>
          {locked ? (
            <p className="text-[10px] text-amber-500">本季已调整过该城民屯，下季初再议。</p>
          ) : null}
          {error ? <p className="text-[10px] text-red-400">{error}</p> : null}
          <button
            type="button"
            data-testid="command-farming-submit"
            data-command-write="true"
            disabled={loading || locked || invalid || unchanged}
            className="w-full rounded border border-amber-700 bg-amber-950/50 px-3 py-2 text-amber-100 disabled:opacity-40"
            onClick={() => setConfirmOpen(true)}
          >
            送交终审 · 民屯分配
          </button>
        </div>
      ) : null}

      {selected ? (
        <div className="space-y-2 border-t border-stone-800 pt-2" data-testid="command-farming-military">
          <p className="text-[10px] text-stone-500">
            军屯田：驻军开垦自给，估产 {selected.militaryFood}/月 · 每季士气−3 · 训练收益减半
            {selected.militaryLocked ? '（本季已调）' : ''}
          </p>
          <button
            type="button"
            data-testid="command-military-farming-toggle"
            data-command-write="true"
            disabled={loading || selected.militaryLocked}
            className={`w-full rounded border px-3 py-2 text-amber-100 disabled:opacity-40 ${
              selected.militaryFarming
                ? 'border-stone-700 bg-stone-900/60'
                : 'border-amber-700 bg-amber-950/50'
            }`}
            onClick={() => setMilitaryConfirmOpen(true)}
          >
            {selected.militaryFarming ? '送交终审 · 停办军屯' : '送交终审 · 开启军屯'}
          </button>
        </div>
      ) : null}

      {selected ? (
        <div className="space-y-2 border-t border-stone-800 pt-2" data-testid="command-farming-families">
          <p className="text-[10px] text-stone-500">
            质任迁家属：将该城驻军家属迁往后方（通常为治所）。耗金 {FAMILY_RELOCATE_GOLD}，每季一次。
          </p>
          <select
            data-testid="command-farming-family-dest"
            value={familyDestId ?? ''}
            disabled={loading || selected.familyLocked || selected.garrisonFamilies <= 0}
            onChange={(event) => setFamilyDestId(event.target.value ? Number(event.target.value) : null)}
            className="w-full rounded border border-stone-700 bg-stone-900 px-2 py-2 text-stone-200 disabled:opacity-40"
          >
            <option value="">选择后方城</option>
            {rows.filter((row) => row.cityId !== selected.cityId).map((row) => (
              <option key={row.cityId} value={row.cityId}>{row.name}</option>
            ))}
          </select>
          <button
            type="button"
            data-testid="command-farming-family-submit"
            data-command-write="true"
            disabled={
              loading
              || selected.familyLocked
              || selected.garrisonFamilies <= 0
              || familyDestId == null
            }
            className="w-full rounded border border-amber-700 bg-amber-950/50 px-3 py-2 text-amber-100 disabled:opacity-40"
            onClick={() => setFamilyConfirmOpen(true)}
          >
            送交终审 · 迁家属
          </button>
        </div>
      ) : null}

      <CommandConfirmDialog
        open={confirmOpen}
        category="屯田"
        command={`确认调整 ${selected?.name ?? ''} 民屯为 ${draftHouseholds} 户`}
        summary="民屯不花金；占用户口将降低农商劳力与征兵上限，月结按户数产粮。"
        items={[
          { label: '城池', value: selected?.name ?? '—' },
          { label: '户数', value: `${draftHouseholds} / ${max}` },
          {
            label: '估产',
            value: String(
              selected
                ? civilianFarmingFoodProduced(draftHouseholds, game.season, selected.province)
                : 0,
            ),
          },
        ]}
        loading={loading}
        error={error}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (effectiveCityId == null) return;
          setConfirmOpen(false);
          await setCivilianFarming(effectiveCityId, draftHouseholds);
        }}
      />

      <CommandConfirmDialog
        open={militaryConfirmOpen}
        category="屯田"
        command={`确认${selected?.militaryFarming ? '停办' : '开启'} ${selected?.name ?? ''} 军屯`}
        summary={`驻军${selected?.militaryFarming ? '停垦' : '开垦'}自给：月结产粮约 ${selected?.militaryFood ?? 0}/月；每季士气−3，训练收益减半。非战时方可开屯。`}
        items={[
          { label: '城池', value: selected?.name ?? '—' },
          { label: '驻军', value: String(game.cities[selected?.cityId ?? -1]?.troops ?? 0) },
          { label: '估产/月', value: String(selected?.militaryFood ?? 0) },
        ]}
        loading={loading}
        error={error}
        onCancel={() => setMilitaryConfirmOpen(false)}
        onConfirm={async () => {
          if (effectiveCityId == null) return;
          setMilitaryConfirmOpen(false);
          await setMilitaryFarming(effectiveCityId, !(selected?.militaryFarming ?? false));
        }}
      />

      <CommandConfirmDialog
        open={familyConfirmOpen}
        category="屯田"
        command={`确认将 ${selected?.name ?? ''} 家属迁往 ${rows.find((r) => r.cityId === familyDestId)?.name ?? '—'}`}
        summary={`耗金 ${FAMILY_RELOCATE_GOLD}。前线士气较稳，但后方城若失陷则相关驻军士气−40。`}
        items={[
          { label: '出发城', value: selected?.name ?? '—' },
          { label: '家属', value: String(selected?.garrisonFamilies ?? 0) },
          { label: '后方城', value: rows.find((r) => r.cityId === familyDestId)?.name ?? '—' },
          { label: '耗金', value: String(FAMILY_RELOCATE_GOLD), tone: 'warning' },
        ]}
        loading={loading}
        error={error}
        onCancel={() => setFamilyConfirmOpen(false)}
        onConfirm={async () => {
          if (effectiveCityId == null || familyDestId == null) return;
          setFamilyConfirmOpen(false);
          await relocateGarrisonFamilies(effectiveCityId, familyDestId);
        }}
      />
    </div>
  );
}
