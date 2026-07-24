// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { DipRelation, OfficerStatus } from './enums/index.js';
import type { GameState } from './types/game.js';
import type { Officer } from './types/officer.js';

/** R2 概率统一下限/上限；所有输入与输出均为百分点。 */
export const NEGOTIATION_CHANCE_MIN = 5;
export const NEGOTIATION_CHANCE_MAX = 90;

export function clampNegotiationChance(chance: number): number {
  return Math.max(
    NEGOTIATION_CHANCE_MIN,
    Math.min(NEGOTIATION_CHANCE_MAX, chance),
  );
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

export interface AllianceChanceBreakdown {
  chance: number;
  envoyId: number;
  envoyCharisma: number;
  favorability: number;
  reputationDifference: number;
  commonEnemyModifier: number;
  treatyModifier: number;
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

/** 当前 Demo 以魅力最高的现役己方武将自动担任结盟使者。 */
export function selectAllianceEnvoy(
  state: GameState,
  factionId: number,
): Officer {
  const envoy = Object.values(state.officers)
    .filter(
      (officer) =>
        officer.faction === factionId &&
        officer.status === OfficerStatus.ACTIVE,
    )
    .sort(
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

  const chance = clampNegotiationChance(
    35 +
      bilateral.favorability * 0.35 +
      reputationDifference / 100 +
      envoy.stats.charisma * 0.15 +
      commonEnemyModifier +
      treatyModifier,
  );

  return {
    chance,
    envoyId: envoy.id,
    envoyCharisma: envoy.stats.charisma,
    favorability: bilateral.favorability,
    reputationDifference,
    commonEnemyModifier,
    treatyModifier,
  };
}
