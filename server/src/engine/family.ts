// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 家族跟随规则引擎 S18 深化
 * 设计真源 docs/04 §3.5（人才自动跟随）+ §30.6/30.7（女角随男跟随）
 *
 * 规则：
 * 1. 男将自动投奔：在野武将(faction=null)每月检查
 *    - 相性差<20 且邻接 → 20% 投奔
 *    - 理想一致(benevolence) → 40% 投奔
 *    - 血亲在目标势力 → 50% 召唤
 * 2. 女角随男跟随：男将加入势力时
 *    - 其妻(husbandId/wifeId关联)自动跟随入势力 + 迁移到男将所在城
 * 3. 主将易主：占城后败方武将释放 → 其妻若有则跟随流落
 */
import {
  OfficerStatus,
  playerCitiesAdjacentTo,
  type GameState,
  type Officer,
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
      { year: state.currentYear, month: state.currentMonth, type, message },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

/** 找武将的妻子（FemaleCharacter.husbandId 指向该将，或 Officer.wifeId 指向女角） */
function findWivesOfOfficer(state: GameState, officerId: number) {
  const females = Object.values(state.females);
  return females.filter(
    (f) => f.husbandId === officerId || f.giftedToOfficerId === officerId,
  );
}

/** 将武将加入势力 */
export function joinFaction(
  state: GameState,
  officerId: number,
  factionId: number,
  cityId?: number,
  loyalty?: number,
): GameState {
  const officer = state.officers[officerId];
  if (!officer) return state;

  const targetCity =
    cityId != null
      ? state.cities[cityId]
      : Object.values(state.cities).find((c) => c.ruler === factionId);

  if (!targetCity) return state;

  const fac = state.factions[factionId];
  if (!fac) return state;

  // Update officer
  let officers = {
    ...state.officers,
    [officerId]: {
      ...officer,
      faction: factionId,
      location: targetCity.id,
      loyalty: loyalty ?? 50 + Math.floor(Math.random() * 20),
      status: OfficerStatus.ACTIVE,
    },
  };

  // Update faction.officerIds
  let factions = { ...state.factions };
  if (!fac.officerIds.includes(officerId)) {
    factions[factionId] = {
      ...fac,
      officerIds: [...fac.officerIds, officerId],
    };
  }

  // 女角跟随：其妻自动入势力 + 迁移
  let females = { ...state.females };
  const wives = findWivesOfOfficer({ ...state, officers }, officerId);
  for (const wife of wives) {
    if (wife.factionId !== factionId) {
      females[wife.id] = {
        ...wife,
        factionId,
        locationId: targetCity.id,
      };
    }
  }

  // B16: 同步 city.officers 列表（从旧城移除，加入新城）
  let cities = { ...state.cities };
  const prevLoc = officer.location;
  if (prevLoc != null && cities[prevLoc]) {
    cities[prevLoc] = {
      ...cities[prevLoc],
      officers: cities[prevLoc].officers.filter((id) => id !== officerId),
    };
  }
  if (!cities[targetCity.id].officers.includes(officerId)) {
    cities[targetCity.id] = {
      ...cities[targetCity.id],
      officers: [...cities[targetCity.id].officers, officerId],
    };
  }

  return { ...state, officers, factions, females, cities };
}

/** 释放武将为在野（faction=null）— 主将易主时调用 */
export function releaseOfficer(state: GameState, officerId: number): GameState {
  const officer = state.officers[officerId];
  if (!officer) return state;

  let officers = {
    ...state.officers,
    [officerId]: {
      ...officer,
      faction: null,
      loyalty: 0,
      status: OfficerStatus.FREE,
    },
  };

  let factions = { ...state.factions };
  if (officer.faction != null) {
    const fac = factions[officer.faction];
    if (fac) {
      factions[officer.faction] = {
        ...fac,
        officerIds: fac.officerIds.filter((id) => id !== officerId),
      };
    }
  }

  // 妻子跟随流落（factionId=null）但保持 locationId
  let females = { ...state.females };
  const wives = findWivesOfOfficer({ ...state, officers }, officerId);
  for (const wife of wives) {
    females[wife.id] = {
      ...wife,
      factionId: null,
    };
  }

  // B16: 从所在城 officers 列表移除（释放为在野后不再驻守）
  let cities = { ...state.cities };
  if (officer.location != null && cities[officer.location]) {
    cities[officer.location] = {
      ...cities[officer.location],
      officers: cities[officer.location].officers.filter((id) => id !== officerId),
    };
  }

  return { ...state, officers, factions, females, cities };
}

/** 检查在野武将是否应主动投奔某势力 */
function checkFollowConditions(
  state: GameState,
  officer: Officer,
): { factionId: number; cityId: number; reason: string } | null {
  if (officer.faction != null) return null;
  if (officer.status !== OfficerStatus.FREE) return null;

  const myCompat = officer.hidden.compatibility;
  const myIdeal = officer.hidden.ideal;

  // Check each alive non-player faction (player can also receive)
  for (const fac of Object.values(state.factions)) {
    if (!fac.isAlive) continue;

    const ruler = state.officers[fac.rulerId];
    if (!ruler) continue;

    // Must have a city
    const facCities = Object.values(state.cities).filter((c) => c.ruler === fac.id);
    if (facCities.length === 0) continue;

    // Check adjacency: officer.location must be adjacent to a fac city
    const officerLoc = officer.location;
    if (officerLoc == null) continue;

    const facCityIds = facCities.map((c) => c.id);
    const adj = playerCitiesAdjacentTo(facCityIds, officerLoc);
    if (adj.length === 0) continue;

    // Rule 1: 相性差 < 20 → 20%
    const compatDiff = Math.abs(myCompat - ruler.hidden.compatibility);
    if (compatDiff < 20) {
      const chance = 0.20;
      if (Math.random() < chance) {
        return { factionId: fac.id, cityId: adj[0], reason: `相性相近(差${compatDiff})` };
      }
    }

    // Rule 2: 理想一致 (benevolence) → 40%
    if (myIdeal === ruler.hidden.ideal && myIdeal === 'benevolence') {
      if (Math.random() < 0.40) {
        return { factionId: fac.id, cityId: adj[0], reason: `理想一致(${myIdeal})` };
      }
    }

    // Rule 3: 血亲在目标势力 → 50% 召唤
    const bloodline = officer.hidden.bloodline ?? [];
    const kinInFac = bloodline.some((bid) => {
      const kin = state.officers[bid];
      return kin && kin.faction === fac.id;
    });
    if (kinInFac) {
      if (Math.random() < 0.50) {
        return { factionId: fac.id, cityId: adj[0], reason: `血亲召唤` };
      }
    }
  }

  return null;
}

/**
 * 每月检查在野武将自动投奔
 * 设计真源 §3.5
 */
export function tickFollowCheck(state: GameState): GameState {
  let s = state;
  const freeOfficers = Object.values(s.officers).filter(
    (o) => o.faction == null && o.status === OfficerStatus.FREE,
  );

  if (freeOfficers.length === 0) return s;

  const messages: string[] = [];

  for (const officer of freeOfficers) {
    const result = checkFollowConditions(s, officer);
    if (result) {
      const beforeFemales = s.females;
      s = joinFaction(s, officer.id, result.factionId, result.cityId, 60);
      const facName = s.factions[result.factionId]?.name ?? '势力';
      messages.push(
        `${officer.name} 因${result.reason}投奔${facName}`,
      );

      // Check if wives followed
      const afterFemales = s.females;
      const wives = Object.values(beforeFemales).filter(
        (f) => f.husbandId === officer.id || f.giftedToOfficerId === officer.id,
      );
      for (const wife of wives) {
        const after = afterFemales[wife.id];
        if (after && after.factionId === result.factionId && wife.factionId !== result.factionId) {
          messages.push(`${wife.name} 随夫君入府`);
        }
      }
    }
  }

  if (messages.length > 0) {
    s = pushLog(s, 'follow', `【跟随】${messages.join('；')}`);
  }

  return s;
}