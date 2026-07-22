// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  PlotStage,
  PlotType,
  SpyMissionType,
  SpyStatus,
  emptyIntel,
  playerCitiesAdjacentTo,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { launchPlot, tickPlotsMonth } from '../engine/plot.js';
import { dispatchMission, plantFemaleFromGift, recruitSpies, trainFemaleSpy } from '../engine/spy.js';
import { getRuntimeRngState, resetRuntimeRng, runtimeRandom } from '../runtime-rng.js';
import { createGame, getGame, restoreGameFromEnvelope } from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-22T15:00:00.000Z',
    updatedAt: '2026-07-22T15:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function verifyRoundTrip(
  save: SaveEnvelopeV1,
  run: (state: GameState) => GameState,
  label: string,
): { result: GameState; consumed: number } {
  restoreGameFromEnvelope(save);
  const expected = run(getGame());
  const consumed = getRuntimeRngState().draws - save.rng.draws;
  assert(consumed > 0, `${label}必须消费权威随机流`);

  restoreGameFromEnvelope(save);
  const actual = run(getGame());
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}读档后的完整结果必须一致`);
  assert(getRuntimeRngState().draws === save.rng.draws + consumed, `${label}读档后的 RNG 消费次数必须一致`);
  return { result: actual, consumed };
}

createGame(1, 1);
const initial = getGame();
const playerCityIds = Object.values(initial.cities)
  .filter((city) => city.ruler === initial.playerFactionId)
  .map((city) => city.id);
const home = initial.cities[playerCityIds[0]];
const enemyCity = Object.values(initial.cities).find(
  (city) =>
    city.ruler != null &&
    city.ruler !== initial.playerFactionId &&
    playerCitiesAdjacentTo(playerCityIds, city.id).length > 0,
);
if (!home || !enemyCity || enemyCity.ruler == null) {
  throw new Error('计谋谍报确定性验证缺少相邻敌我城市');
}
const enemyFactionId = enemyCity.ruler;

const prepared: GameState = {
  ...initial,
  cities: {
    ...initial.cities,
    [home.id]: { ...home, gold: 10_000, food: 10_000, troops: 1_000 },
  },
  factions: {
    ...initial.factions,
    [initial.playerFactionId]: {
      ...initial.factions[initial.playerFactionId],
      beautyStock: 10,
    },
  },
  intel: {
    ...emptyIntel(),
    cities: {
      [enemyCity.id]: {
        depth: 'detailed',
        expireYear: initial.currentYear + 1,
        expireMonth: initial.currentMonth,
        source: 'recon',
      },
    },
  },
};

resetRuntimeRng(0x1707_0000);
const launchCheck = verifyRoundTrip(
  envelopeFor(prepared),
  (state) => launchPlot(state, {
    type: PlotType.SOW_DISCORD,
    targetFactionId: enemyFactionId,
  }, runtimeRandom),
  '计谋创建与 ID 分配',
);
assert(launchCheck.result.plots[0]?.id.startsWith(`plot-${initial.playerFactionId}-`) === true, '计谋 ID 必须由权威随机流确定生成');

let fourPlots = launchPlot(prepared, {
  type: PlotType.HONEY_TRAP,
  targetCityId: enemyCity.id,
}, runtimeRandom);
fourPlots = launchPlot(fourPlots, {
  type: PlotType.SOW_DISCORD,
  targetFactionId: enemyFactionId,
}, runtimeRandom);
fourPlots = launchPlot(fourPlots, {
  type: PlotType.FALSE_INTEL,
  targetCityId: enemyCity.id,
}, runtimeRandom);
fourPlots = launchPlot(fourPlots, {
  type: PlotType.EMPTY_FORT,
  targetCityId: home.id,
}, runtimeRandom);

resetRuntimeRng(0x1707_0001);
const plotCheck = verifyRoundTrip(
  envelopeFor(fourPlots),
  (state) => tickPlotsMonth(state, runtimeRandom),
  '四类计谋结算',
);
const plotResults = plotCheck.result.plots;
assert(plotResults.length === 4, '美人计、离间计、假情报、空城疑兵必须全部进入结算');
assert(plotResults.every((plot) => plot.stage !== PlotStage.PREP && plot.result != null), '四类计谋必须各自产生持久化结果');
assert(plotCheck.consumed >= 8, '四类计谋的成功与识破至少应消费 8 次随机数');

resetRuntimeRng(0x1707_0002);
const femaleCheck = verifyRoundTrip(
  envelopeFor(prepared),
  (state) => trainFemaleSpy(state, home.id, runtimeRandom),
  '女间谍训练',
);
const trainedFemale = Object.values(femaleCheck.result.intel.agents).find(
  (agent) => agent.agentKind === 'female',
);
assert(trainedFemale != null, '女间谍训练必须确定生成姓名、等级与四项技能');

resetRuntimeRng(0x1707_0003);
const recruitCheck = verifyRoundTrip(
  envelopeFor(prepared),
  (state) => recruitSpies(state, home.id, runtimeRandom),
  '普通密探招募',
);
assert(Object.values(recruitCheck.result.intel.agents).some((agent) => agent.agentKind === 'male'), '普通密探随机生成路径必须被覆盖');

const plantBase: GameState = {
  ...prepared,
  factions: {
    ...prepared.factions,
    [enemyFactionId]: {
      ...prepared.factions[enemyFactionId],
      beautyStock: Math.max(1, prepared.factions[enemyFactionId].beautyStock ?? 0),
    },
  },
  intel: {
    ...prepared.intel,
    plantableBeauty: { [enemyFactionId]: 1 },
  },
};
resetRuntimeRng(0x1707_0006);
const plantCheck = verifyRoundTrip(
  envelopeFor(plantBase),
  (state) => plantFemaleFromGift(state, enemyFactionId, runtimeRandom, home.id),
  '献美点化女间谍',
);
assert(
  Object.values(plantCheck.result.intel.agents).some(
    (agent) => agent.agentKind === 'female' && agent.coverIdentity?.includes('后宫') === true,
  ),
  '献美点化必须确定生成女间谍身份、等级与技能',
);

if (!trainedFemale) throw new Error('女间谍训练夹具生成失败');
const missionAgent = {
  ...trainedFemale,
  rank: 5 as const,
  status: SpyStatus.IDLE,
  cooldownMonths: 0,
  skills: { recon: 100, sabotage: 100, lethal: 100, tradecraft: 100 },
};
const missionBase: GameState = {
  ...femaleCheck.result,
  cities: {
    ...femaleCheck.result.cities,
    [home.id]: { ...femaleCheck.result.cities[home.id], gold: 10_000 },
  },
  intel: {
    ...femaleCheck.result.intel,
    agents: { ...femaleCheck.result.intel.agents, [missionAgent.id]: missionAgent },
    cities: {
      ...femaleCheck.result.intel.cities,
      [enemyCity.id]: {
        depth: 'detailed',
        expireYear: initial.currentYear + 1,
        expireMonth: initial.currentMonth,
        source: 'recon',
      },
    },
  },
};

resetRuntimeRng(0x1707_0004);
const pillowCheck = verifyRoundTrip(
  envelopeFor(missionBase),
  (state) => dispatchMission(state, {
    agentId: missionAgent.id,
    type: SpyMissionType.PILLOW_TALK,
    targetCityId: enemyCity.id,
  }, runtimeRandom),
  '枕边风结算',
);
assert(pillowCheck.result.actionLog[0]?.message.includes('枕边风'), '枕边风必须产生可追踪的确定性战报');

resetRuntimeRng(0x1707_0005);
const rumorCheck = verifyRoundTrip(
  envelopeFor(missionBase),
  (state) => dispatchMission(state, {
    agentId: missionAgent.id,
    type: SpyMissionType.SOW_DISCORD,
    targetCityId: enemyCity.id,
  }, runtimeRandom),
  '离间流言结算',
);
assert(/离间|流言/.test(rumorCheck.result.actionLog[0]?.message ?? ''), '离间流言必须落到第三方友好或目标城民忠路径');

console.log(`plot/spy deterministic continuation verification passed: ${passed}/30`);
