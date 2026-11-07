// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  CeilingAttribute,
  TraitCategory,
  TRAITS,
  TRAIT_MAP,
  getEffectiveStat,
  getTraitRequiredStat,
  getTraitCeilingLevel,
  getOfficerTraitLevel,
  type Officer,
} from './index.js';

function stubOfficer(overrides: Partial<Officer> = {}): Officer {
  return {
    id: 1,
    name: '测试武将',
    birthYear: 160,
    deathYear: 220,
    stats: {
      leadership: 70,
      war: 70,
      intelligence: 70,
      politics: 70,
      charisma: 70,
    },
    hidden: {
      compatibility: 50,
      righteousness: 5,
      ambition: 5,
      valor: 5,
      composure: 5,
      lifespan: 220,
      growth: 'mid',
      personality: 'calm' as any,
      ideal: 'hegemony' as any,
      bloodline: [],
      ceilingBonus: null,
      power: 50,
      burst: 50,
      agility: 50,
      luck: 50,
      intuition: 50,
      awe: 50,
      strategy: 50,
      tactics: 50,
    },
    unitProficiency: {},
    formationMastery: [],
    skills: [],
    tags: [],
    faction: 1,
    location: 1,
    loyalty: 80,
    experience: 0,
    status: 'active' as any,
    civilPosition: 'none' as any,
    localPosition: 'none' as any,
    militaryPosition: 'none' as any,
    nobilityRank: 'none' as any,
    merit: 0,
    stamina: 100,
    beauties: [],
    ...overrides,
  } as Officer;
}

describe('P5-15 武将特性真源定义 (TRAITS)', () => {
  it('特性全量恰好 42 项', () => {
    expect(TRAITS).toHaveLength(42);
    expect(Object.keys(TRAIT_MAP)).toHaveLength(42);
  });

  it('五大类别项数严格符合设计真源 (8+9+10+9+6)', () => {
    const counts = {
      [TraitCategory.STRATEGY]: 0,
      [TraitCategory.TACTICS]: 0,
      [TraitCategory.COMBAT]: 0,
      [TraitCategory.CIVIL]: 0,
      [TraitCategory.PERSONALITY]: 0,
    };
    for (const t of TRAITS) {
      counts[t.category]++;
    }
    expect(counts[TraitCategory.STRATEGY]).toBe(8);
    expect(counts[TraitCategory.TACTICS]).toBe(9);
    expect(counts[TraitCategory.COMBAT]).toBe(10);
    expect(counts[TraitCategory.CIVIL]).toBe(9);
    expect(counts[TraitCategory.PERSONALITY]).toBe(6);
  });

  it('每项特性均拥有完整的 5 级描述且关联正确属性', () => {
    for (const t of TRAITS) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.levels).toHaveLength(5);
      for (const desc of t.levels) {
        expect(desc).toBeTruthy();
      }
      if (t.category === TraitCategory.STRATEGY) {
        expect(t.attribute).toBe(CeilingAttribute.LEADERSHIP);
      } else if (t.category === TraitCategory.TACTICS) {
        expect(t.attribute).toBe(CeilingAttribute.INTELLIGENCE);
      } else if (t.category === TraitCategory.COMBAT) {
        expect(t.attribute).toBe(CeilingAttribute.WAR);
      } else if (t.category === TraitCategory.CIVIL) {
        expect(t.attribute).toBe(CeilingAttribute.POLITICS);
      } else if (t.category === TraitCategory.PERSONALITY) {
        expect(t.attribute).toBe(CeilingAttribute.CHARISMA);
      }
    }
  });
});

describe('P5-15 属性天花板与有效属性计算 (getEffectiveStat)', () => {
  it('普通武将有效属性等于裸属性 + 功绩加成 + 装备加成', () => {
    const o = stubOfficer({
      stats: { leadership: 75, war: 82, intelligence: 60, politics: 50, charisma: 65 },
    });
    expect(getEffectiveStat(o, CeilingAttribute.WAR)).toBe(82);
    expect(getEffectiveStat(o, CeilingAttribute.WAR, 5)).toBe(87);
  });

  it('吕布享受武力 +50 天花板隐藏断层加成', () => {
    const lvbu = stubOfficer({
      id: 5,
      name: '吕布',
      stats: { leadership: 85, war: 100, intelligence: 25, politics: 13, charisma: 40 },
      hidden: {
        ...stubOfficer().hidden,
        ceilingBonus: { attribute: CeilingAttribute.WAR, hiddenBonus: 50 },
      },
    });
    expect(getEffectiveStat(lvbu, CeilingAttribute.WAR)).toBe(150);
    expect(getEffectiveStat(lvbu, CeilingAttribute.LEADERSHIP)).toBe(85);
  });

  it('诸葛亮享受智谋 +20 天花板隐藏断层加成', () => {
    const zg = stubOfficer({
      id: 20,
      name: '诸葛亮',
      stats: { leadership: 98, war: 38, intelligence: 100, politics: 98, charisma: 95 },
      hidden: {
        ...stubOfficer().hidden,
        ceilingBonus: { attribute: CeilingAttribute.INTELLIGENCE, hiddenBonus: 20 },
      },
    });
    expect(getEffectiveStat(zg, CeilingAttribute.INTELLIGENCE)).toBe(120);
  });

  it('有效属性硬上限截断为 255', () => {
    const superOfficer = stubOfficer({
      stats: { leadership: 100, war: 100, intelligence: 100, politics: 100, charisma: 100 },
      hidden: {
        ...stubOfficer().hidden,
        ceilingBonus: { attribute: CeilingAttribute.WAR, hiddenBonus: 50 },
      },
    });
    expect(getEffectiveStat(superOfficer, CeilingAttribute.WAR, 200)).toBe(255);
  });
});

describe('P5-15 特性天花板与门槛 (getTraitRequiredStat / getTraitCeilingLevel)', () => {
  it('门槛阶梯符合 docs/30 §5.3', () => {
    expect(getTraitRequiredStat(1, CeilingAttribute.WAR)).toBe(0);
    expect(getTraitRequiredStat(2, CeilingAttribute.WAR)).toBe(60);
    expect(getTraitRequiredStat(3, CeilingAttribute.WAR)).toBe(80);
    expect(getTraitRequiredStat(4, CeilingAttribute.WAR)).toBe(90);
    // 武力第二档起点 97
    expect(getTraitRequiredStat(5, CeilingAttribute.WAR)).toBe(97);
    // 统智政魅第二档起点 99
    expect(getTraitRequiredStat(5, CeilingAttribute.LEADERSHIP)).toBe(99);
    expect(getTraitRequiredStat(5, CeilingAttribute.INTELLIGENCE)).toBe(99);
  });

  it('根据有效属性正确判定最高可学等级', () => {
    expect(getTraitCeilingLevel(55, CeilingAttribute.WAR)).toBe(1);
    expect(getTraitCeilingLevel(60, CeilingAttribute.WAR)).toBe(2);
    expect(getTraitCeilingLevel(79, CeilingAttribute.WAR)).toBe(2);
    expect(getTraitCeilingLevel(80, CeilingAttribute.WAR)).toBe(3);
    expect(getTraitCeilingLevel(89, CeilingAttribute.WAR)).toBe(3);
    expect(getTraitCeilingLevel(90, CeilingAttribute.WAR)).toBe(4);
    expect(getTraitCeilingLevel(96, CeilingAttribute.WAR)).toBe(4);
    expect(getTraitCeilingLevel(97, CeilingAttribute.WAR)).toBe(5);

    // 智谋 97 仍在 Lv4，99 达 Lv5
    expect(getTraitCeilingLevel(97, CeilingAttribute.INTELLIGENCE)).toBe(4);
    expect(getTraitCeilingLevel(99, CeilingAttribute.INTELLIGENCE)).toBe(5);
  });

  it('读取武将现有特性等级', () => {
    const o = stubOfficer({
      traitLevels: { bravery: 3, iron_wall: 1 },
    });
    expect(getOfficerTraitLevel(o, 'bravery')).toBe(3);
    expect(getOfficerTraitLevel(o, 'iron_wall')).toBe(1);
    expect(getOfficerTraitLevel(o, 'logistics')).toBe(0);
  });
});
