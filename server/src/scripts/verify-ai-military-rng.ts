// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  canMarchAlongRoad,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { runAiMilitary } from '../engine/aiMilitary.js';
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
    createdAt: '2026-07-22T22:00:00.000Z',
    updatedAt: '2026-07-22T22:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function makeRaidState(): { state: GameState; fromId: number; targetId: number } {
  createGame(1, 1);
  const initial = getGame();
  const pair = Object.values(initial.cities).flatMap((from) =>
    Object.values(initial.cities)
      .filter((target) =>
        from.ruler != null &&
        target.ruler != null &&
        from.ruler !== target.ruler &&
        canMarchAlongRoad(from.id, target.id),
      )
      .map((target) => ({ from, target })),
  )[0];
  if (!pair) throw new Error('AI 军事验证缺少分属两势力的相邻城池');
  const fromId = pair.from.id;
  const targetId = pair.target.id;
  const aiFaction = initial.factions[pair.from.ruler!];
  const targetFaction = initial.factions[pair.target.ruler!];
  if (!aiFaction || !targetFaction) throw new Error('AI 军事验证缺少双方势力');

  const aiCityIds = Object.values(initial.cities)
    .filter((city) => city.ruler === aiFaction.id && city.id !== targetId)
    .map((city) => city.id);
  if (!aiCityIds.includes(fromId)) aiCityIds.push(fromId);
  const factions = Object.fromEntries(Object.values(initial.factions).map((f) => [
    f.id,
    f.id === aiFaction.id
      ? { ...f, isAlive: true, isPlayer: false, cityIds: aiCityIds, capitalCityId: fromId }
      : f.id === targetFaction.id
        ? { ...f, isAlive: true, isPlayer: true }
        : { ...f, isAlive: false, isPlayer: false },
  ]));
  const cities = Object.fromEntries(Object.values(initial.cities).map((city) => [
    city.id,
    city.id === fromId
      ? { ...city, ruler: aiFaction.id, troops: 3_000 }
      : city.id === targetId
        ? { ...city, ruler: targetFaction.id, troops: 1_500 }
        : city.ruler === aiFaction.id
          ? { ...city, troops: 0 }
          : city,
  ]));

  return {
    state: {
      ...initial,
      playerFactionId: targetFaction.id,
      factions,
      cities,
      plots: [],
    },
    fromId,
    targetId,
  };
}

const fixture = makeRaidState();
resetRuntimeRng(0x15_0001);
const save = envelopeFor(fixture.state);

restoreGameFromEnvelope(save);
const expected = runAiMilitary(getGame(), runtimeRandom, () => 0);
const expectedRng = getRuntimeRngState();
assert(expectedRng.draws === save.rng.draws + 2, '袭扰伤亡必须固定消费两次权威 RNG');
assert(expected.cities[fixture.fromId].troops < fixture.state.cities[fixture.fromId].troops, '袭扰必须结算攻方损失');
assert(expected.cities[fixture.targetId].troops < fixture.state.cities[fixture.targetId].troops, '袭扰必须结算守方损失');

restoreGameFromEnvelope(save);
const actual = runAiMilitary(getGame(), runtimeRandom, () => 0);
const actualRng = getRuntimeRngState();
assert(JSON.stringify(actual) === JSON.stringify(expected), '读档后的 AI 袭扰完整结算必须一致');
assert(JSON.stringify(actualRng) === JSON.stringify(expectedRng), '读档后的 AI 袭扰 RNG 状态与消费次数必须一致');

restoreGameFromEnvelope(save);
const noAction = runAiMilitary(getGame(), runtimeRandom, () => 1);
assert(getRuntimeRngState().draws === save.rng.draws, 'AI 决定不行动时不得消费权威结算流');
assert(JSON.stringify(noAction.cities) === JSON.stringify(fixture.state.cities), 'AI 不行动时不得产生伤亡结算');

console.log(`AI military settlement deterministic continuation verification passed: ${passed}/7`);
