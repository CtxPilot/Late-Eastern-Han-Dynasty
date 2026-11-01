// SPDX-License-Identifier: MIT

import { z } from 'zod';
import { Personality } from './enums/index.js';
import type { Officer } from './types/officer.js';
import type { GameState } from './types/game.js';

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

export interface RuntimeRelation {
  fromId: number;
  toId: number;
  type: RelationType;
  source?: RelationSource;
  establishedYear?: number;
  establishedMonth?: number;
  /** 师徒授业点拨最近一次成长年份（每年每对最多 1 点）。 */
  lastGrowthYear?: number;
  note?: string;
}

export type AnyRelation = StaticRelation | RuntimeRelation;

export function isSwornBrothers(
  aId: number,
  bId: number,
  allRelations: readonly AnyRelation[],
): boolean {
  if (aId === bId) return false;
  return allRelations.some(
    (r) =>
      r.type === 'sworn' &&
      ((r.fromId === aId && r.toId === bId) || (r.fromId === bId && r.toId === aId)),
  );
}

export function isMasterAndDisciple(
  masterId: number,
  discipleId: number,
  allRelations: readonly AnyRelation[],
): boolean {
  if (masterId === discipleId) return false;
  return allRelations.some(
    (r) => r.type === 'master_disciple' && r.fromId === masterId && r.toId === discipleId,
  );
}

export function isNemesisPair(
  aId: number,
  bId: number,
  allRelations: readonly AnyRelation[],
): boolean {
  if (aId === bId) return false;
  return allRelations.some(
    (r) =>
      r.type === 'enemy' &&
      ((r.fromId === aId && r.toId === bId) || (r.fromId === bId && r.toId === aId)),
  );
}

export function getRelatedOfficerIds(
  officerId: number,
  type: RelationType,
  allRelations: readonly AnyRelation[],
): number[] {
  const ids = new Set<number>();
  for (const r of allRelations) {
    if (r.type !== type) continue;
    if (r.fromId === officerId) ids.add(r.toId);
    else if (r.toId === officerId) ids.add(r.fromId);
  }
  return Array.from(ids);
}

// ---------------------------------------------------------------------------
// S24 关系网深度（Session 454，docs/52）：运行时关系缔结、战斗羁绊与血仇
// ---------------------------------------------------------------------------

export const RuntimeRelationSchema: z.ZodType<RuntimeRelation> = z
  .object({
    fromId: z.number().int().positive(),
    toId: z.number().int().positive(),
    type: z.enum([
      'sworn',
      'master_disciple',
      'parent_child',
      'siblings',
      'spouse',
      'best_friend',
      'enemy',
      'lord_retainer',
    ]),
    source: z.enum(['official', 'romance']).optional(),
    establishedYear: z.number().int().optional(),
    establishedMonth: z.number().int().min(1).max(12).optional(),
    lastGrowthYear: z.number().int().optional(),
    note: z.string().optional(),
  })
  .strict();

/** 义结金兰：亲和门槛 / 每人结义上限 / 置办费用（docs/52 §1.1） */
export const SWORN_MIN_AFFINITY = 80;
export const SWORN_MAX_BROTHERS = 2;
export const SWORN_GOLD = 200;
export const SWORN_AFFINITY_LOCK = 100;

/** 拜师授业：门槛 / 束脩 / 收徒上限 / 师徒亲和（docs/52 §3.1） */
export const MENTOR_MIN_AFFINITY = 40;
export const MENTOR_MIN_TOP_STAT = 75;
export const MENTOR_MIN_GAP = 10;
export const MENTOR_MAX_DISCIPLES = 2;
export const MENTOR_GOLD = 100;
export const MENTOR_AFFINITY_LOCK = 90;

/** 宿敌血仇：亲和底线与同城共处忠诚惩罚（docs/52 §2） */
export const FEUD_AFFINITY = -100;
export const NEMESIS_COEXIST_LOYALTY_DROP = 10;

/** 六角战斗羁绊数值（docs/52 §1.2 / §2.2） */
export const SWORN_BATTLE_DAMAGE_PCT = 5;
export const SWORN_BATTLE_CRIT_BONUS = 5;
export const SWORN_FURY_MORALE_GAIN = 15;
export const SWORN_FURY_MORALE_CAP = 120;
export const SWORN_FURY_DAMAGE_PCT = 10;
export const NEMESIS_BATTLE_CRIT_BONUS = 10;
export const NEMESIS_BATTLE_COUNTER_BONUS = 10;

export type StatKey = 'leadership' | 'war' | 'intelligence' | 'politics' | 'charisma';
export const STAT_KEYS: readonly StatKey[] = [
  'leadership',
  'war',
  'intelligence',
  'politics',
  'charisma',
];

export interface RelationActionCheck {
  ok: boolean;
  reason?: string;
}

function officerAlive(o: Officer | undefined): o is Officer {
  return o != null && o.status !== 'dead';
}

function swornPartnerIds(
  officerId: number,
  allRelations: readonly AnyRelation[],
): number[] {
  return getRelatedOfficerIds(officerId, 'sworn', allRelations).filter((id) => id !== officerId);
}

function discipleIds(
  masterId: number,
  allRelations: readonly AnyRelation[],
): number[] {
  const ids = new Set<number>();
  for (const r of allRelations) {
    if (r.type === 'master_disciple' && r.fromId === masterId) ids.add(r.toId);
  }
  return Array.from(ids);
}

function hasMaster(discipleId: number, allRelations: readonly AnyRelation[]): boolean {
  return allRelations.some((r) => r.type === 'master_disciple' && r.toId === discipleId);
}

/** 玩家可支付城：优先武将所在城（且归玩家），否则任一无足够金则返回 null 由调用方报错。 */
function payCityFor(state: Pick<GameState, 'cities' | 'playerFactionId'>, cityId: number | null, cost: number) {
  if (cityId != null && state.cities[cityId]?.ruler === state.playerFactionId) {
    return state.cities[cityId];
  }
  return Object.values(state.cities).find(
    (c) => c.ruler === state.playerFactionId && c.gold >= cost,
  ) ?? null;
}

/**
 * 义结金兰资格（docs/52 §1.1）：同势力同城在职、非同人、非宿敌、
 * 亲和 ≥80、双方结义数 <2、所在/己方城金 ≥200。
 */
export function checkSwornBrotherhoodEligibility(
  state: Pick<GameState, 'officers' | 'cities' | 'factions' | 'playerFactionId' | 'relationAffinities'>,
  aId: number,
  bId: number,
  allRelations: readonly AnyRelation[],
): RelationActionCheck {
  if (aId === bId) return { ok: false, reason: '不可与自己结义' };
  const a = state.officers[aId];
  const b = state.officers[bId];
  if (!officerAlive(a) || !officerAlive(b)) return { ok: false, reason: '武将不存在或已阵亡' };
  if (a.faction !== state.playerFactionId || b.faction !== state.playerFactionId) {
    return { ok: false, reason: '仅己方武将可义结金兰' };
  }
  if (a.status !== 'active' || b.status !== 'active') return { ok: false, reason: '仅在职武将可结义' };
  if (a.location == null || b.location == null || a.location !== b.location) {
    return { ok: false, reason: '结义双方须同处一城' };
  }
  if (isSwornBrothers(aId, bId, allRelations)) return { ok: false, reason: '二人已是义兄弟' };
  if (isNemesisPair(aId, bId, allRelations)) return { ok: false, reason: '宿敌不可结义' };
  if (swornPartnerIds(aId, allRelations).length >= SWORN_MAX_BROTHERS) {
    return { ok: false, reason: `${a.name}结义已满（上限 ${SWORN_MAX_BROTHERS} 人）` };
  }
  if (swornPartnerIds(bId, allRelations).length >= SWORN_MAX_BROTHERS) {
    return { ok: false, reason: `${b.name}结义已满（上限 ${SWORN_MAX_BROTHERS} 人）` };
  }
  const affinity = resolveAffinity(a, b, state.relationAffinities);
  if (affinity < SWORN_MIN_AFFINITY) {
    return { ok: false, reason: `亲和不足（当前 ${Math.round(affinity)}，需 ≥${SWORN_MIN_AFFINITY}）` };
  }
  const city = payCityFor(state, a.location, SWORN_GOLD);
  if (!city) return { ok: false, reason: `金钱不足（需 ${SWORN_GOLD}）` };
  return { ok: true };
}

/**
 * 拜师授业资格（docs/52 §3.1）：同势力同城在职、师傅最高属性 ≥75 且至少一项
 * 领先徒弟 ≥10、徒弟无师傅、师傅收徒 <2、非宿敌、亲和 ≥40。
 */
export function checkMentorshipEligibility(
  state: Pick<GameState, 'officers' | 'cities' | 'factions' | 'playerFactionId' | 'relationAffinities'>,
  masterId: number,
  discipleId: number,
  allRelations: readonly AnyRelation[],
): RelationActionCheck {
  if (masterId === discipleId) return { ok: false, reason: '不可拜自己为师' };
  const master = state.officers[masterId];
  const disciple = state.officers[discipleId];
  if (!officerAlive(master) || !officerAlive(disciple)) {
    return { ok: false, reason: '武将不存在或已阵亡' };
  }
  if (master.faction !== state.playerFactionId || disciple.faction !== state.playerFactionId) {
    return { ok: false, reason: '仅己方武将可拜师授业' };
  }
  if (master.status !== 'active' || disciple.status !== 'active') {
    return { ok: false, reason: '仅在职武将可拜师' };
  }
  if (master.location == null || master.location !== disciple.location) {
    return { ok: false, reason: '师徒双方须同处一城' };
  }
  if (isMasterAndDisciple(masterId, discipleId, allRelations)) {
    return { ok: false, reason: '二人已是师徒' };
  }
  if (hasMaster(discipleId, allRelations)) return { ok: false, reason: `${disciple.name}已有师傅` };
  if (discipleIds(masterId, allRelations).length >= MENTOR_MAX_DISCIPLES) {
    return { ok: false, reason: `${master.name}收徒已满（上限 ${MENTOR_MAX_DISCIPLES} 人）` };
  }
  if (isNemesisPair(masterId, discipleId, allRelations)) return { ok: false, reason: '宿敌不可拜师' };
  const topStat = Math.max(...STAT_KEYS.map((key) => master.stats[key]));
  if (topStat < MENTOR_MIN_TOP_STAT) {
    return { ok: false, reason: `师傅最高属性不足 ${MENTOR_MIN_TOP_STAT}` };
  }
  const hasGap = STAT_KEYS.some(
    (key) => master.stats[key] - disciple.stats[key] >= MENTOR_MIN_GAP,
  );
  if (!hasGap) return { ok: false, reason: `师傅须至少一项属性领先徒弟 ${MENTOR_MIN_GAP} 点` };
  const affinity = resolveAffinity(master, disciple, state.relationAffinities);
  if (affinity < MENTOR_MIN_AFFINITY) {
    return { ok: false, reason: `亲和不足（当前 ${Math.round(affinity)}，需 ≥${MENTOR_MIN_AFFINITY}）` };
  }
  const city = payCityFor(state, master.location, MENTOR_GOLD);
  if (!city) return { ok: false, reason: `金钱不足（需 ${MENTOR_GOLD}）` };
  return { ok: true };
}

/**
 * 每年正月授业点拨（docs/52 §3.2）：确定性选取师傅领先最多的属性，
 * 在「徒弟属性 < 师傅对应属性 −2」的前提下 +1，每年每对师徒最多 1 点。
 * 零 RNG（原方案「随机一项」改为确定性最大差距项，避免扰动权威 RNG 流）。
 */
export function mentorshipGrowthTarget(
  master: Officer,
  disciple: Officer,
): { stat: StatKey; from: number; to: number } | null {
  let best: StatKey | null = null;
  let bestGap = -Infinity;
  for (const key of STAT_KEYS) {
    const gap = master.stats[key] - disciple.stats[key];
    if (gap < MENTOR_MIN_GAP) continue;
    if (disciple.stats[key] >= master.stats[key] - 2) continue;
    // 严格大于保证并列时按 STAT_KEYS 固定顺序取先者（确定性）。
    if (gap > bestGap) {
      best = key;
      bestGap = gap;
    }
  }
  if (best == null) return null;
  return { stat: best, from: disciple.stats[best], to: disciple.stats[best] + 1 };
}

/** 战场义兄弟并肩：存活同阵营义兄弟存在时，普攻伤害与暴击率提升。 */
export function swornAllyBattleBonus(
  commanderId: number,
  allyCommanderIds: readonly number[],
  relations: readonly AnyRelation[],
): { damagePct: number; critBonus: number } {
  const hasAlly = allyCommanderIds.some(
    (id) => id !== commanderId && isSwornBrothers(commanderId, id, relations),
  );
  return hasAlly
    ? { damagePct: SWORN_BATTLE_DAMAGE_PCT, critBonus: SWORN_BATTLE_CRIT_BONUS }
    : { damagePct: 0, critBonus: 0 };
}

/** 宿敌相搏：攻击宿敌单位时暴击率与反击率提升。 */
export function nemesisBattleBonus(
  commanderId: number,
  opponentCommanderId: number | null | undefined,
  relations: readonly AnyRelation[],
): { critBonus: number; counterBonus: number } {
  if (opponentCommanderId == null) return { critBonus: 0, counterBonus: 0 };
  return isNemesisPair(commanderId, opponentCommanderId, relations)
    ? { critBonus: NEMESIS_BATTLE_CRIT_BONUS, counterBonus: NEMESIS_BATTLE_COUNTER_BONUS }
    : { critBonus: 0, counterBonus: 0 };
}

/** 同袍死战：同战场义兄弟单位已溃/阵亡时，存活义兄弟获得激燃。 */
export function hasFallenSwornBrother(
  commanderId: number,
  fallenCommanderIds: readonly number[],
  relations: readonly AnyRelation[],
): boolean {
  return fallenCommanderIds.some(
    (id) => id !== commanderId && isSwornBrothers(commanderId, id, relations),
  );
}

interface FuryBattleUnit {
  id: string;
  side: string;
  commanderId: number;
  isDestroyed: boolean;
  isRetreated: boolean;
  troopCount: number;
  morale: number;
  swornFury?: boolean;
}

/**
 * 同袍死战一次性触发：为「有义兄弟已溃/阵亡」且尚未激燃的存活单位写入
 * `swornFury` 并提升士气（Schema 士气上限 100，故按 100 封顶；docs/52 原案
 * 「突破至 120」与既有 Zod 上限冲突，实装取 100）。零 RNG。
 */
export function applySwornFury<T extends FuryBattleUnit>(
  units: readonly T[],
  relations: readonly AnyRelation[],
): T[] {
  const fallen = units
    .filter((u) => u.isDestroyed || u.isRetreated || u.troopCount <= 0)
    .map((u) => ({ side: u.side, commanderId: u.commanderId }));
  if (fallen.length === 0) return units as T[];
  let changed = false;
  const next = units.map((unit) => {
    if (unit.isDestroyed || unit.isRetreated || unit.troopCount <= 0) return unit;
    if (unit.swornFury) return unit;
    const sameSideFallen = fallen
      .filter((f) => f.side === unit.side)
      .map((f) => f.commanderId);
    if (!hasFallenSwornBrother(unit.commanderId, sameSideFallen, relations)) return unit;
    changed = true;
    return {
      ...unit,
      swornFury: true,
      morale: Math.min(100, unit.morale + SWORN_FURY_MORALE_GAIN),
    };
  });
  return changed ? next : (units as T[]);
}

/**
 * 血仇不仕：招揽方君主/说客与目标互为宿敌时，登用硬门禁。
 * 返回命中的宿敌姓名（用于叙事），否则 null。
 */
export function findRecruitNemesis(
  targetId: number,
  recruiterId: number | null | undefined,
  rulerId: number | null | undefined,
  relations: readonly AnyRelation[],
): number | null {
  const candidates = [recruiterId, rulerId].filter(
    (id): id is number => id != null && id !== targetId,
  );
  for (const id of candidates) {
    if (isNemesisPair(targetId, id, relations)) return id;
  }
  return null;
}

/**
 * 战阵击斩结仇：死者的结义兄弟、师徒与直系父子自动与击杀者结为宿敌。
 * 返回施仇者 id 列表（去重、排除死者与击杀者本人）。
 */
export function bloodFeudAvengerIds(
  victimId: number,
  killerId: number,
  relations: readonly AnyRelation[],
): number[] {
  const ids = new Set<number>();
  const add = (id: number) => {
    if (id !== victimId && id !== killerId) ids.add(id);
  };
  for (const r of relations) {
    if (r.type === 'sworn') {
      if (r.fromId === victimId) add(r.toId);
      else if (r.toId === victimId) add(r.fromId);
    } else if (r.type === 'master_disciple') {
      if (r.fromId === victimId) add(r.toId);
      if (r.toId === victimId) add(r.fromId);
    } else if (r.type === 'parent_child' || r.type === 'siblings') {
      if (r.fromId === victimId) add(r.toId);
      else if (r.toId === victimId) add(r.fromId);
    }
  }
  return Array.from(ids);
}

/** 义兄弟同势力存活：忠诚自然衰减豁免（docs/52 §1.2）。 */
export function hasSwornBrotherInFaction(
  officer: Officer,
  officers: Record<number, Officer>,
  relations: readonly AnyRelation[],
): boolean {
  if (officer.faction == null) return false;
  return swornPartnerIds(officer.id, relations).some((id) => {
    const other = officers[id];
    return (
      other != null &&
      other.status !== 'dead' &&
      other.faction === officer.faction
    );
  });
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
