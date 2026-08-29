// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 存档槽位与信封体量的单一真源（离线可玩版 Session 372 Phase 1）。
 *
 * 服务端 SQLite（save-store.ts）与浏览器 IndexedDB（client/services/save-idb.ts）
 * 共用同一套校验，避免“能存入浏览器却超服务端限”的漂移；改变数值时先改本文件，
 * 再同步 docs/06-api-design.md 与实现。
 */

/** 槽位名规则：1~32 位字母数字/下划线/连字符，首字符为字母或数字。 */
export const SAVE_SLOT_PATTERN_SOURCE = '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$';

const SAVE_SLOT_PATTERN = new RegExp(SAVE_SLOT_PATTERN_SOURCE);

/**
 * P2-2（Session 414）后 2MB 预算实测：officers 静态回声剥离后，单武将挥发态约 300~400B；
 * 1000 武将 + 105 城 + 战场实例的投影信封 ≈ 680KB（verify-s414-save-slim 断言），预算充足。
 * 若未来字段回涨，先查 officers 是否重新序列化静态回声。
 */
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;

export function isValidSaveSlotName(slot: string): boolean {
  return typeof slot === 'string' && SAVE_SLOT_PATTERN.test(slot);
}

export function assertSaveSlotName(slot: string): void {
  if (!isValidSaveSlotName(slot)) {
    throw new Error('存档槽位名需为 1~32 位字母数字、下划线或连字符');
  }
}

/** UTF-8 编码下的 JSON 信封字节数（与服务端 Buffer.byteLength 对齐；不依赖 DOM/Node 全局）。 */
export function envelopeByteLength(envelopeJson: string): number {
  let bytes = 0;
  for (const char of envelopeJson) {
    const codePoint = char.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export function assertSaveSize(bytes: number): void {
  if (bytes > MAX_SAVE_BYTES) {
    throw new Error(`存档超过 ${Math.floor(MAX_SAVE_BYTES / 1024 / 1024)}MB 上限`);
  }
}
