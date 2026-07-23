// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { FactionId, FormationType, TerrainType, UnitType, Weather } from '../enums/index.js';
import type { HexCoord } from './common.js';
import type { DuelState } from './duel.js';

export interface BattleStatusEffect {
  type: string;
  remainingTurns: number;
  value?: number;
}

export interface BattleUnit {
  id: string;
  armyId: string;
  commanderId: number;
  /**
   * 交战时揭示的主将姓名快照。它属于战斗表现契约，不要求客户端读取
   * 可能已被 S06 迷雾裁剪掉的全局 officers 表。
   */
  commanderName: string;
  factionId: FactionId;
  side: 'attacker' | 'defender';
  unitType: UnitType;
  formation: FormationType;
  troopCount: number;
  maxTroops: number;
  morale: number;
  food: number;
  position: HexCoord;
  mp: number;
  maxMp: number;
  /** 气力 0~100（计策消耗） */
  energy: number;
  maxEnergy: number;
  hasActed: boolean;
  isRetreated: boolean;
  isDestroyed: boolean;
  statusEffects: BattleStatusEffect[];
}

export interface BattleLogEntry {
  turn: number;
  message: string;
}

export interface BattleState {
  id: string;
  turn: number;
  weather: Weather;
  attackerFaction: FactionId;
  defenderFaction: FactionId;
  isSiege: boolean;
  /** 目标城（攻城/出征） */
  cityId?: number;
  /** 出征出发城；结算残兵回流用 */
  fromCityId?: number;
  /** 是否已写入 GameState（占城/回流） */
  settled?: boolean;
  units: BattleUnit[];
  phase: 'player' | 'enemy' | 'over';
  winner: 'attacker' | 'defender' | null;
  hexGrid: {
    width: number;
    height: number;
    terrain: TerrainType[][];
  };
  log: BattleLogEntry[];
  message: string;
  /** Active duel (S10 §8); while set, battle is paused until duel resolves. */
  duel?: DuelState | null;
}
