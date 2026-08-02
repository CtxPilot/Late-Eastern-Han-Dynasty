// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { MARRIAGE_ADULT_AGE, ageAtYear, isAdultForMarriage } from './family-policy.js';

describe('family safeguarding policy', () => {
  it('uses an explicit 18-year player-action threshold', () => {
    expect(MARRIAGE_ADULT_AGE).toBe(18);
    expect(isAdultForMarriage(172, 190)).toBe(true);
    expect(isAdultForMarriage(173, 190)).toBe(false);
  });

  it('rejects Sun Shangxiang as a marriage candidate in scenario year 190', () => {
    expect(ageAtYear(189, 190)).toBe(1);
    expect(isAdultForMarriage(189, 190)).toBe(false);
  });

  it('rejects unknown or future birth years', () => {
    expect(isAdultForMarriage(0, 190)).toBe(false);
    expect(isAdultForMarriage(200, 190)).toBe(false);
  });
});
