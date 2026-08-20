// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { City } from './types/city.js';
import type { GameState } from './types/game.js';
import { z } from 'zod';

/** 每征 1 兵绑定家属口数（妻小父母合计，0-A 简化） */
export const FAMILY_PER_TROOP = 2;
export const FAMILY_RELOCATE_GOLD = 500;
export const FAMILY_CAPTURE_MORALE_HIT = 40;

/** 家属失陷后的处置方式（docs/05 §5.8.2）。 */
export const FAMILY_TREATMENT_MODES = ['kindness', 'neutral', 'repression'] as const;
export type FamilyTreatmentMode = (typeof FAMILY_TREATMENT_MODES)[number];

/** 处置数字真源；规模与效果同步登记于 docs/08 §二十六。 */
export const FAMILY_KINDNESS_CITY_MORALE = 10;
export const FAMILY_KINDNESS_MORALE_PER_QUARTER = 5;
export const FAMILY_KINDNESS_DURATION_QUARTERS = 3;
export const FAMILY_REPRESSION_CITY_MORALE = 20;
export const FAMILY_REPRESSION_ATTACK_BONUS = 0.1;
export const FAMILY_KINDNESS_REVOLT_MULTIPLIER = 0.7;
export const FAMILY_REPRESSION_REVOLT_MULTIPLIER = 1.5;

export interface FamilyTreatmentState {
  mode: FamilyTreatmentMode;
  previousFactionId: number;
  startedQuarter: number;
  expiresQuarter?: number;
  affectedCityIds: number[];
}

export interface PendingFamilyTreatment {
  cityId: number;
  previousFactionId: number;
  familyCount: number;
  affectedCityIds: number[];
}

export const FamilyTreatmentStateSchema: z.ZodType<FamilyTreatmentState> = z
  .object({
    mode: z.enum(FAMILY_TREATMENT_MODES),
    previousFactionId: z.number().int().positive(),
    startedQuarter: z.number().int(),
    expiresQuarter: z.number().int().optional(),
    affectedCityIds: z.array(z.number().int().positive()),
  })
  .strict();

export const PendingFamilyTreatmentSchema: z.ZodType<PendingFamilyTreatment> = z
  .object({
    cityId: z.number().int().positive(),
    previousFactionId: z.number().int().positive(),
    familyCount: z.number().int().positive(),
    affectedCityIds: z.array(z.number().int().positive()),
  })
  .strict();

export function familyTreatmentQuarterKey(year: number, month: number): number {
  return year * 4 + Math.floor((month - 1) / 3);
}

export function familiesGainedOnConscript(troopsGain: number, city: City): number {
  const d = city.demographics;
  const pool = Math.max(0, d.adultFemale + d.child + d.elder);
  return Math.min(troopsGain * FAMILY_PER_TROOP, pool);
}

/** 该城驻军家属实际所在城（质任迁出则指向后方） */
export function familyLocationCityId(city: City): number {
  return city.familyBackupCityId ?? city.id;
}

export function cityDependsOnFamilyLocation(city: City, capturedCityId: number): boolean {
  if (familyLocationCityId(city) !== capturedCityId) return false;
  return (city.garrisonFamilies ?? 0) > 0 || city.familyBackupCityId === capturedCityId;
}

/** 失陷城实际承载的家属总数；迁往后方后由后方城触发。 */
export function familyCountAtLocation(
  state: GameState,
  capturedCityId: number,
  previousFactionId: number,
): number {
  return Object.values(state.cities)
    .filter(
      (city) =>
        city.ruler === previousFactionId &&
        familyLocationCityId(city) === capturedCityId,
    )
    .reduce((sum, city) => sum + (city.garrisonFamilies ?? 0), 0);
}

/** 只有确实有家属留在失陷城时，才生成玩家待决处置。 */
export function buildPendingFamilyTreatment(
  state: GameState,
  capturedCityId: number,
  previousFactionId: number,
): PendingFamilyTreatment | null {
  const familyCount = familyCountAtLocation(state, capturedCityId, previousFactionId);
  if (familyCount <= 0) return null;
  return {
    cityId: capturedCityId,
    previousFactionId,
    familyCount,
    affectedCityIds: citiesShockedByFamilyCapture(state, capturedCityId, previousFactionId),
  };
}

export function familyTreatmentRevoltMultiplier(mode?: FamilyTreatmentMode): number {
  if (mode === 'kindness') return FAMILY_KINDNESS_REVOLT_MULTIPLIER;
  if (mode === 'repression') return FAMILY_REPRESSION_REVOLT_MULTIPLIER;
  return 1;
}

export function familyRepressionAttackMultiplier(
  city: City | undefined,
  attackingFactionId: number,
): number {
  const treatment = city?.familyTreatment;
  if (
    treatment?.mode !== 'repression' ||
    treatment.previousFactionId !== attackingFactionId
  ) {
    return 1;
  }
  return 1 + FAMILY_REPRESSION_ATTACK_BONUS;
}

/**
 * 家属所在城失陷时，受冲击的原势力城（仍属 prevRuler）。
 * 首都且有外城质任家属 → 全国城。
 */
export function citiesShockedByFamilyCapture(
  state: GameState,
  capturedCityId: number,
  prevRuler: number,
): number[] {
  const captured = state.cities[capturedCityId];
  if (!captured) return [];
  const remaining = Object.values(state.cities).filter(
    (c) => c.ruler === prevRuler && c.id !== capturedCityId,
  );
  const capitalId = state.factions[prevRuler]?.capitalCityId;
  const isCapitalHostage =
    capturedCityId === capitalId &&
    remaining.some((c) => cityDependsOnFamilyLocation(c, capturedCityId));
  if (isCapitalHostage) {
    return remaining.map((c) => c.id);
  }
  return remaining.filter((c) => cityDependsOnFamilyLocation(c, capturedCityId)).map((c) => c.id);
}
