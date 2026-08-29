// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { DEVELOPMENT_PROJECT_CONFIG, developmentInitialGoldCost } from './civil-development.js';

describe('civil development config', () => {
  it('keeps the 0-A culture project on the shared numeric source', () => {
    expect(DEVELOPMENT_PROJECT_CONFIG.culture).toEqual({
      totalGoldCost: 360,
      label: '文化',
      stat: 'culture',
      totalMonths: 6,
      gain: 60,
    });
    expect(developmentInitialGoldCost('culture')).toBe(120);
  });

  it('keeps the 0-A craft project mirrored to culture costs', () => {
    expect(DEVELOPMENT_PROJECT_CONFIG.craft).toEqual({
      totalGoldCost: 360,
      label: '工艺',
      stat: 'craft',
      totalMonths: 6,
      gain: 60,
    });
    expect(developmentInitialGoldCost('craft')).toBe(120);
  });

  it('keeps the 0-A transport project mirrored to culture costs', () => {
    expect(DEVELOPMENT_PROJECT_CONFIG.transport).toEqual({
      totalGoldCost: 360,
      label: '交通',
      stat: 'transport',
      totalMonths: 6,
      gain: 60,
    });
    expect(developmentInitialGoldCost('transport')).toBe(120);
  });

  it('keeps the 0-A sanitation project mirrored to culture costs', () => {
    expect(DEVELOPMENT_PROJECT_CONFIG.sanitation).toEqual({
      totalGoldCost: 360,
      label: '卫生',
      stat: 'sanitation',
      totalMonths: 6,
      gain: 60,
    });
    expect(developmentInitialGoldCost('sanitation')).toBe(120);
  });
});
