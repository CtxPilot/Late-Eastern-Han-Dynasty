// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 引擎层：边疆异族羁縻、朝贡互市与寇边讨伐全生命周期（Phase 7-07）
 *
 * 1. 宣抚羁縻（pacifyMinorityTribe）
 * 2. 发兵讨平（subjugateMinorityTribe）
 * 3. 羁縻借兵（recruitMinorityTroops）
 * 4. 月度演化与边防张力波动（tickMinorityTribesMonth）
 * 5. 严格零漂移保证：无异族字典或无变动时严格返回原引用 state，零开销零 RNG 消耗。
 */

import {
  type City,
  type GameAction,
  type GameState,
  type Officer,
  type Season,
  DEFAULT_MINORITY_TRIBES,
  MinorityTribe,
  MinorityTribeId,
  calculateTribeTensionDelta,
  canRecruitTribeTroops,
  canLeadTribeSubjugation,
  TRIBAL_PACIFY_COST_GOLD,
  TRIBAL_PACIFY_TENSION_REDUCTION,
  TRIBAL_SUBDUE_MONTHS,
  TRIBAL_LEVY_BATCH_SIZE,
  TRIBAL_LEVY_COST_GOLD,
  TRIBAL_LEVY_TENSION_COST,
} from '@leh/shared';

export {
  TRIBAL_PACIFY_COST_GOLD,
  TRIBAL_PACIFY_TENSION_REDUCTION,
  TRIBAL_SUBDUE_MONTHS,
  TRIBAL_LEVY_BATCH_SIZE,
  TRIBAL_LEVY_COST_GOLD,
  TRIBAL_LEVY_TENSION_COST,
};

/**
 * 初始化势力边疆异族字典
 */
export function initMinorityTribes(state: GameState): GameState {
  if (state.minorityTribes && Object.keys(state.minorityTribes).length > 0) {
    return state;
  }

  const initialTribes: Record<string, MinorityTribe> = {};
  for (const [id, tribe] of Object.entries(DEFAULT_MINORITY_TRIBES)) {
    initialTribes[id] = { ...tribe };
  }

  return {
    ...state,
    minorityTribes: initialTribes,
  };
}

/**
 * 诸侯宣抚羁縻政令：消耗城池资金犒赏异族，平抑边防紧张度。
 */
export function pacifyMinorityTribe(
  state: GameState,
  _factionId: number,
  cityId: number,
  tribeId: MinorityTribeId,
): { state: GameState; message: string; tension: number } {
  const city = state.cities[cityId];
  if (!city) {
    throw new Error(`城池不存在 (id=${cityId})`);
  }

  if ((city.gold ?? 0) < TRIBAL_PACIFY_COST_GOLD) {
    throw new Error(`城池金钱不足 ${TRIBAL_PACIFY_COST_GOLD} 贯，无法犒赏宣抚异族`);
  }

  const tribes = state.minorityTribes ?? DEFAULT_MINORITY_TRIBES;
  const tribe = tribes[tribeId];
  if (!tribe) {
    throw new Error(`异族部落不存在 (id=${tribeId})`);
  }

  const nextTension = Math.max(0, tribe.tension - TRIBAL_PACIFY_TENSION_REDUCTION);
  const updatedTribe: MinorityTribe = {
    ...tribe,
    tension: nextTension,
  };

  const updatedCity: City = {
    ...city,
    gold: city.gold - TRIBAL_PACIFY_COST_GOLD,
  };

  const message = `【宣抚羁縻】${city.name} 向 ${tribe.name} 犒劳输送金帛 ${TRIBAL_PACIFY_COST_GOLD} 贯，边疆异族感戴诚服，紧张度降至 ${nextTension}！`;
  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'minority_pacified',
    message,
  };

  const nextState: GameState = {
    ...state,
    cities: {
      ...state.cities,
      [cityId]: updatedCity,
    },
    minorityTribes: {
      ...tribes,
      [tribeId]: updatedTribe,
    },
    actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
  };

  return { state: nextState, message, tension: nextTension };
}

/**
 * 发兵深入讨平异族：遣统武大将征讨，胜则清空紧张度并获得 24 个月威慑平静期与缴获战利品。
 */
export function subjugateMinorityTribe(
  state: GameState,
  factionId: number,
  cityId: number,
  tribeId: MinorityTribeId,
  generalOfficerId: number,
): { state: GameState; message: string; spoils: { horses: number; gold: number } } {
  const city = state.cities[cityId];
  if (!city) {
    throw new Error(`出征城池不存在 (id=${cityId})`);
  }

  const officer = state.officers[generalOfficerId];
  if (!officer) {
    throw new Error(`领兵将领不存在 (id=${generalOfficerId})`);
  }

  const checkLead = canLeadTribeSubjugation(officer);
  if (!checkLead.canLead) {
    throw new Error(checkLead.reason);
  }

  if ((city.troops ?? 0) < 1000) {
    throw new Error(`出征城池兵力不足 1000 人，难以发兵深入蛮荒远征`);
  }

  if ((city.gold ?? 0) < 200) {
    throw new Error(`城池军费不足 200 贯，无法维系大军远涉塞外出征开支`);
  }

  const tribes = state.minorityTribes ?? DEFAULT_MINORITY_TRIBES;
  const tribe = tribes[tribeId];
  if (!tribe) {
    throw new Error(`异族部落不存在 (id=${tribeId})`);
  }

  // 出征消耗 500 兵力与 200 军费
  const lossTroops = 500;
  const costGold = 200;

  // 缴获战利品（战马与金帛）
  const spoils = {
    horses: tribe.id === 'xiongnu' || tribe.id === 'xianbei' || tribe.id === 'qiang' ? 30 : 0,
    gold: 300,
  };

  const updatedCity: City = {
    ...city,
    troops: Math.max(0, city.troops - lossTroops),
    gold: city.gold - costGold + spoils.gold,
  };

  const updatedOfficer: Officer = {
    ...officer,
    merit: (officer.merit ?? 0) + 50,
  };

  const updatedTribe: MinorityTribe = {
    ...tribe,
    tension: 0,
    isSubdued: true,
    subduedMonths: TRIBAL_SUBDUE_MONTHS,
  };

  const message = `【讨平蛮夷】名将 ${officer.name} 统兵深入荒塞大破 ${tribe.name}，斩俘千计，缴获金帛 ${spoils.gold} 贯与战马 ${spoils.horses} 匹！${tribe.name} 慑服请降，${TRIBAL_SUBDUE_MONTHS} 个月不敢犯境！`;
  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'minority_subjugated',
    message,
  };

  let nextFactions = state.factions;
  if (state.factions[factionId]) {
    nextFactions = {
      ...state.factions,
      [factionId]: {
        ...state.factions[factionId],
        fame: (state.factions[factionId].fame ?? 0) + 15,
      },
    };
  }

  const nextState: GameState = {
    ...state,
    factions: nextFactions,
    cities: {
      ...state.cities,
      [cityId]: updatedCity,
    },
    officers: {
      ...state.officers,
      [generalOfficerId]: updatedOfficer,
    },
    minorityTribes: {
      ...tribes,
      [tribeId]: updatedTribe,
    },
    actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
  };

  return { state: nextState, message, spoils };
}

/**
 * 边境城池向顺服异族借募特色特种兵。
 */
export function recruitMinorityTroops(
  state: GameState,
  _factionId: number,
  cityId: number,
  tribeId: MinorityTribeId,
): { state: GameState; message: string; troopsRecruited: number } {
  const city = state.cities[cityId];
  if (!city) {
    throw new Error(`城池不存在 (id=${cityId})`);
  }

  const tribes = state.minorityTribes ?? DEFAULT_MINORITY_TRIBES;
  const tribe = tribes[tribeId];
  if (!tribe) {
    throw new Error(`异族部落不存在 (id=${tribeId})`);
  }

  const checkRecruit = canRecruitTribeTroops(city, tribe);
  if (!checkRecruit.canRecruit) {
    throw new Error(checkRecruit.reason);
  }

  const updatedCity: City = {
    ...city,
    gold: city.gold - TRIBAL_LEVY_COST_GOLD,
    troops: city.troops + TRIBAL_LEVY_BATCH_SIZE,
  };

  const nextTension = Math.min(100, tribe.tension + TRIBAL_LEVY_TENSION_COST);
  const updatedTribe: MinorityTribe = {
    ...tribe,
    tension: nextTension,
  };

  const message = `【异族借兵】${city.name} 犒资 ${TRIBAL_LEVY_COST_GOLD} 贯招纳 500 名「${tribe.specialUnitName}」充实守备，塞外精锐归命，边防士气大振！`;
  const logEntry: GameAction = {
    year: state.currentYear,
    month: state.currentMonth,
    type: 'minority_troops_recruited',
    message,
  };

  const nextState: GameState = {
    ...state,
    cities: {
      ...state.cities,
      [cityId]: updatedCity,
    },
    minorityTribes: {
      ...tribes,
      [tribeId]: updatedTribe,
    },
    actionLog: [logEntry, ...(state.actionLog ?? [])].slice(0, 80),
  };

  return { state: nextState, message, troopsRecruited: TRIBAL_LEVY_BATCH_SIZE };
}

/**
 * 月度演进：处理各边疆异族张力自然演化、季节偏转、威慑期消减、以及高张力寇边/低张力岁首朝贡。
 *
 * 铁律保障：若 state.minorityTribes 不存在，直接返回原引用 state，零开销零 RNG 调用！
 */
export function tickMinorityTribesMonth(state: GameState, season?: Season): GameState {
  if (!state.minorityTribes || Object.keys(state.minorityTribes).length === 0) {
    return state;
  }

  let hasChanges = false;
  const nextTribes: Record<string, MinorityTribe> = { ...state.minorityTribes };
  let nextCities = state.cities;
  const logs: GameAction[] = [];

  for (const tribe of Object.values(state.minorityTribes)) {
    // 1. 处理威慑平静期倒计时
    if (tribe.isSubdued && (tribe.subduedMonths ?? 0) > 0) {
      const nextMonths = (tribe.subduedMonths ?? 0) - 1;
      nextTribes[tribe.id] = {
        ...tribe,
        subduedMonths: nextMonths > 0 ? nextMonths : undefined,
        isSubdued: nextMonths > 0,
      };
      hasChanges = true;
      continue;
    }

    // 2. 检索关联边境城池与驻守武将
    const borderCities = Object.values(state.cities).filter((c) =>
      tribe.relatedProvinces.includes(c.province),
    );
    const borderCityIds = new Set(borderCities.map((c) => c.id));
    const borderOfficers = Object.values(state.officers).filter(
      (o) => o.location != null && borderCityIds.has(o.location),
    );

    // 3. 计算张力月度变化
    const delta = calculateTribeTensionDelta({
      tribe,
      season,
      borderCities,
      borderOfficers,
    });

    const nextTension = Math.max(0, Math.min(100, tribe.tension + delta));
    if (nextTension !== tribe.tension) {
      nextTribes[tribe.id] = {
        ...tribe,
        tension: nextTension,
      };
      hasChanges = true;
    }

    // 4. 极端威胁事件判定：>=80 发生大举寇边袭扰
    if (nextTension >= 80 && borderCities.length > 0) {
      const targetCity = borderCities[0];
      if (targetCity && (targetCity.troops ?? 0) > 300) {
        const raidTroops = Math.min(150, Math.floor(targetCity.troops * 0.05));
        const raidGold = Math.min(80, Math.floor(targetCity.gold * 0.05));
        nextCities = {
          ...nextCities,
          [targetCity.id]: {
            ...targetCity,
            troops: Math.max(0, targetCity.troops - raidTroops),
            gold: Math.max(0, targetCity.gold - raidGold),
            troopsMorale: Math.max(0, (targetCity.troopsMorale ?? 70) - 3),
          },
        };
        logs.push({
          year: state.currentYear,
          month: state.currentMonth,
          type: 'minority_invasion_raid',
          message: `【异族寇边】${tribe.name} 张力炽盛（${nextTension}），铁骑犯境袭掠 ${targetCity.name}，损兵 ${raidTroops}、掠金 ${raidGold}！`,
        });
        hasChanges = true;
      }
    }

    // 5. 岁首朝贡：张力 < 30 且 1 月岁首
    if (nextTension < 30 && state.currentMonth === 1 && borderCities.length > 0) {
      const targetCity = borderCities[0];
      if (targetCity) {
        nextCities = {
          ...nextCities,
          [targetCity.id]: {
            ...targetCity,
            gold: targetCity.gold + 100,
            food: targetCity.food + 200,
          },
        };
        logs.push({
          year: state.currentYear,
          month: state.currentMonth,
          type: 'minority_tribute_delivered',
          message: `【边夷岁贡】${tribe.name} 感戴皇汉威德，向边城 ${targetCity.name} 进奉特产「${tribe.specialtyTribute}」，添金 100 贯、粮 200 石！`,
        });
        hasChanges = true;
      }
    }
  }

  if (!hasChanges) {
    return state;
  }

  return {
    ...state,
    cities: nextCities,
    minorityTribes: nextTribes,
    actionLog: logs.length > 0 ? [...logs, ...(state.actionLog ?? [])].slice(0, 80) : state.actionLog,
  };
}
