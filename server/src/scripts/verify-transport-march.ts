// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 Session 402 · 交通→行军运输损耗减免验收。
 * 运行：pnpm verify-transport-march
 */
import {
  FormationType,
  UnitType,
  armyTransportForMarch,
  areMacroCitiesAdjacent,
  transportFoodLossReductionPct,
  transportMarchFoodMul,
} from '@leh/shared';
import { createGame, getGame } from '../services/game.js';
import {
  FOOD_PER_100_PER_TURN,
  buildCampaignNodes,
  startCampaign,
  tickCampaignMarch,
} from '../engine/campaign.js';

let pass = 0;
let fail = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${message}`);
  } else {
    fail++;
    console.error(`  ✗ ${message}`);
  }
}

console.log('Transport march food-loss consume verify');

assert(transportFoodLossReductionPct(0) === 0, '交通 0 → 减免 0%');
assert(transportFoodLossReductionPct(100) === 2, '交通 Lv1 → 减免 2%');
assert(transportFoodLossReductionPct(500) === 6, '交通 Lv3 → 减免 6%');
assert(transportFoodLossReductionPct(900) === 10, '交通 Lv5 → 减免 10%');
assert(Math.abs(transportMarchFoodMul(500) - 0.94) < 1e-9, 'Lv3 乘区 0.94');

createGame(1, 1);
const initial = getGame();
const fid = initial.playerFactionId;

type Pair = { fromId: number; targetId: number; commanderId: number };
let pair: Pair | null = null;
for (const from of Object.values(initial.cities)) {
  if (from.ruler !== fid || from.officers.length === 0) continue;
  for (const target of Object.values(initial.cities)) {
    if (target.ruler == null || target.ruler === fid) continue;
    if (!areMacroCitiesAdjacent(from.id, target.id)) continue;
    pair = { fromId: from.id, targetId: target.id, commanderId: from.officers[0]! };
    break;
  }
  if (pair) break;
}
assert(!!pair, '存在己方→邻接敌城出征对');
if (!pair) process.exit(1);

const fromCity = initial.cities[pair.fromId]!;
const troopCount = 3000;
const food = 2000;
const baseCost = Math.floor((troopCount / 100) * FOOD_PER_100_PER_TURN);
assert(baseCost === 90, `基准粮耗 ${baseCost}（期望 90）`);
assert(
  armyTransportForMarch(
    { [fromCity.id]: { ruler: fid, stats: { transport: 500 } } },
    fid,
    fromCity.id,
  ) === 500,
  '出发城读交通 500',
);

function marchFoodSpent(transport: number): number {
  const state = {
    ...initial,
    campaignNodes: buildCampaignNodes(initial),
    campaignArmies: [] as typeof initial.campaignArmies,
    cities: {
      ...initial.cities,
      [fromCity.id]: {
        ...fromCity,
        troops: Math.max(fromCity.troops, troopCount + 500),
        food: Math.max(fromCity.food, 5000),
        stats: { ...fromCity.stats, transport },
      },
    },
  };
  const { state: marching } = startCampaign(state, {
    commanderId: pair!.commanderId,
    subCommanderIds: [],
    fromNodeId: pair!.fromId,
    targetNodeId: pair!.targetId,
    unitType: UnitType.HEAVY_INFANTRY,
    formation: FormationType.SQUARE,
    troopCount,
    food,
  });
  const after = tickCampaignMarch(marching);
  const army = after.campaignArmies[0];
  if (!army) throw new Error('行军后部队消失');
  return food - army.food;
}

const costNoTransport = marchFoodSpent(0);
assert(costNoTransport === baseCost, `无交通粮耗 ${costNoTransport}（期望 ${baseCost}）`);

const expectedWithTransport = Math.max(1, Math.floor(baseCost * transportMarchFoodMul(500)));
const costWithTransport = marchFoodSpent(500);
assert(
  costWithTransport === expectedWithTransport,
  `交通 Lv3 粮耗 ${costWithTransport}（期望 ${expectedWithTransport}）`,
);
assert(costWithTransport < costNoTransport, '交通减免使粮耗低于无交通');
assert(expectedWithTransport === 84, `Lv3 期望粮耗 84（实得公式 ${expectedWithTransport}）`);

console.log(`\nResult: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
