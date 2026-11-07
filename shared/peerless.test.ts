// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  PEERLESS_DANCE_SPLASH_PCT,
  PEERLESS_GHOST_DEFENSE_MULTIPLIER,
  PEERLESS_GHOST_LIFESTEAL_PCT,
  PEERLESS_GHOST_TROOP_PCT,
  PEERLESS_INTIMIDATE_COUNTER_PCT,
  PEERLESS_INTIMIDATE_DAMAGE_PCT,
  isPeerlessGhostForm,
  isPeerlessOfficer,
  isWithinPeerlessIntimidate,
  peerlessLifestealHeal,
  peerlessSplashDamage,
} from './peerless.js';

describe('D-0B-8 吕布无双数值真源（Session 455）', () => {
  it('识别吕布：固定 id=5 与 uniqueSkill=wushuang', () => {
    expect(isPeerlessOfficer({ id: 5 })).toBe(true);
    expect(isPeerlessOfficer({ id: 99, uniqueSkill: 'wushuang' })).toBe(true);
    expect(isPeerlessOfficer({ id: 6, uniqueSkill: 'wusheng' })).toBe(false);
    expect(isPeerlessOfficer(null)).toBe(false);
  });

  it('鬼神形态按兵力 30% 阈值判定', () => {
    expect(PEERLESS_GHOST_TROOP_PCT).toBe(30);
    expect(isPeerlessGhostForm({ troopCount: 300, maxTroops: 1000 })).toBe(true);
    expect(isPeerlessGhostForm({ troopCount: 301, maxTroops: 1000 })).toBe(false);
    expect(isPeerlessGhostForm({ troopCount: 0, maxTroops: 1000 })).toBe(false);
    expect(isPeerlessGhostForm({ troopCount: 100, maxTroops: 0 })).toBe(false);
    expect(PEERLESS_GHOST_DEFENSE_MULTIPLIER).toBe(2);
    expect(PEERLESS_GHOST_LIFESTEAL_PCT).toBe(20);
  });

  it('无双乱舞溅射伤害至少 1', () => {
    expect(PEERLESS_DANCE_SPLASH_PCT).toBe(35);
    expect(peerlessSplashDamage(100)).toBe(35);
    expect(peerlessSplashDamage(1)).toBe(1);
    expect(peerlessSplashDamage(0)).toBe(1);
  });

  it('鬼神吸血回复量', () => {
    expect(peerlessLifestealHeal(100)).toBe(20);
    expect(peerlessLifestealHeal(4)).toBe(1);
    expect(peerlessLifestealHeal(0)).toBe(0);
  });

  it('心理震慑半径 2 格', () => {
    expect(PEERLESS_INTIMIDATE_DAMAGE_PCT).toBe(10);
    expect(PEERLESS_INTIMIDATE_COUNTER_PCT).toBe(10);
    expect(isWithinPeerlessIntimidate({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(true);
    expect(isWithinPeerlessIntimidate({ q: 2, r: 0 }, { q: 0, r: 0 })).toBe(true);
    expect(isWithinPeerlessIntimidate({ q: 3, r: 0 }, { q: 0, r: 0 })).toBe(false);
  });
});
