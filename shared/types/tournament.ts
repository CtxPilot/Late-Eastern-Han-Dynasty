// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S19 单挑大会类型（05 §8.17）
 * Session 338：引擎最小闭环；Session 387：公平模式 fairWushuang 接入 duel；
 * Session 391：赛前押武魁（轮间押注后置）。
 */

export type TournamentMode = 'unrestricted' | 'fair';
export type TournamentPhase = 'registration' | 'ongoing' | 'finished';

export interface TournamentFighter {
  officerId: number;
  seed: number;
  eliminated: boolean;
  /** Session 392：赛末残余单挑 HP；旧档缺省 */
  currentHp?: number;
  maxHp?: number;
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

/** Session 391：赛前押武魁（正月结算前挂在 GameState；兑付后写入赛果） */
export interface TournamentChampionBet {
  officerId: number;
  amount: number;
  /** 下注时锁定的赔率 */
  odds: number;
  officerWar: number;
  /** 下注时合格池最高武力（爆冷判定） */
  fieldTopWar: number;
}

export interface TournamentChampionBetResult {
  officerId: number;
  amount: number;
  odds: number;
  won: boolean;
  /** 兑付总额（含本金；落空为 0） */
  payout: number;
  upset: boolean;
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
  /** 公平模式下击败吕布者；旧档缺省兼容 */
  pojunOfficerId?: number;
  /** Session 391：本届赛前押武魁兑付纪要；旧档缺省 */
  championBetResult?: TournamentChampionBetResult;
  /** Session 394：冠军神兵奖 id（入势力库存）；旧档缺省 */
  championPrizeItemId?: number;
  championPrizeName?: string;
  /** Session 394：亚军普通宝物奖 id；旧档缺省 */
  runnerUpPrizeItemId?: number;
  runnerUpPrizeName?: string;
  /** Session 396：本届轮间自动用药次数（金疮药）；旧档缺省 */
  betweenRoundHealCount?: number;
  history: TournamentRecord[];
}
