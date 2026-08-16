// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  CIVIL_DEVELOP_BONUS_PER_LEVEL,
  developSkillBonus,
  discoverSkillRateBonus,
  eloquenceAllianceModifier,
  eloquenceRecruitModifier,
  medicineSkillLevel,
  mergeSkillsWithTree,
  recruitSkillBonus,
  skillLevelOf,
  trainSkillBonus,
  treeDerivedSkillLevels,
} from './skill-consume.js';
import type { SkillTreeDef } from './types/skill-tree.js';

const trees: SkillTreeDef[] = [
  {
    id: 'strategy',
    name: '战略',
    description: 't',
    nodes: [
      {
        id: 'strategy_fire',
        skillId: 'fire',
        name: '火计',
        description: '',
        treeId: 'strategy',
        maxLevel: 5,
        costPerLevel: 1,
        prerequisites: [],
        nodeType: 'skill',
        domains: ['battlefield'],
      },
    ],
  },
  {
    id: 'duel',
    name: '单挑',
    description: 't',
    nodes: [
      {
        id: 'duel_rapidAttack',
        skillId: 'rapidAttack',
        name: '急攻',
        description: '',
        treeId: 'duel',
        maxLevel: 5,
        costPerLevel: 1,
        prerequisites: [],
        nodeType: 'skill',
        domains: ['duel'],
      },
    ],
  },
  {
    id: 'command',
    name: '统军',
    description: 't',
    nodes: [
      {
        id: 'cmd_rapidAttack',
        skillId: 'rapidAttack',
        name: '急攻',
        description: '',
        treeId: 'command',
        maxLevel: 5,
        costPerLevel: 1,
        prerequisites: [],
        nodeType: 'skill',
        domains: ['battlefield'],
      },
    ],
  },
];

describe('skill-consume', () => {
  it('skillLevelOf clamps and defaults', () => {
    expect(skillLevelOf(null, 'fire')).toBe(0);
    expect(skillLevelOf({ skills: [{ skillId: 'fire', level: 3 }] }, 'fire')).toBe(3);
    expect(skillLevelOf({ skills: [{ skillId: 'fire', level: 9 }] }, 'fire')).toBe(5);
  });

  it('treeDerivedSkillLevels takes max across trees for same skillId', () => {
    const levels = treeDerivedSkillLevels(
      { duel_rapidAttack: 2, cmd_rapidAttack: 4, strategy_fire: 1 },
      trees,
    );
    expect(levels.rapidAttack).toBe(4);
    expect(levels.fire).toBe(1);
  });

  it('mergeSkillsWithTree raises above baseline and preserves useCount', () => {
    const merged = mergeSkillsWithTree(
      [{ skillId: 'fire' as never, level: 2 }],
      [{ skillId: 'fire' as never, level: 2, useCount: 7 }],
      { strategy_fire: 5 },
      trees,
    );
    expect(merged).toEqual([{ skillId: 'fire', level: 5, useCount: 7 }]);
  });

  it('mergeSkillsWithTree does not drop baseline-only skills when tree empty', () => {
    const merged = mergeSkillsWithTree(
      [
        { skillId: 'fire' as never, level: 2 },
        { skillId: 'farming' as never, level: 1 },
      ],
      undefined,
      {},
      trees,
    );
    expect(skillLevelOf({ skills: merged }, 'fire')).toBe(2);
    expect(skillLevelOf({ skills: merged }, 'farming')).toBe(1);
  });

  it('civil bonus helpers', () => {
    const o = {
      skills: [
        { skillId: 'farming', level: 2 },
        { skillId: 'recruit', level: 3 },
        { skillId: 'train', level: 1 },
        { skillId: 'discover', level: 4 },
        { skillId: 'eloquence', level: 5 },
        { skillId: 'medicine', level: 2 },
      ],
    };
    expect(developSkillBonus(o, 'farm')).toBe(2 * CIVIL_DEVELOP_BONUS_PER_LEVEL);
    expect(developSkillBonus(o, 'commerce')).toBe(0);
    expect(recruitSkillBonus(o)).toBeCloseTo(0.15);
    expect(trainSkillBonus(o)).toBeCloseTo(0.05);
    expect(discoverSkillRateBonus(o)).toBeCloseTo(0.12);
    expect(eloquenceRecruitModifier(o)).toBe(10);
    expect(eloquenceAllianceModifier(o)).toBe(5);
    expect(medicineSkillLevel(o)).toBe(2);
  });
});
