// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** 论牌类型 */
export enum DebateCardType {
  REASON = 'reason',
  EMOTION = 'emotion',
  CLASSIC = 'classic',
  SOPHISTRY = 'sophistry',
}

/** 每种论牌的攻防值（初始化后固定） */
export interface DebateCardValues {
  [DebateCardType.REASON]: number;
  [DebateCardType.EMOTION]: number;
  [DebateCardType.CLASSIC]: number;
  [DebateCardType.SOPHISTRY]: number;
}

/** 舌战一方状态 */
export interface DebateSide {
  officerId: number;
  argument: number;
  maxArgument: number;
  cardValues: DebateCardValues;
}

/** 舌战全局状态 */
export interface DebateState {
  id: string;
  attacker: DebateSide;
  defender: DebateSide;
  turn: number;
  currentSide: 'attacker' | 'defender';
  phase: 'select' | 'resolve' | 'done';
  log: string[];
  result: DebateResult | null;
}

/** 舌战结果 */
export interface DebateResult {
  winnerId: number;
  loserId: number;
  rounds: number;
  reason: string;
}
