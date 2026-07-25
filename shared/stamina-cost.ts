// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { OfficerStatic } from './types/officer.js';
import { effectiveWar, effectiveIntelligence } from './stamina.js';

export type OfficerRole = 'military' | 'strategist' | 'civil';
export type ActionType = 'battlefield' | 'stratagem';
export type { OfficerStatic };

export function deriveRole(officer: OfficerStatic): OfficerRole {
  const war = effectiveWar(officer);
  const int = effectiveIntelligence(officer);
  if (war >= int) return 'military';
  return 'strategist';
}

export function isCrossDomain(role: OfficerRole, action: ActionType): boolean {
  return (role === 'military' && action === 'stratagem')
    || (role === 'strategist' && action === 'battlefield');
}

export const CROSS_DOMAIN_MULTIPLIER = 1.5;
export const SAME_DOMAIN_MULTIPLIER = 1.0;

export function staminaCost(
  baseCost: number,
  officer: OfficerStatic,
  action: ActionType,
): number {
  const role = deriveRole(officer);
  const mult = isCrossDomain(role, action) ? CROSS_DOMAIN_MULTIPLIER : SAME_DOMAIN_MULTIPLIER;
  return Math.floor(baseCost * mult);
}

export function staminaEffectFactor(stamina: number): number {
  if (stamina < 10) return 0.6;
  if (stamina < 30) return 0.8;
  return 1.0;
}