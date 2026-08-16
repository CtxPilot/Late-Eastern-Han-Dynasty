// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S24 关系网动态演变（Session 338）
 * - 季度同城：relations.json 中同城配对施加 same_city
 * - 出征同袍：编成军中武将两两 joint_expedition
 * - 被俘：俘虏 ↔ 俘获方主将 captured
 * - 联姻：丈夫与同势力静态 spouse/sworn 对象 married
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  applyRelationEvent,
  applyRelationEventAmong,
  type GameState,
  type Officer,
  type StaticRelation,
} from '@leh/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _staticRelations: StaticRelation[] | null = null;

export function loadStaticRelations(): StaticRelation[] {
  if (_staticRelations) return _staticRelations;
  const raw = JSON.parse(readFileSync(join(__dirname, '../data/relations.json'), 'utf-8'));
  _staticRelations = raw.relations ?? raw;
  return _staticRelations!;
}

/** 测试钩子：注入静态关系表 */
export function setStaticRelationsForTest(relations: StaticRelation[] | null): void {
  _staticRelations = relations;
}

function pushRelationLog(
  state: GameState,
  narratives: string[],
): GameState {
  if (narratives.length === 0) return state;
  const entries = narratives.slice(0, 6).map((message) => ({
    year: state.currentYear,
    month: state.currentMonth,
    type: 'relation',
    message,
  }));
  return {
    ...state,
    actionLog: [...entries, ...state.actionLog].slice(0, 80),
  };
}

/** 季度同城：仅处理静态关系表中的配对，避免全势力 O(n²)。 */
export function tickSameCityRelations(
  state: GameState,
  staticRelations: StaticRelation[],
): GameState {
  let affinities = { ...(state.relationAffinities ?? {}) };
  const narratives: string[] = [];
  let changed = false;

  for (const rel of staticRelations) {
    const a = state.officers[rel.fromId];
    const b = state.officers[rel.toId];
    if (!a || !b) continue;
    if (a.status === 'dead' || b.status === 'dead') continue;
    if (a.location == null || b.location == null) continue;
    if (a.location !== b.location) continue;
    // 敌对关系同城不施加正向同城加成
    if (rel.type === 'enemy') continue;
    const result = applyRelationEvent(affinities, a, b, 'same_city');
    affinities = result.affinities;
    if (result.changed) changed = true;
    for (const line of result.narratives) narratives.push(line);
  }

  if (!changed) return state;
  return pushRelationLog({ ...state, relationAffinities: affinities }, narratives);
}

/** 出征编成：主将/副将/参谋两两 +3 */
export function applyJointExpeditionRelations(
  state: GameState,
  officerIds: number[],
): GameState {
  const officers: Officer[] = [];
  for (const id of officerIds) {
    const o = state.officers[id];
    if (o && o.status !== 'dead') officers.push(o);
  }
  if (officers.length < 2) return state;
  const result = applyRelationEventAmong(state.relationAffinities, officers, 'joint_expedition');
  if (!result.changed) return state;
  return pushRelationLog(
    { ...state, relationAffinities: result.affinities },
    result.narratives,
  );
}

/** 被俘：俘虏与俘获方主将亲和 −20（性格修正） */
export function applyCapturedRelations(
  state: GameState,
  captiveIds: number[],
  captorCommanderId: number,
): GameState {
  const captor = state.officers[captorCommanderId];
  if (!captor) return state;
  let affinities = { ...(state.relationAffinities ?? {}) };
  const narratives: string[] = [];
  let changed = false;
  for (const id of captiveIds) {
    const captive = state.officers[id];
    if (!captive || captive.id === captor.id) continue;
    const result = applyRelationEvent(affinities, captive, captor, 'captured');
    affinities = result.affinities;
    if (result.changed) changed = true;
    for (const line of result.narratives) narratives.push(line);
  }
  if (!changed) return state;
  return pushRelationLog({ ...state, relationAffinities: affinities }, narratives);
}

/**
 * 救援获释：获释者与解救主将 +8。
 * 0-A：登用/释放战俘时由人事入口调用。
 */
export function applyRescuedRelations(
  state: GameState,
  rescuedId: number,
  rescuerId: number,
): GameState {
  const a = state.officers[rescuedId];
  const b = state.officers[rescuerId];
  if (!a || !b || a.id === b.id) return state;
  const result = applyRelationEvent(state.relationAffinities, a, b, 'rescued');
  if (!result.changed) return state;
  return pushRelationLog(
    { ...state, relationAffinities: result.affinities },
    result.narratives,
  );
}

/**
 * 联姻叙事：丈夫与同势力中静态 spouse / sworn 对象 +15（若存在）；
 * 无静态对时仍写一条联姻日志但不改亲和表。
 */
export function applyMarriedRelations(
  state: GameState,
  husbandId: number,
  staticRelations: StaticRelation[],
): GameState {
  const husband = state.officers[husbandId];
  if (!husband) return state;
  let affinities = { ...(state.relationAffinities ?? {}) };
  const narratives: string[] = [];
  let changed = false;
  for (const rel of staticRelations) {
    if (rel.type !== 'spouse' && rel.type !== 'sworn') continue;
    const otherId = rel.fromId === husbandId ? rel.toId : rel.toId === husbandId ? rel.fromId : null;
    if (otherId == null) continue;
    const other = state.officers[otherId];
    if (!other || other.faction !== husband.faction) continue;
    const result = applyRelationEvent(affinities, husband, other, 'married');
    affinities = result.affinities;
    if (result.changed) changed = true;
    for (const line of result.narratives) narratives.push(line);
  }
  if (!changed) return state;
  return pushRelationLog({ ...state, relationAffinities: affinities }, narratives);
}
