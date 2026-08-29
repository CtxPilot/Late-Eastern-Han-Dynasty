// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P2-2（Session 414）存档瘦身验证：
 *   ① officers 静态回声剥离后体积降幅 ≥40%（biography/hidden/unitProficiency 等）；
 *   ② 保存→读档往返：adopt 后 officers 与保存前逐字段一致（回注正确，深比较）；
 *   ③ 旧档兼容：手工补回静态回声的「旧格式」信封可正常读入（幂等）；
 *   ④ 0-B 外推：1000 武将投影信封 < 2MB 上限（save-limits MAX_SAVE_BYTES）。
 * 全程走真实 services（createGame/exportSaveEnvelope/adoptSaveEnvelope）与完整 Schema 校验链。
 */
import { createGame, endTurn, exportSaveEnvelope, getGame } from '../services/game.js';
import { adoptSaveEnvelope } from '../engine/state-pipeline.js';
import { STATIC_ECHO_OFFICER_KEYS, MAX_SAVE_BYTES } from '@leh/shared';

let pass = 0;
let fail = 0;
const check = (cond: boolean, label: string) => {
  if (cond) { pass += 1; console.log(`  ✓ ${label}`); }
  else { fail += 1; console.error(`  ✗ ${label}`); }
};
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v) ?? 'null');
const sorted = (v: unknown): string => JSON.stringify(sortValue(v));
function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, val]) => [k, sortValue(val)]),
    );
  }
  return v;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return sorted(a) === sorted(b);
}

// 推进 3 个月再测（覆盖月结后的真实运行时形态）
createGame(1, 2);
endTurn(); endTurn(); endTurn();
const beforeOfficers = JSON.parse(JSON.stringify(getGame().officers));
const envelope = exportSaveEnvelope();
const json = JSON.stringify(envelope);

// ① 瘦身比
{
  const slimOfficersBytes = bytes(envelope.snapshot.officers);
  const legacy = JSON.parse(JSON.stringify(envelope));
  legacy.snapshot.officers = JSON.parse(JSON.stringify(beforeOfficers));
  const legacyOfficersBytes = bytes(legacy.snapshot.officers);
  const ratio = slimOfficersBytes / legacyOfficersBytes;
  check(ratio <= 0.6, `officers 段剥离后 ≤60%（${slimOfficersBytes}/${legacyOfficersBytes} = ${(ratio * 100).toFixed(1)}%）`);
  const firstOfficerId = Object.keys(envelope.snapshot.officers)[0];
  const slimKeys = Object.keys((envelope.snapshot.officers as unknown as Record<string, Record<string, unknown>>)[Number(firstOfficerId)] ?? {});
  check(STATIC_ECHO_OFFICER_KEYS.every((k) => !slimKeys.includes(k)), '静态回声键已全部剥离');
}

// ② 往返一致（完整 Schema 校验在 adopt 内执行）
{
  const adopted = adoptSaveEnvelope(JSON.parse(json));
  check(deepEqual(adopted.snapshot.officers, beforeOfficers), 'adopt 后 officers 与保存前逐字段一致（静态回注正确）');
  check(adopted.snapshot.currentYear === getGame().currentYear && adopted.snapshot.currentMonth === getGame().currentMonth, '年月一致');
}

// ③ 旧档兼容（旧格式：回声键还在的信封）
{
  const legacy = JSON.parse(json);
  legacy.snapshot.officers = JSON.parse(JSON.stringify(beforeOfficers));
  const adoptedLegacy = adoptSaveEnvelope(legacy);
  check(deepEqual(adoptedLegacy.snapshot.officers, beforeOfficers), '旧格式信封可读入且幂等');
}

// ④ 0-B 外推：1000 武将投影
{
  const perOfficerSlim = bytes(envelope.snapshot.officers) / Object.keys(envelope.snapshot.officers).length;
  const nonOfficers = bytes(envelope.snapshot) - bytes(envelope.snapshot.officers);
  // 0-B：cities 105（约 3.5 倍）、其余按常数，武将 1000
  const projected = perOfficerSlim * 1000 + nonOfficers + (bytes(envelope.snapshot.cities) * 2.5);
  check(projected < MAX_SAVE_BYTES, `1000 武将投影信封 ${(projected / 1024).toFixed(0)}KB < 2MB 上限`);
  // 回归：再推 3 个月并做一次存/读循环（确保运行中路径不受剥离影响）
  endTurn(); endTurn(); endTurn();
  const midOfficers = JSON.parse(JSON.stringify(getGame().officers));
  const adopted = adoptSaveEnvelope(JSON.parse(JSON.stringify(exportSaveEnvelope())));
  check(deepEqual(adopted.snapshot.officers, midOfficers), '运行中（6 月）存/读循环一致');
}

console.log(`Session 414 save slim: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
