// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * HC-P0-1 + HC-P0-2 确定性验证（docs/26 霸府/称王/称帝主线地基）。
 *
 * 覆盖：
 * 1. 两个剧本开局 emperorLocation 指向洛阳(id=1) + 所有势力 politicalStage='vassal'
 * 2. controlsEmperor 在城池易主前后正确响应（emperorLocation 不变，判定随城池归属动态变）
 * 3. 存档信封往返一致性（emperorLocation + politicalStage 序列化/反序列化保留）
 * 4. 旧存档降级（无 emperorLocation + 无 politicalStage → parse 通过，字段 undefined 不报错）
 * 5. GameStateSchema.strict() 接受新字段（ROOT_KEYS 已加 emperorLocation）
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
import { createGame, getGame } from '../services/game.js';
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

console.log(`\n=== 结果: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);