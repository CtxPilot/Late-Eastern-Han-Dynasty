// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * docs/45 S5a/S5b：六角战斗回合中途增援入场（D2 资格判定）。
 *
 * 增援 = 战斗进行中新增参战军，只覆盖围城亲统战（`fromCityId == null`）。资格
 * 完全派生自 `campaignArmies` + `battle.units[].armyId`，不新增存档字段（R3）；
 * 纯函数、零 RNG：服务端引擎与客户端 UI 共用同一口径（沿 docs/43 S1 纪律）。
 */
import type { CampaignArmy } from './types/campaign.js';

export type BattleSide = 'attacker' | 'defender';

/** 资格判定所需的最小战斗视图（BattleState 可结构赋值）。 */
export interface ReinforceBattleView {
  settled?: boolean;
  phase: 'player' | 'enemy' | 'over';
  cityId?: number;
  fromCityId?: number;
  attackerFaction: number;
  defenderFaction: number;
  duel?: unknown;
  units: readonly { armyId: string; side: BattleSide }[];
}

/** 资格判定所需的最小军视图（CampaignArmy 可结构赋值）。 */
export interface ReinforceArmyView {
  id: string;
  factionId: number;
  phase: string;
  currentNodeId: number;
  targetNodeId?: number;
}

/**
 * docs/45 D2：该军可作为本次战斗哪一侧的增援；不合资格返回 null。
 * 需同时满足：未结算未结束、围城亲统战（`fromCityId==null` 且 `cityId` 已知）、
 * 非单挑暂停、目标即战斗城、尚未参战、与对应侧同势力，且阶段匹配：
 *   - 攻方侧：该军围城中（`sieging`，兵临敌城）；
 *   - 守方侧：`sieging` 或 `garrison`（解围军抵达己方被围城即转驻守）。
 */
export function reinforcementSideFor(
  battle: ReinforceBattleView,
  army: ReinforceArmyView,
): BattleSide | null {
  if (battle.settled || battle.phase === 'over') return null;
  if (battle.fromCityId != null || battle.cityId == null) return null;
  if (battle.duel) return null;
  if ((army.targetNodeId ?? army.currentNodeId) !== battle.cityId) return null;
  if (battle.units.some((unit) => unit.armyId === army.id)) return null;
  if (army.factionId === battle.attackerFaction) {
    return army.phase === 'sieging' ? 'attacker' : null;
  }
  if (army.factionId === battle.defenderFaction) {
    return army.phase === 'sieging' || army.phase === 'garrison' ? 'defender' : null;
  }
  return null;
}

/** 该侧当前在场军数（按 `armyId` 去重，供 D4 部署锚点序号）。 */
export function sideArmyCount(battle: { units: readonly { armyId: string; side: BattleSide }[] }, side: BattleSide): number {
  return new Set(battle.units.filter((unit) => unit.side === side).map((unit) => unit.armyId)).size;
}

/** docs/45 D2/D9：从军册筛选当前可选增援军（军序沿兵力降序 → id 升序）。 */
export function reinforcementCandidates(
  battle: ReinforceBattleView,
  armies: readonly CampaignArmy[],
): CampaignArmy[] {
  return armies
    .filter((army) => reinforcementSideFor(battle, army) != null)
    .slice()
    .sort((a, b) => b.troops - a.troops || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
