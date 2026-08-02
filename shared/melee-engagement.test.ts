// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { checkMeleeTarget, directionTo, facingDelta } from './melee-engagement.js';

describe('melee-engagement', () => {
  it('剑斧只打一格、矛可打一至两格', () => {
    expect(checkMeleeTarget({ q: 0, r: 0 }, 0, { q: 2, r: 0 }, 'sword').inRange).toBe(false);
    expect(checkMeleeTarget({ q: 0, r: 0 }, 0, { q: 2, r: 0 }, 'spear').inRange).toBe(true);
    expect(checkMeleeTarget({ q: 0, r: 0 }, 0, { q: 1, r: 0 }, 'axe').inRange).toBe(true);
  });
  it('六方向环形差值跨0/5边界', () => { expect(facingDelta(0, 5)).toBe(1); expect(directionTo({ q: 0, r: 0 }, { q: -2, r: 0 })).toBe(3); });
  it('背后目标不可直接攻击、侧击带武器修正', () => {
    expect(checkMeleeTarget({ q: 0, r: 0 }, 0, { q: -1, r: 0 }, 'spear')).toMatchObject({ inRange: false, arc: 'rear' });
    expect(checkMeleeTarget({ q: 0, r: 0 }, 0, { q: -1, r: 1 }, 'sword')).toMatchObject({ arc: 'flank', attackModifier: 0.12 });
  });
});
