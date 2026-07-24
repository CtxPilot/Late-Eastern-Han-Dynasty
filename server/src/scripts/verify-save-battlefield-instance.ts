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
  FIRST_BATCH_COUNTY_IDS,
  GameStateSchema,
  UnitType,
  FormationType,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { getRuntimeRngState } from '../runtime-rng.js';
import { tickBattlefieldInstance } from '../engine/turn.js';
import {
  battlefieldInit,
  campaignStart,
  createGame,
  enterNanjunBattlefield,
  engageCounty,
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

// ====== f. 县级攻打 + 攻占效果（BF-P2 Q9） ======
console.log('\nf. 县级攻打 + 攻占效果:');

// f0 夹具：编成一支 CampaignArmy + 进入南郡战场
createGame(1, 2);
const fState = getGame();
const fFromCity = Object.values(fState.cities).find((city) =>
  city.ruler === fState.playerFactionId && city.troops >= 1000 &&
  fState.campaignNodes
    .find((node) => node.id === city.id)
    ?.adjacentNodeIds.some((id) => {
      const target = fState.cities[id];
      return target?.ruler != null && target.ruler !== fState.playerFactionId;
    }),
);
if (!fFromCity) throw new Error('f0 夹具：找不到出征前线城市');
const fTargetNodeId = fState.campaignNodes
  .find((n) => n.id === fFromCity.id)!
  .adjacentNodeIds.find((id) => {
    const target = fState.cities[id];
    return target?.ruler != null && target.ruler !== fState.playerFactionId;
  });
if (fTargetNodeId == null) throw new Error('f0 夹具：找不到相邻敌方城');
const fCommander = fFromCity.officers
  .map((id) => fState.officers[id])
  .find((o) => o?.faction === fState.playerFactionId);
if (!fCommander) throw new Error('f0 夹具：找不到同城武将');
campaignStart({
  commanderId: fCommander.id,
  subCommanderIds: [],
  advisorId: undefined,
  fromNodeId: fFromCity.id,
  targetNodeId: fTargetNodeId,
  unitType: UnitType.HEAVY_CAVALRY,
  formation: FormationType.WEDGE,
  troopCount: 1000,
  food: 500,
});
check('f0 夹具：编成 CampaignArmy 后部队数 > 0', getGame().campaignArmies.some((a) => a.factionId === getGame().playerFactionId && a.troops > 0));

enterNanjunBattlefield();
const fInst = getGame().activeBattlefieldInstance;
check('f0 夹具：进入南郡战场后 instance 非 null', fInst != null);

// f1. engageCounty 非首批县 → 抛错
check('f1 夹具：nanjun_wu 不在首批县列表', !(FIRST_BATCH_COUNTY_IDS as readonly string[]).includes('nanjun_wu'));
let f1Threw = false;
try { engageCounty('nanjun_wu'); } catch (e) {
  f1Threw = e instanceof Error && /首批可攻打县/.test(e.message);
}
check('f1 engageCounty 非首批县抛错', f1Threw);

// f2. engageCounty 当阳 → 节点流转到已占领
const beforeDangyang = getGame().activeBattlefieldInstance!.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang');
check('f2 夹具：当阳初始 rulerFactionId 为 null', beforeDangyang?.rulerFactionId == null);
engageCounty('nanjun_dangyang');
const afterDangyang = getGame().activeBattlefieldInstance!.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang');
const f2Occupied = afterDangyang?.rulerFactionId === getGame().playerFactionId;
check('f2 engageCounty 当阳后节点 rulerFactionId = 攻方', f2Occupied);
check('f2 占领后 garrison > 0（留驻）', (afterDangyang?.garrison ?? 0) > 0);
check('f2 占领后 controlTurns = 0', afterDangyang?.controlTurns === 0);

// f3. engageCounty 己方已占领县 → 抛错
let f3Threw = false;
try { engageCounty('nanjun_dangyang'); } catch (e) {
  f3Threw = e instanceof Error && /己方控制/.test(e.message);
}
check('f3 engageCounty 己方已占领县抛错', f3Threw);

// f4. engageCounty 华容 → 另一个县也流转
engageCounty('nanjun_huarong');
const afterHuarong = getGame().activeBattlefieldInstance!.nodeStates.find((n) => n.nodeId === 'nanjun_huarong');
check('f4 engageCounty 华容后节点 rulerFactionId = 攻方', afterHuarong?.rulerFactionId === getGame().playerFactionId);

// f5. 占领后存档读档 → nodeStates 一致
const f5State = getGame();
const f5Envelope = envelopeFor(f5State);
restoreGameFromEnvelope(f5Envelope);
const f5Restored = getGame().activeBattlefieldInstance;
check('f5 占领后存档读档 instance id 一致', f5Restored?.id === f5State.activeBattlefieldInstance?.id);
check('f5 读档后当阳 rulerFactionId 一致', f5Restored?.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang')?.rulerFactionId === getGame().playerFactionId);
check('f5 读档后当阳 garrison 一致', f5Restored?.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang')?.garrison === f5State.activeBattlefieldInstance?.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang')?.garrison);

// f6. 补给线切断（简化替代版，非设计原意的糧耗×2 路径判定）：
//   ⚠️ 本断言验证的是 BF-P2 Q9 落地的**简化替代机制**——"攻方占领至少 1 个首批县
//   → 守方全部 CampaignArmy morale -5"（全局士气流失）。
//   这**不是**设计文档（docs/25-bf-p2-design.md §2.4 第 1 条）原始承诺的
//   "经过占领县的敌方 Army 糧耗×2 + 士气-5"路径判定机制。
//   简化原因：CampaignArmy（数字 cityId）与郡域县节点（字符串 countyId）当前
//   无位置映射，无法做"补给线经过攻方控制县"的路径判定。真正糧耗×2 路径判定
//   留 R6（S15 多线 AI）/ BF-P5，前置依赖是 Army-郡域位置映射。
//   f6 通过 ≠ 糧耗×2 路径判定已实现，仅代表简化替代机制按预期跑通。
//   详见 docs/25-bf-p2-design.md §2.6.1。
// 克隆攻方 Army 作为守方，调 tickBattlefieldInstance → morale -5
const f6State = getGame();
const f6DefenderId = f6State.activeBattlefieldInstance!.nodeStates.find((n) => n.nodeId === f6State.activeBattlefieldInstance!.targetSeatNodeId)?.rulerFactionId;
const f6AtkArmy = f6State.campaignArmies.find((a) => a.factionId === f6State.playerFactionId);
if (!f6AtkArmy || f6DefenderId == null) throw new Error('f6 夹具：找不到攻方 Army 或守方势力');
const f6DefArmy = { ...f6AtkArmy, id: 'f6-defender-clone', factionId: f6DefenderId, name: '守方测试军' };
const f6WithDef: GameState = { ...f6State, campaignArmies: [...f6State.campaignArmies, f6DefArmy] };
const f6BeforeMorale = f6DefArmy.morale;
const f6After = tickBattlefieldInstance(f6WithDef);
const f6AfterMorale = f6After.campaignArmies.find((a) => a.id === 'f6-defender-clone')?.morale;
check('f6 占领首批县后守方 morale -5（简化替代：全局士气流失，非糧耗×2 路径判定）', f6AfterMorale === f6BeforeMorale - 5);

// f7. 驻军消耗：占领后 controlTurns++ → 1；garrison=0 时掉控制
// 先调一次 tick → controlTurns 从 0 → 1（当阳 garrison > 0，保留控制）
const f7State1 = getGame();
const f7After1 = tickBattlefieldInstance(f7State1);
const f7Dangyang1 = f7After1.activeBattlefieldInstance?.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang');
check('f7a 占领后首次 tick controlTurns 0→1', f7Dangyang1?.controlTurns === 1);
check('f7a 首次 tick 后当阳仍为己方控制（garrison>0）', f7Dangyang1?.rulerFactionId === getGame().playerFactionId);

// 手动设 garrison=0，再调 tick → 掉控制
const f7State2 = structuredClone(f7After1);
const f7Inst2 = f7State2.activeBattlefieldInstance!;
const f7DangyangIdx = f7Inst2.nodeStates.findIndex((n) => n.nodeId === 'nanjun_dangyang');
f7Inst2.nodeStates[f7DangyangIdx] = { ...f7Inst2.nodeStates[f7DangyangIdx], garrison: 0 };
const f7After2 = tickBattlefieldInstance(f7State2);
const f7Dangyang2 = f7After2.activeBattlefieldInstance?.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang');
check('f7b garrison=0 时 tick 后掉控制（rulerFactionId=null）', f7Dangyang2?.rulerFactionId == null);
check('f7b 掉控制后 controlTurns=0', f7Dangyang2?.controlTurns === 0);

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
