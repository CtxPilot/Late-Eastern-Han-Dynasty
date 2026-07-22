// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S09 美女资源：势力库存 + 城可寻次数
 * 04§30 定稿
 */
import {
  BEAUTY_LOOT,
  BEAUTY_REWARD,
  BEAUTY_SEEK,
  beautySeekLeftFromFemales,
  ensureDemographics,
  OfficerStatus,
  type GameState,
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

function ensureFactionBeauty(f: GameState['factions'][number]) {
  return {
    ...f,
    beautyStock: f.beautyStock ?? 0,
  };
}

/**
 * 寻访：己方城；成功势力 stock+1、城 seekLeft−1
 */
export function seekBeauty(
  state: GameState,
  cityId: number,
  rng: () => number,
  factionId?: number,
): GameState {
  const fid = factionId ?? state.playerFactionId;
  const city = state.cities[cityId];
  if (!city) throw new Error('城市不存在');
  if (city.ruler !== fid) throw new Error('非己方城市');

  const seekLeft = city.beautySeekLeft ?? 0;
  if (seekLeft < BEAUTY_SEEK.seekCost) {
    throw new Error(`${city.name} 可寻次数已尽`);
  }
  if (city.gold < BEAUTY_SEEK.goldCost) {
    throw new Error(`金钱不足（需 ${BEAUTY_SEEK.goldCost}）`);
  }

  const d = ensureDemographics(city);
  // 女成越多略易成功
  const popBonus = Math.min(0.2, d.adultFemale / 50000);
  const successRate = Math.min(0.92, BEAUTY_SEEK.baseSuccess + popBonus);
  const success = rng() < successRate;

  const cities = {
    ...state.cities,
    [cityId]: {
      ...city,
      gold: city.gold - BEAUTY_SEEK.goldCost,
    },
  };

  if (!success) {
    return pushLog(
      state,
      'beauty_seek',
      `${city.name} 寻访未果（耗金 ${BEAUTY_SEEK.goldCost}，可寻次数未扣）`,
      { cities },
    );
  }

  const nextCity = {
    ...cities[cityId],
    beautySeekLeft: seekLeft - BEAUTY_SEEK.seekCost,
  };
  cities[cityId] = nextCity;

  const fac = ensureFactionBeauty(state.factions[fid]);
  const factions = {
    ...state.factions,
    [fid]: {
      ...fac,
      beautyStock: fac.beautyStock + BEAUTY_SEEK.stockGain,
    },
  };

  return pushLog(
    state,
    'beauty_seek',
    `${city.name} 寻访成功：势力美女 +${BEAUTY_SEEK.stockGain}（可寻 ${seekLeft}→${nextCity.beautySeekLeft}，耗金 ${BEAUTY_SEEK.goldCost}）`,
    { cities, factions },
  );
}

/**
 * 赏赐美女资源：耗势力 stock，加武将忠诚
 */
export function rewardBeautyStock(
  state: GameState,
  officerId: number,
  amount: number = 1,
): GameState {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('赏赐数量须为正整数');
  }
  const fid = state.playerFactionId;
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  if (officer.faction !== fid) throw new Error('非己方武将');
  if (officer.status !== OfficerStatus.ACTIVE) throw new Error('武将非现役');

  const fac = ensureFactionBeauty(state.factions[fid]);
  if (fac.beautyStock < amount) {
    throw new Error(`美女库存不足（需 ${amount}，当前 ${fac.beautyStock}）`);
  }

  const loyaltyGain = BEAUTY_REWARD.loyaltyGain * amount;
  const officers = {
    ...state.officers,
    [officerId]: {
      ...officer,
      loyalty: Math.min(100, officer.loyalty + loyaltyGain),
    },
  };
  const factions = {
    ...state.factions,
    [fid]: {
      ...fac,
      beautyStock: fac.beautyStock - amount,
    },
  };

  return pushLog(
    state,
    'beauty_reward',
    `赏赐美女×${amount} 予 ${officer.name}（忠诚+${loyaltyGain}，库存 ${fac.beautyStock}→${fac.beautyStock - amount}）`,
    { officers, factions },
  );
}

/**
 * 占城抢夺：攻击方势力 +gain，城 seekLeft −gain，民忠降
 * 由 march.settleBattle 调用
 */
export function lootBeautyOnCapture(
  state: GameState,
  cityId: number,
  attackerFactionId: number,
  rng: () => number,
): GameState {
  const city = state.cities[cityId];
  if (!city) return state;
  const seekLeft = city.beautySeekLeft ?? 0;
  if (seekLeft <= 0) {
    // 仍可降一点民忠表示劫掠
    const moraleLoss = 5;
    return {
      ...state,
      cities: {
        ...state.cities,
        [cityId]: {
          ...city,
          stats: {
            ...city.stats,
            morale: Math.max(10, (city.stats.morale ?? 70) - moraleLoss),
          },
        },
      },
    };
  }

  const raw =
    BEAUTY_LOOT.gainMin +
    Math.floor(rng() * (BEAUTY_LOOT.gainMax - BEAUTY_LOOT.gainMin + 1));
  const gain = Math.min(raw, seekLeft);
  const moraleLoss =
    BEAUTY_LOOT.moraleLossMin +
    Math.floor(
      rng() *
        (BEAUTY_LOOT.moraleLossMax - BEAUTY_LOOT.moraleLossMin + 1),
    );

  const cities = {
    ...state.cities,
    [cityId]: {
      ...city,
      beautySeekLeft: seekLeft - gain,
      stats: {
        ...city.stats,
        morale: Math.max(10, (city.stats.morale ?? 70) - moraleLoss),
      },
    },
  };

  const facRaw = state.factions[attackerFactionId];
  if (!facRaw) return { ...state, cities };

  const fac = ensureFactionBeauty(facRaw);

  const factions = {
    ...state.factions,
    [attackerFactionId]: {
      ...fac,
      beautyStock: (fac.beautyStock ?? 0) + gain,
    },
  };

  return pushLog(
    state,
    'beauty_loot',
    `攻占 ${city.name} 抢夺美女 +${gain}（可寻 −${gain}，民忠 −${moraleLoss}）`,
    { cities, factions },
  );
}

export { beautySeekLeftFromFemales };
