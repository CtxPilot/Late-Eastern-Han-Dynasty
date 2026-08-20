// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { afterEach, describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { FamilyTreatmentDialog, FamilyTreatmentDialogView } from './FamilyTreatmentDialog';
import { useGameStore } from '../../stores/gameStore';
import type { GameState } from '@leh/shared';

const fakeGame = {
  cities: {
    1: { id: 1, name: '洛阳' },
    2: { id: 2, name: '陈留' },
  },
  factions: {
    2: { id: 2, name: '旧主军' },
  },
  pendingFamilyTreatment: {
    cityId: 1,
    previousFactionId: 2,
    familyCount: 18,
    affectedCityIds: [2],
  },
} as unknown as GameState;

describe('FamilyTreatmentDialog', () => {
  afterEach(() => {
    useGameStore.setState({ game: null, loading: false, error: null });
  });

  it('renders the three treatment choices for a pending capture', () => {
    const html = renderToStaticMarkup(
      <FamilyTreatmentDialogView
        game={fakeGame}
        pending={fakeGame.pendingFamilyTreatment!}
        loading={false}
        onChoose={() => undefined}
      />,
    );
    expect(html).toContain('data-testid="family-treatment-dialog"');
    expect(html).toContain('data-testid="family-treatment-kindness"');
    expect(html).toContain('data-testid="family-treatment-neutral"');
    expect(html).toContain('data-testid="family-treatment-repression"');
    expect(html).toContain('家属共 18 口');
    expect(html).toContain('受牵连城：陈留');
  });

  it('renders nothing without a pending treatment', () => {
    useGameStore.setState({ game: { ...fakeGame, pendingFamilyTreatment: null } });
    expect(renderToStaticMarkup(<FamilyTreatmentDialog />)).toBe('');
  });
});
