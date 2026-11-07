// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  type DuelState,
  DuelCommand,
} from '@leh/shared';
import { DuelStage } from './DuelStage';
import { DuelPanel } from './DuelPanel';

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
  playClash: vi.fn(),
  playCritImpact: vi.fn(),
  playFinisherCharge: vi.fn(),
  playHorseGallop: vi.fn(),
  playDrum: vi.fn(),
  playChime: vi.fn(),
  playHorn: vi.fn(),
}));

describe('DuelStage & DuelPanel — 四级单挑混合范式演出层', () => {
  const mockDuelState: DuelState = {
    battleId: 'b-1',
    phase: 'dueling',
    challengerId: 1,
    defenderId: 2,
    round: 2,
    combatants: {
      1: {
        officerId: 1,
        hp: 100,
        maxHp: 100,
        energy: 40,
        maxEnergy: 50,
        injury: null,
        sneakUsed: false,
        consecutiveBlocks: 0,
        lastCommand: null,
      },
      2: {
        officerId: 2,
        hp: 85,
        maxHp: 100,
        energy: 35,
        maxEnergy: 50,
        injury: null,
        sneakUsed: false,
        consecutiveBlocks: 0,
        lastCommand: null,
      },
    },
    turnOrder: [1, 2],
    preDuelDone: true,
    dialogueLog: [
      { speakerId: 1, text: '吾乃关云长是也，来将通名！', moraleEffect: 5 },
      { speakerId: 2, text: '关羽小儿，看枪！', moraleEffect: -5 },
    ],
    roundHistory: [
      {
        round: 1,
        commands: [DuelCommand.FIERCE_ATTACK, DuelCommand.RESTRAIN],
        hits: { 1: true, 2: false },
        damages: { 1: 0, 2: 15 },
        criticals: { 1: true, 2: false },
        counterDamages: { 1: 0, 2: 0 },
        counterCriticals: { 1: false, 2: false },
        chainHits: { 1: [], 2: [] },
        injuryApplied: { 1: null, 2: null },
        hpAfter: { 1: 100, 2: 85 },
        description: '关羽猛攻得手，压制曹仁！',
        detail: '猛攻克制牵制，伤害+30%',
      },
    ],
    stances: { 1: 'assault', 2: 'steady' },
    autoResolve: false,
    speedMode: 'full',
  };

  const resolveOfficerName = (id: number) => (id === 1 ? '关羽' : '曹仁');

  it('DuelStage 渲染中央演出画布与出牌卡牌对撞展示区', () => {
    const html = renderToStaticMarkup(
      <DuelStage
        duel={mockDuelState}
        roundIndex={0}
        speedMode="full"
        resolveName={resolveOfficerName}
      />,
    );

    expect(html).toContain('data-testid="duel-stage-container"');
    expect(html).toContain('data-testid="duel-cards-overlay"');
    expect(html).toContain('data-testid="duel-card-challenger"');
    expect(html).toContain('data-testid="duel-card-defender"');
  });

  it('DuelStage 正确展示卡牌三向克制（猛攻克牵制）与克制高亮', () => {
    const html = renderToStaticMarkup(
      <DuelStage
        duel={mockDuelState}
        roundIndex={0}
        speedMode="full"
        resolveName={resolveOfficerName}
      />,
    );

    expect(html).toContain('猛攻');
    expect(html).toContain('牵制');
    expect(html).toContain('data-testid="duel-matchup-label"');
    expect(html).toContain('克制');
  });

  it('DuelPanel 完整嵌入 DuelStage 演出层并维持 HP 条与控制栏', () => {
    const html = renderToStaticMarkup(
      <DuelPanel
        duel={mockDuelState}
        resolveName={resolveOfficerName}
      />,
    );

    expect(html).toContain('data-testid="duel-panel-modal"');
    expect(html).toContain('data-testid="duel-stage-container"');
    expect(html).toContain('体力 100/100');
    expect(html).toContain('体力 85/100');
    expect(html).toContain('data-testid="btn-duel-step"');
    expect(html).toContain('data-testid="btn-duel-skip"');
  });

  it('单挑结束时展示结局面板与返回战场按钮', () => {
    const resolvedDuel: DuelState = {
      ...mockDuelState,
      phase: 'resolved',
      result: {
        winnerId: 1,
        loserId: 2,
        outcome: 'captured',
        rounds: mockDuelState.roundHistory,
        moraleChange: { winner: 10, loser: -10 },
        audienceMoraleChange: 5,
        meritReward: 100,
        epilogue: '关羽生擒曹仁，全军震动！',
      },
    };

    const html = renderToStaticMarkup(
      <DuelPanel
        duel={resolvedDuel}
        resolveName={resolveOfficerName}
      />,
    );

    expect(html).toContain('已结束');
    expect(html).toContain('俘获！');
    expect(html).toContain('关羽生擒曹仁，全军震动！');
    expect(html).toContain('data-testid="btn-close-battlefield-duel"');
    expect(html).toContain('返回战场');
  });
});
