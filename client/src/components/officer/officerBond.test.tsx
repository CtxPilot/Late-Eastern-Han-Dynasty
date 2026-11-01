// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S24（Session 454，docs/52）：关系网深度缔结面的静态渲染契约。
 * 真正的资格判定在服务端权威引擎；此处只保证 UI 入口、运行时关系回显与候选过滤。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BondTab } from './OfficerDetail';
import type { GameState, Officer } from '@leh/shared';

function mkOfficer(partial: Partial<Officer>): Officer {
  return {
    id: 2,
    name: '测试将',
    birthYear: 160,
    deathYear: 220,
    stats: { leadership: 80, war: 80, intelligence: 80, politics: 80, charisma: 80 },
    hidden: {
      compatibility: 50, righteousness: 5, ambition: 5, valor: 3, composure: 3,
      lifespan: 60, growth: 'B', personality: 'brave', ideal: 'power', bloodline: [],
      ceilingBonus: null, power: 50, burst: 50, agility: 50, luck: 50, intuition: 50,
      awe: 50, strategy: 50, tactics: 50,
    },
    unitProficiency: {},
    formationMastery: [],
    skills: [],
    tags: [],
    faction: 1,
    location: 1,
    loyalty: 70,
    experience: 0,
    status: 'active',
    civilPosition: 'none',
    localPosition: 'none',
    militaryPosition: 'none',
    nobilityRank: 'none',
    merit: 0,
    stamina: 100,
    beauties: [],
    ...partial,
  } as Officer;
}

function mkGame(overrides: Partial<GameState> = {}): GameState {
  return {
    scenarioId: 1,
    enabledEventLayers: ['gameplay'],
    enabledChildEventIds: [],
    currentYear: 190,
    currentMonth: 1,
    season: 0,
    playerFactionId: 1,
    officers: {},
    cities: {},
    females: {},
    factions: {},
    armys: [],
    campaignArmies: [],
    campaignNodes: [],
    grandStrategists: [],
    activeBattles: [],
    activeBattlefield: null,
    activeMelee: null,
    diplomacy: [],
    intel: { reports: [], spyNetwork: [], captives: [] },
    plots: [],
    completedEvents: [],
    pendingEvents: [],
    invalidatedEvents: [],
    eventChoices: {},
    actionLog: [],
    ...overrides,
  } as unknown as GameState;
}

describe('OfficerDetail 关系网深度缔结面（Session 454）', () => {
  it('回显运行时义兄弟关系', () => {
    const officer = mkOfficer({ id: 2 });
    const peer = mkOfficer({ id: 3, name: '义弟' });
    const game = mkGame({
      officers: { 2: officer, 3: peer },
      runtimeRelations: [
        { fromId: 2, toId: 3, type: 'sworn', establishedYear: 190, establishedMonth: 1 },
      ],
    });
    const html = renderToStaticMarkup(<BondTab officer={officer} game={game} />);
    expect(html).toContain('officer-runtime-relation-3');
    expect(html).toContain('义兄弟');
    expect(html).toContain('190年1月');
  });

  it('同城己方武将提供结义与拜师入口', () => {
    const officer = mkOfficer({ id: 2 });
    const peer = mkOfficer({ id: 3, name: '同城将' });
    const game = mkGame({ officers: { 2: officer, 3: peer } });
    const html = renderToStaticMarkup(<BondTab officer={officer} game={game} />);
    expect(html).toContain('同城缔结');
    expect(html).toContain('officer-swear-3');
    expect(html).toContain('officer-mentor-3');
  });

  it('非己方武将不提供缔结入口', () => {
    const officer = mkOfficer({ id: 2, faction: 9 });
    const peer = mkOfficer({ id: 3, faction: 9 });
    const game = mkGame({ officers: { 2: officer, 3: peer } });
    const html = renderToStaticMarkup(<BondTab officer={officer} game={game} />);
    expect(html).not.toContain('同城缔结');
    expect(html).not.toContain('officer-swear-3');
  });
});
