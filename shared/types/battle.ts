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
  /** 六方向朝向 0=东，顺时针至5；旧档缺省时由阵营推导。 */
  facing?: 0 | 1 | 2 | 3 | 4 | 5;
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
  /** FM-P4：供战报 UI 展示的可解释分项；旧存档可省略。 */
  explanation?: BattleLogExplanation;
}

export interface BattleLogExplanation {
  kind: 'attack' | 'formation';
  attackerFormation?: FormationType;
  defenderFormation?: FormationType;
  formationAttack?: number;
  formationDefense?: number;
  tacticalPointsBefore?: number;
  tacticalPointsAfter?: number;
  formationBefore?: FormationType;
  formationAfter?: FormationType;
}

export interface BattleActionRecord {
  id: string;
  kind: 'move' | 'attack' | 'formation';
  unitId: string;
  logicalTimestamp: number;
  source: 'player' | 'ai' | 'system';
  reversible: boolean;
  beforePosition?: HexCoord;
  afterPosition?: HexCoord;
  beforeMp?: number;
  beforeFormation?: FormationType;
  afterFormation?: FormationType;
}

export interface BattleState {
  id: string;
  turn: number;
  weather: Weather;
  /** 天气自动切换倒计时；旧存档缺省时保持静态天气兼容。 */
  weatherChangeTimer?: number;
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
  /** 最近三条玩家战术操作；移动在攻击/RNG 前可撤，攻击仅留审计且不可撤。 */
  actionHistory?: BattleActionRecord[];
  /** 六角战中变阵资源；旧档缺省按 5 点、当回合已用 0 点兼容。 */
  tacticalPoints?: number;
  /** 当前回合已消耗的六角战术点；变阵后主将行动结束。 */
  tacticalPointsUsed?: number;
  message: string;
  /** Active duel (S10 §8); while set, battle is paused until duel resolves. */
  duel?: DuelState | null;
}
