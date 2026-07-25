// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { CeilingAttribute } from './enums/index.js';
import type { OfficerStatic } from './types/officer.js';

const STAT_CEILING_MAP: Record<string, CeilingAttribute> = {
  war: CeilingAttribute.WAR,
  leadership: CeilingAttribute.LEADERSHIP,
  intelligence: CeilingAttribute.INTELLIGENCE,
  politics: CeilingAttribute.POLITICS,
  charisma: CeilingAttribute.CHARISMA,
};

function effectiveStat(
  officer: OfficerStatic,
  stat: 'war' | 'leadership' | 'intelligence' | 'politics' | 'charisma',
): number {
  const bare = officer.stats[stat];
  const cb = officer.hidden.ceilingBonus;
  if (cb && cb.attribute === STAT_CEILING_MAP[stat]) {
    return bare + cb.hiddenBonus;
  }
  return bare;
}

export function effectiveWar(officer: OfficerStatic): number {
  return effectiveStat(officer, 'war');
}

export function effectiveLeadership(officer: OfficerStatic): number {
  return effectiveStat(officer, 'leadership');
}

export function effectiveIntelligence(officer: OfficerStatic): number {
  return effectiveStat(officer, 'intelligence');
}

export function effectivePolitics(officer: OfficerStatic): number {
  return effectiveStat(officer, 'politics');
}

export function effectiveCharisma(officer: OfficerStatic): number {
  return effectiveStat(officer, 'charisma');
}

function ageModifier(age: number, power: number = 0): number {
  const base = age <= 30 ? 5 : age <= 50 ? 0 : age <= 60 ? -5 : age <= 70 ? -10 : -20;
  if (base >= 0) return base;
  const powerOffset = Math.min(Math.floor(power / 20), 5);
  const result = base + powerOffset;
  return Math.min(result, 0);
}

export function calcStaminaMax(
  officer: OfficerStatic,
  meritLevel: number,
  age: number,
): number {
  const eWar = effectiveWar(officer);
  const eLead = effectiveLeadership(officer);
  const ePol = effectivePolitics(officer);
  const eInt = effectiveIntelligence(officer);
  const eCha = effectiveCharisma(officer);

  const base = 80 + eWar / 2 + eLead / 10 + (ePol + eInt + eCha) / 50;
  const merit = meritLevel * 2;
  const ageMod = ageModifier(age, officer.hidden.power);

  // 体力基础值缩放（Session 186）：权重结构不变（武力0.5 > 统帅0.1 > 其余0.02），
  // 整体乘 STAMINA_SCALE_FACTOR 使吕布（原始最高 168）封顶 100，223 武将等比例分布。
  // 基础值 ≤ 100；未来装备/官职/爵位等加成（04§27 双轨制）在此之上叠加突破 100。
  return Math.floor(Math.max(0, (base + merit + ageMod) * STAMINA_SCALE_FACTOR));
}

/**
 * 体力基础值缩放系数 = 100 / 168。
 * 168 = 吕布（id=5）运行时原始体力上限：80 + 150/2 + 97/10 + 195/50 + 0(merit) + 0(age34) = 168.6 → 168。
 * 150 = 武力面板100 + ceilingBonus.hiddenBonus50（武天花板）。
 * 系数锁定为常量，避免 ceilingBonus/age 变化导致基准漂移。
 */
export const STAMINA_SCALE_FACTOR = 100 / 168;

export function calcStaminaRecovery(
  officer: OfficerStatic,
  age: number,
  medicalSkillLevel: number,
): number {
  const eWar = effectiveWar(officer);
  const eLead = effectiveLeadership(officer);
  const ePol = effectivePolitics(officer);
  const eInt = effectiveIntelligence(officer);
  const eCha = effectiveCharisma(officer);

  const combatPart = eWar / 20 + eLead / 20;
  const civilPart = (ePol + eInt + eCha) / 100;
  const powerOffset = Math.min(Math.floor(officer.hidden.power / 40), 2);
  const ageBonus = age < 31 ? 3 : 0;
  const agePenalty = age > 50 ? Math.max(2 - powerOffset, 0) : 0;
  const medical = medicalSkillLevel;

  return Math.floor(Math.max(0, combatPart + civilPart + ageBonus - agePenalty + 1 + medical));
}
