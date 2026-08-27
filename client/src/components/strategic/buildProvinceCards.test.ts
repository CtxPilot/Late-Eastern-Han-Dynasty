// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import type { CampaignArmy, City, Faction, GameState } from '@leh/shared';
import { TerrainType } from '@leh/shared';
import { buildCityCards, buildProvinceCards } from './buildProvinceCards';

function makeCity(partial: Partial<City> & Pick<City, 'id' | 'name' | 'province'>): City {
  return {
    x: 0,
    y: 0,
    maxPopulation: 10000,
    isCapital: false,
    isPass: false,
    specialProduct: null,
    recruitableUnits: [],
    initialStats: { farm: 50, commerce: 50, wall: 50 },
    terrain: TerrainType.PLAIN,
    stats: { farm: 50, commerce: 50, wall: 50, morale: 70 },
    gold: 100,
    food: 200,
    population: 1000,
    demographics: { adultMale: 300, adultFemale: 300, child: 200, elder: 200 },
    courtNetworkOpportunities: 0,
    troops: 500,
    troopsMorale: 70,
    officers: [],
    ruler: null,
    facilities: [],
    policy: null,
    developmentProgress: { farm: 0, commerce: 0, wall: 0 },
    ...partial,
  };
}

function makeFaction(id: number, name: string, color: string): Faction {
  return {
    id,
    name,
    color,
    rulerId: 1,
    capitalCityId: 1,
    gold: 0,
    food: 0,
    courtNetwork: 0,
    cityIds: [],
    officerIds: [],
    isPlayer: id === 1,
    isAlive: true,
  };
}

function stubGame(cities: City[], armies: CampaignArmy[] = []): GameState {
  const cityMap = Object.fromEntries(cities.map((c) => [c.id, c]));
  return {
    turn: 1,
    year: 190,
    month: 1,
    season: 'spring',
    playerFactionId: 1,
    cities: cityMap,
    factions: {
      1: makeFaction(1, '曹', '#3b82f6'),
      2: makeFaction(2, '袁', '#ef4444'),
    },
    officers: {},
    campaignArmies: armies,
    campaignNodes: {},
    pendingEvents: [],
    rng: { seed: 1, draws: 0 },
  } as unknown as GameState;
}

describe('buildProvinceCards', () => {
  it('aggregates cities by province and picks dominant faction', () => {
    const game = stubGame([
      makeCity({ id: 14, name: '江陵', province: '荆州', ruler: 2, troops: 1000, food: 300 }),
      makeCity({ id: 15, name: '襄阳', province: '荆州', ruler: 2, troops: 800, food: 200 }),
      makeCity({ id: 13, name: '宛', province: '荆州', ruler: 1, troops: 400, food: 100 }),
      makeCity({ id: 1, name: '洛阳', province: '司隶', ruler: 1, troops: 2000, food: 500 }),
    ]);
    const cards = buildProvinceCards(game);
    expect(cards.map((c) => c.province)).toEqual(['司隶', '荆州']);
    const jing = cards.find((c) => c.province === '荆州')!;
    expect(jing.cityCount).toBe(3);
    expect(jing.dominant?.name).toBe('袁');
    expect(jing.dominant?.cityCount).toBe(2);
    expect(jing.dominant?.sharePct).toBe(67);
    expect(jing.troops).toBe(2200);
    expect(jing.food).toBe(600);
  });

  it('marks atWar when two factions have armies in province', () => {
    const game = stubGame(
      [
        makeCity({ id: 14, name: '江陵', province: '荆州', ruler: 2 }),
        makeCity({ id: 15, name: '襄阳', province: '荆州', ruler: 2 }),
      ],
      [
        { id: 'a1', factionId: 1, currentNodeId: 14, targetNodeId: 15 } as unknown as CampaignArmy,
        { id: 'a2', factionId: 2, currentNodeId: 15, targetNodeId: null } as unknown as CampaignArmy,
      ],
    );
    const jing = buildProvinceCards(game).find((c) => c.province === '荆州')!;
    expect(jing.atWar).toBe(true);
  });
});

describe('buildCityCards', () => {
  it('lists cities in province and marks selection', () => {
    const game = stubGame([
      makeCity({ id: 14, name: '江陵', province: '荆州', ruler: 2, isCapital: true }),
      makeCity({ id: 15, name: '襄阳', province: '荆州', ruler: 2, isPass: true }),
      makeCity({ id: 1, name: '洛阳', province: '司隶', ruler: 1 }),
    ]);
    const cards = buildCityCards(game, '荆州', 15);
    expect(cards).toHaveLength(2);
    expect(cards.find((c) => c.id === 15)?.selected).toBe(true);
    expect(cards.find((c) => c.id === 14)?.isCapital).toBe(true);
    expect(cards.find((c) => c.id === 15)?.isPass).toBe(true);
  });
});
