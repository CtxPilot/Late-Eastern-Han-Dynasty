// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 主线③续 · L2 调虎离山冒烟（Session 346）
 * 运行: pnpm verify-l2-lure-tiger
 */
import {
  PlotStage,
  PlotType,
  SpyStatus,
  UnitType,
  type GameState,
  type SpyAgent,
} from '@leh/shared';
import { GameStatePlotSchema } from '@leh/shared';
import {
  LURE_TIGER_EFFECT_MONTHS,
  LURE_TIGER_INSTALLMENT_MONTHS,
  LURE_TIGER_MONTHLY_GOLD,
  LURE_TIGER_UPFRONT_GOLD,
  LURE_TIGER_WALL_MUL,
  cancelPlot,
  getLureTigerWallMul,
  launchPlot,
  listLureTigerCandidates,
  listLureTigerDestCities,
  tickPlotsMonth,
} from '../engine/plot.js';
import { runAutoBattle } from '../engine/campaign.js';
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

function seedFemaleSpy(state: GameState, factionId: number): { state: GameState; agentId: string } {
  const intel = state.intel;
  const home = Object.values(state.cities).find((c) => c.ruler === factionId);
  if (!intel || !home) return { state, agentId: '' };
  const agentId = 'spy-lure-test';
  const agent: SpyAgent = {
    id: agentId,
    factionId,
    name: '红袖',
    rank: 2,
    exp: 0,
    skills: { recon: 40, sabotage: 20, lethal: 20, tradecraft: 50 },
    status: SpyStatus.IDLE,
    homeCityId: home.id,
    locationCityId: home.id,
    captiveByFactionId: null,
    cooldownMonths: 0,
    missionsDone: 0,
    agentKind: 'female',
  };
  return {
    agentId,
    state: {
      ...state,
      intel: {
        ...intel,
        agents: { ...intel.agents, [agentId]: agent },
        nextAgentSeq: Math.max(intel.nextAgentSeq, 2),
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

function pickLureTarget(state: GameState, player: number) {
  const enemyCities = Object.values(state.cities).filter(
    (c) => c.ruler != null && c.ruler !== player,
  );
  for (const city of enemyCities) {
    const dests = listLureTigerDestCities(state, city.id);
    const tigers = listLureTigerCandidates(state, city.id);
    if (dests.length > 0 && tigers.length > 0) {
      return { city, dests, tigers };
    }
  }
  return null;
}

console.log('L2 lureTiger verify');

createGame(1, 1);
let state = getGame();
const player = state.playerFactionId;
const target = pickLureTarget(state, player);
assert(!!target, '存在可诱离的敌城（有守将且同势力≥2城）');
if (!target) {
  console.error(`FAIL ${fail}`);
  process.exit(1);
}

const enemyCity = target.city;
const tiger = target.tigers[0]!;

let noSpyRejected = false;
try {
  launchPlot(
    state,
    { type: PlotType.LURE_TIGER, factionId: player, targetCityId: enemyCity.id },
    () => 0.1,
  );
} catch (e) {
  noSpyRejected = e instanceof Error && e.message.includes('女间谍');
}
assert(noSpyRejected, '未派女间谍时发起被拒绝');

const seeded = seedFemaleSpy(state, player);
state = seeded.state;
const agentId = seeded.agentId;
assert(!!agentId, '注入空闲女间谍');

let noIntelRejected = false;
try {
  launchPlot(
    state,
    { type: PlotType.LURE_TIGER, factionId: player, targetCityId: enemyCity.id, agentId },
    () => 0.1,
  );
} catch (e) {
  noIntelRejected = e instanceof Error && e.message.includes('detailed');
}
assert(noIntelRejected, '无 detailed 情报时发起被拒绝');

state = seedDetailedIntel(state, enemyCity.id);
state = enrichGold(state, player, LURE_TIGER_UPFRONT_GOLD + LURE_TIGER_MONTHLY_GOLD * 4);

const beforeGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);

state = launchPlot(
  state,
  {
    type: PlotType.LURE_TIGER,
    factionId: player,
    targetCityId: enemyCity.id,
    targetOfficerId: tiger.id,
    agentId,
  },
  () => 0.1,
);

const launched = (state.plots ?? []).find((p) => p.type === PlotType.LURE_TIGER);
assert(!!launched, '发起调虎离山写入 plots');
assert(launched?.stage === PlotStage.PREP, '发起后处于 PREP');
assert(launched?.monthsLeft === LURE_TIGER_INSTALLMENT_MONTHS, `PREP ${LURE_TIGER_INSTALLMENT_MONTHS} 月`);
assert(launched?.layer === 'strategic', 'layer=strategic');
assert(launched?.agentId === agentId, '绑定女间谍');
assert(launched?.targetOfficerId === tiger.id, '记录诱离目标');
assert(state.intel?.agents?.[agentId]?.status === SpyStatus.DEPLOYED, '女间谍 DEPLOYED');

const afterLaunchGold = Object.values(state.cities)
  .filter((c) => c.ruler === player)
  .reduce((s, c) => s + c.gold, 0);
assert(afterLaunchGold === beforeGold - LURE_TIGER_UPFRONT_GOLD, `首付扣金 ${LURE_TIGER_UPFRONT_GOLD}`);

assert(
  GameStatePlotSchema.safeParse({ plots: state.plots ?? [] }).success,
  'GameStatePlotSchema 接受 PREP 调虎离山',
);

state = tickPlotsMonth(state, () => 0.5);
const midPrep = (state.plots ?? []).find((p) => p.id === launched!.id);
assert(midPrep?.stage === PlotStage.PREP, '第 1 月仍 PREP');
assert((midPrep?.installments?.paidMonths ?? 0) === 1, '已完投 1 期');

state = tickPlotsMonth(state, makeRng([0.1, 0.9, 0]));
const afterPrep = (state.plots ?? []).find((p) => p.id === launched!.id);
assert(afterPrep?.stage === PlotStage.ACTIVE, `完投后 ACTIVE（实际 ${afterPrep?.stage}）`);
assert(afterPrep?.result?.success === true, '成功结算');
assert(afterPrep?.result?.detected === false, '未识破');
assert(afterPrep?.monthsLeft === LURE_TIGER_EFFECT_MONTHS, `生效 ${LURE_TIGER_EFFECT_MONTHS} 月`);
assert(state.officers[tiger.id]?.location !== enemyCity.id, '守将已离原城');
assert(
  !state.cities[enemyCity.id]!.officers.includes(tiger.id),
  '原城 officers 清单已移除守将',
);
assert(getLureTigerWallMul(state, enemyCity.id) === LURE_TIGER_WALL_MUL, '城防倍率 0.5');
assert(state.intel?.agents?.[agentId]?.status === SpyStatus.IDLE, '结算后女间谍回收 IDLE');

const atkArmy = {
  id: 'army-lure',
  factionId: player,
  commanderId: state.factions[player]!.rulerId,
  subCommanderIds: [],
  advisorId: undefined,
  name: '讨伐军',
  unitType: UnitType.HEAVY_INFANTRY,
  troops: 5000,
  maxTroops: 5000,
  morale: 90,
  organization: 70,
  fatigue: 0,
  experience: 0,
  formation: 0,
  squads: [],
  currentCityId: 1,
  currentNodeId: 1,
  targetNodeId: enemyCity.id,
  fromNodeId: 1,
  phase: 'sieging' as const,
  path: [],
  structures: [],
  supplies: 0,
  perMonthSupplies: 0,
  food: 1000,
  maxFood: 2000,
};
const battle = runAutoBattle(
  state,
  atkArmy,
  null,
  { cityId: enemyCity.id, garrison: 5000, wall: 100 },
  makeRng([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]),
);
assert(
  battle.events.some((e) => e.type === 'stratagem' && e.description.includes('调虎离山')),
  '自动战 events 记录城防减半',
);

for (let i = 0; i < LURE_TIGER_EFFECT_MONTHS; i++) {
  state = tickPlotsMonth(state, () => 0.5);
}
const done = (state.plots ?? []).find((p) => p.id === launched!.id);
assert(done?.stage === PlotStage.RESOLVED, '效果结束进入 RESOLVED');
assert(getLureTigerWallMul(state, enemyCity.id) === 1, '效果结束后城防倍率恢复 1');
assert(state.officers[tiger.id]?.location === enemyCity.id, '效果结束召回守将');

// 取消路径：新计 PREP 中止归还女间谍
createGame(1, 1);
let s2 = getGame();
const t2 = pickLureTarget(s2, player);
assert(!!t2, '取消路径仍有可诱离城');
const spy2 = seedFemaleSpy(s2, player);
s2 = spy2.state;
s2 = seedDetailedIntel(s2, t2!.city.id);
s2 = enrichGold(s2, player, LURE_TIGER_UPFRONT_GOLD + 200);
s2 = launchPlot(
  s2,
  {
    type: PlotType.LURE_TIGER,
    factionId: player,
    targetCityId: t2!.city.id,
    agentId: spy2.agentId,
  },
  () => 0.2,
);
const p2 = (s2.plots ?? []).find((p) => p.type === PlotType.LURE_TIGER && p.stage === PlotStage.PREP);
assert(!!p2, '第二条调虎离山 PREP');
s2 = cancelPlot(s2, p2!.id, player);
const cancelled = (s2.plots ?? []).find((p) => p.id === p2!.id);
assert(cancelled?.stage === PlotStage.RESOLVED, '提前终止进入 RESOLVED');
assert(cancelled?.result?.success === false, '终止不计成功');
assert(s2.intel?.agents?.[spy2.agentId]?.status === SpyStatus.IDLE, '终止后女间谍归还 IDLE');

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
