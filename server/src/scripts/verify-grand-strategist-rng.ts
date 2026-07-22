// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  OfficerStatus,
  SerializableRng,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import {
  appointGrandStrategist,
  calcStrategyModifiers,
  checkStrategyAdvice,
  grandStrategistDuel,
  tickGrandStrategists,
} from '../engine/grandStrategist.js';
import { getRuntimeRngState, resetRuntimeRng, runtimeRandom } from '../runtime-rng.js';
import { createGame, getGame, restoreGameFromEnvelope } from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function findSeed(predicate: (values: number[]) => boolean, drawCount: number): number {
  for (let seed = 1; seed < 100_000; seed += 1) {
    const rng = new SerializableRng(seed);
    const values = Array.from({ length: drawCount }, () => rng.next());
    if (predicate(values)) return seed;
  }
  throw new Error('未找到满足总军师随机夹具的种子');
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-22T21:00:00.000Z',
    updatedAt: '2026-07-22T21:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function verifyRoundTrip<T>(save: SaveEnvelopeV1, run: () => T, label: string, expectedDraws: number): T {
  restoreGameFromEnvelope(save);
  const expected = run();
  assert(getRuntimeRngState().draws === save.rng.draws + expectedDraws, `${label}首次消费次数错误`);
  restoreGameFromEnvelope(save);
  const actual = run();
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${label}读档后的完整结果必须一致`);
  assert(getRuntimeRngState().draws === save.rng.draws + expectedDraws, `${label}读档后的消费次数必须一致`);
  return actual;
}

createGame(1, 1);
const initial = getGame();
const faction = initial.factions[initial.playerFactionId];
const rulerCompatibility = initial.officers[faction.rulerId]?.hidden?.compatibility ?? 50;
const officer = Object.values(initial.officers).find((candidate) =>
  candidate.faction === faction.id &&
  candidate.status === OfficerStatus.ACTIVE &&
  candidate.stats.intelligence >= 85 &&
  Math.abs((candidate.hidden?.compatibility ?? 50) - rulerCompatibility) <= 50,
);
if (!officer) throw new Error('总军师确定性验证缺少合格人选');

const appointed = appointGrandStrategist(initial, faction.id, officer.id).state;

resetRuntimeRng(findSeed(([roll]) => roll < 0.01, 2));
const advice = verifyRoundTrip(
  envelopeFor(appointed),
  () => checkStrategyAdvice(getGame(), faction.id, runtimeRandom),
  '献策触发与类型选择',
  2,
);
assert(advice.triggered && advice.type != null, '献策触发后必须返回类型');

resetRuntimeRng(findSeed(([roll]) => roll > 0.99, 1));
const noAdvice = verifyRoundTrip(
  envelopeFor(appointed),
  () => checkStrategyAdvice(getGame(), faction.id, runtimeRandom),
  '献策未触发',
  1,
);
assert(!noAdvice.triggered, '高点数必须保持献策未触发');

const noStrategist: GameState = { ...appointed, grandStrategists: [] };
resetRuntimeRng(0x14_0001);
const absent = verifyRoundTrip(
  envelopeFor(noStrategist),
  () => checkStrategyAdvice(getGame(), faction.id, runtimeRandom),
  '无总军师献策',
  0,
);
assert(!absent.triggered, '无总军师时不得献策');

const lowLoyalty: GameState = {
  ...appointed,
  officers: { ...appointed.officers, [officer.id]: { ...officer, loyalty: 50 } },
};
resetRuntimeRng(findSeed(([roll]) => roll < 0.01, 1));
const resigned = verifyRoundTrip(
  envelopeFor(lowLoyalty),
  () => tickGrandStrategists(getGame(), runtimeRandom),
  '低忠诚辞职',
  1,
);
assert(resigned.grandStrategists.length === 0, '辞职成功必须清除总军师');
assert(resigned.actionLog[0]?.type === 'strategist_resign', '辞职必须写入战报');

resetRuntimeRng(findSeed(([roll]) => roll > 0.99, 1));
const stayed = verifyRoundTrip(
  envelopeFor(lowLoyalty),
  () => tickGrandStrategists(getGame(), runtimeRandom),
  '低忠诚留任',
  1,
);
assert(stayed.grandStrategists.length === 1, '辞职检定失败时必须留任');

const dead: GameState = {
  ...appointed,
  officers: { ...appointed.officers, [officer.id]: { ...officer, status: OfficerStatus.DEAD, loyalty: 0 } },
};
resetRuntimeRng(0x14_0002);
const removed = verifyRoundTrip(
  envelopeFor(dead),
  () => tickGrandStrategists(getGame(), runtimeRandom),
  '死亡自动空缺',
  0,
);
assert(removed.grandStrategists.length === 0, '死亡总军师必须确定性空缺');

const otherFaction = Object.values(appointed.factions).find((candidate) => candidate.id !== faction.id);
if (!otherFaction) throw new Error('总军师对决验证缺少对方势力');
const duelState: GameState = {
  ...appointed,
  grandStrategists: [
    ...appointed.grandStrategists,
    { ...appointed.grandStrategists[0], factionId: otherFaction.id },
  ],
};
resetRuntimeRng(0x14_0003);
verifyRoundTrip(
  envelopeFor(duelState),
  () => ({
    modifiers: calcStrategyModifiers('offense', officer.stats.intelligence),
    duel: grandStrategistDuel(getGame(), faction.id, otherFaction.id),
  }),
  '智略加成与对决',
  0,
);

console.log(`grand strategist deterministic continuation verification passed: ${passed}/28`);
