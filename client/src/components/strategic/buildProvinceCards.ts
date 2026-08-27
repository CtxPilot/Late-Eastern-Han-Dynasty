// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战略卡片只读派生模型（世界屏 · 天下→州→城）。
 * 无存档字段；纯从 GameState + city-roads 聚合。
 */

import type { CampaignArmy, City, Faction, GameState } from '@leh/shared';
import { roadNeighbors } from '@leh/shared';

/** 0-A 十三州展示顺序（与 cities.json 出现的州名对齐）。 */
export const PROVINCE_DISPLAY_ORDER: readonly string[] = [
  '司隶',
  '豫州',
  '冀州',
  '兖州',
  '徐州',
  '青州',
  '荆州',
  '扬州',
  '益州',
  '凉州',
  '并州',
  '幽州',
  '交州',
] as const;

export interface FactionShare {
  factionId: number;
  name: string;
  color: string;
  cityCount: number;
  /** 占该州城池比例 0~100 */
  sharePct: number;
}

export interface ProvinceCardModel {
  province: string;
  cityCount: number;
  population: number;
  food: number;
  gold: number;
  troops: number;
  /** 占城最多的势力；无人城则 null */
  dominant: FactionShare | null;
  shares: FactionShare[];
  atWar: boolean;
  cityIds: number[];
}

export interface CityCardModel {
  id: number;
  name: string;
  adminName?: string;
  province: string;
  isCapital: boolean;
  isPass: boolean;
  troops: number;
  population: number;
  food: number;
  gold: number;
  rulerFactionId: number | null;
  rulerName: string | null;
  rulerColor: string | null;
  neighborNames: string[];
  selected: boolean;
  isPlayer: boolean;
}

function factionMap(game: GameState): Record<number, Faction> {
  return game.factions;
}

function armiesInProvince(armies: CampaignArmy[], cityIds: Set<number>): CampaignArmy[] {
  return armies.filter(
    (a) => cityIds.has(a.currentNodeId) || (a.targetNodeId != null && cityIds.has(a.targetNodeId)),
  );
}

export function buildProvinceCards(game: GameState): ProvinceCardModel[] {
  const byProvince = new Map<string, City[]>();
  for (const city of Object.values(game.cities)) {
    const list = byProvince.get(city.province) ?? [];
    list.push(city);
    byProvince.set(city.province, list);
  }

  const ordered = [
    ...PROVINCE_DISPLAY_ORDER.filter((p) => byProvince.has(p)),
    ...[...byProvince.keys()].filter((p) => !PROVINCE_DISPLAY_ORDER.includes(p)).sort(),
  ];

  const factions = factionMap(game);

  return ordered.map((province) => {
    const cities = byProvince.get(province) ?? [];
    const cityIds = cities.map((c) => c.id);
    const cityIdSet = new Set(cityIds);

    const countByRuler = new Map<number, number>();
    let population = 0;
    let food = 0;
    let gold = 0;
    let troops = 0;
    for (const c of cities) {
      population += c.population;
      food += c.food;
      gold += c.gold;
      troops += c.troops;
      if (c.ruler != null) {
        countByRuler.set(c.ruler, (countByRuler.get(c.ruler) ?? 0) + 1);
      }
    }

    const shares: FactionShare[] = [...countByRuler.entries()]
      .map(([factionId, cityCount]) => {
        const f = factions[factionId];
        return {
          factionId,
          name: f?.name ?? `势力${factionId}`,
          color: f?.color ?? '#78716c',
          cityCount,
          sharePct: cities.length > 0 ? Math.round((cityCount / cities.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.cityCount - a.cityCount);

    const provinceArmies = armiesInProvince(game.campaignArmies, cityIdSet);
    const factionIdsInArmies = new Set(provinceArmies.map((a) => a.factionId));
    const contestedCity = cities.some((c) => {
      const here = provinceArmies.filter((a) => a.currentNodeId === c.id);
      return new Set(here.map((a) => a.factionId)).size >= 2;
    });
    const atWar = contestedCity || factionIdsInArmies.size >= 2;

    return {
      province,
      cityCount: cities.length,
      population,
      food,
      gold,
      troops,
      dominant: shares[0] ?? null,
      shares,
      atWar,
      cityIds,
    };
  });
}

export function buildCityCards(
  game: GameState,
  province: string,
  selectedCityId: number | null,
): CityCardModel[] {
  const factions = factionMap(game);
  const cities = Object.values(game.cities)
    .filter((c) => c.province === province)
    .sort((a, b) => a.id - b.id);

  return cities.map((c) => {
    const ruler = c.ruler != null ? factions[c.ruler] : null;
    const neighborNames = roadNeighbors(c.id)
      .map((nid) => game.cities[nid]?.name)
      .filter((n): n is string => Boolean(n));

    return {
      id: c.id,
      name: c.name,
      adminName: c.adminName,
      province: c.province,
      isCapital: c.isCapital,
      isPass: c.isPass,
      troops: c.troops,
      population: c.population,
      food: c.food,
      gold: c.gold,
      rulerFactionId: c.ruler,
      rulerName: ruler?.name ?? null,
      rulerColor: ruler?.color ?? null,
      neighborNames,
      selected: c.id === selectedCityId,
      isPlayer: c.ruler === game.playerFactionId,
    };
  });
}
