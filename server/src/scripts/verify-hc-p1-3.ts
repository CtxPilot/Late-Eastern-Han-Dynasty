// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  GameStateSchema,
  HEGEMONY_REQ,
  HegemonyPosition,
  KINGDOM_POSITIONS,
  parseCurrentSaveEnvelope,
  type GameState,
  type OfficerStats,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { appointOfficer } from '../engine/appoint.js';
import { createGame, getGame } from '../services/game.js';
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
    createdAt: '2026-07-27T12:00:00.000Z',
    updatedAt: '2026-07-27T12:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

function stateAt(stage: 'hegemon' | 'king' | 'emperor'): GameState {
  createGame(1, 1);
  const state = structuredClone(getGame());
  state.factions[1] = {
    ...state.factions[1],
    politicalStage: stage,
    politicalTitle: stage === 'hegemon' ? '丞相' : stage === 'king' ? '魏王' : '魏帝',
  };
  return state;
}

function maxOfficer(state: GameState, officerId: number): GameState {
  const officer = state.officers[officerId];
  if (!officer) throw new Error(`夹具缺武将 ${officerId}`);
  const stats: OfficerStats = {
    leadership: 100,
    war: 100,
    intelligence: 100,
    politics: 100,
    charisma: 100,
  };
  return {
    ...state,
    officers: {
      ...state.officers,
      [officerId]: { ...officer, stats },
    },
  };
}

function rejects(state: GameState, officerId: number, position: HegemonyPosition): string {
  try {
    appointOfficer(state, officerId, 'hegemony', position);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

console.log('\n=== HC-P1-3 王国官职 ===\n');

check('王国官职枚举恰好6项且互不重复', KINGDOM_POSITIONS.length === 6 && new Set(KINGDOM_POSITIONS).size === 6);
check('六职均配置势力唯一门槛', KINGDOM_POSITIONS.every((position) => HEGEMONY_REQ[position]?.uniqueFaction === true));
check('王国相门槛=政85/智80', HEGEMONY_REQ[HegemonyPosition.KINGDOM_CHANCELLOR]?.politics === 85
  && HEGEMONY_REQ[HegemonyPosition.KINGDOM_CHANCELLOR]?.intelligence === 80);
check('内史门槛=政80/魅70', HEGEMONY_REQ[HegemonyPosition.KINGDOM_INTERIOR_MINISTER]?.politics === 80
  && HEGEMONY_REQ[HegemonyPosition.KINGDOM_INTERIOR_MINISTER]?.charisma === 70);
check('中尉门槛=统80/武75', HEGEMONY_REQ[HegemonyPosition.KINGDOM_COMMANDANT]?.leadership === 80
  && HEGEMONY_REQ[HegemonyPosition.KINGDOM_COMMANDANT]?.war === 75);
check('郎中令门槛=统75/魅75', HEGEMONY_REQ[HegemonyPosition.KINGDOM_GENTLEMAN_STEWARD]?.leadership === 75
  && HEGEMONY_REQ[HegemonyPosition.KINGDOM_GENTLEMAN_STEWARD]?.charisma === 75);
check('大司农门槛=政80/智75', HEGEMONY_REQ[HegemonyPosition.KINGDOM_AGRICULTURE_MINISTER]?.politics === 80
  && HEGEMONY_REQ[HegemonyPosition.KINGDOM_AGRICULTURE_MINISTER]?.intelligence === 75);
check('太仆门槛=统75/政70', HEGEMONY_REQ[HegemonyPosition.KINGDOM_COACH_MINISTER]?.leadership === 75
  && HEGEMONY_REQ[HegemonyPosition.KINGDOM_COACH_MINISTER]?.politics === 70);

const hegemon = maxOfficer(stateAt('hegemon'), 1);
for (const position of KINGDOM_POSITIONS) {
  check(`霸府阶段拒绝王国官职 ${position}`, rejects(hegemon, 1, position).includes('需先称王'));
}

for (const stage of ['king', 'emperor'] as const) {
  for (const position of KINGDOM_POSITIONS) {
    const appointed = appointOfficer(maxOfficer(stateAt(stage), 1), 1, 'hegemony', position);
    check(`${stage} 可任命 ${position}`, appointed.officers[1].hegemonyPosition === position);
  }
}

for (const position of KINGDOM_POSITIONS) {
  const req = HEGEMONY_REQ[position];
  if (!req) throw new Error(`缺少门槛 ${position}`);
  const base = maxOfficer(stateAt('king'), 1);
  const stats = { ...base.officers[1].stats };
  const key = (['leadership', 'war', 'intelligence', 'politics', 'charisma'] as const)
    .find((attribute) => req[attribute] != null);
  if (!key) throw new Error(`门槛无属性 ${position}`);
  stats[key] = (req[key] ?? 1) - 1;
  base.officers[1] = { ...base.officers[1], stats };
  check(`${position} 属性低1点被拒绝`, rejects(base, 1, position).includes('属性不足'));
}

let retained = appointOfficer(maxOfficer(stateAt('hegemon'), 9), 9, 'hegemony', HegemonyPosition.GRAND_COMMANDER);
retained.factions[1] = { ...retained.factions[1], politicalStage: 'king', politicalTitle: '魏王' };
retained = appointOfficer(maxOfficer(retained, 8), 8, 'hegemony', HegemonyPosition.KINGDOM_CHANCELLOR);
check('称王后原霸府大司马不被自动替换', retained.officers[9].hegemonyPosition === HegemonyPosition.GRAND_COMMANDER);
check('霸府旧职与王国新职可由不同人物并存', retained.officers[8].hegemonyPosition === HegemonyPosition.KINGDOM_CHANCELLOR);

const singleTrack = appointOfficer(maxOfficer(retained, 9), 9, 'hegemony', HegemonyPosition.KINGDOM_COMMANDANT);
check('同一人物任王国新职会替换原霸府职', singleTrack.officers[9].hegemonyPosition === HegemonyPosition.KINGDOM_COMMANDANT);
const dismissedKingdom = appointOfficer(singleTrack, 9, 'hegemony', HegemonyPosition.NONE);
check('王国官职解职日志使用王国语义', dismissedKingdom.actionLog[0]?.message.includes('王国职'));

let unique = appointOfficer(maxOfficer(stateAt('king'), 1), 1, 'hegemony', HegemonyPosition.KINGDOM_CHANCELLOR);
unique = appointOfficer(maxOfficer(unique, 8), 8, 'hegemony', HegemonyPosition.KINGDOM_CHANCELLOR);
check('势力唯一：新王国相就任', unique.officers[8].hegemonyPosition === HegemonyPosition.KINGDOM_CHANCELLOR);
check('势力唯一：旧王国相自动清为none', unique.officers[1].hegemonyPosition === HegemonyPosition.NONE);
check('重复任同一王国职被拒绝', rejects(unique, 8, HegemonyPosition.KINGDOM_CHANCELLOR).includes('已是该王国官职'));

const parsed = parseCurrentSaveEnvelope(envelopeFor(singleTrack));
check('王国官职存档往返保留', parsed.snapshot.officers[9].hegemonyPosition === HegemonyPosition.KINGDOM_COMMANDANT);
check('王国官职状态通过完整Schema', GameStateSchema.safeParse(parsed.snapshot).success);

console.log(`\nHC-P1-3：${assertions}/${assertions} 项断言通过。`);
