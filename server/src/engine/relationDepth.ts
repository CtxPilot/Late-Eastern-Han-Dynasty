// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S24 关系网深度闭环（Session 454，docs/52）
 *
 * - 义结金兰 / 拜师授业的主动缔结（确定性、零 RNG）；
 * - 每年正月师徒授业点拨（确定性取最大属性差项）；
 * - 季度宿敌同城共处忠诚惩罚；
 * - 战阵击斩血仇自动结仇。
 *
 * 所有入口在 `state.runtimeRelations` 缺失/为空时保持零状态改动，
 * 从而不扰动既有金样与旧档。
 */
import {
  FEUD_AFFINITY,
  MENTOR_AFFINITY_LOCK,
  MENTOR_GOLD,
  NEMESIS_COEXIST_LOYALTY_DROP,
  SWORN_AFFINITY_LOCK,
  SWORN_GOLD,
  bloodFeudAvengerIds,
  checkMentorshipEligibility,
  checkSwornBrotherhoodEligibility,
  isNemesisPair,
  mentorshipGrowthTarget,
  relationPairKey,
  STAT_KEYS,
  type AnyRelation,
  type GameState,
  type Officer,
  type RelationActionCheck,
  type RuntimeRelation,
  type StatKey,
} from '@leh/shared';
import { loadStaticRelations } from './relations.js';

const ATTRIBUTE_LABEL: Record<StatKey, string> = {
  leadership: '统帅',
  war: '武力',
  intelligence: '智力',
  politics: '政治',
  charisma: '魅力',
};

/** 静态历史关系 + 运行时动态关系的只读合并视图。 */
export function allRelations(state: GameState): AnyRelation[] {
  return [...loadStaticRelations(), ...(state.runtimeRelations ?? [])];
}

function pushRelationLog(state: GameState, message: string): GameState {
  return {
    ...state,
    actionLog: [
      { year: state.currentYear, month: state.currentMonth, type: 'relation', message },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function withRuntimeRelation(
  state: GameState,
  relation: RuntimeRelation,
  affinity?: { aId: number; bId: number; value: number },
): GameState {
  const next: GameState = {
    ...state,
    runtimeRelations: [...(state.runtimeRelations ?? []), relation],
  };
  if (affinity) {
    next.relationAffinities = {
      ...(state.relationAffinities ?? {}),
      [relationPairKey(affinity.aId, affinity.bId)]: affinity.value,
    };
  }
  return next;
}

function payGoldAtCity(state: GameState, cityId: number | null, cost: number): GameState {
  let payId = cityId;
  if (payId == null || state.cities[payId]?.ruler !== state.playerFactionId) {
    const fallback = Object.values(state.cities).find(
      (c) => c.ruler === state.playerFactionId && c.gold >= cost,
    );
    payId = fallback?.id ?? null;
  }
  if (payId == null) throw new Error(`金钱不足（需 ${cost}）`);
  const city = state.cities[payId];
  if (!city) throw new Error('无可用城池支付金钱');
  if (city.gold < cost) throw new Error(`${city.name} 金钱不足（需 ${cost}）`);
  return {
    ...state,
    cities: { ...state.cities, [payId]: { ...city, gold: city.gold - cost } },
  };
}

/** 义结金兰（docs/52 §1.1）：桃园之誓。 */
export function swearBrotherhood(
  state: GameState,
  aId: number,
  bId: number,
): GameState {
  const check = checkSwornBrotherhoodEligibility(state, aId, bId, allRelations(state));
  if (!check.ok) throw new Error(check.reason ?? '结义条件不符');
  const a = state.officers[aId]!;
  const b = state.officers[bId]!;

  let next = payGoldAtCity(state, a.location, SWORN_GOLD);
  next = withRuntimeRelation(
    next,
    {
      fromId: aId,
      toId: bId,
      type: 'sworn',
      establishedYear: state.currentYear,
      establishedMonth: state.currentMonth,
      note: '金兰之契',
    },
    { aId, bId, value: SWORN_AFFINITY_LOCK },
  );
  return pushRelationLog(
    next,
    `【金兰之契】${a.name}与${b.name}义结金兰，誓同生死，祸福相共（耗金 ${SWORN_GOLD}）`,
  );
}

/** 拜师授业（docs/52 §3.1）：束脩拜师之礼。 */
export function appointMentorship(
  state: GameState,
  masterId: number,
  discipleId: number,
): GameState {
  const check = checkMentorshipEligibility(state, masterId, discipleId, allRelations(state));
  if (!check.ok) throw new Error(check.reason ?? '拜师条件不符');
  const master = state.officers[masterId]!;
  const disciple = state.officers[discipleId]!;

  let next = payGoldAtCity(state, master.location, MENTOR_GOLD);
  next = withRuntimeRelation(
    next,
    {
      fromId: masterId,
      toId: discipleId,
      type: 'master_disciple',
      establishedYear: state.currentYear,
      establishedMonth: state.currentMonth,
      note: '授业传经',
    },
    { aId: masterId, bId: discipleId, value: MENTOR_AFFINITY_LOCK },
  );
  return pushRelationLog(
    next,
    `【名师高足】${disciple.name}正式拜入${master.name}门下，执弟子礼，授业传道（耗金 ${MENTOR_GOLD}）`,
  );
}

/**
 * 每年正月授业点拨（docs/52 §3.2）：师徒同城且同势力时，徒弟在师傅
 * 领先最多的一项属性上 +1（上限师傅对应属性 −2）。零 RNG、每年每对最多 1 点。
 */
export function tickMentorshipAnnual(state: GameState): GameState {
  const relations = state.runtimeRelations ?? [];
  if (relations.length === 0) return state;

  let officers = state.officers;
  let runtimeRelations = relations;
  let relationsChanged = false;
  const notes: string[] = [];

  for (let index = 0; index < relations.length; index++) {
    const relation = relations[index];
    if (relation.type !== 'master_disciple') continue;
    // 每年每对师徒最多 1 点：同一年已点拨过则跳过（旧档无标记视为未点拨）。
    if (relation.lastGrowthYear === state.currentYear) continue;
    const master = officers[relation.fromId];
    const disciple = officers[relation.toId];
    if (!master || !disciple) continue;
    if (master.status === 'dead' || disciple.status === 'dead') continue;
    if (master.faction == null || master.faction !== disciple.faction) continue;
    if (master.location == null || master.location !== disciple.location) continue;
    const target = mentorshipGrowthTarget(master, disciple);
    if (!target) continue;

    const nextDisciple: Officer = {
      ...disciple,
      stats: { ...disciple.stats, [target.stat]: target.to },
    };
    if (officers === state.officers) officers = { ...officers };
    officers[relation.toId] = nextDisciple;
    if (!relationsChanged) {
      runtimeRelations = [...relations];
      relationsChanged = true;
    }
    runtimeRelations[index] = { ...relation, lastGrowthYear: state.currentYear };
    notes.push(
      `【授业点拨】${master.name}授${disciple.name}以${ATTRIBUTE_LABEL[target.stat]}要义，${ATTRIBUTE_LABEL[target.stat]}提升 ${target.from}→${target.to}`,
    );
  }

  if (notes.length === 0) return state;
  let next: GameState = { ...state, officers, runtimeRelations };
  for (const message of notes.slice(0, 6)) next = pushRelationLog(next, message);
  return next;
}

/**
 * 季度宿敌同城共处（docs/52 §2.2）：同一势力同城的宿敌双方忠诚 −10。
 * 君主豁免；无运行时关系时零操作。
 */
export function tickNemesisCoexistenceQuarter(state: GameState): GameState {
  const relations = state.runtimeRelations ?? [];
  if (relations.length === 0) return state;

  const enemies = relations.filter((r) => r.type === 'enemy');
  if (enemies.length === 0) return state;

  let officers = state.officers;
  const notes: string[] = [];
  const touched = new Set<number>();

  for (const relation of enemies) {
    const a = officers[relation.fromId];
    const b = officers[relation.toId];
    if (!a || !b) continue;
    if (a.faction == null || a.faction !== b.faction) continue;
    if (a.location == null || a.location !== b.location) continue;
    if (a.status !== 'active' || b.status !== 'active') continue;
    const rulerId = state.factions[a.faction]?.rulerId;
    for (const officer of [a, b]) {
      if (officer.id === rulerId) continue;
      if (touched.has(officer.id)) continue;
      touched.add(officer.id);
      const nextLoyalty = Math.max(0, officer.loyalty - NEMESIS_COEXIST_LOYALTY_DROP);
      if (nextLoyalty === officer.loyalty) continue;
      if (officers === state.officers) officers = { ...officers };
      officers[officer.id] = { ...officer, loyalty: nextLoyalty };
    }
    if (!touched.has(a.id) && !touched.has(b.id)) continue;
    notes.push(
      `【势同水火】${a.name}与${b.name}同城共事，宿敌难容，忠诚各降 ${NEMESIS_COEXIST_LOYALTY_DROP}`,
    );
  }

  if (notes.length === 0) return state;
  let next: GameState = { ...state, officers };
  for (const message of notes.slice(0, 4)) next = pushRelationLog(next, message);
  return next;
}

/**
 * 战阵击斩结仇（docs/52 §2.1）：死者结义兄弟/师徒/直系父子与击杀者结为宿敌，
 * 亲和坠至 −100。零 RNG；击杀者或死者缺失时零改动。
 */
export function registerBloodFeud(
  state: GameState,
  killerId: number,
  victimId: number,
): GameState {
  if (killerId === victimId) return state;
  const killer = state.officers[killerId];
  const victim = state.officers[victimId];
  if (!killer || !victim) return state;

  const relations = allRelations(state);
  const avengers = bloodFeudAvengerIds(victimId, killerId, relations).filter((id) => {
    const officer = state.officers[id];
    return officer != null && officer.status !== 'dead';
  });
  if (avengers.length === 0) return state;

  let runtime = [...(state.runtimeRelations ?? [])];
  let affinities = { ...(state.relationAffinities ?? {}) };
  const notes: string[] = [];

  for (const avengerId of avengers) {
    if (isNemesisPair(avengerId, killerId, [...relations, ...runtime])) continue;
    const avenger = state.officers[avengerId]!;
    runtime.push({
      fromId: avengerId,
      toId: killerId,
      type: 'enemy',
      establishedYear: state.currentYear,
      establishedMonth: state.currentMonth,
      note: `为${victim.name}复仇`,
    });
    affinities[relationPairKey(avengerId, killerId)] = FEUD_AFFINITY;
    notes.push(`【血海深仇】${avenger.name}誓杀${killer.name}，誓报${victim.name}之仇！`);
  }

  if (notes.length === 0) return state;
  let next: GameState = { ...state, runtimeRelations: runtime, relationAffinities: affinities };
  for (const message of notes.slice(0, 6)) next = pushRelationLog(next, message);
  return next;
}

/** 供服务层复用的资格检查（只读）。 */
export function checkSworn(state: GameState, aId: number, bId: number): RelationActionCheck {
  return checkSwornBrotherhoodEligibility(state, aId, bId, allRelations(state));
}

export function checkMentorship(state: GameState, masterId: number, discipleId: number): RelationActionCheck {
  return checkMentorshipEligibility(state, masterId, discipleId, allRelations(state));
}

/** 静态关系表可读入口（战斗/忠诚等消费点共用）。 */
export { STAT_KEYS };
