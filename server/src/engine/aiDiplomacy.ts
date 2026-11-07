// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P5-03 AI 外交决策引擎（弱势求盟 & 强邻进贡修好 & 同盟维护）。
 *
 * 核心逻辑：
 * 1. 弱势势力识别（城池≤2，兵力寡弱且周边有兵力压制之强邻）；
 * 2. 弱势求盟（向具有共同敌人或友好基础的非敌对势力遣使缔约，相约共御强敌）；
 * 3. 强邻进贡（向兵力优势压倒性的危胁势力奉金修好，缓和边境敌对）；
 * 4. 同盟破裂（友好度跌破门槛时盟约瓦解）；
 * 5. 零未控状态外泄，严守 GameStateSchema strict 约束与文言起居注记录。
 */

import {
  DipRelation,
  calculateAllianceChance,
  findDiplomacy,
  isAllied,
  isHostileOrAtWar,
  macroAdjacentCityIds,
  type DiplomacyLink,
  type GameState,
} from '@leh/shared';
import { syncFactionResources } from './economy.js';

export const AI_DIP_CONFIG = Object.freeze({
  weakCityThreshold: 2,
  weakTroopsThreshold: 9000,
  threatTroopRatio: 1.4,
  extremeThreatRatio: 1.8,
  allianceGoldCost: 300,
  tributeGoldCost: 200,
  tributeFavorGain: 15,
  allianceFavorThreshold: 20,
  minAllianceChance: 35,
  allianceBreakFavor: -20,
});

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
        factionA: Math.min(a, b),
        factionB: Math.max(a, b),
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

export interface FactionDiplomaticStance {
  factionId: number;
  cityCount: number;
  totalTroops: number;
  isWeak: boolean;
  adjacentFactions: number[];
  threatFactions: number[];
}

/** 评估势力的外交态势与弱势受威胁程度 */
export function assessFactionDiplomaticStance(
  state: GameState,
  factionId: number,
): FactionDiplomaticStance {
  const myCities = Object.values(state.cities).filter((c) => c.ruler === factionId);
  const cityCount = myCities.length;
  const totalTroops = myCities.reduce((sum, c) => sum + c.troops, 0);

  const adjacentCityIds = new Set<number>();
  for (const c of myCities) {
    for (const adjId of macroAdjacentCityIds(c.id)) {
      adjacentCityIds.add(adjId);
    }
  }

  const adjacentFactionsSet = new Set<number>();
  const threatFactions: number[] = [];

  for (const adjId of adjacentCityIds) {
    const adjCity = state.cities[adjId];
    if (!adjCity || adjCity.ruler == null || adjCity.ruler === factionId) continue;
    const rulerId = adjCity.ruler;
    adjacentFactionsSet.add(rulerId);
  }

  const adjacentFactions = Array.from(adjacentFactionsSet).sort((a, b) => a - b);

  for (const adjFactionId of adjacentFactions) {
    if (isAllied(state.diplomacy, factionId, adjFactionId)) continue;
    const adjCities = Object.values(state.cities).filter((c) => c.ruler === adjFactionId);
    const adjTroops = adjCities.reduce((sum, c) => sum + c.troops, 0);
    const isHostile = isHostileOrAtWar(state.diplomacy, factionId, adjFactionId);

    const ratio = adjTroops / Math.max(totalTroops, 1);
    if ((isHostile && ratio >= 1.1) || ratio >= AI_DIP_CONFIG.threatTroopRatio) {
      threatFactions.push(adjFactionId);
    }
  }

  const isWeak =
    cityCount <= AI_DIP_CONFIG.weakCityThreshold &&
    (threatFactions.length > 0 || totalTroops < AI_DIP_CONFIG.weakTroopsThreshold);

  return {
    factionId,
    cityCount,
    totalTroops,
    isWeak,
    adjacentFactions,
    threatFactions,
  };
}

/** 弱势势力尝试向第三方求盟 */
export function decideWeakFactionAlliance(
  state: GameState,
  stance: FactionDiplomaticStance,
  rng: () => number,
): GameState | null {
  if (!stance.isWeak) return null;
  const { factionId } = stance;
  const faction = state.factions[factionId];
  if (!faction || !faction.isAlive) return null;

  // 寻找出资城池（金 ≥ 300）
  const sourceCity = Object.values(state.cities).find(
    (c) => c.ruler === factionId && c.gold >= AI_DIP_CONFIG.allianceGoldCost,
  );
  if (!sourceCity) return null;

  // 寻找候选结盟对象：存活、非本势力、非已结盟、非交战且不在直属强敌之列
  const candidates = Object.values(state.factions).filter((candidate) => {
    if (!candidate.isAlive || candidate.id === factionId) return false;
    if (isAllied(state.diplomacy, factionId, candidate.id)) return false;
    const link = findDiplomacy(state.diplomacy, factionId, candidate.id);
    const rel = (link?.relation as string) ?? DipRelation.NEUTRAL;
    if (rel === DipRelation.WAR || rel === 'war') return false;
    const fav = link?.favorability ?? 0;
    return fav >= AI_DIP_CONFIG.allianceFavorThreshold || stance.adjacentFactions.includes(candidate.id);
  });

  if (candidates.length === 0) return null;

  // 优先选择有实力且友好度较高的势力
  candidates.sort((a, b) => {
    const favA = findDiplomacy(state.diplomacy, factionId, a.id)?.favorability ?? 0;
    const favB = findDiplomacy(state.diplomacy, factionId, b.id)?.favorability ?? 0;
    return favB - favA || a.id - b.id;
  });

  for (const target of candidates) {
    try {
      const breakdown = calculateAllianceChance(state, target.id, factionId);
      if (breakdown.chance >= AI_DIP_CONFIG.minAllianceChance) {
        const roll = rng() * 100;
        if (roll <= breakdown.chance) {
          // 结盟成功
          const cities = {
            ...state.cities,
            [sourceCity.id]: {
              ...sourceCity,
              gold: sourceCity.gold - AI_DIP_CONFIG.allianceGoldCost,
            },
          };
          const link = findDiplomacy(state.diplomacy, factionId, target.id);
          const nextFav = Math.max(40, (link?.favorability ?? 0) + 15);
          const diplomacy = upsertLink(state.diplomacy, factionId, target.id, {
            relation: DipRelation.ALLIED,
            favorability: Math.min(100, nextFav),
          });

          const msg =
            target.id === state.playerFactionId
              ? `【外事】${faction.name}遣使奉书与我军缔盟，痛陈唇齿相依之理，两家正式结为同盟！`
              : `【外事】${faction.name}深感孤危，遣使与${target.name}正式缔结盟约，相约患难与共！`;

          return pushLog(state, 'ai_diplomacy', msg, { cities, diplomacy });
        }
      }
    } catch {
      // 若无可用使者或其他校验失败则略过
      continue;
    }
  }

  return null;
}

/** 弱势势力向强邻进贡修好缓和敌意 */
export function decideTributeToStrongNeighbor(
  state: GameState,
  stance: FactionDiplomaticStance,
): GameState | null {
  if (!stance.isWeak || stance.threatFactions.length === 0) return null;
  const { factionId } = stance;
  const faction = state.factions[factionId];
  if (!faction || !faction.isAlive) return null;

  const sourceCity = Object.values(state.cities).find(
    (c) => c.ruler === factionId && c.gold >= AI_DIP_CONFIG.tributeGoldCost,
  );
  if (!sourceCity) return null;

  // 挑选威胁最大的邻邦（且友好度较低）
  for (const threatId of stance.threatFactions) {
    const targetFaction = state.factions[threatId];
    if (!targetFaction || !targetFaction.isAlive) continue;

    const link = findDiplomacy(state.diplomacy, factionId, threatId);
    const fav = link?.favorability ?? 0;
    if (fav >= 35) continue; // 友好已较高无需重复进贡

    // 扣除进贡方金钱
    const cities: GameState['cities'] = {
      ...state.cities,
      [sourceCity.id]: {
        ...sourceCity,
        gold: sourceCity.gold - AI_DIP_CONFIG.tributeGoldCost,
      },
    };

    // 若受纳方为玩家，将金钱注入玩家首府或某座城池
    if (threatId === state.playerFactionId) {
      const playerCity =
        Object.values(state.cities).find((c) => c.ruler === threatId) ??
        Object.values(cities).find((c) => c.ruler === threatId);
      if (playerCity) {
        cities[playerCity.id] = {
          ...cities[playerCity.id],
          gold: cities[playerCity.id].gold + AI_DIP_CONFIG.tributeGoldCost,
        };
      }
    } else {
      // AI 受纳方亦获得该笔金钱
      const targetCity = Object.values(cities).find((c) => c.ruler === threatId);
      if (targetCity) {
        cities[targetCity.id] = {
          ...targetCity,
          gold: targetCity.gold + AI_DIP_CONFIG.tributeGoldCost,
        };
      }
    }

    const nextFav = Math.min(100, fav + AI_DIP_CONFIG.tributeFavorGain);
    let relation = link?.relation ?? DipRelation.NEUTRAL;
    if (relation === DipRelation.HOSTILE && nextFav >= 20) {
      relation = DipRelation.NEUTRAL;
    }

    const diplomacy = upsertLink(state.diplomacy, factionId, threatId, {
      favorability: nextFav,
      relation,
    });

    const msg =
      threatId === state.playerFactionId
        ? `【外事】${faction.name}敬畏我军威容，遣使押运白银两百两入朝进贡，以示臣服修好之意。`
        : `【外事】${faction.name}深畏${targetFaction.name}势大，特遣使奉金二百两修睦两家之好。`;

    return pushLog(state, 'ai_diplomacy', msg, { cities, diplomacy });
  }

  return null;
}

/** 维护同盟健康度：恶化破盟 */
export function maintainAlliances(state: GameState): GameState {
  let diplomacy = state.diplomacy;
  let actionLog = state.actionLog;

  for (const link of state.diplomacy) {
    if (link.relation === DipRelation.ALLIED && link.favorability <= AI_DIP_CONFIG.allianceBreakFavor) {
      const fA = state.factions[link.factionA];
      const fB = state.factions[link.factionB];
      if (fA && fB) {
        diplomacy = upsertLink(diplomacy, link.factionA, link.factionB, {
          relation: DipRelation.NEUTRAL,
        });
        actionLog = [
          {
            year: state.currentYear,
            month: state.currentMonth,
            type: 'ai_diplomacy',
            message: `【外事】${fA.name}与${fB.name}隙衅深积，誓盟已解，两家同盟告终！`,
          },
          ...actionLog,
        ].slice(0, 80);
      }
    }
  }

  return { ...state, diplomacy, actionLog };
}

/** 每回合运行全势力 AI 外交决策与同盟维护 */
export function runAllAiDiplomacy(
  state: GameState,
  rng: () => number,
): GameState {
  let s = maintainAlliances(state);

  const aiFactions = Object.values(s.factions)
    .filter((f) => f.isAlive && !f.isPlayer)
    .sort((a, b) => a.id - b.id);

  for (const faction of aiFactions) {
    const stance = assessFactionDiplomaticStance(s, faction.id);

    // 1. 尝试弱势求盟
    const alliedState = decideWeakFactionAlliance(s, stance, rng);
    if (alliedState) {
      s = syncFactionResources(alliedState);
      continue;
    }

    // 2. 若未能求盟，尝试进贡强邻以自保
    const tributeState = decideTributeToStrongNeighbor(s, stance);
    if (tributeState) {
      s = syncFactionResources(tributeState);
      continue;
    }
  }

  return s;
}
