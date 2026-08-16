// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S19 单挑大会类型（05 §8.17）
 * Session 338：引擎最小闭环——赛制/自动结算；押注与完整 UI 后置。
 */

export type TournamentMode = 'unrestricted' | 'fair';
export type TournamentPhase = 'registration' | 'ongoing' | 'finished';

export interface TournamentFighter {
  officerId: number;
  seed: number;
  eliminated: boolean;
}

export interface TournamentMatch {
  round: number;
  matchIndex: number;
  fighterAId: number;
  fighterBId: number;
  winnerId?: number;
  narrativeLog: string[];
}

export interface TournamentRecord {
  year: number;
  championId: number;
  runnerUpId: number;
  semifinalistIds: number[];
  championTitle: '武魁';
}

export interface TournamentState {
  year: number;
  mode: TournamentMode;
  phase: TournamentPhase;
  hostCityId: number;
  participants: TournamentFighter[];
  bracket: TournamentMatch[][];
  currentRound: number;
  championId?: number;
  runnerUpId?: number;
  history: TournamentRecord[];
}
