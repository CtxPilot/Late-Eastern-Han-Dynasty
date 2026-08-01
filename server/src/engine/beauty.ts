// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S09 宫廷人脉：势力库存 + 城市结交机会
 * 04§30 定稿
 */
import {
  BEAUTY_LOOT,
  BEAUTY_REWARD,
  BEAUTY_SEEK,
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

function ensureFactionNetwork(f: GameState['factions'][number]) {
  return {
    ...f,
    courtNetwork: f.courtNetwork ?? 0,
  };
}

/**
 * 地方结交：己方城；成功势力人脉+1、城市机会−1
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

  const seekLeft = city.courtNetworkOpportunities ?? 0;
  if (seekLeft < BEAUTY_SEEK.seekCost) {
    throw new Error(`${city.name} 人脉机会已尽`);
  }
  if (city.gold < BEAUTY_SEEK.goldCost) {
    throw new Error(`金钱不足（需 ${BEAUTY_SEEK.goldCost}）`);
  }

  const success = rng() < BEAUTY_SEEK.baseSuccess;

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
      `${city.name} 结交未果（耗金 ${BEAUTY_SEEK.goldCost}，人脉机会未扣）`,
      { cities },
    );
  }

  const nextCity = {
    ...cities[cityId],
    courtNetworkOpportunities: seekLeft - BEAUTY_SEEK.seekCost,
  };
  cities[cityId] = nextCity;

  const fac = ensureFactionNetwork(state.factions[fid]);
  const factions = {
    ...state.factions,
    [fid]: {
      ...fac,
      courtNetwork: fac.courtNetwork + BEAUTY_SEEK.stockGain,
    },
  };

  return pushLog(
    state,
    'beauty_seek',
    `${city.name} 结交成功：宫廷人脉 +${BEAUTY_SEEK.stockGain}（机会 ${seekLeft}→${nextCity.courtNetworkOpportunities}，耗金 ${BEAUTY_SEEK.goldCost}）`,
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
  // 君主特例（docs/04 §3.8 切片 C）：不得动用宫廷人脉笼络君主（忠诚±对君主不生效）
  if (officer.faction != null && state.factions[officer.faction]?.rulerId === officerId) {
    throw new Error(`${officer.name} 是君主，不参与笼络（§3.8 君主特例）`);
  }

  const fac = ensureFactionNetwork(state.factions[fid]);
  if (fac.courtNetwork < amount) {
    throw new Error(`宫廷人脉不足（需 ${amount}，当前 ${fac.courtNetwork}）`);
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
      courtNetwork: fac.courtNetwork - amount,
    },
  };

  return pushLog(
    state,
    'beauty_reward',
    `动用人脉×${amount} 笼络 ${officer.name}（忠诚+${loyaltyGain}，库存 ${fac.courtNetwork}→${fac.courtNetwork - amount}）`,
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
  const seekLeft = city.courtNetworkOpportunities ?? 0;
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
      courtNetworkOpportunities: seekLeft - gain,
      stats: {
        ...city.stats,
        morale: Math.max(10, (city.stats.morale ?? 70) - moraleLoss),
      },
    },
  };

  const facRaw = state.factions[attackerFactionId];
  if (!facRaw) return { ...state, cities };

  const fac = ensureFactionNetwork(facRaw);

  const factions = {
    ...state.factions,
    [attackerFactionId]: {
      ...fac,
      courtNetwork: (fac.courtNetwork ?? 0) + gain,
    },
  };

  return pushLog(
    state,
    'beauty_loot',
    `攻占 ${city.name} 接管地方人脉 +${gain}（机会 −${gain}，民忠 −${moraleLoss}）`,
    { cities, factions },
  );
}
