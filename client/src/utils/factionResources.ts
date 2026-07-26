// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { GameState } from '@leh/shared';

/** 城池库存是即时资源真源；势力汇总展示统一从当前所属城池派生。 */
export function getFactionResourceTotals(game: GameState, factionId: number) {
  let cityCount = 0;
  let troops = 0;
  let gold = 0;
  let food = 0;

  for (const city of Object.values(game.cities)) {
    if (city.ruler !== factionId) continue;
    cityCount += 1;
    troops += city.troops;
    gold += city.gold;
    food += city.food;
  }

  return { cityCount, troops, gold, food };
}
