// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { PolicyType } from './enums/index.js';
import { DipRelation } from './enums/index.js';
import { areCitiesRoadAdjacent } from './city-roads.js';
import type { GameState } from './types/game.js';
import type { NationalPolicy } from './types/policy.js';

export const POLICY_COOLDOWN_MONTHS = 6;
export const POLICY_PREPARE_FIRST_ROUND_MUL = 1.1;
export const POLICY_PREPARE_INCOMING_MUL = 0.9;
export const POLICY_PLAY_FOOL_TROOP_MUL = 0.5;
export const POLICY_PLAY_FOOL_AI_ATTACK_MUL = 1.8;
export const POLICY_HIGH_WALLS_WALL_MUL = 1.3;
export const POLICY_HIGH_WALLS_FOOD_MUL = 1.15;
export const POLICY_HIGH_WALLS_CONSCRIPT_MUL = 0.8;
export const POLICY_STRIKE_WEAK_HIT_MUL = 1.15;
export const POLICY_STRIKE_WEAK_OTHER_MUL = 0.9;
export const POLICY_SCORCHED_FOOD_COST_MUL = 1.5;
export const POLICY_SCORCHED_MONTHS = 12;
export const POLICY_GUEST_HOST_SHARE = 0.05;
export const POLICY_GUEST_HOST_FAVOR_DELTA = -2;
export const POLICY_BEFRIEND_FAR_DELTA = 3;
export const POLICY_BEFRIEND_NEAR_DELTA = -3;

export const POLICY_LABELS: Record<PolicyType, string> = {
  [PolicyType.PREPARE_DEFENSE]: '以逸待劳',
  [PolicyType.BEFRIEND_FAR]: '远交近攻',
  [PolicyType.PLAY_FOOL]: '假痴不癫',
  [PolicyType.GUEST_HOST]: '反客为主',
  [PolicyType.HIGH_WALLS]: '高筑墙广积粮',
  [PolicyType.STRIKE_WEAK]: '避实击虚',
  [PolicyType.SCORCHED_EARTH]: '坚壁清野',
  [PolicyType.HIDE_STRENGTH]: '深藏不露',
};

export const POLICY_SUMMARIES: Record<PolicyType, string> = {
  [PolicyType.PREPARE_DEFENSE]: '自动战首回合己方攻防+10%（六角移动−1后置）',
  [PolicyType.BEFRIEND_FAR]: '不相邻势力友好+3/月，接壤势力−3/月',
  [PolicyType.PLAY_FOOL]: '对敌显示兵力×0.5，敌更可能来攻',
  [PolicyType.GUEST_HOST]: '驻盟友城每季取其金粮5%，友好−2/月',
  [PolicyType.HIGH_WALLS]: '城防建设+30%、粮产+15%、征兵−20%、士气−1/月',
  [PolicyType.STRIKE_WEAK]: '最弱敌城伤害+15%，其余方向−10%',
  [PolicyType.SCORCHED_EARTH]: '指定边境城粮库清零、一年停产，路过敌军耗粮+50%',
  [PolicyType.HIDE_STRENGTH]: '己城情报对敌模糊；己方侦查视野降一档',
};

export const ALL_POLICY_TYPES: readonly PolicyType[] = [
  PolicyType.PREPARE_DEFENSE,
  PolicyType.BEFRIEND_FAR,
  PolicyType.PLAY_FOOL,
  PolicyType.GUEST_HOST,
  PolicyType.HIGH_WALLS,
  PolicyType.STRIKE_WEAK,
  PolicyType.SCORCHED_EARTH,
  PolicyType.HIDE_STRENGTH,
] as const;

export function monthStamp(year: number, month: number): number {
  return year * 12 + month;
}

export function policiesOf(state: GameState, factionId: number): NationalPolicy[] {
  return (state.nationalPolicies ?? []).filter((p) => p.factionId === factionId);
}

export function getFactionPolicy(state: GameState, factionId: number): NationalPolicy | undefined {
  const list = policiesOf(state, factionId);
  return list.find((p) => p.active) ?? list.find((p) => !p.active);
}

export function getActivePolicyType(state: GameState, factionId: number): PolicyType | null {
  return policiesOf(state, factionId).find((p) => p.active)?.type ?? null;
}

export function factionHasActivePolicy(
  state: GameState,
  factionId: number,
  type: PolicyType,
): boolean {
  return policiesOf(state, factionId).some((p) => p.active && p.type === type);
}

export function policySwitchCooldown(state: GameState, factionId: number): number {
  return Math.max(0, ...policiesOf(state, factionId).map((p) => p.cooldown));
}

export function factionsShareBorder(state: GameState, a: number, b: number): boolean {
  const citiesA = Object.values(state.cities).filter((c) => c.ruler === a);
  const citiesB = Object.values(state.cities).filter((c) => c.ruler === b);
  for (const ca of citiesA) {
    for (const cb of citiesB) {
      if (areCitiesRoadAdjacent(ca.id, cb.id)) return true;
    }
  }
  return false;
}

export function isBorderCity(state: GameState, cityId: number): boolean {
  const city = state.cities[cityId];
  if (!city || city.ruler == null) return false;
  const owner = city.ruler;
  return Object.values(state.cities).some(
    (other) =>
      other.id !== cityId &&
      other.ruler != null &&
      other.ruler !== owner &&
      areCitiesRoadAdjacent(cityId, other.id),
  );
}

export function weakestHostileCityId(
  state: GameState,
  attackerFactionId: number,
): number | null {
  let best: { id: number; troops: number } | null = null;
  for (const city of Object.values(state.cities)) {
    if (city.ruler == null || city.ruler === attackerFactionId) continue;
    if (!best || city.troops < best.troops || (city.troops === best.troops && city.id < best.id)) {
      best = { id: city.id, troops: city.troops };
    }
  }
  return best?.id ?? null;
}

export function playFoolTroopMul(state: GameState, cityId: number): number {
  const ruler = state.cities[cityId]?.ruler;
  if (ruler == null) return 1;
  return factionHasActivePolicy(state, ruler, PolicyType.PLAY_FOOL)
    ? POLICY_PLAY_FOOL_TROOP_MUL
    : 1;
}

export function isScorchedCity(state: GameState, cityId: number): boolean {
  const stamp = monthStamp(state.currentYear, state.currentMonth);
  return (state.nationalPolicies ?? []).some(
    (p) =>
      p.active &&
      p.type === PolicyType.SCORCHED_EARTH &&
      p.targetCityId === cityId &&
      (p.scorchedUntilStamp == null || stamp <= p.scorchedUntilStamp),
  );
}

export function guestHostOccupiedAllyCities(
  state: GameState,
  factionId: number,
): number[] {
  const ids: number[] = [];
  for (const army of state.campaignArmies) {
    if (army.factionId !== factionId) continue;
    if (army.phase === 'retreating') continue;
    const city = state.cities[army.currentNodeId];
    if (!city || city.ruler == null || city.ruler === factionId) continue;
    const link = state.diplomacy.find(
      (l) =>
        (l.factionA === factionId && l.factionB === city.ruler) ||
        (l.factionA === city.ruler && l.factionB === factionId),
    );
    const rel = link?.relation as string | undefined;
    if (rel !== DipRelation.ALLIED && rel !== 'allied') continue;
    if (!ids.includes(city.id)) ids.push(city.id);
  }
  return ids;
}
