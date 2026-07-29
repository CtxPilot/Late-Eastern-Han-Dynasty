// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import type { GameState } from '@leh/shared';
import { buildMilitaryOverview } from './MilitaryOverviewDrawer';
import {
  validateMilitaryFormationDraft,
  type MilitaryFormationDraft,
} from './MilitaryFormationForm';
import { validateMilitaryOrder } from './MilitaryOrdersPanel';
import { validateReadinessOrder } from './MilitaryReadinessPanel';

const game = {
  playerFactionId: 1,
  cities: {
    1: { id: 1, name: '洛阳', ruler: 1, troops: 4000, troopsMorale: 80, food: 6000, gold: 700, officers: [1, 2] },
    2: { id: 2, name: '陈留', ruler: 1, troops: 7000, troopsMorale: 60, food: 8000, gold: 900, officers: [3] },
    3: { id: 3, name: '宛城', ruler: 2, troops: 9000, troopsMorale: 90, food: 9000, gold: 900, officers: [4] },
  },
  officers: {
    1: { id: 1, name: '曹操', faction: 1, location: 1, status: 'active', stats: { intelligence: 90 } },
    2: { id: 2, name: '夏侯惇', faction: 1, location: 1, status: 'active', stats: { intelligence: 70 } },
    3: { id: 3, name: '荀彧', faction: 1, location: 2, status: 'active', stats: { intelligence: 95 } },
    4: { id: 4, name: '敌将', faction: 2, location: 3, status: 'active', stats: { intelligence: 70 } },
  },
  campaignArmies: [
    {
      id: 'army-1',
      factionId: 1,
      name: '夏侯惇军',
      commanderId: 2,
      phase: 'marching',
      currentNodeId: 1,
      targetNodeId: 3,
      troops: 3000,
      morale: 75,
      organization: 68,
      fatigue: 12,
      food: 1500,
    },
    {
      id: 'army-2',
      factionId: 2,
      name: '敌军',
      commanderId: 4,
      phase: 'garrison',
      currentNodeId: 3,
      troops: 5000,
      morale: 70,
      organization: 70,
      fatigue: 0,
      food: 2000,
    },
  ],
} as unknown as GameState;

const validDraft: MilitaryFormationDraft = {
  fromNodeId: 1,
  commanderId: 2,
  subCommanderIds: [],
  advisorId: 1,
  targetNodeId: 3,
  unitType: 'heavyCavalry',
  formation: 1,
  troopCount: 3000,
  food: 1200,
};

describe('military read-only overview model', () => {
  it('derives only player cities and armies without duplicating enemy intelligence', () => {
    const overview = buildMilitaryOverview(game);

    expect(overview.cities.map((city) => city.name)).toEqual(['陈留', '洛阳']);
    expect(overview.armies).toEqual([
      expect.objectContaining({
        armyId: 'army-1',
        commanderName: '夏侯惇',
        phaseLabel: '行军',
        currentNodeName: '洛阳',
        targetNodeName: '宛城',
      }),
    ]);
    expect(overview.totalTroops).toBe(14_000);
    expect(overview.totalFood).toBe(15_500);
    expect(overview.averageMorale).toBe(70);
  });

  it('revalidates the command draft against latest authoritative roles and resources', () => {
    const adjacentGame = {
      ...game,
      campaignNodes: [{ id: 1, adjacentNodeIds: [3] }],
    } as GameState;
    expect(validateMilitaryFormationDraft(adjacentGame, validDraft)).toBeNull();
    expect(validateMilitaryFormationDraft(adjacentGame, {
      ...validDraft,
      troopCount: 5000,
    })).toContain('资源已变化');
    expect(validateMilitaryFormationDraft(adjacentGame, {
      ...validDraft,
      subCommanderIds: [1],
    })).toContain('不可重复');
  });

  it('revalidates military orders against the latest phase, advisor and resources', () => {
    const orderGame = {
      ...game,
      factions: { 1: { id: 1, gold: 250 } },
      officers: {
        ...game.officers,
        1: { ...game.officers[1], stamina: 35 },
      },
      campaignArmies: [{
        ...game.campaignArmies[0],
        advisorId: 1,
        structures: [],
      }],
    } as unknown as GameState;

    expect(validateMilitaryOrder(orderGame, { kind: 'advisor', armyId: 'army-1', action: 'inspire' })).toBeNull();
    expect(validateMilitaryOrder(orderGame, { kind: 'advisor', armyId: 'army-1', action: 'trap' })).toContain('体力不足');
    expect(validateMilitaryOrder(orderGame, { kind: 'build', armyId: 'army-1', structureType: 'ram' })).toContain('势力金不足');
    expect(validateMilitaryOrder(orderGame, { kind: 'assault', armyId: 'army-1' })).toContain('不能强攻');
    expect(validateMilitaryOrder(orderGame, { kind: 'retreat', armyId: 'army-1' })).toBeNull();
  });

  it('revalidates conscription and training against latest city ownership and resources', () => {
    const readinessGame = {
      ...game,
      cities: {
        ...game.cities,
        1: {
          ...game.cities[1],
          demographics: { adultMale: 1000, adultFemale: 900, child: 400, elder: 200 },
        },
      },
    } as unknown as GameState;
    expect(validateReadinessOrder(readinessGame, 1, 'conscript')).toBeNull();
    expect(validateReadinessOrder(readinessGame, 1, 'train')).toBeNull();
    expect(validateReadinessOrder({
      ...readinessGame,
      cities: { ...readinessGame.cities, 1: { ...readinessGame.cities[1], gold: 79 } },
    }, 1, 'conscript')).toContain('金不足');
    expect(validateReadinessOrder({
      ...readinessGame,
      cities: { ...readinessGame.cities, 1: { ...readinessGame.cities[1], ruler: 2 } },
    }, 1, 'train')).toContain('归属');
  });
});
