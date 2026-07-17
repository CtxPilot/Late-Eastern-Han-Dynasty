// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { useMemo, useState } from 'react';
import {
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  OfficerStatus,
  CIVIL_LABELS,
  LOCAL_LABELS,
  MILITARY_LABELS,
  CIVIL_REQ,
  LOCAL_REQ,
  MILITARY_REQ,
  formatReq,
  meetsPositionReq,
  type PositionReq,
  type PositionTrack,
} from '@leh/shared';
import { useGameStore } from '../../stores/gameStore';

const CIVIL_OPTS = [
  CivilPosition.CLERK,
  CivilPosition.MAGISTRATE,
  CivilPosition.PREFECT,
  CivilPosition.GOVERNOR,
  CivilPosition.CHANCELLOR,
  CivilPosition.NONE,
];
const LOCAL_OPTS = [
  LocalPosition.INTENDANT,
  LocalPosition.ADVISOR,
  LocalPosition.PREFECT,
  LocalPosition.NONE,
];
const MIL_OPTS = [
  MilitaryPosition.CAPTAIN,
  MilitaryPosition.COLONEL,
  MilitaryPosition.GENERAL,
  MilitaryPosition.GRAND_GENERAL,
  MilitaryPosition.NONE,
];

/**
 * S11/S12 任命：三轨官职（0-A 精简）
 */
export function AppointPanel() {
  const game = useGameStore((s) => s.game);
  const selectedCityId = useGameStore((s) => s.selectedCityId);
  const appointOfficer = useGameStore((s) => s.appointOfficer);
  const loading = useGameStore((s) => s.loading);

  const [officerId, setOfficerId] = useState<number | ''>('');
  const [track, setTrack] = useState<PositionTrack>('military');
  const [position, setPosition] = useState<string>(MilitaryPosition.CAPTAIN);

  const officers = useMemo(() => {
    if (!game) return [];
    return Object.values(game.officers)
      .filter(
        (o) =>
          o.faction === game.playerFactionId && o.status === OfficerStatus.ACTIVE,
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  const playerCities = useMemo(() => {
    if (!game) return [];
    return Object.values(game.cities)
      .filter((c) => c.ruler === game.playerFactionId)
      .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  }, [game]);

  if (!game) return null;

  const officer = officerId !== '' ? game.officers[officerId] : undefined;
  const cityId =
    selectedCityId != null && game.cities[selectedCityId]?.ruler === game.playerFactionId
      ? selectedCityId
      : playerCities[0]?.id;

  const opts: string[] =
    track === 'civil' ? CIVIL_OPTS : track === 'local' ? LOCAL_OPTS : MIL_OPTS;
  const labels: Record<string, string> =
    track === 'civil'
      ? CIVIL_LABELS
      : track === 'local'
        ? LOCAL_LABELS
        : MILITARY_LABELS;
  const reqMap: Partial<Record<string, PositionReq>> =
    track === 'civil' ? CIVIL_REQ : track === 'local' ? LOCAL_REQ : MILITARY_REQ;
  const req: PositionReq | null =
    position === 'none' ? null : (reqMap[position] ?? null);
  const needsCity = req?.needsCity === true;
  const canMeet =
    officer != null &&
    (position === 'none' || (req != null && meetsPositionReq(officer.stats, req)));
  const atCity =
    !needsCity ||
    (officer != null && cityId != null && officer.location === cityId);

  const currentLabel = officer
    ? track === 'civil'
      ? CIVIL_LABELS[officer.civilPosition]
      : track === 'local'
        ? LOCAL_LABELS[officer.localPosition]
        : MILITARY_LABELS[officer.militaryPosition]
    : '—';

  return (
    <div className="px-2 space-y-2 text-[11px]" data-testid="appoint-panel">
      <p className="text-stone-500 px-1 leading-snug">
        三轨官职可兼任。太守须在目标城；大将军/军师/丞相/都督势力唯一。
      </p>

      <label className="block space-y-0.5">
        <span className="text-stone-400 px-0.5">武将</span>
        <select
          data-testid="appoint-officer"
          className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-stone-200"
          value={officerId === '' ? '' : String(officerId)}
          onChange={(e) =>
            setOfficerId(e.target.value === '' ? '' : Number(e.target.value))
          }
        >
          <option value="">选择…</option>
          {officers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} · 统{o.stats.leadership}/武{o.stats.war}/智
              {o.stats.intelligence}/政{o.stats.politics}
            </option>
          ))}
        </select>
      </label>

      {officer && (
        <div className="text-[10px] text-stone-500 px-0.5">
          现职：文{CIVIL_LABELS[officer.civilPosition]} / 地
          {LOCAL_LABELS[officer.localPosition]} / 武
          {MILITARY_LABELS[officer.militaryPosition]} · 所在
          {officer.location != null
            ? game.cities[officer.location]?.name ?? officer.location
            : '—'}
        </div>
      )}

      <div className="flex gap-1">
        {(
          [
            ['military', '武官'],
            ['local', '地方'],
            ['civil', '文官'],
          ] as const
        ).map(([k, lab]) => (
          <button
            key={k}
            type="button"
            data-testid={`appoint-track-${k}`}
            className={`flex-1 px-1 py-1 rounded border text-[10px] ${
              track === k
                ? 'border-amber-600 bg-amber-950/50 text-amber-100'
                : 'border-stone-700 bg-stone-900 text-stone-400'
            }`}
            onClick={() => {
              setTrack(k);
              setPosition(
                k === 'civil'
                  ? CivilPosition.CLERK
                  : k === 'local'
                    ? LocalPosition.PREFECT
                    : MilitaryPosition.CAPTAIN,
              );
            }}
          >
            {lab}
          </button>
        ))}
      </div>

      <label className="block space-y-0.5">
        <span className="text-stone-400 px-0.5">
          官职（当前轨：{currentLabel}）
        </span>
        <select
          data-testid="appoint-position"
          className="w-full bg-stone-900 border border-stone-700 rounded px-1.5 py-1 text-stone-200"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        >
          {opts.map((p) => (
            <option key={p} value={p}>
              {labels[p] ?? p}
              {p !== 'none' && reqMap[p]
                ? ` · ${formatReq(reqMap[p]!)}`
                : p === 'none'
                  ? ' · 解职'
                  : ''}
            </option>
          ))}
        </select>
      </label>

      {needsCity && (
        <div className="text-[10px] text-stone-500 px-0.5">
          目标城：
          {cityId != null ? game.cities[cityId]?.name : '—'}
          （地图点选己方城）
          {officer && cityId != null && officer.location !== cityId && (
            <span className="text-rose-400/90"> · 武将须在该城</span>
          )}
        </div>
      )}

      <button
        type="button"
        data-testid="btn-appoint"
        disabled={loading || officerId === '' || !canMeet || !atCity}
        className="w-full px-2 py-1.5 rounded border border-amber-800/70 bg-amber-950/40 text-amber-100 disabled:opacity-40"
        onClick={() => {
          if (officerId === '') return;
          void appointOfficer(
            officerId,
            track,
            position,
            needsCity ? cityId : undefined,
          );
        }}
      >
        {position === 'none' ? '解职' : '任命'}
      </button>
    </div>
  );
}
