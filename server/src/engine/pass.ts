// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  DEFAULT_PASSES,
  PASS_WALL_REPAIR_GOLD,
  canGarrisonPass,
  calculatePassWallRepairCost,
} from '@leh/shared';
import type { GameState, PassEntity, PassSummaryItem } from '@leh/shared';

/**
 * Phase 7-08 主地图关隘要塞防御要冲体系 (Session 484)
 * 对应 docs/04 §6 关隘系统
 */

export function initPasses(
  state: GameState,
  basePasses: readonly PassEntity[] = DEFAULT_PASSES,
): GameState {
  const passes: Record<number, PassEntity> = {};
  for (const pass of basePasses) {
    passes[pass.id] = { ...pass };
  }
  return {
    ...state,
    passes,
  };
}

export function dispatchGarrisonToPass(
  state: GameState,
  cityId: number,
  passId: number,
  troops: number,
  commanderId?: number,
): GameState {
  const city = state.cities[cityId];
  if (!city) throw new Error(`城池不存在: ${cityId}`);
  if (!state.passes) throw new Error('关隘系统尚未初始化');
  const pass = state.passes[passId];
  if (!pass) throw new Error(`关隘不存在: ${passId}`);

  const check = canGarrisonPass(city.troops, pass, troops);
  if (!check.allowed) {
    throw new Error(check.reason ?? '无法调拨驻军至关隘');
  }

  if (commanderId != null) {
    const officer = state.officers[commanderId];
    if (!officer) throw new Error(`武将不存在: ${commanderId}`);
    if (officer.faction !== city.ruler) {
      throw new Error('所选守将不属于本势力');
    }
    if ((officer.injury ?? 0) >= 3) {
      throw new Error('武将受重伤或濒死，无法出任关防要将');
    }
  }

  const newCityTroops = city.troops - troops;
  const newPassTroops = pass.troops + troops;
  const newPassFaction =
    (pass.factionId === 0 || pass.troops === 0) && city.ruler != null
      ? city.ruler
      : pass.factionId;

  const nextPasses = {
    ...state.passes,
    [passId]: {
      ...pass,
      troops: newPassTroops,
      factionId: newPassFaction,
      commanderId: commanderId ?? pass.commanderId,
    },
  };

  const nextCities = {
    ...state.cities,
    [cityId]: {
      ...city,
      troops: newCityTroops,
    },
  };

  const actionLog = [
    ...(state.actionLog ?? []),
    {
      year: state.currentYear,
      month: state.currentMonth,
      type: 'pass_dispatch',
      message: `【关隘驻防】${city.name}调拨 ${troops} 兵力进驻${pass.name}（当前关隘守备 ${newPassTroops}）。`,
    },
  ];

  return {
    ...state,
    cities: nextCities,
    passes: nextPasses,
    actionLog,
  };
}

export function recallGarrisonFromPass(
  state: GameState,
  passId: number,
  cityId: number,
  troops: number,
): GameState {
  const city = state.cities[cityId];
  if (!city) throw new Error(`城池不存在: ${cityId}`);
  if (!state.passes) throw new Error('关隘系统尚未初始化');
  const pass = state.passes[passId];
  if (!pass) throw new Error(`关隘不存在: ${passId}`);

  if (city.ruler !== pass.factionId) {
    throw new Error('关隘与城池不属于同一势力，无法撤军');
  }
  if (troops <= 0) {
    throw new Error('撤退兵力必须大于 0');
  }
  if (troops > pass.troops) {
    throw new Error(`撤回兵力 (${troops}) 超过当前关隘驻军 (${pass.troops})`);
  }

  const remainingPassTroops = pass.troops - troops;
  const nextPasses = {
    ...state.passes,
    [passId]: {
      ...pass,
      troops: remainingPassTroops,
      commanderId: remainingPassTroops === 0 ? undefined : pass.commanderId,
    },
  };

  const nextCities = {
    ...state.cities,
    [cityId]: {
      ...city,
      troops: city.troops + troops,
    },
  };

  const actionLog = [
    ...(state.actionLog ?? []),
    {
      year: state.currentYear,
      month: state.currentMonth,
      type: 'pass_recall',
      message: `【关隘撤兵】自${pass.name}撤回 ${troops} 兵力归入${city.name}（当前城防守军 ${city.troops + troops}）。`,
    },
  ];

  return {
    ...state,
    cities: nextCities,
    passes: nextPasses,
    actionLog,
  };
}

export function repairPassWall(
  state: GameState,
  cityId: number,
  passId: number,
): GameState {
  const city = state.cities[cityId];
  if (!city) throw new Error(`城池不存在: ${cityId}`);
  if (!state.passes) throw new Error('关隘系统尚未初始化');
  const pass = state.passes[passId];
  if (!pass) throw new Error(`关隘不存在: ${passId}`);

  if (city.gold < PASS_WALL_REPAIR_GOLD) {
    throw new Error(`城池资金不足，修葺险要关隘需 ${PASS_WALL_REPAIR_GOLD} 贯`);
  }

  const { goldCost, wallGain } = calculatePassWallRepairCost(pass);
  if (wallGain <= 0) {
    throw new Error('关隘城防坚固完好，无需修葺');
  }

  const nextPasses = {
    ...state.passes,
    [passId]: {
      ...pass,
      wall: pass.wall + wallGain,
    },
  };

  const nextCities = {
    ...state.cities,
    [cityId]: {
      ...city,
      gold: city.gold - goldCost,
    },
  };

  const actionLog = [
    ...(state.actionLog ?? []),
    {
      year: state.currentYear,
      month: state.currentMonth,
      type: 'pass_repair',
      message: `【修缮险关】${city.name}拨款 ${goldCost} 贯修葺${pass.name}，关隘城防恢复 ${wallGain} 点（当前城防 ${pass.wall + wallGain}/${pass.maxWall}）。`,
    },
  ];

  return {
    ...state,
    cities: nextCities,
    passes: nextPasses,
    actionLog,
  };
}

export function capturePass(
  state: GameState,
  passId: number,
  conquerorFactionId: number,
  remainingTroops = 1000,
): GameState {
  if (!state.passes) throw new Error('关隘系统尚未初始化');
  const pass = state.passes[passId];
  if (!pass) throw new Error(`关隘不存在: ${passId}`);

  const nextPasses = {
    ...state.passes,
    [passId]: {
      ...pass,
      factionId: conquerorFactionId,
      troops: Math.min(remainingTroops, pass.maxGarrison),
      morale: 60,
      commanderId: undefined,
    },
  };

  const conqueror = state.factions[conquerorFactionId];
  const factionName = conqueror?.name ?? '敌方势力';

  const actionLog = [
    ...(state.actionLog ?? []),
    {
      year: state.currentYear,
      month: state.currentMonth,
      type: 'pass_captured',
      message: `【险关破城】${pass.name}被${factionName}强攻攻克！守军易主，关防失守。`,
    },
  ];

  return {
    ...state,
    passes: nextPasses,
    actionLog,
  };
}

/**
 * 月度关隘演变管线
 * - 严格 COW 保持原引用零 RNG 消耗，保证零漂移铁律
 * - 守将统帅>=75，士气月增 +2；无守将，士气每月 -1 (>=50)
 * - 空关耐久每月轻微自然风化 -10 (>=500)
 */
export function tickPassesMonth(state: GameState): GameState {
  if (!state.passes || Object.keys(state.passes).length === 0) {
    return state;
  }

  let hasChanged = false;
  const nextPasses: Record<number, PassEntity> = { ...state.passes };

  for (const [idStr, pass] of Object.entries(state.passes)) {
    const id = Number(idStr);
    let newMorale = pass.morale;
    let newWall = pass.wall;

    if (pass.troops > 0) {
      if (pass.commanderId != null && state.officers[pass.commanderId]) {
        const cmdr = state.officers[pass.commanderId];
        const leadership = cmdr.stats?.leadership ?? 60;
        if (leadership >= 75 && newMorale < 100) {
          newMorale = Math.min(100, newMorale + 2);
        }
      } else if (newMorale > 50) {
        newMorale = Math.max(50, newMorale - 1);
      }
    } else {
      // 彻底无人驻防空关城防风化
      if (newWall > 500) {
        newWall = Math.max(500, newWall - 10);
      }
    }

    if (newMorale !== pass.morale || newWall !== pass.wall) {
      hasChanged = true;
      nextPasses[id] = {
        ...pass,
        morale: newMorale,
        wall: newWall,
      };
    }
  }

  if (!hasChanged) {
    return state;
  }

  return {
    ...state,
    passes: nextPasses,
  };
}

export function getPassesSummary(state: GameState): PassSummaryItem[] {
  if (!state.passes) return [];
  return Object.values(state.passes).map((pass) => ({
    id: pass.id,
    name: pass.name,
    province: pass.province,
    factionId: pass.factionId,
    troops: pass.troops,
    morale: pass.morale,
    wall: pass.wall,
    maxWall: pass.maxWall,
    commanderName: pass.commanderId ? state.officers[pass.commanderId]?.name : undefined,
    isFortressPass: pass.isFortressPass,
    isMountainPass: pass.isMountainPass,
    isRiverPass: pass.isRiverPass,
    blocksRoutes: pass.blocksRoutes,
  }));
}
