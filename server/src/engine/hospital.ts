// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 引擎层：战阵创伤、伤兵营收治与杏林医馆体系（Phase 7-06）
 *
 * 核心生命周期：
 * 1. 官办医馆拨款注资（fundCityHospital）
 * 2. 派医诊治武将创伤（cureOfficerInjury）
 * 3. 战场战损分流入册（recordBattleCasualties）
 * 4. 月度伤兵回流与创伤自然康复（tickCasualtiesAndHospitalMonth）
 * 5. 零漂移保证：无伤员与无创伤武将局直接返回原引用 state，零开销零 RNG 调用。
 */

import {
  type GameAction,
  type GameState,
  type City,
  type Officer,
  calculateCasualtySplit,
  calculateMonthlyWoundedRecoveryRate,
  calculateInjuryCombatPenalty,
  getHealingMonthsRequired,
  InjuryLevel,
  HOSPITAL_FUNDING_COST,
  HOSPITAL_FUNDING_DURATION,
  CURE_COST_BY_INJURY,
} from '@leh/shared';

/**
 * 官办医馆拨款注资政令（docs/04 §23.5 / §24.2）。
 * 扣减城池 100 贯，建立 3 个月的医馆疗效强化期。
 */
export function fundCityHospital(state: GameState, cityId: number): GameState {
  const city = state.cities[cityId];
  if (!city) {
    throw new Error(`城池 ID ${cityId} 不存在`);
  }

  if (city.gold < HOSPITAL_FUNDING_COST) {
    throw new Error(`注资医馆太医署需 ${HOSPITAL_FUNDING_COST} 贯金钱，城中资金不足`);
  }

  const updatedCity: City = {
    ...city,
    gold: city.gold - HOSPITAL_FUNDING_COST,
    hospitalFundedMonths: HOSPITAL_FUNDING_DURATION,
  };

  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'hospital_funded',
    message: `【杏林惠民】${city.name} 官府拨款 ${HOSPITAL_FUNDING_COST} 贯注资太医署医馆，强化军民伤患救治！`,
  };

  return {
    ...state,
    cities: {
      ...state.cities,
      [cityId]: updatedCity,
    },
    actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
  };
}

/**
 * 派医诊治武将创伤政令（docs/04 §23.5）。
 * 消耗城池资金，将武将创伤等级降级 1 级；若痊愈则重置负伤月数。
 */
export function cureOfficerInjury(
  state: GameState,
  officerId: number,
  actingFactionId?: number,
): GameState {
  const officer = state.officers[officerId];
  if (!officer) {
    throw new Error(`武将 ID ${officerId} 不存在`);
  }

  if (actingFactionId != null && officer.faction !== actingFactionId) {
    throw new Error('不可跨势力诊治非本邦武将');
  }

  const currentInjury = officer.injury ?? InjuryLevel.HEALTHY;
  if (currentInjury <= InjuryLevel.HEALTHY) {
    throw new Error(`${officer.name} 身体康泰，未受任何战伤创痛，无需诊治`);
  }

  // 诊资由武将所在城池（或势力首都）承担
  const cityId = officer.location ?? 1;
  const city = state.cities[cityId];
  const cureCost = CURE_COST_BY_INJURY[currentInjury] ?? 100;

  if (city && city.gold < cureCost) {
    throw new Error(`延请名医调理 ${officer.name} 需 ${cureCost} 金，城中资金不足`);
  }

  const nextInjury = currentInjury - 1;
  const updatedOfficer: Officer = {
    ...officer,
    injury: nextInjury,
    injuryMonths: nextInjury === InjuryLevel.HEALTHY ? 0 : 0, // 降级后重置康复计时
  };

  const penaltyAfter = calculateInjuryCombatPenalty(nextInjury);
  const logMessage =
    nextInjury === InjuryLevel.HEALTHY
      ? `【妙手回春】名医精心敷药调理，${officer.name} 之战创彻底痊愈，重现英武神采！`
      : `【良医施治】${officer.name} 经名医精心调理敷药，创伤转危为安，好转为「${penaltyAfter.label}」！`;

  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'officer_injury_cured',
    message: logMessage,
  };

  let nextCities = state.cities;
  if (city) {
    nextCities = {
      ...state.cities,
      [city.id]: {
        ...city,
        gold: city.gold - cureCost,
      },
    };
  }

  return {
    ...state,
    cities: nextCities,
    officers: {
      ...state.officers,
      [officer.id]: updatedOfficer,
    },
    actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
  };
}

/**
 * 战损分流入册纯函数接口：将战损按 40% 阵亡、60% 伤兵沉淀入城池伤兵营。
 */
export function recordBattleCasualties(
  state: GameState,
  cityId: number,
  totalLoss: number,
): GameState {
  const city = state.cities[cityId];
  if (!city || totalLoss <= 0) {
    return state;
  }

  const split = calculateCasualtySplit(totalLoss);
  if (split.wounded <= 0) {
    return state;
  }

  const currentWounded = city.woundedTroops ?? 0;
  const updatedCity: City = {
    ...city,
    woundedTroops: currentWounded + split.wounded,
  };

  return {
    ...state,
    cities: {
      ...state.cities,
      [cityId]: updatedCity,
    },
  };
}

/**
 * 月度伤兵营自然回流与武将创伤康复演进（turn.ts 月结管线调用）。
 *
 * 铁律保证：若无任何伤兵、无医馆拨款且无负伤武将，严格返回原引用 state，零开销零 RNG 保证零漂移。
 */
export function tickCasualtiesAndHospitalMonth(state: GameState): GameState {
  let hasAnyCityActivity = false;
  for (const c of Object.values(state.cities)) {
    if ((c.woundedTroops ?? 0) > 0 || (c.hospitalFundedMonths ?? 0) > 0) {
      hasAnyCityActivity = true;
      break;
    }
  }

  let hasAnyInjuredOfficer = false;
  for (const o of Object.values(state.officers)) {
    if ((o.injury ?? 0) > 0) {
      hasAnyInjuredOfficer = true;
      break;
    }
  }

  // 严格 COW 零分配：无伤患局直接返回原引用
  if (!hasAnyCityActivity && !hasAnyInjuredOfficer) {
    return state;
  }

  let updatedCities = state.cities;
  let updatedOfficers = state.officers;
  let hasStateChanges = false;
  const logs: GameAction[] = [];

  // 1. 处理城池伤兵营回流与医馆拨款流逝
  if (hasAnyCityActivity) {
    const nextCitiesMap: Record<number, City> = { ...state.cities };

    for (const city of Object.values(state.cities)) {
      const wounded = city.woundedTroops ?? 0;
      const fundedMonths = city.hospitalFundedMonths ?? 0;

      if (wounded <= 0 && fundedMonths <= 0) {
        continue;
      }

      let nextWounded = wounded;
      let nextTroops = city.troops;
      let nextFundedMonths: number | undefined = fundedMonths;

      // 医馆拨款计时消减
      if (fundedMonths > 0) {
        nextFundedMonths = fundedMonths - 1 > 0 ? fundedMonths - 1 : undefined;
      }

      // 伤兵回流
      if (wounded > 0) {
        // 药材特产或药材商路畅通判定
        const hasHerb =
          city.province === '益州' ||
          city.province === '幽州' ||
          (state.tradeRoutes ?? []).some(
            (r) =>
              r.status === 'active' &&
              (r.fromCityId === city.id || r.toCityId === city.id),
          );

        const officersInCity = Object.values(state.officers).filter(
          (o) => o.location === city.id,
        );

        const rate = calculateMonthlyWoundedRecoveryRate({
          city,
          officersInCity,
          hasHerbSupply: hasHerb,
        });

        // 保底月康复 50 人，避免残余小额伤兵无休止衰减
        const recovered = Math.min(wounded, Math.max(50, Math.floor(wounded * rate)));
        nextWounded = wounded - recovered;
        nextTroops = city.troops + recovered;

        if (recovered >= 50) {
          logs.push({
            year: state.currentYear,
            month: state.currentMonth,
            type: 'wounded_recovered',
            message: `【伤兵归队】${city.name} 经太医署与后方休养，本月有 ${recovered} 名伤愈将士重返戎行！`,
          });
        }
      }

      nextCitiesMap[city.id] = {
        ...city,
        troops: nextTroops,
        woundedTroops: nextWounded > 0 ? nextWounded : undefined,
        hospitalFundedMonths: nextFundedMonths,
      };
      hasStateChanges = true;
    }

    if (hasStateChanges) {
      updatedCities = nextCitiesMap;
    }
  }

  // 2. 处理负伤武将月度创伤消解
  if (hasAnyInjuredOfficer) {
    const nextOfficersMap: Record<number, Officer> = { ...state.officers };

    for (const officer of Object.values(state.officers)) {
      const injury = officer.injury ?? InjuryLevel.HEALTHY;
      if (injury <= InjuryLevel.HEALTHY) {
        continue;
      }

      const currentMonths = (officer.injuryMonths ?? 0) + 1;
      const durationRequired = getHealingMonthsRequired(injury);

      if (currentMonths >= durationRequired) {
        // 达到康复周期，创伤自然降级
        const nextInjury = injury - 1;
        const isFullyHealed = nextInjury === InjuryLevel.HEALTHY;

        nextOfficersMap[officer.id] = {
          ...officer,
          injury: nextInjury,
          injuryMonths: 0,
        };

        const healedMsg = isFullyHealed
          ? `【创伤痊愈】${officer.name} 经数月悉心调理，伤势已然痊愈，武力与统帅尽复旧观！`
          : `【创伤好转】${officer.name} 伤情大见起色，创伤已由「${calculateInjuryCombatPenalty(injury).label}」好转为「${calculateInjuryCombatPenalty(nextInjury).label}」！`;

        logs.push({
          year: state.currentYear,
          month: state.currentMonth,
          type: 'officer_injury_healed',
          message: healedMsg,
        });
      } else {
        // 维持当前创伤，自增月数
        nextOfficersMap[officer.id] = {
          ...officer,
          injuryMonths: currentMonths,
        };
      }
      hasStateChanges = true;
    }

    if (hasStateChanges) {
      updatedOfficers = nextOfficersMap;
    }
  }

  if (!hasStateChanges) {
    return state;
  }

  return {
    ...state,
    cities: updatedCities,
    officers: updatedOfficers,
    actionLog: [...logs, ...(state.actionLog ?? [])].slice(0, 80),
  };
}
