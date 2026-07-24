// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P2 Q10: 郡域战场实例存档契约验证（5 类断言）。
 *
 * 沿用既有 verify-save-* 系列"存档→读档→序列一致"模式；
 * 验证 activeBattlefieldInstance 字段在 GameState 中的无损追加：
 *   a. 空场景（activeBattlefieldInstance === undefined）
 *   b. 进行中场（非 null）存档/读档全字段序列一致
 *   c. exitNanjunBattlefield 清档后字段归零
 *   d. 跨存档版本兼容（旧存档无此字段时读档正常降级）
 *   e. Zod 严格校验（互斥约束 + 非法结构 + orchestrator 提前断言）
 *
 * 参见 docs/25-bf-p2-design.md §三。
 */
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  GameStateSchema,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { getRuntimeRngState } from '../runtime-rng.js';
import {
  battlefieldInit,
  createGame,
  enterNanjunBattlefield,
  exitNanjunBattlefield,
  getGame,
  restoreGameFromEnvelope,
} from '../services/game.js';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}`);
  }
}

function envelopeFor(snapshot: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-24T12:00:00.000Z',
    updatedAt: '2026-07-24T12:00:00.000Z',
    scenarioId: snapshot.scenarioId,
    rng: getRuntimeRngState(),
    snapshot,
  };
}

console.log('\n=== BF-P2 Q10 郡域战场实例存档契约验证 ===\n');

// ====== a. 空场景：初始 activeBattlefieldInstance 为 undefined ======
console.log('a. 空场景存档/读档往返:');
createGame(1, 1);
const initial = getGame();
check('初始 GameState.activeBattlefieldInstance 为 undefined', initial.activeBattlefieldInstance === undefined);
const envelopeEmpty = envelopeFor(initial);
restoreGameFromEnvelope(envelopeEmpty);
check('空场景存档读档后 activeBattlefieldInstance 仍为 undefined', getGame().activeBattlefieldInstance === undefined);
check('空场景读档不破坏其他字段（scenarioId 一致）', getGame().scenarioId === initial.scenarioId);

// ====== b. 进行中场：非 null 存档/读档，全字段序列一致 ======
console.log('\nb. 进行中场存档/读档:');
createGame(1, 1);
const entered = enterNanjunBattlefield();
check('enterNanjunBattlefield 返回 client 投影含 activeBattlefieldInstance', entered.activeBattlefieldInstance != null);
const activeState = getGame();
check('服务端真源 activeBattlefieldInstance 非 null', activeState.activeBattlefieldInstance != null);
const inst = activeState.activeBattlefieldInstance!;
const envelopeActive = envelopeFor(activeState);
restoreGameFromEnvelope(envelopeActive);
const restored = getGame();
const restoredInst = restored.activeBattlefieldInstance;
check('读档后 instance id 一致', restoredInst?.id === inst.id);
check('读档后 nodeStates 数量一致', restoredInst?.nodeStates.length === inst.nodeStates.length);
check('读档后 routeStates 数量一致', restoredInst?.routeStates.length === inst.routeStates.length);
check('读档后 encounters 数量一致', restoredInst?.encounters.length === inst.encounters.length);
check('读档后 armyIds 数量一致', restoredInst?.armyIds.length === inst.armyIds.length);
check('读档后 phase 一致', restoredInst?.phase === inst.phase);
check('读档后 turn 一致', restoredInst?.turn === inst.turn);
check('读档后 targetSeatNodeId 一致', restoredInst?.targetSeatNodeId === inst.targetSeatNodeId);
check('读档后整个 instance JSON 序列一致', JSON.stringify(restoredInst) === JSON.stringify(inst));

// ====== c. 战斗结束后清档：activeBattlefieldInstance 归 null ======
console.log('\nc. 清档:');
exitNanjunBattlefield();
check('exitNanjunBattlefield 后 activeBattlefieldInstance 为 null', getGame().activeBattlefieldInstance === null);
const envelopeCleared = envelopeFor(getGame());
restoreGameFromEnvelope(envelopeCleared);
check('清档后存档读档仍为 null', getGame().activeBattlefieldInstance === null);

// ====== d. 跨存档版本兼容：旧存档无此字段 ======
console.log('\nd. 跨存档版本兼容（旧存档无 activeBattlefieldInstance 字段）:');
createGame(1, 1);
const legacySnapshot = { ...getGame() } as GameState;
delete (legacySnapshot as { activeBattlefieldInstance?: unknown }).activeBattlefieldInstance;
check('旧存档夹具：activeBattlefieldInstance 字段已删除', !('activeBattlefieldInstance' in legacySnapshot));
const legacyEnvelope = envelopeFor(legacySnapshot);
restoreGameFromEnvelope(legacyEnvelope);
check('旧存档读档不报错', getGame().scenarioId === legacySnapshot.scenarioId);
check('旧存档读档后 activeBattlefieldInstance 为 undefined', getGame().activeBattlefieldInstance === undefined);

// ====== e. Zod 严格校验 ======
console.log('\ne. Zod 严格校验:');

// e1. 互斥校验：activeBattlefield 与 activeBattlefieldInstance 同时非 null 应拒绝
createGame(1, 1);
enterNanjunBattlefield();
const stateWithInstance = structuredClone(getGame());
const instance = stateWithInstance.activeBattlefieldInstance;
check('e1 夹具：enterNanjunBattlefield 后 instance 非 null', instance != null);

// 沿用 verify-save-campaign.ts 夹具模式：英雄集结势力 2 有可用于出征的前线城市
createGame(1, 2);
const s = getGame();
const fromCity = Object.values(s.cities).find((city) =>
  city.ruler === s.playerFactionId && city.troops >= 1000 &&
  s.campaignNodes
    .find((node) => node.id === city.id)
    ?.adjacentNodeIds.some((id) => {
      const target = s.cities[id];
      return target?.ruler != null && target.ruler !== s.playerFactionId;
    }),
);
if (!fromCity) throw new Error('e1 夹具：找不到出征前线城市');
const targetCityId = s.campaignNodes
  .find((n) => n.id === fromCity.id)!
  .adjacentNodeIds.find((id) => {
    const target = s.cities[id];
    return target?.ruler != null && target.ruler !== s.playerFactionId;
  });
if (targetCityId == null) throw new Error('e1 夹具：找不到相邻敌方城');
battlefieldInit(targetCityId, fromCity.id);
const stateWithBattlefield = structuredClone(getGame());
check('e1 夹具：battlefieldInit 后 activeBattlefield 非 null', stateWithBattlefield.activeBattlefield != null);

const bothActive = structuredClone(stateWithBattlefield);
bothActive.activeBattlefieldInstance = instance!;
const bothResult = GameStateSchema.safeParse(bothActive);
check('e1 互斥校验拒绝 activeBattlefield 与 activeBattlefieldInstance 同时非 null',
  !bothResult.success && /互斥/.test(bothResult.error.message));

// e2. 非法 instance 结构：node id 重复应拒绝
createGame(1, 1);
enterNanjunBattlefield();
const dupNodes = structuredClone(getGame());
if (dupNodes.activeBattlefieldInstance) {
  const dupInst = dupNodes.activeBattlefieldInstance;
  dupInst.nodeStates.push({ ...dupInst.nodeStates[0] });
}
const dupResult = GameStateSchema.safeParse(dupNodes);
check('e2 拒绝 node id 重复', !dupResult.success && /节点 id 重复/.test(dupResult.error.message));

// e3. orchestrator 提前断言：已有 activeBattlefield 时 enterNanjunBattlefield 抛互斥错
// 需重新构造夹具（e2 已 createGame 重置 currentGame）
createGame(1, 2);
const s3 = getGame();
const fromCity3 = Object.values(s3.cities).find((city) =>
  city.ruler === s3.playerFactionId && city.troops >= 1000 &&
  s3.campaignNodes
    .find((node) => node.id === city.id)
    ?.adjacentNodeIds.some((id) => {
      const target = s3.cities[id];
      return target?.ruler != null && target.ruler !== s3.playerFactionId;
    }),
);
if (!fromCity3) throw new Error('e3 夹具：找不到出征前线城市');
const targetCityId3 = s3.campaignNodes
  .find((n) => n.id === fromCity3.id)!
  .adjacentNodeIds.find((id) => {
    const target = s3.cities[id];
    return target?.ruler != null && target.ruler !== s3.playerFactionId;
  });
if (targetCityId3 == null) throw new Error('e3 夹具：找不到相邻敌方城');
battlefieldInit(targetCityId3, fromCity3.id);
check('e3 夹具：battlefieldInit 后服务端 activeBattlefield 非 null', getGame().activeBattlefield != null);
let threw = false;
try {
  enterNanjunBattlefield();
} catch (e) {
  threw = e instanceof Error && /Tier I 大地图战场/.test(e.message);
}
check('e3 orchestrator 互斥断言：已有 activeBattlefield 时 enter 抛错', threw);

// e4. orchestrator 提前断言：exitNanjunBattlefield 在无 instance 时不应抛错（幂等清档）
createGame(1, 1);
let exitThrew = false;
try {
  exitNanjunBattlefield();
} catch {
  exitThrew = true;
}
check('e4 exitNanjunBattlefield 在无 instance 时不抛错（幂等清档）', !exitThrew);
check('e4 exitNanjunBattlefield 后 activeBattlefieldInstance 为 null', getGame().activeBattlefieldInstance === null);

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
