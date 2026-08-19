// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { PolicyType } from './enums/index.js';
import {
  POLICY_COOLDOWN_MONTHS,
  POLICY_LABELS,
  factionHasActivePolicy,
  getActivePolicyType,
  monthStamp,
  playFoolTroopMul,
  policySwitchCooldown,
} from './national-policy.js';
import type { GameState } from './types/game.js';
import type { NationalPolicy } from './types/policy.js';

function stateWithPolicy(policy: NationalPolicy): GameState {
  return {
    currentYear: 190,
    currentMonth: 2,
    nationalPolicies: [policy],
    cities: {
      1: { id: 1, ruler: 1, troops: 4000 },
    },
    factions: { 1: { id: 1 } },
  } as unknown as GameState;
}

describe('national policy helpers', () => {
  it('labels cover all eight policies', () => {
    expect(Object.keys(POLICY_LABELS)).toHaveLength(8);
    expect(POLICY_LABELS[PolicyType.PREPARE_DEFENSE]).toBe('以逸待劳');
    expect(POLICY_COOLDOWN_MONTHS).toBe(6);
  });

  it('reads active policy and cooldown', () => {
    const pending = stateWithPolicy({
      id: 'p1',
      type: PolicyType.PLAY_FOOL,
      factionId: 1,
      active: false,
      sinceYear: 190,
      sinceMonth: 1,
      cooldown: 6,
    });
    expect(getActivePolicyType(pending, 1)).toBeNull();
    expect(policySwitchCooldown(pending, 1)).toBe(6);

    const live = stateWithPolicy({
      id: 'p1',
      type: PolicyType.PLAY_FOOL,
      factionId: 1,
      active: true,
      sinceYear: 190,
      sinceMonth: 2,
      cooldown: 5,
    });
    expect(factionHasActivePolicy(live, 1, PolicyType.PLAY_FOOL)).toBe(true);
    expect(playFoolTroopMul(live, 1)).toBe(0.5);
    expect(playFoolTroopMul(live, 99)).toBe(1);
  });

  it('monthStamp is year*12+month', () => {
    expect(monthStamp(190, 1)).toBe(2281);
    expect(monthStamp(190, 12)).toBe(2292);
  });
});
