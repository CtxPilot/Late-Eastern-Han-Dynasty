// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 谍报 / 可见性（Demo）
 * - 己方：全可见
 * - 盟友：部分（势力、兵力档、城防；无金粮人口细目）
 * - 侦查报告：期限内较详
 * - 其余：仅城名等地理公开信息
 */
import { DipRelation, type FactionId } from './enums/index.js';
import type { DiplomacyLink } from './types/diplomacy.js';
import type { City } from './types/city.js';
import type { CityIntelEntry, IntelState } from './types/intel.js';
import type { GameState } from './types/game.js';

export type { CityIntelEntry, IntelState };

export function emptyIntel(): IntelState {
  return {
    cities: {},
    agents: {},
    cityDefense: {},
    nextAgentSeq: 1,
    recentMissions: [],
    plantableBeauty: {},
  };
}

export type CityVisKind = 'own' | 'ally' | 'scouted' | 'fog';

export interface CityVisibility {
  kind: CityVisKind;
  showFaction: boolean;
  showExactTroops: boolean;
  showTroopsBand: boolean;
  showEconomy: boolean;
  showDemographics: boolean;
  showMorale: boolean;
  showWall: boolean;
  intelDepth: 'none' | 'surface' | 'detailed' | 'full';
}

/** 查找两势力外交链 */
export function findDiplomacy(
  links: DiplomacyLink[],
  a: FactionId,
  b: FactionId,
): DiplomacyLink | null {
  if (a === b) return null;
  return (
    links.find(
      (l) =>
        (l.factionA === a && l.factionB === b) ||
        (l.factionA === b && l.factionB === a),
    ) ?? null
  );
}

export function isAllied(
  links: DiplomacyLink[],
  a: FactionId,
  b: FactionId,
): boolean {
  const l = findDiplomacy(links, a, b);
  if (!l) return false;
  const r = l.relation as string;
  return r === DipRelation.ALLIED || r === 'allied';
}

export function isFriendlyOrBetter(
  links: DiplomacyLink[],
  a: FactionId,
  b: FactionId,
): boolean {
  const l = findDiplomacy(links, a, b);
  if (!l) return false;
  const r = l.relation as string;
  return (
    r === DipRelation.ALLIED ||
    r === 'allied' ||
    r === DipRelation.FRIENDLY ||
    r === 'friendly'
  );
}

export function intelStillValid(
  entry: CityIntelEntry,
  year: number,
  month: number,
): boolean {
  if (year < entry.expireYear) return true;
  if (year > entry.expireYear) return false;
  return month <= entry.expireMonth;
}

export function troopsBandLabel(troops: number): string {
  if (troops < 2000) return '寡';
  if (troops < 5000) return '中';
  if (troops < 10000) return '雄';
  return '极盛';
}

export function getCityVisibility(state: GameState, cityId: number): CityVisibility {
  const city = state.cities[cityId];
  const player = state.playerFactionId;
  if (!city) return fogVis();

  if (city.ruler === player) {
    return {
      kind: 'own',
      showFaction: true,
      showExactTroops: true,
      showTroopsBand: false,
      showEconomy: true,
      showDemographics: true,
      showMorale: true,
      showWall: true,
      intelDepth: 'full',
    };
  }

  const ruler = city.ruler;
  if (ruler != null && isAllied(state.diplomacy, player, ruler)) {
    return {
      kind: 'ally',
      showFaction: true,
      showExactTroops: false,
      showTroopsBand: true,
      showEconomy: false,
      showDemographics: false,
      showMorale: false,
      showWall: true,
      intelDepth: 'surface',
    };
  }

  const report = state.intel?.cities?.[cityId];
  if (report && intelStillValid(report, state.currentYear, state.currentMonth)) {
    if (report.depth === 'detailed') {
      return {
        kind: 'scouted',
        showFaction: true,
        showExactTroops: true,
        showTroopsBand: false,
        showEconomy: true,
        showDemographics: false,
        showMorale: true,
        showWall: true,
        intelDepth: 'detailed',
      };
    }
    return {
      kind: 'scouted',
      showFaction: true,
      showExactTroops: false,
      showTroopsBand: true,
      showEconomy: false,
      showDemographics: false,
      showMorale: false,
      showWall: true,
      intelDepth: 'surface',
    };
  }

  return fogVis();
}

function fogVis(): CityVisibility {
  return {
    kind: 'fog',
    showFaction: false,
    showExactTroops: false,
    showTroopsBand: false,
    showEconomy: false,
    showDemographics: false,
    showMorale: false,
    showWall: false,
    intelDepth: 'none',
  };
}

export function formatTroopsForView(city: City, vis: CityVisibility): string {
  if (vis.showExactTroops) return String(city.troops);
  if (vis.showTroopsBand) return troopsBandLabel(city.troops);
  return '???';
}

export function formatMasked(value: string | number, visible: boolean): string {
  return visible ? String(value) : '???';
}

/** 展示金粮：detailed 显示约数 */
export function formatEconomyForView(
  exact: number,
  vis: CityVisibility,
): string {
  if (vis.kind === 'own' || vis.intelDepth === 'full') return String(exact);
  if (vis.showEconomy && vis.intelDepth === 'detailed') {
    // 约数到百
    return `约${Math.round(exact / 100) * 100}`;
  }
  return '???';
}

export function pruneExpiredIntel(state: GameState): IntelState {
  const intel = state.intel ?? emptyIntel();
  const next: Record<number, CityIntelEntry> = {};
  for (const [id, entry] of Object.entries(intel.cities ?? {})) {
    if (intelStillValid(entry, state.currentYear, state.currentMonth)) {
      next[Number(id)] = entry;
    }
  }
  return {
    cities: next,
    agents: intel.agents ?? {},
    cityDefense: intel.cityDefense ?? {},
    nextAgentSeq: intel.nextAgentSeq ?? 1,
    recentMissions: intel.recentMissions ?? [],
    plantableBeauty: intel.plantableBeauty ?? {},
  };
}

/** 推进 expire 年月 +months */
export function addMonths(
  year: number,
  month: number,
  add: number,
): { year: number; month: number } {
  let m = month + add;
  let y = year;
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}
