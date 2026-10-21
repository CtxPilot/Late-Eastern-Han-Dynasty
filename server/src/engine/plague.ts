// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 城池卫生与疫病闭环引擎（Sanitation & Plague Engine）。
 *
 * 依据 docs/04 §2.1、§23.6、§28.3 与 docs/51-s03-craft-research-and-sanitation-proposal.md。
 * 纯函数确定性推演，零 RNG 漂移。
 */
import {
  type City,
  type GameState,
  type Officer,
  PLAGUE_MONTHS_MILD,
  PLAGUE_MONTHS_SEVERE,
  PLAGUE_MORTALITY_MILD,
  PLAGUE_MORTALITY_SEVERE,
  PLAGUE_OFFICER_STAMINA_DRAIN,
  PLAGUE_TROOPS_MORALE_DRAIN,
  SANITATION_PLAGUE_RISK_THRESHOLD,
  SANITATION_PLAGUE_SEVERE_THRESHOLD,
  Season,
} from '@leh/shared';

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

/** 每月结算城池瘟疫爆发检定与疫区惩罚推演 */
export function tickCityPlagueAndSanitation(state: GameState): GameState {
  const currentSeason =
    state.currentMonth >= 3 && state.currentMonth <= 5
      ? Season.SPRING
      : state.currentMonth >= 6 && state.currentMonth <= 8
        ? Season.SUMMER
        : state.currentMonth >= 9 && state.currentMonth <= 11
          ? Season.AUTUMN
          : Season.WINTER;

  const isWarmHumidSeason = currentSeason === Season.SUMMER || currentSeason === Season.AUTUMN;

  let nextCities = { ...state.cities };
  let nextOfficers = { ...state.officers };
  let nextState: GameState = state;

  for (const [cidStr, city] of Object.entries(state.cities)) {
    const cid = Number(cidStr);
    const sanitation = city.stats.sanitation ?? 0;

    let updatedCity = { ...city };
    let newlyOutbroken = false;

    // ── 1. 瘟疫爆发检定 ──────────────────────────────────────────
    // 仅在夏秋季、人口>10000、明确已产生恶劣卫生数据（sanitation !== undefined 且 <100）且无现有疫病时判定
    if (
      !updatedCity.plague &&
      isWarmHumidSeason &&
      updatedCity.population > 10000 &&
      city.stats.sanitation !== undefined &&
      sanitation < SANITATION_PLAGUE_RISK_THRESHOLD
    ) {
      newlyOutbroken = true;
      if (sanitation < SANITATION_PLAGUE_SEVERE_THRESHOLD) {
        updatedCity.plague = {
          remainingMonths: PLAGUE_MONTHS_SEVERE,
          severity: 'severe',
        };
        nextState = pushLog(
          nextState,
          'city_plague_outbreak',
          `【大疫爆发】${city.name}爆发严重时疫！丁口染疾，征兵停止，驻军与武将深受疫毒侵袭！`,
        );
      } else {
        updatedCity.plague = {
          remainingMonths: PLAGUE_MONTHS_MILD,
          severity: 'mild',
        };
        nextState = pushLog(
          nextState,
          'city_plague_outbreak',
          `【时疫流行】${city.name}时疫流行，民生受困！`,
        );
      }
    }

    // ── 2. 现有疫区惩罚推演与衰减 ────────────────────────────────
    if (updatedCity.plague) {
      const severity = updatedCity.plague.severity;
      const deathRate = severity === 'severe' ? PLAGUE_MORTALITY_SEVERE : PLAGUE_MORTALITY_MILD;

      // 人口超额病殁
      if (updatedCity.demographics && updatedCity.population > 0) {
        const d = updatedCity.demographics;
        const totalDeaths = Math.floor(updatedCity.population * deathRate);
        const maleDie = Math.floor(totalDeaths * 0.3);
        const femaleDie = Math.floor(totalDeaths * 0.27);
        const childDie = Math.floor(totalDeaths * 0.29);
        const elderDie = totalDeaths - maleDie - femaleDie - childDie;

        const nextDemo = {
          adultMale: Math.max(0, d.adultMale - maleDie),
          adultFemale: Math.max(0, d.adultFemale - femaleDie),
          child: Math.max(0, d.child - childDie),
          elder: Math.max(0, d.elder - elderDie),
        };
        const nextPopulation =
          nextDemo.adultMale + nextDemo.adultFemale + nextDemo.child + nextDemo.elder;

        updatedCity.demographics = nextDemo;
        updatedCity.population = nextPopulation;
      }

      // 驻军士气扣除
      updatedCity.troopsMorale = Math.max(
        0,
        (updatedCity.troopsMorale ?? 70) - PLAGUE_TROOPS_MORALE_DRAIN,
      );

      // 城内驻留武将体力扣减
      for (const oid of updatedCity.officers) {
        const off = nextOfficers[oid];
        if (off) {
          nextOfficers[oid] = {
            ...off,
            stamina: Math.max(0, (off.stamina ?? 100) - PLAGUE_OFFICER_STAMINA_DRAIN),
          };
        }
      }

      // 瘟疫持续期衰减（新爆发首月不提前扣减工期）
      const nextRemaining = newlyOutbroken
        ? updatedCity.plague.remainingMonths
        : updatedCity.plague.remainingMonths - 1;
      if (nextRemaining <= 0) {
        delete updatedCity.plague;
        nextState = pushLog(
          nextState,
          'city_plague_ended',
          `【疫气消弭】${city.name}瘟疫渐息，民安疫去。`,
        );
      } else {
        updatedCity.plague = {
          ...updatedCity.plague,
          remainingMonths: nextRemaining,
        };
      }
    }

    nextCities[cid] = updatedCity;
  }

  return {
    ...nextState,
    cities: nextCities,
    officers: nextOfficers,
  };
}

/** 施米赈济时对瘟疫的缓解效应 */
export function relievePlague(
  city: City,
  officers: Record<number, Officer>,
): {
  city: City;
  officers: Record<number, Officer>;
  note: string;
} {
  if (!city.plague) {
    return { city, officers, note: '' };
  }

  const nextRemaining = city.plague.remainingMonths - 1;
  const updatedCity = { ...city };
  let note = '';

  if (nextRemaining <= 0) {
    delete updatedCity.plague;
    note = '，施药抚恤疫疾彻底平息！';
  } else {
    updatedCity.plague = {
      ...city.plague,
      remainingMonths: nextRemaining,
    };
    note = `，施药抚恤疫疾缓解（余${nextRemaining}月）`;
  }

  // 赈济为城内武将恢复 10 点体力
  const nextOfficers = { ...officers };
  for (const oid of city.officers) {
    const off = nextOfficers[oid];
    if (off) {
      nextOfficers[oid] = {
        ...off,
        stamina: Math.min(100, (off.stamina ?? 0) + 10),
      };
    }
  }

  return {
    city: updatedCity,
    officers: nextOfficers,
    note,
  };
}
