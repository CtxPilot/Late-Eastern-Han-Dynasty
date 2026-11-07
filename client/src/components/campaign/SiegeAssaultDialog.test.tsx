// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CampaignArmy, City, Faction, GameState, Officer } from '@leh/shared';
import { SiegeAssaultDialog } from './SiegeAssaultDialog';

describe('SiegeAssaultDialog - S21-W6 Siege Confrontation Modal', () => {
  const mockOfficer = {
    id: 1,
    name: '曹仁',
    courtesyName: '子孝',
    faction: 1,
    location: 10,
    command: 88,
    martial: 86,
    wisdom: 75,
    politics: 68,
    charm: 74,
    skills: ['iron_defense'],
    stamina: 100,
    loyalty: 95,
    status: 'ACTIVE',
    birthYear: 168,
    deathYear: 223,
    beauties: [],
    hidden: { compatibility: 25 },
  } as unknown as Officer;

  const mockAtkFaction = {
    id: 1,
    name: '曹操',
    color: '#3b82f6',
    leaderId: 10,
    cities: [1],
  } as unknown as Faction;

  const mockDefFaction = {
    id: 2,
    name: '孙权',
    color: '#ef4444',
    leaderId: 20,
    cities: [2],
  } as unknown as Faction;

  const mockCity = {
    id: 2,
    name: '江陵',
    province: '荆州',
    x: 400,
    y: 300,
    ruler: 2,
    troops: 4500,
    food: 12000,
    stats: {
      farm: 100,
      commerce: 100,
      wall: 350,
      morale: 80,
    },
    initialStats: {
      farm: 100,
      commerce: 100,
      wall: 600,
    },
    troopsMorale: 82,
  } as unknown as City;

  const mockArmy: CampaignArmy = {
    id: 'army-siege-01',
    name: '虎豹精骑',
    factionId: 1,
    commanderId: 1,
    subCommanderIds: [],
    unitType: 'heavyCavalry' as any,
    formation: 6, // 锋矢阵
    currentNodeId: 2,
    path: [],
    phase: 'sieging',
    troops: 8000,
    maxTroops: 8000,
    food: 2400,
    maxFood: 4000,
    morale: 85,
    organization: 90,
    experience: 800,
    fatigue: 15,
    squads: [],
    structures: [
      {
        type: 'ram' as any,
        builderId: 1,
        buildProgress: 1,
        durability: 100,
        effect: '冲城',
        nodeId: 2,
      },
    ],
  };

  const mockGame: GameState = {
    year: 196,
    month: 5,
    playerFactionId: 1,
    cities: { 2: mockCity },
    factions: { 1: mockAtkFaction, 2: mockDefFaction },
    officers: { 1: mockOfficer },
    campaignArmies: [mockArmy],
    activeBattles: [],
    actionLog: [],
  } as unknown as GameState;

  it('renders siege assault dialog with army details, city defenses, and structures', () => {
    const html = renderToStaticMarkup(
      <SiegeAssaultDialog
        armyId="army-siege-01"
        game={mockGame}
      />,
    );

    expect(html).toContain('siege-assault-dialog');
    expect(html).toContain('兵临城下 · 江陵之围');
    expect(html).toContain('曹仁');
    expect(html).toContain('虎豹精骑');
    expect(html).toContain('锋矢阵');
    expect(html).toContain('冲车');
    expect(html).toContain('常备军');
    expect(html).toContain('4,500');
    expect(html).toContain('350');
    expect(html).toContain('600');
    expect(html).toContain('挥军强攻');
    expect(html).toContain('亲统登陴');
    expect(html).toContain('传檄劝降');
    expect(html).toContain('围困待变');
    expect(html).toContain('解围班师');
  });

  it('returns null when army is not found or armyId is empty', () => {
    const htmlEmpty = renderToStaticMarkup(
      <SiegeAssaultDialog
        armyId=""
        game={mockGame}
      />,
    );
    expect(htmlEmpty).toBe('');

    const htmlNotFound = renderToStaticMarkup(
      <SiegeAssaultDialog
        armyId="non-existent"
        game={mockGame}
      />,
    );
    expect(htmlNotFound).toBe('');
  });

  it('handles multi-army siege merge notification', () => {
    const secondArmy: CampaignArmy = {
      ...mockArmy,
      id: 'army-siege-02',
      name: '青州健儿',
      troops: 6000,
    };
    const gameWithMerge: GameState = {
      ...mockGame,
      campaignArmies: [mockArmy, secondArmy],
    };

    const html = renderToStaticMarkup(
      <SiegeAssaultDialog
        armyId="army-siege-01"
        game={gameWithMerge}
      />,
    );

    expect(html).toContain('【合流】');
    expect(html).toContain('2 军合流 · 共 14000 兵');
  });
});
