// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Demo 外交：进贡、献美、缔结盟约（与谍报盟友可见联动）
 * 献美 S08∩S09：转移 beautyStock，抬友好（非历史女角）
 */
import {
  DipRelation,
  findDiplomacy,
  type DiplomacyLink,
  type GameState,
} from '@leh/shared';
import { syncFactionResources } from './economy.js';

export const TRIBUTE_GOLD = 200;
export const TRIBUTE_FAVOR = 15;
export const ALLIANCE_GOLD = 500;
export const ALLIANCE_MIN_FAVOR = 30;
/** 献美：每点 beauty 友好增量 */
export const GIFT_BEAUTY_FAVOR_PER = 12;
export const GIFT_BEAUTY_MAX = 5;

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

function payFromAnyPlayerCity(state: GameState, cost: number): GameState['cities'] {
  const city = Object.values(state.cities).find(
    (c) => c.ruler === state.playerFactionId && c.gold >= cost,
  );
  if (!city) throw new Error(`己方城金钱不足（需 ${cost}）`);
  return {
    ...state.cities,
    [city.id]: { ...city, gold: city.gold - cost },
  };
}

function upsertLink(
  links: DiplomacyLink[],
  a: number,
  b: number,
  patch: Partial<DiplomacyLink>,
): DiplomacyLink[] {
  const existing = findDiplomacy(links, a, b);
  if (!existing) {
    return [
      ...links,
      {
        factionA: a,
        factionB: b,
        relation: DipRelation.NEUTRAL,
        favorability: 0,
        ...patch,
      },
    ];
  }
  return links.map((l) => {
    const match =
      (l.factionA === a && l.factionB === b) ||
      (l.factionA === b && l.factionB === a);
    return match ? { ...l, ...patch } : l;
  });
}

/** 进贡：抬友好度；友好≥30 时可进一步结盟 */
export function tributeGold(state: GameState, targetFactionId: number): GameState {
  if (targetFactionId === state.playerFactionId) throw new Error('不能向本势力进贡');
  if (!state.factions[targetFactionId]) throw new Error('目标势力不存在');

  const cities = payFromAnyPlayerCity(state, TRIBUTE_GOLD);
  const link = findDiplomacy(state.diplomacy, state.playerFactionId, targetFactionId);
  const prevFav = link?.favorability ?? 0;
  const nextFav = Math.min(100, prevFav + TRIBUTE_FAVOR);
  let relation = (link?.relation as string) ?? DipRelation.NEUTRAL;
  if (relation === DipRelation.WAR || relation === 'war') {
    // 战争中进贡：略缓，仍 hostile 向
    relation = DipRelation.HOSTILE;
  } else if (nextFav >= 30 && relation !== DipRelation.ALLIED && relation !== 'allied') {
    relation = DipRelation.FRIENDLY;
  }

  const diplomacy = upsertLink(
    state.diplomacy,
    state.playerFactionId,
    targetFactionId,
    {
      favorability: nextFav,
      relation: relation as DiplomacyLink['relation'],
    },
  );

  const name = state.factions[targetFactionId].name;
  const withCities = pushLog(
    state,
    'tribute',
    `向 ${name} 进贡 ${TRIBUTE_GOLD} 金（友好 ${prevFav}→${nextFav}）`,
    { cities, diplomacy },
  );
  return syncFactionResources(withCities);
}

/**
 * 外交献美（S08∩S09）：己方 beautyStock −n → 对方 +n，友好 +12×n
 * 累计 plantableBeauty，可供「点化女间谍」
 */
export function giftBeautyStock(
  state: GameState,
  targetFactionId: number,
  amount = 1,
): GameState {
  const fid = state.playerFactionId;
  if (targetFactionId === fid) throw new Error('不能向本势力献美');
  const target = state.factions[targetFactionId];
  if (!target?.isAlive) throw new Error('目标势力不存在或已灭亡');

  const n = Math.floor(amount);
  if (!Number.isFinite(n) || n < 1) throw new Error('献美数量须为正整数');
  if (n > GIFT_BEAUTY_MAX) throw new Error(`单次最多献美 ${GIFT_BEAUTY_MAX}`);

  const self = state.factions[fid];
  if (!self) throw new Error('本势力不存在');
  const stock = self.beautyStock ?? 0;
  if (stock < n) throw new Error(`美女资源不足（需 ${n}，当前 ${stock}）`);

  const link = findDiplomacy(state.diplomacy, fid, targetFactionId);
  const rel = (link?.relation as string) ?? DipRelation.NEUTRAL;
  if (rel === DipRelation.WAR || rel === 'war') {
    throw new Error('交战中无法献美（请先停战）');
  }

  const favorGain = GIFT_BEAUTY_FAVOR_PER * n;
  const prevFav = link?.favorability ?? 0;
  const nextFav = Math.min(100, prevFav + favorGain);
  let relation = rel;
  if (nextFav >= 30 && relation !== DipRelation.ALLIED && relation !== 'allied') {
    relation = DipRelation.FRIENDLY;
  }

  const factions = {
    ...state.factions,
    [fid]: { ...self, beautyStock: stock - n },
    [targetFactionId]: {
      ...target,
      beautyStock: (target.beautyStock ?? 0) + n,
    },
  };

  const diplomacy = upsertLink(state.diplomacy, fid, targetFactionId, {
    favorability: nextFav,
    relation: relation as DiplomacyLink['relation'],
  });

  // 掩护线：累计可点化额度
  const intel = state.intel ?? { cities: {}, agents: {}, cityDefense: {}, nextAgentSeq: 1, recentMissions: [], plantableBeauty: {} };
  const plantable = { ...(intel.plantableBeauty ?? {}) };
  plantable[targetFactionId] = (plantable[targetFactionId] ?? 0) + n;

  return pushLog(
    state,
    'gift_beauty_dip',
    `向 ${target.name} 献美 ×${n}（友好 ${prevFav}→${nextFav}；己方库存 ${stock}→${stock - n}；可点化 ${plantable[targetFactionId]}）`,
    {
      factions,
      diplomacy,
      intel: { ...intel, plantableBeauty: plantable },
    },
  );
}

/** 缔结盟约：友好≥30 且非战争 */
export function formAlliance(state: GameState, targetFactionId: number): GameState {
  if (targetFactionId === state.playerFactionId) throw new Error('不能与本势力结盟');
  if (!state.factions[targetFactionId]) throw new Error('目标势力不存在');

  const link = findDiplomacy(state.diplomacy, state.playerFactionId, targetFactionId);
  const fav = link?.favorability ?? 0;
  const rel = (link?.relation as string) ?? DipRelation.NEUTRAL;
  if (rel === DipRelation.WAR || rel === 'war') {
    throw new Error('交战中无法结盟，请先停战（后续）');
  }
  if (rel === DipRelation.ALLIED || rel === 'allied') {
    throw new Error('已是同盟');
  }
  if (fav < ALLIANCE_MIN_FAVOR) {
    throw new Error(`友好不足（需≥${ALLIANCE_MIN_FAVOR}，当前 ${fav}；可先「进贡」）`);
  }

  const cities = payFromAnyPlayerCity(state, ALLIANCE_GOLD);
  const diplomacy = upsertLink(
    state.diplomacy,
    state.playerFactionId,
    targetFactionId,
    {
      relation: DipRelation.ALLIED,
      favorability: Math.max(fav, ALLIANCE_MIN_FAVOR + 10),
    },
  );

  const name = state.factions[targetFactionId].name;
  const withCities = pushLog(
    state,
    'alliance',
    `与 ${name} 缔结盟约（耗金 ${ALLIANCE_GOLD}；盟友城池情报部分共享）`,
    { cities, diplomacy },
  );
  return syncFactionResources(withCities);
}
