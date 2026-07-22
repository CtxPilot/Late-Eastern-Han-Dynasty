// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Demo 内政引擎（即时结算简化版）
 * 征兵扣成年男；与人口结构/粮耗挂钩
 * 美女寻访见 engine/beauty.ts（S09）
 */
import {
  ensureDemographics,
  maxConscriptable,
  withSyncedPopulation,
  type City,
  type GameState,
} from '@leh/shared';

export type DevelopKind = 'farm' | 'commerce' | 'wall';

const DEVELOP: Record<
  DevelopKind,
  { cost: number; label: string; stat: 'farm' | 'commerce' | 'wall'; gainMin: number; gainMax: number }
> = {
  farm: { cost: 100, label: '农业', stat: 'farm', gainMin: 20, gainMax: 30 },
  commerce: { cost: 100, label: '商业', stat: 'commerce', gainMin: 18, gainMax: 28 },
  wall: { cost: 120, label: '城防', stat: 'wall', gainMin: 15, gainMax: 25 },
};

function requirePlayerCity(state: GameState, cityId: number): City {
  const city = state.cities[cityId];
  if (!city) throw new Error('城市不存在');
  if (city.ruler !== state.playerFactionId) throw new Error('非己方城市');
  return city;
}

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<Pick<GameState, 'cities' | 'females' | 'officers'>> = {},
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

function randGain(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** 开发农业 / 商业 / 城防 */
export function developCity(
  state: GameState,
  cityId: number,
  kind: DevelopKind,
  rng: () => number,
): GameState {
  const conf = DEVELOP[kind];
  if (!conf) throw new Error('未知开发类型');
  const city = requirePlayerCity(state, cityId);
  if (city.gold < conf.cost) throw new Error('金钱不足');

  const gain = randGain(conf.gainMin, conf.gainMax, rng);
  const prev = city.stats[conf.stat];
  const nextStat = Math.min(999, prev + gain);
  const nextCity: City = {
    ...city,
    gold: city.gold - conf.cost,
    stats: { ...city.stats, [conf.stat]: nextStat },
  };

  return pushLog(
    state,
    `develop_${kind}`,
    `${city.name} 开发${conf.label} +${gain}（${prev}→${nextStat}，花费${conf.cost}金）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}

/** 兼容旧 API */
export function developFarm(state: GameState, cityId: number, rng: () => number): GameState {
  return developCity(state, cityId, 'farm', rng);
}

/**
 * 征兵：耗金+粮；兵力来自成年男（可征上限）
 * 80 金 + 120 粮 → 尝试征 300~450+bonus，不超过可征男丁
 */
export function conscript(state: GameState, cityId: number, rng: () => number): GameState {
  const city = requirePlayerCity(state, cityId);
  const goldCost = 80;
  const foodCost = 120;
  if (city.gold < goldCost) throw new Error('金钱不足');
  if (city.food < foodCost) throw new Error('粮食不足');

  const d = ensureDemographics(city);
  const maxMen = maxConscriptable(d);
  if (maxMen < 50) throw new Error('成年男丁不足（需保留劳作人口）');

  const troopsGain = 300 + Math.floor(rng() * 151);
  const bonus = Math.floor(city.stats.farm / 50) + Math.floor((city.stats.morale ?? 70) / 40);
  const want = troopsGain + bonus * 10;
  const total = Math.min(want, maxMen);

  const nextDemo = { ...d, adultMale: d.adultMale - total };
  const base: City = {
    ...city,
    gold: city.gold - goldCost,
    food: city.food - foodCost,
    troops: city.troops + total,
    demographics: nextDemo,
    population: city.population,
    stats: {
      ...city.stats,
      morale: Math.max(0, (city.stats.morale ?? 70) - 2),
    },
  };
  const nextCity = withSyncedPopulation(base, nextDemo);

  return pushLog(
    state,
    'conscript',
    `${city.name} 征兵 +${total}（扣男成${total}，可征余${maxMen - total}；${goldCost}金/${foodCost}粮）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}

/**
 * 施米：耗粮，提民心（morale）
 */
export function relief(state: GameState, cityId: number, rng: () => number): GameState {
  const city = requirePlayerCity(state, cityId);
  const foodCost = 150;
  if (city.food < foodCost) throw new Error('粮食不足');

  const gain = 8 + Math.floor(rng() * 5);
  const prev = city.stats.morale ?? 70;
  const nextMorale = Math.min(100, prev + gain);

  const nextCity: City = {
    ...city,
    food: city.food - foodCost,
    stats: { ...city.stats, morale: nextMorale },
  };

  return pushLog(
    state,
    'relief',
    `${city.name} 施米安民 民心+${gain}（${prev}→${nextMorale}，耗粮${foodCost}）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}

/**
 * 训练：耗粮，略提士气（troopsMorale）
 */
export function trainTroops(state: GameState, cityId: number, rng: () => number): GameState {
  const city = requirePlayerCity(state, cityId);
  const foodCost = 60;
  if (city.food < foodCost) throw new Error('粮食不足');
  if (city.troops < 100) throw new Error('兵力不足，无法训练');

  const gain = 5 + Math.floor(rng() * 6);
  const prev = city.troopsMorale ?? 70;
  const next = Math.min(100, prev + gain);

  const nextCity: City = {
    ...city,
    food: city.food - foodCost,
    troopsMorale: next,
  };

  return pushLog(
    state,
    'train',
    `${city.name} 训练部队 士气+${gain}（${prev}→${next}，耗粮${foodCost}）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}
