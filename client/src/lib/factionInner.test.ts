// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { OfficerStatus, type Officer } from '@leh/shared';
import {
  calculateOfficerWeight,
  deriveFactionParties,
  detectOfficerOrigin,
} from './factionInner';

function mockOfficer(partial: Partial<Officer>): Officer {
  return {
    id: 1,
    name: '测试名士',
    faction: 1,
    status: OfficerStatus.ACTIVE,
    location: 1,
    loyalty: 85,
    stamina: 100,
    civilPosition: 'none' as any,
    militaryPosition: 'none' as any,
    localPosition: 'none' as any,
    nobilityRank: 'none' as any,
    hegemonyPosition: 'none' as any,
    stats: {
      leadership: 70,
      war: 60,
      intelligence: 75,
      politics: 80,
      charisma: 72,
    },
    hidden: {
      compatibility: 50,
      personality: 'cautious' as any,
      ideal: 'royalist' as any,
    } as any,
    merit: 100,
    experience: 0,
    tags: [],
    unitProficiency: {},
    formationMastery: [],
    skills: [],
    birthYear: 160,
    deathYear: 220,
    beauties: [],
    ...partial,
  } as Officer;
}

describe('factionInner 势力内部派系判定纯函数 (S20-W4)', () => {
  describe('detectOfficerOrigin', () => {
    it('准确识别宗室出身', () => {
      expect(detectOfficerOrigin(mockOfficer({ tags: ['汉室', '名门'] }))).toBe('royal');
      expect(detectOfficerOrigin(mockOfficer({ tags: ['宗室'] }))).toBe('royal');
    });

    it('准确识别边地出身', () => {
      expect(detectOfficerOrigin(mockOfficer({ tags: ['边地', '猛将'] }))).toBe('frontier');
      expect(detectOfficerOrigin(mockOfficer({ tags: ['西凉'] }))).toBe('frontier');
    });

    it('准确识别士族门阀出身', () => {
      expect(detectOfficerOrigin(mockOfficer({ tags: ['士族', '谋臣'] }))).toBe('gentry');
      expect(detectOfficerOrigin(mockOfficer({ tags: ['名士'] }))).toBe('gentry');
    });

    it('准确识别豪强豪族出身', () => {
      expect(detectOfficerOrigin(mockOfficer({ tags: ['豪族'] }))).toBe('magnate');
      expect(detectOfficerOrigin(mockOfficer({ tags: ['豪强'] }))).toBe('magnate');
    });

    it('准确识别寒门出身', () => {
      expect(detectOfficerOrigin(mockOfficer({ tags: ['寒门', '战将'] }))).toBe('humble');
    });

    it('无显著出身标签默认归入平民', () => {
      expect(detectOfficerOrigin(mockOfficer({ tags: [] }))).toBe('commoner');
      expect(detectOfficerOrigin(mockOfficer({ tags: ['演义', '生卒约'] }))).toBe('commoner');
    });
  });

  describe('calculateOfficerWeight', () => {
    it('朝职与高阶官职武将权重显著领先平民', () => {
      const commoner = mockOfficer({ civilPosition: 'none' as any });
      const chancellor = mockOfficer({ civilPosition: 'chancellor' as any });
      const grandCommander = mockOfficer({ hegemonyPosition: 'grand_commander' as any });

      expect(calculateOfficerWeight(chancellor)).toBeGreaterThan(calculateOfficerWeight(commoner));
      expect(calculateOfficerWeight(grandCommander)).toBeGreaterThan(calculateOfficerWeight(chancellor));
    });
  });

  describe('deriveFactionParties', () => {
    it('满足成派门槛（士族≥3、豪强≥2）时正常建立派系并指派领袖', () => {
      const officers: Officer[] = [
        // 士族 3 人
        mockOfficer({ id: 101, name: '荀彧', tags: ['士族'], civilPosition: 'chancellor' as any }),
        mockOfficer({ id: 102, name: '陈群', tags: ['士族'], civilPosition: 'prefect' as any }),
        mockOfficer({ id: 103, name: '钟繇', tags: ['士族'], civilPosition: 'clerk' as any }),
        // 豪强 2 人 (豪强 threshold = 2)
        mockOfficer({ id: 201, name: '李典', tags: ['豪族'], militaryPosition: 'general' as any }),
        mockOfficer({ id: 202, name: '乐进', tags: ['豪强'], militaryPosition: 'colonel' as any }),
        // 寒门 1 人（未达 3 人门槛归散员）
        mockOfficer({ id: 301, name: '郭嘉', tags: ['寒门'] }),
      ];

      const report = deriveFactionParties(officers, 1);

      expect(report.parties.length).toBe(2);
      expect(report.totalOfficers).toBe(6);
      expect(report.unalignedCount).toBe(1);
      expect(report.unalignedOfficers[0].name).toBe('郭嘉');

      const gentryParty = report.parties.find((p) => p.origin === 'gentry');
      expect(gentryParty).toBeDefined();
      expect(gentryParty?.memberCount).toBe(3);
      expect(gentryParty?.leader.name).toBe('荀彧');

      const magnateParty = report.parties.find((p) => p.origin === 'magnate');
      expect(magnateParty).toBeDefined();
      expect(magnateParty?.memberCount).toBe(2);
      expect(magnateParty?.leader.name).toBe('李典');

      expect(report.cohesionScore).toBeGreaterThanOrEqual(0);
      expect(report.cohesionScore).toBeLessThanOrEqual(100);
      expect(['上和', '中洽', '涣散', '分裂']).toContain(report.cohesionLevel);
    });

    it('无在职官员或全为散员时安全返回空派系', () => {
      const officers: Officer[] = [
        mockOfficer({ id: 1, tags: ['士族'] }),
        mockOfficer({ id: 2, tags: ['寒门'] }),
      ];

      const report = deriveFactionParties(officers, 1);
      expect(report.parties.length).toBe(0);
      expect(report.unalignedCount).toBe(2);
      expect(report.dominantParty).toBeNull();
    });
  });
});
