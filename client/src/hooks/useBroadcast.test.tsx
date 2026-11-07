// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '../stores/gameStore';
import { useBroadcast } from './useBroadcast';

function BroadcastTestComponent() {
  const broadcast = useBroadcast();
  return (
    <div data-testid="broadcast-state">
      <span data-testid="active">{String(broadcast.active)}</span>
      <span data-testid="connected">{String(broadcast.connected)}</span>
      <span data-testid="phase">{broadcast.phase}</span>
      <span data-testid="progress">{broadcast.progress}</span>
    </div>
  );
}

describe('useBroadcast WebSocket 广播订阅 Hook (S20-W1)', () => {
  beforeEach(() => {
    useGameStore.setState({ monthSettling: false });
  });

  it('初始状态下处于未激活待命态', () => {
    const html = renderToStaticMarkup(<BroadcastTestComponent />);
    expect(html).toContain('data-testid="broadcast-state"');
    expect(html).toContain('false'); // active: false
    expect(html).toContain('乾坤推演');
    expect(html).toContain('0'); // progress: 0
  });
});
