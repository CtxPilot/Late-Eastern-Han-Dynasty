// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S11/S12 任命 Demo：三轨官职（0-A 精简枚举）
 * 规则见 04§3.4 / §九；门槛与标签真源 shared/positions.ts
 */
import {
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  OfficerStatus,
  formatReq,
  meetsPositionReq,
  positionLabel,
  CIVIL_REQ,
  LOCAL_REQ,
  MILITARY_REQ,
  type GameState,
  type PositionTrack,
  type PositionReq,
} from '@leh/shared';

const LOYALTY_ON_APPOINT = 5;
const LOYALTY_ON_DISMISS = -3;

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<GameState> = {},
): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function getReq(track: PositionTrack, position: string): PositionReq | null {
  if (position === 'none') return null;
  if (track === 'civil') return CIVIL_REQ[position as CivilPosition] ?? null;
  if (track === 'local') return LOCAL_REQ[position as LocalPosition] ?? null;
  return MILITARY_REQ[position as MilitaryPosition] ?? null;
}

function isValidPosition(track: PositionTrack, position: string): boolean {
  if (position === 'none') return true;
  if (track === 'civil') return Object.values(CivilPosition).includes(position as CivilPosition);
  if (track === 'local') return Object.values(LocalPosition).includes(position as LocalPosition);
  return Object.values(MilitaryPosition).includes(position as MilitaryPosition);
}

function clearExclusive(
  officers: GameState['officers'],
  factionId: number,
  track: PositionTrack,
  position: string,
  cityId: number | undefined,
  exceptOfficerId: number,
): GameState['officers'] {
  const next = { ...officers };
  for (const o of Object.values(officers)) {
    if (o.id === exceptOfficerId) continue;
    if (o.faction !== factionId) continue;
    if (o.status !== OfficerStatus.ACTIVE) continue;

    if (track === 'civil' && o.civilPosition === position) {
      next[o.id] = { ...o, civilPosition: CivilPosition.NONE };
    } else if (track === 'military' && o.militaryPosition === position) {
      next[o.id] = { ...o, militaryPosition: MilitaryPosition.NONE };
    } else if (track === 'local' && o.localPosition === position) {
      if (position === LocalPosition.PREFECT) {
        if (cityId != null && o.location === cityId) {
          next[o.id] = { ...o, localPosition: LocalPosition.NONE };
        }
      } else {
        next[o.id] = { ...o, localPosition: LocalPosition.NONE };
      }
    }
  }
  return next;
}

/**
 * 任命 / 解职（position=none）
 * @param cityId 地方官（太守/从事）必填；军师可选
 */
export function appointOfficer(
  state: GameState,
  officerId: number,
  track: PositionTrack,
  position: string,
  cityId?: number,
): GameState {
  if (!['civil', 'local', 'military'].includes(track)) {
    throw new Error('无效官职轨道');
  }
  if (!isValidPosition(track, position)) {
    throw new Error('无效官职');
  }

  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officer.faction !== state.playerFactionId) {
    throw new Error('只能任命己方武将');
  }
  if (officer.status !== OfficerStatus.ACTIVE) {
    throw new Error('武将状态不可任命');
  }

  const isDismiss = position === 'none';
  const req = getReq(track, position);

  if (!isDismiss) {
    if (!req) throw new Error('该官职不可任命');
    if (!meetsPositionReq(officer.stats, req)) {
      throw new Error(
        `${officer.name} 属性不足（需 ${formatReq(req)}）`,
      );
    }
    if (req.needsCity) {
      if (cityId == null) throw new Error('该官职须指定城池');
      const city = state.cities[cityId];
      if (!city || city.ruler !== state.playerFactionId) {
        throw new Error('目标城非己方');
      }
      if (officer.location !== cityId) {
        throw new Error(`${officer.name} 不在 ${city.name}，请先调任同城再任命`);
      }
    }
  }

  let officers = { ...state.officers };

  if (!isDismiss && req) {
    if (req.uniqueFaction || req.uniqueCity) {
      officers = clearExclusive(
        officers,
        state.playerFactionId,
        track,
        position,
        cityId,
        officerId,
      );
    }
  }

  const current = officers[officerId] ?? officer;
  let updated = { ...current };
  let loyaltyDelta = isDismiss ? LOYALTY_ON_DISMISS : LOYALTY_ON_APPOINT;

  if (track === 'civil') {
    if (current.civilPosition === position) {
      throw new Error('已是该文官职');
    }
    updated.civilPosition = position as CivilPosition;
  } else if (track === 'local') {
    if (current.localPosition === position && !req?.needsCity) {
      throw new Error('已是该地方官职');
    }
    updated.localPosition = position as LocalPosition;
    if (!isDismiss && cityId != null) {
      updated.location = cityId;
    }
  } else {
    if (current.militaryPosition === position) {
      throw new Error('已是该武官职');
    }
    updated.militaryPosition = position as MilitaryPosition;
  }

  updated.loyalty = Math.min(
    100,
    Math.max(0, (updated.loyalty ?? 50) + loyaltyDelta),
  );
  officers[officerId] = updated;

  // Demo 效果：太守 → 城士气 +3；大将军 → 己方各城士气 +1
  let cities = state.cities;
  if (!isDismiss && track === 'local' && position === LocalPosition.PREFECT && cityId != null) {
    const c = cities[cityId];
    if (c) {
      cities = {
        ...cities,
        [cityId]: {
          ...c,
          stats: {
            ...c.stats,
            morale: Math.min(100, c.stats.morale + 3),
          },
        },
      };
    }
  }
  if (!isDismiss && track === 'military' && position === MilitaryPosition.GRAND_GENERAL) {
    cities = { ...cities };
    for (const c of Object.values(cities)) {
      if (c.ruler === state.playerFactionId) {
        cities[c.id] = {
          ...c,
          stats: {
            ...c.stats,
            morale: Math.min(100, c.stats.morale + 1),
          },
        };
      }
    }
  }

  const label = positionLabel(track, position);
  const trackLabel =
    track === 'civil' ? '文官' : track === 'local' ? '地方' : '武官';
  const msg = isDismiss
    ? `解职 ${updated.name} 的${trackLabel}职（忠诚${loyaltyDelta}）`
    : `任命 ${updated.name} 为${label}（忠诚+${loyaltyDelta}）`;

  return pushLog(
    { ...state, officers, cities },
    'appoint',
    msg,
  );
}
