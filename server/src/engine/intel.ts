// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 城池情报报告辅助（人员任务见 spy.ts）
 */
import { addMonths, emptyIntel, type GameState } from '@leh/shared';

/** 开战时自动获得表面情报 */
export function grantBattleIntel(state: GameState, cityId: number): GameState {
  const city = state.cities[cityId];
  if (!city || city.ruler === state.playerFactionId) return state;
  const exp = addMonths(state.currentYear, state.currentMonth, 1);
  const intel = state.intel ?? emptyIntel();
  const prev = intel.cities?.[cityId];
  if (prev?.depth === 'detailed') return state;
  return {
    ...state,
    intel: {
      ...intel,
      cities: {
        ...(intel.cities ?? {}),
        [cityId]: {
          depth: 'surface',
          expireYear: exp.year,
          expireMonth: exp.month,
          source: 'battle',
        },
      },
      agents: intel.agents ?? {},
      cityDefense: intel.cityDefense ?? {},
      nextAgentSeq: intel.nextAgentSeq ?? 1,
      recentMissions: intel.recentMissions ?? [],
    },
  };
}
