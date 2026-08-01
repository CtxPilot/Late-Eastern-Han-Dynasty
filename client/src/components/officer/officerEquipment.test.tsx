// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { OfficerDetail } from './OfficerDetail';
import type { GameState, Officer } from '@leh/shared';

/** 最小 GameState（OfficerDetail 装备 tab 消费：officers/factions/cities/females + itemsCatalog 来自 store） */
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
      1: { id: 1, name: '曹操军', color: '#4a6fa5', rulerId: 1, capitalCityId: 1, gold: 5000, food: 8000, courtNetwork: 0, cityIds: [1], officerIds: [1, 2], isPlayer: true, isAlive: true, inventory: { 1: 1 } },
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
    stats: { leadership: 80, war: 90, intelligence: 80, politics: 80, charisma: 80 },
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
    equipment: {},
    ...partial,
  } as Officer;
}

/** 注入 store 的 itemsCatalog（useGameStore 直接读 store 默认值；测试经 renderToStaticMarkup 无 store 提供者，
 *  这里依赖 store 初始值——默认 itemsCatalog=[]，装备 tab 显示"宝物目录加载中"。 */
describe('OfficerDetail 装备 tab（S13 Session 266）', () => {
  it('装备 tab 按钮存在（SSR 默认 stats tab，内容经交互切换）', () => {
    const html = renderToStaticMarkup(
      <OfficerDetail game={mkGame()} officer={mkOfficer({})} onClose={() => undefined} />,
    );
    expect(html).toContain('装备');
    expect(html).toContain('officer-tab-equipment');
  });

  it('武将装备字段在 stats tab 不崩溃（equipment 字段缺省兼容）', () => {
    const html = renderToStaticMarkup(
      <OfficerDetail game={mkGame()} officer={mkOfficer({ equipment: undefined })} onClose={() => undefined} />,
    );
    expect(html).toContain('六维');
  });

  it('君主详情不崩溃（isRuler 路径）', () => {
    const ruler = mkOfficer({ id: 1, equipment: undefined });
    const html = renderToStaticMarkup(
      <OfficerDetail game={mkGame()} officer={ruler} onClose={() => undefined} />,
    );
    expect(html).toContain('六维');
    expect(html).toContain('君主不计');
  });
});
