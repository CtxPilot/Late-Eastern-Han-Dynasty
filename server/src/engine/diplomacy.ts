// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Demo 外交：进贡、宫廷牵线、缔结盟约（与谍报盟友可见联动）
 * 宫廷交涉 S08∩S09：转移 courtNetwork，抬友好（非历史女角）
 */
import {
  DipRelation,
  calculateAllianceChance,
  calculateTruceChance,
  calculateVassalChance,
  controlsEmperor,
  findDiplomacy,
  hegemonyFavorMultiplier,
  initialDiplomacyFavorBonus,
  type Coalition,
  type DiplomacyLink,
  type GameState,
} from '@leh/shared';
import { syncFactionResources } from './economy.js';
import { grantMeritTo } from './meritGrant.js';
import { FAME_ALLIANCE, grantFame } from './factionPolitics.js';

// 功绩获取数值（docs/04 §6.1 外交条；固定值不消耗权威 RNG，待平衡）
const MERIT_ALLIANCE = 10;

export const TRIBUTE_GOLD = 200;
export const TRIBUTE_FAVOR = 15;
export const ALLIANCE_GOLD = 500;
export const ALLIANCE_MIN_FAVOR = 30;
export const TRUCE_GOLD = 500;
export const FAME_BREAK_ALLIANCE_PENALTY = 50;
export const MORALE_BREAK_ALLIANCE_PENALTY = 10;
export const FAME_VASSAL_OVERLORD = 30;
export const FAME_RELEASE_VASSAL = 15;

/** 宫廷牵线：每点人脉友好增量 */
export const COURT_NETWORK_FAVOR_PER = 12;
export const COURT_NETWORK_TRANSFER_MAX = 5;

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

export function upsertLink(
  links: DiplomacyLink[],
  a: number,
  b: number,
  patch: Partial<DiplomacyLink>,
  state?: GameState,
): DiplomacyLink[] {
  const existing = findDiplomacy(links, a, b);
  if (!existing) {
    const initialFavor = state
      ? initialDiplomacyFavorBonus(state, a, b)
      : 0;
    return [
      ...links,
      {
        factionA: a,
        factionB: b,
        relation: DipRelation.NEUTRAL,
        favorability: initialFavor,
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

/** 进贡：抬友好度；友好≥30 时可进一步结盟。HC-P0-5：发起方霸府/王/帝阶段友好增量按倍数放大。 */
export function tributeGold(state: GameState, targetFactionId: number): GameState {
  if (targetFactionId === state.playerFactionId) throw new Error('不能向本势力进贡');
  if (!state.factions[targetFactionId]) throw new Error('目标势力不存在');

  const cities = payFromAnyPlayerCity(state, TRIBUTE_GOLD);
  const link = findDiplomacy(state.diplomacy, state.playerFactionId, targetFactionId);
  const prevFav = link?.favorability
    ?? initialDiplomacyFavorBonus(state, state.playerFactionId, targetFactionId);
  const favorGain = Math.round(TRIBUTE_FAVOR * hegemonyFavorMultiplier(
    state.factions[state.playerFactionId]?.politicalStage,
  ));
  const nextFav = Math.min(100, prevFav + favorGain);
  let relation = (link?.relation as string) ?? DipRelation.NEUTRAL;
  if (relation === DipRelation.WAR || relation === 'war') {
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
    state,
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
 * 外交牵线（S08∩S09）：己方 courtNetwork −n → 对方 +n，友好 +12×n
 * 累计 plantableBeauty，可供「点化女间谍」
 * HC-P0-5：发起方霸府/王/帝阶段友好增量按 hegemonyFavorMultiplier 放大。
 */
export function transferCourtNetwork(
  state: GameState,
  targetFactionId: number,
  amount = 1,
): GameState {
  const fid = state.playerFactionId;
  if (targetFactionId === fid) throw new Error('不能向本势力牵线');
  const target = state.factions[targetFactionId];
  if (!target?.isAlive) throw new Error('目标势力不存在或已灭亡');

  const n = Math.floor(amount);
  if (!Number.isFinite(n) || n < 1) throw new Error('牵线数量须为正整数');
  if (n > COURT_NETWORK_TRANSFER_MAX) throw new Error(`单次最多牵线 ${COURT_NETWORK_TRANSFER_MAX}`);

  const self = state.factions[fid];
  if (!self) throw new Error('本势力不存在');
  const stock = self.courtNetwork ?? 0;
  if (stock < n) throw new Error(`宫廷人脉不足（需 ${n}，当前 ${stock}）`);

  const link = findDiplomacy(state.diplomacy, fid, targetFactionId);
  const rel = (link?.relation as string) ?? DipRelation.NEUTRAL;
  if (rel === DipRelation.WAR || rel === 'war') {
    throw new Error('交战中无法牵线（请先停战）');
  }

  const multiplier = hegemonyFavorMultiplier(self.politicalStage);
  const favorGain = Math.round(COURT_NETWORK_FAVOR_PER * n * multiplier);
  const prevFav = link?.favorability
    ?? initialDiplomacyFavorBonus(state, fid, targetFactionId);
  const nextFav = Math.min(100, prevFav + favorGain);
  let relation = rel;
  if (nextFav >= 30 && relation !== DipRelation.ALLIED && relation !== 'allied') {
    relation = DipRelation.FRIENDLY;
  }

  const factions = {
    ...state.factions,
    [fid]: { ...self, courtNetwork: stock - n },
    [targetFactionId]: {
      ...target,
      courtNetwork: (target.courtNetwork ?? 0) + n,
    },
  };

  const diplomacy = upsertLink(state.diplomacy, fid, targetFactionId, {
    favorability: nextFav,
    relation: relation as DiplomacyLink['relation'],
  }, state);

  const intel = state.intel ?? { cities: {}, agents: {}, cityDefense: {}, nextAgentSeq: 1, recentMissions: [], plantableBeauty: {} };
  const plantable = { ...(intel.plantableBeauty ?? {}) };
  plantable[targetFactionId] = (plantable[targetFactionId] ?? 0) + n;

  return pushLog(
    state,
    'gift_beauty_dip',
    `向 ${target.name} 宫廷牵线 ×${n}（友好 ${prevFav}→${nextFav}；己方人脉 ${stock}→${stock - n}；掩护额度 ${plantable[targetFactionId]}）`,
    {
      factions,
      diplomacy,
      intel: { ...intel, plantableBeauty: plantable },
    },
  );
}

/** 缔结盟约：友好≥30 且非战争；消耗一次权威 RNG 进行百分点判定。 */
export function formAlliance(
  state: GameState,
  targetFactionId: number,
  rng: () => number,
): GameState {
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
  const breakdown = calculateAllianceChance(state, targetFactionId);
  const envoy = state.officers[breakdown.envoyId];
  if (rng() * 100 >= breakdown.chance) {
    const name = state.factions[targetFactionId].name;
    const withCities = pushLog(
      state,
      'alliance',
      `${envoy.name} 与 ${name} 结盟交涉失败（成功率 ${Math.round(breakdown.chance)}%，耗金 ${ALLIANCE_GOLD}）`,
      { cities },
    );
    return syncFactionResources(withCities);
  }
  const diplomacy = upsertLink(
    state.diplomacy,
    state.playerFactionId,
    targetFactionId,
    {
      relation: DipRelation.ALLIED,
      favorability: Math.max(fav, ALLIANCE_MIN_FAVOR + 10),
    },
    state,
  );

  const name = state.factions[targetFactionId].name;
  const withMerit = envoy ? grantMeritTo(state, envoy.id, MERIT_ALLIANCE) : state;
  // S27 声望：结盟 +10（docs/08 §十七）
  const withFame = grantFame(withMerit, state.playerFactionId, FAME_ALLIANCE);
  const withCities = pushLog(
    withFame,
    'alliance',
    `${envoy.name} 与 ${name} 缔结盟约（成功率 ${Math.round(breakdown.chance)}%，耗金 ${ALLIANCE_GOLD}；盟友城池情报部分共享；声望+${FAME_ALLIANCE}）`,
    { cities, diplomacy },
  );
  return syncFactionResources(withCities);
}

/**
 * 宣战（docs/04 §5.1 #7 宣战）
 * 若在同盟期或停战保护期内单方面宣战，视为背信弃义，触发声望大损与全城士气惩罚。
 */
export function declareWar(
  state: GameState,
  targetFactionId: number,
  sourceFactionId: number = state.playerFactionId,
): GameState {
  if (targetFactionId === sourceFactionId) throw new Error('不能向本势力宣战');
  const target = state.factions[targetFactionId];
  if (!target || !target.isAlive) throw new Error('目标势力不存在或已灭亡');
  const source = state.factions[sourceFactionId];
  if (!source) throw new Error('发起势力不存在');

  const link = findDiplomacy(state.diplomacy, sourceFactionId, targetFactionId);
  const rel = (link?.relation as string) ?? DipRelation.NEUTRAL;
  if (rel === DipRelation.WAR || rel === 'war') {
    throw new Error('双方已处于交战状态');
  }

  const isAllied = rel === DipRelation.ALLIED || rel === 'allied';
  const hasTruce = (link?.truceMonths ?? 0) > 0;
  const isBetrayal = isAllied || hasTruce;

  let nextFame = source.fame ?? 0;
  const cities = { ...state.cities };
  if (isBetrayal) {
    nextFame = Math.max(0, nextFame - FAME_BREAK_ALLIANCE_PENALTY);
    for (const cid of source.cityIds) {
      const c = cities[cid];
      if (c) {
        cities[cid] = {
          ...c,
          troopsMorale: Math.max(0, (c.troopsMorale ?? 50) - MORALE_BREAK_ALLIANCE_PENALTY),
        };
      }
    }
  }

  const factions = {
    ...state.factions,
    [sourceFactionId]: { ...source, fame: nextFame },
  };

  // 双方关系置为 WAR，友好置为 -80，停火期归零
  let diplomacy = upsertLink(
    state.diplomacy,
    sourceFactionId,
    targetFactionId,
    {
      relation: DipRelation.WAR,
      favorability: isBetrayal ? -100 : -80,
      truceMonths: 0,
    },
    state,
  );

  // 若目标势力是从属国，宗主国自动参战
  if (target.overlordFactionId && target.overlordFactionId !== sourceFactionId) {
    const overlordId = target.overlordFactionId;
    diplomacy = upsertLink(
      diplomacy,
      sourceFactionId,
      overlordId,
      {
        relation: DipRelation.WAR,
        favorability: -80,
        truceMonths: 0,
      },
      state,
    );
  }

  const msg = isBetrayal
    ? `【背信弃义】向 ${target.name} 悍然宣战！撕毁盟约停火协议，声望大损 ${FAME_BREAK_ALLIANCE_PENALTY} 点，全城士气 -${MORALE_BREAK_ALLIANCE_PENALTY}！`
    : `正式向 ${target.name} 宣战，金鼓齐鸣，天下震动！`;

  return pushLog(state, 'declare_war', msg, {
    factions,
    cities,
    diplomacy,
  });
}

/**
 * 停战停火协议（docs/04 §5.1 #2 停战）
 */
export function proposeTruce(
  state: GameState,
  targetFactionId: number,
  sourceFactionId: number = state.playerFactionId,
  months: number = 12,
  rng: () => number = () => 0.5,
): GameState {
  if (targetFactionId === sourceFactionId) throw new Error('不能与本势力停战');
  const target = state.factions[targetFactionId];
  if (!target || !target.isAlive) throw new Error('目标势力不存在或已灭亡');

  const link = findDiplomacy(state.diplomacy, sourceFactionId, targetFactionId);
  const rel = (link?.relation as string) ?? DipRelation.NEUTRAL;
  if (rel !== DipRelation.WAR && rel !== 'war' && rel !== DipRelation.HOSTILE && rel !== 'hostile') {
    throw new Error('双方未处于交战或敌对状态，无需停火协议');
  }

  const cities = payFromAnyPlayerCity(state, TRUCE_GOLD);
  const breakdown = calculateTruceChance(state, targetFactionId, sourceFactionId);
  const envoy = state.officers[breakdown.envoyId];

  if (rng() * 100 >= breakdown.chance) {
    const withCities = pushLog(
      state,
      'truce',
      `${envoy.name} 与 ${target.name} 停战交涉失败（成功率 ${Math.round(breakdown.chance)}%，耗金 ${TRUCE_GOLD}）`,
      { cities },
    );
    return syncFactionResources(withCities);
  }

  const diplomacy = upsertLink(
    state.diplomacy,
    sourceFactionId,
    targetFactionId,
    {
      relation: DipRelation.NEUTRAL,
      favorability: 0,
      truceMonths: months,
    },
    state,
  );

  const withCities = pushLog(
    state,
    'truce',
    `${envoy.name} 与 ${target.name} 达成停战协议（成功率 ${Math.round(breakdown.chance)}%，耗金 ${TRUCE_GOLD}，停火期 ${months} 个月）`,
    { cities, diplomacy },
  );
  return syncFactionResources(withCities);
}

/**
 * 迫使从属（docs/04 §5.1 #5 从属）
 */
export function demandVassal(
  state: GameState,
  targetFactionId: number,
  sourceFactionId: number = state.playerFactionId,
  rng: () => number = () => 0.5,
): GameState {
  if (targetFactionId === sourceFactionId) throw new Error('不能降伏本势力');
  const target = state.factions[targetFactionId];
  if (!target || !target.isAlive) throw new Error('目标势力不存在或已灭亡');
  const source = state.factions[sourceFactionId];
  if (!source) throw new Error('发起势力不存在');
  if (target.overlordFactionId) throw new Error('目标势力已是他人附庸，需先解除其宗属');

  const breakdown = calculateVassalChance(state, targetFactionId, sourceFactionId);
  if (breakdown.chance <= 0) {
    throw new Error('双方实力尚未达到绝对悬殊（需城池≥2倍且兵力≥3倍），对方誓死不降');
  }

  const envoy = state.officers[breakdown.envoyId];
  if (rng() * 100 >= breakdown.chance) {
    return pushLog(
      state,
      'vassal_demand',
      `${envoy.name} 招谕 ${target.name} 臣属失败（成功率 ${Math.round(breakdown.chance)}%），对方拒不纳贡称臣`,
    );
  }

  // 成功降伏
  const factions = {
    ...state.factions,
    [targetFactionId]: {
      ...target,
      overlordFactionId: sourceFactionId,
    },
    [sourceFactionId]: {
      ...source,
      vassalFactionIds: [...(source.vassalFactionIds ?? []).filter((id) => id !== targetFactionId), targetFactionId],
      fame: Math.min(1000, (source.fame ?? 0) + FAME_VASSAL_OVERLORD),
    },
  };

  const diplomacy = upsertLink(
    state.diplomacy,
    sourceFactionId,
    targetFactionId,
    {
      relation: DipRelation.ALLIED,
      favorability: 50,
      truceMonths: 0,
    },
    state,
  );

  return pushLog(
    state,
    'vassal_demand',
    `${envoy.name} 谕降成功！${target.name} 俯首称臣，成为我方从属诸侯（声望 +${FAME_VASSAL_OVERLORD}，岁首纳贡 15% 金粮）`,
    { factions, diplomacy },
  );
}

/**
 * 主动称臣从属（弱小势力主动投效大国求庇护）
 */
export function submitVassal(
  state: GameState,
  overlordFactionId: number,
  sourceFactionId: number = state.playerFactionId,
): GameState {
  if (overlordFactionId === sourceFactionId) throw new Error('不能称臣于自己');
  const overlord = state.factions[overlordFactionId];
  if (!overlord || !overlord.isAlive) throw new Error('宗主势力不存在或已灭亡');
  const source = state.factions[sourceFactionId];
  if (!source) throw new Error('本势力不存在');

  const factions = {
    ...state.factions,
    [sourceFactionId]: {
      ...source,
      overlordFactionId,
    },
    [overlordFactionId]: {
      ...overlord,
      vassalFactionIds: [...(overlord.vassalFactionIds ?? []).filter((id) => id !== sourceFactionId), sourceFactionId],
    },
  };

  const diplomacy = upsertLink(
    state.diplomacy,
    sourceFactionId,
    overlordFactionId,
    {
      relation: DipRelation.ALLIED,
      favorability: 50,
    },
    state,
  );

  return pushLog(
    state,
    'vassal_submit',
    `向 ${overlord.name} 俯首称臣，尊其为宗主国，寻求大国庇护（岁首纳贡 15% 金粮）`,
    { factions, diplomacy },
  );
}

/**
 * 解放从属国（docs/04 §5.1 #6 解放）
 */
export function releaseVassal(
  state: GameState,
  targetFactionId: number,
  sourceFactionId: number = state.playerFactionId,
): GameState {
  const target = state.factions[targetFactionId];
  if (!target) throw new Error('目标势力不存在');
  if (target.overlordFactionId !== sourceFactionId) {
    throw new Error('目标非己方从属势力');
  }
  const source = state.factions[sourceFactionId];

  const factions = {
    ...state.factions,
    [targetFactionId]: {
      ...target,
      overlordFactionId: undefined,
    },
    [sourceFactionId]: {
      ...source,
      vassalFactionIds: (source?.vassalFactionIds ?? []).filter((id) => id !== targetFactionId),
      fame: Math.min(1000, (source?.fame ?? 0) + FAME_RELEASE_VASSAL),
    },
  };

  const diplomacy = upsertLink(
    state.diplomacy,
    sourceFactionId,
    targetFactionId,
    {
      relation: DipRelation.FRIENDLY,
      favorability: 80,
    },
    state,
  );

  return pushLog(
    state,
    'vassal_release',
    `宽宥解放从属诸侯 ${target.name}，归还其独立主权（友好度升至 80，声望 +${FAME_RELEASE_VASSAL}）`,
    { factions, diplomacy },
  );
}

/**
 * 组建多方会盟（docs/04 §5.1 联盟体系）
 */
export function formCoalition(
  state: GameState,
  coalitionId: string,
  name: string,
  targetFactionId: number,
  memberFactionIds: number[],
  durationMonths: number = 24,
  leaderFactionId: number = state.playerFactionId,
): GameState {
  let members = [...memberFactionIds];
  if (!members.includes(leaderFactionId)) {
    members = [leaderFactionId, ...members];
  }
  const target = state.factions[targetFactionId];
  if (!target || !target.isAlive) throw new Error('盟约讨伐目标不存在或已灭亡');

  const coalition: Coalition = {
    id: coalitionId,
    name,
    leaderFactionId,
    targetFactionId,
    memberFactionIds: members,
    startYear: state.currentYear,
    startMonth: state.currentMonth,
    durationMonths,
    remainingMonths: durationMonths,
    jointWarActive: false,
  };

  const existingCoalitions = (state.coalitions ?? []).filter((c) => c.id !== coalitionId);
  const nextCoalitions = [...existingCoalitions, coalition];

  // 更新各势力 coalitionId
  const factions = { ...state.factions };
  for (const mid of members) {
    if (factions[mid]) {
      factions[mid] = { ...factions[mid], coalitionId };
    }
  }

  // 盟内成员互相同盟，且全员对 target 宣战
  let diplomacy = [...state.diplomacy];
  for (let i = 0; i < members.length; i++) {
    const a = members[i];
    // 对 target 宣战
    diplomacy = upsertLink(diplomacy, a, targetFactionId, {
      relation: DipRelation.WAR,
      favorability: -80,
      coalitionId,
    }, state);

    for (let j = i + 1; j < members.length; j++) {
      const b = members[j];
      diplomacy = upsertLink(diplomacy, a, b, {
        relation: DipRelation.ALLIED,
        coalitionId,
      }, state);
    }
  }

  return pushLog(
    state,
    'coalition_form',
    `诸侯盟誓：${name} 正式结成！推举 ${state.factions[leaderFactionId]?.name} 为盟主，共讨国贼 ${target.name}（盟约期 ${durationMonths} 个月）`,
    {
      coalitions: nextCoalitions,
      factions,
      diplomacy,
    },
  );
}

/**
 * 盟主发起共同作战动员令（docs/04 §5.1 #4 共同作战）
 */
export function callJointWar(
  state: GameState,
  coalitionId: string,
  callerFactionId: number = state.playerFactionId,
): GameState {
  const coalition = (state.coalitions ?? []).find((c) => c.id === coalitionId);
  if (!coalition) throw new Error('会盟不存在');
  if (coalition.leaderFactionId !== callerFactionId) {
    throw new Error('只有盟主方可发布共同作战号召');
  }

  const updatedCoalitions = (state.coalitions ?? []).map((c) =>
    c.id === coalitionId ? { ...c, jointWarActive: true } : c,
  );

  // 盟内所有城池部队士气 +5
  const cities = { ...state.cities };
  for (const mid of coalition.memberFactionIds) {
    const mf = state.factions[mid];
    if (mf) {
      for (const cid of mf.cityIds) {
        const city = cities[cid];
        if (city) {
          cities[cid] = {
            ...city,
            troopsMorale: Math.min(100, (city.troopsMorale ?? 50) + 5),
          };
        }
      }
    }
  }

  return pushLog(
    state,
    'coalition_joint_war',
    `盟主 ${state.factions[callerFactionId]?.name} 发布「共同作战」动员令：三军奋勇，会猎白刃！各参盟城池驻军士气 +5！`,
    {
      coalitions: updatedCoalitions,
      cities,
    },
  );
}

/**
 * 挟天子以令诸侯：天子明诏系统（docs/04 §五 & docs/26）
 */
export function issueImperialDecree(
  state: GameState,
  type: 'denounce_traitor' | 'appoint_prov_governor' | 'summon_tribute',
  targetFactionId: number,
  extraProvince?: string,
): GameState {
  if (!controlsEmperor(state, state.playerFactionId)) {
    throw new Error('当前势力未迎奉汉帝，无权假托天子诏命');
  }
  const target = state.factions[targetFactionId];
  if (!target || !target.isAlive) throw new Error('目标诸侯不存在或已灭亡');
  const player = state.factions[state.playerFactionId];

  if (type === 'denounce_traitor') {
    // 讨逆明诏：目标天命-10、人心-10；汉室忠臣对其友好 -20
    const nextMandate = Math.max(0, (target.mandate ?? 50) - 10);
    const nextWill = Math.max(0, (target.popularWill ?? 50) - 10);
    const factions = {
      ...state.factions,
      [targetFactionId]: {
        ...target,
        mandate: nextMandate,
        popularWill: nextWill,
      },
    };

    // 所有忠汉势力对该逆贼好感 -20
    let diplomacy = [...state.diplomacy];
    for (const f of Object.values(state.factions)) {
      if (f.id === targetFactionId || !f.isAlive) continue;
      const ruler = state.officers[f.rulerId];
      if (ruler?.tags?.includes('汉室忠臣') || ruler?.tags?.includes('士族')) {
        const link = findDiplomacy(diplomacy, f.id, targetFactionId);
        const curFav = link?.favorability ?? 0;
        diplomacy = upsertLink(diplomacy, f.id, targetFactionId, {
          favorability: Math.max(-100, curFav - 20),
        }, state);
      }
    }

    return pushLog(
      state,
      'imperial_decree',
      `【天子讨逆诏】奉天承运，诏告万邦：宣判逆贼 ${target.name} 祸国殃民！其天命人心衰退（天命 ${target.mandate ?? 50}→${nextMandate}，人心 ${target.popularWill ?? 50}→${nextWill}），四海忠良咸共击之！`,
      { factions, diplomacy },
    );
  }

  if (type === 'appoint_prov_governor') {
    // 锡命册封：册封目标诸侯为州牧，目标声望 +25，对我方友好 +30
    const nextFame = Math.min(1000, (target.fame ?? 0) + 25);
    const factions = {
      ...state.factions,
      [targetFactionId]: {
        ...target,
        fame: nextFame,
      },
    };
    const link = findDiplomacy(state.diplomacy, state.playerFactionId, targetFactionId);
    const curFav = link?.favorability ?? 0;
    const nextFav = Math.min(100, curFav + 30);
    const diplomacy = upsertLink(state.diplomacy, state.playerFactionId, targetFactionId, {
      favorability: nextFav,
      relation: curFav >= 20 ? DipRelation.FRIENDLY : DipRelation.NEUTRAL,
    }, state);

    const provLabel = extraProvince ? `（${extraProvince}）` : '';
    return pushLog(
      state,
      'imperial_decree',
      `【天子册封诏】天子下诏锡命，册封诸侯 ${target.name} 为所辖州牧${provLabel}（声望 +25，对朝廷友好 ${curFav}→${nextFav}）！`,
      { factions, diplomacy },
    );
  }

  if (type === 'summon_tribute') {
    // 天下征贡诏：目标向朝廷纳贡 200 金 500 粮
    const goldPaid = Math.min(target.gold, 200);
    const foodPaid = Math.min(target.food, 500);

    const cities = { ...state.cities };
    const targetCityId = target.capitalCityId ?? target.cityIds[0];
    if (targetCityId && cities[targetCityId]) {
      const tc = cities[targetCityId];
      cities[targetCityId] = {
        ...tc,
        gold: Math.max(0, tc.gold - goldPaid),
        food: Math.max(0, tc.food - foodPaid),
      };
    }
    const playerCityId = player?.capitalCityId ?? player?.cityIds[0];
    if (playerCityId && cities[playerCityId]) {
      const pc = cities[playerCityId];
      cities[playerCityId] = {
        ...pc,
        gold: pc.gold + goldPaid,
        food: pc.food + foodPaid,
      };
    }

    const factions = {
      ...state.factions,
      [targetFactionId]: {
        ...target,
        gold: target.gold - goldPaid,
        food: target.food - foodPaid,
        fame: Math.min(1000, (target.fame ?? 0) + 10),
      },
      [state.playerFactionId]: {
        ...player,
        gold: player.gold + goldPaid,
        food: player.food + foodPaid,
      },
    };

    const next = pushLog(
      state,
      'imperial_decree',
      `【天子征贡诏】诸侯 ${target.name} 遵奉诏命，向天子行在进献贡物金 ${goldPaid}、粮 ${foodPaid}（其声望 +10）！`,
      { cities, factions },
    );
    return syncFactionResources(next);
  }

  return state;
}

/**
 * 月度外交状态推进与岁首从属朝贡结算
 */
export function tickDiplomacyMonth(state: GameState, isYearStart: boolean): GameState {
  let changed = false;
  let diplomacy = state.diplomacy;
  if (state.diplomacy.some((link) => (link.truceMonths ?? 0) > 0)) {
    diplomacy = state.diplomacy.map((link) => {
      if (link.truceMonths && link.truceMonths > 0) {
        return { ...link, truceMonths: link.truceMonths - 1 };
      }
      return link;
    });
    changed = true;
  }

  let coalitions = state.coalitions;
  let factions = state.factions;
  if (coalitions && coalitions.length > 0) {
    const nextCoalitions: Coalition[] = [];
    let factionsUpdated = false;
    const nextFactions = { ...factions };

    for (const c of coalitions) {
      const target = state.factions[c.targetFactionId];
      if (!target || !target.isAlive) {
        // 目标势力已灭亡，联军大获全胜！
        for (const mid of c.memberFactionIds) {
          const f = nextFactions[mid];
          if (f) {
            nextFactions[mid] = {
              ...f,
              fame: Math.min(1000, (f.fame ?? 0) + 40),
              coalitionId: undefined,
            };
            factionsUpdated = true;
          }
        }
      } else {
        const rem = c.remainingMonths - 1;
        if (rem <= 0) {
          // 盟约期满自然解散
          for (const mid of c.memberFactionIds) {
            const f = nextFactions[mid];
            if (f) {
              nextFactions[mid] = { ...f, coalitionId: undefined };
              factionsUpdated = true;
            }
          }
        } else {
          nextCoalitions.push({ ...c, remainingMonths: rem });
        }
      }
    }
    coalitions = nextCoalitions;
    if (factionsUpdated) factions = nextFactions;
    changed = true;
  }

  let nextState = state;
  if (changed) {
    nextState = {
      ...state,
      diplomacy,
      ...(coalitions !== undefined ? { coalitions } : {}),
      factions,
    };
  }

  // 每年正月岁首纳贡结算（从属国向宗主国上缴 15% 金粮）
  if (isYearStart) {
    let tributePaid = false;
    let nextCities = { ...nextState.cities };
    const tributeFactions = { ...nextState.factions };

    for (const f of Object.values(tributeFactions)) {
      if (!f.isAlive || !f.overlordFactionId) continue;
      const overlord = tributeFactions[f.overlordFactionId];
      if (!overlord || !overlord.isAlive) continue;

      const tributeGold = Math.floor(f.gold * 0.15);
      const tributeFood = Math.floor(f.food * 0.15);
      if (tributeGold > 0 || tributeFood > 0) {
        // 从属国扣除（优先扣除其首都/主城）
        const vassalCityId = f.capitalCityId ?? f.cityIds[0];
        if (vassalCityId && nextCities[vassalCityId]) {
          const vc = nextCities[vassalCityId];
          nextCities[vassalCityId] = {
            ...vc,
            gold: Math.max(0, vc.gold - tributeGold),
            food: Math.max(0, vc.food - tributeFood),
          };
        }
        // 宗主国注入（注入其首都/主城）
        const overlordCityId = overlord.capitalCityId ?? overlord.cityIds[0];
        if (overlordCityId && nextCities[overlordCityId]) {
          const oc = nextCities[overlordCityId];
          nextCities[overlordCityId] = {
            ...oc,
            gold: oc.gold + tributeGold,
            food: oc.food + tributeFood,
          };
        }

        tributeFactions[f.id] = {
          ...tributeFactions[f.id],
          gold: f.gold - tributeGold,
          food: f.food - tributeFood,
        };
        tributeFactions[overlord.id] = {
          ...tributeFactions[overlord.id],
          gold: tributeFactions[overlord.id].gold + tributeGold,
          food: tributeFactions[overlord.id].food + tributeFood,
        };
        tributePaid = true;

        nextState = pushLog(
          nextState,
          'vassal_tribute',
          `岁首朝贡：从属诸侯 ${f.name} 向宗主国 ${overlord.name} 进献贡赋金 ${tributeGold}、粮 ${tributeFood}。`,
          { cities: nextCities, factions: tributeFactions },
        );
      }
    }

    if (tributePaid) {
      nextState = syncFactionResources(nextState);
    }
  }

  return nextState;
}
