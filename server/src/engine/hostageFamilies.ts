// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  FAMILY_KINDNESS_CITY_MORALE,
  FAMILY_KINDNESS_DURATION_QUARTERS,
  FAMILY_KINDNESS_MORALE_PER_QUARTER,
  FAMILY_REPRESSION_CITY_MORALE,
  FAMILY_TREATMENT_MODES,
  familyTreatmentQuarterKey,
  type FamilyTreatmentMode,
  type FamilyTreatmentState,
  type GameState,
} from '@leh/shared';

const TREATMENT_LABEL: Record<FamilyTreatmentMode, string> = {
  kindness: '善待',
  neutral: '中立',
  repression: '镇压',
};

function pushLog(state: GameState, type: string, message: string): GameState {
  return {
    ...state,
    actionLog: [
      { year: state.currentYear, month: state.currentMonth, type, message },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

/** 结算玩家攻城后的家属处置选择。待决项由战后结算生成，城市是唯一状态载体。 */
export function resolveFamilyTreatment(
  state: GameState,
  mode: FamilyTreatmentMode,
): GameState {
  if (!FAMILY_TREATMENT_MODES.includes(mode)) throw new Error('无效的家属处置方式');
  const pending = state.pendingFamilyTreatment;
  if (!pending) throw new Error('当前没有待处置的家属');

  const city = state.cities[pending.cityId];
  if (!city || city.ruler !== state.playerFactionId) {
    throw new Error('待处置家属所在城已不归玩家控制');
  }

  const startedQuarter = familyTreatmentQuarterKey(state.currentYear, state.currentMonth);
  const treatment: FamilyTreatmentState = {
    mode,
    previousFactionId: pending.previousFactionId,
    startedQuarter,
    affectedCityIds: [...pending.affectedCityIds],
    ...(mode === 'kindness'
      ? { expiresQuarter: startedQuarter + FAMILY_KINDNESS_DURATION_QUARTERS }
      : {}),
  };

  let publicMorale = city.stats.morale ?? 70;
  if (mode === 'kindness') publicMorale += FAMILY_KINDNESS_CITY_MORALE;
  if (mode === 'repression') publicMorale -= FAMILY_REPRESSION_CITY_MORALE;

  const next: GameState = {
    ...state,
    cities: {
      ...state.cities,
      [city.id]: {
        ...city,
        familyTreatment: treatment,
        stats: { ...city.stats, morale: Math.max(0, Math.min(100, publicMorale)) },
      },
    },
    pendingFamilyTreatment: null,
  };

  const effect =
    mode === 'kindness'
      ? `民心+${FAMILY_KINDNESS_CITY_MORALE}，相关旧主部队每季士气−${FAMILY_KINDNESS_MORALE_PER_QUARTER}`
      : mode === 'repression'
        ? `民心−${FAMILY_REPRESSION_CITY_MORALE}，相关旧主攻城战力+10%`
        : '保留已发生的家属冲击';
  return pushLog(next, 'family_treatment', `${city.name}家属处置：${TREATMENT_LABEL[mode]}（${effect}）`);
}

/** 季度结算善待余波；镇压持续到该城再次易手，中立不产生后续 tick。 */
export function tickFamilyTreatment(state: GameState): GameState {
  const quarter = familyTreatmentQuarterKey(state.currentYear, state.currentMonth);
  let cities = state.cities;
  const notes: string[] = [];

  for (const city of Object.values(state.cities)) {
    const treatment = city.familyTreatment;
    if (!treatment) continue;

    if (city.ruler === treatment.previousFactionId) {
      if (cities === state.cities) cities = { ...state.cities };
      const { familyTreatment: _cleared, ...withoutTreatment } = city;
      cities[city.id] = withoutTreatment;
      notes.push(`${city.name}重新归还旧主，家属处置状态清除`);
      continue;
    }

    if (
      treatment.mode === 'kindness' &&
      treatment.expiresQuarter != null &&
      quarter > treatment.expiresQuarter
    ) {
      if (cities === state.cities) cities = { ...state.cities };
      const { familyTreatment: _cleared, ...withoutTreatment } = city;
      cities[city.id] = withoutTreatment;
      notes.push(`${city.name}善待家属的三季余波结束`);
      continue;
    }

    if (
      treatment.mode !== 'kindness' ||
      treatment.expiresQuarter == null ||
      quarter <= treatment.startedQuarter ||
      quarter > treatment.expiresQuarter
    ) {
      continue;
    }

    let affected = 0;
    const nextCities = cities === state.cities ? { ...state.cities } : cities;
    for (const affectedCityId of treatment.affectedCityIds) {
      const affectedCity = nextCities[affectedCityId];
      if (!affectedCity || affectedCity.ruler !== treatment.previousFactionId) continue;
      nextCities[affectedCityId] = {
        ...affectedCity,
        troopsMorale: Math.max(
          0,
          (affectedCity.troopsMorale ?? 70) - FAMILY_KINDNESS_MORALE_PER_QUARTER,
        ),
      };
      affected++;
    }
    cities = nextCities;
    if (affected > 0) {
      notes.push(`${city.name}善待余波生效，${affected} 城旧主部队士气−${FAMILY_KINDNESS_MORALE_PER_QUARTER}`);
    }
  }

  if (cities === state.cities || notes.length === 0) return state;
  let next = { ...state, cities };
  for (const note of notes) next = pushLog(next, 'family_treatment_tick', note);
  return next;
}
