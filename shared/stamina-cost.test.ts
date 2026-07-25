// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import { calcStaminaMax, STAMINA_SCALE_FACTOR } from './stamina.js';
import {
  staminaCost,
  staminaEffectFactor,
  deriveRole,
  isCrossDomain,
  CROSS_DOMAIN_MULTIPLIER,
  type ActionType,
} from './stamina-cost.js';
import type { OfficerStatic } from './types/officer.js';

function mkOfficer(stats: { war: number; leadership: number; intelligence: number; politics: number; charisma: number }, power = 50, ceilingBonus: { attribute: 'war' | 'leadership' | 'intelligence' | 'politics' | 'charisma'; hiddenBonus: number } | null = null): OfficerStatic {
  return {
    id: 1, name: 'test', birthYear: 160, deathYear: 220, stats,
    hidden: { compatibility: 50, righteousness: 5, ambition: 5, valor: 3, composure: 3, lifespan: 60, growth: 'B', personality: 'brave', ideal: 'power', bloodline: [], ceilingBonus, power, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 50, tactics: 50 },
    unitProficiency: {}, formationMastery: [], skills: [], tags: [],
  } as OfficerStatic;
}

describe('stamina scaling (Session 186)', () => {
  it('STAMINA_SCALE_FACTOR = 100/168', () => {
    expect(STAMINA_SCALE_FACTOR).toBeCloseTo(100 / 168, 5);
  });

  it('吕布封顶 100（war100+ceiling50, lead97, age40, merit0）', () => {
    const lvbu = mkOfficer({ leadership: 97, war: 100, intelligence: 70, politics: 65, charisma: 60 }, 100, { attribute: 'war', hiddenBonus: 50 });
    expect(calcStaminaMax(lvbu, 0, 40)).toBe(100);
  });

  it('武将基础值 ≤ 100（无 merit）', () => {
    const guan = mkOfficer({ leadership: 95, war: 97, intelligence: 75, politics: 63, charisma: 94 }, 95, { attribute: 'war', hiddenBonus: 45 });
    const v = calcStaminaMax(guan, 0, 35);
    expect(v).toBeLessThanOrEqual(100);
    expect(v).toBeGreaterThan(60);
  });

  it('meritLevel 加成可突破 100（双轨制基础值+加成）', () => {
    const lvbu = mkOfficer({ leadership: 97, war: 100, intelligence: 70, politics: 65, charisma: 60 }, 100, { attribute: 'war', hiddenBonus: 50 });
    const withMerit = calcStaminaMax(lvbu, 12, 40);
    expect(withMerit).toBeGreaterThan(100);
  });

  it('相对大小关系保持：吕布 > 张飞 > 诸葛亮 > 荀彧', () => {
    const lvbu = mkOfficer({ leadership: 97, war: 100, intelligence: 70, politics: 65, charisma: 60 }, 100, { attribute: 'war', hiddenBonus: 50 });
    const zhangfei = mkOfficer({ leadership: 85, war: 97, intelligence: 65, politics: 50, charisma: 70 }, 95, { attribute: 'war', hiddenBonus: 40 });
    const kongming = mkOfficer({ leadership: 80, war: 70, intelligence: 100, politics: 90, charisma: 95 }, 20, { attribute: 'intelligence', hiddenBonus: 20 });
    const xunyu = mkOfficer({ leadership: 60, war: 50, intelligence: 95, politics: 98, charisma: 90 }, 15, { attribute: 'politics', hiddenBonus: 10 });
    const vL = calcStaminaMax(lvbu, 0, 40);
    const vZ = calcStaminaMax(zhangfei, 0, 35);
    const vK = calcStaminaMax(kongming, 0, 35);
    const vX = calcStaminaMax(xunyu, 0, 30);
    expect(vL).toBeGreaterThan(vZ);
    expect(vZ).toBeGreaterThan(vK);
    expect(vK).toBeGreaterThan(vX);
  });
});

describe('stamina cost asymmetry (Session 186)', () => {
  const warrior = mkOfficer({ leadership: 90, war: 95, intelligence: 50, politics: 40, charisma: 60 });
  const strategist = mkOfficer({ leadership: 50, war: 40, intelligence: 95, politics: 80, charisma: 70 });

  it('deriveRole: 武将 war>=int → military', () => {
    expect(deriveRole(warrior)).toBe('military');
  });
  it('deriveRole: 谋臣 war<int → strategist', () => {
    expect(deriveRole(strategist)).toBe('strategist');
  });
  it('isCrossDomain: 武将做谋略 = 跨界', () => {
    expect(isCrossDomain('military', 'stratagem')).toBe(true);
  });
  it('isCrossDomain: 武将做战场 = 本行', () => {
    expect(isCrossDomain('military', 'battlefield')).toBe(false);
  });
  it('isCrossDomain: 谋臣做战场 = 跨界', () => {
    expect(isCrossDomain('strategist', 'battlefield')).toBe(true);
  });
  it('staminaCost: 武将本行 battlefield ×1.0', () => {
    const cost = staminaCost(15, warrior, 'battlefield');
    expect(cost).toBe(15);
  });
  it('staminaCost: 武将跨界 stratagem ×1.5', () => {
    const cost = staminaCost(15, warrior, 'stratagem' as ActionType);
    expect(cost).toBe(22);
  });
  it('staminaCost: 谋臣跨界 battlefield ×1.5', () => {
    const cost = staminaCost(15, strategist, 'battlefield');
    expect(cost).toBe(22);
  });
  it('CROSS_DOMAIN_MULTIPLIER = 1.5', () => {
    expect(CROSS_DOMAIN_MULTIPLIER).toBe(1.5);
  });
});

describe('stamina effect factor (low stamina penalty)', () => {
  it('stamina >= 30 → 1.0 全效', () => {
    expect(staminaEffectFactor(100)).toBe(1.0);
    expect(staminaEffectFactor(30)).toBe(1.0);
  });
  it('stamina 10~30 → 0.8 八折', () => {
    expect(staminaEffectFactor(29)).toBe(0.8);
    expect(staminaEffectFactor(10)).toBe(0.8);
  });
  it('stamina < 10 → 0.6 六折', () => {
    expect(staminaEffectFactor(9)).toBe(0.6);
    expect(staminaEffectFactor(0)).toBe(0.6);
  });
});