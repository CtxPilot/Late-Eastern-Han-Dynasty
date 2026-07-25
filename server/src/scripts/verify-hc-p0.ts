// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * HC-P0-1 + HC-P0-2 + HC-P0-3 确定性验证（docs/26 霸府/称王/称帝主线地基+开府）。
 *
 * 覆盖：
 * 1. 两个剧本开局 emperorLocation 指向洛阳(id=1) + 所有势力 politicalStage='vassal'
 * 2. controlsEmperor 在城池易主前后正确响应（emperorLocation 不变，判定随城池归属动态变）
 * 3. 存档信封往返一致性（emperorLocation + politicalStage 序列化/反序列化保留）
 * 4. 旧存档降级（无 emperorLocation + 无 politicalStage → parse 通过，字段 undefined 不报错）
 * 5. GameStateSchema.strict() 接受新字段（ROOT_KEYS 已加 emperorLocation）
 * 6. HC-P0-3 开霸府操作：前置校验（未控制汉帝/已开府/已是王帝拒绝）+ 状态转移 + actionLog + 存档往返
 *
 * Run: pnpm verify-hc-p0
 */
import {
  CURRENT_SAVE_SCHEMA_VERSION,
  GameStateSchema,
  parseCurrentSaveEnvelope,
  controlsEmperor,
  type GameState,
  type SaveEnvelopeV1,
} from '@leh/shared';
import { createGame, getGame, doEstablishHegemony } from '../services/game.js';
import { establishHegemony } from '../engine/hegemony.js';
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

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);