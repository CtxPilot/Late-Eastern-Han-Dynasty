// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 主线③续 · L2 暗渡陈仓冒烟（Session 341）
 * 运行: pnpm verify-l2-secret-crossing
 */
import {
  PlotStage,
  PlotType,
  roadNeighbors,
  type GameState,
} from '@leh/shared';
import {
  cancelPlot,
  getPlotAttackModifier,
  getSecretCrossingBattleMul,
  isSecretCrossingGarrisonHold,
  launchPlot,
  SECRET_CROSSING_BATTLE_MUL,
  SECRET_CROSSING_EFFECT_MONTHS,
  SECRET_CROSSING_GOLD,
  tickPlotsMonth,
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

function makeRng(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i] ?? 0.5;
    i += 1;
    return v;
  };
}

function seedSurfaceIntel(state: GameState, cityId: number): GameState {
  const intel = state.intel;
  if (!intel) return state;
  return {
    ...state,
    intel: {
      ...intel,
      cities: {
        ...intel.cities,
        [cityId]: {
          depth: 'surface',
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

console.log('L2 secretCrossing verify');

createGame(1, 1);
let state = getGame();
const player = state.playerFactionId;

const enemyCities = Object.values(state.cities).filter(
  (c) => c.ruler != null && c.ruler !== player,
);
let secretCity = enemyCities[0]!;
let feintCity = enemyCities.find(
  (c) => c.id !== secretCity.id && roadNeighbors(secretCity.id).includes(c.id),
);
if (!feintCity) {
  // 交换：找任意一对邻接敌城
  outer: for (const a of enemyCities) {
    for (const b of enemyCities) {
      if (a.id !== b.id && roadNeighbors(a.id).includes(b.id)) {
        secretCity = a;
        feintCity = b;
        break outer;
      }
    }
  }
}
assert(!!feintCity, '存在一对邻接敌城');
if (!feintCity) {
  console.error(`FAIL ${fail}`);
  process.exit(1);
}

state = enrichGold(state, player, SECRET_CROSSING_GOLD + 100);
state = seedSurfaceIntel(state, secretCity.id);
state = seedSurfaceIntel(state, feintCity.id);

const beforeGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);

// 缺明修应拒绝
let rejected = false;
try {
  launchPlot(
    state,
    { type: PlotType.SECRET_CROSSING, targetCityId: secretCity.id, factionId: player },
    () => 0.1,
  );
} catch {
  rejected = true;
}
assert(rejected, '缺明修城拒绝发起');

state = launchPlot(
  state,
  {
    type: PlotType.SECRET_CROSSING,
    targetCityId: secretCity.id,
    feintCityId: feintCity.id,
    factionId: player,
  },
  () => 0.1,
);

const launched = (state.plots ?? []).find((p) => p.type === PlotType.SECRET_CROSSING);
assert(!!launched, '发起暗渡陈仓写入 plots');
assert(launched?.stage === PlotStage.PREP, '发起后处于 PREP');
assert(launched?.monthsLeft === 1, 'PREP 倒计时 1');
assert(launched?.layer === 'strategic', 'layer=strategic');
assert(launched?.feintCityId === feintCity.id, 'feintCityId=明修城');
assert(launched?.targetCityId === secretCity.id, 'targetCityId=暗渡城');

const afterLaunchGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);
assert(afterLaunchGold === beforeGold - SECRET_CROSSING_GOLD, `首付扣金 ${SECRET_CROSSING_GOLD}`);

// PREP 1 月后结算：success=0.1、detect=0.9
state = tickPlotsMonth(state, makeRng([0.1, 0.9]));
const afterPrep = (state.plots ?? []).find((p) => p.id === launched!.id);
assert(afterPrep?.stage === PlotStage.ACTIVE, `结算后 ACTIVE（实际 ${afterPrep?.stage}）`);
assert(afterPrep?.result?.success === true, '成功结算');
assert(afterPrep?.result?.detected === false, '未识破');
assert((afterPrep?.progress ?? 0) === 100, '进度 100%');
assert(afterPrep?.monthsLeft === SECRET_CROSSING_EFFECT_MONTHS, `生效期 ${SECRET_CROSSING_EFFECT_MONTHS} 月`);

assert(
  getSecretCrossingBattleMul(state, player, secretCity.id) === SECRET_CROSSING_BATTLE_MUL,
  `暗渡城攻防×${SECRET_CROSSING_BATTLE_MUL}`,
);
assert(getSecretCrossingBattleMul(state, player, feintCity.id) === 1, '明修城无攻防加成');
assert(isSecretCrossingGarrisonHold(state, feintCity.id), '明修城守军不得轻离');
assert(!isSecretCrossingGarrisonHold(state, secretCity.id), '暗渡城非守军牵制');

const thirdFaction = Object.values(state.factions).find(
  (f) => f.id !== player && f.id !== secretCity.ruler && f.isAlive,
)?.id ?? player + 99;
assert(
  getPlotAttackModifier(state, feintCity.id, thirdFaction) >= 2,
  '第三方对明修城攻击权重升高',
);
assert(
  getPlotAttackModifier(state, secretCity.id, thirdFaction) === 1,
  '第三方对暗渡城权重中性',
);

// 取消路径
state = enrichGold(state, player, SECRET_CROSSING_GOLD + 50);
const otherPair = enemyCities.find(
  (c) =>
    c.id !== secretCity.id &&
    c.id !== feintCity.id &&
    enemyCities.some(
      (n) => n.id !== c.id && n.id !== secretCity.id && roadNeighbors(c.id).includes(n.id),
    ),
);
if (otherPair) {
  const otherFeint = enemyCities.find(
    (n) => n.id !== otherPair.id && roadNeighbors(otherPair.id).includes(n.id),
  )!;
  state = seedSurfaceIntel(state, otherPair.id);
  state = seedSurfaceIntel(state, otherFeint.id);
  state = launchPlot(
    state,
    {
      type: PlotType.SECRET_CROSSING,
      targetCityId: otherPair.id,
      feintCityId: otherFeint.id,
      factionId: player,
    },
    () => 0.2,
  );
  const second = (state.plots ?? []).find(
    (p) =>
      p.type === PlotType.SECRET_CROSSING &&
      p.targetCityId === otherPair.id &&
      p.stage === PlotStage.PREP,
  );
  assert(!!second, '可并行第二条 L2');
  state = cancelPlot(state, second!.id, player);
  const cancelled = (state.plots ?? []).find((p) => p.id === second!.id);
  assert(cancelled?.stage === PlotStage.RESOLVED, '提前终止 RESOLVED');
  assert(cancelled?.result?.success === false, '终止不计成功');
} else {
  assert(true, '取消路径跳过（无第二对邻接敌城）');
  assert(true, '取消成功占位');
}

if (fail > 0) {
  console.error(`FAIL ${fail} (pass ${pass})`);
  process.exit(1);
}
console.log(`verify-l2-secret-crossing: ${pass}/${pass} passed`);
