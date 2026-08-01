// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OfficerDetail } from './OfficerDetail';
import type { GameState, Officer } from '@leh/shared';

/** 最小 GameState（OfficerDetail 仅消费这些字段） */
function mkGame(): GameState {
  return {
    scenarioId: 1,
    enabledEventLayers: ['gameplay'],
    enabledChildEventIds: [],
    currentYear: 190,
    currentMonth: 1,
    season: 0,
    playerFactionId: 1,
    officers: {},
    cities: {
      1: { id: 1, name: '洛阳', province: 'test', x: 0, y: 0, maxPopulation: 50000, isCapital: false, isPass: false, specialProduct: null, recruitableUnits: [], initialStats: { farm: 100, commerce: 100, wall: 50 }, terrain: 'plain', stats: { farm: 100, commerce: 100, wall: 50, morale: 70 }, gold: 3000, food: 5000, population: 30000, demographics: { adultMale: 8000, adultFemale: 8000, child: 8000, elder: 6000 }, courtNetworkOpportunities: 20, troops: 5000, troopsMorale: 70, officers: [1], ruler: 1, facilities: [], policy: null, developmentProgress: { farm: 0, commerce: 0, wall: 0 } },
    },
    females: {},
    factions: {
      1: { id: 1, name: '曹操军', color: '#4a6fa5', rulerId: 1, capitalCityId: 1, gold: 5000, food: 8000, courtNetwork: 0, cityIds: [1], officerIds: [1], isPlayer: true, isAlive: true },
    },
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
  } as unknown as GameState;
}

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

describe('OfficerDetail 功绩属性加成展示（Session 265）', () => {
  it('Lv1 白身不渲染属性加成 +N', () => {
    const html = renderToStaticMarkup(
      <OfficerDetail game={mkGame()} officer={mkOfficer({})} onClose={() => undefined} />,
    );
    expect(html).toContain('六维');
    expect(html).toMatch(/功绩 Lv1/);
    // 不出现绿色加成标记
    expect(html).not.toContain('text-emerald-400');
  });

  it('Lv15 neutral 五维 +3、体力 +3（Lv5 体上限+3 字面）', () => {
    const html = renderToStaticMarkup(
      <OfficerDetail
        game={mkGame()}
        officer={mkOfficer({ merit: 45000, meritLevel: 15, peakMeritLevel: 15, meritPath: 'neutral' })}
        onClose={() => undefined}
      />,
    );
    expect(html).toContain('text-emerald-400');
    // 五维（统/武/智/政/魅）+3 与体力 +3 → 至少 6 处 emerald +3
    const bonuses = html.match(/text-emerald-400">\+3/g) ?? [];
    expect(bonuses.length).toBeGreaterThanOrEqual(6);
    expect(html).toContain('带兵+5000');
  });

  it('Lv20 warrior 武/统/智/政/魅 +16/+21/…、体力 +3（累计）', () => {
    const html = renderToStaticMarkup(
      <OfficerDetail
        game={mkGame()}
        officer={mkOfficer({
          merit: 210000,
          meritLevel: 20,
          peakMeritLevel: 20,
          meritPath: 'warrior',
          militaryPosition: 'grandGeneral' as Officer['militaryPosition'],
        })}
        onClose={() => undefined}
      />,
    );
    // Lv15 全+3 + Lv16 warrior 统+5 + Lv17 全+5 + Lv20 全+8
    // war=16 leadership=21 intelligence=16 politics=16 charisma=16 stamina=3
    expect(html).toContain('text-emerald-400">+21');
    expect(html).toContain('text-emerald-400">+16');
    expect(html).toContain('text-emerald-400">+3');
  });
});
