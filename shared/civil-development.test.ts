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
});
