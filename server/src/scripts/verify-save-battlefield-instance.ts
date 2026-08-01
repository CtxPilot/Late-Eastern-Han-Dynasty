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
  maskGameStateForPlayer,
  monthlyArmyFoodCost,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { getRuntimeRngState } from '../runtime-rng.js';
import { tickBattlefieldInstance } from '../engine/turn.js';
import { maybeReinforceCommandery, runAiMilitary } from '../engine/aiMilitary.js';
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

// f6. 补给线真实路径判定（BF-P5，替换原简化替代版）：
//   CampaignArmy（数字 cityId）与郡域县节点（字符串 countyId）的位置映射已由
//   shared/army-county-mapping.ts 提供（nodeStates[].armyIds 权威 + deployments 回退）。
//   守方 Army 补给线 = seat（江陵）→ Army 当前县 最短路径；路径经过攻方控制县 →
//   该 Army 粮耗×2 + 士气-5（docs/25-bf-p2-design.md §2.4 第 1 条 / §2.6.1）。
// 场景：当阳、华容已被攻方占领（f2/f4）。守方 Army 部署在州陵，
//   补给线 江陵→华容→州陵 经过华容（攻方）→ 应被切断。
const f6State = getGame();
const f6DefenderId = f6State.activeBattlefieldInstance!.nodeStates.find((n) => n.nodeId === f6State.activeBattlefieldInstance!.targetSeatNodeId)?.rulerFactionId;
const f6AtkArmy = f6State.campaignArmies.find((a) => a.factionId === f6State.playerFactionId);
if (!f6AtkArmy || f6DefenderId == null) throw new Error('f6 夹具：找不到攻方 Army 或守方势力');
const f6Inst = f6State.activeBattlefieldInstance!;
const placeDefenderAt = (armyId: string, nodeId: string): GameState => ({
  ...f6State,
  campaignArmies: [...f6State.campaignArmies, { ...f6AtkArmy, id: armyId, factionId: f6DefenderId, name: '守方测试军' }],
  activeBattlefieldInstance: {
    ...f6Inst,
    nodeStates: f6Inst.nodeStates.map((n) => (n.nodeId === nodeId ? { ...n, armyIds: [armyId] } : n)),
  },
});
const f6WithDef = placeDefenderAt('f6-defender-clone', 'nanjun_zhouling');
const f6BeforeMorale = f6WithDef.campaignArmies.find((a) => a.id === 'f6-defender-clone')!.morale;
const f6BeforeFood = f6WithDef.campaignArmies.find((a) => a.id === 'f6-defender-clone')!.food;
const f6After = tickBattlefieldInstance(f6WithDef, () => 0.5);
const f6AfterDef = f6After.campaignArmies.find((a) => a.id === 'f6-defender-clone');
check('f6 守方 Army 补给线经过攻方占领县（华容）→ 该 Army morale -5（真实路径判定）', f6AfterDef?.morale === f6BeforeMorale - 5);
check('f6 守方 Army 补给线被切断 → 该 Army 粮耗×2（月度粮耗折算）', f6AfterDef?.food === f6BeforeFood - monthlyArmyFoodCost(f6AtkArmy.troops) * 2);
check('f6 切断仅作用于守方 Army（攻方 Army 不受影响）', f6After.campaignArmies.find((a) => a.id === f6AtkArmy.id)?.food === f6AtkArmy.food);

// f6b 对照：守方 Army 在夷道，补给线 江陵→枝江→夷道 不经过攻方占领县 → 不受罚
const f6bWithDef = placeDefenderAt('f6b-defender-clone', 'nanjun_yidao');
const f6bBeforeMorale = f6bWithDef.campaignArmies.find((a) => a.id === 'f6b-defender-clone')!.morale;
const f6bBeforeFood = f6bWithDef.campaignArmies.find((a) => a.id === 'f6b-defender-clone')!.food;
const f6bAfter = tickBattlefieldInstance(f6bWithDef, () => 0.5);
const f6bAfterDef = f6bAfter.campaignArmies.find((a) => a.id === 'f6b-defender-clone');
check('f6b 对照：守方 Army 补给线不经过攻方占领县 → morale 不变', f6bAfterDef?.morale === f6bBeforeMorale);
check('f6b 对照：守方 Army 补给线未切断 → 粮耗不变', f6bAfterDef?.food === f6bBeforeFood);

// f7. 驻军消耗：占领后 controlTurns++ → 1；garrison=0 时掉控制
// 先调一次 tick → controlTurns 从 0 → 1（当阳 garrison > 0，保留控制）
const f7State1 = getGame();
const f7After1 = tickBattlefieldInstance(f7State1, () => 0.5);
const f7Dangyang1 = f7After1.activeBattlefieldInstance?.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang');
check('f7a 占领后首次 tick controlTurns 0→1', f7Dangyang1?.controlTurns === 1);
check('f7a 首次 tick 后当阳仍为己方控制（garrison>0）', f7Dangyang1?.rulerFactionId === getGame().playerFactionId);

// 手动设 garrison=0，再调 tick → 掉控制
const f7State2 = structuredClone(f7After1);
const f7Inst2 = f7State2.activeBattlefieldInstance!;
const f7DangyangIdx = f7Inst2.nodeStates.findIndex((n) => n.nodeId === 'nanjun_dangyang');
f7Inst2.nodeStates[f7DangyangIdx] = { ...f7Inst2.nodeStates[f7DangyangIdx], garrison: 0 };
const f7After2 = tickBattlefieldInstance(f7State2, () => 0.5);
const f7Dangyang2 = f7After2.activeBattlefieldInstance?.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang');
check('f7b garrison=0 时 tick 后掉控制（rulerFactionId=null）', f7Dangyang2?.rulerFactionId == null);
check('f7b 掉控制后 controlTurns=0', f7Dangyang2?.controlTurns === 0);

// ====== f8. 郡域迷雾（BF-P5）：mask 投影按揭示集遮蔽军情，占县揭示邻接 ======
console.log('\nf8. 郡域迷雾（BF-P5）:');

// f8 夹具复用 f2/f4 场景：当阳、华容已被攻方占领（getGame() 服务端真源）
const f8Real = getGame();
const f8Inst = f8Real.activeBattlefieldInstance!;
check('f8 夹具：服务端真源 instance 无 foggedNodeIds（mask 投影字段不入存档）', f8Inst.foggedNodeIds === undefined);

// 服务端真源军情完整（占县 garrison 保留）
const f8HuarongReal = f8Inst.nodeStates.find((n) => n.nodeId === 'nanjun_huarong');
check('f8 夹具：真源华容已占领且留驻', f8HuarongReal?.rulerFactionId === f8Real.playerFactionId && (f8HuarongReal?.garrison ?? 0) > 0);

// getClientGame 投影应用迷雾裁剪
const f8Client = getGame();
const f8Masked = maskGameStateForPlayer(f8Client);
const f8MaskedInst = f8Masked.activeBattlefieldInstance;
check('f8 投影 instance 非 null', f8MaskedInst != null);
const f8Fogged = new Set(f8MaskedInst!.foggedNodeIds ?? []);

// 揭示集：入口（当阳/枝江）+ 郡治江陵 + 占领（当阳/华容）及各自一跳邻接
check('f8 入口当阳揭示（军情可见）', !f8Fogged.has('nanjun_dangyang'));
check('f8 入口枝江揭示', !f8Fogged.has('nanjun_zhijiang'));
check('f8 郡治江陵揭示（守军可见）', !f8Fogged.has('nanjun_jiangling'));
check('f8 占领县华容揭示', !f8Fogged.has('nanjun_huarong'));
check('f8 华容邻接州陵被揭示（视野扩张）', !f8Fogged.has('nanjun_zhouling'));
check('f8 远郊巫县仍迷雾', f8Fogged.has('nanjun_wu'));

// 迷雾县军情被遮蔽：garrison/wall/armyIds 置 0
const f8WuMasked = f8MaskedInst!.nodeStates.find((n) => n.nodeId === 'nanjun_wu');
check('f8 迷雾县巫 garrison 遮蔽为 0', f8WuMasked?.garrison === 0);
check('f8 迷雾县巫 armyIds 遮蔽为空', f8WuMasked?.armyIds.length === 0);
check('f8 迷雾县巫地理层保留（name 可见）', f8WuMasked?.name === '巫');
// 已揭示县军情保留：江陵守军可见
const f8JianglingMasked = f8MaskedInst!.nodeStates.find((n) => n.nodeId === 'nanjun_jiangling');
check('f8 揭示县江陵 garrison 保留可见', (f8JianglingMasked?.garrison ?? 0) > 0);

// mask 投影不写回服务端真源（真源仍完整）
const f8RealAfter = getGame();
check('f8 mask 不修改服务端真源（真源巫县仍无迷雾标记）',
  f8RealAfter.activeBattlefieldInstance?.foggedNodeIds === undefined);

// ====== f9. 守方 Army 入郡域场景（R6）：真实流程入场 + 迷雾揭示归属 + 补给线 ======
// 背景（docs/23-design-consistency-remediation.md §三 R6）：此前 enterNanjunBattlefield
// 只收玩家（攻方）Army，守方 Army 从不入场，补给线判定与迷雾揭示只由 f6/f6b 构造
// 场景验证。f9 走真实 orchestrator 流程：守方势力在郡治（江陵 cityId 14）驻留的
// 现役 Army 自动纳入郡域战场，部署到守方纵深前沿县（模板 defenderEntryNodeIds），
// 其所在县并入迷雾揭示源；攻占补给线路径中间县后月度 tick 真实切断其补给。
console.log('\nf9. 守方 Army 入郡域场景（R6）:');

// 全新场景：英雄集结玩家势力 1；江陵（cityId 14）属势力 2
createGame(1, 1);
const f9State0 = getGame();
check('f9 夹具：江陵（cityId 14）由势力 2 占领', f9State0.cities[14]?.ruler === 2);

// 玩家编成一支攻方 Army（f0 同款夹具）
const f9From = Object.values(f9State0.cities).find((city) =>
  city.ruler === f9State0.playerFactionId && city.troops >= 1000 &&
  f9State0.campaignNodes
    .find((node) => node.id === city.id)
    ?.adjacentNodeIds.some((id) => {
      const target = f9State0.cities[id];
      return target?.ruler != null && target.ruler !== f9State0.playerFactionId;
    }),
);
if (!f9From) throw new Error('f9 夹具：找不到出征前线城市');
const f9Target = f9State0.campaignNodes
  .find((n) => n.id === f9From.id)!
  .adjacentNodeIds.find((id) => {
    const target = f9State0.cities[id];
    return target?.ruler != null && target.ruler !== f9State0.playerFactionId;
  });
if (f9Target == null) throw new Error('f9 夹具：找不到相邻敌方城');
const f9Commander = f9From.officers
  .map((id) => f9State0.officers[id])
  .find((o) => o?.faction === f9State0.playerFactionId);
if (!f9Commander) throw new Error('f9 夹具：找不到同城武将');
campaignStart({
  commanderId: f9Commander.id,
  subCommanderIds: [],
  advisorId: undefined,
  fromNodeId: f9From.id,
  targetNodeId: f9Target,
  unitType: UnitType.HEAVY_CAVALRY,
  formation: FormationType.WEDGE,
  troopCount: 1000,
  food: 500,
});
const f9PlayerArmy = getGame().campaignArmies.find((a) => a.factionId === getGame().playerFactionId);
if (!f9PlayerArmy) throw new Error('f9 夹具：找不到玩家 Army');

// 为守方势力（势力 2）注入一支驻留江陵（cityId 14）的 Army —— 模拟守方在郡治的现役军队
restoreGameFromEnvelope(envelopeFor({
  ...getGame(),
  campaignArmies: [
    ...getGame().campaignArmies,
    { ...f9PlayerArmy, id: 'f9-defender-army', factionId: 2, name: '江陵守军', currentNodeId: 14 },
  ],
}));
check('f9 夹具：守方 Army 已注入（factionId=2，驻江陵 cityId 14）',
  getGame().campaignArmies.some((a) => a.id === 'f9-defender-army' && a.factionId === 2 && a.currentNodeId === 14));

// 进入南郡战场（真实 orchestrator 流程）
enterNanjunBattlefield('nanjun');
const f9Inst = getGame().activeBattlefieldInstance;
check('f9 守方势力 = 江陵占领势力（seat rulerFactionId=2）',
  f9Inst?.nodeStates.find((n) => n.nodeId === 'nanjun_jiangling')?.rulerFactionId === 2);
check('f9 守方 Army 并入战场 armyIds', f9Inst?.armyIds.includes('f9-defender-army') ?? false);
const f9DefNode = f9Inst?.nodeStates.find((n) => n.armyIds.includes('f9-defender-army'));
check('f9 守方 Army 部署到守方纵深前沿县（州陵/夷道）',
  f9DefNode != null && (f9DefNode.nodeId === 'nanjun_zhouling' || f9DefNode.nodeId === 'nanjun_yidao'));

// 迷雾投影：守方 Army 所在县并入揭示源、armyIds 保留、deployments 不泄露
const f9Masked = maskGameStateForPlayer(getGame());
const f9MaskedInst = f9Masked.activeBattlefieldInstance;
const f9Fogged = new Set(f9MaskedInst?.foggedNodeIds ?? []);
const f9MaskedDefNode = f9MaskedInst?.nodeStates.find((n) => n.nodeId === f9DefNode!.nodeId);
check('f9 守方 Army 所在县并入揭示源（不在迷雾）', !f9Fogged.has(f9DefNode!.nodeId));
check('f9 揭示县 armyIds 保留守方 Army（玩家可见驻军）', f9MaskedDefNode?.armyIds.includes('f9-defender-army') ?? false);
check('f9 deployments 投影不含守方 Army（部署历史不泄露）',
  !f9MaskedInst?.dynamicSituation?.deployments.some((d) => d.armyId === 'f9-defender-army'));

// 补给线真实路径判定在真实流程触发：占补给线路径中间县后月度 tick → 守方 Army 被切断
if (f9DefNode!.nodeId === 'nanjun_zhouling') {
  // 州陵：补给线 江陵→华容→州陵；攻占华容（首批可攻打县）
  engageCounty('nanjun_huarong');
} else {
  // 夷道：补给线 江陵→枝江→夷道；攻占枝江（首批可攻打县）
  engageCounty('nanjun_zhijiang');
}
const f9Pre = getGame().campaignArmies.find((a) => a.id === 'f9-defender-army')!;
const f9AfterTick = tickBattlefieldInstance(getGame(), () => 0.5);
const f9DefAfter = f9AfterTick.campaignArmies.find((a) => a.id === 'f9-defender-army');
check('f9 真实流程补给线切断：守方 Army morale-5', f9DefAfter?.morale === f9Pre.morale - 5);
check('f9 真实流程补给线切断：守方 Army 粮耗×2',
  f9DefAfter?.food === f9Pre.food - monthlyArmyFoodCost(f9Pre.troops) * 2);
check('f9 补给线切断仅作用于守方 Army（攻方不受影响）',
  f9AfterTick.campaignArmies.find((a) => a.id === f9PlayerArmy.id)?.food === f9PlayerArmy.food);

// ====== f10. 县级主动 AI（R6 后续 · S15，Session 259）：守方 Army 主动行动 + 交战闭环 ======
// 背景（docs/25-bf-p2-design.md §2.6.4）：Session 258 后守方 Army 能入郡域但只被动
// 扣粮/士气；engageCounty 也只打驻军、无视 nodeStates[].armyIds 中的守方 Army
// （玩家看得见却打不着）。f10 走真实 orchestrator 流程验证：
//   f10a 守方 Army 月度主动移动（向最近攻方占领县移动一格）；
//   f10c 玩家攻打含守方 Army 的县 → 守方 Army 参战 → 攻方胜 → 溃退移驻 seat；
//   f10b 补给线被切断且士气 <60 → 撤出郡域回大地图。
console.log('\nf10. 县级主动 AI（守方 Army 主动行动 + 交战闭环）:');

// f10 夹具：玩家势力 1，江陵（cityId 14）属势力 2；编成玩家 Army（troops 可调），
// 注入守方 Army（troops/morale 可调，驻江陵）后进入南郡战场（守方 Army 部署到
// 州陵或夷道）。返回最新状态下的玩家 Army/守方 Army 与守方 Army 部署县。
function f10Setup(opts: { playerTroops?: number; defTroops?: number; defMorale?: number }): {
  playerArmy: ReturnType<typeof getGame>['campaignArmies'][number];
  defArmy: ReturnType<typeof getGame>['campaignArmies'][number];
  defNode: string;
} {
  createGame(1, 1);
  const state0 = getGame();
  const from = Object.values(state0.cities).find((city) =>
    city.ruler === state0.playerFactionId && city.troops >= 1000 &&
    state0.campaignNodes
      .find((node) => node.id === city.id)
      ?.adjacentNodeIds.some((id) => {
        const targetCity = state0.cities[id];
        return targetCity?.ruler != null && targetCity.ruler !== state0.playerFactionId;
      }),
  );
  if (!from) throw new Error('f10 夹具：找不到出征前线城市');
  const target = state0.campaignNodes
    .find((n) => n.id === from.id)!
    .adjacentNodeIds.find((id) => {
      const targetCity = state0.cities[id];
      return targetCity?.ruler != null && targetCity.ruler !== state0.playerFactionId;
    });
  if (target == null) throw new Error('f10 夹具：找不到相邻敌方城');
  const commander = from.officers
    .map((id) => state0.officers[id])
    .find((o) => o?.faction === state0.playerFactionId);
  if (!commander) throw new Error('f10 夹具：找不到同城武将');
  campaignStart({
    commanderId: commander.id,
    subCommanderIds: [],
    advisorId: undefined,
    fromNodeId: from.id,
    targetNodeId: target,
    unitType: UnitType.HEAVY_CAVALRY,
    formation: FormationType.WEDGE,
    troopCount: opts.playerTroops ?? 5000,
    food: 500,
  });
  const playerArmy = getGame().campaignArmies.find((a) => a.factionId === getGame().playerFactionId)!;
  restoreGameFromEnvelope(envelopeFor({
    ...getGame(),
    campaignArmies: [
      ...getGame().campaignArmies,
      {
        ...playerArmy,
        id: 'f10-def-army',
        factionId: 2,
        name: '江陵守军',
        currentNodeId: 14,
        troops: opts.defTroops ?? 1000,
        morale: opts.defMorale ?? 95,
      },
    ],
  }));
  enterNanjunBattlefield('nanjun');
  const inst = getGame().activeBattlefieldInstance!;
  const defNode = inst.nodeStates.find((n) => n.armyIds.includes('f10-def-army'))!.nodeId;
  const cur = getGame();
  return {
    playerArmy: cur.campaignArmies.find((a) => a.factionId === cur.playerFactionId)!,
    defArmy: cur.campaignArmies.find((a) => a.id === 'f10-def-army')!,
    defNode,
  };
}

// ---- f10a：守方 Army 月度主动移动（向最近攻方占领县移动一格）----
{
  const fx = f10Setup({});
  // 玩家攻占入口县当阳（可攻打县）→ 州陵补给线（江陵→华容→州陵）未被截断
  // （当阳不在其路径上）→ 规则③：守方 Army 向最近攻方县（当阳）移动一格
  // （州陵→华容，华容为路径首步且未被攻方占领）
  engageCounty('nanjun_dangyang');
  check('f10a 夹具：当阳已被玩家占领', getGame().activeBattlefieldInstance?.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang')?.rulerFactionId === getGame().playerFactionId);
  const f10aAfter = tickBattlefieldInstance(getGame(), () => 0.5);
  const f10aDefNode = f10aAfter.activeBattlefieldInstance?.nodeStates.find((n) => n.armyIds.includes('f10-def-army'));
  check('f10a 守方 Army 向最近攻方县移动一格（州陵→华容）', f10aDefNode?.nodeId === 'nanjun_huarong');
  check('f10a 移动后原县 armyIds 移除', !f10aAfter.activeBattlefieldInstance?.nodeStates.find((n) => n.nodeId === fx.defNode)?.armyIds.includes('f10-def-army'));
  check('f10a 移动同步 deployments 回退表',
    f10aAfter.activeBattlefieldInstance?.dynamicSituation?.deployments.find((d) => d.armyId === 'f10-def-army')?.nodeId === 'nanjun_huarong');
  // 写回 currentGame（tickBattlefieldInstance 为纯函数，后续 f10c 需基于移动后状态）
  restoreGameFromEnvelope(envelopeFor(f10aAfter));
}

// ---- f10c：玩家攻打含守方 Army 的县 → 参战 + 溃退移驻 seat ----
{
  // 延续 f10a 状态：守方 Army 已移动至华容（可攻打县）。玩家再次攻打华容 →
  // 守方 Army 合成守军参战 → 玩家胜 → 溃退移驻 seat（江陵未被攻方占领）。
  const preState = getGame();
  const preDefArmy = preState.campaignArmies.find((a) => a.id === 'f10-def-army')!;
  engageCounty('nanjun_huarong');
  const f10c = getGame();
  const f10cInst = f10c.activeBattlefieldInstance!;
  check('f10c 华容已被玩家攻占（守方 Army 参战后）', f10cInst.nodeStates.find((n) => n.nodeId === 'nanjun_huarong')?.rulerFactionId === f10c.playerFactionId);
  check('f10c 攻方胜 → 守方 Army 溃退移驻 seat（江陵）', f10cInst.nodeStates.find((n) => n.nodeId === 'nanjun_jiangling')?.armyIds.includes('f10-def-army') ?? false);
  check('f10c 溃退 Army 不再驻留华容', !f10cInst.nodeStates.find((n) => n.nodeId === 'nanjun_huarong')?.armyIds.includes('f10-def-army'));
  const f10cDefAfter = f10c.campaignArmies.find((a) => a.id === 'f10-def-army')!;
  check('f10c 溃退 Army 带回残兵（troops 按比例回填 < 参战前）', f10cDefAfter.troops > 0 && f10cDefAfter.troops < preDefArmy.troops);
  check('f10c 溃退同步 deployments 回退表',
    f10cInst.dynamicSituation?.deployments.find((d) => d.armyId === 'f10-def-army')?.nodeId === 'nanjun_jiangling');
  check('f10c 攻方 Army 兵力已消耗回填', f10c.campaignArmies.find((a) => a.id === preState.campaignArmies.find((x) => x.factionId === preState.playerFactionId)!.id)!.troops < preState.campaignArmies.find((x) => x.factionId === preState.playerFactionId)!.troops);
}

// ---- f10b：补给线被切断且士气 <60 → 守方 Army 撤出郡域回大地图 ----
{
  const f10bSetup = f10Setup({ defMorale: 50 });
  // 占华容 + 占枝江：无论守方 Army 部署在州陵（补给线 江陵→华容→州陵 经华容）
  // 还是夷道（补给线 江陵→枝江→夷道 经枝江），均被切断；morale 50 <60 → 撤出
  void f10bSetup;
  engageCounty('nanjun_huarong');
  engageCounty('nanjun_zhijiang');
  const f10bAfter = tickBattlefieldInstance(getGame(), () => 0.5);
  const f10bInst = f10bAfter.activeBattlefieldInstance!;
  check('f10b 补给线切断 + 士气<60 → 守方 Army 撤出郡域（位置表移除）',
    !f10bInst.nodeStates.some((n) => n.armyIds.includes('f10-def-army')));
  check('f10b 撤出同步 deployments 回退表（无该 Army 条目）',
    !f10bInst.dynamicSituation?.deployments.some((d) => d.armyId === 'f10-def-army'));
  check('f10b 撤出后 Army 回到大地图（campaignArmies 仍存在，currentNodeId=江陵 14）',
    f10bAfter.campaignArmies.some((a) => a.id === 'f10-def-army' && a.currentNodeId === 14));
  check('f10b 撤出前当月仍受补给线惩罚（morale-5、粮耗×2）',
    f10bAfter.campaignArmies.find((a) => a.id === 'f10-def-army')!.morale === 50 - 5);
}

// ====== f11. 大地图 AI 向郡域增援（R6 后续 · S15 深化，Session 260）======
// 背景（docs/25-bf-p2-design.md §2.6.4 / docs/12-system-map.md S15）：县级主动 AI
// 落地后守方 Army 会在郡域内行动/撤退，但郡域守军得不到补充。f11 验证增援管线：
//   f11a 触发增援（决策 RNG 通过）→ 新 Army 编成入场（phase=garrison、armyIds、
//         部署州陵/夷道、deployments 同步、郡治城兵力扣减）；
//   f11b 判定失败 → 零变更（RNG 消费 1 次但无编成）；
//   f11c 攻方占县提升增援概率（0.3+0.1=0.4）→ 低判定值触发；
//   f11d 郡域内守方 Army 达上限（2）→ 不再增援；
//   f11e 端到端：runAiMilitary 全流程（含常规出征）后增援 Army 在场。
console.log('\nf11. 大地图 AI 向郡域增援:');

// ---- f11a 触发增援 ----
createGame(1, 1);
enterNanjunBattlefield('nanjun');
const f11aPre = getGame();
const f11aCityTroops = f11aPre.cities[14].troops; // 江陵（cityId 14）属势力 2
const f11aArmyCount = f11aPre.campaignArmies.length;
check('f11a 夹具：江陵属势力 2 且可调兵', f11aPre.cities[14].ruler === 2 && f11aCityTroops > 0);
const f11aAfter = maybeReinforceCommandery(f11aPre, 2, () => 0.1); // 0.1 < 0.3 → 触发
const f11aInst = f11aAfter.activeBattlefieldInstance!;
const f11aNew = f11aAfter.campaignArmies.find((a) => a.factionId === 2 && a.phase === 'garrison' && !f11aPre.campaignArmies.some((p) => p.id === a.id));
check('f11a 增援 Army 编成（势力 2，phase=garrison，新 Army）', !!f11aNew);
check('f11a 增援 Army 加入战场 armyIds', f11aNew ? f11aInst.armyIds.includes(f11aNew.id) : false);
check('f11a 增援部署到守方纵深前沿县（州陵/夷道）',
  f11aNew ? f11aInst.nodeStates.some((n) =>
    (n.nodeId === 'nanjun_zhouling' || n.nodeId === 'nanjun_yidao') && n.armyIds.includes(f11aNew.id)) : false);
check('f11a deployments 回退表同步',
  f11aNew ? (f11aInst.dynamicSituation?.deployments.some((d) =>
    d.armyId === f11aNew.id && (d.nodeId === 'nanjun_zhouling' || d.nodeId === 'nanjun_yidao')) ?? false) : false);
check('f11a 郡治城兵力扣减', f11aAfter.cities[14].troops < f11aCityTroops);
check('f11a actionLog 记录增援', f11aAfter.actionLog.some((l) => l.message.includes('增援')));

// ---- f11b 判定失败 → 零变更 ----
const f11bAfter = maybeReinforceCommandery(f11aPre, 2, () => 0.9); // 0.9 ≥ 0.3 → 不触发
check('f11b 判定失败 → 不编成（campaignArmies 数量不变）', f11bAfter.campaignArmies.length === f11aArmyCount);
check('f11b 判定失败 → 战场实例零变更（同一引用）', f11bAfter.activeBattlefieldInstance === f11aPre.activeBattlefieldInstance);

// ---- f11c 攻方占县提升增援概率（0.3 + 1×0.1 = 0.4）----
const f11cInst = {
  ...f11aPre.activeBattlefieldInstance!,
  nodeStates: f11aPre.activeBattlefieldInstance!.nodeStates.map((n) =>
    n.nodeId === 'nanjun_dangyang' ? { ...n, rulerFactionId: 1, garrison: 500 } : n),
};
const f11cPre = { ...f11aPre, activeBattlefieldInstance: f11cInst };
const f11cAfter = maybeReinforceCommandery(f11cPre, 2, () => 0.35); // 0.35 < 0.4 → 触发
check('f11c 占县提升增援概率 → 触发（0.35 < 0.4）',
  f11cAfter.campaignArmies.some((a) => a.factionId === 2 && a.phase === 'garrison' && !f11cPre.campaignArmies.some((p) => p.id === a.id)));

// ---- f11d 郡域内守方 Army 达上限（2）→ 不再增援 ----
// 先为江陵补兵（每次增援扣 ~60% 可调兵力，两次需充足库存），再连续触发
restoreGameFromEnvelope(envelopeFor({
  ...getGame(),
  cities: { ...getGame().cities, 14: { ...getGame().cities[14], troops: 20_000, food: 20_000 } },
}));
const f11d1 = maybeReinforceCommandery(getGame(), 2, () => 0.1); // 第 1 支
const f11d2 = maybeReinforceCommandery(f11d1, 2, () => 0.1); // 第 2 支
const f11dGarrisonCount = (st: GameState) =>
  st.campaignArmies.filter((a) => a.factionId === 2 && a.phase === 'garrison').length;
check('f11d 可再增援至上限 2', f11dGarrisonCount(f11d2) === 2);
const f11d3 = maybeReinforceCommandery(f11d2, 2, () => 0.1); // 已达上限
check('f11d 已达上限 → 不再增援', f11dGarrisonCount(f11d3) === 2);

// ---- f11e 端到端：runAiMilitary 全流程触发增援 ----
createGame(1, 1);
restoreGameFromEnvelope(envelopeFor({
  ...getGame(),
  cities: { ...getGame().cities, 14: { ...getGame().cities[14], troops: 20_000, food: 20_000 } },
}));
enterNanjunBattlefield('nanjun');
const f11eAfter = runAiMilitary(getGame(), () => 0.5, () => 0.1);
check('f11e 端到端：runAiMilitary 后存在增援 Army（phase=garrison 势力 2）或增援日志',
  f11eAfter.campaignArmies.some((a) => a.factionId === 2 && a.phase === 'garrison') ||
  f11eAfter.actionLog.some((l) => l.message.includes('增援')));

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
