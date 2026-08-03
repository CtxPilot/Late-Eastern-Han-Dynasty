// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';
import * as gameService from '../services/game.js';

const tempHome = mkdtempSync(join(tmpdir(), 'leh-save-slots-'));
process.env.XDG_DATA_HOME = tempHome;

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
  const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await response.json();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return { status: response.status, body };
}

gameService.createGame(1, 2);
const before = gameService.exportSaveEnvelope();
const saved = await request('/api/game/save/slots/demo', { method: 'POST', body: '{}' });
if (saved.status !== 200 || saved.body.slot !== 'demo') throw new Error('slot save failed');
const path = join(tempHome, 'leh', 'saves', 'demo.json');
if (!existsSync(path) || JSON.parse(readFileSync(path, 'utf8')).snapshot.currentMonth !== before.snapshot.currentMonth) {
  throw new Error('slot file was not written atomically with the current snapshot');
}

gameService.endTurn();
const loaded = await request('/api/game/save/slots/demo/load', { method: 'POST', body: '{}' });
if (loaded.status !== 200 || loaded.body.currentMonth !== before.snapshot.currentMonth) throw new Error('slot load did not restore the snapshot');

const listed = await request('/api/game/save/slots');
if (listed.status !== 200 || listed.body.slots.length !== 1 || listed.body.slots[0].slot !== 'demo') throw new Error('slot list failed');

const invalid = await request('/api/game/save/slots/bad.slot', { method: 'POST', body: '{}' });
if (invalid.status !== 400) throw new Error('invalid slot name was not rejected');

rmSync(tempHome, { recursive: true, force: true });
console.log('verify-save-slots: 4/4 passed');
