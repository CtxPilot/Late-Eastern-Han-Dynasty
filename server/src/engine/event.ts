// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 事件引擎 — 回合末检查 conditions
 * - 有 autoChoice → 自动执行并 completed
 * - 无 autoChoice → 入 pendingEvents，等玩家 POST /event/choose
 */
import {
  DipRelation,
  OfficerStatus,
  type EventCondition,
  type EventEffect,
  type GameState,
} from '@leh/shared';
import { getStaticData } from '../data/loader.js';

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<GameState> = {},
): GameState {
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

function checkCondition(state: GameState, cond: EventCondition): boolean {
  switch (cond.type) {
    case 'year': {
      const year = state.currentYear;
      switch (cond.operator) {
        case 'equals':
          return year === (cond.value as number);
        case 'gte':
          return year >= (cond.value as number);
        case 'lte':
          return year <= (cond.value as number);
        default:
          return false;
      }
    }
    case 'officer': {
      const officers = Object.values(state.officers);
      switch (cond.operator) {
        case 'equals': {
          if (cond.field === 'faction') {
            return officers.some((o) => o.faction === (cond.value as number));
          }
          return false;
        }
        case 'in': {
          if (cond.field === 'officerId') {
            const ids = cond.value as number[];
            return officers.some((o) => ids.includes(o.id) && o.status === OfficerStatus.FREE);
          }
          return false;
        }
        default:
          return false;
      }
    }
    case 'city': {
      const cities = Object.values(state.cities);
      switch (cond.operator) {
        case 'equals': {
          if (cond.field === 'controllerId') {
            return cities.some((c) => c.ruler === (cond.value as number));
          }
          return false;
        }
        default:
          return false;
      }
    }
    case 'faction': {
      const factions = Object.values(state.factions);
      switch (cond.operator) {
        case 'equals': {
          if (cond.field === 'rulerId') {
            return factions.some((f) => f.rulerId === (cond.value as number) && f.isAlive);
          }
          return false;
        }
        default:
          return false;
      }
    }
    default:
      return false;
  }
}

function applyEffect(state: GameState, effect: EventEffect): GameState {
  let cities = { ...state.cities };
  let officers = { ...state.officers };
  let factions = { ...state.factions };
  let diplomacy = [...state.diplomacy];

  switch (effect.type) {
    case 'recruit': {
      if (effect.target === 'officer' && effect.targetId != null) {
        const o = officers[effect.targetId];
        if (o && o.status === OfficerStatus.FREE) {
          officers[effect.targetId] = {
            ...o,
            faction: effect.value as number,
            status: OfficerStatus.ACTIVE,
            loyalty: 80,
          };
          const f = factions[effect.value as number];
          if (f && !f.officerIds.includes(effect.targetId)) {
            factions[effect.value as number] = {
              ...f,
              officerIds: [...f.officerIds, effect.targetId],
            };
          }
        }
      }
      break;
    }
    case 'loyalty': {
      if (effect.target === 'officer' && effect.targetId != null) {
        const o = officers[effect.targetId];
        if (o) {
          officers[effect.targetId] = {
            ...o,
            loyalty: Math.min(100, Math.max(0, (o.loyalty ?? 50) + (effect.value as number))),
          };
        }
      }
      break;
    }
    case 'develop': {
      if (effect.target === 'city' && effect.targetId != null) {
        const c = cities[effect.targetId];
        if (c) {
          cities[effect.targetId] = {
            ...c,
            stats: {
              ...c.stats,
              farm: Math.min(999, c.stats.farm + (effect.value as number)),
            },
          };
        }
      }
      break;
    }
    case 'relation': {
      if (effect.target === 'global') {
        diplomacy = diplomacy.map((d) => ({
          ...d,
          favorability: Math.min(100, Math.max(-100, d.favorability + (effect.value as number))),
        }));
      }
      break;
    }
    case 'war': {
      if (effect.target === 'faction' && effect.targetId != null) {
        // B18: 若目标势力就是玩家自身，则跳过（避免自环外交）
        if (effect.targetId === state.playerFactionId) break;
        const a = Math.min(state.playerFactionId, effect.targetId);
        const b = Math.max(state.playerFactionId, effect.targetId);
        const idx = diplomacy.findIndex(
          (d) =>
            (d.factionA === a && d.factionB === b) ||
            (d.factionA === b && d.factionB === a),
        );
        if (idx >= 0) {
          diplomacy[idx] = { ...diplomacy[idx], relation: DipRelation.WAR };
        } else {
          diplomacy.push({
            factionA: a,
            factionB: b,
            relation: DipRelation.WAR,
            favorability: -50,
          });
        }
      }
      break;
    }
    default:
      break;
  }

  return { ...state, cities, officers, factions, diplomacy };
}

/**
 * 回合结算：autoChoice 自动结算；否则入 pending 等 UI 抉择
 */
export function tickEvents(state: GameState): GameState {
  const events = getStaticData().events;
  let s = state;
  const completed = new Set(s.completedEvents ?? []);
  const pending = new Set(s.pendingEvents ?? []);

  for (const evt of events) {
    if (completed.has(evt.id) || pending.has(evt.id)) continue;

    const allMet = evt.conditions.every((c) => checkCondition(s, c));
    if (!allMet) continue;

    if (evt.autoChoice != null && evt.choices[evt.autoChoice]) {
      const choice = evt.choices[evt.autoChoice];
      for (const effect of choice.effects) {
        s = applyEffect(s, effect);
      }
      s = pushLog(s, 'event', `【事件】${evt.name}：${choice.label}`);
      completed.add(evt.id);
    } else if (evt.choices.length > 0) {
      pending.add(evt.id);
      s = pushLog(s, 'event_pending', `【事件】${evt.name} 触发，请抉择`);
    } else {
      s = pushLog(s, 'event', `【事件】${evt.name}`);
      completed.add(evt.id);
    }
  }

  return {
    ...s,
    completedEvents: [...completed],
    pendingEvents: [...pending],
  };
}

/**
 * 玩家选择事件选项 → 应用效果并移出 pending
 */
export function resolveEventChoice(
  state: GameState,
  eventId: number,
  choiceIndex: number,
): GameState {
  const pending = state.pendingEvents ?? [];
  if (!pending.includes(eventId)) {
    throw new Error('该事件不在待决队列');
  }

  const evt = getStaticData().events.find((e) => e.id === eventId);
  if (!evt) throw new Error('事件不存在');

  const choice = evt.choices[choiceIndex];
  if (!choice) throw new Error('选项无效');

  let s = state;
  for (const effect of choice.effects) {
    s = applyEffect(s, effect);
  }
  s = pushLog(s, 'event', `【事件】${evt.name}：${choice.label}`);

  const completed = new Set(s.completedEvents ?? []);
  completed.add(eventId);

  return {
    ...s,
    pendingEvents: pending.filter((id) => id !== eventId),
    completedEvents: [...completed],
  };
}
