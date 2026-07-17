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

  return Math.floor(Math.max(0, base + merit + ageMod));
}

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
