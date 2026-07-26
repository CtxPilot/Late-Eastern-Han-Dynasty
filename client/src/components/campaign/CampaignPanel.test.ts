// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { DipRelation, type CampaignArmy, type GameState } from '@leh/shared';
import { campaignArmyPhaseLabel, campaignTargetsFromCity } from './CampaignPanel.helpers';

const game = {
  playerFactionId: 1,
  cities: {
    1: { id: 1, name: '洛阳', ruler: 1 },
    7: { id: 7, name: '陈留', ruler: 2 },
    9: { id: 9, name: '下邳', ruler: 2 },
    20: { id: 20, name: '汉中', ruler: 2 },
  },
  campaignNodes: [
    { id: 1, adjacentNodeIds: [7] },
    { id: 7, adjacentNodeIds: [1] },
    { id: 9, adjacentNodeIds: [] },
    { id: 20, adjacentNodeIds: [] },
  ],
  diplomacy: [
    {
      factionA: 1,
      factionB: 2,
      relation: DipRelation.FRIENDLY,
      favorability: 30,
    },
  ],
} as unknown as GameState;

function army(currentNodeId: number): CampaignArmy {
  return {
    id: 'army-1',
    factionId: 1,
    phase: 'garrison',
    currentNodeId,
  } as CampaignArmy;
}

describe('CampaignPanel campaign presentation', () => {
  it('filters target cities by the selected origin instead of every owned frontier', () => {
    expect(campaignTargetsFromCity(game, 1).map((city) => city.name)).toEqual(['陈留']);
    expect(campaignTargetsFromCity(game, 1).some((city) => city.name === '下邳')).toBe(false);
  });

  it('distinguishes own garrison from a temporary stay in a friendly city', () => {
    expect(campaignArmyPhaseLabel(game, army(1))).toBe('驻守（己方城池）');
    expect(campaignArmyPhaseLabel(game, army(20))).toBe('暂驻（友方城池）');
    expect(
      campaignArmyPhaseLabel(
        { ...game, cities: { ...game.cities, 20: { ...game.cities[20], ruler: null } } },
        army(20),
      ),
    ).toBe('暂驻（非己方城池）');
  });
});
