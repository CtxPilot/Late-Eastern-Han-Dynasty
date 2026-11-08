// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  GeneralTrendStage,
  deriveTrendStage,
  getTrendStage,
  rankGradeLabel,
  isUpperRank,
  isMiddleRank,
  isLowerRank,
  evaluateOfficerRankGrade,
  evaluateFactionNineRanks,
} from './nine-ranks.js';
import { CivilPosition, LocalPosition, MilitaryPosition, NobilityRank, OfficerStatus } from './enums/index.js';
import type { Officer } from './types/officer.js';
import type { GameState } from './types/game.js';

function mockOfficer(partial: Partial<Officer>): Officer {
  return {
    id: 1,
    name: '测试武将',
    birthYear: 160,
    deathYear: 220,
    faction: 1,
    location: 1,
    loyalty: 90,
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

describe('nine-ranks.ts (Phase 7-03)', () => {
  describe('天下大势演进推导 (deriveTrendStage & getTrendStage)', () => {
    it('按年份推导各大势阶段', () => {
      expect(deriveTrendStage(190)).toBe(GeneralTrendStage.WARLORDS_DISORDER);
      expect(deriveTrendStage(199)).toBe(GeneralTrendStage.WARLORDS_DISORDER);
      expect(deriveTrendStage(200)).toBe(GeneralTrendStage.HEGEMONY_CONTEST);
      expect(deriveTrendStage(207)).toBe(GeneralTrendStage.HEGEMONY_CONTEST);
      expect(deriveTrendStage(208)).toBe(GeneralTrendStage.THREE_KINGDOMS_FORMING);
      expect(deriveTrendStage(219)).toBe(GeneralTrendStage.THREE_KINGDOMS_FORMING);
      expect(deriveTrendStage(220)).toBe(GeneralTrendStage.THREE_KINGDOMS_RIVALRY);
      expect(deriveTrendStage(264)).toBe(GeneralTrendStage.THREE_KINGDOMS_RIVALRY);
      expect(deriveTrendStage(265)).toBe(GeneralTrendStage.UNIFICATION_CLIMAX);
      expect(deriveTrendStage(280)).toBe(GeneralTrendStage.UNIFICATION_CLIMAX);
    });

    it('当天下仅剩一家拥有城池的势力时提前步入九州归一', () => {
      const state = {
        currentYear: 200,
        factions: {
          1: { isAlive: true, cityIds: [1, 2, 3] },
          2: { isAlive: false, cityIds: [] },
        },
        cities: { 1: {}, 2: {}, 3: {} },
      } as unknown as GameState;

      expect(deriveTrendStage(200, state)).toBe(GeneralTrendStage.UNIFICATION_CLIMAX);
    });

    it('当已有两家及以上势力称帝时推进至三国对峙', () => {
      const state = {
        currentYear: 215,
        factions: {
          1: { isAlive: true, cityIds: [1], politicalStage: 'emperor' },
          2: { isAlive: true, cityIds: [2], politicalStage: 'emperor' },
        },
        cities: { 1: {}, 2: {} },
      } as unknown as GameState;

      expect(deriveTrendStage(215, state)).toBe(GeneralTrendStage.THREE_KINGDOMS_RIVALRY);
    });

    it('getTrendStage 优先读取显式 state.trendStage', () => {
      const state = {
        currentYear: 190,
        trendStage: GeneralTrendStage.THREE_KINGDOMS_RIVALRY,
        factions: {},
        cities: {},
      } as unknown as GameState;

      expect(getTrendStage(state)).toBe(GeneralTrendStage.THREE_KINGDOMS_RIVALRY);
    });
  });

  describe('中正定品评阶 (evaluateOfficerRankGrade)', () => {
    it('名门士族顶级才智评为上品极品 (一品~二品)', () => {
      const xunYu = mockOfficer({
        name: '荀彧',
        tags: ['名门', '士族', '海内名士', '经学大师'],
        stats: {
          leadership: 70,
          war: 35,
          intelligence: 96,
          politics: 98,
          charisma: 94,
          burst: 50,
          agility: 50,
          luck: 50,
          intuition: 50,
          awe: 50,
          strategy: 90,
          tactics: 85,
        },
      });

      const grade = evaluateOfficerRankGrade(xunYu);
      expect(isUpperRank(grade)).toBe(true);
      expect(grade).toBe(1);
      expect(rankGradeLabel(grade)).toContain('一品');
    });

    it('普通士族将领起品 3~4 品，不易跌按下品', () => {
      const nobleOfficer = mockOfficer({
        name: '士族官员',
        tags: ['士族'],
        stats: {
          leadership: 60,
          war: 50,
          intelligence: 65,
          politics: 65,
          charisma: 65,
          burst: 50,
          agility: 50,
          luck: 50,
          intuition: 50,
          awe: 50,
          strategy: 50,
          tactics: 50,
        },
      });

      const grade = evaluateOfficerRankGrade(nobleOfficer);
      expect(grade).toBe(4);
      expect(isMiddleRank(grade)).toBe(true);
    });

    it('寒门无功绩将领受门阀壁垒限制无法进入上品 (上品无寒门)', () => {
      const commoner = mockOfficer({
        name: '寒门武人',
        tags: ['寒门'],
        merit: 0,
        stats: {
          leadership: 80,
          war: 80,
          intelligence: 60,
          politics: 50,
          charisma: 50,
          burst: 50,
          agility: 50,
          luck: 50,
          intuition: 50,
          awe: 50,
          strategy: 50,
          tactics: 50,
        },
      });

      const grade = evaluateOfficerRankGrade(commoner);
      // 起品 8，中品/下品，不得入上品
      expect(grade).toBeGreaterThanOrEqual(4);
      expect(isUpperRank(grade)).toBe(false);
    });

    it('寒门将领依仗极高属性或功绩可打破门阀壁垒跻身中品/上品', () => {
      const commonerHero = mockOfficer({
        name: '盖世寒门',
        tags: ['寒门'],
        merit: 25000, // 极高功绩 Lv15+
        stats: {
          leadership: 96,
          war: 98,
          intelligence: 75,
          politics: 60,
          charisma: 85,
          burst: 50,
          agility: 50,
          luck: 50,
          intuition: 50,
          awe: 50,
          strategy: 80,
          tactics: 80,
        },
      });

      const grade = evaluateOfficerRankGrade(commonerHero);
      expect(grade).toBeLessThanOrEqual(4);
    });
  });

  describe('势力全员定品 (evaluateFactionNineRanks)', () => {
    it('只对指定势力武将写入 rankGrade，并遵循 COW 保持未变武将引用', () => {
      const o1 = mockOfficer({ id: 1, faction: 1, tags: ['士族'] });
      const o2 = mockOfficer({ id: 2, faction: 2, tags: ['寒门'] });
      const officers = { 1: o1, 2: o2 };

      const updated = evaluateFactionNineRanks(officers, 1);
      expect(updated[1].rankGrade).toBeDefined();
      expect(updated[2].rankGrade).toBeUndefined();
      expect(updated[2]).toBe(o2); // COW: o2 未变动故引用相同
    });
  });
});
