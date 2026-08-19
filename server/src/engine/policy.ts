// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S17 L3 国策态势（docs/04 §31.6 · Session 348）
 * 一次一策；切换立即结束旧策，新策下月生效；冷却 6 月。无成功率/识破。
 */
import {
  PolicyType,
  POLICY_BEFRIEND_FAR_DELTA,
  POLICY_BEFRIEND_NEAR_DELTA,
  POLICY_COOLDOWN_MONTHS,
  POLICY_GUEST_HOST_FAVOR_DELTA,
  POLICY_GUEST_HOST_SHARE,
  POLICY_LABELS,
  ALL_POLICY_TYPES,
  POLICY_PLAY_FOOL_AI_ATTACK_MUL,
  POLICY_SCORCHED_MONTHS,
  factionsShareBorder,
  factionHasActivePolicy,
  getActivePolicyType,
  guestHostOccupiedAllyCities,
  isBorderCity,
  monthStamp,
  policySwitchCooldown,
  type GameState,
  type NationalPolicy,
} from '@leh/shared';
import { upsertDipFavor } from './spy.js';

function pushLog(state: GameState, type: string, message: string, patch: Partial<GameState> = {}): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function nextPolicyId(state: GameState): string {
  const n = (state.nationalPolicies ?? []).length + 1;
  return `policy-${state.currentYear}-${state.currentMonth}-${n}`;
}

export function setNationalPolicy(
  state: GameState,
  type: PolicyType,
  opts?: { factionId?: number; targetCityId?: number },
): GameState {
  const factionId = opts?.factionId ?? state.playerFactionId;
  const faction = state.factions[factionId];
  if (!faction?.isAlive) throw new Error('势力不存在或已灭亡');
  if (!ALL_POLICY_TYPES.includes(type)) throw new Error('未知国策');
  if (policySwitchCooldown(state, factionId) > 0) {
    throw new Error(`国策冷却中（剩余 ${policySwitchCooldown(state, factionId)} 月）`);
  }
  const current = getActivePolicyType(state, factionId);
  if (current === type) throw new Error('已是当前国策');

  let targetCityId = opts?.targetCityId;
  if (type === PolicyType.SCORCHED_EARTH) {
    if (targetCityId == null) throw new Error('坚壁清野须指定边境城');
    const city = state.cities[targetCityId];
    if (!city || city.ruler !== factionId) throw new Error('坚壁清野只能指定己方城');
    if (!isBorderCity(state, targetCityId)) throw new Error('坚壁清野须指定与邻势力接壤的边境城');
  } else if (targetCityId != null) {
    throw new Error('该国策不能指定城市');
  }

  const pending: NationalPolicy = {
    id: nextPolicyId(state),
    type,
    factionId,
    active: false,
    sinceYear: state.currentYear,
    sinceMonth: state.currentMonth,
    cooldown: POLICY_COOLDOWN_MONTHS,
    ...(type === PolicyType.SCORCHED_EARTH ? { targetCityId } : {}),
  };

  const others = (state.nationalPolicies ?? []).filter((p) => p.factionId !== factionId);
  const label = POLICY_LABELS[type];
  const ended = current ? `（原「${POLICY_LABELS[current]}」立即结束）` : '';
  return pushLog(state, 'policy_set', `改行国策「${label}」，下月生效${ended}`, {
    nationalPolicies: [...others, pending],
  });
}

export function tickNationalPolicies(state: GameState, isQuarterStart: boolean): GameState {
  let diplomacy = state.diplomacy;
  const cities = { ...state.cities };
  const factions = { ...state.factions };
  const notes: string[] = [];
  const nextPolicies: NationalPolicy[] = [];

  for (const policy of state.nationalPolicies ?? []) {
    const cooldown = Math.max(0, policy.cooldown - 1);
    let next: NationalPolicy = { ...policy, cooldown };
    if (!policy.active) {
      next = {
        ...next,
        active: true,
        sinceYear: state.currentYear,
        sinceMonth: state.currentMonth,
      };
      if (next.type === PolicyType.SCORCHED_EARTH && next.targetCityId != null) {
        const city = cities[next.targetCityId];
        if (city) {
          cities[next.targetCityId] = { ...city, food: 0 };
          next = {
            ...next,
            scorchedUntilStamp: monthStamp(state.currentYear, state.currentMonth) + POLICY_SCORCHED_MONTHS,
          };
          notes.push(`${city.name} 坚壁清野：粮库清零，一年内农产停`);
        }
      }
      notes.push(`${factions[next.factionId]?.name ?? '势力'} 国策「${POLICY_LABELS[next.type]}」生效`);
    }

    if (next.active && next.type === PolicyType.BEFRIEND_FAR) {
      for (const other of Object.values(factions)) {
        if (!other.isAlive || other.id === next.factionId) continue;
        const delta = factionsShareBorder(state, next.factionId, other.id)
          ? POLICY_BEFRIEND_NEAR_DELTA
          : POLICY_BEFRIEND_FAR_DELTA;
        diplomacy = upsertDipFavor(
          { ...state, diplomacy, cities, factions },
          next.factionId,
          other.id,
          delta,
        );
      }
    }

    if (next.active && next.type === PolicyType.GUEST_HOST) {
      const occupied = guestHostOccupiedAllyCities({ ...state, cities, diplomacy }, next.factionId);
      const allyIds = new Set<number>();
      for (const cityId of occupied) {
        const ruler = cities[cityId]?.ruler;
        if (ruler != null) allyIds.add(ruler);
      }
      for (const allyId of allyIds) {
        diplomacy = upsertDipFavor(
          { ...state, diplomacy, cities, factions },
          next.factionId,
          allyId,
          POLICY_GUEST_HOST_FAVOR_DELTA,
        );
      }
      if (isQuarterStart) {
        const caster = factions[next.factionId];
        if (caster) {
          let goldGain = 0;
          let foodGain = 0;
          for (const cityId of occupied) {
            const city = cities[cityId];
            if (!city) continue;
            const g = Math.floor(city.gold * POLICY_GUEST_HOST_SHARE);
            const f = Math.floor(city.food * POLICY_GUEST_HOST_SHARE);
            cities[cityId] = { ...city, gold: city.gold - g, food: city.food - f };
            goldGain += g;
            foodGain += f;
          }
          if (goldGain > 0 || foodGain > 0) {
            const cap = cities[caster.capitalCityId];
            if (cap) {
              cities[caster.capitalCityId] = {
                ...cap,
                gold: cap.gold + goldGain,
                food: cap.food + foodGain,
              };
            }
            notes.push(`反客为主：取盟友城金${goldGain}、粮${foodGain}`);
          }
        }
      }
    }

    if (next.active && next.type === PolicyType.HIGH_WALLS) {
      for (const city of Object.values(cities)) {
        if (city.ruler !== next.factionId) continue;
        cities[city.id] = {
          ...city,
          troopsMorale: Math.max(0, (city.troopsMorale ?? 70) - 1),
        };
      }
    }

    nextPolicies.push(next);
  }

  let out: GameState = {
    ...state,
    diplomacy,
    cities,
    factions,
    nationalPolicies: nextPolicies,
  };
  for (const message of notes) {
    out = pushLog(out, 'policy_tick', message);
  }
  return out;
}

export function getPolicyAttackModifier(
  state: GameState,
  cityId: number,
  _attackerFactionId: number,
): number {
  const ruler = state.cities[cityId]?.ruler;
  if (ruler == null) return 1;
  return factionHasActivePolicy(state, ruler, PolicyType.PLAY_FOOL)
    ? POLICY_PLAY_FOOL_AI_ATTACK_MUL
    : 1;
}
