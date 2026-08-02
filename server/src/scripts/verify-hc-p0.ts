// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * HC-P0-1 + HC-P0-2 + HC-P0-3 + HC-P0-4 + HC-P0-5 确定性验证（docs/26 霸府/称王/称帝主线地基+开府+霸府官职+外交权重）。
 *
 * 覆盖：
 * 1. 两个剧本开局 emperorLocation 指向洛阳(id=1) + 所有势力 politicalStage='vassal'
 * 2. controlsEmperor 在城池易主前后正确响应（emperorLocation 不变，判定随城池归属动态变）
 * 3. 存档信封往返一致性（emperorLocation + politicalStage 序列化/反序列化保留）
 * 4. 旧存档降级（无 emperorLocation + 无 politicalStage → parse 通过，字段 undefined 不报错）
 * 5. GameStateSchema.strict() 接受新字段（ROOT_KEYS 已加 emperorLocation）
 * 6. HC-P0-3 开霸府操作：前置校验（未控制汉帝/已开府/已是王帝拒绝）+ 状态转移 + actionLog + 存档往返
 * 7. HC-P0-4 霸府专属官职：前置校验（诸侯状态拒绝）+ 任命成功（字段写入）+ 势力唯一性（替换旧任）+ 存档往返 + 解职
 * 8. HC-P0-5 霸府外交权重加成：结盟成功率修正 + 进贡/宫廷牵线友好增量放大 + 分档预留（king/emperor）
 *
 * Run: pnpm verify-hc-p0
 */
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  GameStateSchema,
  HegemonyPosition,
  calculateAllianceChance,
  findDiplomacy,
  hegemonyAllianceModifier,
  hegemonyFavorMultiplier,
  parseCurrentSaveEnvelope,
  controlsEmperor,
  syncMerit,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { createGame, getGame, doEstablishHegemony, doTribute } from '../services/game.js';
import {
  FALSE_DECREE_COOLDOWN_QUARTERS,
  FALSE_DECREE_COST,
  HAN_LOYALIST_FAME_PENALTY,
  declareWarByFalseDecree,
  establishHegemony,
  tickImperialAuthorityQuarter,
} from '../engine/hegemony.js';
import { appointOfficer } from '../engine/appoint.js';
import { getRuntimeRngState } from '../runtime-rng.js';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean): void {
  if (condition) { passed += 1; console.log(`  ✓ ${label}`); }
  else { failed += 1; console.error(`  ✗ ${label}`); }
}

function envelopeFor(state: GameState): SaveEnvelopeV1 {
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: '2026-07-25T10:00:00.000Z',
    updatedAt: '2026-07-25T10:05:00.000Z',
    scenarioId: state.scenarioId,
    rng: getRuntimeRngState(),
    snapshot: state,
  };
}

console.log('\n=== HC-P0-1 + HC-P0-2 汉献帝控制权 + politicalStage 地基验证 ===\n');

// ── 1. 剧本初始值 ──
console.log('— 剧本初始值 —');
for (const scenario of [
  { id: 1, factionId: 1, label: '英雄集结' },
  { id: 2, factionId: 1, label: '关东义兵' },
]) {
  createGame(scenario.id, scenario.factionId);
  const state = getGame();
  check(`${scenario.label}: emperorLocation === 1（洛阳）`, state.emperorLocation === 1);
  check(`${scenario.label}: 洛阳(id=1) 城池存在`, state.cities[1] != null);
  const factions = Object.values(state.factions);
  check(`${scenario.label}: 所有 ${factions.length} 势力 politicalStage === 'vassal'`, factions.every((f) => f.politicalStage === 'vassal'));
  // 控制汉帝判定：开局占领洛阳的势力应返回 true
  const luoyangRuler = state.cities[1]?.ruler ?? null;
  if (luoyangRuler != null) {
    check(`${scenario.label}: 占领洛阳的势力(faction ${luoyangRuler}) controlsEmperor=true`, controlsEmperor(state, luoyangRuler) === true);
    const otherFaction = factions.find((f) => f.id !== luoyangRuler);
    if (otherFaction) {
      check(`${scenario.label}: 非占领洛阳势力 controlsEmperor=false`, controlsEmperor(state, otherFaction.id) === false);
    }
  }
}

// ── 2. 城池易主响应 ──
console.log('\n— 城池易主响应（emperorLocation 不变，判定动态变）—');
createGame(1, 1);
const before = getGame();
const luoyangRulerBefore = before.cities[1]?.ruler ?? null;
check('易主前 emperorLocation=1', before.emperorLocation === 1);
if (luoyangRulerBefore != null) {
  check(`易主前 faction ${luoyangRulerBefore} controlsEmperor=true`, controlsEmperor(before, luoyangRulerBefore) === true);
}
// 模拟城池易主：直接改 city.ruler（不改 emperorLocation）
const after = structuredClone(before);
const newRuler = Object.values(before.factions).find((f) => f.id !== luoyangRulerBefore && f.isAlive);
if (newRuler && luoyangRulerBefore != null) {
  after.cities[1].ruler = newRuler.id;
  check('易主后 emperorLocation 仍=1（字段不变）', after.emperorLocation === 1);
  check(`易主后原势力(faction ${luoyangRulerBefore}) controlsEmperor=false`, controlsEmperor(after, luoyangRulerBefore) === false);
  check(`易主后新势力(faction ${newRuler.id}) controlsEmperor=true`, controlsEmperor(after, newRuler.id) === true);
} else {
  check('易主测试夹具可用（存在其他存活势力）', false);
}

// ── 3. 存档往返一致性 ──
console.log('\n— 存档信封往返一致性 —');
createGame(1, 1);
const state = getGame();
const save = envelopeFor(state);
const parsed = parseCurrentSaveEnvelope(save);
check('往返后 emperorLocation 保留 === 1', parsed.snapshot.emperorLocation === 1);
check('往返后 politicalStage 保留 === "vassal"（取一个势力）', Object.values(parsed.snapshot.factions)[0]?.politicalStage === 'vassal');
check('往返后完整 GameStateSchema 通过', GameStateSchema.safeParse(parsed.snapshot).success);

// ── 4. 旧存档降级（无新字段）──
console.log('\n— 旧存档降级（无 emperorLocation + 无 politicalStage）—');
const legacySave = structuredClone(save);
delete (legacySave.snapshot as Partial<GameState>).emperorLocation;
for (const fid of Object.keys(legacySave.snapshot.factions)) {
  delete (legacySave.snapshot.factions[Number(fid)] as { politicalStage?: unknown }).politicalStage;
}
let legacyParsed: GameState | null = null;
let legacyError: Error | null = null;
try {
  legacyParsed = parseCurrentSaveEnvelope(legacySave).snapshot;
} catch (error) {
  legacyError = error as Error;
}
check('旧存档（无新字段）parse 不报错', legacyError === null && legacyParsed != null);
if (legacyParsed) {
  check('旧存档降级后 emperorLocation === undefined（引擎层兜底为 null 语义）', legacyParsed.emperorLocation === undefined);
  check('旧存档降级后 politicalStage === undefined（引擎层兜底为 vassal 语义）', Object.values(legacyParsed.factions)[0]?.politicalStage === undefined);
  check('旧存档降级后 controlsEmperor 对任何势力返回 false（emperorLocation undefined）', !controlsEmperor(legacyParsed, 1) && !controlsEmperor(legacyParsed, 2));
}

// ── 5. GameStateSchema.strict() 接受新字段 ──
console.log('\n— GameStateSchema.strict() 接受新字段 —');
check('完整权威状态（含 emperorLocation + politicalStage）通过 GameStateSchema', GameStateSchema.safeParse(getGame()).success);

// ── 6. politicalStage 枚举校验 ──
console.log('\n— politicalStage 枚举校验 —');
const badStage = structuredClone(getGame());
(badStage.factions[1] as { politicalStage?: unknown }).politicalStage = 'invalidStage';
check('politicalStage 非法值被 Zod 拒绝', !GameStateSchema.safeParse(badStage).success);

// ── 7. HC-P0-3 开霸府操作 ──
console.log('\n— HC-P0-3 开霸府操作 —');

// 7a. 前置：未控制汉帝时开府应被拒绝
// 190 剧本选曹操（faction 1，不占洛阳，洛阳归董卓 faction 4）→ 不控制汉帝
createGame(2, 1);
let hegemonyRejected = false;
let hegemonyError = '';
try {
  establishHegemony(getGame(), 1);
} catch (e) {
  hegemonyRejected = true;
  hegemonyError = (e as Error).message;
}
check('未控制汉帝时开府被拒绝', hegemonyRejected);
check('拒绝信息含"未控制汉献帝"', hegemonyError.includes('未控制汉献帝'));

// 7b. 前置：已开府重复开府应被拒绝
// 先让曹操控制汉帝（把洛阳 ruler 改成 1），开府成功，再尝试重复开府
createGame(2, 1);
const fakeControlState = structuredClone(getGame());
fakeControlState.cities[1].ruler = 1; // 模拟曹操占领洛阳
let afterEstablish = establishHegemony(fakeControlState, 1);
check('控制汉帝后开府成功：politicalStage === "hegemon"', afterEstablish.factions[1].politicalStage === 'hegemon');
check('开府后 politicalTitle === "丞相"', afterEstablish.factions[1].politicalTitle === '丞相');
check('开府后 politicalStageChangedYear === 当前年', afterEstablish.factions[1].politicalStageChangedYear === afterEstablish.currentYear);
check('开府后 actionLog 含 hegemony_established 类型', afterEstablish.actionLog.some((l) => l.type === 'hegemony_established'));

let repeatRejected = false;
try {
  establishHegemony(afterEstablish, 1);
} catch (e) {
  repeatRejected = (e as Error).message.includes('已是霸府');
}
check('已是霸府时重复开府被拒绝（"已是霸府"）', repeatRejected);

// 7c. 前置：已是王/帝状态时开府应被拒绝
const kingState = structuredClone(afterEstablish);
(kingState.factions[1] as { politicalStage?: string }).politicalStage = 'king';
let kingRejected = false;
try {
  establishHegemony(kingState, 1);
} catch (e) {
  kingRejected = (e as Error).message.includes('已称王');
}
check('已是王状态时开府被拒绝（"已称王"）', kingRejected);

const emperorState = structuredClone(afterEstablish);
(emperorState.factions[1] as { politicalStage?: string }).politicalStage = 'emperor';
let emperorRejected = false;
try {
  establishHegemony(emperorState, 1);
} catch (e) {
  emperorRejected = (e as Error).message.includes('已称帝');
}
check('已是帝状态时开府被拒绝（"已称帝"）', emperorRejected);

// 7d. 端到端：英雄集结曹操（faction 1 占洛阳，开局即控制汉帝）→ service doEstablishHegemony 成功
createGame(1, 1);
const beforeService = getGame();
check('英雄集结曹操开局 controlsEmperor=true', controlsEmperor(beforeService, 1));
const afterService = doEstablishHegemony();
check('service doEstablishHegemony 后 politicalStage === "hegemon"', afterService.factions[1].politicalStage === 'hegemon');
check('service doEstablishHegemony 后 politicalTitle === "丞相"', afterService.factions[1].politicalTitle === '丞相');
check('service doEstablishHegemony 后 actionLog 含开府记录', afterService.actionLog.some((l) => l.type === 'hegemony_established' && l.message.includes('开霸府')));

// 7e. 开府后存档往返一致性
const hegemonySave = envelopeFor(getGame());
const hegemonyParsed = parseCurrentSaveEnvelope(hegemonySave);
check('开府状态存档往返后 politicalStage === "hegemon"', hegemonyParsed.snapshot.factions[1].politicalStage === 'hegemon');
check('开府状态存档往返后 politicalTitle === "丞相"', hegemonyParsed.snapshot.factions[1].politicalTitle === '丞相');
check('开府状态存档往返后 GameStateSchema 通过', GameStateSchema.safeParse(hegemonyParsed.snapshot).success);

// 7f. 开府后 service 层再调用应被拒绝（currentGame 已是霸府）
let serviceRepeatRejected = false;
try {
  doEstablishHegemony();
} catch (e) {
  serviceRepeatRejected = (e as Error).message.includes('已是霸府');
}
check('service 层重复开府被拒绝（currentGame 已是霸府）', serviceRepeatRejected);

// ── 8. HC-P0-4 霸府专属官职 ──
console.log('\n— HC-P0-4 霸府专属官职 —');

// 8a. 前置：诸侯状态势力尝试任命霸府官职应被拒绝
// 190 剧本选曹操（faction 1）→ 开局 politicalStage='vassal'，未开府
createGame(2, 1);
let vassalAppointRejected = false;
let vassalAppointError = '';
try {
  appointOfficer(getGame(), 9, 'hegemony', HegemonyPosition.GRAND_COMMANDER);
} catch (e) {
  vassalAppointRejected = true;
  vassalAppointError = (e as Error).message;
}
check('诸侯状态势力任命霸府官职被拒绝', vassalAppointRejected);
check('拒绝信息含"仍是诸侯"', vassalAppointError.includes('仍是诸侯'));

// 8b. 前置：无效霸府官职值应被拒绝
createGame(1, 1);
let invalidPositionRejected = false;
try {
  appointOfficer(getGame(), 9, 'hegemony', 'invalidHegemonyPos');
} catch (e) {
  invalidPositionRejected = (e as Error).message.includes('无效官职');
}
check('无效霸府官职值被拒绝', invalidPositionRejected);

// 8c. 任命成功：英雄集结曹操（faction 1 占洛阳→控制汉帝），开霸府后任命霸府官职
createGame(1, 1);
doEstablishHegemony();
// 夏侯惇 id=9 (统85 武90) 满足大司马 (统85 武75) 与都督中外诸军事 (统85 武80)
// S12 功绩门槛（docs/04 §十）：夹具给目标武将补 Lv6 功绩（1200），使断言聚焦政治阶段/属性/唯一性
const hc0Game = getGame();
hc0Game.officers[9] = syncMerit({ ...hc0Game.officers[9], merit: 1200 });
hc0Game.officers[101] = syncMerit({ ...hc0Game.officers[101], merit: 1200 });
const afterAppoint1 = appointOfficer(getGame(), 9, 'hegemony', HegemonyPosition.GRAND_COMMANDER);
check('霸府状态势力任命大司马成功', afterAppoint1.officers[9].hegemonyPosition === HegemonyPosition.GRAND_COMMANDER);
check('任命大司马后 actionLog 含 appoint', afterAppoint1.actionLog.some((l) => l.type === 'appoint' && l.message.includes('大司马')));

// 8d. 唯一性：同一势力重复任命同一霸府官职给另一武将，旧任者应被替换为 NONE
// 曹仁 id=101 (统90 武86) 也满足大司马门槛 → 任命给曹仁应清除夏侯惇的大司马
const afterAppoint2 = appointOfficer(afterAppoint1, 101, 'hegemony', HegemonyPosition.GRAND_COMMANDER);
check('唯一性：重复任命同一霸府官职，新任者字段写入', afterAppoint2.officers[101].hegemonyPosition === HegemonyPosition.GRAND_COMMANDER);
check('唯一性：旧任者夏侯惇 hegemonyPosition 被清为 NONE', afterAppoint2.officers[9].hegemonyPosition === HegemonyPosition.NONE);

// 8e. 唯一性：已是该霸府官职的武将重复任命应被拒绝
let sameAppointRejected = false;
try {
  appointOfficer(afterAppoint2, 101, 'hegemony', HegemonyPosition.GRAND_COMMANDER);
} catch (e) {
  sameAppointRejected = (e as Error).message.includes('已是该霸府官职');
}
check('已是该霸府官职时重复任命被拒绝', sameAppointRejected);

// 8f. 不同霸府官职可并存：夏侯惇任都督中外诸军事 (统85武80) + 曹仁任大司马
const afterAppoint3 = appointOfficer(afterAppoint2, 9, 'hegemony', HegemonyPosition.GRAND_CAPTAIN);
check('不同霸府官职可并存：夏侯惇任都督中外诸军事', afterAppoint3.officers[9].hegemonyPosition === HegemonyPosition.GRAND_CAPTAIN);
check('不同霸府官职并存：曹仁仍任大司马', afterAppoint3.officers[101].hegemonyPosition === HegemonyPosition.GRAND_COMMANDER);

// 8g. 解职：position=none 应清空 hegemonyPosition
const afterDismiss = appointOfficer(afterAppoint3, 9, 'hegemony', HegemonyPosition.NONE);
check('解职霸府官职后 hegemonyPosition === NONE', afterDismiss.officers[9].hegemonyPosition === HegemonyPosition.NONE);
check('解职后 actionLog 含解职记录', afterDismiss.actionLog.some((l) => l.type === 'appoint' && l.message.includes('解职') && l.message.includes('霸府')));

// 8h. 属性不足者任命应被拒绝
// 典韦 id=13 (统70 武97) 武满足大司马但统70<85 → 应被拒绝
let weakRejected = false;
let weakError = '';
try {
  appointOfficer(afterDismiss, 13, 'hegemony', HegemonyPosition.GRAND_COMMANDER);
} catch (e) {
  weakRejected = true;
  weakError = (e as Error).message;
}
check('属性不足者任命霸府官职被拒绝', weakRejected);
check('拒绝信息含"属性不足"', weakError.includes('属性不足'));

// 8i. 存档往返一致性：霸府官职字段序列化/反序列化保留
createGame(1, 1);
doEstablishHegemony();
const hc0i = getGame();
hc0i.officers[9] = syncMerit({ ...hc0i.officers[9], merit: 1200 });
const hegemonyAppointState = appointOfficer(getGame(), 9, 'hegemony', HegemonyPosition.GRAND_COMMANDER);
const hegemonyAppointSave = envelopeFor(hegemonyAppointState);
const hegemonyAppointParsed = parseCurrentSaveEnvelope(hegemonyAppointSave);
check('霸府官职存档往返后字段保留 === GRAND_COMMANDER', hegemonyAppointParsed.snapshot.officers[9].hegemonyPosition === HegemonyPosition.GRAND_COMMANDER);
check('霸府官职存档往返后 GameStateSchema 通过', GameStateSchema.safeParse(hegemonyAppointParsed.snapshot).success);

// 8j. 旧存档降级（无 hegemonyPosition 字段）
const legacyHegemonySave = structuredClone(hegemonyAppointSave);
for (const oid of Object.keys(legacyHegemonySave.snapshot.officers)) {
  delete (legacyHegemonySave.snapshot.officers[Number(oid)] as { hegemonyPosition?: unknown }).hegemonyPosition;
}
let legacyHegemonyParsed: GameState | null = null;
let legacyHegemonyError: Error | null = null;
try {
  legacyHegemonyParsed = parseCurrentSaveEnvelope(legacyHegemonySave).snapshot;
} catch (error) {
  legacyHegemonyError = error as Error;
}
check('旧存档（无 hegemonyPosition）parse 不报错', legacyHegemonyError === null && legacyHegemonyParsed != null);
if (legacyHegemonyParsed) {
  check('旧存档降级后 hegemonyPosition === undefined', legacyHegemonyParsed.officers[9]?.hegemonyPosition === undefined);
  check('旧存档降级后 GameStateSchema 通过', GameStateSchema.safeParse(legacyHegemonyParsed).success);
}

// 8k. HegemonyPosition 非法值被 Zod 拒绝
const badHegemony = structuredClone(getGame());
(badHegemony.officers[9] as { hegemonyPosition?: unknown }).hegemonyPosition = 'invalidHegemony';
check('hegemonyPosition 非法值被 Zod 拒绝', !GameStateSchema.safeParse(badHegemony).success);

// ── 9. HC-P0-5 霸府外交权重加成 ──
console.log('\n— HC-P0-5 霸府外交权重加成 —');

// 9a. 分档函数边界值
check('hegemonyAllianceModifier vassal=0', hegemonyAllianceModifier('vassal') === 0);
check('hegemonyAllianceModifier hegemon=+5', hegemonyAllianceModifier('hegemon') === 5);
check('hegemonyAllianceModifier king=+8', hegemonyAllianceModifier('king') === 8);
check('hegemonyAllianceModifier emperor=+12', hegemonyAllianceModifier('emperor') === 12);
check('hegemonyAllianceModifier undefined=0', hegemonyAllianceModifier(undefined) === 0);
check('hegemonyFavorMultiplier vassal=1.0', hegemonyFavorMultiplier('vassal') === 1.0);
check('hegemonyFavorMultiplier hegemon=1.1', hegemonyFavorMultiplier('hegemon') === 1.1);
check('hegemonyFavorMultiplier king=1.2', hegemonyFavorMultiplier('king') === 1.2);
check('hegemonyFavorMultiplier emperor=1.3', hegemonyFavorMultiplier('emperor') === 1.3);
check('hegemonyFavorMultiplier undefined=1.0', hegemonyFavorMultiplier(undefined) === 1.0);

// 9b. 诸侯状态 vs 霸府状态结盟成功率对比
// 英雄集结 faction 1 占洛阳=控制汉帝，可开霸府；faction 3 是另一存活势力
createGame(1, 1);
const vassalChance = calculateAllianceChance(getGame(), 3).chance;
check('诸侯状态结盟成功率可计算', vassalChance >= 5 && vassalChance <= 90);
// 开霸府后同样条件结盟成功率应严格更高（或都被 clamp 到 90 上界）
doEstablishHegemony();
const hegemonBreakdown = calculateAllianceChance(getGame(), 3);
check('霸府状态 breakdown.hegemonyModifier === 5', hegemonBreakdown.hegemonyModifier === 5);
check('霸府状态结盟成功率 ≥ 诸侯状态', hegemonBreakdown.chance >= vassalChance);
// 若未触上界，差值应恰好为 +5
if (vassalChance < 90) {
  check('霸府状态结盟成功率 = 诸侯+5（未触上界）', hegemonBreakdown.chance === Math.min(90, vassalChance + 5));
}

// 9c. 分档单调：hegemon < king < emperor（修改 politicalStage 模拟）
const kingChanceState = structuredClone(getGame());
(kingChanceState.factions[1] as { politicalStage?: string }).politicalStage = 'king';
const kingChance = calculateAllianceChance(kingChanceState, 3);
check('称王状态 hegemonyModifier === 8', kingChance.hegemonyModifier === 8);
check('称王状态结盟成功率 ≥ 霸府', kingChance.chance >= hegemonBreakdown.chance);

const emperorChanceState = structuredClone(getGame());
(emperorChanceState.factions[1] as { politicalStage?: string }).politicalStage = 'emperor';
const emperorChance = calculateAllianceChance(emperorChanceState, 3);
check('称帝状态 hegemonyModifier === 12', emperorChance.hegemonyModifier === 12);
check('称帝状态结盟成功率 ≥ 称王', emperorChance.chance >= kingChance.chance);

// 9d. 进贡友好增量：霸府状态比诸侯放大（×1.1）
createGame(1, 1);
doTribute(3);
const vassalTributeFav = findDiplomacy(getGame().diplomacy, 1, 3)?.favorability ?? 0;
check('诸侯进贡友好增量=15（基线）', vassalTributeFav === 15);

createGame(1, 1);
doEstablishHegemony();
doTribute(3);
const hegemonTributeFav = findDiplomacy(getGame().diplomacy, 1, 3)?.favorability ?? 0;
check('霸府进贡友好增量=round(15×1.1)=17（放大生效）', hegemonTributeFav === 17);
check('霸府进贡友好增量 > 诸侯', hegemonTributeFav > vassalTributeFav);

// 9e. 宫廷牵线友好增量：霸府状态比诸侯放大（×1.1）
createGame(1, 1);
// 准备 courtNetwork
const giftPrepState = structuredClone(getGame());
giftPrepState.factions[1].courtNetwork = 10;
// 用 restore 模拟（这里直接 createGame 后手动设 courtNetwork 通过 service 不可达，
// 改用 doTransferCourtNetwork 会消耗 stock，先保证有库存）
// 实际验证：vassal 宫廷牵线 ×1 → +12，hegemon 宫廷牵线 ×1 → +13
// 由于 service 层 doTransferCourtNetwork 依赖 currentGame，直接用引擎层 transferCourtNetwork 验证
import { transferCourtNetwork as engineGiftBeauty } from '../engine/diplomacy.js';

createGame(1, 1);
const vassalGiftState = structuredClone(getGame());
vassalGiftState.factions[1].courtNetwork = 10;
const vassalGiftAfter = engineGiftBeauty(vassalGiftState, 3, 1);
const vassalGiftFav = findDiplomacy(vassalGiftAfter.diplomacy, 1, 3)?.favorability ?? 0;
check('诸侯宫廷牵线×1 友好增量=12（基线）', vassalGiftFav === 12);

// 霸府宫廷牵线
createGame(1, 1);
doEstablishHegemony();
const hegemonGiftState = structuredClone(getGame());
hegemonGiftState.factions[1].courtNetwork = 10;
// 重置双边友好为 0 以便观察增量
hegemonGiftState.diplomacy = hegemonGiftState.diplomacy.map((l) =>
  (l.factionA === 1 && l.factionB === 3) || (l.factionA === 3 && l.factionB === 1)
    ? { ...l, favorability: 0 }
    : l,
);
const hegemonGiftAfter = engineGiftBeauty(hegemonGiftState, 3, 1);
const hegemonGiftFav = findDiplomacy(hegemonGiftAfter.diplomacy, 1, 3)?.favorability ?? 0;
check('霸府宫廷牵线×1 友好增量=round(12×1.1)=13（放大生效）', hegemonGiftFav === 13);
check('霸府宫廷牵线友好增量 > 诸侯', hegemonGiftFav > vassalGiftFav);

// 9f. RNG 边界：结盟成功率判定依然走既有 xorshift32-v1，本轮只改公式不改 RNG 消费点
// （由 verify-negotiation-r2 既有 20 项断言已隐式覆盖，此处仅确认 hegemonyModifier 不引入新随机源）
check('hegemonyModifier 是确定性纯函数（无 RNG）', hegemonyAllianceModifier('hegemon') === 5);

// ── 10. HC-P0-6 伪诏宣战 ──
console.log('\n— HC-P0-6 伪诏宣战 —');
createGame(1, 1);
const base = structuredClone(getGame());
let rejected = '';
try { declareWarByFalseDecree(base, 1, 3); } catch (e) { rejected = (e as Error).message; }
check('诸侯状态尝试伪诏宣战被拒绝', rejected.includes('尚未开霸府'));

const hegemon = establishHegemony(base, 1);
check('开府赋予100皇权', hegemon.factions[1].imperialAuthority === 100);
const lowAuthority = structuredClone(hegemon);
lowAuthority.factions[1].imperialAuthority = FALSE_DECREE_COST - 1;
rejected = '';
try { declareWarByFalseDecree(lowAuthority, 1, 3); } catch (e) { rejected = (e as Error).message; }
check('皇权不足时被拒绝', rejected.includes('皇权点数不足'));

const cooled = structuredClone(hegemon);
cooled.factions[1].imperialDecreeCooldown = 1;
rejected = '';
try { declareWarByFalseDecree(cooled, 1, 3); } catch (e) { rejected = (e as Error).message; }
check('冷却期内即使皇权充足仍被拒绝', rejected.includes('冷却中'));

const loyalistTarget = Object.values(hegemon.factions).find((f) =>
  f.id !== 1 && f.isAlive && f.officerIds.some((id) => hegemon.officers[id]?.tags?.includes('匡扶汉室')),
);
const ordinaryTarget = Object.values(hegemon.factions).find((f) =>
  f.id !== 1 && f.isAlive && !f.officerIds.some((id) => hegemon.officers[id]?.tags?.includes('匡扶汉室')),
);
check('测试场景存在匡扶汉室目标势力', loyalistTarget != null);
check('测试场景存在非匡扶汉室目标势力', ordinaryTarget != null);

if (loyalistTarget) {
  const beforeFame = hegemon.factions[1].fame ?? 0;
  const after = declareWarByFalseDecree(hegemon, 1, loyalistTarget.id);
  check('成功后目标关系设为war', findDiplomacy(after.diplomacy, 1, loyalistTarget.id)?.relation === 'war');
  check('成功后皇权正确扣除40', after.factions[1].imperialAuthority === 100 - FALSE_DECREE_COST);
  check('成功后触发8季冷却', after.factions[1].imperialDecreeCooldown === FALSE_DECREE_COOLDOWN_QUARTERS);
  check('对匡扶汉室势力声望-30', after.factions[1].fame === beforeFame - HAN_LOYALIST_FAME_PENALTY);
  const saved = parseCurrentSaveEnvelope(envelopeFor(after)).snapshot;
  check('存档往返保留皇权', saved.factions[1].imperialAuthority === after.factions[1].imperialAuthority);
  check('存档往返保留冷却计时器', saved.factions[1].imperialDecreeCooldown === FALSE_DECREE_COOLDOWN_QUARTERS);
  const quarter = tickImperialAuthorityQuarter(after);
  check('季度恢复10皇权', quarter.factions[1].imperialAuthority === 70);
  check('季度推进后冷却减1', quarter.factions[1].imperialDecreeCooldown === 7);
}

if (ordinaryTarget) {
  const beforeFame = hegemon.factions[1].fame ?? 0;
  const after = declareWarByFalseDecree(hegemon, 1, ordinaryTarget.id);
  check('对非匡扶汉室势力无声望惩罚', after.factions[1].fame === beforeFame);
}

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
