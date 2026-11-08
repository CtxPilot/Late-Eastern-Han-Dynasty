// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { DipRelation, OfficerStatus } from './enums/index.js';
import type { PoliticalStage } from './types/faction.js';
import type { GameState } from './types/game.js';
import type { Officer } from './types/officer.js';
import { eloquenceAllianceModifier, eloquenceRecruitModifier } from './skill-consume.js';
import { cultureRecruitModifier } from './culture.js';
import { computeMandate, mandateDiplomacyModifier } from './mandate-popular.js';
import { findDiplomacy } from './intel.js';

/** R2 概率统一下限/上限；所有输入与输出均为百分点。 */
export const NEGOTIATION_CHANCE_MIN = 5;
export const NEGOTIATION_CHANCE_MAX = 90;

export function clampNegotiationChance(chance: number): number {
  return Math.max(
    NEGOTIATION_CHANCE_MIN,
    Math.min(NEGOTIATION_CHANCE_MAX, chance),
  );
}

/**
 * 霸府/称王/称帝外交权重分档修正（docs/26 Q3 已批准方向，HC-P0-5）。
 * 仅对"发起操作的势力自身"应用——开府势力自己发起结盟/进贡/宫廷牵线时获得加成。
 * 04§36.2 曹操"挟天子令诸侯"+30 外交权重基调；此处结盟成功率加成落在 Q3 批准区间
 * （霸府 +5~10），称王/称帝留更高档位分档结构（即使转移操作未实装，避免后续再改函数签名）。
 * @returns 结盟成功率百分点修正（vassal/undefined=0，hegemon=+5，king=+8，emperor=+12）
 */
export function hegemonyAllianceModifier(stage: PoliticalStage | undefined): number {
  switch (stage) {
    case 'hegemon': return 5;
    case 'king': return 8;
    case 'emperor': return 12;
    default: return 0;
  }
}

/**
 * 霸府/称王/称帝 进贡/宫廷牵线友好增量倍数（docs/26 Q3，HC-P0-5）。
 * 同样仅对发起方应用——开府势力进贡/宫廷牵线的友好增量按此倍数放大。
 * 落在 Q3 批准区间（霸府 ×1.1~1.2），称王/称帝预留更高倍数分档。
 * @returns 友好增量倍数（vassal/undefined=1.0，hegemon=1.1，king=1.2，emperor=1.3）
 */
export function hegemonyFavorMultiplier(stage: PoliticalStage | undefined): number {
  switch (stage) {
    case 'hegemon': return 1.1;
    case 'king': return 1.2;
    case 'emperor': return 1.3;
    default: return 1.0;
  }
}

/** S11 登用率：所有加减项均为百分点，最终只 clamp 一次。 */
export function calculateRecruitChance(
  recruiter: Officer,
  target: Officer,
  situationalModifier = 0,
): number {
  const charismaDifference =
    recruiter.stats.charisma - target.stats.charisma;
  const compatibilityDifference = Math.abs(
    recruiter.hidden.compatibility - target.hidden.compatibility,
  );

  return clampNegotiationChance(
    40 +
      charismaDifference * 0.3 +
      (1 - compatibilityDifference / 150) * 40 +
      target.hidden.righteousness * 2 -
      target.hidden.ambition * 3 +
      situationalModifier,
  );
}

/**
 * Session 400：登用成功率完整合成（辩才 + 文化人才吸引），UI 与引擎同源。
 * `cultureValue` 缺省 0；文化修正见 `cultureRecruitModifier`。
 */
export function resolveRecruitChance(
  recruiter: Officer,
  target: Officer,
  cultureValue = 0,
  techCultivationBonus = 0,
): number {
  return calculateRecruitChance(
    recruiter,
    target,
    eloquenceRecruitModifier(recruiter) + cultureRecruitModifier(cultureValue) + techCultivationBonus,
  );
}

export interface AllianceChanceBreakdown {
  chance: number;
  envoyId: number;
  envoyCharisma: number;
  favorability: number;
  reputationDifference: number;
  commonEnemyModifier: number;
  treatyModifier: number;
  /** HC-P0-5：发起方政治阶段（霸府/王/帝）带来的成功率百分点修正，vassal=0。 */
  hegemonyModifier: number;
  /** S25：使者辩才技能百分点修正（Session 337）。 */
  eloquenceModifier: number;
  /** S26：发起方天命外交权重百分点修正（Session 338）。 */
  mandateModifier: number;
}

function isWarRelation(relation: string): boolean {
  return relation === DipRelation.WAR || relation === 'war';
}

function favorabilityBetween(
  state: GameState,
  factionA: number,
  factionB: number,
): { favorability: number; relation: string } {
  const link = state.diplomacy.find(
    (candidate) =>
      (candidate.factionA === factionA && candidate.factionB === factionB) ||
      (candidate.factionA === factionB && candidate.factionB === factionA),
  );
  return {
    favorability: link?.favorability ?? 0,
    relation: (link?.relation as string | undefined) ?? DipRelation.NEUTRAL,
  };
}

/**
 * 当前 Demo 以魅力最高的现役己方武将自动担任结盟使者。
 * 君主不出使（docs/04 §6.5：君主不参与功绩系统——使者若为君主则同盟功绩无人可领）；
 * 但若势力除君主外无现役武将（小势力），回退允许君主出使（功绩由 grantMeritTo 守卫兜底不发放）。
 */
export function selectAllianceEnvoy(
  state: GameState,
  factionId: number,
): Officer {
  const rulerId = state.factions[factionId]?.rulerId;
  const active = Object.values(state.officers).filter(
    (officer) =>
      officer.faction === factionId &&
      officer.status === OfficerStatus.ACTIVE,
  );
  const pool = active.filter((officer) => officer.id !== rulerId);
  const envoy = (pool.length > 0 ? pool : active).sort(
    (a, b) =>
      b.stats.charisma - a.stats.charisma ||
      a.id - b.id,
  )[0];
  if (!envoy) throw new Error('无可用外交使者');
  return envoy;
}

function haveCommonEnemy(
  state: GameState,
  factionA: number,
  factionB: number,
): boolean {
  return Object.values(state.factions).some((candidate) => {
    if (
      !candidate.isAlive ||
      candidate.id === factionA ||
      candidate.id === factionB
    ) {
      return false;
    }
    return (
      isWarRelation(favorabilityBetween(state, factionA, candidate.id).relation) &&
      isWarRelation(favorabilityBetween(state, factionB, candidate.id).relation)
    );
  });
}

/**
 * S08 结盟成功率。声望字段尚未进入当前 Demo Faction，故双方声望暂按 0；
 * 共同敌人 +10 点，既有 friendly 条约态 +5 点，戒备/利益冲突留 0。
 * HC-P0-5：发起方政治阶段（霸府/王/帝）按 hegemonyAllianceModifier 加百分点。
 */
export function calculateAllianceChance(
  state: GameState,
  targetFactionId: number,
  sourceFactionId: number = state.playerFactionId,
): AllianceChanceBreakdown {
  const envoy = selectAllianceEnvoy(state, sourceFactionId);
  const bilateral = favorabilityBetween(
    state,
    sourceFactionId,
    targetFactionId,
  );
  const reputationDifference = 0;
  const commonEnemyModifier = haveCommonEnemy(
    state,
    sourceFactionId,
    targetFactionId,
  )
    ? 10
    : 0;
  const treatyModifier =
    bilateral.relation === DipRelation.FRIENDLY ||
    bilateral.relation === 'friendly'
      ? 5
      : 0;
  const hegemonyModifier = hegemonyAllianceModifier(
    state.factions[sourceFactionId]?.politicalStage,
  );
  // S25：使者辩才每级 +1 百分点（Session 337）
  const eloquenceModifier = eloquenceAllianceModifier(envoy);
  // S26：天命外交权重 → 百分点（Session 338）
  const sourceFaction = state.factions[sourceFactionId];
  const mandate = sourceFaction
    ? computeMandate(sourceFaction, state)
    : 0;
  const mandateModifier = Math.round(mandateDiplomacyModifier(mandate) * 100);

  const chance = clampNegotiationChance(
    35 +
      bilateral.favorability * 0.35 +
      reputationDifference / 100 +
      envoy.stats.charisma * 0.15 +
      commonEnemyModifier +
      treatyModifier +
      hegemonyModifier +
      eloquenceModifier +
      mandateModifier,
  );

  return {
    chance,
    envoyId: envoy.id,
    envoyCharisma: envoy.stats.charisma,
    favorability: bilateral.favorability,
    reputationDifference,
    commonEnemyModifier,
    treatyModifier,
    hegemonyModifier,
    eloquenceModifier,
    mandateModifier,
  };
}

export interface TruceChanceBreakdown {
  chance: number;
  envoyId: number;
  envoyCharisma: number;
  militaryRatio: number;
  multiWarBonus: number;
}

/**
 * 停战协商成功率计算（docs/04 §5.1 #2 停战）
 */
export function calculateTruceChance(
  state: GameState,
  targetFactionId: number,
  sourceFactionId: number = state.playerFactionId,
): TruceChanceBreakdown {
  const envoy = selectAllianceEnvoy(state, sourceFactionId);
  const sourceFaction = state.factions[sourceFactionId];
  const targetFaction = state.factions[targetFactionId];
  if (!sourceFaction || !targetFaction) {
    return {
      chance: 0,
      envoyId: envoy?.id ?? 0,
      envoyCharisma: envoy?.stats.charisma ?? 0,
      militaryRatio: 1,
      multiWarBonus: 0,
    };
  }

  // 双方总驻军兵力对比
  const sourceTroops = sourceFaction.cityIds.reduce(
    (sum, cid) => sum + (state.cities[cid]?.troops ?? 0),
    0,
  );
  const targetTroops = targetFaction.cityIds.reduce(
    (sum, cid) => sum + (state.cities[cid]?.troops ?? 0),
    0,
  );
  const militaryRatio = targetTroops > 0 ? sourceTroops / targetTroops : 2.0;

  // 对方是否陷入多线作战（与 ≥ 2 势力开战）
  const targetWars = state.diplomacy.filter((l) => {
    if (l.factionA !== targetFactionId && l.factionB !== targetFactionId) return false;
    const r = l.relation as string;
    return r === DipRelation.WAR || r === 'war';
  }).length;
  const multiWarBonus = targetWars >= 2 ? 25 : 0;

  // 军力优势加成
  const militaryBonus =
    militaryRatio >= 1.5 ? 20 : militaryRatio >= 1.0 ? 10 : -10;

  // 使者魅力加成
  const charismaBonus = (envoy?.stats.charisma ?? 50) * 0.2;

  // 既有友好度修正
  const link = findDiplomacy(state.diplomacy, sourceFactionId, targetFactionId);
  const favorBonus = (link?.favorability ?? -50) * 0.2;

  const rawChance = 40 + militaryBonus + multiWarBonus + charismaBonus + favorBonus;
  const chance = clampNegotiationChance(rawChance);

  return {
    chance,
    envoyId: envoy.id,
    envoyCharisma: envoy.stats.charisma,
    militaryRatio,
    multiWarBonus,
  };
}

export interface VassalChanceBreakdown {
  chance: number;
  envoyId: number;
  sourceCities: number;
  targetCities: number;
  sourceTroops: number;
  targetTroops: number;
}

/**
 * 迫使从属/称臣臣服成功率计算（docs/04 §5.1 #5 从属）
 */
export function calculateVassalChance(
  state: GameState,
  targetFactionId: number,
  sourceFactionId: number = state.playerFactionId,
): VassalChanceBreakdown {
  const envoy = selectAllianceEnvoy(state, sourceFactionId);
  const sourceFaction = state.factions[sourceFactionId];
  const targetFaction = state.factions[targetFactionId];
  if (!sourceFaction || !targetFaction) {
    return {
      chance: 0,
      envoyId: envoy?.id ?? 0,
      sourceCities: 0,
      targetCities: 0,
      sourceTroops: 0,
      targetTroops: 0,
    };
  }

  const sourceCities = sourceFaction.cityIds.length;
  const targetCities = targetFaction.cityIds.length;
  const sourceTroops = sourceFaction.cityIds.reduce(
    (sum, cid) => sum + (state.cities[cid]?.troops ?? 0),
    0,
  );
  const targetTroops = targetFaction.cityIds.reduce(
    (sum, cid) => sum + (state.cities[cid]?.troops ?? 0),
    0,
  );

  // 迫使其臣属门槛：宗主方城池 ≥ 2倍 且 兵力 ≥ 3倍，或者目标仅余 ≤ 1 城且兵力不足 5000
  const isOverwhelming =
    (sourceCities >= targetCities * 2 && sourceTroops >= targetTroops * 3) ||
    (targetCities <= 1 && targetTroops <= 5000 && sourceTroops >= 15000);

  if (!isOverwhelming) {
    return {
      chance: 0,
      envoyId: envoy.id,
      sourceCities,
      targetCities,
      sourceTroops,
      targetTroops,
    };
  }

  const link = findDiplomacy(state.diplomacy, sourceFactionId, targetFactionId);
  const fav = link?.favorability ?? 0;
  if (fav < -40) {
    return {
      chance: 5,
      envoyId: envoy.id,
      sourceCities,
      targetCities,
      sourceTroops,
      targetTroops,
    };
  }

  const fameBonus = ((sourceFaction.fame ?? 0) - (targetFaction.fame ?? 0)) / 20;
  const rawChance = 50 + fav * 0.3 + (envoy.stats.charisma ?? 50) * 0.2 + fameBonus;
  const chance = clampNegotiationChance(rawChance);

  return {
    chance,
    envoyId: envoy.id,
    sourceCities,
    targetCities,
    sourceTroops,
    targetTroops,
  };
}
