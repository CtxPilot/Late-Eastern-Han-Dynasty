// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  CEILING_HOLDERS,
  SECOND_TIER_FLOOR,
  BARE_STAT_CAP,
  EFFECTIVE_STAT_HARD_CAP,
  getCeilingHiddenBonus,
  panelStatDisplay,
  panelStatsDisplay,
} from './ceiling';
import { CeilingAttribute } from './enums/index';

describe('CEILING_HOLDERS', () => {
  it('has all five attributes', () => {
    expect(Object.keys(CEILING_HOLDERS)).toHaveLength(5);
    expect(CEILING_HOLDERS[CeilingAttribute.WAR]).toBeDefined();
    expect(CEILING_HOLDERS[CeilingAttribute.INTELLIGENCE]).toBeDefined();
    expect(CEILING_HOLDERS[CeilingAttribute.LEADERSHIP]).toBeDefined();
    expect(CEILING_HOLDERS[CeilingAttribute.POLITICS]).toBeDefined();
    expect(CEILING_HOLDERS[CeilingAttribute.CHARISMA]).toBeDefined();
  });

  it('吕布 has the highest hidden bonus', () => {
    const bonuses = Object.values(CEILING_HOLDERS).map((h) => h.hiddenBonus);
    const max = Math.max(...bonuses);
    expect(CEILING_HOLDERS[CeilingAttribute.WAR].hiddenBonus).toBe(max);
  });

  it('刘备 has the lowest hidden bonus', () => {
    const bonuses = Object.values(CEILING_HOLDERS).map((h) => h.hiddenBonus);
    const min = Math.min(...bonuses);
    expect(CEILING_HOLDERS[CeilingAttribute.CHARISMA].hiddenBonus).toBe(min);
  });

  it('all hidden bonuses are positive', () => {
    for (const holder of Object.values(CEILING_HOLDERS)) {
      expect(holder.hiddenBonus).toBeGreaterThan(0);
    }
  });
});

describe('SECOND_TIER_FLOOR', () => {
  it('武力 second tier starts at 97', () => {
    expect(SECOND_TIER_FLOOR[CeilingAttribute.WAR]).toBe(97);
  });

  it('统智政魅 second tier starts at 99', () => {
    expect(SECOND_TIER_FLOOR[CeilingAttribute.LEADERSHIP]).toBe(99);
    expect(SECOND_TIER_FLOOR[CeilingAttribute.INTELLIGENCE]).toBe(99);
    expect(SECOND_TIER_FLOOR[CeilingAttribute.POLITICS]).toBe(99);
    expect(SECOND_TIER_FLOOR[CeilingAttribute.CHARISMA]).toBe(99);
  });

  it('all floors are below BARE_STAT_CAP', () => {
    for (const floor of Object.values(SECOND_TIER_FLOOR)) {
      expect(floor).toBeLessThanOrEqual(BARE_STAT_CAP);
    }
  });
});

describe('BARE_STAT_CAP / EFFECTIVE_STAT_HARD_CAP', () => {
  it('BARE_STAT_CAP is 100', () => {
    expect(BARE_STAT_CAP).toBe(100);
  });

  it('EFFECTIVE_STAT_HARD_CAP is 255', () => {
    expect(EFFECTIVE_STAT_HARD_CAP).toBe(255);
  });

  it('吕布 effective can reach 150 without overflow', () => {
    const lvbuEffective = BARE_STAT_CAP + CEILING_HOLDERS[CeilingAttribute.WAR].hiddenBonus;
    expect(lvbuEffective).toBe(150);
    expect(lvbuEffective).toBeLessThan(EFFECTIVE_STAT_HARD_CAP);
  });
});

describe('getCeilingHiddenBonus', () => {
  it('returns correct bonus for each attribute', () => {
    expect(getCeilingHiddenBonus(CeilingAttribute.WAR)).toBe(50);
    expect(getCeilingHiddenBonus(CeilingAttribute.INTELLIGENCE)).toBe(20);
    expect(getCeilingHiddenBonus(CeilingAttribute.LEADERSHIP)).toBe(15);
    expect(getCeilingHiddenBonus(CeilingAttribute.POLITICS)).toBe(10);
    expect(getCeilingHiddenBonus(CeilingAttribute.CHARISMA)).toBe(5);
  });
});

describe('panelStatDisplay', () => {
  it('caps at 100', () => {
    expect(panelStatDisplay(150)).toBe(100);
    expect(panelStatDisplay(100)).toBe(100);
  });

  it('floors to 0', () => {
    expect(panelStatDisplay(-5)).toBe(0);
  });

  it('passes through normal values', () => {
    expect(panelStatDisplay(75)).toBe(75);
    expect(panelStatDisplay(0)).toBe(0);
  });

  it('floors decimals', () => {
    expect(panelStatDisplay(75.9)).toBe(75);
  });
});

describe('panelStatsDisplay', () => {
  it('caps all five stats', () => {
    const result = panelStatsDisplay({
      leadership: 120,
      war: 150,
      intelligence: 100,
      politics: 95,
      charisma: -10,
    });
    expect(result.leadership).toBe(100);
    expect(result.war).toBe(100);
    expect(result.intelligence).toBe(100);
    expect(result.politics).toBe(95);
    expect(result.charisma).toBe(0);
  });
});
