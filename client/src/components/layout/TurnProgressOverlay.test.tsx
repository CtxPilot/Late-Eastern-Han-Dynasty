// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../../stores/gameStore';
import { TurnProgressOverlay } from './TurnProgressOverlay';
import type { GameState } from '@leh/shared';

describe('TurnProgressOverlay 推演全屏进度遮罩 (S20-W1)', () => {
  const fakeGame = {
    currentYear: 191,
    currentMonth: 3,
    playerFactionId: 1,
  } as unknown as GameState;

  beforeEach(() => {
    useGameStore.setState({
      monthSettling: false,
      game: null,
    });
  });

  it('未在月结推演状态时不渲染遮罩', () => {
    const html = renderToStaticMarkup(<TurnProgressOverlay monthSettling={false} game={fakeGame} />);
    expect(html).toBe('');
  });

  it('月结推演触发时正确呈现年份月份、推演题签与进度条', () => {
    const html = renderToStaticMarkup(
      <TurnProgressOverlay
        monthSettling={true}
        game={fakeGame}
        broadcast={{
          phase: '内政整备',
          progress: 60,
          message: '正在清点府库金粟与军械粮草…',
        }}
      />,
    );

    expect(html).toContain('data-testid="turn-progress-overlay"');
    expect(html).toContain('天道流转 · 乾坤推演');
    expect(html).toContain('191年3月');
    expect(html).toContain('内政整备');
    expect(html).toContain('正在清点府库金粟与军械粮草…');
    expect(html).toContain('60%');
    expect(html).toContain('离线推演');
  });

  it('WebSocket 实时信道连接时展现连接指示徽标', () => {
    const html = renderToStaticMarkup(
      <TurnProgressOverlay
        monthSettling={true}
        game={fakeGame}
        broadcast={{
          connected: true,
          phase: '军令调度',
          progress: 85,
        }}
      />,
    );

    expect(html).toContain('实时信道');
    expect(html).toContain('85%');
  });
});
