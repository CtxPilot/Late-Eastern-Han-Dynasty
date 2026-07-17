// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Demo 出征 / 占城结算（简化版）
 * - 从己方城扣兵粮 → 开战
 * - 胜：目标城改归属 + 残兵驻防
 * - 败/中途撤退：残兵按比例回流出发城
 */
import {
  OfficerStatus,
  canMarchAlongRoad,
  playerCitiesAdjacentTo,
  type BattleState,
  type City,
  type GameState,
} from '@leh/shared';
import { createBattle } from './battle.js';
import { lootBeautyOnCapture } from './beauty.js';
import { clearCityCounterOnCapture } from './spy.js';
import { syncFactionResources } from './economy.js';

export const MIN_MARCH_TROOPS = 1000;
export const GARRISON_RESERVE = 500;
/** 每 100 兵力耗粮（出征启程） */
export const FOOD_PER_100 = 5;

export interface MarchOptions {
  fromCityId: number;
  targetCityId: number;
  /** 省略则自动取 max(可出征上限) */
  troopCount?: number;
}

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<GameState> = {},
): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function cityDist(a: City, b: City): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 选出发城：必须与目标**道路邻接**，再按兵力/距离优选。
 */
export function pickDefaultFromCity(state: GameState, targetCityId: number): number | null {
  const target = state.cities[targetCityId];
  if (!target) return null;
  const playerIds = Object.values(state.cities)
    .filter((c) => c.ruler === state.playerFactionId)
    .map((c) => c.id);
  const adjacentIds = playerCitiesAdjacentTo(playerIds, targetCityId);
  if (adjacentIds.length === 0) return null;

  const withTroops = adjacentIds
    .map((id) => state.cities[id])
    .filter((c): c is City => !!c && c.troops >= MIN_MARCH_TROOPS);
  if (withTroops.length === 0) return null;

  withTroops.sort((a, b) => {
    const ta = a.troops >= MIN_MARCH_TROOPS + GARRISON_RESERVE ? 0 : 1;
    const tb = b.troops >= MIN_MARCH_TROOPS + GARRISON_RESERVE ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return cityDist(a, target) - cityDist(b, target);
  });
  return withTroops[0].id;
}

/** 目标是否可被己方某城出征（道路邻接 + 该城有兵） */
export function isMarchTargetReachable(state: GameState, targetCityId: number): boolean {
  return pickDefaultFromCity(state, targetCityId) != null;
}

export function maxMarchable(from: City): number {
  // 尽量留守军；兵力极紧时允许掏空出征
  if (from.troops <= MIN_MARCH_TROOPS) return from.troops;
  return Math.max(MIN_MARCH_TROOPS, from.troops - GARRISON_RESERVE);
}

/**
 * 出征：扣出发城兵力/粮草，生成战斗（兵力=出征数 vs 守城驻军）
 */
export function prepareMarch(
  state: GameState,
  opts: MarchOptions,
): { state: GameState; battle: BattleState } {
  const { fromCityId, targetCityId } = opts;
  const from = state.cities[fromCityId];
  const target = state.cities[targetCityId];
  if (!from) throw new Error('出发城不存在');
  if (!target) throw new Error('目标城不存在');
  if (from.ruler !== state.playerFactionId) throw new Error('出发城非己方');
  if (target.ruler === state.playerFactionId) throw new Error('目标已是己方城');
  if (target.ruler == null) throw new Error('Demo：暂不支持攻打无主城');
  if (!canMarchAlongRoad(fromCityId, targetCityId)) {
    throw new Error(
      `无官道直达：${from.name} 与 ${target.name} 不相邻（须沿史实/地图道路邻接出征）`,
    );
  }

  const cap = maxMarchable(from);
  if (cap < MIN_MARCH_TROOPS) {
    throw new Error(`兵力不足出征（${from.name} 需至少 ${MIN_MARCH_TROOPS} 兵）`);
  }

  let troops = opts.troopCount ?? cap;
  // Sec-4: 防 NaN/Infinity 污染城池数据
  if (troops != null && !Number.isFinite(troops)) {
    throw new Error('出征兵力数值非法');
  }
  troops = Math.floor(troops);
  if (troops < MIN_MARCH_TROOPS) {
    throw new Error(`出征兵力至少 ${MIN_MARCH_TROOPS}`);
  }
  if (troops > cap) troops = cap;
  if (troops > from.troops) throw new Error('出征兵力超过城内驻军');

  const foodCost = Math.max(50, Math.ceil((troops / 100) * FOOD_PER_100));
  if (from.food < foodCost) {
    throw new Error(`${from.name} 粮草不足（需 ${foodCost}）`);
  }

  const nextFrom: City = {
    ...from,
    troops: from.troops - troops,
    food: from.food - foodCost,
  };

  const cities = { ...state.cities, [fromCityId]: nextFrom };
  const withLog = pushLog(
    state,
    'march',
    `自 ${from.name} 出征 ${troops} 兵攻 ${target.name}（耗粮 ${foodCost}）`,
    { cities },
  );

  // Demo：野战守军约 75% 驻军（非全员出城；完整攻城战见 P3-08）
  const fieldDef = Math.max(500, Math.floor(target.troops * 0.75));
  const battle = createBattle(withLog, targetCityId, {
    fromCityId,
    attackTroops: troops,
    attackMorale: Math.max(from.troopsMorale ?? 70, 85),
    defendTroops: fieldDef,
    defendMorale: target.troopsMorale ?? 70,
  });

  return { state: withLog, battle };
}

function remainingTroops(battle: BattleState, side: 'attacker' | 'defender'): number {
  return battle.units
    .filter((u) => u.side === side && !u.isDestroyed)
    .reduce((s, u) => s + Math.max(0, u.troopCount), 0);
}

function recomputeFactionCities(
  cities: GameState['cities'],
  factions: GameState['factions'],
): GameState['factions'] {
  const next = { ...factions };
  for (const fid of Object.keys(next).map(Number)) {
    const f = next[fid];
    if (!f) continue;
    const cityIds = Object.values(cities)
      .filter((c) => c.ruler === fid)
      .map((c) => c.id);
    const capitalOk = cityIds.includes(f.capitalCityId);
    next[fid] = {
      ...f,
      cityIds,
      isAlive: cityIds.length > 0,
      capitalCityId: capitalOk ? f.capitalCityId : (cityIds[0] ?? f.capitalCityId),
    };
  }
  return next;
}

/**
 * 战斗结束 / 撤退时写入大地图：胜则占城，否则残兵回流
 */
export function settleBattle(state: GameState, battle: BattleState): GameState {
  if (battle.settled) return state;

  const targetId = battle.cityId;
  const fromId = battle.fromCityId;
  if (targetId == null) {
    // 无关联城的旧演示战：不改归属
    return state;
  }

  const target = state.cities[targetId];
  if (!target) return state;

  const atkLeft = remainingTroops(battle, 'attacker');
  const defLeft = remainingTroops(battle, 'defender');
  const finished = battle.phase === 'over';
  const attackerWon = finished && battle.winner === 'attacker';
  const defenderWon = finished && battle.winner === 'defender';

  let cities = { ...state.cities };
  let officers = { ...state.officers };
  let message: string;
  let type: string;

  if (attackerWon) {
    // —— 占城 ——
    const prevRuler = target.ruler;
    const garrison = Math.max(0, atkLeft);
    const nextTarget: City = {
      ...target,
      ruler: battle.attackerFaction,
      troops: garrison,
      troopsMorale: Math.min(80, Math.max(40, (target.troopsMorale ?? 70) - 15)),
      stats: {
        ...target.stats,
        morale: Math.max(20, (target.stats.morale ?? 70) - 25),
        wall: Math.max(0, target.stats.wall - 10),
      },
      officers: [],
    };

    // 敌方同城武将 → 在野
    const freed: string[] = [];
    const freedIds: number[] = [];
    for (const oid of target.officers) {
      const o = officers[oid];
      if (!o) continue;
      if (o.faction === prevRuler || o.faction === battle.defenderFaction) {
        officers[oid] = {
          ...o,
          faction: null,
          status: OfficerStatus.FREE,
          civilPosition: o.civilPosition,
          location: targetId,
          loyalty: 50,
        };
        freed.push(o.name);
        freedIds.push(oid);
      }
    }

    // 攻击方全部存活单位主将调入新城（多单位不丢人）
    const movedCmdIds: number[] = [];
    for (const atkUnit of battle.units.filter(
      (u) => u.side === 'attacker' && !u.isDestroyed,
    )) {
      const cmd = officers[atkUnit.commanderId];
      if (!cmd || cmd.faction !== battle.attackerFaction) continue;
      if (movedCmdIds.includes(cmd.id)) continue;
      officers[atkUnit.commanderId] = { ...cmd, location: targetId };
      movedCmdIds.push(cmd.id);
      if (fromId != null && cities[fromId]) {
        const old = cities[fromId];
        cities[fromId] = {
          ...old,
          officers: old.officers.filter((id) => id !== cmd.id),
        };
      }
    }
    // B2: 占城后城内武将列表 = 攻方主将 + 释放的在野败将
    nextTarget.officers = [...movedCmdIds, ...freedIds];

    cities[targetId] = nextTarget;
    const factions = recomputeFactionCities(cities, state.factions);

    // 更新势力武将列表（释放者踢出）
    const nextFactions = { ...factions };
    if (prevRuler != null && nextFactions[prevRuler]) {
      const pf = nextFactions[prevRuler];
      nextFactions[prevRuler] = {
        ...pf,
        officerIds: pf.officerIds.filter((id) => officers[id]?.faction === prevRuler),
      };
    }

    const freeMsg = freed.length ? `；${freed.join('、')} 流落在野` : '';
    message = `攻占 ${target.name}！驻军 ${garrison}${freeMsg}`;
    type = 'capture';

    let after: GameState = pushLog(
      { ...state, cities, officers, factions: nextFactions },
      type,
      message,
    );
    // 占城：拆敌反间驻守
    after = clearCityCounterOnCapture(after, targetId);
    // 抢夺美女资源（势力 stock↑，可寻↓，民忠↓）
    after = lootBeautyOnCapture(after, targetId, battle.attackerFaction);
    after = syncFactionResources(after);
    return after;
  }

  // —— 败北或中途撤退：守军回写；攻方残兵部分回流 ——
  const returnRate = defenderWon ? 0.15 : finished ? 0.15 : 0.5; // 中途撤 50%，败 15%
  const returned = Math.floor(atkLeft * returnRate);

  cities[targetId] = {
    ...target,
    troops: Math.max(0, defLeft),
    troopsMorale: Math.min(100, (target.troopsMorale ?? 70) + (defenderWon ? 5 : 0)),
  };

  if (fromId != null && cities[fromId] && returned > 0) {
    const from = cities[fromId];
    cities[fromId] = {
      ...from,
      troops: from.troops + returned,
    };
  }

  if (defenderWon) {
    message = `攻打 ${target.name} 失败，残部 ${returned} 退回`;
    type = 'march_defeat';
  } else if (!finished) {
    message = `自 ${target.name} 撤军，${returned} 兵返回出发城`;
    type = 'march_retreat';
  } else {
    message = `战事于 ${target.name} 结束`;
    type = 'battle_end';
  }

  return pushLog({ ...state, cities, officers }, type, message);
}

/** 仅标记 battle 已结算（由 service 层持有） */
export function markBattleSettled(battle: BattleState): BattleState {
  return { ...battle, settled: true };
}
