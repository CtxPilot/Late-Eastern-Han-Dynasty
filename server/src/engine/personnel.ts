// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Demo 人事：搜索/登用（男将）+ 婚配 / 赏赐美人
 * 设计参考 04 §3.1~3.2 / §九婚姻 / §十一赏赐；历史女角禁止搜索登用。
 */
import {
  MaritalStatus,
  OfficerStatus,
  canMarchAlongRoad,
  panelStatsDisplay,
  type FemaleCharacter,
  type GameState,
  type Officer,
} from '@leh/shared';
import { joinFaction } from './family.js';
import { syncFactionResources } from './economy.js';

export const MARRY_GOLD = 300;
export const GIFT_BEAUTY_GOLD = 100;
export const MARRY_LOYALTY = 18;
export const GIFT_LOYALTY = 12;

/** 搜索耗金 */
export const SEARCH_GOLD = 80;
/** 登用在野耗金 */
export const RECRUIT_GOLD = 200;
/** 登用成功初始忠诚基线 */
export const RECRUIT_LOYALTY_BASE = 55;

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

/** 在野男将（排除已有势力；武将表不含历史女角） */
export function listFreeOfficers(state: GameState): Officer[] {
  return Object.values(state.officers).filter(
    (o) => o.faction == null && o.status === OfficerStatus.FREE,
  );
}

function pickSearcher(state: GameState, cityId: number, factionId: number): Officer {
  const atCity = Object.values(state.officers).filter(
    (o) =>
      o.faction === factionId &&
      o.status === OfficerStatus.ACTIVE &&
      o.location === cityId,
  );
  const pool =
    atCity.length > 0
      ? atCity
      : Object.values(state.officers).filter(
          (o) => o.faction === factionId && o.status === OfficerStatus.ACTIVE,
        );
  if (pool.length === 0) {
    const rulerId = state.factions[factionId]?.rulerId;
    const ruler = rulerId != null ? state.officers[rulerId] : undefined;
    if (ruler) return ruler;
    throw new Error('无可用搜索武将');
  }
  pool.sort(
    (a, b) =>
      b.stats.intelligence +
      b.stats.charisma -
      (a.stats.intelligence + a.stats.charisma),
  );
  return pool[0];
}

/**
 * 搜索（己方城）：耗金，按搜索者智/魅判定；
 * 成功时优先发现本城/邻接在野将，否则小额金粮，或无收获。
 */
export function searchTalent(state: GameState, cityId: number): GameState {
  const fid = state.playerFactionId;
  const city = state.cities[cityId];
  if (!city) throw new Error('城市不存在');
  if (city.ruler !== fid) throw new Error('只能在己方城搜索');
  if (city.gold < SEARCH_GOLD) throw new Error(`金钱不足（需 ${SEARCH_GOLD}）`);

  const searcher = pickSearcher(state, cityId, fid);
  const successRate = Math.max(
    0.15,
    Math.min(
      0.85,
      searcher.stats.intelligence / 150 + searcher.stats.charisma / 200,
    ),
  );

  const cities = {
    ...state.cities,
    [cityId]: { ...city, gold: city.gold - SEARCH_GOLD },
  };
  let s: GameState = { ...state, cities };

  if (Math.random() > successRate) {
    return pushLog(
      s,
      'personnel_search',
      `${searcher.name} 于 ${city.name} 搜索无果（耗金 ${SEARCH_GOLD}）`,
    );
  }

  // 结果池：在野将 / 金 / 粮 / 无
  const free = listFreeOfficers(s);
  const localOrAdj = free.filter((o) => {
    if (o.location == null) return true;
    if (o.location === cityId) return true;
    return canMarchAlongRoad(o.location, cityId);
  });

  const roll = Math.random();
  // 有候选人时提高「发现武将」权重
  const officerChance = localOrAdj.length > 0 ? 0.7 : 0.15;

  if (roll < officerChance && localOrAdj.length > 0) {
    const found = localOrAdj[Math.floor(Math.random() * localOrAdj.length)];
    // 吸引至搜索城（便于登用）
    const officers = {
      ...s.officers,
      [found.id]: { ...found, location: cityId },
    };
    // 同步城武将列表展示用（仍为在野，不进 faction）
    return pushLog(
      s,
      'personnel_search',
      `${searcher.name} 于 ${city.name} 寻得在野 ${found.name}（相性${found.hidden.compatibility}，可登用，耗金 ${SEARCH_GOLD}）`,
      { officers },
    );
  }

  if (roll < officerChance + 0.2) {
    const gain = 40 + Math.floor(Math.random() * 60);
    const c = s.cities[cityId];
    return pushLog(
      s,
      'personnel_search',
      `${searcher.name} 于 ${city.name} 搜得资财 +${gain} 金（净耗 ${SEARCH_GOLD - gain}）`,
      {
        cities: {
          ...s.cities,
          [cityId]: { ...c, gold: c.gold + gain },
        },
      },
    );
  }

  if (roll < officerChance + 0.35) {
    const gain = 60 + Math.floor(Math.random() * 80);
    const c = s.cities[cityId];
    return pushLog(
      s,
      'personnel_search',
      `${searcher.name} 于 ${city.name} 搜得粮草 +${gain}（耗金 ${SEARCH_GOLD}）`,
      {
        cities: {
          ...s.cities,
          [cityId]: { ...c, food: c.food + gain },
        },
      },
    );
  }

  return pushLog(
    s,
    'personnel_search',
    `${searcher.name} 于 ${city.name} 搜索有感，然无才可录（耗金 ${SEARCH_GOLD}）`,
  );
}

/**
 * 登用率：40% + 魅差×0.3 + (1-|相性差|/150)×40% − 野心×3% + 义理×2%
 * 返回 0~100 百分数
 */
export function calcRecruitChance(
  recruiter: Officer,
  target: Officer,
): number {
  const chaDiff = recruiter.stats.charisma - target.stats.charisma;
  const compatDiff = Math.abs(
    recruiter.hidden.compatibility - target.hidden.compatibility,
  );
  let rate =
    40 +
    chaDiff * 0.3 +
    (1 - compatDiff / 150) * 40 +
    (target.hidden.righteousness ?? 50) * 0.02 -
    (target.hidden.ambition ?? 50) * 0.03;
  return Math.max(5, Math.min(90, rate));
}

/**
 * 登用在野男将：耗金 200；成功则入势力（妻随从 joinFaction）
 */
export function recruitOfficer(
  state: GameState,
  officerId: number,
  recruiterId?: number,
): GameState {
  const fid = state.playerFactionId;
  const target = state.officers[officerId];
  if (!target) throw new Error('武将不存在');
  if (target.faction != null) throw new Error('该武将已有所属势力');
  if (target.status !== OfficerStatus.FREE) {
    throw new Error('仅可登用在野武将');
  }

  // 历史女角不在 officers 表；双保险：无 canCommand 女角路径

  let recruiter: Officer | undefined;
  if (recruiterId != null) {
    recruiter = state.officers[recruiterId];
    if (!recruiter || recruiter.faction !== fid) {
      throw new Error('说客须为己方武将');
    }
  } else {
    // 同城优先，否则君主
    const atLoc =
      target.location != null
        ? Object.values(state.officers).find(
            (o) =>
              o.faction === fid &&
              o.status === OfficerStatus.ACTIVE &&
              o.location === target.location,
          )
        : undefined;
    const rulerId = state.factions[fid]?.rulerId;
    recruiter =
      atLoc ??
      (rulerId != null ? state.officers[rulerId] : undefined) ??
      Object.values(state.officers).find(
        (o) => o.faction === fid && o.status === OfficerStatus.ACTIVE,
      );
  }
  if (!recruiter) throw new Error('无可用说客');

  // 扣金
  const payCity =
    (target.location != null &&
      state.cities[target.location]?.ruler === fid &&
      state.cities[target.location]) ||
    Object.values(state.cities).find((c) => c.ruler === fid && c.gold >= RECRUIT_GOLD);
  if (!payCity || payCity.gold < RECRUIT_GOLD) {
    throw new Error(`金钱不足（需 ${RECRUIT_GOLD}）`);
  }
  let s: GameState = {
    ...state,
    cities: {
      ...state.cities,
      [payCity.id]: { ...payCity, gold: payCity.gold - RECRUIT_GOLD },
    },
  };

  const chance = calcRecruitChance(recruiter, target);
  if (Math.random() * 100 >= chance) {
    return pushLog(
      s,
      'personnel_recruit',
      `${recruiter.name} 招揽 ${target.name} 失败（成功率约 ${Math.round(chance)}%，耗金 ${RECRUIT_GOLD}）`,
    );
  }

  const cityId =
    target.location != null && s.cities[target.location]?.ruler === fid
      ? target.location
      : payCity.id;

  s = joinFaction(s, officerId, fid, cityId, RECRUIT_LOYALTY_BASE + Math.floor(chance / 10));

  // 写入城 officers 列表
  const city = s.cities[cityId];
  if (city && !city.officers.includes(officerId)) {
    s = {
      ...s,
      cities: {
        ...s.cities,
        [cityId]: { ...city, officers: [...city.officers, officerId] },
      },
    };
  }

  s = syncFactionResources(s);
  const joined = s.officers[officerId];
  return pushLog(
    s,
    'personnel_recruit',
    `${recruiter.name} 登用 ${target.name} 成功（忠诚 ${joined?.loyalty ?? RECRUIT_LOYALTY_BASE}，成功率约 ${Math.round(chance)}%，耗金 ${RECRUIT_GOLD}）`,
  );
}

function requirePlayerOfficer(state: GameState, officerId: number): Officer {
  const o = state.officers[officerId];
  if (!o) throw new Error('武将不存在');
  if (o.faction !== state.playerFactionId) throw new Error('非己方武将');
  if (o.status !== OfficerStatus.ACTIVE) throw new Error('武将非现役，不可婚配/赏赐');
  return o;
}

function requirePlayerFemale(state: GameState, femaleId: number): FemaleCharacter {
  const f = state.females[femaleId];
  if (!f) throw new Error('女性不存在');
  if (f.factionId !== state.playerFactionId) throw new Error('非己方势力美人');
  return f;
}

function cityPayGold(state: GameState, cityId: number | null, cost: number): GameState['cities'] {
  // 优先武将所在城扣金；无则任意己方城
  let payId = cityId;
  if (payId == null || state.cities[payId]?.ruler !== state.playerFactionId) {
    const any = Object.values(state.cities).find(
      (c) => c.ruler === state.playerFactionId && c.gold >= cost,
    );
    payId = any?.id ?? null;
  }
  if (payId == null) throw new Error('无可用城池支付金钱');
  const city = state.cities[payId];
  if (city.gold < cost) throw new Error(`${city.name} 金钱不足（需 ${cost}）`);
  return {
    ...state.cities,
    [payId]: { ...city, gold: city.gold - cost },
  };
}

/**
 * 婚配（君主赐婚简化）：己方未婚/寡女 → 己方武将正妻
 * 已有正妻则不可再婚配（妾制全量属 P4）
 */
export function marryFemale(
  state: GameState,
  femaleId: number,
  officerId: number,
): GameState {
  const female = requirePlayerFemale(state, femaleId);
  const officer = requirePlayerOfficer(state, officerId);

  if (female.status === MaritalStatus.MARRIED && female.husbandId != null) {
    throw new Error(`${female.name} 已有婚配`);
  }
  if (female.status !== MaritalStatus.SINGLE && female.status !== MaritalStatus.WIDOW) {
    throw new Error(`${female.name} 当前不可婚配（${female.status}）`);
  }
  if (officer.wifeId != null && state.females[officer.wifeId]) {
    throw new Error(`${officer.name} 已有正妻（Demo 暂不支持多妾）`);
  }
  // 不可自相矛盾：已赏赐给别人则须先处理——允许直接婚配给同一人
  if (
    female.giftedToOfficerId != null &&
    female.giftedToOfficerId !== officerId
  ) {
    throw new Error(`${female.name} 已赏赐给其他武将，请先解除或改赏`);
  }

  const cities = cityPayGold(state, officer.location, MARRY_GOLD);

  // 从原赏赐列表移除
  let officers = { ...state.officers };
  if (female.giftedToOfficerId != null) {
    const prev = officers[female.giftedToOfficerId];
    if (prev) {
      officers[female.giftedToOfficerId] = {
        ...prev,
        beauties: (prev.beauties ?? []).filter((id) => id !== femaleId),
      };
    }
  }

  const nextFemale: FemaleCharacter = {
    ...female,
    status: MaritalStatus.MARRIED,
    husbandId: officerId,
    giftedToOfficerId: null,
    locationId: officer.location ?? female.locationId,
  };

  // 忠诚 + 属性加成（面板顶 100，不碰 hidden）
  const bonus = female.statBonus ?? {};
  const raw = {
    leadership: officer.stats.leadership + (bonus.leadership ?? 0),
    war: officer.stats.war + (bonus.war ?? 0),
    intelligence: officer.stats.intelligence + (bonus.intelligence ?? 0),
    politics: officer.stats.politics + (bonus.politics ?? 0),
    charisma: officer.stats.charisma + (bonus.charisma ?? 0),
  };
  const nextOfficer: Officer = {
    ...officers[officerId],
    loyalty: Math.min(100, officer.loyalty + MARRY_LOYALTY),
    wifeId: femaleId,
    beauties: (officers[officerId].beauties ?? []).filter((id) => id !== femaleId),
    stats: panelStatsDisplay(raw),
  };
  officers = { ...officers, [officerId]: nextOfficer };

  return pushLog(
    state,
    'marry',
    `赐婚：${female.name} 配 ${officer.name}（正妻，忠诚+${MARRY_LOYALTY}，耗金 ${MARRY_GOLD}）`,
    {
      cities,
      females: { ...state.females, [femaleId]: nextFemale },
      officers,
    },
  );
}

/**
 * 赏赐美人：非婚配，挂到武将 beauties；忠诚+
 */
export function giftBeauty(
  state: GameState,
  femaleId: number,
  officerId: number,
): GameState {
  const female = requirePlayerFemale(state, femaleId);
  const officer = requirePlayerOfficer(state, officerId);

  if (female.status === MaritalStatus.MARRIED && female.husbandId != null) {
    throw new Error(`${female.name} 已婚配，不可再作赏赐美人`);
  }
  if (female.giftedToOfficerId === officerId) {
    throw new Error(`已赏赐给 ${officer.name}`);
  }
  if (female.giftedToOfficerId != null && female.giftedToOfficerId !== officerId) {
    throw new Error(`${female.name} 已赏赐给其他武将`);
  }
  if (officer.wifeId === femaleId) {
    throw new Error('已是正妻');
  }

  const cities = cityPayGold(state, officer.location, GIFT_BEAUTY_GOLD);

  let officers = { ...state.officers };
  // 从旧主人列表摘下（一般不应发生）
  if (female.giftedToOfficerId != null) {
    const prev = officers[female.giftedToOfficerId];
    if (prev) {
      officers[female.giftedToOfficerId] = {
        ...prev,
        beauties: (prev.beauties ?? []).filter((id) => id !== femaleId),
      };
    }
  }

  const list = [...(officers[officerId].beauties ?? [])];
  if (!list.includes(femaleId)) list.push(femaleId);

  const nextOfficer: Officer = {
    ...officers[officerId],
    beauties: list,
    loyalty: Math.min(100, officer.loyalty + GIFT_LOYALTY),
  };
  officers = { ...officers, [officerId]: nextOfficer };

  const nextFemale: FemaleCharacter = {
    ...female,
    giftedToOfficerId: officerId,
    locationId: officer.location ?? female.locationId,
  };

  return pushLog(
    state,
    'gift_beauty',
    `赏赐：${female.name} → ${officer.name}（美人，忠诚+${GIFT_LOYALTY}，耗金 ${GIFT_BEAUTY_GOLD}）`,
    {
      cities,
      females: { ...state.females, [femaleId]: nextFemale },
      officers,
    },
  );
}
