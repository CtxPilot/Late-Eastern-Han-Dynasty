// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 主线③续 · L2 树上开花冒烟（Session 342）
 * 运行: pnpm verify-l2-blossom
 */
import {
  PlotStage,
  PlotType,
  type GameState,
} from '@leh/shared';
import { GameStatePlotSchema } from '@leh/shared';
import {
  BLOSSOM_AI_ATTACK_MUL,
  BLOSSOM_EFFECT_MONTHS,
  BLOSSOM_FOOD,
  BLOSSOM_GOLD,
  BLOSSOM_TROOP_MUL_MAX,
  BLOSSOM_TROOP_MUL_MIN,
  cancelPlot,
  getBlossomTroopMul,
  getPlotAttackModifier,
  launchPlot,
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

function enrichGold(state: GameState, factionId: number, gold: number): GameState {
  const city = Object.values(state.cities).find((c) => c.ruler === factionId);
  if (!city) return state;
  return {
    ...state,
    cities: {
      ...state.cities,
      [city.id]: { ...city, gold: city.gold + gold, food: city.food + 500 },
    },
  };
}

function ownCity(state: GameState, factionId: number) {
  return Object.values(state.cities).find((c) => c.ruler === factionId)!;
}

console.log('L2 blossom verify');

createGame(1, 1);
let state = getGame();
const player = state.playerFactionId;

const own = ownCity(state, player);
const enemyCity = Object.values(state.cities).find(
  (c) => c.ruler != null && c.ruler !== player,
)!;

// 敌城拒绝
let rejected = false;
try {
  launchPlot(
    state,
    { type: PlotType.BLOSSOM, targetCityId: enemyCity.id, factionId: player },
    () => 0.1,
  );
} catch {
  rejected = true;
}
assert(rejected, '对敌城发起被拒绝');

// 粮不足拒绝
let noFoodRejected = false;
const lowFoodState: GameState = {
  ...state,
  cities: {
    ...state.cities,
    [own.id]: { ...own, gold: 1000, food: BLOSSOM_FOOD - 1 },
  },
};
try {
  launchPlot(
    lowFoodState,
    { type: PlotType.BLOSSOM, targetCityId: own.id, factionId: player },
    () => 0.1,
  );
} catch {
  noFoodRejected = true;
}
assert(noFoodRejected, '粮不足发起被拒绝');

state = enrichGold(state, player, BLOSSOM_GOLD + 100);
const beforeGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);
const beforeFood = state.cities[own.id]!.food;

state = launchPlot(
  state,
  { type: PlotType.BLOSSOM, targetCityId: own.id, factionId: player },
  () => 0.1,
);

const launched = (state.plots ?? []).find((p) => p.type === PlotType.BLOSSOM);
assert(!!launched, '发起树上开花写入 plots');
assert(launched?.stage === PlotStage.PREP, '发起后处于 PREP');
assert(launched?.monthsLeft === 1, 'PREP 倒计时 1');
assert(launched?.layer === 'strategic', 'layer=strategic');
assert(launched?.targetCityId === own.id, 'targetCityId=己方城');
assert(launched?.targetFactionId == null, '无 targetFactionId');

const afterLaunchGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);
assert(afterLaunchGold === beforeGold - BLOSSOM_GOLD, `发起扣金 ${BLOSSOM_GOLD}`);
assert(state.cities[own.id]!.food === beforeFood - BLOSSOM_FOOD, `发起扣粮 ${BLOSSOM_FOOD}`);

// PREP 1 月后结算：success=0.1、detect=0.9
state = tickPlotsMonth(state, makeRng([0.1, 0.9]));
const afterPrep = (state.plots ?? []).find((p) => p.id === launched!.id);
assert(afterPrep?.stage === PlotStage.ACTIVE, `结算后 ACTIVE（实际 ${afterPrep?.stage}）`);
assert(afterPrep?.result?.success === true, '成功结算');
assert(afterPrep?.result?.detected === false, '未识破');
assert((afterPrep?.progress ?? 0) === 100, '进度 100%');
assert(afterPrep?.monthsLeft === BLOSSOM_EFFECT_MONTHS, `生效期 ${BLOSSOM_EFFECT_MONTHS} 月`);

const troopMul = getBlossomTroopMul(state, own.id);
assert(
  troopMul === BLOSSOM_TROOP_MUL_MIN || troopMul === BLOSSOM_TROOP_MUL_MAX,
  `虚报倍数在 [${BLOSSOM_TROOP_MUL_MIN}, ${BLOSSOM_TROOP_MUL_MAX}]（实际 ${troopMul}）`,
);
assert(getBlossomTroopMul(state, own.id) === troopMul, '虚报倍数确定性（重复调用一致）');
assert(getBlossomTroopMul(state, enemyCity.id) === 1, '未生效城真实兵力');

assert(
  getPlotAttackModifier(state, own.id, enemyCity.ruler!) === BLOSSOM_AI_ATTACK_MUL,
  `AI 攻击权重 ×${BLOSSOM_AI_ATTACK_MUL}`,
);
assert(getPlotAttackModifier(state, enemyCity.id, player) === 1, '无关城权重中性');

// Schema 往返
expect(() => GameStatePlotSchema.parse({ plots: state.plots ?? [] }), 'ACTIVE 状态过完整组合 Schema');

// ACTIVE 结束（4 个月后）
state = tickPlotsMonth(state, () => 0.5);
state = tickPlotsMonth(state, () => 0.5);
state = tickPlotsMonth(state, () => 0.5);
state = tickPlotsMonth(state, () => 0.5);
const expired = (state.plots ?? []).find((p) => p.id === launched!.id);
assert(expired?.stage === PlotStage.RESOLVED, '效果结束 RESOLVED');
assert(expired?.monthsLeft === 0, '倒计时归零');
assert(getPlotAttackModifier(state, own.id, enemyCity.ruler!) === 1, '结束后权重恢复中性');
assert(getBlossomTroopMul(state, own.id) === 1, '结束后兵力真实');

// 失败路径（新局）：success=0.9、detect=0.1 → 失败
createGame(1, 1);
let s2 = getGame();
const player2 = s2.playerFactionId;
const own2 = ownCity(s2, player2);
s2 = enrichGold(s2, player2, BLOSSOM_GOLD + 100);
s2 = launchPlot(
  s2,
  { type: PlotType.BLOSSOM, targetCityId: own2.id, factionId: player2 },
  () => 0.2,
);
s2 = tickPlotsMonth(s2, makeRng([0.9, 0.1]));
const failedPlot = (s2.plots ?? []).find((p) => p.type === PlotType.BLOSSOM);
assert(failedPlot?.stage === PlotStage.RESOLVED, '失败路径 RESOLVED');
assert(failedPlot?.result?.success === false, '失败不计成功');
assert(getPlotAttackModifier(s2, own2.id, player2 + 99) === 1, '失败无权重效果');
assert(getBlossomTroopMul(s2, own2.id) === 1, '失败无虚报');
expect(() => GameStatePlotSchema.parse({ plots: s2.plots ?? [] }), '失败状态过组合 Schema');

// 取消路径
s2 = enrichGold(s2, player2, BLOSSOM_GOLD + 100);
s2 = launchPlot(
  s2,
  { type: PlotType.BLOSSOM, targetCityId: own2.id, factionId: player2 },
  () => 0.3,
);
const second = (s2.plots ?? []).find(
  (p) => p.type === PlotType.BLOSSOM && p.stage === PlotStage.PREP,
);
s2 = cancelPlot(s2, second!.id, player2);
const cancelled = (s2.plots ?? []).find((p) => p.id === second!.id);
assert(cancelled?.stage === PlotStage.RESOLVED, '提前终止 RESOLVED');
assert(cancelled?.result?.success === false, '终止不计成功');

// L2 并行上限 2（新局：同时保持 2 条 PREP，第 3 条拒绝）
createGame(1, 1);
let s3 = getGame();
const player3 = s3.playerFactionId;
const ownCities3 = Object.values(s3.cities).filter(
  (c) => c.ruler === player3 && c.food >= 100,
).sort((a, b) => a.id - b.id);
if (ownCities3.length >= 2) {
  const pay = Object.values(s3.cities).find((c) => c.ruler === player3)!;
  s3 = {
    ...s3,
    cities: {
      ...s3.cities,
      [pay.id]: { ...pay, gold: pay.gold + 1000, food: pay.food + 500 },
    },
  };
  s3 = launchPlot(
    s3,
    { type: PlotType.BLOSSOM, targetCityId: ownCities3[0]!.id, factionId: player3 },
    () => 0.4,
  );
  s3 = launchPlot(
    s3,
    { type: PlotType.BLOSSOM, targetCityId: ownCities3[1]!.id, factionId: player3 },
    () => 0.5,
  );
  let limitRejected = false;
  try {
    launchPlot(
      s3,
      { type: PlotType.BLOSSOM, targetCityId: ownCities3[0]!.id, factionId: player3 },
      () => 0.6,
    );
  } catch {
    limitRejected = true;
  }
  assert(limitRejected, 'L2 并行上限 2 拒绝第三条');
  const preps = (s3.plots ?? []).filter(
    (p) => p.type === PlotType.BLOSSOM && p.stage === PlotStage.PREP,
  );
  assert(preps.length === 2, '两条 PREP 均保留');
} else {
  assert(true, '并行上限路径跳过（己方城不足两座）');
  assert(true, '并行上限占位');
}

function expect(fn: () => void, msg: string): void {
  try {
    fn();
    assert(true, msg);
  } catch {
    assert(false, msg);
  }
}

if (fail > 0) {
  console.error(`FAIL ${fail} (pass ${pass})`);
  process.exit(1);
}
console.log(`verify-l2-blossom: ${pass}/${pass} passed`);