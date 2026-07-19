// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 事件引擎 — 回合末检查 conditions
 * - 事件仅在当前剧本与启用史料层中生效
 * - 玩家控制决策势力时入 pending；AI 按历史权重、性格与理想确定选择
 */
import {
  DipRelation,
  OfficerStatus,
  type EventCondition,
  type EventChoice,
  type EventEffect,
  type EventTemplate,
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
      const target = cond.targetId == null ? undefined : state.officers[cond.targetId];
      switch (cond.operator) {
        case 'equals': {
          if (cond.field === 'faction') {
            if (cond.targetId != null) return target?.faction === (cond.value as number);
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
      const target = cond.targetId == null ? undefined : state.cities[cond.targetId];
      switch (cond.operator) {
        case 'equals': {
          if (cond.field === 'controllerId') {
            if (cond.targetId != null) return target?.ruler === (cond.value as number);
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
      const target = cond.targetId == null ? undefined : state.factions[cond.targetId];
      switch (cond.operator) {
        case 'equals': {
          if (cond.field === 'rulerId') {
            if (cond.targetId != null) return target?.rulerId === (cond.value as number) && target.isAlive;
            return factions.some((f) => f.rulerId === (cond.value as number) && f.isAlive);
          }
          if (cond.field === 'isAlive' && target) return target.isAlive === (cond.value as boolean);
          return false;
        }
        default:
          return false;
      }
    }
    case 'event': {
      if (cond.field !== 'choice' || cond.targetId == null || cond.operator !== 'equals') return false;
      return state.eventChoices[cond.targetId] === (cond.value as number);
    }
  }
}

function applyEffect(state: GameState, effect: EventEffect, decisionFactionId?: number): GameState {
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
      if (effect.target !== 'faction' || effect.targetId == null || decisionFactionId == null) {
        throw new Error('relation 效果缺少决策势力或目标势力');
      }
      if (effect.targetId === decisionFactionId) break;
      const a = Math.min(decisionFactionId, effect.targetId);
      const b = Math.max(decisionFactionId, effect.targetId);
      const idx = diplomacy.findIndex((d) => d.factionA === a && d.factionB === b);
      if (idx < 0) throw new Error(`relation 效果找不到外交关系 ${a}-${b}`);
      diplomacy[idx] = {
        ...diplomacy[idx],
        favorability: Math.min(100, Math.max(-100, diplomacy[idx].favorability + (effect.value as number))),
      };
      break;
    }
    case 'war': {
      if (effect.target === 'faction' && effect.targetId != null && decisionFactionId != null) {
        if (effect.targetId === decisionFactionId) break;
        const a = Math.min(decisionFactionId, effect.targetId);
        const b = Math.max(decisionFactionId, effect.targetId);
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
    case 'capital': {
      if (effect.target !== 'faction' || effect.targetId == null) {
        throw new Error('capital 效果目标无效');
      }
      const faction = factions[effect.targetId];
      const cityId = effect.value as number;
      if (!faction || !faction.cityIds.includes(cityId)) {
        throw new Error('迁都目标不是该势力控制的城市');
      }
      factions[effect.targetId] = { ...faction, capitalCityId: cityId };
      break;
    }
    case 'troops': {
      if (effect.target !== 'city' || effect.targetId == null) {
        throw new Error('troops 效果目标无效');
      }
      const city = cities[effect.targetId];
      if (!city) throw new Error('troops 效果城市不存在');
      cities[effect.targetId] = {
        ...city,
        troops: Math.max(0, city.troops + (effect.value as number)),
      };
      break;
    }
    case 'gold': {
      if (effect.target === 'city' && effect.targetId != null && typeof effect.value === 'number') {
        const city = cities[effect.targetId];
        if (city) {
          cities = { ...cities, [effect.targetId]: { ...city, gold: city.gold + effect.value } };
        }
      }
      break;
    }
    case 'food': {
      if (effect.target === 'city' && effect.targetId != null && typeof effect.value === 'number') {
        const city = cities[effect.targetId];
        if (city) {
          cities = { ...cities, [effect.targetId]: { ...city, food: city.food + effect.value } };
        }
      }
      break;
    }
    case 'population': {
      if (effect.target === 'city' && effect.targetId != null && typeof effect.value === 'number') {
        const city = cities[effect.targetId];
        if (city) {
          cities = { ...cities, [effect.targetId]: { ...city, population: city.population + effect.value } };
        }
      }
      break;
    }
    default:
      throw new Error(`未实现的事件效果：${effect.type}`);
  }

  return { ...state, cities, officers, factions, diplomacy };
}

function dateIndex(year: number, month: number): number {
  return year * 12 + month - 1;
}

function isBeforeWindow(state: GameState, event: EventTemplate): boolean {
  return dateIndex(state.currentYear, state.currentMonth) < dateIndex(event.dateWindow.startYear, event.dateWindow.startMonth);
}

function isAfterWindow(state: GameState, event: EventTemplate): boolean {
  return dateIndex(state.currentYear, state.currentMonth) > dateIndex(event.dateWindow.endYear, event.dateWindow.endMonth);
}

function chooseForAi(state: GameState, event: EventTemplate): number {
  const decidingFactionId = resolveDecisionFaction(state, event);
  const faction = decidingFactionId == null ? undefined : state.factions[decidingFactionId];
  const ruler = faction ? state.officers[faction.rulerId] : undefined;
  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;
  event.choices.forEach((choice: EventChoice, index: number) => {
    const personality = ruler?.hidden.personality;
    const ideal = ruler?.hidden.ideal;
    const score = (choice.aiWeight ?? 0)
      + (personality ? choice.aiPersonalityWeights?.[personality] ?? 0 : 0)
      + (ideal ? choice.aiIdealWeights?.[ideal] ?? 0 : 0);
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestIndex;
}

function applyChoice(state: GameState, event: EventTemplate, choiceIndex: number): GameState {
  const choice = event.choices[choiceIndex];
  if (!choice) throw new Error(`事件「${event.name}」选项无效`);
  let next = state;
  const decidingFaction = resolveDecisionFaction(state, event);
  for (const effect of choice.effects) {
    next = applyEffect(next, effect, decidingFaction);
  }
  return pushLog(next, 'event', `【事件】${event.name}：${choice.label}`);
}

function getScenarioEvents(state: GameState, templates = getStaticData().events): EventTemplate[] {
  const scenario = getStaticData().scenarios.find((item) => item.id === state.scenarioId);
  if (!scenario) throw new Error('当前剧本不存在');
  const eventIds = new Set(scenario.eventIds);
  const layers = new Set(state.enabledEventLayers);
  return templates.filter(
    (event) => eventIds.has(event.id) && event.scenarioIds.includes(state.scenarioId) && layers.has(event.sourceClass),
  );
}

/**
 * 解析事件的决策势力：优先 decisionOfficerId（动态），fallback decisionFactionId（静态）
 */
function resolveDecisionFaction(state: GameState, evt: EventTemplate): number | undefined {
  if (evt.decisionOfficerId != null) {
    const officer = state.officers[evt.decisionOfficerId];
    if (officer?.faction != null) return officer.faction;
  }
  return evt.decisionFactionId;
}

/**
 * 回合结算：autoChoice 自动结算；否则入 pending 等 UI 抉择
 */
export function tickEvents(state: GameState, templates?: EventTemplate[]): GameState {
  const events = getScenarioEvents(state, templates);
  let s = state;
  const completed = new Set(s.completedEvents ?? []);
  const pending = new Set(s.pendingEvents ?? []);
  const invalidated = new Set(s.invalidatedEvents ?? []);
  const eventChoices = { ...(s.eventChoices ?? {}) };

  for (const evt of events) {
    if (completed.has(evt.id) || pending.has(evt.id) || invalidated.has(evt.id)) continue;
    if (isBeforeWindow(s, evt)) continue;
    if (isAfterWindow(s, evt)) {
      invalidated.add(evt.id);
      continue;
    }
    if (evt.prerequisiteEventIds?.some((id) => !completed.has(id))) continue;
    if (evt.mutexGroup && events.some((other) => other.id !== evt.id && other.mutexGroup === evt.mutexGroup && completed.has(other.id))) {
      invalidated.add(evt.id);
      continue;
    }
    const decidingFaction = resolveDecisionFaction(s, evt);
    if (decidingFaction != null && !s.factions[decidingFaction]?.isAlive) {
      invalidated.add(evt.id);
      continue;
    }

    const allMet = evt.conditions.every((c) => checkCondition(s, c));
    if (!allMet) continue;

    if (evt.choices.length === 0) {
      s = pushLog(s, 'event', `【事件】${evt.name}`);
      completed.add(evt.id);
      continue;
    }

    const playerDecides = decidingFaction == null || decidingFaction === s.playerFactionId;
    if (evt.autoChoice == null && playerDecides) {
      pending.add(evt.id);
      s = pushLog(s, 'event_pending', `【事件】${evt.name} 触发，请抉择`);
    } else {
      const choiceIndex = evt.autoChoice ?? chooseForAi(s, evt);
      s = applyChoice(s, evt, choiceIndex);
      completed.add(evt.id);
      eventChoices[evt.id] = choiceIndex;
      s = { ...s, eventChoices: { ...eventChoices } };
    }
  }

  return {
    ...s,
    completedEvents: [...completed],
    pendingEvents: [...pending],
    invalidatedEvents: [...invalidated],
    eventChoices,
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
  if (pending[0] !== eventId) throw new Error('只能处理待决队列中的首个事件');

  const evt = getScenarioEvents(state).find((e) => e.id === eventId);
  if (!evt) throw new Error('事件不存在');
  const decidingFaction = resolveDecisionFaction(state, evt);
  if (decidingFaction != null && decidingFaction !== state.playerFactionId) {
    throw new Error('该事件不由玩家势力决策');
  }
  if (isAfterWindow(state, evt)) throw new Error('该事件已经失效');

  const choice = evt.choices[choiceIndex];
  if (!choice) throw new Error('选项无效');

  const s = applyChoice(state, evt, choiceIndex);

  const completed = new Set(s.completedEvents ?? []);
  completed.add(eventId);

  return {
    ...s,
    pendingEvents: pending.filter((id) => id !== eventId),
    completedEvents: [...completed],
    eventChoices: { ...s.eventChoices, [eventId]: choiceIndex },
  };
}
