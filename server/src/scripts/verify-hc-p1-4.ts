// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CURRENT_SAVE_SCHEMA_VERSION,
  GameStateSchema,
  NOBILITY_RANKS,
  NobilityRank,
  OfficerStatus,
  migrateSaveEnvelopeToCurrent,
  parseCurrentSaveEnvelope,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { grantNobility } from '../engine/nobility.js';
import { createGame, getGame } from '../services/game.js';
import { getRuntimeRngState } from '../runtime-rng.js';

let assertions = 0;
function check(label: string, condition: unknown): asserts condition {
  if (!condition) throw new Error(`FAIL: ${label}`);
  assertions += 1;
  console.log(`✓ ${label}`);
}
function rejects(state: GameState, officerId: number, rank: NobilityRank): string {
  try {
    grantNobility(state, 1, officerId, rank);
    return '';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
function stateAt(stage: 'hegemon' | 'king' | 'emperor'): GameState {
  createGame(1, 1);
  const state = structuredClone(getGame());
  state.factions[1] = {
    ...state.factions[1],
    politicalStage: stage,
    imperialAuthority: 100,
  };
  return state;
}
function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

console.log('\n=== HC-P1-4 爵位枚举与王命封爵 ===\n');
check('新枚举为 none + 完整七级', NOBILITY_RANKS.length === 8 && new Set(NOBILITY_RANKS).size === 8);
for (const rank of NOBILITY_RANKS) {
  const state = stateAt('king');
  state.officers[9] = { ...state.officers[9], nobilityRank: rank };
  check(`Zod 接受新爵位 ${rank}`, GameStateSchema.safeParse(state).success);
}

const legacy = envelopeFor(stateAt('king')) as unknown as {
  snapshot: { officers: Record<number, { nobilityRank: string }> };
};
const oldToNew = {
  none: NobilityRank.NONE,
  marquis: NobilityRank.XIAN_MARQUIS,
  duke: NobilityRank.DUKE,
  prince: NobilityRank.KING,
  king: NobilityRank.EMPEROR,
};
const ids = [1, 8, 9, 12, 13];
Object.keys(oldToNew).forEach((old, index) => {
  legacy.snapshot.officers[ids[index]].nobilityRank = old;
});
const migrated = migrateSaveEnvelopeToCurrent(legacy) as typeof legacy;
Object.entries(oldToNew).forEach(([old, rank], index) => {
  check(`旧 ${old} → 新 ${rank}`, migrated.snapshot.officers[ids[index]].nobilityRank === rank);
});
check('旧五级迁移后通过完整存档解析', parseCurrentSaveEnvelope(migrated).snapshot.officers[9].nobilityRank === NobilityRank.DUKE);

const hegemon = stateAt('hegemon');
check('hegemon 阶段拒绝封爵', rejects(hegemon, 9, NobilityRank.GUANNEI_MARQUIS).includes('仅限称王'));
const king = stateAt('king');
const rulerId = king.factions[1].rulerId;
check('拒绝君主本人', rejects(king, rulerId, NobilityRank.GUANNEI_MARQUIS).includes('君主本人'));
const enemyId = Object.values(king.officers).find((officer) => officer.faction != null && officer.faction !== 1)!.id;
check('拒绝异势力武将', rejects(king, enemyId, NobilityRank.GUANNEI_MARQUIS).includes('同势力'));
const inactive = structuredClone(king);
inactive.officers[9] = { ...inactive.officers[9], status: OfficerStatus.PRISONER };
check('拒绝非在职武将', rejects(inactive, 9, NobilityRank.GUANNEI_MARQUIS).includes('在职'));
check('拒绝越级晋升', rejects(king, 9, NobilityRank.DUKE).includes('逐级'));
const capped = structuredClone(king);
capped.officers[9] = { ...capped.officers[9], nobilityRank: NobilityRank.DUKE };
check('拒绝超过臣属上限公', rejects(capped, 9, NobilityRank.KING).includes('上限'));
const poor = structuredClone(king);
poor.factions[1] = { ...poor.factions[1], imperialAuthority: 9 };
check('皇权不足拒绝', rejects(poor, 9, NobilityRank.GUANNEI_MARQUIS).includes('皇权不足'));

let promoted = grantNobility(king, 1, 9, NobilityRank.GUANNEI_MARQUIS);
check('成功只升一级并扣皇权10', promoted.officers[9].nobilityRank === NobilityRank.GUANNEI_MARQUIS
  && promoted.factions[1].imperialAuthority === 90);
promoted.officers[9] = { ...promoted.officers[9], nobilityRank: NobilityRank.XIAN_MARQUIS };
promoted = grantNobility(promoted, 1, 9, NobilityRank.DUKE);
check('晋公扣皇权20', promoted.officers[9].nobilityRank === NobilityRank.DUKE
  && promoted.factions[1].imperialAuthority === 70);
check('封爵只有晋升引擎且没有撤销导出', !('revokeNobility' in await import('../engine/nobility.js')));
check('新枚举存档往返保留', parseCurrentSaveEnvelope(envelopeFor(promoted)).snapshot.officers[9].nobilityRank === NobilityRank.DUKE);

console.log(`\nHC-P1-4：${assertions}/${assertions} 项断言通过。`);
