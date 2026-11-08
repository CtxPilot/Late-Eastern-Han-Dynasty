// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S11/S12 任命 Demo：三轨官职（0-A 精简枚举）
 * 规则见 04§3.4 / §九；门槛与标签真源 shared/positions.ts
 */
import {
  CivilPosition,
  HegemonyPosition,
  LocalPosition,
  MilitaryPosition,
  OfficerStatus,
  formatReq,
  meetsPositionReq,
  meritLevelFor,
  syncMerit,
  isKingdomPosition,
  positionLabel,
  CIVIL_REQ,
  HEGEMONY_REQ,
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
  if (track === 'military') return MILITARY_REQ[position as MilitaryPosition] ?? null;
  return HEGEMONY_REQ[position as HegemonyPosition] ?? null;
}

function isValidPosition(track: PositionTrack, position: string): boolean {
  if (position === 'none') return true;
  if (track === 'civil') return Object.values(CivilPosition).includes(position as CivilPosition);
  if (track === 'local') return Object.values(LocalPosition).includes(position as LocalPosition);
  if (track === 'military') return Object.values(MilitaryPosition).includes(position as MilitaryPosition);
  return Object.values(HegemonyPosition).includes(position as HegemonyPosition);
}

function clearExclusive(
  state: GameState,
  officers: GameState['officers'],
  factionId: number,
  track: PositionTrack,
  position: string,
  cityId: number | undefined,
  exceptOfficerId: number,
  req: PositionReq | null,
): GameState['officers'] {
  const next = { ...officers };
  const targetCity = cityId != null ? state.cities[cityId] : undefined;
  for (const o of Object.values(officers)) {
    if (o.id === exceptOfficerId) continue;
    if (o.faction !== factionId) continue;
    if (o.status !== OfficerStatus.ACTIVE) continue;

    if (track === 'civil' && o.civilPosition === position) {
      if (req?.uniqueFaction) {
        next[o.id] = { ...o, civilPosition: CivilPosition.NONE };
      }
    } else if (track === 'military' && o.militaryPosition === position) {
      if (req?.uniqueFaction) {
        next[o.id] = { ...o, militaryPosition: MilitaryPosition.NONE };
      }
    } else if (track === 'hegemony' && o.hegemonyPosition === position) {
      next[o.id] = { ...o, hegemonyPosition: HegemonyPosition.NONE };
    } else if (track === 'local' && o.localPosition === position) {
      if (req?.uniqueCity) {
        if (cityId != null && o.location === cityId) {
          next[o.id] = { ...o, localPosition: LocalPosition.NONE };
        }
      } else if (req?.uniqueProvince) {
        const officerCity = o.location != null ? state.cities[o.location] : undefined;
        if (targetCity && officerCity && targetCity.province === officerCity.province) {
          next[o.id] = { ...o, localPosition: LocalPosition.NONE };
        }
      } else if (req?.uniqueFaction) {
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
  if (!['civil', 'local', 'military', 'hegemony'].includes(track)) {
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
    if (track === 'hegemony') {
      const stage = state.factions[state.playerFactionId]?.politicalStage ?? 'vassal';
      if (stage === 'vassal') {
        throw new Error('当前势力仍是诸侯，无法任命霸府官职（需先开霸府）');
      }
      if (isKingdomPosition(position) && stage === 'hegemon') {
        throw new Error('当前仅为霸府，无法任命王国官职（需先称王）');
      }
    }
    if (!meetsPositionReq(officer.stats, req)) {
      throw new Error(
        `${officer.name} 属性不足（需 ${formatReq(req)}）`,
      );
    }
    // S12 功绩门槛（docs/04 §十 6.4-3）：与属性门槛分开判定，文案清晰。
    // 君主不参与功绩系统（§3.8/§6.5），任命时豁免功绩门槛（以国力度量，merit 恒 0）。
    const officerIsRuler = state.factions[officer.faction ?? 0]?.rulerId === officer.id;
    const officerMeritLevel = meritLevelFor(officer.merit);
    if (!officerIsRuler && req.meritLevel != null && officerMeritLevel < req.meritLevel) {
      throw new Error(
        `${officer.name} 功绩不足（需功绩Lv${req.meritLevel}，当前Lv${officerMeritLevel}）`,
      );
    }
    // Phase 7-03 九品官人法定品门槛：与属性、功绩门槛分开判定，文案清晰。
    // 君主任命豁免品阶门槛；若武将已有 rankGrade 且官职设定 minRankGrade，必须满足品阶（数值越小品级越高）
    if (!officerIsRuler && req.minRankGrade != null && officer.rankGrade != null && officer.rankGrade > req.minRankGrade) {
      throw new Error(
        `${officer.name} 门阀品阶不足（需${req.minRankGrade}品及以上，当前为${officer.rankGrade}品）`,
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
    if (req.uniqueFaction || req.uniqueCity || req.uniqueProvince) {
      officers = clearExclusive(
        state,
        officers,
        state.playerFactionId,
        track,
        position,
        cityId,
        officerId,
        req,
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
  } else if (track === 'military') {
    if (current.militaryPosition === position) {
      throw new Error('已是该武官职');
    }
    updated.militaryPosition = position as MilitaryPosition;
  } else {
    if (current.hegemonyPosition === position) {
      throw new Error(isKingdomPosition(position) ? '已是该王国官职' : '已是该霸府官职');
    }
    updated.hegemonyPosition = position as HegemonyPosition;
  }

  // 君主特例（docs/04 §3.8 切片 C，Session 265）：任命/解职的忠诚±效果对君主不生效
  const isRuler = state.factions[officer.faction]?.rulerId === officerId;
  if (!isRuler) {
    updated.loyalty = Math.min(
      100,
      Math.max(0, (updated.loyalty ?? 50) + loyaltyDelta),
    );
  }
  // 官职轨道变化 → 同步 meritPath（S12 文武分岔，shared/merit.ts）
  updated = syncMerit(updated);
  officers[officerId] = updated;

  // 官职即时效果与民心/士气/城防增益
  let cities = state.cities;
  if (!isDismiss) {
    if (track === 'local' && cityId != null) {
      const c = cities[cityId];
      if (c) {
        if (position === LocalPosition.PREFECT) {
          // 太守 → 任命城士气 +3
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
        } else if (position === LocalPosition.COMMANDERY_COMMANDANT) {
          // 都尉 → 任命城城墙 +20，驻军士气 +2
          cities = {
            ...cities,
            [cityId]: {
              ...c,
              troopsMorale: Math.min(100, c.troopsMorale + 2),
              stats: {
                ...c.stats,
                wall: Math.min(999, c.stats.wall + 20),
              },
            },
          };
        } else if (position === LocalPosition.COUNTY_MAGISTRATE) {
          // 县令 → 任命城士气 +2
          cities = {
            ...cities,
            [cityId]: {
              ...c,
              stats: {
                ...c.stats,
                morale: Math.min(100, c.stats.morale + 2),
              },
            },
          };
        } else if (position === LocalPosition.PROV_INSPECTOR) {
          // 刺史 → 所在州己方全城士气 +2，驻军士气 +1
          const targetProv = c.province;
          cities = { ...cities };
          for (const item of Object.values(cities)) {
            if (item.ruler === state.playerFactionId && item.province === targetProv) {
              cities[item.id] = {
                ...item,
                troopsMorale: Math.min(100, item.troopsMorale + 1),
                stats: {
                  ...item.stats,
                  morale: Math.min(100, item.stats.morale + 2),
                },
              };
            }
          }
        } else if (position === LocalPosition.PROV_GOVERNOR) {
          // 州牧 → 所在州己方全城士气 +3，驻军士气 +3
          const targetProv = c.province;
          cities = { ...cities };
          for (const item of Object.values(cities)) {
            if (item.ruler === state.playerFactionId && item.province === targetProv) {
              cities[item.id] = {
                ...item,
                troopsMorale: Math.min(100, item.troopsMorale + 3),
                stats: {
                  ...item.stats,
                  morale: Math.min(100, item.stats.morale + 3),
                },
              };
            }
          }
        }
      }
    } else if (track === 'military') {
      if (position === MilitaryPosition.GRAND_GENERAL) {
        // 大将军 → 己方各城士气 +1
        cities = { ...cities };
        for (const item of Object.values(cities)) {
          if (item.ruler === state.playerFactionId) {
            cities[item.id] = {
              ...item,
              stats: {
                ...item.stats,
                morale: Math.min(100, item.stats.morale + 1),
              },
            };
          }
        }
      } else if (position === MilitaryPosition.CHARIOT_CAVALRY_GENERAL) {
        // 车骑/骠骑/卫将军 → 己方各城驻军士气 +2
        cities = { ...cities };
        for (const item of Object.values(cities)) {
          if (item.ruler === state.playerFactionId) {
            cities[item.id] = {
              ...item,
              troopsMorale: Math.min(100, item.troopsMorale + 2),
              stats: {
                ...item.stats,
                morale: Math.min(100, item.stats.morale + 2),
              },
            };
          }
        }
      }
    } else if (track === 'civil') {
      if (position === CivilPosition.SHANGSHU_CHIEF) {
        // 尚书令 → 全国各城士气 +2
        cities = { ...cities };
        for (const item of Object.values(cities)) {
          if (item.ruler === state.playerFactionId) {
            cities[item.id] = {
              ...item,
              stats: {
                ...item.stats,
                morale: Math.min(100, item.stats.morale + 2),
              },
            };
          }
        }
      }
    }
  }

  const label = positionLabel(track, position);
  const trackLabel =
    track === 'civil'
      ? '文官'
      : track === 'local'
        ? '地方'
        : track === 'military'
          ? '武官'
          : isKingdomPosition(isDismiss ? (current.hegemonyPosition ?? '') : position)
            ? '王国'
            : '霸府';
  const msg = isDismiss
    ? `解职 ${updated.name} 的${trackLabel}职（忠诚${loyaltyDelta}）`
    : `任命 ${updated.name} 为${label}（忠诚+${loyaltyDelta}）`;

  return pushLog(
    { ...state, officers, cities },
    'appoint',
    msg,
  );
}
