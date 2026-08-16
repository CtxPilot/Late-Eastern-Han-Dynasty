// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest';
import { Personality } from './enums/index.js';
import {
  applyRelationEvent,
  applyRelationEventAmong,
  evolveAffinity,
  pairAffinity,
  personalityAffinityModifier,
  relationPairKey,
  relationState,
  resolveAffinity,
  type Officer,
} from './index.js';

function stubOfficer(id: number, name: string, personality: Personality = Personality.CALM): Officer {
  return {
    id,
    name,
    birthYear: 150,
    deathYear: 220,
    stats: { leadership: 70, war: 70, intelligence: 70, politics: 70, charisma: 70 },
    hidden: {
      compatibility: 50,
      righteousness: 5,
      ambition: 5,
      valor: 5,
      composure: 5,
      lifespan: 220,
      growth: 'mid',
      personality,
      ideal: 'hegemony',
      bloodline: [],
      ceilingBonus: null,
      power: 50,
      burst: 50,
      agility: 50,
      luck: 50,
      intuition: 50,
    },
    personality,
    ideal: 'hegemony',
    tags: ['士族', '豫州', '匡扶汉室'],
    skills: [],
    formations: [],
    unitAptitudes: {},
    faction: 1,
    location: 1,
    loyalty: 80,
    experience: 0,
    status: 'active',
    civilPosition: 'none',
    localPosition: 'none',
    militaryPosition: 'none',
    nobilityRank: 'none',
    merit: 0,
    stamina: 100,
    actionsPerMonth: 1,
    wifeId: null,
    beauties: [],
  } as unknown as Officer;
}

describe('S24 relation runtime', () => {
  it('pair key is order-invariant', () => {
    expect(relationPairKey(3, 1)).toBe('1:3');
    expect(relationPairKey(1, 3)).toBe('1:3');
  });

  it('resolveAffinity prefers runtime over baseline', () => {
    const a = stubOfficer(1, '甲');
    const b = stubOfficer(2, '乙');
    const baseline = pairAffinity(a, b);
    const runtime = { [relationPairKey(1, 2)]: 77 };
    expect(resolveAffinity(a, b, undefined)).toBeCloseTo(baseline, 5);
    expect(resolveAffinity(a, b, runtime)).toBe(77);
  });

  it('same_city evolves and may narrate state change', () => {
    const a = stubOfficer(1, '刘备');
    const b = stubOfficer(6, '关羽');
    // 强制从刚过 neutral 上沿开始，便于跨过 friendly
    const start = { [relationPairKey(1, 6)]: 39 };
    const once = applyRelationEvent(start, a, b, 'same_city');
    expect(once.changed).toBe(true);
    expect(once.affinities[relationPairKey(1, 6)]).toBe(40);
    expect(relationState(40)).toBe('friendly');
    expect(once.narratives.some((n) => n.includes('友好'))).toBe(true);
  });

  it('gentle personality amplifies positive events', () => {
    const a = stubOfficer(1, '甲', Personality.GENTLE);
    const b = stubOfficer(2, '乙', Personality.GENTLE);
    const mod = personalityAffinityModifier(a, b, true);
    expect(mod).toBeCloseTo(1.3, 5);
    expect(evolveAffinity(0, 'joint_expedition', mod)).toBeCloseTo(3.9, 5);
  });

  it('joint expedition among three officers writes three pairs', () => {
    const officers = [stubOfficer(1, 'A'), stubOfficer(2, 'B'), stubOfficer(3, 'C')];
    const result = applyRelationEventAmong({}, officers, 'joint_expedition');
    expect(result.changed).toBe(true);
    expect(Object.keys(result.affinities).sort()).toEqual(['1:2', '1:3', '2:3']);
  });

  it('captured applies large negative delta', () => {
    const captive = stubOfficer(5, '吕布');
    const captor = stubOfficer(1, '曹操');
    const result = applyRelationEvent({}, captive, captor, 'captured');
    expect(result.affinities[relationPairKey(1, 5)]).toBeLessThan(
      pairAffinity(captive, captor),
    );
    expect(result.affinities[relationPairKey(1, 5)]).toBe(
      evolveAffinity(pairAffinity(captive, captor), 'captured', 1),
    );
  });
});
