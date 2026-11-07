// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  UnitType,
  FormationType,
  Weather,
} from '@leh/shared';
import { MeleeStage } from './MeleeStage';
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
    }: {
      children?: React.ReactNode;
      name?: string;
      text?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      fill?: string;
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
  Stage: createKonvaMock('Stage'),
  Layer: createKonvaMock('Layer'),
  Group: createKonvaMock('Group'),
  Rect: createKonvaMock('Rect'),
  Text: createKonvaMock('Text'),
  Shape: createKonvaMock('Shape'),
}));

vi.mock('../../utils/sfx', () => ({
  playDrum: vi.fn(),
  playGong: vi.fn(),
}));

describe('MeleeStage — 三级白刃战横版两军对垒舞台', () => {
  beforeEach(() => {
    useGameStore.setState({
      screen: 'melee',
      sceneStack: [{ scene: 'world' }, { scene: 'tactical' }, { scene: 'melee' }],
    });
  });

  const mockAttackerUnit: any = {
    id: 'atk-1',
    side: 'attacker',
    unitType: UnitType.SPEARMAN,
    commanderId: 1,
    commanderName: '关羽',
    troopCount: 4200,
    maxTroops: 5000,
    morale: 95,
    position: { q: 2, r: 3 },
    mp: 2,
    maxMp: 4,
    hasActed: false,
    isDestroyed: false,
    formation: FormationType.ARROWHEAD,
  };

  const mockDefenderUnit: any = {
    id: 'def-1',
    side: 'defender',
    unitType: UnitType.HEAVY_CAVALRY,
    commanderId: 2,
    commanderName: '曹仁',
    troopCount: 3800,
    maxTroops: 5000,
    morale: 85,
    position: { q: 3, r: 3 },
    mp: 3,
    maxMp: 5,
    hasActed: false,
    isDestroyed: false,
    formation: FormationType.SQUARE,
  };

  const mockBattle: any = {
    id: 'test-battle-melee',
    turn: 3,
    weather: Weather.CLEAR,
    isSiege: false,
    tacticalPoints: 5,
    tacticalPointsUsed: 0,
    units: [mockAttackerUnit, mockDefenderUnit],
    hexGrid: {
      width: 6,
      height: 6,
      terrain: Array(6).fill(null).map(() => Array(6).fill('plain')),
    },
    actionHistory: [],
    activeStrategem: 'none',
    log: [],
  };

  it('完整渲染白刃战外壳、顶部军情旗牌卡与底部战略指令栏', () => {
    const html = renderToStaticMarkup(
      <MeleeStage battle={mockBattle} containerWidth={960} containerHeight={600} />,
    );

    expect(html).toContain('data-testid="melee-stage-container"');
    expect(html).toContain('data-testid="melee-top-header"');
    expect(html).toContain('data-testid="melee-command-bar"');
    expect(html).toContain('data-testid="melee-transition-overlay"');
  });

  it('攻守双方主将印信、兵种徽标、兵力与阵型准确呈现', () => {
    const html = renderToStaticMarkup(
      <MeleeStage battle={mockBattle} containerWidth={960} containerHeight={600} />,
    );

    // 攻方主将关羽、长枪兵、锋矢阵
    expect(html).toContain('data-testid="attacker-commander-seal"');
    expect(html).toContain('关羽');
    expect(html).toContain('枪 · 长枪兵');
    expect(html).toContain('4,200');

    // 守方主将曹仁、重骑兵、方阵
    expect(html).toContain('data-testid="defender-commander-seal"');
    expect(html).toContain('曹仁');
    expect(html).toContain('重 · 重骑兵');
    expect(html).toContain('3,800');
  });

  it('兵种相克徽标正确反映攻方枪兵克制守方骑兵 (×1.3)', () => {
    const html = renderToStaticMarkup(
      <MeleeStage battle={mockBattle} containerWidth={960} containerHeight={600} />,
    );

    expect(html).toContain('data-testid="melee-matchup-badge"');
    expect(html).toContain('兵种相克：克制 (×1.3)');
  });

  it('底部纯战略指令按钮齐全 (全军突击 / 鸣金收兵 / 发起单挑 / 施放武将计)', () => {
    const html = renderToStaticMarkup(
      <MeleeStage battle={mockBattle} containerWidth={960} containerHeight={600} />,
    );

    expect(html).toContain('data-testid="btn-melee-assault"');
    expect(html).toContain('全军突击');

    expect(html).toContain('data-testid="btn-melee-retreat"');
    expect(html).toContain('鸣金收兵');

    expect(html).toContain('data-testid="btn-melee-duel"');
    expect(html).toContain('发起单挑');

    expect(html).toContain('data-testid="btn-melee-skill"');
    expect(html).toContain('施放武将计');
  });

  it('当 activeStrategem 为火计/暴雨/伏兵时正确展示计谋标牌', () => {
    const strategemBattle = { ...mockBattle, activeStrategem: 'fire' as const };
    const html = renderToStaticMarkup(
      <MeleeStage battle={strategemBattle} containerWidth={960} containerHeight={600} />,
    );

    expect(html).toContain('计谋：fire');
  });

  it('在无 battle 注入时优雅降级并展示默认主帅旗牌', () => {
    const html = renderToStaticMarkup(
      <MeleeStage battle={null} melee={null} containerWidth={800} containerHeight={500} />,
    );

    expect(html).toContain('data-testid="melee-stage-container"');
    expect(html).toContain('关羽');
    expect(html).toContain('曹仁');
  });
});
