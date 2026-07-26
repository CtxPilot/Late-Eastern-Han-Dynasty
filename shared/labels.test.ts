// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { FormationType } from './enums/index.js';
import { FORMATION_LABEL } from './labels.js';

describe('formation labels', () => {
  it('keeps arrowhead id 6 distinct from charge id 16', () => {
    expect(FORMATION_LABEL[FormationType.ARROWHEAD]).toBe('锋矢阵');
    expect(FORMATION_LABEL[FormationType.CHARGE]).toBe('冲阵');
  });
});
