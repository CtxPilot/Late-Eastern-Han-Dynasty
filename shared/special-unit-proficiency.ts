// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { UnitType } from './enums/index.js';
import type { Officer, UnitUsageRecord } from './types/officer.js';

/**
 * 05 §5.4 proficiency 正式熟练度（Session 350）：
 * 威力按该兵种战法施放累计次数，在 basePower→maxPower 间线性插值。
 * 满熟练阈值 50 次；适性 NONE 仍不可施放（门禁与 leveled 同源）。
 */
export const SPECIAL_ABILITY_FULL_USES = 50;

export type { UnitUsageRecord };

export function proficiencyPowerRatio(abilityUses: number): number {
  return Math.max(0, Math.min(1, abilityUses / SPECIAL_ABILITY_FULL_USES));
}

export function resolveProficiencyPower(basePower: number, maxPower: number, abilityUses: number): number {
  const ratio = proficiencyPowerRatio(abilityUses);
  return basePower + (maxPower - basePower) * ratio;
}

export function getUnitAbilityUses(officer: Officer | undefined, unitType: UnitType): number {
  if (!officer?.unitUsageRecords) return 0;
  const row = officer.unitUsageRecords.find((r) => r.unitType === unitType);
  return row?.abilityUses ?? 0;
}

/** 就地 +1 abilityUses；无记录则追加。返回新次数。 */
export function recordUnitAbilityUse(officer: Officer, unitType: UnitType): number {
  const list = officer.unitUsageRecords ? [...officer.unitUsageRecords] : [];
  const idx = list.findIndex((r) => r.unitType === unitType);
  if (idx < 0) {
    list.push({
      unitType,
      battlesUsed: 0,
      breakpointsHit: 0,
      bestFormationMatches: 0,
      abilityUses: 1,
    });
    officer.unitUsageRecords = list;
    return 1;
  }
  const prev = list[idx]!;
  const nextUses = (prev.abilityUses ?? 0) + 1;
  list[idx] = { ...prev, abilityUses: nextUses };
  officer.unitUsageRecords = list;
  return nextUses;
}
