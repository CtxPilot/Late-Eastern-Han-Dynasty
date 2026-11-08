// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  calculatePrisonerSurrenderChance,
  calculatePrisonerRansomValue,
  isPrisoner,
  getFactionPrisoners,
} from './prisoner.js';
import { CivilPosition, LocalPosition, MilitaryPosition, NobilityRank, OfficerStatus } from './enums/index.js';
import type { Officer } from './types/officer.js';

function mockOfficer(partial: Partial<Officer>): Officer {
  return {
    id: 1,
    name: '测试武将',
    birthYear: 160,
    deathYear: 220,
    faction: 1,
    location: 1,
    loyalty: 80,
    experience: 0,
    status: OfficerStatus.ACTIVE,
    skills: [],
    tags: [],
    civilPosition: CivilPosition.NONE,
    localPosition: LocalPosition.NONE,
    militaryPosition: MilitaryPosition.NONE,
    nobilityRank: NobilityRank.NONE,
    merit: 0,
    unitProficiency: {},
    formationMastery: [],
    hidden: {
      bravery: 50,
      calm: 50,
      righteousness: 50,
      ambition: 50,
      harmony: 50,
      activeYears: 40,
      naturalDeathAge: 65,
    },
    stats: {
      leadership: 60,
      war: 60,
      intelligence: 60,
      politics: 60,
      charisma: 60,
      burst: 50,
      agility: 50,
      luck: 50,
      intuition: 50,
      awe: 50,
      strategy: 50,
      tactics: 50,
    },
    ...partial,
  };
}

describe('prisoner.ts (Phase 7-04)', () => {
  describe('战俘招降归顺几率计算 (calculatePrisonerSurrenderChance)', () => {
    it('义理极高且忠诚满额的战俘招降几率极低', () => {
      const loyalGeneral = mockOfficer({
        name: '关羽',
        loyalty: 100,
        hidden: {
          bravery: 98,
          calm: 80,
          righteousness: 100, // 极高义理
          ambition: 30,
          harmony: 80,
          activeYears: 40,
          naturalDeathAge: 60,
        },
      });

      const captor = mockOfficer({
        name: '曹操',
        stats: { leadership: 96, war: 72, intelligence: 92, politics: 94, charisma: 96, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 90, tactics: 90 },
      });

      const result = calculatePrisonerSurrenderChance(loyalGeneral, captor, 0, 500);
      expect(result.righteousnessPenalty).toBeGreaterThan(0);
      expect(result.loyaltyPenalty).toBeGreaterThan(0);
      // 义理忠诚极高，招降几率受到显著压制
      expect(result.finalChance).toBeLessThanOrEqual(30);
    });

    it('关押月数日久能有效提升招降几率 (久羁锐气消解)', () => {
      const stubborn = mockOfficer({
        name: '硬骨头',
        loyalty: 70,
        hidden: {
          bravery: 70,
          calm: 50,
          righteousness: 70,
          ambition: 50,
          harmony: 50,
          activeYears: 40,
          naturalDeathAge: 65,
        },
      });

      const captor = mockOfficer({ id: 2, name: '君主' });

      const early = calculatePrisonerSurrenderChance(stubborn, captor, 1);
      const late = calculatePrisonerSurrenderChance(stubborn, captor, 12); // 关押 12 个月

      expect(late.imprisonedBonus).toBeGreaterThan(early.imprisonedBonus);
      expect(late.finalChance).toBeGreaterThan(early.finalChance);
    });

    it('招降几率始终受 [5, 85] 范围夹紧约束', () => {
      const normal = mockOfficer({ id: 3 });
      const captor = mockOfficer({ id: 4 });

      const lowResult = calculatePrisonerSurrenderChance(
        mockOfficer({ loyalty: 100, hidden: { ...normal.hidden, righteousness: 100 } }),
        mockOfficer({ stats: { ...normal.stats, charisma: 10, intelligence: 10, politics: 10 } }),
        0,
        0,
      );
      expect(lowResult.finalChance).toBeGreaterThanOrEqual(5);

      const highResult = calculatePrisonerSurrenderChance(
        mockOfficer({ loyalty: 0, hidden: { ...normal.hidden, righteousness: 0 } }),
        mockOfficer({ stats: { ...normal.stats, charisma: 100, intelligence: 100, politics: 100 } }),
        24,
        1000,
      );
      expect(highResult.finalChance).toBeLessThanOrEqual(85);
    });
  });

  describe('战俘赎金估价模型 (calculatePrisonerRansomValue)', () => {
    it('普通白身武将享有基础保底赎金', () => {
      const ordinary = mockOfficer({
        stats: { leadership: 40, war: 40, intelligence: 40, politics: 40, charisma: 40, burst: 40, agility: 40, luck: 40, intuition: 40, awe: 40, strategy: 40, tactics: 40 },
        rankGrade: 9,
        merit: 0,
      });

      const ransom = calculatePrisonerRansomValue(ordinary);
      expect(ransom).toBe(300);
    });

    it('上品公卿高五维重臣赎金显著提升', () => {
      const minister = mockOfficer({
        stats: { leadership: 85, war: 80, intelligence: 92, politics: 95, charisma: 90, burst: 50, agility: 50, luck: 50, intuition: 50, awe: 50, strategy: 50, tactics: 50 },
        rankGrade: 2, // 二品
        merit: 10000, // 高功绩
      });

      const ransom = calculatePrisonerRansomValue(minister);
      // 基础 300 + 五维超额 + 品阶300 + 功绩
      expect(ransom).toBeGreaterThanOrEqual(800);
      expect(ransom).toBeLessThanOrEqual(1500);
    });
  });

  describe('战俘状态判定与势力战俘筛选', () => {
    it('准确识别战俘状态', () => {
      const p = mockOfficer({ status: OfficerStatus.PRISONER });
      const a = mockOfficer({ status: OfficerStatus.ACTIVE });
      expect(isPrisoner(p)).toBe(true);
      expect(isPrisoner(a)).toBe(false);
    });

    it('准确筛选指定势力羁押的战俘列表', () => {
      const p1 = mockOfficer({ id: 1, status: OfficerStatus.PRISONER, captiveByFactionId: 3 });
      const p2 = mockOfficer({ id: 2, status: OfficerStatus.PRISONER, captiveByFactionId: 4 });
      const a1 = mockOfficer({ id: 3, status: OfficerStatus.ACTIVE, captiveByFactionId: 3 });

      const officers = { 1: p1, 2: p2, 3: a1 };
      const prisonersOfF3 = getFactionPrisoners(officers, 3);
      expect(prisonersOfF3.length).toBe(1);
      expect(prisonersOfF3[0].id).toBe(1);
    });
  });
});
