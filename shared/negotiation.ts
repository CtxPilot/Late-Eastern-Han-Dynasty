// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { DipRelation, OfficerStatus } from './enums/index.js';
import type { PoliticalStage } from './types/faction.js';
import type { GameState } from './types/game.js';
import type { Officer } from './types/officer.js';
import { eloquenceAllianceModifier, eloquenceRecruitModifier } from './skill-consume.js';
import { cultureRecruitModifier } from './culture.js';
import { computeMandate, mandateDiplomacyModifier } from './mandate-popular.js';

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
): number {
  return calculateRecruitChance(
    recruiter,
    target,
    eloquenceRecruitModifier(recruiter) + cultureRecruitModifier(cultureValue),
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
): AllianceChanceBreakdown {
  const sourceFactionId = state.playerFactionId;
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
