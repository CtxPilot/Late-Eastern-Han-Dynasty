// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  TerrainType,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { calcDamage, type DamageInput } from '../battle/damage.js';
import { attackUnit } from '../engine/battle.js';
import { getRuntimeRngState, runtimeRandom } from '../runtime-rng.js';
import { createGame, getGame, restoreGameFromEnvelope, startBattle } from '../services/game.js';

let passed = 0;
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  passed += 1;
}

function envelopeFor(state: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-22T12:00:00.000Z',
    updatedAt: '2026-07-22T12:00:00.000Z',
    scenarioId: state.scenarioId,
    rng: getRuntimeRngState(),
    snapshot: state,
  };
}

const attacker: DamageInput = {
  unitAttack: 8,
  unitDefense: 5,
  officerWar: 92,
  officerLeadership: 88,
  troops: 3000,
  maxTroops: 3000,
  morale: 85,
  terrain: TerrainType.PLAIN,
  matchup: 1.3,
};
const defender: DamageInput = {
  unitAttack: 6,
  unitDefense: 7,
  officerWar: 76,
  officerLeadership: 80,
  troops: 2800,
  maxTroops: 2800,
  morale: 75,
  terrain: TerrainType.FOREST,
};

createGame(1, 1);
const damageSave = envelopeFor(getGame());
const expectedDamage = Array.from({ length: 10 }, () => calcDamage(attacker, defender, runtimeRandom));
restoreGameFromEnvelope(damageSave);
const restoredDamage = Array.from({ length: 10 }, () => calcDamage(attacker, defender, runtimeRandom));
assert(JSON.stringify(restoredDamage) === JSON.stringify(expectedDamage), '基础伤害随机序列在读档后必须完全一致');
assert(getRuntimeRngState().draws === damageSave.rng.draws + 10, '基础伤害恢复后的 RNG 消费计数必须连续');

const state = getGame();
const target = Object.values(state.cities).find((city) => city.ruler !== state.playerFactionId);
if (!target) throw new Error('战斗 RNG 验证需要敌方城市');
const created = startBattle(target.id);
const atk = created.units.find((unit) => unit.side === 'attacker');
const def = created.units.find((unit) => unit.side === 'defender');
if (!atk || !def) throw new Error('战斗 RNG 验证需要攻守双方单位');

const adjacentBattle = {
  ...created,
  phase: 'player' as const,
  units: created.units.map((unit) =>
    unit.id === def.id ? { ...unit, position: { ...atk.position } } : unit,
  ),
};
const battleSave = envelopeFor(getGame());
const expectedBattle = attackUnit(adjacentBattle, atk.id, def.id, getGame(), runtimeRandom);
const expectedDraws = getRuntimeRngState().draws - battleSave.rng.draws;
assert(expectedDraws > 1, '一次六角攻击应由基础伤害与暴击链共同消费权威随机流');

restoreGameFromEnvelope(battleSave);
const restoredBattle = attackUnit(adjacentBattle, atk.id, def.id, getGame(), runtimeRandom);
assert(JSON.stringify(restoredBattle) === JSON.stringify(expectedBattle), '六角攻击在读档后必须得到完全相同的伤害与事件链');
assert(getRuntimeRngState().draws === battleSave.rng.draws + expectedDraws, '六角攻击恢复后的 RNG 消费数必须一致');

console.log(`battle deterministic continuation verification passed: ${passed}/5`);
