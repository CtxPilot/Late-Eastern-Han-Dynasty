// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  parseCurrentSaveEnvelope,
  UnsupportedSaveVersionError,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { createGame, endTurn, getGame, restoreGameFromEnvelope, startBattle } from '../services/game.js';
import { getRuntimeRngState, runtimeRandom } from '../runtime-rng.js';

let passed = 0;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function envelopeFor(state: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-22T10:00:00.000Z',
    updatedAt: '2026-07-22T10:05:00.000Z',
    scenarioId: state.scenarioId,
    rng: getRuntimeRngState(),
    snapshot: state,
  };
}

function rejectsUnsupported(input: unknown): boolean {
  try {
    parseCurrentSaveEnvelope(input);
    return false;
  } catch (error) {
    return error instanceof UnsupportedSaveVersionError;
  }
}

function rejectsInvalid(input: unknown): boolean {
  try {
    parseCurrentSaveEnvelope(input);
    return false;
  } catch {
    return true;
  }
}

createGame(1, 1);
const gathering = getGame();
const gatheringSave = envelopeFor(gathering);
const parsedGathering = parseCurrentSaveEnvelope(gatheringSave);
assert(parsedGathering.snapshot.currentYear === gathering.currentYear, 'v1 解析应保留英雄集结快照年份');
assert(parsedGathering.scenarioId === gathering.scenarioId, '英雄集结信封剧本 ID 应保留');

const mismatchedScenario = { ...gatheringSave, scenarioId: 2 };
assert(rejectsInvalid(mismatchedScenario), '信封与快照的剧本 ID 不一致时必须拒绝');

const targetCity = Object.values(gathering.cities).find(
  (city) => city.ruler !== gathering.playerFactionId,
);
if (!targetCity) throw new Error('恢复验证需要至少一座非玩家城市');
startBattle(targetCity.id);
const battleSave = envelopeFor(getGame());
assert(battleSave.snapshot.activeBattles.length === 1, '恢复夹具应包含进行中的六角战斗');
const expectedRandomTail = Array.from({ length: 8 }, () => runtimeRandom());

endTurn();
assert(getGame().currentMonth !== battleSave.snapshot.currentMonth, '恢复前应先改变当前权威时间线');
const restoredProjection = restoreGameFromEnvelope(battleSave);
assert(getGame().currentMonth === battleSave.snapshot.currentMonth, '内存恢复应重装快照时间线');
assert(getGame().activeBattles.length === 1, '内存恢复应保留进行中的权威战斗');
assert(restoredProjection.playerFactionId === gathering.playerFactionId, '恢复入口应返回玩家脱敏投影');
assert(
  JSON.stringify(Array.from({ length: 8 }, () => runtimeRandom())) === JSON.stringify(expectedRandomTail),
  '恢复 PRNG 内部状态后必须继续产生完全相同的随机序列',
);
assert(getRuntimeRngState().draws === battleSave.rng.draws + 8, '恢复后的 PRNG 消费计数必须连续');

const missingScenarioSave = structuredClone(gatheringSave);
missingScenarioSave.scenarioId = 999_999;
missingScenarioSave.snapshot.scenarioId = 999_999;
let rejectedMissingScenario = false;
try {
  restoreGameFromEnvelope(missingScenarioSave);
} catch (error) {
  rejectedMissingScenario = error instanceof Error && error.message === '存档引用的剧本不存在';
}
assert(rejectedMissingScenario, '运行时恢复必须拒绝当前静态数据中不存在的剧本');
createGame(1, 1);
assert(getGame().scenarioId === 1, '恢复失败后请求锁必须释放，后续写操作仍可执行');

createGame(2, 2);
const coalition = getGame();
const parsedCoalition = parseCurrentSaveEnvelope(envelopeFor(coalition));
assert(parsedCoalition.snapshot.currentYear === coalition.currentYear, 'v1 解析应保留关东义兵快照年份');
assert(parsedCoalition.snapshot.playerFactionId === 2, '关东义兵玩家势力应通过完整快照校验');

assert(rejectsUnsupported({ ...gatheringSave, schemaVersion: 2 }), '未来版本必须被版本分派拒绝');
assert(rejectsUnsupported({ ...gatheringSave, schemaVersion: 0 }), '未登记旧版本必须被版本分派拒绝');
assert(rejectsUnsupported({ snapshot: gathering }), '缺少版本号必须被版本分派拒绝');

const invalidSnapshot = structuredClone(gatheringSave);
invalidSnapshot.snapshot.playerFactionId = 999_999;
assert(rejectsInvalid(invalidSnapshot), '迁移后的快照必须经过完整 GameState 跨引用校验');

assert(
  rejectsInvalid({ ...gatheringSave, runtimeSocketId: 'transient' }),
  '当前信封必须拒绝瞬态未知根字段',
);

console.log(`save migration, runtime restore, and PRNG verification passed: ${passed}/19`);
