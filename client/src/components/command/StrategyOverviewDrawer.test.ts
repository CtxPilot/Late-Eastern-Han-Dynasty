// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { PlotStage, PlotType, SpyStatus, type GameState } from '@leh/shared';
import { buildStrategyOverview, validateStrategyLaunch } from './StrategyOverviewDrawer';

describe('strategy read-only overview model', () => {
  it('derives only player plots and eligible prerequisite summaries', () => {
    const game = {
      playerFactionId: 1,
      factions: {
        1: { id: 1, name: '曹操军', courtNetwork: 3 },
        2: { id: 2, name: '刘备军' },
      },
      cities: {
        1: { id: 1, name: '洛阳', ruler: 1, gold: 500, food: 900, troops: 3000 },
        2: { id: 2, name: '陈留', ruler: 1, gold: 200, food: 100, troops: 2500 },
        3: { id: 3, name: '宛城', ruler: 2, gold: 300, food: 500, troops: 5000 },
      },
      intel: {
        cities: { 3: { depth: 'detailed' } },
        agents: {
          a: { id: 'a', name: '红袖', factionId: 1, agentKind: 'female', status: SpyStatus.IDLE, cooldownMonths: 0 },
          b: { id: 'b', name: '青衣', factionId: 1, agentKind: 'female', status: SpyStatus.DEPLOYED, cooldownMonths: 0 },
          c: { id: 'c', name: '敌谍', factionId: 2, agentKind: 'female', status: SpyStatus.IDLE, cooldownMonths: 0 },
        },
      },
      plots: [
        {
          id: 'mine',
          type: PlotType.SOW_DISCORD,
          casterFactionId: 1,
          targetFactionId: 2,
          stage: PlotStage.PREP,
          monthsLeft: 1,
          year: 190,
          month: 1,
          cost: { gold: 200 },
        },
        {
          id: 'enemy',
          type: PlotType.FALSE_INTEL,
          casterFactionId: 2,
          targetCityId: 1,
          stage: PlotStage.ACTIVE,
          monthsLeft: 2,
          year: 190,
          month: 1,
          cost: { gold: 120 },
          result: { success: true, detected: false, message: '诱敌' },
        },
      ],
    } as unknown as GameState;

    const overview = buildStrategyOverview(game);

    expect(overview).toMatchObject({
      activeCount: 1,
      maxActive: 4,
      totalGold: 700,
      totalFood: 1000,
      courtNetwork: 3,
      detailedEnemyCities: ['宛城'],
      idleFemaleAgents: ['红袖'],
      emptyFortCandidates: ['洛阳'],
    });
    expect(overview.plots).toEqual([
      expect.objectContaining({
        id: 'mine',
        label: '离间计',
        target: '刘备军',
        stageLabel: '准备中',
      }),
    ]);
  });
});

describe('strategy launch validation', () => {
  const baseGame = {
    playerFactionId: 1,
    factions: {
      1: { id: 1, name: '曹操军', isAlive: true, courtNetwork: 2 },
      2: { id: 2, name: '刘备军', isAlive: true },
      3: { id: 3, name: '孙权军', isAlive: true },
    },
    cities: {
      1: { id: 1, name: '洛阳', ruler: 1, gold: 400, food: 200, troops: 3000 },
      2: { id: 2, name: '宛城', ruler: 2, gold: 300, food: 500, troops: 5000 },
    },
    diplomacy: [{ factionA: 1, factionB: 3, relation: 'allied' }],
    intel: {
      cities: { 2: { depth: 'detailed' } },
      agents: {
        a: {
          id: 'a',
          name: '红袖',
          factionId: 1,
          agentKind: 'female',
          status: SpyStatus.IDLE,
          cooldownMonths: 0,
        },
      },
    },
    plots: [],
  } as unknown as GameState;

  it('accepts each of the four authoritative plot prerequisites', () => {
    expect(validateStrategyLaunch(baseGame, {
      type: PlotType.HONEY_TRAP, targetCityId: 2, feintCityId: null, targetFactionId: null, agentId: 'a', targetOfficerId: null,
    })).toBeNull();
    expect(validateStrategyLaunch(baseGame, {
      type: PlotType.SOW_DISCORD, targetCityId: null, feintCityId: null, targetFactionId: 2, agentId: null, targetOfficerId: null,
    })).toBeNull();
    expect(validateStrategyLaunch(baseGame, {
      type: PlotType.FALSE_INTEL, targetCityId: 2, feintCityId: null, targetFactionId: null, agentId: null, targetOfficerId: null,
    })).toBeNull();
    expect(validateStrategyLaunch(baseGame, {
      type: PlotType.EMPTY_FORT, targetCityId: 1, feintCityId: null, targetFactionId: null, agentId: null, targetOfficerId: null,
    })).toBeNull();
    expect(validateStrategyLaunch(baseGame, {
      type: PlotType.UNDERMINE, targetCityId: 2, feintCityId: null, targetFactionId: null, agentId: null, targetOfficerId: null,
    })).toBeNull();
  });

  it('accepts strikeWhileHot only when target is at war with ≥2 factions', () => {
    const atWarWithTwo = {
      ...baseGame,
      diplomacy: [
        { factionA: 2, factionB: 3, relation: 'war' },
        { factionA: 2, factionB: 4, relation: 'war' },
      ],
      factions: {
        ...baseGame.factions,
        4: { id: 4, name: '袁术军', isAlive: true },
      },
    } as unknown as GameState;
    expect(validateStrategyLaunch(atWarWithTwo, {
      type: PlotType.STRIKE_WHILE_HOT, targetCityId: null, feintCityId: null, targetFactionId: 2, agentId: null, targetOfficerId: null,
    })).toBeNull();

    const atWarWithOne = {
      ...atWarWithTwo,
      diplomacy: [{ factionA: 2, factionB: 3, relation: 'war' }],
    } as unknown as GameState;
    expect(validateStrategyLaunch(atWarWithOne, {
      type: PlotType.STRIKE_WHILE_HOT, targetCityId: null, feintCityId: null, targetFactionId: 2, agentId: null, targetOfficerId: null,
    })).toContain('交战');

    expect(validateStrategyLaunch(atWarWithTwo, {
      type: PlotType.STRIKE_WHILE_HOT, targetCityId: null, feintCityId: null, targetFactionId: 3, agentId: null, targetOfficerId: null,
    })).toContain('交战');
  });

  it('rejects alliance, stale intel/agent and the active plot cap', () => {
    expect(validateStrategyLaunch(baseGame, {
      type: PlotType.SOW_DISCORD, targetCityId: null, feintCityId: null, targetFactionId: 3, agentId: null, targetOfficerId: null,
    })).toContain('盟友');

    const staleIntel = {
      ...baseGame,
      intel: { ...baseGame.intel, cities: {} },
    } as unknown as GameState;
    expect(validateStrategyLaunch(staleIntel, {
      type: PlotType.FALSE_INTEL, targetCityId: 2, feintCityId: null, targetFactionId: null, agentId: null, targetOfficerId: null,
    })).toContain('detailed');

    const capped = {
      ...baseGame,
      plots: Array.from({ length: 4 }, (_, index) => ({
        id: `p${index}`,
        casterFactionId: 1,
        stage: PlotStage.PREP,
      })),
    } as unknown as GameState;
    expect(validateStrategyLaunch(capped, {
      type: PlotType.SOW_DISCORD, targetCityId: null, feintCityId: null, targetFactionId: 2, agentId: null, targetOfficerId: null,
    })).toContain('上限');
  });

  it('accepts killChicken when ≥2 low-loyalty officers and gold available', () => {
    const game = {
      ...baseGame,
      factions: {
        ...baseGame.factions,
        1: { ...baseGame.factions[1], rulerId: 1 },
      },
      officers: {
        1: { id: 1, name: '曹操', faction: 1, status: 'active', loyalty: 100 },
        2: { id: 2, name: '夏侯惇', faction: 1, status: 'active', loyalty: 55 },
        3: { id: 3, name: '许褚', faction: 1, status: 'active', loyalty: 60 },
      },
    } as unknown as GameState;
    expect(validateStrategyLaunch(game, {
      type: PlotType.KILL_CHICKEN, targetCityId: null, feintCityId: null, targetFactionId: null, agentId: null, targetOfficerId: null,
    })).toBeNull();
    expect(validateStrategyLaunch(game, {
      type: PlotType.KILL_CHICKEN, targetCityId: null, feintCityId: null, targetFactionId: null, agentId: null, targetOfficerId: 2,
    })).toBeNull();
    expect(validateStrategyLaunch(game, {
      type: PlotType.KILL_CHICKEN, targetCityId: null, feintCityId: null, targetFactionId: null, agentId: null, targetOfficerId: 1,
    })).toContain('儆猴目标');
  });

  it('accepts lureTiger only with detailed intel, female spy, lureable officer and a dest city', () => {
    const game = {
      ...baseGame,
      cities: {
        ...baseGame.cities,
        2: { ...baseGame.cities[2], officers: [20] },
        4: { id: 4, name: '许昌', ruler: 2, gold: 100, food: 200, troops: 2000, officers: [] },
      },
      factions: {
        ...baseGame.factions,
        2: { ...baseGame.factions[2], rulerId: 10 },
      },
      officers: {
        10: { id: 10, name: '刘备', faction: 2, status: 'active', loyalty: 100, stats: { war: 80 } },
        20: { id: 20, name: '关羽', faction: 2, status: 'active', loyalty: 90, stats: { war: 97 } },
      },
    } as unknown as GameState;
    expect(validateStrategyLaunch(game, {
      type: PlotType.LURE_TIGER, targetCityId: 2, feintCityId: null, targetFactionId: null, agentId: 'a', targetOfficerId: 20,
    })).toBeNull();
    expect(validateStrategyLaunch(game, {
      type: PlotType.LURE_TIGER, targetCityId: 2, feintCityId: null, targetFactionId: null, agentId: null, targetOfficerId: null,
    })).toContain('女间谍');
    expect(validateStrategyLaunch(game, {
      type: PlotType.LURE_TIGER, targetCityId: 2, feintCityId: null, targetFactionId: null, agentId: 'a', targetOfficerId: 10,
    })).toContain('诱离目标');
  });

  it('accepts watchFire when two other factions have favor ≥40', () => {
    const game = {
      ...baseGame,
      diplomacy: [
        { factionA: 2, factionB: 3, relation: 'friendly', favorability: 50 },
      ],
    } as unknown as GameState;
    expect(validateStrategyLaunch(game, {
      type: PlotType.WATCH_FIRE, targetCityId: null, feintCityId: null, targetFactionId: 2, secondaryFactionId: 3, agentId: null, targetOfficerId: null,
    })).toBeNull();
    expect(validateStrategyLaunch(game, {
      type: PlotType.WATCH_FIRE, targetCityId: null, feintCityId: null, targetFactionId: 2, secondaryFactionId: 3, agentId: null, targetOfficerId: null,
    })).toBeNull();
    const cold = {
      ...game,
      diplomacy: [{ factionA: 2, factionB: 3, relation: 'neutral', favorability: 10 }],
    } as unknown as GameState;
    expect(validateStrategyLaunch(cold, {
      type: PlotType.WATCH_FIRE, targetCityId: null, feintCityId: null, targetFactionId: 2, secondaryFactionId: 3, agentId: null, targetOfficerId: null,
    })).toContain('友好');
  });

  it('accepts edict against another living faction', () => {
    expect(validateStrategyLaunch(baseGame, {
      type: PlotType.EDICT, targetCityId: null, feintCityId: null, targetFactionId: 2, agentId: null, targetOfficerId: null,
    })).toBeNull();
  });
});
