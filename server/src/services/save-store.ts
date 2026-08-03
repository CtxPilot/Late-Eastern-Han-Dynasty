// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { SaveEnvelopeV1 } from '@leh/shared';

const SAVE_DIR_NAME = 'leh/saves';
const SLOT_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,31}$/;
const MAX_SAVE_BYTES = 2 * 1024 * 1024;

export interface SaveSlotMeta {
  slot: string;
  updatedAt: string;
  scenarioId: number;
  sizeBytes: number;
}

function saveDirectory(): string {
  const dataHome = process.env.XDG_DATA_HOME?.trim() || join(homedir(), '.local', 'share');
  return join(dataHome, SAVE_DIR_NAME);
}

function assertSlot(slot: string): string {
  if (!SLOT_PATTERN.test(slot)) {
    throw new Error('存档槽位名须为 1~32 位字母、数字、下划线或短横线');
  }
  return slot;
}

function slotPath(slot: string): string {
  return join(saveDirectory(), `${assertSlot(slot)}.json`);
}

export function listSaveSlots(): SaveSlotMeta[] {
  const directory = saveDirectory();
  if (!existsSync(directory)) return [];
  // The directory is application-owned and slot names are validated before use.
  return readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -5))
    .filter((slot) => SLOT_PATTERN.test(slot))
    .map((slot) => {
      const path = slotPath(slot);
      const stat = statSync(path);
      const envelope = JSON.parse(readFileSync(path, 'utf8')) as { updatedAt?: unknown; scenarioId?: unknown };
      if (typeof envelope.updatedAt !== 'string' || typeof envelope.scenarioId !== 'number') {
        throw new Error(`存档槽位 ${slot} 元数据无效`);
      }
      return { slot, updatedAt: envelope.updatedAt, scenarioId: envelope.scenarioId, sizeBytes: stat.size };
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function writeSaveSlot(slot: string, envelope: SaveEnvelopeV1): SaveSlotMeta {
  const path = slotPath(slot);
  const directory = saveDirectory();
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const serialized = JSON.stringify(envelope);
  const sizeBytes = Buffer.byteLength(serialized, 'utf8');
  if (sizeBytes > MAX_SAVE_BYTES) throw new Error('存档超过 2MB 限制');
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporary, serialized, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporary, path);
  return { slot: assertSlot(slot), updatedAt: envelope.updatedAt, scenarioId: envelope.scenarioId, sizeBytes };
}

export function readSaveSlot(slot: string): unknown {
  const path = slotPath(slot);
  if (!existsSync(path)) throw new Error(`存档槽位不存在: ${slot}`);
  const stat = statSync(path);
  if (stat.size > MAX_SAVE_BYTES) throw new Error('存档超过 2MB 限制');
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    throw new Error(`存档槽位 ${slot} 不是有效 JSON`);
  }
}
