// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 势力经济汇总：城池金粮为真源，faction.gold/food 为缓存
 */
import type { GameState } from '@leh/shared';

/** 按己方城池汇总金粮，写回所有势力（含灭亡势力归零） */
export function syncFactionResources(state: GameState): GameState {
  const factions = { ...state.factions };
  for (const fid of Object.keys(factions).map(Number)) {
    const f = factions[fid];
    if (!f) continue;
    let gold = 0;
    let food = 0;
    for (const c of Object.values(state.cities)) {
      if (c.ruler === fid) {
        gold += c.gold;
        food += c.food;
      }
    }
    factions[fid] = { ...f, gold, food };
  }
  return { ...state, factions };
}
