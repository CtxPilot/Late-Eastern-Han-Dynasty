// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import type { GameState } from '@leh/shared';
import { selectCivilCities, validateBeautySeek, validateCivilOrder } from './CivilOverviewDrawer';

const cityBase = {
  adminName: '河南尹',
  province: '司隶',
  gold: 700,
  food: 6000,
  population: 1000,
  stats: { farm: 40, commerce: 35, wall: 30, morale: 70 },
  demographics: { adultMale: 300, adultFemale: 300, child: 250, elder: 150 },
};

describe('civil read-only overview model', () => {
  it('selects only player cities and derives the four-facet facts', () => {
    const game = {
      playerFactionId: 1,
      cities: {
        2: { ...cityBase, id: 2, name: '陈留', province: '兖州', ruler: 1 },
        1: { ...cityBase, id: 1, name: '洛阳', ruler: 1 },
        3: { ...cityBase, id: 3, name: '宛城', ruler: 2 },
      },
    } as unknown as GameState;

    expect(selectCivilCities(game)).toEqual([
      expect.objectContaining({
        cityId: 1,
        name: '洛阳',
        administration: '河南尹',
        farm: 40,
        commerce: 35,
        wall: 30,
        morale: 70,
        adultMale: 300,
      }),
      expect.objectContaining({ cityId: 2, name: '陈留', province: '兖州' }),
    ]);
  });

  it('revalidates ownership and the latest gold or food before confirmation', () => {
    const game = {
      playerFactionId: 1,
      cities: {
        1: { ...cityBase, id: 1, name: '洛阳', ruler: 1 },
        2: { ...cityBase, id: 2, name: '宛城', ruler: 2 },
      },
    } as unknown as GameState;

    expect(validateCivilOrder(game, 1, 'farm')).toBeNull();
    expect(validateCivilOrder(game, 1, 'commerce')).toBeNull();
    expect(validateCivilOrder(game, 1, 'wall')).toBeNull();
    expect(validateCivilOrder(game, 1, 'relief')).toBeNull();
    expect(validateCivilOrder({
      ...game,
      cities: { ...game.cities, 1: { ...game.cities[1], gold: 119 } },
    }, 1, 'wall')).toContain('需120');
    expect(validateCivilOrder({
      ...game,
      cities: { ...game.cities, 1: { ...game.cities[1], food: 149 } },
    }, 1, 'relief')).toContain('需150');
    expect(validateCivilOrder(game, 2, 'farm')).toContain('归属');
  });

  it('revalidates the S09 cross-system seek allowance and gold', () => {
    const game = {
      playerFactionId: 1,
      cities: {
        1: { ...cityBase, id: 1, name: '洛阳', ruler: 1, beautySeekLeft: 2 },
        2: { ...cityBase, id: 2, name: '宛城', ruler: 2, beautySeekLeft: 2 },
      },
    } as unknown as GameState;

    expect(validateBeautySeek(game, 1)).toBeNull();
    expect(validateBeautySeek(game, 2)).toContain('归属');
    expect(validateBeautySeek({
      ...game,
      cities: { ...game.cities, 1: { ...game.cities[1], beautySeekLeft: 0 } },
    }, 1)).toContain('已尽');
    expect(validateBeautySeek({
      ...game,
      cities: { ...game.cities, 1: { ...game.cities[1], gold: 59 } },
    }, 1)).toContain('需60');
  });
});
