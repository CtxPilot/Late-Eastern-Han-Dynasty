// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S16 浏览器命名槽位存储（离线可玩版 Session 372 Phase 1 · IndexedDB）。
 *
 * 与服务端 SQLite 介质（save-store.ts）行为对齐：
 * - 库名 `leh`，对象库 `save_slots`（keyPath `slot`），`updatedAt` 索引倒序列出；
 * - 槽位名与 2MB 体量上限共用 @leh/shared save-limits 单一真源；
 * - 每槽保存完整 SaveEnvelopeV1 JSON 文本；读档仍由上层走 parseCurrentSaveEnvelope 校验链。
 * 浏览器无文件系统语义，不做 legacy JSON 迁移；导出/导入沿用既有信封下载链路。
 */
import { assertSaveSize, assertSaveSlotName, envelopeByteLength } from '@leh/shared';

const DB_NAME = 'leh';
const DB_VERSION = 1;
const STORE = 'save_slots';

export interface IdbSaveSlotMeta {
  slot: string;
  updatedAt: string;
  scenarioId: number;
  sizeBytes: number;
}

interface IdbSlotRecord extends IdbSaveSlotMeta {
  envelopeJson: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openLehDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('当前环境不支持 IndexedDB（离线存档不可用）'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'slot' });
          store.createIndex('updatedAt', 'updatedAt');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'));
    });
  }
  return dbPromise;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openLehDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失败'));
  });
}

/** 列出全部槽位（按 updatedAt 倒序，与服务端 ORDER BY updated_at DESC 一致）。 */
export async function listIdbSaveSlots(): Promise<IdbSaveSlotMeta[]> {
  const records = await withStore('readonly', (store) => store.getAll() as IDBRequest<IdbSlotRecord[]>);
  return records
    .map(({ envelopeJson: _envelope, ...meta }) => meta)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.slot.localeCompare(b.slot)));
}

/** 写入完整信封；槽名/体量校验失败时抛错且不改状态。 */
export async function writeIdbSaveSlot(slot: string, envelope: unknown): Promise<IdbSaveSlotMeta> {
  assertSaveSlotName(slot);
  const envelopeJson = JSON.stringify(envelope);
  const sizeBytes = envelopeByteLength(envelopeJson);
  assertSaveSize(sizeBytes);
  const record: IdbSlotRecord = {
    slot,
    updatedAt: typeof (envelope as { updatedAt?: string }).updatedAt === 'string'
      ? (envelope as { updatedAt: string }).updatedAt
      : new Date().toISOString(),
    scenarioId: Number((envelope as { scenarioId?: number }).scenarioId ?? 0),
    sizeBytes,
    envelopeJson,
  };
  await withStore('readwrite', (store) => store.put(record));
  const { envelopeJson: _json, ...meta } = record;
  return meta;
}

/** 读取原始信封（未解析）；不存在或 JSON 损坏时抛错。 */
export async function readIdbSaveSlot(slot: string): Promise<unknown> {
  assertSaveSlotName(slot);
  const record = await withStore('readonly', (store) => store.get(slot) as IDBRequest<IdbSlotRecord | undefined>);
  if (!record) throw new Error(`槽位 ${slot} 不存在`);
  try {
    return JSON.parse(record.envelopeJson);
  } catch {
    throw new Error(`槽位 ${slot} 的存档不是有效 JSON`);
  }
}
