// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { SpyMissionType, SpyStatus, type GameState } from '@leh/shared';
import {
  buildIntelOverview,
  validateIntelOperationOrder,
  validateIntelPersonnelOrder,
} from './IntelOverviewDrawer';

describe('intel read-only overview model', () => {
  it('derives player-visible personnel, reports, tasks and counter-intel', () => {
    const game = {
      playerFactionId: 1,
      factions: {
        1: { id: 1, name: '曹操军' },
        2: { id: 2, name: '刘备军' },
      },
      cities: {
        1: { id: 1, name: '洛阳', ruler: 1 },
        2: { id: 2, name: '陈留', ruler: 1 },
        3: { id: 3, name: '许昌', ruler: 1 },
        4: { id: 4, name: '宛城', ruler: 2 },
      },
      intel: {
        cities: {
          4: { depth: 'detailed', source: 'recon', expireYear: 191, expireMonth: 2 },
        },
        agents: {
          own: {
            id: 'own', factionId: 1, name: '墨鸦', rank: 2, exp: 0,
            skills: { recon: 40, sabotage: 30, lethal: 20, tradecraft: 50 },
            status: SpyStatus.IDLE, homeCityId: 1, locationCityId: 1,
            cooldownMonths: 0, missionsDone: 1,
          },
          dead: {
            id: 'dead', factionId: 1, name: '旧影', rank: 1, exp: 0,
            skills: { recon: 20, sabotage: 20, lethal: 20, tradecraft: 20 },
            status: SpyStatus.DEAD, homeCityId: 1, locationCityId: null,
            cooldownMonths: 0, missionsDone: 0,
          },
          captive: {
            id: 'captive', factionId: 2, name: '敌谍', rank: 1, exp: 0,
            skills: { recon: 20, sabotage: 20, lethal: 20, tradecraft: 20 },
            status: SpyStatus.CAPTIVE, homeCityId: 4, locationCityId: 1,
            captiveByFactionId: 1, cooldownMonths: 0, missionsDone: 0,
          },
          hiddenEnemy: {
            id: 'hiddenEnemy', factionId: 2, name: '越权敌谍', rank: 1, exp: 0,
            skills: { recon: 20, sabotage: 20, lethal: 20, tradecraft: 20 },
            status: SpyStatus.IDLE, homeCityId: 4, locationCityId: 4,
            cooldownMonths: 0, missionsDone: 0,
          },
        },
        cityDefense: {
          1: { level: 2, untilYear: 191, untilMonth: 1, stationAgentId: 'own' },
          4: { level: 3, untilYear: 191, untilMonth: 1 },
        },
        recentMissions: [
          {
            year: 190, month: 2, type: 'recon', agentId: 'own', agentName: '墨鸦',
            factionId: 1, targetCityId: 4, success: true, captured: false, dead: false,
            message: '探得虚实',
          },
          {
            year: 190, month: 2, type: 'recon', agentId: 'hiddenEnemy',
            agentName: '越权敌谍', factionId: 2, targetCityId: 1, success: true,
            captured: false, dead: false, message: '不应出现',
          },
        ],
        plantableBeauty: { 2: 2 },
      },
    } as unknown as GameState;

    const overview = buildIntelOverview(game);

    expect(overview).toMatchObject({
      rosterCount: 1,
      rosterCap: 2,
      reports: [expect.objectContaining({ city: '宛城', depth: 'detailed' })],
      defenses: [expect.objectContaining({ city: '洛阳', station: '墨鸦' })],
      captives: [expect.objectContaining({ name: '敌谍', faction: '刘备军' })],
      plantable: [expect.objectContaining({ faction: '刘备军', count: 2 })],
    });
    expect(overview.agents.map((agent) => agent.name)).toEqual(['墨鸦']);
    expect(overview.missions.map((mission) => mission.agentName)).toEqual(['墨鸦']);
    expect(JSON.stringify(overview)).not.toContain('越权敌谍');
  });
});

describe('intel personnel order validation', () => {
  const game = {
    playerFactionId: 1,
    factions: {
      1: { id: 1, name: '曹操军', courtNetwork: 2, isAlive: true },
      2: { id: 2, name: '刘备军', courtNetwork: 1, isAlive: true },
    },
    cities: {
      1: {
        id: 1, name: '洛阳', ruler: 1, gold: 500, food: 500, troops: 8000,
        demographics: { adultMale: 8000 },
      },
      2: {
        id: 2, name: '陈留', ruler: 1, gold: 20, food: 500, troops: 1000,
        demographics: { adultMale: 1000 },
      },
    },
    intel: {
      agents: {},
      plantableBeauty: { 2: 1 },
    },
  } as unknown as GameState;

  it('validates authoritative roster and resource prerequisites for all three orders', () => {
    expect(validateIntelPersonnelOrder(game, { type: 'recruit', cityId: 1 })).toBeNull();
    expect(validateIntelPersonnelOrder(game, { type: 'train-female', cityId: 1 })).toBeNull();
    expect(validateIntelPersonnelOrder(game, { type: 'plant-female', targetFactionId: 2 })).toBeNull();
    expect(validateIntelPersonnelOrder(game, { type: 'recruit', cityId: 2 })).toContain('金钱不足');

    const noQuota = {
      ...game,
      intel: { ...game.intel, plantableBeauty: {} },
    } as unknown as GameState;
    expect(validateIntelPersonnelOrder(noQuota, {
      type: 'plant-female',
      targetFactionId: 2,
    })).toContain('额度');
  });
});

describe('intel operation order validation', () => {
  const game = {
    playerFactionId: 1,
    factions: {
      1: { id: 1, name: '曹操军', isAlive: true },
      2: { id: 2, name: '刘备军', isAlive: true },
    },
    diplomacy: [],
    cities: {
      1: { id: 1, name: '洛阳', ruler: 1, gold: 200 },
      7: { id: 7, name: '陈留', ruler: 2, gold: 100 },
      30: { id: 30, name: '龙编', ruler: 2, gold: 100 },
    },
    intel: {
      agents: {
        male: {
          id: 'male', factionId: 1, name: '墨鸦', rank: 2,
          skills: { recon: 40, sabotage: 30, lethal: 20, tradecraft: 50 },
          status: SpyStatus.IDLE, homeCityId: 1, locationCityId: 1,
          cooldownMonths: 0, missionsDone: 0,
        },
        female: {
          id: 'female', factionId: 1, name: '红袖', rank: 2, agentKind: 'female',
          skills: { recon: 40, sabotage: 30, lethal: 20, tradecraft: 50 },
          status: SpyStatus.IDLE, homeCityId: 1, locationCityId: 1,
          cooldownMonths: 0, missionsDone: 0,
        },
        captive: {
          id: 'captive', factionId: 2, name: '敌谍', rank: 1,
          skills: { recon: 20, sabotage: 20, lethal: 20, tradecraft: 20 },
          status: SpyStatus.CAPTIVE, homeCityId: 7, locationCityId: 1,
          captiveByFactionId: 1, cooldownMonths: 0, missionsDone: 0,
        },
      },
      cityDefense: {
        1: { level: 1, untilYear: 9999, untilMonth: 12, stationAgentId: 'male' },
      },
    },
  } as unknown as GameState;

  it('covers mission adjacency, female-only work, counter duty and captive ownership', () => {
    expect(validateIntelOperationOrder(game, {
      type: 'mission', agentId: 'male', missionType: SpyMissionType.RECON, targetCityId: 7,
    })).toBeNull();
    expect(validateIntelOperationOrder(game, {
      type: 'mission', agentId: 'male', missionType: SpyMissionType.PILLOW_TALK, targetCityId: 7,
    })).toContain('女间谍');
    expect(validateIntelOperationOrder(game, {
      type: 'mission', agentId: 'female', missionType: SpyMissionType.PILLOW_TALK, targetCityId: 30,
    })).toContain('官道邻接');
    expect(validateIntelOperationOrder(game, {
      type: 'station', agentId: 'female', cityId: 1,
    })).toBeNull();
    expect(validateIntelOperationOrder(game, { type: 'unstation', cityId: 1 })).toBeNull();
    expect(validateIntelOperationOrder(game, {
      type: 'captive', agentId: 'captive', action: 'release',
    })).toBeNull();
  });
});
