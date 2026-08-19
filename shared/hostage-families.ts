// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { City } from './types/city.js';
import type { GameState } from './types/game.js';

/** 每征 1 兵绑定家属口数（妻小父母合计，0-A 简化） */
export const FAMILY_PER_TROOP = 2;
export const FAMILY_RELOCATE_GOLD = 500;
export const FAMILY_CAPTURE_MORALE_HIT = 40;

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
