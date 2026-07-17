// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Single-duel (单挑) types — see docs/05-combat-system.md §8.
 *
 * The duel is fully auto-resolved by the engine; players only decide whether
 * to challenge / accept. The 7-command internal model (core triangle +
 * auxiliary trio + sneak) drives resolution but is not player-facing.
 */

/** Duel lifecycle phase (mirrors §8.2 state machine, minus IDLE/CHALLENGING which live on the battle). */
export type DuelPhase = 'pre_duel' | 'dueling' | 'resolving' | 'resolved';

/** Outcome once a duel ends (§8.8.1). */
export type DuelOutcome = 'killed' | 'captured' | 'escaped' | 'draw' | 'surrendered';

/** Internal 7-command model (§8.5.1). Engine-only; players never choose. */
export enum DuelCommand {
  FIERCE_ATTACK = 'fierce_attack', // 猛攻 (克牵制·被必杀克)
  RESTRAIN = 'restrain',           // 牵制 (克必杀·被猛攻克)
  FINISHER = 'finisher',           // 必杀 (克猛攻·被牵制克·无视闪避)
  PARRY = 'parry',                 // 格挡 (减伤+反手·被周旋克)
  DODGE = 'dodge',                 // 闪避 (免疫猛攻/牵制·被周旋克·被必杀无视)
  PROBE = 'probe',                 // 周旋 (克闪避/格挡·被猛攻克)
  SNEAK_ATTACK = 'sneak_attack',   // 暗袭 (副武器·1场1次·不参与克制)
}

/** Body part injury (§8.7). */
export interface DuelInjury {
  part: 'arm' | 'leg' | 'rib' | 'head' | 'severe';
  attackPenalty: number;
  dodgePenalty: number;
  blockPenalty: number;
  stunTurns: number;
}

/** A single line of pre-duel dialogue (§8.4.1). */
export interface DuelDialog {
  speakerId: number;
  text: string;
  moraleEffect: number;
}

/** Per-side combatant snapshot carried through a duel round. */
export interface DuelCombatantState {
  officerId: number;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  injury: DuelInjury | null;
  sneakUsed: boolean;
  /** Accumulated probe/turn counters used by some unique skills (e.g. 赵云 龙胆 连击累加). */
  consecutiveBlocks: number;
  lastCommand: DuelCommand | null;
}

/** A fully-resolved round record (for UI playback + log). */
export interface DuelRound {
  round: number;
  /** [先手方指令, 后手方指令] */
  commands: [DuelCommand, DuelCommand];
  /** Per-side hit results, keyed by officerId. */
  hits: Record<number, boolean>;
  /** Per-side damage dealt this round. */
  damages: Record<number, number>;
  /** Per-side crit flags. */
  criticals: Record<number, boolean>;
  /** Per-side counter (反手) damage dealt. */
  counterDamages: Record<number, number>;
  counterCriticals: Record<number, boolean>;
  /** Extra chain-hit damages (e.g. 吕布 三连击 第二/三击). */
  chainHits: Record<number, number[]>;
  /** Injury applied this round, keyed by officerId. */
  injuryApplied: Record<number, DuelInjury | null>;
  /** HP snapshots after the round. */
  hpAfter: Record<number, number>;
  /** Narrative text (§8.4.3) shown to the player. */
  description: string;
  /** Optional detailed breakdown (shown when player expands the round). */
  detail?: string;
}

/** Final result of a duel (§8.8). */
export interface DuelResult {
  winnerId: number;
  loserId: number;
  outcome: DuelOutcome;
  rounds: DuelRound[];
  moraleChange: { winner: number; loser: number };
  audienceMoraleChange: number;
  meritReward: number;
  /** Narrated conclusion text. */
  epilogue: string;
}

/**
 * Runtime duel state (§8.2). Lives on the parent BattleState while a duel is
 * in progress; the battle is paused until `phase === 'resolved'`.
 */
export interface DuelState {
  battleId: string;
  phase: DuelPhase;
  challengerId: number;   // 发起方
  defenderId: number;     // 应战方
  round: number;
  combatants: Record<number, DuelCombatantState>;
  /** [先手 officerId, 后手 officerId] */
  turnOrder: number[];
  preDuelDone: boolean;
  dialogueLog: DuelDialog[];
  roundHistory: DuelRound[];
  autoResolve: boolean;
  /** Playback speed mode chosen by the player (UI hint only; engine ignores). */
  speedMode: 'full' | 'fast' | 'skip';
  result?: DuelResult;
}

/** Configurable knobs passed into the engine (for testability / future tuning). */
export interface DuelEngineConfig {
  /** Max rounds before forced draw (§8.8.1 平局). */
  maxRounds: number;
  /** HP base for a combatant (scaled by 武力 etc.). */
  baseHp: number;
  /** Challenge energy cost (§8.3.1). */
  challengeEnergyCost: number;
}