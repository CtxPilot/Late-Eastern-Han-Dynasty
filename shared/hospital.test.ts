// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  InjuryLevel,
  calculateCasualtySplit,
  calculateMonthlyWoundedRecoveryRate,
  calculateInjuryCombatPenalty,
  getHealingMonthsRequired,
  isOfficerInjured,
  hasMedicalSkill,
  HOSPITAL_FUNDING_COST,
  HOSPITAL_FUNDING_DURATION,
  CURE_COST_BY_INJURY,
} from './hospital.js';
import type { City } from './types/city.js';
import type { Officer } from './types/officer.js';

function mockCity(patch: Partial<City>): City {
  return {
    id: 1,
    name: '许昌',
    province: '豫州',
    x: 100,
    y: 100,
    population: 50000,
    troops: 5000,
    troopsMorale: 80,
    stats: {
      farm: 200,
      commerce: 200,
      wall: 100,
      morale: 80,
      sanitation: 50,
      ...(patch.stats ?? {}),
    },
    ruler: 1,
    officers: [],
    ...patch,
  } as unknown as City;
}

function mockOfficer(patch: Partial<Officer>): Officer {
  return {
    id: 1,
    name: '曹操',
    stats: {
      force: 72,
      command: 96,
      intelligence: 91,
      politics: 94,
      charisma: 96,
    },
    skills: [],
    ...patch,
  } as unknown as Officer;
}

describe('hospital.ts (Phase 7-06)', () => {
  describe('战损 40%/60% 分流 (calculateCasualtySplit)', () => {
    it('1000 战损精确分流为 400 阵亡与 600 伤兵', () => {
      const split = calculateCasualtySplit(1000);
      expect(split.dead).toBe(400);
      expect(split.wounded).toBe(600);
    });

    it('3500 战损分流为 1400 阵亡与 2100 伤兵', () => {
      const split = calculateCasualtySplit(3500);
      expect(split.dead).toBe(1400);
      expect(split.wounded).toBe(2100);
    });

    it('0 或负数损耗安全返回 0', () => {
      const split = calculateCasualtySplit(0);
      expect(split.dead).toBe(0);
      expect(split.wounded).toBe(0);
    });
  });

  describe('武将创伤战力衰减与行动门禁 (calculateInjuryCombatPenalty)', () => {
    it('健康武将 (Lv0) 享有 100% 战力且无门禁', () => {
      const p = calculateInjuryCombatPenalty(InjuryLevel.HEALTHY);
      expect(p.forceModifier).toBe(1.0);
      expect(p.commandModifier).toBe(1.0);
      expect(p.canDuel).toBe(true);
      expect(p.canMarch).toBe(true);
      expect(p.label).toBe('健康');
    });

    it('轻伤武将 (Lv1) 武统微削 5%，仍可出征与单挑', () => {
      const p = calculateInjuryCombatPenalty(InjuryLevel.MILD);
      expect(p.forceModifier).toBe(0.95);
      expect(p.commandModifier).toBe(0.95);
      expect(p.canDuel).toBe(true);
      expect(p.canMarch).toBe(true);
      expect(p.label).toBe('轻伤');
    });

    it('中伤武将 (Lv2) 武力削弱 15% 且严格禁止出阵单挑', () => {
      const p = calculateInjuryCombatPenalty(InjuryLevel.MODERATE);
      expect(p.forceModifier).toBe(0.85);
      expect(p.commandModifier).toBe(0.90);
      expect(p.canDuel).toBe(false);
      expect(p.canMarch).toBe(true);
      expect(p.label).toBe('中伤');
    });

    it('重伤武将 (Lv3) 全属性削减 20% 且禁止单挑与出征行军', () => {
      const p = calculateInjuryCombatPenalty(InjuryLevel.SEVERE);
      expect(p.allModifier).toBe(0.80);
      expect(p.canDuel).toBe(false);
      expect(p.canMarch).toBe(false);
      expect(p.label).toBe('重伤');
    });

    it('濒死武将 (Lv4) 全属性削减 40% 仅能卧床', () => {
      const p = calculateInjuryCombatPenalty(InjuryLevel.CRITICAL);
      expect(p.allModifier).toBe(0.60);
      expect(p.canDuel).toBe(false);
      expect(p.canMarch).toBe(false);
      expect(p.label).toBe('濒死');
    });
  });

  describe('城池伤兵营月度回流模型 (calculateMonthlyWoundedRecoveryRate)', () => {
    it('基础城池自然回流率为 10%', () => {
      const city = mockCity({});
      const rate = calculateMonthlyWoundedRecoveryRate({ city });
      expect(rate).toBeCloseTo(0.10, 4);
    });

    it('官办医馆拨款注资后回流率提升至 20%', () => {
      const city = mockCity({ hospitalFundedMonths: 2 });
      const rate = calculateMonthlyWoundedRecoveryRate({ city });
      expect(rate).toBeCloseTo(0.20, 4);
    });

    it('城市卫生达标 (>=80) 额外享有 +5% 回流加成', () => {
      const city = mockCity({ stats: { farm: 200, commerce: 200, wall: 100, morale: 80, sanitation: 85 } });
      const rate = calculateMonthlyWoundedRecoveryRate({ city });
      expect(rate).toBeCloseTo(0.15, 4);
    });

    it('驻城医官特性 + 药材调理显著提升治愈效率并受上限 40% 约束', () => {
      const city = mockCity({
        hospitalFundedMonths: 3,
        stats: { farm: 200, commerce: 200, wall: 100, morale: 80, sanitation: 90 },
      });
      const doctor = mockOfficer({
        skills: [{ skillId: 'medicine', level: 1, useCount: 0 }],
      });
      const rate = calculateMonthlyWoundedRecoveryRate({
        city,
        officersInCity: [doctor],
        hasHerbSupply: true,
      });
      // 0.10 + 0.10(fund) + 0.05(sanitation) + 0.10(doctor) + 0.05(herb) = 0.40
      expect(rate).toBeCloseTo(0.40, 4);
    });
  });

  describe('康复周期与医疗成本规则', () => {
    it('轻中重伤康复月数梯次递增 (2/4/6/12)', () => {
      expect(getHealingMonthsRequired(InjuryLevel.MILD)).toBe(2);
      expect(getHealingMonthsRequired(InjuryLevel.MODERATE)).toBe(4);
      expect(getHealingMonthsRequired(InjuryLevel.SEVERE)).toBe(6);
      expect(getHealingMonthsRequired(InjuryLevel.CRITICAL)).toBe(12);
    });

    it('医馆拨款成本为 100 贯，注资时效 3 个月', () => {
      expect(HOSPITAL_FUNDING_COST).toBe(100);
      expect(HOSPITAL_FUNDING_DURATION).toBe(3);
    });

    it('各级创伤派医诊治成本正确映射 (50/100/200/400)', () => {
      expect(CURE_COST_BY_INJURY[InjuryLevel.MILD]).toBe(50);
      expect(CURE_COST_BY_INJURY[InjuryLevel.MODERATE]).toBe(100);
      expect(CURE_COST_BY_INJURY[InjuryLevel.SEVERE]).toBe(200);
      expect(CURE_COST_BY_INJURY[InjuryLevel.CRITICAL]).toBe(400);
    });

    it('判断武将是否负伤', () => {
      expect(isOfficerInjured(mockOfficer({ injury: 0 }))).toBe(false);
      expect(isOfficerInjured(mockOfficer({ injury: 2 }))).toBe(true);
    });
  });
});
