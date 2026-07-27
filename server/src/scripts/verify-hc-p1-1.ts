// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { GameStateSchema, validators, type GameState } from '@leh/shared';
import scenariosRaw from '../data/scenarios.json' with { type: 'json' };
import { getStaticData } from '../data/loader.js';
import { createGame, getGame } from '../services/game.js';
import { establishHegemony, getKingRequirements } from '../engine/hegemony.js';
import { advanceTurn } from '../engine/turn.js';

let assertions = 0;
function check(label: string, condition: boolean): void {
  if (!condition) throw new Error(`FAIL: ${label}`);
  assertions += 1;
  console.log(`✓ ${label}`);
}

function withHegemonyControl(state: GameState, factionId: number): GameState {
  const location = state.emperorLocation;
  if (location == null || !state.cities[location]) throw new Error('测试剧本缺少汉帝城市');
  return {
    ...state,
    cities: {
      ...state.cities,
      [location]: { ...state.cities[location], ruler: factionId },
    },
  };
}

console.log('\n=== HC-P1-1 称王门槛与阶段年龄地基 ===\n');

const scenario190 = scenariosRaw.find((scenario) => scenario.name.includes('关东义兵'));
const scenarioHeroes = scenariosRaw.find((scenario) => scenario.id !== scenario190?.id);
if (!scenario190 || !scenarioHeroes) throw new Error('缺少两个 0-A 剧本');

createGame(scenario190.id, scenario190.playableFactions[0]);
const game190 = getGame();
const req190 = getKingRequirements(game190, game190.playerFactionId);
check('190 技术切片纳入争夺城市为 7', req190.contestableCityCount === 7);
check('190 默认称王门槛为 3 城', req190.cityCount.threshold === 3);
const loaded190 = getStaticData().scenarios.find((scenario) => scenario.id === scenario190.id);
if (!loaded190) throw new Error('权威静态数据缺少 190 技术切片');
loaded190.kingRequirements = { minCities: 4 };
try {
  check(
    '剧本 minCities=4 覆写默认公式',
    getKingRequirements(game190, game190.playerFactionId).cityCount.threshold === 4,
  );
} finally {
  delete loaded190.kingRequirements;
}

createGame(scenarioHeroes.id, scenarioHeroes.playableFactions[0]);
const gameHeroes = getGame();
const reqHeroes = getKingRequirements(gameHeroes, gameHeroes.playerFactionId);
check('英雄集结纳入争夺城市为 30', reqHeroes.contestableCityCount === 30);
check('英雄集结默认称王门槛为 8 城', reqHeroes.cityCount.threshold === 8);

let hegemon = establishHegemony(
  withHegemonyControl(game190, game190.playerFactionId),
  game190.playerFactionId,
);
check('开府时阶段年龄重置为 0', hegemon.factions[hegemon.playerFactionId].politicalStageAgeMonths === 0);

const vassalId = Number(Object.keys(hegemon.factions).find(
  (id) => Number(id) !== hegemon.playerFactionId,
));
hegemon = {
  ...hegemon,
  factions: {
    ...hegemon.factions,
    [vassalId]: {
      ...hegemon.factions[vassalId],
      politicalStageAgeMonths: undefined,
    },
  },
};
const oneMonth = advanceTurn(hegemon, () => 0.5);
check('完整月结后霸府阶段年龄 +1', oneMonth.factions[oneMonth.playerFactionId].politicalStageAgeMonths === 1);
check('诸侯势力不推进阶段年龄', oneMonth.factions[vassalId].politicalStageAgeMonths === undefined);

let twelveMonths = hegemon;
for (let month = 0; month < 12; month += 1) {
  twelveMonths = advanceTurn(twelveMonths, () => 0.5);
}
const mature = getKingRequirements(twelveMonths, twelveMonths.playerFactionId);
check('霸府完整推进 12 个月后阶段年龄为 12', mature.politicalStageAgeMonths.current === 12);
check('阶段年龄 12/12 条件通过', mature.politicalStageAgeMonths.passed);

const legacy = structuredClone(gameHeroes);
legacy.factions[legacy.playerFactionId] = {
  ...legacy.factions[legacy.playerFactionId],
  politicalStage: 'hegemon',
  politicalTitle: '丞相',
  politicalStageChangedYear: legacy.currentYear,
  imperialAuthority: 100,
};
delete legacy.factions[legacy.playerFactionId].politicalStageAgeMonths;
const legacySchemaResult = GameStateSchema.safeParse(legacy);
check('旧存档缺阶段年龄仍通过 GameStateSchema', legacySchemaResult.success);
check(
  '旧存档门槛查询将缺失阶段年龄降级为 0',
  getKingRequirements(legacy, legacy.playerFactionId).politicalStageAgeMonths.current === 0,
);
check(
  '旧存档首次完整月结从 0 推进为 1',
  advanceTurn(legacy, () => 0.5).factions[legacy.playerFactionId].politicalStageAgeMonths === 1,
);

const invalidConfigs = [
  { ...scenario190, kingRequirements: { minCities: 0 } },
  { ...scenario190, kingRequirements: { minCities: -1 } },
  { ...scenario190, kingRequirements: { minCities: 2.5 } },
  { ...scenario190, kingRequirements: { minCities: 3, extra: true } },
];
check(
  '非法剧本称王配置（零/负数/小数/未知字段）均被严格 Zod 拒绝',
  invalidConfigs.every((scenario) => !validators.ScenarioStaticSchema.safeParse(scenario).success),
);
check(
  '合法可选剧本覆写通过 Zod',
  validators.ScenarioStaticSchema.safeParse({
    ...scenario190,
    kingRequirements: { minCities: 4 },
  }).success,
);

console.log(`\nHC-P1-1：${assertions}/${assertions} 项断言通过。`);
