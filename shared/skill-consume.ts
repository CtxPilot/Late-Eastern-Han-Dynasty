// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S25 技能树效果消费（Session 337）
 * - 技能树加点同步到 officer.skills（战斗/火计/暴击等既有路径已读 skills）
 * - 内政/人事消费系数集中于此，避免引擎各写一套
 */
import type { SkillTreeDef } from './types/skill-tree.js';
import type { OfficerSkill, OfficerSkillStatic } from './types/officer.js';
import type { SkillType } from './enums/index.js';

/** 农/商/城开发完成增益：指派武将对应技能每级 +5% */
export const CIVIL_DEVELOP_BONUS_PER_LEVEL = 0.05;
/** 征兵/训练效率：城主对应技能每级 +5% */
export const CIVIL_EFFICIENCY_BONUS_PER_LEVEL = 0.05;
/** 寻访成功率：搜索者寻访技能每级 +3 百分点（小数概率） */
export const DISCOVER_RATE_PER_LEVEL = 0.03;
/** 登用成功率：说客辩才每级 +2 百分点 */
export const ELOQUENCE_RECRUIT_PER_LEVEL = 2;
/** 结盟成功率：使者辩才每级 +1 百分点 */
export const ELOQUENCE_ALLIANCE_PER_LEVEL = 1;

const DEVELOP_SKILL_BY_KIND: Record<'farm' | 'commerce' | 'wall', string> = {
  farm: 'farming',
  commerce: 'commerce',
  wall: 'fortify',
};

export function skillLevelOf(
  officer: { skills?: ReadonlyArray<{ skillId: string; level: number }> } | null | undefined,
  skillId: string,
): number {
  if (!officer?.skills) return 0;
  const hit = officer.skills.find((s) => s.skillId === skillId);
  if (!hit) return 0;
  return Math.max(0, Math.min(5, hit.level));
}

/** 从技能树状态派生各 skillId 的最高等级（跨树同 skillId 取 max） */
export function treeDerivedSkillLevels(
  skillTreeState: Record<string, number> | undefined,
  trees: SkillTreeDef[],
): Record<string, number> {
  const out: Record<string, number> = {};
  const state = skillTreeState ?? {};
  for (const tree of trees) {
    for (const node of tree.nodes) {
      if (!node.skillId) continue;
      const lv = state[node.id] ?? 0;
      if (lv <= 0) continue;
      out[node.skillId] = Math.max(out[node.skillId] ?? 0, Math.min(5, lv));
    }
  }
  return out;
}

/**
 * 合并静态基线与技能树派生等级。
 * 有效等级 = max(基线, 树派生)；非树管理技能保持基线；useCount 尽量保留当前值。
 */
export function mergeSkillsWithTree(
  baseline: ReadonlyArray<OfficerSkillStatic>,
  current: ReadonlyArray<OfficerSkill> | undefined,
  skillTreeState: Record<string, number> | undefined,
  trees: SkillTreeDef[],
): OfficerSkill[] {
  const treeLevels = treeDerivedSkillLevels(skillTreeState, trees);
  const useCountById = new Map<string, number>();
  for (const s of current ?? []) {
    useCountById.set(s.skillId, s.useCount ?? 0);
  }

  const byId = new Map<string, OfficerSkill>();
  for (const s of baseline) {
    byId.set(s.skillId, {
      skillId: s.skillId,
      level: s.level,
      useCount: useCountById.get(s.skillId) ?? 0,
    });
  }

  for (const [skillId, treeLv] of Object.entries(treeLevels)) {
    const prev = byId.get(skillId);
    const baseLv = prev?.level ?? 0;
    byId.set(skillId, {
      skillId: skillId as SkillType,
      level: Math.max(baseLv, treeLv),
      useCount: prev?.useCount ?? useCountById.get(skillId) ?? 0,
    });
  }

  return [...byId.values()].sort((a, b) => String(a.skillId).localeCompare(String(b.skillId)));
}

export function developSkillBonus(
  officer: { skills?: ReadonlyArray<{ skillId: string; level: number }> } | null | undefined,
  kind: 'farm' | 'commerce' | 'wall',
): number {
  const skillId = DEVELOP_SKILL_BY_KIND[kind];
  return skillLevelOf(officer, skillId) * CIVIL_DEVELOP_BONUS_PER_LEVEL;
}

export function recruitSkillBonus(
  officer: { skills?: ReadonlyArray<{ skillId: string; level: number }> } | null | undefined,
): number {
  return skillLevelOf(officer, 'recruit') * CIVIL_EFFICIENCY_BONUS_PER_LEVEL;
}

export function trainSkillBonus(
  officer: { skills?: ReadonlyArray<{ skillId: string; level: number }> } | null | undefined,
): number {
  return skillLevelOf(officer, 'train') * CIVIL_EFFICIENCY_BONUS_PER_LEVEL;
}

export function discoverSkillRateBonus(
  officer: { skills?: ReadonlyArray<{ skillId: string; level: number }> } | null | undefined,
): number {
  return skillLevelOf(officer, 'discover') * DISCOVER_RATE_PER_LEVEL;
}

export function eloquenceRecruitModifier(
  officer: { skills?: ReadonlyArray<{ skillId: string; level: number }> } | null | undefined,
): number {
  return skillLevelOf(officer, 'eloquence') * ELOQUENCE_RECRUIT_PER_LEVEL;
}

export function eloquenceAllianceModifier(
  officer: { skills?: ReadonlyArray<{ skillId: string; level: number }> } | null | undefined,
): number {
  return skillLevelOf(officer, 'eloquence') * ELOQUENCE_ALLIANCE_PER_LEVEL;
}

export function medicineSkillLevel(
  officer: { skills?: ReadonlyArray<{ skillId: string; level: number }> } | null | undefined,
): number {
  return skillLevelOf(officer, 'medicine');
}
