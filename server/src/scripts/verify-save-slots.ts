// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { existsSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';
import * as gameService from '../services/game.js';
import { closeSaveStore, saveDatabasePath } from '../services/save-store.js';

const tempHome = mkdtempSync(join(tmpdir(), 'leh-save-slots-'));
process.env.XDG_DATA_HOME = tempHome;
closeSaveStore();

const app = createApp({
  host: '127.0.0.1',
  apiToken: null,
  allowedOrigins: new Set(),
  rateLimitPerMinute: 100,
});

async function request(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server address unavailable');
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  const body = await response.json();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return { status: response.status, body };
}

let passed = 0;
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  passed += 1;
}

gameService.createGame(1, 2);
const before = gameService.exportSaveEnvelope();
const saved = await request('/api/game/save/slots/demo', { method: 'POST', body: '{}' });
assert(saved.status === 200 && saved.body.slot === 'demo', 'slot save failed');

const dbPath = saveDatabasePath();
assert(existsSync(dbPath), 'SQLite database was not created under XDG data home');
assert(!existsSync(join(tempHome, 'leh', 'saves', 'demo.json')), 'legacy JSON slot file must not be written');

gameService.endTurn();
const loaded = await request('/api/game/save/slots/demo/load', { method: 'POST', body: '{}' });
assert(
  loaded.status === 200 && loaded.body.currentMonth === before.snapshot.currentMonth,
  'slot load did not restore the snapshot',
);

const listed = await request('/api/game/save/slots');
assert(
  listed.status === 200 && listed.body.slots.length === 1 && listed.body.slots[0].slot === 'demo',
  'slot list failed',
);

const invalid = await request('/api/game/save/slots/bad.slot', { method: 'POST', body: '{}' });
assert(invalid.status === 400, 'invalid slot name was not rejected');

// 遗留 JSON → SQLite 一次性迁移
closeSaveStore();
const legacyHome = mkdtempSync(join(tmpdir(), 'leh-save-migrate-'));
process.env.XDG_DATA_HOME = legacyHome;
const legacyDir = join(legacyHome, 'leh', 'saves');
mkdirSync(legacyDir, { recursive: true, mode: 0o700 });
const legacyEnvelope = {
  ...before,
  updatedAt: '2026-08-16T00:00:00.000Z',
  scenarioId: before.scenarioId,
};
writeFileSync(join(legacyDir, 'legacy.json'), JSON.stringify(legacyEnvelope), { encoding: 'utf8', mode: 0o600 });

const migratedList = gameService.listDiskSaveSlots();
assert(
  migratedList.length === 1 && migratedList[0]?.slot === 'legacy',
  'legacy JSON slot was not imported into SQLite',
);
assert(existsSync(join(legacyDir, 'legacy.json.migrated')), 'legacy JSON was not renamed after migration');
assert(!existsSync(join(legacyDir, 'legacy.json')), 'legacy JSON must not remain after migration');

const migrated = gameService.loadGameFromDisk('legacy');
assert(migrated.currentMonth === before.snapshot.currentMonth, 'migrated slot load failed');

closeSaveStore();
rmSync(tempHome, { recursive: true, force: true });
rmSync(legacyHome, { recursive: true, force: true });
console.log(`verify-save-slots: ${passed}/10 passed`);
