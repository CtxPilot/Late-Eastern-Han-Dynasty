// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S16 服务端命名槽位存储（Session 340 · SQLite）。
 *
 * 介质：`$XDG_DATA_HOME/leh/saves.db`（未设置时为 `~/.local/share/leh/saves.db`）。
 * 每槽保存完整 `SaveEnvelopeV1` JSON 文本；读档仍走迁移/Schema/RNG 校验链。
 * 旧版 `leh/saves/*.json` 在首次打开库时一次性迁入，原文件改名为 `*.json.migrated`。
 * 多用户/云同步仍后置。
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
// 离线可玩版（Session 372 Phase 1）：槽位规则与体量上限收敛到 @leh/shared 单一真源。
import { MAX_SAVE_BYTES, isValidSaveSlotName } from '@leh/shared';
import type { SaveEnvelopeV1 } from '@leh/shared';

const SAVE_DIR_NAME = 'leh';
const LEGACY_JSON_DIR = 'saves';
const DB_FILE_NAME = 'saves.db';

export interface SaveSlotMeta {
  slot: string;
  updatedAt: string;
  scenarioId: number;
  sizeBytes: number;
}

interface SlotRow {
  slot: string;
  updated_at: string;
  scenario_id: number;
  envelope: string;
  size_bytes: number;
}

let openedPath: string | null = null;
let db: Database.Database | null = null;

function dataHome(): string {
  return process.env.XDG_DATA_HOME?.trim() || join(homedir(), '.local', 'share');
}

function saveRoot(): string {
  return join(dataHome(), SAVE_DIR_NAME);
}

function databasePath(): string {
  return join(saveRoot(), DB_FILE_NAME);
}

function legacyJsonDirectory(): string {
  return join(saveRoot(), LEGACY_JSON_DIR);
}

function assertSlot(slot: string): string {
  if (!isValidSaveSlotName(slot)) {
    throw new Error('存档槽位名须为 1~32 位字母、数字、下划线或短横线');
  }
  return slot;
}

function openDatabase(): Database.Database {
  const path = databasePath();
  if (db && openedPath === path) return db;
  if (db) {
    db.close();
    db = null;
    openedPath = null;
  }

  mkdirSync(saveRoot(), { recursive: true, mode: 0o700 });
  const next = new Database(path);
  next.pragma('journal_mode = WAL');
  next.pragma('synchronous = NORMAL');
  next.pragma('foreign_keys = ON');
  next.exec(`
    CREATE TABLE IF NOT EXISTS save_slots (
      slot TEXT PRIMARY KEY NOT NULL,
      updated_at TEXT NOT NULL,
      scenario_id INTEGER NOT NULL,
      envelope TEXT NOT NULL,
      size_bytes INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  db = next;
  openedPath = path;
  migrateLegacyJsonSlots(next);
  return next;
}

function migrateLegacyJsonSlots(database: Database.Database): void {
  const already = database.prepare(`SELECT value FROM meta WHERE key = ?`).get('json_migrated_v1') as
    | { value: string }
    | undefined;
  if (already?.value === '1') return;

  const directory = legacyJsonDirectory();
  if (existsSync(directory)) {
    const insert = database.prepare(`
      INSERT INTO save_slots (slot, updated_at, scenario_id, envelope, size_bytes)
      VALUES (@slot, @updated_at, @scenario_id, @envelope, @size_bytes)
      ON CONFLICT(slot) DO NOTHING
    `);
    const files = readdirSync(directory).filter((name) => name.endsWith('.json'));
    const migrateOne = database.transaction((names: string[]) => {
      for (const name of names) {
        const slot = name.slice(0, -5);
        if (!isValidSaveSlotName(slot)) continue;
        const path = join(directory, name);
        const stat = statSync(path);
        if (stat.size > MAX_SAVE_BYTES) {
          throw new Error(`遗留存档槽位 ${slot} 超过 2MB 限制，无法迁移`);
        }
        let parsed: { updatedAt?: unknown; scenarioId?: unknown };
        let raw: string;
        try {
          raw = readFileSync(path, 'utf8');
          parsed = JSON.parse(raw) as { updatedAt?: unknown; scenarioId?: unknown };
        } catch {
          throw new Error(`遗留存档槽位 ${slot} 不是有效 JSON`);
        }
        if (typeof parsed.updatedAt !== 'string' || typeof parsed.scenarioId !== 'number') {
          throw new Error(`遗留存档槽位 ${slot} 元数据无效`);
        }
        insert.run({
          slot,
          updated_at: parsed.updatedAt,
          scenario_id: parsed.scenarioId,
          envelope: raw,
          size_bytes: Buffer.byteLength(raw, 'utf8'),
        });
        renameSync(path, `${path}.migrated`);
      }
      database.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`).run('json_migrated_v1', '1');
    });
    migrateOne(files);
  } else {
    database.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`).run('json_migrated_v1', '1');
  }
}

export function listSaveSlots(): SaveSlotMeta[] {
  const database = openDatabase();
  const rows = database
    .prepare(
      `SELECT slot, updated_at, scenario_id, size_bytes
       FROM save_slots
       ORDER BY updated_at DESC`,
    )
    .all() as Array<Pick<SlotRow, 'slot' | 'updated_at' | 'scenario_id' | 'size_bytes'>>;
  return rows.map((row) => ({
    slot: row.slot,
    updatedAt: row.updated_at,
    scenarioId: row.scenario_id,
    sizeBytes: row.size_bytes,
  }));
}

export function writeSaveSlot(slot: string, envelope: SaveEnvelopeV1): SaveSlotMeta {
  const name = assertSlot(slot);
  const serialized = JSON.stringify(envelope);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');
  if (sizeBytes > MAX_SAVE_BYTES) throw new Error('存档超过 2MB 限制');

  const database = openDatabase();
  database
    .prepare(
      `INSERT INTO save_slots (slot, updated_at, scenario_id, envelope, size_bytes)
       VALUES (@slot, @updated_at, @scenario_id, @envelope, @size_bytes)
       ON CONFLICT(slot) DO UPDATE SET
         updated_at = excluded.updated_at,
         scenario_id = excluded.scenario_id,
         envelope = excluded.envelope,
         size_bytes = excluded.size_bytes`,
    )
    .run({
      slot: name,
      updated_at: envelope.updatedAt,
      scenario_id: envelope.scenarioId,
      envelope: serialized,
      size_bytes: sizeBytes,
    });

  return { slot: name, updatedAt: envelope.updatedAt, scenarioId: envelope.scenarioId, sizeBytes };
}

export function readSaveSlot(slot: string): unknown {
  const name = assertSlot(slot);
  const database = openDatabase();
  const row = database.prepare(`SELECT envelope, size_bytes FROM save_slots WHERE slot = ?`).get(name) as
    | Pick<SlotRow, 'envelope' | 'size_bytes'>
    | undefined;
  if (!row) throw new Error(`存档槽位不存在: ${name}`);
  if (row.size_bytes > MAX_SAVE_BYTES) throw new Error('存档超过 2MB 限制');
  try {
    return JSON.parse(row.envelope) as unknown;
  } catch {
    throw new Error(`存档槽位 ${name} 不是有效 JSON`);
  }
}

/** 测试/热重载用：关闭当前库句柄，下次读写按当前 XDG 路径重开。 */
export function closeSaveStore(): void {
  if (db) {
    db.close();
    db = null;
    openedPath = null;
  }
}

/** 暴露当前库路径，供验证脚本断言介质已切换为 SQLite。 */
export function saveDatabasePath(): string {
  return databasePath();
}
