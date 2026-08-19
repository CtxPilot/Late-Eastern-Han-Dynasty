// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 主线③续 · L2 指桑骂槐冒烟（Session 343）
 * 运行: pnpm verify-l2-kill-chicken
 */
import {
  PlotStage,
  PlotType,
  type GameState,
} from '@leh/shared';
import { GameStatePlotSchema } from '@leh/shared';
import {
  KILL_CHICKEN_BOOST_MAX,
  KILL_CHICKEN_BOOST_MIN,
  KILL_CHICKEN_GOLD,
  KILL_CHICKEN_LOYALTY_THRESHOLD,
  KILL_CHICKEN_MIN_LOW,
  KILL_CHICKEN_VICTIM_DROP,
  cancelPlot,
  launchPlot,
  listKillChickenCandidates,
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
      [city.id]: { ...city, gold: city.gold + gold },
    },
  };
}

/** 压低己方非君主忠诚，确保前置可达 */
function depressLoyalty(state: GameState, factionId: number, n: number): GameState {
  const rulerId = state.factions[factionId]?.rulerId;
  const pool = Object.values(state.officers)
    .filter(
      (o) =>
        o.faction === factionId &&
        String(o.status) === 'active' &&
        o.id !== rulerId,
    )
    .sort((a, b) => a.id - b.id)
    .slice(0, n);
  const officers = { ...state.officers };
  for (const o of pool) {
    officers[o.id] = { ...o, loyalty: 50 };
  }
  return { ...state, officers };
}

console.log('L2 killChicken verify');

createGame(1, 1);
let state = getGame();
const player = state.playerFactionId;

// 默认可能不足 2 人低忠诚 → 拒绝
let tooFewRejected = false;
try {
  launchPlot(
    state,
    { type: PlotType.KILL_CHICKEN, factionId: player },
    () => 0.1,
  );
} catch (e) {
  tooFewRejected = e instanceof Error && e.message.includes('至少');
}
assert(tooFewRejected, '低忠诚不足时发起被拒绝');

state = depressLoyalty(state, player, KILL_CHICKEN_MIN_LOW);
const candidates = listKillChickenCandidates(state, player);
assert(candidates.length >= KILL_CHICKEN_MIN_LOW, `压低后候选≥${KILL_CHICKEN_MIN_LOW}`);

// 金不足
let noGoldRejected = false;
const lowGold = {
  ...state,
  cities: Object.fromEntries(
    Object.values(state.cities).map((c) =>
      c.ruler === player
        ? [c.id, { ...c, gold: KILL_CHICKEN_GOLD - 1 }]
        : [c.id, c],
    ),
  ),
} as GameState;
try {
  launchPlot(
    lowGold,
    { type: PlotType.KILL_CHICKEN, factionId: player },
    () => 0.1,
  );
} catch {
  noGoldRejected = true;
}
assert(noGoldRejected, '金不足发起被拒绝');

state = enrichGold(state, player, KILL_CHICKEN_GOLD + 50);
const beforeGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);

const victimId = candidates[0]!.id;
const beforeVictim = state.officers[victimId]!.loyalty;
const othersBefore = Object.values(state.officers)
  .filter(
    (o) =>
      o.faction === player &&
      String(o.status) === 'active' &&
      o.id !== state.factions[player]?.rulerId &&
      o.id !== victimId,
  )
  .map((o) => ({ id: o.id, loyalty: o.loyalty }));

// 指定儆猴；RNG：plotId + 各其余将 boost
state = launchPlot(
  state,
  {
    type: PlotType.KILL_CHICKEN,
    factionId: player,
    targetOfficerId: victimId,
  },
  makeRng([0.42, 0.0, 0.5, 1.0, 0.25, 0.75, 0.1, 0.9, 0.3, 0.6]),
);

const afterGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);
assert(afterGold === beforeGold - KILL_CHICKEN_GOLD, `扣金 ${KILL_CHICKEN_GOLD}`);

const plot = (state.plots ?? []).find((p) => p.type === PlotType.KILL_CHICKEN);
assert(!!plot, '计谋记录存在');
assert(plot!.stage === PlotStage.RESOLVED, '即时 RESOLVED');
assert(plot!.monthsLeft === 0, 'monthsLeft=0');
assert(plot!.layer === 'strategic', 'layer=strategic');
assert(plot!.targetOfficerId === victimId, 'targetOfficerId=儆猴');
assert(plot!.result?.success === true, 'result.success');
assert(plot!.result?.detected === false, '无识破');
assert(
  state.officers[victimId]!.loyalty ===
    Math.max(0, beforeVictim - KILL_CHICKEN_VICTIM_DROP),
  `儆猴忠诚−${KILL_CHICKEN_VICTIM_DROP}`,
);

for (const o of othersBefore) {
  const after = state.officers[o.id]!.loyalty;
  const delta = after - o.loyalty;
  assert(
    delta >= 0 && delta <= KILL_CHICKEN_BOOST_MAX,
    `${o.id} 忠诚增量在 0~${KILL_CHICKEN_BOOST_MAX}`,
  );
  if (o.loyalty < 100) {
    assert(
      delta >= KILL_CHICKEN_BOOST_MIN || after === 100,
      `${o.id} 至少+${KILL_CHICKEN_BOOST_MIN}或封顶`,
    );
  }
}

assert(
  !!state.actionLog.find((e) => e.type === 'plot_resolve' && e.message.includes('指桑骂槐')),
  'actionLog 有结算',
);

// Schema 往返
assert(
  (() => {
    try {
      GameStatePlotSchema.parse({ plots: state.plots ?? [] });
      return true;
    } catch {
      return false;
    }
  })(),
  'GameStatePlotSchema 接受指桑骂槐 RESOLVED',
);

// 已结算不可取消
let cancelRejected = false;
try {
  cancelPlot(state, plot!.id, player);
} catch {
  cancelRejected = true;
}
assert(cancelRejected, '已结算不可 cancelPlot');

// 非法目标拒绝
let badTargetRejected = false;
createGame(1, 1);
let s2 = depressLoyalty(enrichGold(getGame(), player, 200), player, 2);
const rulerId = s2.factions[player]?.rulerId;
try {
  launchPlot(
    s2,
    { type: PlotType.KILL_CHICKEN, factionId: player, targetOfficerId: rulerId },
    () => 0.1,
  );
} catch (e) {
  badTargetRejected = e instanceof Error && e.message.includes('儆猴目标');
}
assert(badTargetRejected, '君主不可作儆猴目标');

// 随机选取路径：不传 targetOfficerId
createGame(1, 1);
let s3 = depressLoyalty(enrichGold(getGame(), player, 200), player, 3);
const pool = listKillChickenCandidates(s3, player);
s3 = launchPlot(
  s3,
  { type: PlotType.KILL_CHICKEN, factionId: player },
  makeRng([0.0, 0.2, 0.4, 0.6, 0.8, 0.1, 0.3]),
);
const p3 = (s3.plots ?? []).find((p) => p.type === PlotType.KILL_CHICKEN);
assert(!!p3?.targetOfficerId && pool.some((o) => o.id === p3.targetOfficerId), '随机儆猴落在候选池');
assert(
  s3.officers[p3!.targetOfficerId!]!.loyalty <
    KILL_CHICKEN_LOYALTY_THRESHOLD ||
    s3.officers[p3!.targetOfficerId!]!.loyalty ===
      Math.max(
        0,
        pool.find((o) => o.id === p3!.targetOfficerId)!.loyalty -
          KILL_CHICKEN_VICTIM_DROP,
      ),
  '随机儆猴已扣忠诚',
);

console.log(`\n结果: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
