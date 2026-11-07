// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CampaignArmy, City, Faction } from '@leh/shared';
import { MarchAnimationLayer } from './MarchAnimationLayer';

describe('MarchAnimationLayer - S21-W6 Marching Arrows, Flags & Beacon Fire', () => {
  const mockFactions: Record<number, Faction> = {
    1: { id: 1, name: '曹操', color: '#3b82f6' } as unknown as Faction,
    2: { id: 2, name: '孙权', color: '#ef4444' } as unknown as Faction,
  };

  const mockCities: Record<number, City> = {
    1: { id: 1, name: '许昌', x: 100, y: 100 } as City,
    2: { id: 2, name: '宛城', x: 250, y: 180 } as City,
  };

  const mockMarchArmy: CampaignArmy = {
    id: 'army-m-1',
    name: '先锋骑',
    factionId: 1,
    commanderId: 1,
    subCommanderIds: [],
    unitType: 'lightCavalry' as any,
    formation: 0,
    currentNodeId: 1,
    targetNodeId: 2,
    path: [2],
    phase: 'marching',
    troops: 4500,
    maxTroops: 5000,
    food: 2000,
    maxFood: 3000,
    morale: 80,
    organization: 80,
    experience: 300,
    fatigue: 10,
    squads: [],
    structures: [],
  };

  const mockSiegeArmy: CampaignArmy = {
    id: 'army-s-1',
    name: '围城主力',
    factionId: 2,
    commanderId: 2,
    subCommanderIds: [],
    unitType: 'heavyInfantry' as any,
    formation: 6,
    currentNodeId: 2,
    path: [],
    phase: 'sieging',
    troops: 12000,
    maxTroops: 12000,
    food: 4000,
    maxFood: 5000,
    morale: 90,
    organization: 85,
    experience: 900,
    fatigue: 20,
    squads: [],
    structures: [],
  };

  const nodePositions = {
    1: { x: 100, y: 100 },
    2: { x: 250, y: 180 },
  };

  it('renders marching arrows with dashed lines and markers', () => {
    const html = renderToStaticMarkup(
      <svg>
        <MarchAnimationLayer
          armies={[mockMarchArmy]}
          nodePositions={nodePositions}
          cities={mockCities}
          factions={mockFactions}
        />
      </svg>,
    );

    expect(html).toContain('march-animation-layer');
    expect(html).toContain('march-arrow-army-m-1');
    expect(html).toContain('stroke="#3b82f6"');
    expect(html).toContain('marker-end="url(#march-arrow-marker)"');
  });

  it('renders beacon fire on cities under siege', () => {
    const html = renderToStaticMarkup(
      <svg>
        <MarchAnimationLayer
          armies={[mockSiegeArmy]}
          nodePositions={nodePositions}
          cities={mockCities}
          factions={mockFactions}
        />
      </svg>,
    );

    expect(html).toContain('beacon-fire-2');
    expect(html).toContain('烽火');
    expect(html).toContain('stroke="#ef4444"');
  });

  it('renders faction flag with seal character and formatted troop count', () => {
    const html = renderToStaticMarkup(
      <svg>
        <MarchAnimationLayer
          armies={[mockMarchArmy, mockSiegeArmy]}
          nodePositions={nodePositions}
          cities={mockCities}
          factions={mockFactions}
        />
      </svg>,
    );

    expect(html).toContain('marching-flag-army-m-1');
    expect(html).toContain('marching-flag-army-s-1');
    expect(html).toContain('曹'); // 曹操旗帜字
    expect(html).toContain('孙'); // 孙权旗帜字
    expect(html).toContain('4.5千');
    expect(html).toContain('1.2万');
  });

  it('returns null when visible is false or armies list is empty', () => {
    const htmlHidden = renderToStaticMarkup(
      <svg>
        <MarchAnimationLayer
          armies={[mockMarchArmy]}
          nodePositions={nodePositions}
          visible={false}
        />
      </svg>,
    );
    expect(htmlHidden).not.toContain('march-animation-layer');

    const htmlEmpty = renderToStaticMarkup(
      <svg>
        <MarchAnimationLayer
          armies={[]}
          nodePositions={nodePositions}
        />
      </svg>,
    );
    expect(htmlEmpty).not.toContain('march-animation-layer');
  });
});
