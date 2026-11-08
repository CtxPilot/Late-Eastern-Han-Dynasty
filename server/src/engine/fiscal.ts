// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  APPEASE_MAGNATE_COST,
  INSPECT_CENSUS_COST,
  INSPECT_CENSUS_LOYALTY_PENALTY,
  REFORM_COINAGE_COST,
  REFORM_COINAGE_GAIN,
  DEBASE_COINAGE_DROP,
  DEBASE_COINAGE_EMERGENCY_GOLD,
  TAX_POLICY_LABELS,
  TAX_POLICY_RATES,
  calculateFactionSalaries,
  getSalaryArrearsLoyaltyPenalty,
  isMagnateOfficer,
  type TaxPolicy,
  type GameState,
} from '@leh/shared';
import { syncFactionResources } from './economy.js';

function pushLog(
  state: GameState,
  type: string,
  message: string,
  overrides?: Partial<GameState>,
): GameState {
  const entry = {
    year: state.currentYear,
    month: state.currentMonth,
    type,
    message,
  };
  return {
    ...state,
    ...overrides,
    actionLog: [entry, ...(overrides?.actionLog ?? state.actionLog)].slice(0, 80),
  };
}

/**
 * 调整城市税收政策（docs/04 §35.2）。
 */
export function setCityTaxPolicy(
  state: GameState,
  cityId: number,
  policy: TaxPolicy,
  customRate?: number,
): GameState {
  const city = state.cities[cityId];
  if (!city) throw new Error(`城市 ${cityId} 不存在`);
  if (city.ruler !== state.playerFactionId) throw new Error('只能调整己方控制城市的税赋政策');

  const baseRate = TAX_POLICY_RATES[policy] ?? 0.30;
  const rate = customRate != null ? Math.min(0.9, Math.max(0.1, customRate)) : baseRate;

  const nextCity = {
    ...city,
    taxPolicy: policy,
    taxRate: rate,
  };

  const label = TAX_POLICY_LABELS[policy] ?? policy;
  return pushLog(
    state,
    'tax_policy_changed',
    `${city.name}调整税赋政策为「${label}」（税率 ${Math.round(rate * 100)}%）`,
    {
      cities: {
        ...state.cities,
        [cityId]: nextCity,
      },
    },
  );
}

/**
 * 安抚地方豪强（docs/04 §35.2）：耗金 300，消除 15% 隐匿税收惩罚。
 */
export function appeaseMagnates(state: GameState, cityId: number): GameState {
  const city = state.cities[cityId];
  if (!city) throw new Error(`城市 ${cityId} 不存在`);
  if (city.ruler !== state.playerFactionId) throw new Error('只能在己方城市执行安抚指令');
  if (city.gold < APPEASE_MAGNATE_COST) {
    throw new Error(`城市资金不足，无法安抚豪强（需 ${APPEASE_MAGNATE_COST} 金，当前 ${city.gold}）`);
  }

  const nextCity = {
    ...city,
    gold: city.gold - APPEASE_MAGNATE_COST,
    appeasedMagnate: true,
  };

  let s = pushLog(
    state,
    'appease_magnates',
    `${city.name}耗金 ${APPEASE_MAGNATE_COST} 安抚地方豪强，豪族深感皇恩，田产隐匿尽除`,
    {
      cities: {
        ...state.cities,
        [cityId]: nextCity,
      },
    },
  );
  return syncFactionResources(s);
}

/**
 * 检籍清田（docs/04 §35.2）：耗金 200，恢复全额税收，但本城豪强武将忠诚 -15。
 */
export function inspectCensus(state: GameState, cityId: number): GameState {
  const city = state.cities[cityId];
  if (!city) throw new Error(`城市 ${cityId} 不存在`);
  if (city.ruler !== state.playerFactionId) throw new Error('只能在己方城市执行检籍指令');
  if (city.gold < INSPECT_CENSUS_COST) {
    throw new Error(`城市资金不足，无法检籍清田（需 ${INSPECT_CENSUS_COST} 金，当前 ${city.gold}）`);
  }

  const nextCity = {
    ...city,
    gold: city.gold - INSPECT_CENSUS_COST,
    appeasedMagnate: true,
  };

  // 城中豪强武将忠诚 -15
  const officers = { ...state.officers };
  let penalizedCount = 0;
  for (const oid of city.officers) {
    const o = officers[oid];
    if (o && isMagnateOfficer(o)) {
      officers[oid] = {
        ...o,
        loyalty: Math.max(0, (o.loyalty ?? 70) - INSPECT_CENSUS_LOYALTY_PENALTY),
      };
      penalizedCount += 1;
    }
  }

  let s = pushLog(
    state,
    'inspect_census',
    `${city.name}耗金 ${INSPECT_CENSUS_COST} 行严厉检籍清田，豪强隐匿田产悉数入册（${penalizedCount} 位豪强武将忠诚 -${INSPECT_CENSUS_LOYALTY_PENALTY}）`,
    {
      cities: {
        ...state.cities,
        [cityId]: nextCity,
      },
      officers,
    },
  );
  return syncFactionResources(s);
}

/**
 * 铸币改革（docs/04 §35.1）：耗金 300，成色 +0.10（上限 1.00）。
 */
export function reformCoinage(state: GameState, factionId: number): GameState {
  const faction = state.factions[factionId];
  if (!faction) throw new Error(`势力 ${factionId} 不存在`);
  if (faction.gold < REFORM_COINAGE_COST) {
    throw new Error(`国库资金不足，无法推行铸币改革（需 ${REFORM_COINAGE_COST} 金，当前 ${faction.gold}）`);
  }

  // 优先从首府扣金
  const cities = { ...state.cities };
  let remaining = REFORM_COINAGE_COST;
  const sortedCities = Object.values(cities)
    .filter((c) => c.ruler === factionId)
    .sort((a, b) => (a.id === faction.capitalCityId ? -1 : b.id === faction.capitalCityId ? 1 : 0));

  for (const c of sortedCities) {
    if (remaining <= 0) break;
    const pay = Math.min(c.gold, remaining);
    cities[c.id] = { ...c, gold: c.gold - pay };
    remaining -= pay;
  }

  const currentQuality = faction.coinQuality ?? 1.0;
  const nextQuality = Math.min(1.0, Number((currentQuality + REFORM_COINAGE_GAIN).toFixed(2)));

  const nextFaction = {
    ...faction,
    coinQuality: nextQuality,
  };

  let s = pushLog(
    state,
    'reform_coinage',
    `${faction.name}立令推行币制改革，整肃私铸，钱币成色提升至 ${(nextQuality * 100).toFixed(0)}%`,
    {
      cities,
      factions: {
        ...state.factions,
        [factionId]: nextFaction,
      },
    },
  );
  return syncFactionResources(s);
}

/**
 * 滥发虚值钱（docs/04 §35.1）：战时应急，立即获金 300，成色 -0.10（下限 0.50）。
 */
export function debaseCoinage(state: GameState, factionId: number): GameState {
  const faction = state.factions[factionId];
  if (!faction) throw new Error(`势力 ${factionId} 不存在`);

  const capital = state.cities[faction.capitalCityId];
  const cities = { ...state.cities };
  if (capital) {
    cities[capital.id] = { ...capital, gold: capital.gold + DEBASE_COINAGE_EMERGENCY_GOLD };
  }

  const currentQuality = faction.coinQuality ?? 1.0;
  const nextQuality = Math.max(0.5, Number((currentQuality - DEBASE_COINAGE_DROP).toFixed(2)));

  const nextFaction = {
    ...faction,
    coinQuality: nextQuality,
  };

  let s = pushLog(
    state,
    'debase_coinage',
    `【警】${faction.name}因用度困窘滥发虚值大钱，急获应急资金 ${DEBASE_COINAGE_EMERGENCY_GOLD} 金，钱币成色跌至 ${(nextQuality * 100).toFixed(0)}%！`,
    {
      cities,
      factions: {
        ...state.factions,
        [factionId]: nextFaction,
      },
    },
  );
  return syncFactionResources(s);
}

/**
 * 岁首（每年 1 月）百官年俸发放（docs/04 §35.3）。
 */
export function settleAnnualSalaries(state: GameState): GameState {
  let workingState = state;
  const officersList = Object.values(workingState.officers);
  const cities = { ...workingState.cities };
  const factions = { ...workingState.factions };
  const logs: { year: number; month: number; type: string; message: string }[] = [];

  for (const fid of Object.keys(factions).map(Number)) {
    const faction = factions[fid];
    if (!faction || !faction.isAlive) continue;

    const { totalSalary } = calculateFactionSalaries(officersList, faction);
    if (totalSalary <= 0) {
      factions[fid] = { ...faction, salaryArrears: 0 };
      continue;
    }

    // 统计势力总金库
    const facCities = Object.values(cities)
      .filter((c) => c.ruler === fid)
      .sort((a, b) => (a.id === faction.capitalCityId ? -1 : b.id === faction.capitalCityId ? 1 : 0));
    const totalAvailGold = facCities.reduce((sum, c) => sum + c.gold, 0);

    if (totalAvailGold >= totalSalary) {
      // 足额发放：自首府及领地扣减
      let needed = totalSalary;
      for (const c of facCities) {
        if (needed <= 0) break;
        const pay = Math.min(c.gold, needed);
        cities[c.id] = { ...c, gold: c.gold - pay };
        needed -= pay;
      }
      factions[fid] = { ...faction, salaryArrears: 0 };
      logs.push({
        year: state.currentYear,
        month: state.currentMonth,
        type: 'salary_paid',
        message: `【喜】${faction.name}岁首统发百官年俸共 ${totalSalary} 金，文武咸服`,
      });
    } else {
      // 欠俸：扣尽现有资金并累计欠俸
      for (const c of facCities) {
        cities[c.id] = { ...c, gold: 0 };
      }
      const nextArrears = (faction.salaryArrears ?? 0) + 1;
      factions[fid] = { ...faction, salaryArrears: nextArrears };
      logs.push({
        year: state.currentYear,
        month: state.currentMonth,
        type: 'salary_arrears',
        message: `【警】${faction.name}岁首府库空虚，百官年俸未能足额发放（需 ${totalSalary}，实支 ${totalAvailGold}），累计欠俸 ${nextArrears} 季！`,
      });
    }
  }

  workingState = {
    ...workingState,
    cities,
    factions,
    actionLog: [...logs, ...workingState.actionLog].slice(0, 80),
  };
  return syncFactionResources(workingState);
}

/**
 * 季首（1/4/7/10 月）欠俸忠诚惩罚（docs/04 §35.3）。
 */
export function settleSalaryArrearsQuarterly(state: GameState): GameState {
  let workingState = state;
  const officers = { ...workingState.officers };
  const factions = workingState.factions;
  const logs: { year: number; month: number; type: string; message: string }[] = [];

  for (const faction of Object.values(factions)) {
    if (!faction || !faction.isAlive) continue;
    const arrears = faction.salaryArrears ?? 0;
    if (arrears <= 0) continue;

    const penalty = getSalaryArrearsLoyaltyPenalty(arrears);
    let affected = 0;
    for (const o of Object.values(officers)) {
      if (o.faction === faction.id && o.id !== faction.rulerId) {
        officers[o.id] = {
          ...o,
          loyalty: Math.max(0, (o.loyalty ?? 70) - penalty),
        };
        affected += 1;
      }
    }

    if (affected > 0) {
      logs.push({
        year: state.currentYear,
        month: state.currentMonth,
        type: 'salary_penalty',
        message: `【警】${faction.name}积欠俸禄已达 ${arrears} 季，所属 ${affected} 位将领忠诚衰减 ${penalty} 点！`,
      });
    }
  }

  return {
    ...workingState,
    officers,
    actionLog: [...logs, ...workingState.actionLog].slice(0, 80),
  };
}

/**
 * 季首（1/4/7/10 月）城市税收政策民心变动（docs/04 §35.2）。
 * light: +3, heavy: -5, martial: -10
 */
export function applyQuarterlyTaxMorale(state: GameState): GameState {
  const cities = { ...state.cities };
  for (const [cid, city] of Object.entries(cities)) {
    const policy = city.taxPolicy ?? 'standard';
    if (policy === 'standard') continue;

    let morale = city.stats.morale ?? 70;
    if (policy === 'light') {
      morale = Math.min(100, morale + 3);
    } else if (policy === 'heavy') {
      morale = Math.max(0, morale - 5);
    } else if (policy === 'martial') {
      morale = Math.max(0, morale - 10);
    }
    cities[Number(cid)] = {
      ...city,
      stats: { ...city.stats, morale },
    };
  }
  return { ...state, cities };
}
