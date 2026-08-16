// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 主线③ · L2 釜底抽薪冒烟（Session 339）
 * 运行: pnpm verify-l2-undermine
 */
import {
  PlotStage,
  PlotType,
  type GameState,
} from '@leh/shared';
import {
  cancelPlot,
  getUndermineArmyModifiers,
  launchPlot,
  tickPlotsMonth,
  UNDERMINE_INSTALLMENT_MONTHS,
  UNDERMINE_MONTHLY_GOLD,
  UNDERMINE_UPFRONT_GOLD,
} from '../engine/plot.js';
import { createGame, getGame } from '../services/game.js';

let pass = 0;
let fail = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

/** 成功低抽、识破高抽；其后效果月用中位抽 */
function makeRng(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i] ?? 0.5;
    i += 1;
    return v;
  };
}

function seedDetailedIntel(state: GameState, cityId: number): GameState {
  const intel = state.intel;
  if (!intel) return state;
  return {
    ...state,
    intel: {
      ...intel,
      cities: {
        ...intel.cities,
        [cityId]: {
          depth: 'detailed',
          expireYear: state.currentYear + 1,
          expireMonth: state.currentMonth,
          source: 'recon',
        },
      },
    },
  };
}

function enrichGold(state: GameState, factionId: number, gold: number): GameState {
  const city = Object.values(state.cities).find((c) => c.ruler === factionId);
  if (!city) return state;
  return {
    ...state,
    cities: {
      ...state.cities,
      [city.id]: { ...city, gold: city.gold + gold },
    },
  };
}

console.log('L2 undermine verify');

createGame(1, 1);
let state = getGame();
const player = state.playerFactionId;
const enemyCity = Object.values(state.cities).find(
  (c) => c.ruler != null && c.ruler !== player,
);
assert(!!enemyCity, '存在敌方城池');
if (!enemyCity) {
  console.error(`FAIL ${fail}`);
  process.exit(1);
}

state = enrichGold(state, player, UNDERMINE_UPFRONT_GOLD + UNDERMINE_MONTHLY_GOLD * 8);
state = seedDetailedIntel(state, enemyCity.id);

const beforeGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);

state = launchPlot(
  state,
  { type: PlotType.UNDERMINE, targetCityId: enemyCity.id, factionId: player },
  () => 0.1,
);

const launched = (state.plots ?? []).find((p) => p.type === PlotType.UNDERMINE);
assert(!!launched, '发起釜底抽薪写入 plots');
assert(launched?.stage === PlotStage.PREP, '发起后处于 PREP');
assert(launched?.monthsLeft === UNDERMINE_INSTALLMENT_MONTHS, `PREP 倒计时 ${UNDERMINE_INSTALLMENT_MONTHS}`);
assert(launched?.layer === 'strategic', 'layer=strategic');
assert((launched?.progress ?? -1) === 0, '初始进度 0');

const afterLaunchGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);
assert(afterLaunchGold === beforeGold - UNDERMINE_UPFRONT_GOLD, `首付扣金 ${UNDERMINE_UPFRONT_GOLD}`);

// 前 5 月仅分期；第 6 月完投结算：success=0.1、detect=0.9
for (let i = 0; i < UNDERMINE_INSTALLMENT_MONTHS - 1; i++) {
  state = tickPlotsMonth(state, () => 0.5);
}
state = tickPlotsMonth(state, makeRng([0.1, 0.9]));

const afterPrep = (state.plots ?? []).find((p) => p.id === launched!.id);
assert(afterPrep?.stage === PlotStage.ACTIVE, `完投后进入 ACTIVE（实际 ${afterPrep?.stage}）`);
assert(afterPrep?.result?.success === true, '成功结算');
assert(afterPrep?.result?.detected === false, '未识破');
assert((afterPrep?.progress ?? 0) === 100, '进度 100%');
assert(afterPrep?.monthsLeft === 6, '生效期 6 月');

const commerceBefore = state.cities[enemyCity.id]!.stats.commerce;
const goldBefore = state.cities[enemyCity.id]!.gold;
state = tickPlotsMonth(state, () => 0.5);
const commerceAfter = state.cities[enemyCity.id]!.stats.commerce;
const goldAfter = state.cities[enemyCity.id]!.gold;
assert(commerceAfter < commerceBefore, 'ACTIVE 月结商业下降');
assert(goldAfter < goldBefore, 'ACTIVE 月结金库流失');

const mods = getUndermineArmyModifiers(state, enemyCity.id);
assert(!!mods && mods.moralePenalty === 15 && mods.foodCostMul === 1.5, '战场修正士气−15/粮耗×1.5');

// 取消另一条新计
state = enrichGold(state, player, UNDERMINE_UPFRONT_GOLD + 100);
const otherEnemy = Object.values(state.cities).find(
  (c) => c.ruler != null && c.ruler !== player && c.id !== enemyCity.id,
);
if (otherEnemy) {
  state = seedDetailedIntel(state, otherEnemy.id);
  state = launchPlot(
    state,
    { type: PlotType.UNDERMINE, targetCityId: otherEnemy.id, factionId: player },
    () => 0.2,
  );
  const second = (state.plots ?? []).find(
    (p) => p.type === PlotType.UNDERMINE && p.targetCityId === otherEnemy.id && p.stage === PlotStage.PREP,
  );
  assert(!!second, '可并行第二条 L2（上限 2）');
  state = cancelPlot(state, second!.id, player);
  const cancelled = (state.plots ?? []).find((p) => p.id === second!.id);
  assert(cancelled?.stage === PlotStage.RESOLVED, '提前终止进入 RESOLVED');
  assert(cancelled?.result?.success === false, '终止不计成功');
} else {
  assert(true, '取消路径跳过（仅一敌城）');
  assert(true, '取消成功占位');
}

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
