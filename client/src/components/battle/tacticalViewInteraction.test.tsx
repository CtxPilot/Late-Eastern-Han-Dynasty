// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  TerrainType,
  Weather,
  UnitType,
  FormationType,
  getTacticalTerrainInfo,
  effectiveSightRange,
  type BattleUnit,
} from '@leh/shared';
import { TacticalUnitPiece } from './TacticalUnitPiece';
import { BattleView } from './BattleView';
import { useGameStore } from '../../stores/gameStore';

// Mock react-konva elements for static rendering
const { createKonvaMock } = vi.hoisted(() => {
  const createKonvaMock = (tag: string) => {
    const MockComponent = ({
      children,
      name,
      text,
      x,
      y,
      width,
      height,
      fill,
      stroke,
    }: {
      children?: React.ReactNode;
      name?: string;
      text?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      fill?: string;
      stroke?: string;
    }) =>
      React.createElement(
        'div',
        {
          'data-konva-tag': tag,
          'data-name': name,
          'data-text': text,
          'data-x': x,
          'data-y': y,
          'data-width': width,
          'data-height': height,
          'data-fill': fill,
          'data-stroke': stroke,
        },
        text ?? children,
      );
    MockComponent.displayName = `KonvaMock_${tag}`;
    return MockComponent;
  };
  return { createKonvaMock };
});

vi.mock('konva', () => ({
  default: {
    Easings: {
      EaseInOut: (t: number) => t,
      EaseOut: (t: number) => t,
    },
  },
  Easings: {
    EaseInOut: (t: number) => t,
    EaseOut: (t: number) => t,
  },
}));

vi.mock('react-konva', () => ({
  Group: createKonvaMock('Group'),
  Rect: createKonvaMock('Rect'),
  Circle: createKonvaMock('Circle'),
  Line: createKonvaMock('Line'),
  Text: createKonvaMock('Text'),
  Stage: createKonvaMock('Stage'),
  Layer: createKonvaMock('Layer'),
  RegularPolygon: createKonvaMock('RegularPolygon'),
}));

function mockUnit(overrides: Partial<BattleUnit> = {}): BattleUnit {
  return {
    id: 'u-1',
    armyId: 'army-1',
    commanderId: 1,
    commanderName: '关羽',
    factionId: 1,
    side: 'attacker',
    unitType: UnitType.LIGHT_INFANTRY,
    formation: FormationType.SQUARE,
    troopCount: 800,
    maxTroops: 1000,
    morale: 90,
    food: 100,
    position: { q: 2, r: 3 },
    facing: 0,
    mp: 4,
    maxMp: 4,
    energy: 100,
    maxEnergy: 100,
    hasActed: false,
    isRetreated: false,
    isDestroyed: false,
    statusEffects: [],
    ...overrides,
  };
}

describe('S21-W7 二级战术串联 — 地形情报与 Hex 悬停', () => {
  it('getTacticalTerrainInfo 正确返回平原、林地、山地、水域等核心地貌数据', () => {
    const plain = getTacticalTerrainInfo(TerrainType.PLAIN);
    expect(plain.name).toBe('平原');
    expect(plain.moveCost).toBe(1);
    expect(plain.attackMod).toBe(0);
    expect(plain.defenseMod).toBe(0);
    expect(plain.tacticalTip).toContain('骑兵');

    const forest = getTacticalTerrainInfo(TerrainType.FOREST);
    expect(forest.name).toBe('林地');
    expect(forest.moveCost).toBe(2);
    expect(forest.attackMod).toBe(-0.1);
    expect(forest.defenseMod).toBe(0.2);
    expect(forest.tacticalTip).toContain('防御+20%');

    const mountain = getTacticalTerrainInfo(TerrainType.MOUNTAIN);
    expect(mountain.name).toBe('山地');
    expect(mountain.moveCost).toBe(3);
    expect(mountain.attackMod).toBe(-0.2);
    expect(mountain.defenseMod).toBe(0.3);
    expect(mountain.tacticalTip).toContain('防御+30%');

    const water = getTacticalTerrainInfo(TerrainType.WATER);
    expect(water.name).toBe('水域');
    expect(water.moveCost).toBe(4);
    expect(water.attackMod).toBe(-0.3);
    expect(water.defenseMod).toBe(-0.2);

    const wall = getTacticalTerrainInfo(TerrainType.WALL);
    expect(wall.moveCost).toBe(99);
    expect(wall.defenseMod).toBe(0.4);

    const city = getTacticalTerrainInfo(TerrainType.CITY);
    expect(city.moveCost).toBe(99);
    expect(city.defenseMod).toBe(0.5);
  });

  it('未知地貌有安全降级兜底', () => {
    const unknown = getTacticalTerrainInfo('magical_swamp');
    expect(unknown.name).toBe('未知');
    expect(unknown.moveCost).toBe(1);
  });

  it('Hex 地形情报悬停卡片内容与格式检验（防御/攻击修正百分比与移动消耗）', () => {
    const forestInfo = getTacticalTerrainInfo(TerrainType.FOREST);
    const tooltipHtml = renderToStaticMarkup(
      <div data-testid="hex-terrain-tooltip">
        <span>{forestInfo.name} · {forestInfo.title}</span>
        <span>移动消耗 {forestInfo.moveCost} MP</span>
        <span>攻 {Math.round(forestInfo.attackMod * 100)}% · 防 +{Math.round(forestInfo.defenseMod * 100)}%</span>
        <div>{forestInfo.tacticalTip}</div>
      </div>,
    );

    expect(tooltipHtml).toContain('data-testid="hex-terrain-tooltip"');
    expect(tooltipHtml).toContain('林地 · 茂密丛林');
    expect(tooltipHtml).toContain('移动消耗 2 MP');
    expect(tooltipHtml).toContain('攻 -10% · 防 +20%');
    expect(tooltipHtml).toContain('防御+20%');
    expect(tooltipHtml).toContain('骑兵移动力减半');
  });
});

describe('S21-W7 二级战术串联 — 棋子渲染与滑行动画结构', () => {
  it('TacticalUnitPiece 能够稳定渲染主帅首字、兵种印信篆字与血条', () => {
    const u = mockUnit({ commanderName: '张飞', troopCount: 500, maxTroops: 1000 });
    const html = renderToStaticMarkup(
      <TacticalUnitPiece
        unit={u}
        targetPixel={{ x: 120, y: 160 }}
        isSelected={true}
        isMultiArmyStorm={true}
        armyName="先锋营"
      />,
    );

    expect(html).toContain('张');
    expect(html).toContain('步'); // lightInfantry -> 步
    expect(html).toContain('先锋营');
    expect(html).toContain('unit-piece-u-1');
  });
});

describe('S21-W7 二级战术串联 — 战术视野与迷雾散开计算', () => {
  it('effectiveSightRange 根据所在格地形与天气动态伸缩视界', () => {
    // 晴天平原基线 4 格
    const clearPlain = effectiveSightRange(TerrainType.PLAIN, Weather.CLEAR);
    expect(clearPlain).toBe(4);

    // 晴中山地视野+1 格
    const clearMountain = effectiveSightRange(TerrainType.MOUNTAIN, Weather.CLEAR);
    expect(clearMountain).toBe(5);

    // 晴中林地视野-1 格
    const clearForest = effectiveSightRange(TerrainType.FOREST, Weather.CLEAR);
    expect(clearForest).toBe(3);

    // 大雾天气视野衰减 2 格
    const fogPlain = effectiveSightRange(TerrainType.PLAIN, Weather.FOG);
    expect(fogPlain).toBe(2);

    // 大雪山地：5 - 3 = 2 格
    const snowMountain = effectiveSightRange(TerrainType.MOUNTAIN, Weather.SNOW);
    expect(snowMountain).toBe(2);
  });
});

describe('S21-W7 二级战术串联 — screen 六态栈与三级白刃战串接', () => {
  it('支持 screen 六态栈与从 tactical/battle 到 melee 再出栈回退', async () => {
    const store = useGameStore.getState();

    // 1. 初始化为大地图
    store.replaceSceneStack({ scene: 'world' });
    expect(useGameStore.getState().screen).toBe('world');

    // 2. 进入二级六角战术沙盘
    store.pushSceneFrame({ scene: 'tactical', battleId: 'battle-01' });
    expect(useGameStore.getState().screen).toBe('tactical');

    // 3. 邻接短兵相接触发三级白刃战
    store.pushSceneFrame({ scene: 'melee' });
    expect(useGameStore.getState().screen).toBe('melee');

    // 4. 鸣金收兵/白刃战结算出栈，回退至 tactical
    store.popToSceneFrame('tactical');
    expect(useGameStore.getState().screen).toBe('tactical');

    // 5. 六角战役大捷，出栈回退至 world
    store.popToSceneFrame('world');
    expect(useGameStore.getState().screen).toBe('world');
  });

  it('setScreen 方法能够设置任意合规 Screen 并同步场景栈', () => {
    const store = useGameStore.getState();
    store.setScreen('campaign');
    expect(useGameStore.getState().screen).toBe('campaign');

    store.setScreen('tactical');
    expect(useGameStore.getState().screen).toBe('tactical');

    store.setScreen('melee');
    expect(useGameStore.getState().screen).toBe('melee');
  });

  it('BattleView 完整装配：切入渐变遮罩、迷雾挖洞层与邻接短兵相接按钮', () => {
    const attackerUnit = mockUnit({
      id: 'atk-1',
      commanderId: 1,
      commanderName: '关羽',
      side: 'attacker',
      position: { q: 2, r: 2 },
      hasActed: false,
    });
    const defenderUnit = mockUnit({
      id: 'def-1',
      commanderId: 2,
      commanderName: '曹仁',
      side: 'defender',
      position: { q: 2, r: 3 }, // 相邻 hex (q=2, r=3 与 q=2, r=2 邻接)
      hasActed: false,
    });

    const mockGame = {
      currentYear: 195,
      currentMonth: 1,
      playerFactionId: 1,
      factions: {
        1: { id: 1, name: '刘备', color: '#10b981', capitalCityId: 1, inventory: {} } as any,
        2: { id: 2, name: '曹操', color: '#3b82f6', capitalCityId: 2, inventory: {} } as any,
      },
      officers: {
        1: { id: 1, name: '关羽', faction: 1, stats: { war: 98, leadership: 95, force: 98, intelligence: 78, politics: 62, charm: 93 }, hidden: { ceilingBonus: null }, birthYear: 160 } as any,
        2: { id: 2, name: '曹仁', faction: 2, stats: { war: 86, leadership: 88, force: 86, intelligence: 75, politics: 68, charm: 74 }, hidden: { ceilingBonus: null }, birthYear: 168 } as any,
      },
      campaignArmies: [
        { id: 'army-1', name: '关羽军', factionId: 1, commanderId: 1, troops: 800, formation: FormationType.SQUARE } as any,
      ],
      cities: {
        1: { id: 1, name: '下邳', x: 200, y: 200, ruler: 1 } as any,
        2: { id: 2, name: '许昌', x: 260, y: 190, ruler: 2 } as any,
      },
      actionLog: [],
    } as any;

    const mockBattle = {
      id: 'b-test-1',
      turn: 1,
      phase: 'player',
      weather: Weather.CLEAR,
      activeStrategem: 'none',
      tacticalPoints: 5,
      tacticalPointsUsed: 0,
      message: '两军对垒，风云际会',
      log: [],
      hexGrid: {
        width: 5,
        height: 5,
        terrain: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => TerrainType.PLAIN)),
      },
      units: [attackerUnit, defenderUnit],
    } as any;

    useGameStore.setState({
      screen: 'tactical',
      selectedUnitId: 'atk-1',
      game: mockGame,
      battle: mockBattle,
    });

    const html = renderToStaticMarkup(
      <BattleView battle={mockBattle} game={mockGame} selectedUnitId="atk-1" />,
    );

    // 1. 验证切入渐变遮罩渲染
    expect(html).toContain('data-testid="tactical-transition-overlay"');

    // 2. 验证天气与战况状态栏
    expect(html).toContain('data-testid="battle-weather"');

    // 3. 验证邻接交锋按钮已正确显现（短兵接战入白刃与阵列急袭直接结算）
    expect(html).toContain('data-testid="btn-trigger-melee"');
    expect(html).toContain('短兵接战（入白刃）');
    expect(html).toContain('data-testid="btn-direct-attack"');
    expect(html).toContain('阵列急袭（直接结算）');

    // 4. 验证棋子滑行组件与兵种印信已挂载
    expect(html).toContain('unit-piece-atk-1');
    expect(html).toContain('unit-piece-def-1');
  });
});
