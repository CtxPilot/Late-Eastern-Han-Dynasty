// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  GameStateSchema,
  parseCurrentSaveEnvelope,
  validators,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import scenariosRaw from '../data/scenarios.json' with { type: 'json' };
import { getKingdomNameCandidates, proclaimKing } from '../engine/hegemony.js';
import {
  createGame,
  doProclaimKing,
  getGame,
  restoreGameFromEnvelope,
} from '../services/game.js';
import { getRuntimeRngState } from '../runtime-rng.js';

let assertions = 0;
function check(label: string, condition: unknown): asserts condition {
  if (!condition) throw new Error(`FAIL: ${label}`);
  assertions += 1;
  console.log(`✓ ${label}`);
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-27T10:00:00.000Z',
    updatedAt: '2026-07-27T10:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function preparedKingState(): GameState {
  createGame(1, 1);
  const state = structuredClone(getGame());
  state.factions[1] = {
    ...state.factions[1],
    politicalStage: 'hegemon',
    politicalTitle: '丞相',
    politicalStageChangedYear: state.currentYear,
    politicalStageAgeMonths: 12,
    imperialAuthority: 100,
  };
  return state;
}

function rejection(state: GameState, name: string): { message: string; unchanged: boolean } {
  const before = JSON.stringify(state);
  try {
    proclaimKing(state, 1, name);
    return { message: '', unchanged: false };
  } catch (error) {
    return {
      message: error instanceof Error ? error.message : String(error),
      unchanged: JSON.stringify(state) === before,
    };
  }
}

console.log('\n=== HC-P1-2 称王状态转移与王号 ===\n');

const configs = scenariosRaw.flatMap((scenario) =>
  scenario.factionSetups.map((setup) => [setup.rulerId, setup.preferredKingdomName] as const),
);
for (const [rulerId, expected] of [[1, '魏'], [2, '汉中'], [3, '吴'], [5, '温'], [112, '凉']] as const) {
  check(
    `0-A 王号配置：君主 ${rulerId} → ${expected}`,
    configs.some(([configuredRuler, name]) => configuredRuler === rulerId && name === expected),
  );
}
check(
  'preferredKingdomName 合法配置通过 Zod',
  scenariosRaw.every((scenario) => validators.ScenarioStaticSchema.safeParse(scenario).success),
);
const invalidScenario = structuredClone(scenariosRaw[0]);
invalidScenario.factionSetups[0].preferredKingdomName = '';
check('空王号剧本配置被 Zod 拒绝', !validators.ScenarioStaticSchema.safeParse(invalidScenario).success);

const ready = preparedKingState();
const candidates = getKingdomNameCandidates(ready, 1);
check('候选一由剧本配置给出「魏」', candidates[0]?.name === '魏' && candidates[0].source === 'scenario');
check('首都地理提供稳定候选二', candidates.some((candidate) => candidate.source === 'geography'));

const noFaction = structuredClone(ready);
delete noFaction.factions[1];
const missing = rejection(noFaction, '魏');
check('不存在势力被拒绝并给出对应错误', missing.message.includes('势力不存在'));
check('不存在势力失败零副作用', missing.unchanged);

const dead = structuredClone(ready);
dead.factions[1].isAlive = false;
const deadResult = rejection(dead, '魏');
check('已灭亡势力被拒绝并给出对应错误', deadResult.message.includes('已灭亡'));
check('已灭亡失败零副作用', deadResult.unchanged);

const vassal = structuredClone(ready);
vassal.factions[1].politicalStage = 'vassal';
const vassalResult = rejection(vassal, '魏');
check('诸侯不可跳级称王', vassalResult.message.includes('不可跳级'));
check('阶段失败零副作用', vassalResult.unchanged);

const fewCities = structuredClone(ready);
fewCities.factions[1].cityIds = fewCities.factions[1].cityIds.slice(0, 7);
const cityResult = rejection(fewCities, '魏');
check('城池未达8城时单独拒绝', cityResult.message.includes('城池不足'));
check('城池失败零副作用', cityResult.unchanged);

const young = structuredClone(ready);
young.factions[1].politicalStageAgeMonths = 11;
const ageResult = rejection(young, '魏');
check('霸府未满12月时单独拒绝', ageResult.message.includes('沉淀不足'));
check('年龄失败零副作用', ageResult.unchanged);

const poor = structuredClone(ready);
poor.factions[1].imperialAuthority = 79;
const authorityResult = rejection(poor, '魏');
check('皇权不足80时单独拒绝', authorityResult.message.includes('皇权点数不足'));
check('皇权失败零副作用', authorityResult.unchanged);

const illegalResult = rejection(ready, '自由文本');
check('有限候选之外的王号被拒绝', illegalResult.message.includes('王号不合法'));
check('非法王号失败零副作用', illegalResult.unchanged);

const conflict = structuredClone(ready);
conflict.factions[2] = { ...conflict.factions[2], isAlive: true, kingdomName: '魏' };
const conflictResult = rejection(conflict, '魏');
check('存活势力王号冲突被拒绝', conflictResult.message.includes('已被其他存活势力占用'));
check('冲突错误提供候选号而非数字/姓氏后缀', conflictResult.message.includes('可选候选号「'));
check('王号冲突失败零副作用', conflictResult.unchanged);

const noEmperorControl = structuredClone(ready);
const emperorCityId = noEmperorControl.emperorLocation;
if (emperorCityId != null) {
  noEmperorControl.cities[emperorCityId] = {
    ...noEmperorControl.cities[emperorCityId],
    ruler: 2,
  };
}
const withoutEmperorSuccess = proclaimKing(noEmperorControl, 1, '魏');
check('K8：称王不要求继续控制汉帝', withoutEmperorSuccess.factions[1].politicalStage === 'king');
const success = proclaimKing(ready, 1, '魏');
check('成功扣80皇权', success.factions[1].imperialAuthority === 20);
check('成功写入 king/魏王/固定王号', success.factions[1].politicalTitle === '魏王' && success.factions[1].kingdomName === '魏');
check('成功更新阶段年份并将阶段年龄归零', success.factions[1].politicalStageChangedYear === success.currentYear && success.factions[1].politicalStageAgeMonths === 0);
check('成功日志记录王号、领土和皇权消耗', success.actionLog[0]?.type === 'king_proclaimed' && success.actionLog[0].message.includes('17城') && success.actionLog[0].message.includes('皇权-80'));
check('成功状态通过完整 GameStateSchema', GameStateSchema.safeParse(success).success);

const duplicate = rejection(success, '魏');
check('重复称王提交被拒绝', duplicate.message.includes('不可重复提交'));
check('重复提交零副作用', duplicate.unchanged);

const parsed = parseCurrentSaveEnvelope(envelopeFor(success));
check('存档往返保留 king/魏王/王号/年龄0', parsed.snapshot.factions[1].politicalStage === 'king'
  && parsed.snapshot.factions[1].politicalTitle === '魏王'
  && parsed.snapshot.factions[1].kingdomName === '魏'
  && parsed.snapshot.factions[1].politicalStageAgeMonths === 0);

restoreGameFromEnvelope(envelopeFor(ready));
const serviceResult = doProclaimKing('魏');
check('服务层只编排权威函数并返回称王后的客户端投影', serviceResult.factions[1].politicalStage === 'king' && getGame().factions[1].kingdomName === '魏');

console.log(`\nHC-P1-2：${assertions}/${assertions} 项断言通过。`);
