// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { City, Faction } from '@leh/shared';

const { createKonvaMock } = vi.hoisted(() => {
  const createKonvaMock = (tag: string) => {
    const MockComponent = ({
      children,
      name,
      points,
      fill,
      opacity,
      stroke,
      radius,
      globalCompositeOperation,
    }: {
      children?: React.ReactNode;
      name?: string;
      points?: number[];
      fill?: string;
      opacity?: number;
      stroke?: string;
      radius?: number;
      globalCompositeOperation?: string;
    }) =>
      React.createElement(
        'div',
        {
          'data-konva-tag': tag,
          'data-name': name,
          'data-points': Array.isArray(points) ? points.join(',') : points,
          'data-fill': fill,
          'data-opacity': opacity,
          'data-stroke': stroke,
          'data-radius': radius,
          'data-gco': globalCompositeOperation,
        },
        children,
      );
    MockComponent.displayName = `KonvaMock_${tag}`;
    return MockComponent;
  };
  return { createKonvaMock };
});

vi.mock('react-konva', () => ({
  Group: createKonvaMock('Group'),
  Rect: createKonvaMock('Rect'),
  Circle: createKonvaMock('Circle'),
  Line: createKonvaMock('Line'),
  Stage: createKonvaMock('Stage'),
  Layer: createKonvaMock('Layer'),
}));

import { TerritoryLayer } from './TerritoryLayer';
import { FogLayer, calculateFogHoles } from './FogLayer';

describe('TerritoryLayer & FogLayer - S20-W3 Visual Layers', () => {
  const mockFactions: Record<number, Faction> = {
    1: { id: 1, name: '曹操', color: '#3b82f6' } as unknown as Faction,
    2: { id: 2, name: '刘备', color: '#10b981' } as unknown as Faction,
  };

  const mockCities: Record<number, City> = {
    1: { id: 1, name: '许昌', x: 200, y: 200, ruler: 1 } as City,
    2: { id: 2, name: '陈留', x: 260, y: 190, ruler: 1 } as City,
    3: { id: 3, name: '洛阳', x: 150, y: 180, ruler: 1 } as City,
    4: { id: 4, name: '新野', x: 180, y: 320, ruler: 2 } as City,
  };

  describe('TerritoryLayer', () => {
    it('renders closed Konva lines for factions with opacity 0.18', () => {
      const html = renderToStaticMarkup(
        <TerritoryLayer
          cities={mockCities}
          factions={mockFactions}
          opacity={0.18}
        />,
      );

      expect(html).toContain('territory-layer');
      expect(html).toContain('territory-faction-1');
      expect(html).toContain('territory-faction-2');
      expect(html).toContain('data-fill="#3b82f6"');
      expect(html).toContain('data-opacity="0.18"');
    });

    it('returns null when visible is false', () => {
      const html = renderToStaticMarkup(
        <TerritoryLayer
          cities={mockCities}
          factions={mockFactions}
          visible={false}
        />,
      );
      expect(html).toBe('');
    });
  });

  describe('FogLayer & calculateFogHoles', () => {
    it('calculates fog holes strictly for visible cities', () => {
      const allHoles = calculateFogHoles(mockCities, undefined, 100, 1.0);
      expect(allHoles.length).toBe(4);
      expect(allHoles[0].radius).toBe(100);

      // 仅展示城池 1 和 4
      const filteredHoles = calculateFogHoles(mockCities, [1, 4], 80, 1.5);
      expect(filteredHoles.length).toBe(2);
      expect(filteredHoles.map((h) => h.id)).toEqual([1, 4]);
      expect(filteredHoles[0].radius).toBe(120); // 80 * 1.5 = 120
    });

    it('renders fog layer with rect and destination-out circles', () => {
      const html = renderToStaticMarkup(
        <FogLayer
          width={1920}
          height={1080}
          cities={mockCities}
          visibleCityIds={[1, 2]}
          baseRadius={100}
        />,
      );
      expect(html).toContain('fog-layer');
      expect(html).toContain('fog-background');
      expect(html).toContain('fog-hole-1');
      expect(html).toContain('fog-hole-2');
      expect(html).toContain('data-gco="destination-out"');
    });

    it('returns null when visible is false', () => {
      const html = renderToStaticMarkup(
        <FogLayer
          width={1920}
          height={1080}
          cities={mockCities}
          visible={false}
        />,
      );
      expect(html).toBe('');
    });
  });
});
