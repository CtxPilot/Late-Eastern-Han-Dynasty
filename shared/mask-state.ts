// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S06 服务端视野裁剪：按玩家可见性脱敏 GameState 再下发客户端
 * 真源仍在服务端内存；本函数只做只读投影
 */
import {
  getCityVisibility,
  troopsBandLabel,
  type CityVisibility,
} from './intel.js';
import type { City, CityDemographics } from './types/city.js';
import type { GameState } from './types/game.js';
import type { Officer } from './types/officer.js';
import type { Faction } from './types/faction.js';

const EMPTY_DEMO: CityDemographics = {
  adultMale: 0,
  adultFemale: 0,
  child: 0,
  elder: 0,
};

function bandMidTroops(troops: number): number {
  const band = troopsBandLabel(troops);
  if (band === '寡') return 1000;
  if (band === '中') return 3500;
  if (band === '雄') return 7500;
  return 12000;
}

function round100(n: number): number {
  return Math.round(n / 100) * 100;
}

function maskCity(city: City, vis: CityVisibility): City {
  if (vis.kind === 'own' || vis.intelDepth === 'full') {
    return city;
  }

  if (vis.kind === 'ally') {
    return {
      ...city,
      gold: 0,
      food: 0,
      population: 0,
      demographics: EMPTY_DEMO,
      beautySeekLeft: 0,
      troops: bandMidTroops(city.troops),
      troopsMorale: 0,
      officers: [],
      stats: {
        ...city.stats,
        farm: 0,
        commerce: 0,
        morale: 0,
        // wall visible for ally
      },
    };
  }

  if (vis.kind === 'scouted' && vis.intelDepth === 'detailed') {
    return {
      ...city,
      gold: round100(city.gold),
      food: round100(city.food),
      population: round100(city.population),
      demographics: EMPTY_DEMO,
      beautySeekLeft: 0,
      troopsMorale: 0,
      officers: city.officers,
      stats: {
        ...city.stats,
        farm: round100(city.stats.farm),
        commerce: round100(city.stats.commerce),
      },
    };
  }

  if (vis.kind === 'scouted') {
    // surface
    return {
      ...city,
      gold: 0,
      food: 0,
      population: 0,
      demographics: EMPTY_DEMO,
      beautySeekLeft: 0,
      troops: bandMidTroops(city.troops),
      troopsMorale: 0,
      officers: [],
      stats: {
        farm: 0,
        commerce: 0,
        wall: city.stats.wall,
        morale: 0,
      },
    };
  }

  // fog
  return {
    ...city,
    ruler: null,
    gold: 0,
    food: 0,
    population: 0,
    demographics: EMPTY_DEMO,
    beautySeekLeft: 0,
    troops: 0,
    troopsMorale: 0,
    officers: [],
    stats: {
      farm: 0,
      commerce: 0,
      wall: 0,
      morale: 0,
    },
  };
}

function maskFaction(f: Faction, playerId: number, alliedIds: Set<number>): Faction {
  if (f.id === playerId) return f;
  if (alliedIds.has(f.id)) {
    return {
      ...f,
      gold: 0,
      food: 0,
      beautyStock: 0,
      officerIds: [],
    };
  }
  return {
    ...f,
    gold: 0,
    food: 0,
    beautyStock: 0,
    officerIds: [],
    capitalCityId: f.capitalCityId,
  };
}

function shouldRevealOfficer(
  state: GameState,
  o: Officer,
  playerId: number,
): boolean {
  if (o.faction === playerId) return true;
  if (o.faction == null) return true; // 在野：登用需要
  if (o.location == null) return false;
  const vis = getCityVisibility(state, o.location);
  if (vis.kind === 'own') return true;
  if (vis.kind === 'scouted' && vis.intelDepth === 'detailed') return true;
  return false;
}

function maskOfficer(o: Officer, playerId: number): Officer {
  if (o.faction === playerId) return o;
  if (o.faction == null) {
    // 在野：保留属性供登用 UI，不露隐藏忠诚以外
    return o;
  }
  // 敌/盟：detailed 城内仅露名与粗属性
  return {
    ...o,
    loyalty: 0,
    experience: 0,
    merit: 0,
    stamina: 100,
    beauties: [],
    wifeId: null,
    hidden: {
      ...o.hidden,
      ambition: 50,
      righteousness: 50,
      valor: 50,
      composure: 50,
      bloodline: [],
      ceilingBonus: null,
    },
  };
}

/**
 * 投影为玩家客户端可见 GameState（不修改入参）
 */
export function maskGameStateForPlayer(state: GameState): GameState {
  const playerId = state.playerFactionId;
  const alliedIds = new Set<number>();
  for (const f of Object.values(state.factions)) {
    if (f.id === playerId) continue;
    const visSample = Object.values(state.cities).find((c) => c.ruler === f.id);
    if (visSample) {
      const v = getCityVisibility(state, visSample.id);
      if (v.kind === 'ally') alliedIds.add(f.id);
    }
  }
  // also mark via diplomacy
  for (const f of Object.values(state.factions)) {
    if (f.id === playerId) continue;
    const link = state.diplomacy.find(
      (l) =>
        (l.factionA === playerId && l.factionB === f.id) ||
        (l.factionA === f.id && l.factionB === playerId),
    );
    const r = link?.relation as string | undefined;
    if (r === 'allied') alliedIds.add(f.id);
  }

  const cities: GameState['cities'] = {};
  for (const c of Object.values(state.cities)) {
    const vis = getCityVisibility(state, c.id);
    cities[c.id] = maskCity(c, vis);
  }

  const officers: GameState['officers'] = {};
  for (const o of Object.values(state.officers)) {
    if (!shouldRevealOfficer(state, o, playerId)) continue;
    officers[o.id] = maskOfficer(o, playerId);
  }

  const factions: GameState['factions'] = {};
  for (const f of Object.values(state.factions)) {
    factions[f.id] = maskFaction(f, playerId, alliedIds);
  }

  const females: GameState['females'] = {};
  for (const fe of Object.values(state.females)) {
    if (fe.factionId === playerId || fe.factionId == null) {
      females[fe.id] = fe;
    }
  }

  const intel = state.intel ?? {
    cities: {},
    agents: {},
    cityDefense: {},
    nextAgentSeq: 1,
    recentMissions: [],
  };
  const agents: typeof intel.agents = {};
  for (const [id, a] of Object.entries(intel.agents ?? {})) {
    if (a.factionId === playerId) agents[id] = a;
    // 俘虏在己方手中可见
    else if (a.captiveByFactionId === playerId) agents[id] = a;
  }
  const cityDefense: typeof intel.cityDefense = {};
  for (const [cid, def] of Object.entries(intel.cityDefense ?? {})) {
    const cityId = Number(cid);
    if (state.cities[cityId]?.ruler === playerId) {
      cityDefense[cityId] = def;
    }
  }

  const plots = (state.plots ?? []).filter((p) => p.casterFactionId === playerId);

  return {
    ...state,
    cities,
    officers,
    factions,
    females,
    intel: {
      cities: intel.cities ?? {},
      agents,
      cityDefense,
      nextAgentSeq: intel.nextAgentSeq ?? 1,
      recentMissions: (intel.recentMissions ?? []).filter(
        (m) => m.factionId === playerId,
      ),
      // 己方可点化额度保留
      plantableBeauty: intel.plantableBeauty ?? {},
    },
    plots,
  };
}
