// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  deriveCityFactions,
  regressSatisfaction,
  merchantCommerceMultiplier,
  refugeeConscriptMultiplier,
  aristocracyDefenderMoralePenalty,
  hasUnrestMinorFaction,
  fameJoinBonus,
  fameLabel,
  defenderMilitia,
  armsCombatMultiplier,
  pickFactionEvent,
  canSelfRecruit,
  canImpeach,
  selfRecruitTroopGain,
  EVENT_HIGH_CHANCE,
  EVENT_LOW_CHANCE,
  CORE_FACTION_KINDS,
  MINOR_FACTION_KINDS,
  PILOT_FACTION_CITY_IDS,
  FACTION_KIND_LABELS,
  SATISFACTION_HIGH,
  SATISFACTION_LOW,
} from './city-factions';
import type { CityFactionEntry } from './city-factions';

describe('deriveCityFactions', () => {
  it('returns empty array for non-pilot cities', () => {
    expect(deriveCityFactions(999)).toEqual([]);
    expect(deriveCityFactions(6)).toEqual([]);
  });

  it('returns all three core factions for pilot cities', () => {
    for (const cityId of PILOT_FACTION_CITY_IDS) {
      const entries = deriveCityFactions(cityId);
      expect(entries.map((entry) => entry.kind)).toContain('aristocracy');
      expect(entries.map((entry) => entry.kind)).toContain('refugees');
      expect(entries.map((entry) => entry.kind)).toContain('merchants');
    }
  });

  it('is deterministic for the same cityId', () => {
    expect(deriveCityFactions(1)).toEqual(deriveCityFactions(1));
    expect(deriveCityFactions(5)).toEqual(deriveCityFactions(5));
  });

  it('keeps satisfaction within the defined ranges', () => {
    for (const cityId of PILOT_FACTION_CITY_IDS) {
      for (const entry of deriveCityFactions(cityId)) {
        expect(entry.satisfaction).toBeGreaterThanOrEqual(0);
        expect(entry.satisfaction).toBeLessThanOrEqual(100);
      }
    }
  });

  it('derives eunuchs within the special low range (15~45)', () => {
    for (const cityId of PILOT_FACTION_CITY_IDS) {
      for (const entry of deriveCityFactions(cityId).filter((e) => e.kind === 'eunuchs')) {
        expect(entry.satisfaction).toBeGreaterThanOrEqual(15);
        expect(entry.satisfaction).toBeLessThanOrEqual(45);
      }
    }
  });

  it('derives militia/clan within the special recruit range (55~75)', () => {
    for (const cityId of PILOT_FACTION_CITY_IDS) {
      for (const entry of deriveCityFactions(cityId).filter(
        (e) => e.kind === 'militia' || e.kind === 'clan',
      )) {
        expect(entry.satisfaction).toBeGreaterThanOrEqual(55);
        expect(entry.satisfaction).toBeLessThanOrEqual(75);
      }
    }
  });

  it('replaces aristocracy name with prestige household at 阳翟', () => {
    const entries = deriveCityFactions(3);
    const aristocracy = entries.find((entry) => entry.kind === 'aristocracy');
    expect(aristocracy?.name).toBe('颍川荀氏·颍川陈氏');
  });

  it('replaces aristocracy name with prestige household at 汝南', () => {
    const entries = deriveCityFactions(4);
    const aristocracy = entries.find((entry) => entry.kind === 'aristocracy');
    expect(aristocracy?.name).toBe('汝南袁氏');
  });

  it('derives at most two unique minor factions', () => {
    for (const cityId of PILOT_FACTION_CITY_IDS) {
      const entries = deriveCityFactions(cityId);
      const minors = entries.filter((entry) => MINOR_FACTION_KINDS.includes(entry.kind));
      expect(minors.length).toBeLessThanOrEqual(2);
      const kinds = minors.map((entry) => entry.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });
});

describe('regressSatisfaction', () => {
  const entry = (satisfaction: number): CityFactionEntry[] => [
    { kind: 'merchants', name: '商贾', satisfaction },
  ];

  it('moves below-target satisfaction up by one', () => {
    expect(regressSatisfaction(entry(40))[0].satisfaction).toBe(41);
  });

  it('moves above-target satisfaction down by one', () => {
    expect(regressSatisfaction(entry(60))[0].satisfaction).toBe(59);
  });

  it('leaves target satisfaction unchanged', () => {
    expect(regressSatisfaction(entry(50))[0].satisfaction).toBe(50);
  });
});

describe('merchantCommerceMultiplier', () => {
  const withMerchants = (satisfaction: number): CityFactionEntry[] => [
    { kind: 'merchants', name: '商贾', satisfaction },
  ];

  it('grants +15% at high satisfaction', () => {
    expect(merchantCommerceMultiplier(withMerchants(SATISFACTION_HIGH))).toBe(0.15);
    expect(merchantCommerceMultiplier(withMerchants(90))).toBe(0.15);
  });

  it('penalizes -15% at low satisfaction', () => {
    expect(merchantCommerceMultiplier(withMerchants(SATISFACTION_LOW - 1))).toBe(-0.15);
  });

  it('returns 0 in the middle band', () => {
    expect(merchantCommerceMultiplier(withMerchants(50))).toBe(0);
  });

  it('returns 0 when merchants faction is absent', () => {
    expect(merchantCommerceMultiplier([])).toBe(0);
  });
});

describe('refugeeConscriptMultiplier', () => {
  const withRefugees = (satisfaction: number): CityFactionEntry[] => [
    { kind: 'refugees', name: '流民', satisfaction },
  ];

  it('grants +20% at high satisfaction', () => {
    expect(refugeeConscriptMultiplier(withRefugees(SATISFACTION_HIGH))).toBe(0.2);
  });

  it('returns 0 below the threshold', () => {
    expect(refugeeConscriptMultiplier(withRefugees(SATISFACTION_HIGH - 1))).toBe(0);
  });

  it('returns 0 when refugees faction is absent', () => {
    expect(refugeeConscriptMultiplier([])).toBe(0);
  });
});

describe('aristocracyDefenderMoralePenalty', () => {
  const withAristocracy = (satisfaction: number): CityFactionEntry[] => [
    { kind: 'aristocracy', name: '世家', satisfaction },
  ];

  it('penalizes -15% when aristocracy satisfaction is low', () => {
    expect(aristocracyDefenderMoralePenalty(withAristocracy(SATISFACTION_LOW - 1))).toBe(0.15);
  });

  it('returns 0 at or above the threshold', () => {
    expect(aristocracyDefenderMoralePenalty(withAristocracy(SATISFACTION_LOW))).toBe(0);
    expect(aristocracyDefenderMoralePenalty(withAristocracy(70))).toBe(0);
  });

  it('returns 0 when aristocracy faction is absent', () => {
    expect(aristocracyDefenderMoralePenalty([])).toBe(0);
  });
});

describe('hasUnrestMinorFaction', () => {
  const entry = (kind: CityFactionEntry['kind'], satisfaction: number): CityFactionEntry[] => [
    { kind, name: FACTION_KIND_LABELS[kind], satisfaction },
  ];

  it('returns true when a minor faction is discontent', () => {
    expect(hasUnrestMinorFaction(entry('cult', SATISFACTION_LOW - 1))).toBe(true);
  });

  it('returns false when minor factions are content', () => {
    expect(hasUnrestMinorFaction(entry('cult', 50))).toBe(false);
  });

  it('ignores discontent core factions', () => {
    expect(hasUnrestMinorFaction(entry('refugees', 10))).toBe(false);
  });
});

describe('fameJoinBonus', () => {
  it('grants +35% at 900+ fame', () => {
    expect(fameJoinBonus(900)).toBe(0.35);
    expect(fameJoinBonus(1000)).toBe(0.35);
  });

  it('grants +20% at 600+ fame', () => {
    expect(fameJoinBonus(600)).toBe(0.2);
    expect(fameJoinBonus(899)).toBe(0.2);
  });

  it('grants +10% at 300+ fame', () => {
    expect(fameJoinBonus(300)).toBe(0.1);
    expect(fameJoinBonus(599)).toBe(0.1);
  });

  it('returns 0 below 300 fame', () => {
    expect(fameJoinBonus(299)).toBe(0);
    expect(fameJoinBonus(0)).toBe(0);
  });
});

describe('fameLabel', () => {
  it('returns 5-tier narrative labels aligned with join thresholds', () => {
    expect(fameLabel(1000)).toBe('威震天下');
    expect(fameLabel(900)).toBe('威震天下');
    expect(fameLabel(899)).toBe('名扬海内');
    expect(fameLabel(600)).toBe('名扬海内');
    expect(fameLabel(599)).toBe('声名鹊起');
    expect(fameLabel(300)).toBe('声名鹊起');
    expect(fameLabel(299)).toBe('崭露头角');
    expect(fameLabel(100)).toBe('崭露头角');
    expect(fameLabel(99)).toBe('名不见经传');
    expect(fameLabel(0)).toBe('名不见经传');
  });
});

describe('defenderMilitia', () => {
  it('returns 0 when morale is below 60', () => {
    expect(defenderMilitia(10000, 59)).toBe(0);
  });

  it('calculates floor(population * 0.02 * morale/100)', () => {
    expect(defenderMilitia(10000, 100)).toBe(200);
    expect(defenderMilitia(12345, 60)).toBe(148);
  });

  it('handles zero population', () => {
    expect(defenderMilitia(0, 80)).toBe(0);
  });
});

describe('armsCombatMultiplier', () => {
  it('returns 0 without arms', () => {
    expect(armsCombatMultiplier(0, 1000)).toBe(0);
  });

  it('grants +5% when fully armed', () => {
    expect(armsCombatMultiplier(10, 1000)).toBe(0.05);
    expect(armsCombatMultiplier(20, 2000)).toBe(0.05);
  });

  it('penalizes -10% when severely under-armed with existing stock', () => {
    expect(armsCombatMultiplier(5, 1000)).toBe(-0.1);
  });

  it('returns 0 in the middle band', () => {
    expect(armsCombatMultiplier(8, 1000)).toBe(0);
  });
});

describe('constants', () => {
  it('FACTION_KIND_LABELS covers every kind', () => {
    const kinds = [...CORE_FACTION_KINDS, ...MINOR_FACTION_KINDS];
    for (const kind of kinds) {
      expect(FACTION_KIND_LABELS[kind]).toBeTruthy();
    }
    expect(Object.keys(FACTION_KIND_LABELS).length).toBe(8);
  });

  it('thresholds are ordered correctly', () => {
    expect(SATISFACTION_LOW).toBeLessThan(SATISFACTION_HIGH);
  });

  it('pilot cities match the 0-A pilot list', () => {
    expect(PILOT_FACTION_CITY_IDS).toEqual([1, 2, 3, 4, 5, 7]);
  });
});

describe('pickFactionEvent', () => {
  const entry = (kind: CityFactionEntry['kind'], satisfaction: number): CityFactionEntry[] => [
    { kind, name: FACTION_KIND_LABELS[kind], satisfaction },
  ];

  it('returns null for empty entries', () => {
    expect(pickFactionEvent([], () => 0)).toBeNull();
  });

  it('fires high-pool event when high roll succeeds (rng 0)', () => {
    const outcome = pickFactionEvent(entry('aristocracy', 80), () => 0);
    expect(outcome?.eventId).toBe('noble_donation');
    expect(outcome?.high).toBe(true);
    expect(outcome?.goldDelta).toBeGreaterThanOrEqual(30);
    expect(outcome?.goldDelta).toBeLessThanOrEqual(60);
  });

  it('fires low-pool event when high roll fails and low roll succeeds', () => {
    const calls: number[] = [];
    const rng = () => {
      calls.push(calls.length);
      return calls.length <= 1 ? 0.5 : 0;
    };
    const outcome = pickFactionEvent(entry('refugees', 10), rng);
    expect(outcome?.eventId).toBe('refugee_flee');
    expect(outcome?.high).toBe(false);
    expect(outcome?.farmDelta).toBeLessThan(0);
  });

  it('returns null when neither pool rolls success', () => {
    expect(pickFactionEvent(entry('merchants', 50), () => 1)).toBeNull();
  });

  it('high-pool event applies to the first satisfying faction in order', () => {
    const entries: CityFactionEntry[] = [
      { kind: 'cult', name: '教团', satisfaction: 80 },
      { kind: 'merchants', name: '商贾', satisfaction: 90 },
    ];
    const outcome = pickFactionEvent(entries, () => 0);
    expect(outcome?.eventId).toBe('cult_blessing');
  });

  it('militia_enlist carries troopsDelta 0 marker', () => {
    const outcome = pickFactionEvent(entry('militia', 80), () => 0);
    expect(outcome?.eventId).toBe('militia_enlist');
    expect(outcome?.troopsDelta).toBe(0);
  });

  it('consumes 1 trigger + 1 value RNG call on a hit', () => {
    let calls = 0;
    const outcome = pickFactionEvent(entry('eunuchs', 80), () => {
      calls += 1;
      return 0;
    });
    expect(outcome?.eventId).toBe('eunuch_recommend');
    expect(calls).toBe(2);
  });

  it('uses configured trigger chances', () => {
    expect(EVENT_HIGH_CHANCE).toBeGreaterThan(EVENT_LOW_CHANCE);
  });
});

describe('canSelfRecruit / selfRecruitTroopGain', () => {
  it('returns true when militia or clan is at the recruit threshold (60)', () => {
    expect(canSelfRecruit([{ kind: 'militia', name: '豪强', satisfaction: 60 }])).toBe(true);
    expect(canSelfRecruit([{ kind: 'clan', name: '宗族', satisfaction: 80 }])).toBe(true);
  });

  it('returns false below the recruit threshold', () => {
    expect(canSelfRecruit([{ kind: 'militia', name: '豪强', satisfaction: 59 }])).toBe(false);
    expect(canSelfRecruit([{ kind: 'merchants', name: '商贾', satisfaction: 90 }])).toBe(false);
    expect(canSelfRecruit([])).toBe(false);
  });

  it('computes troop gain with floor formula and 20 minimum', () => {
    expect(selfRecruitTroopGain(4000)).toBe(20);
    expect(selfRecruitTroopGain(10000)).toBe(50);
    expect(selfRecruitTroopGain(0)).toBe(20);
  });
});

describe('canImpeach', () => {
  it('returns true when eunuchs are discontent', () => {
    expect(canImpeach([{ kind: 'eunuchs', name: '官宦', satisfaction: 20 }])).toBe(true);
  });

  it('returns false when eunuchs are content or absent', () => {
    expect(canImpeach([{ kind: 'eunuchs', name: '官宦', satisfaction: 40 }])).toBe(false);
    expect(canImpeach([{ kind: 'merchants', name: '商贾', satisfaction: 10 }])).toBe(false);
    expect(canImpeach([])).toBe(false);
  });
});
