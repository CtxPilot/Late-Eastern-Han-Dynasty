// SPDX-License-Identifier: MIT

import { Personality } from './enums/index.js';
import type { Officer } from './types/officer.js';

export type RelationType = 'sworn' | 'master_disciple' | 'parent_child' | 'siblings' | 'spouse' | 'best_friend' | 'enemy' | 'lord_retainer';
export type RelationSource = 'official' | 'romance';
export type RelationState = 'intimate' | 'friendly' | 'neutral' | 'dislike' | 'hostile';
export type RelationEvent =
  | 'same_city'
  | 'joint_expedition'
  | 'captured'
  | 'rescued'
  | 'married'
  | 'rivalry';

export interface StaticRelation {
  fromId: number;
  toId: number;
  type: RelationType;
  source: RelationSource;
  note?: string;
}

export interface OfficerRelation {
  targetId: number;
  targetName: string;
  type: RelationType;
  source: RelationSource;
  state: RelationState;
  affinity: number;
}

export interface RelationEvolveResult {
  affinities: Record<string, number>;
  /** 亲和度越过状态阈值时的叙事文案（供 actionLog） */
  narratives: string[];
  changed: boolean;
}

const TAG_AFFINITY_RULES: Record<string, { same: number; opposite?: number }> = {
  social: { same: 15 },
  region: { same: 10 },
  politics: { same: 20, opposite: -20 },
  special: { same: 0, opposite: -40 },
};

const STATE_THRESHOLDS: [number, RelationState][] = [
  [80, 'intimate'],
  [40, 'friendly'],
  [-39, 'neutral'],
  [-60, 'dislike'],
  [-Infinity, 'hostile'],
];

const STATE_LABEL: Record<RelationState, string> = {
  intimate: '亲密',
  friendly: '友好',
  neutral: '普通',
  dislike: '嫌恶',
  hostile: '仇敌',
};

const EVENT_DELTA: Record<RelationEvent, number> = {
  same_city: 1,
  joint_expedition: 3,
  captured: -20,
  rescued: 8,
  married: 15,
  rivalry: -5,
};

export function pairAffinity(a: Officer, b: Officer): number {
  const tagScore = computeTagAffinity(a, b);
  const compatScore = computeHiddenCompatibility(a, b);
  return tagScore * 0.4 + compatScore * 0.6;
}

function computeTagAffinity(a: Officer, b: Officer): number {
  let score = 0;
  const aTags = a.tags ?? [];
  const bTags = b.tags ?? [];
  const aSocial = aTags.filter((t) => ['皇室', '汉室宗亲', '外戚', '士族', '将门', '豪族', '寒门', '平民', '商贾', '医家', '隐士', '技术匠人'].includes(t));
  const bSocial = bTags.filter((t) => ['皇室', '汉室宗亲', '外戚', '士族', '将门', '豪族', '寒门', '平民', '商贾', '医家', '隐士', '技术匠人'].includes(t));
  if (aSocial.some((t) => bSocial.includes(t))) score += TAG_AFFINITY_RULES.social.same;
  const regions = ['司隶', '豫州', '兖州', '徐州', '青州', '冀州', '并州', '幽州', '凉州', '荆州', '扬州', '益州', '交州', '南中'];
  const aRegion = aTags.find((t) => regions.includes(t));
  const bRegion = bTags.find((t) => regions.includes(t));
  if (aRegion && bRegion && aRegion === bRegion) score += TAG_AFFINITY_RULES.region.same;
  const politics = ['匡扶汉室', '篡汉自立', '割据自守', '择木而栖', '名利之徒', '苟全性命', '汉室忠臣', '隐逸山林'];
  const aPol = aTags.find((t) => politics.includes(t));
  const bPol = bTags.find((t) => politics.includes(t));
  if (aPol && bPol) {
    if (aPol === bPol) score += TAG_AFFINITY_RULES.politics.same;
    else if (isOpposingPolitics(aPol, bPol)) score += (TAG_AFFINITY_RULES.politics.opposite ?? -20);
  }
  if (aTags.includes('弑主') || bTags.includes('弑主')) score += (TAG_AFFINITY_RULES.special.opposite ?? -40);
  return score;
}

function isOpposingPolitics(a: string, b: string): boolean {
  const opposing: Record<string, string[]> = {
    '匡扶汉室': ['篡汉自立', '割据自守'],
    '篡汉自立': ['匡扶汉室', '汉室忠臣'],
    '汉室忠臣': ['篡汉自立', '割据自守'],
    '割据自守': ['匡扶汉室'],
  };
  return (opposing[a] ?? []).includes(b);
}

function computeHiddenCompatibility(a: Officer, b: Officer): number {
  const diff = Math.abs((a.hidden?.compatibility ?? 50) - (b.hidden?.compatibility ?? 50));
  return (1 - diff / 150) * 100;
}

export function relationState(affinity: number): RelationState {
  for (const [threshold, state] of STATE_THRESHOLDS) {
    if (affinity >= threshold) return state;
  }
  return 'hostile';
}

export function relationStateLabel(state: RelationState): string {
  return STATE_LABEL[state];
}

/** 稳定配对键（小 id 在前），用于运行时亲和度表 */
export function relationPairKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

/**
 * 解析当前亲和度：有运行时覆写则用之，否则回退 pairAffinity 基线。
 */
export function resolveAffinity(
  a: Officer,
  b: Officer,
  runtime?: Record<string, number> | null,
): number {
  const key = relationPairKey(a.id, b.id);
  const stored = runtime?.[key];
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    return Math.max(-100, Math.min(100, stored));
  }
  return pairAffinity(a, b);
}

/**
 * 性格对演变幅度修正（04 §4.4）：
 * 温和：正向×1.3 / 负向×0.7；慎重：双向×0.5；其余 1.0。
 * 取双方修正的算术平均。
 */
export function personalityAffinityModifier(
  a: Officer,
  b: Officer,
  positive: boolean,
): number {
  return (
    singlePersonalityMod(a.hidden?.personality, positive) +
    singlePersonalityMod(b.hidden?.personality, positive)
  ) / 2;
}

function singlePersonalityMod(personality: Personality | string | undefined, positive: boolean): number {
  if (personality === Personality.GENTLE || personality === 'gentle') {
    return positive ? 1.3 : 0.7;
  }
  if (personality === Personality.CAUTIOUS || personality === 'cautious') {
    return 0.5;
  }
  return 1;
}

export function evolveAffinity(base: number, event: string, personalityModifier: number = 1): number {
  const delta = (EVENT_DELTA[event as RelationEvent] ?? 0) * personalityModifier;
  return Math.max(-100, Math.min(100, base + delta));
}

/**
 * 对一对武将施加关系事件，写回运行时亲和度表；状态越界时产出叙事文案。
 */
export function applyRelationEvent(
  affinities: Record<string, number> | undefined,
  a: Officer,
  b: Officer,
  event: RelationEvent,
): RelationEvolveResult {
  if (a.id === b.id) {
    return { affinities: { ...(affinities ?? {}) }, narratives: [], changed: false };
  }
  const key = relationPairKey(a.id, b.id);
  const prev = resolveAffinity(a, b, affinities);
  const positive = (EVENT_DELTA[event] ?? 0) >= 0;
  const mod = personalityAffinityModifier(a, b, positive);
  const next = evolveAffinity(prev, event, mod);
  if (next === prev) {
    return { affinities: { ...(affinities ?? {}) }, narratives: [], changed: false };
  }
  const out = { ...(affinities ?? {}), [key]: next };
  const beforeState = relationState(prev);
  const afterState = relationState(next);
  const narratives: string[] = [];
  if (beforeState !== afterState) {
    narratives.push(
      `${a.name}与${b.name}关系由「${STATE_LABEL[beforeState]}」转为「${STATE_LABEL[afterState]}」（亲和 ${Math.round(prev)}→${Math.round(next)}）`,
    );
  }
  return { affinities: out, narratives, changed: true };
}

/**
 * 对一组武将两两施加同一事件（出征同袍、同城等）。
 */
export function applyRelationEventAmong(
  affinities: Record<string, number> | undefined,
  officers: Officer[],
  event: RelationEvent,
): RelationEvolveResult {
  let current = { ...(affinities ?? {}) };
  const narratives: string[] = [];
  let changed = false;
  for (let i = 0; i < officers.length; i++) {
    for (let j = i + 1; j < officers.length; j++) {
      const result = applyRelationEvent(current, officers[i], officers[j], event);
      current = result.affinities;
      if (result.changed) changed = true;
      for (const line of result.narratives) narratives.push(line);
    }
  }
  return { affinities: current, narratives, changed };
}

export function skillPointsForMerit(meritLevel: number): number {
  let total = 0;
  for (let lv = 1; lv <= meritLevel; lv++) {
    if (lv <= 5) total += 1;
    else if (lv <= 10) total += 2;
    else if (lv <= 15) total += 3;
    else total += 4;
  }
  return total;
}

export function traitPointsForMerit(meritLevel: number): number {
  return Math.floor(meritLevel / 5);
}
