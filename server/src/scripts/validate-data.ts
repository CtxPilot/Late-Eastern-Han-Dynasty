// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGameSeatPixel, validators } from '@leh/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '../data');

const files: { key: validators.DataFileKey; file: string; expected: number }[] = [
  { key: 'officers', file: 'officers.json', expected: 30 },
  { key: 'cities', file: 'cities.json', expected: 30 },
  { key: 'formations', file: 'formations.json', expected: 6 },
  { key: 'units', file: 'units.json', expected: 9 },
  { key: 'items', file: 'items.json', expected: 20 },
  { key: 'females', file: 'females.json', expected: 10 },
  { key: 'children', file: 'children.json', expected: 5 },
  { key: 'skills', file: 'skills.json', expected: 30 },
  { key: 'scenarios', file: 'scenarios.json', expected: 1 },
  { key: 'events', file: 'events.json', expected: 5 },
];

let failed = 0;

for (const { key, file, expected } of files) {
  const raw = JSON.parse(readFileSync(join(dataDir, file), 'utf-8')) as unknown;
  const result = validators.validateDataFile(key, raw);
  if (!result.success) {
    failed += 1;
    console.error(`FAIL ${file}:`, result.error.issues.slice(0, 8));
    continue;
  }
  const count = Array.isArray(result.data) ? result.data.length : 0;
  if (count !== expected) {
    failed += 1;
    console.error(`FAIL ${file}: expected ${expected} items, got ${count}`);
    continue;
  }
  console.log(`OK   ${file} (${count})`);
}

// provinces coverage for cities
const cities = JSON.parse(readFileSync(join(dataDir, 'cities.json'), 'utf-8')) as {
  name: string;
  adminName: string;
  province: string;
  x: number;
  y: number;
}[];
const provinces = new Set(cities.map((c) => c.province));
const required = [
  '司隶',
  '豫州',
  '冀州',
  '兖州',
  '徐州',
  '青州',
  '荆州',
  '扬州',
  '益州',
  '凉州',
  '并州',
  '幽州',
  '交州',
];
const missing = required.filter((p) => !provinces.has(p));
if (missing.length) {
  failed += 1;
  console.error('FAIL cities province coverage missing:', missing);
} else {
  console.log('OK   cities cover all 13 provinces');
}

// cities.json x/y must match GAME_SEAT_LON_LAT projection
let projOk = true;
for (const city of cities) {
  const expected = getGameSeatPixel(city.adminName);
  if (!expected) {
    failed += 1;
    projOk = false;
    console.error(`FAIL cities geo: no seat lon/lat for ${city.name} (${city.adminName})`);
    continue;
  }
  if (city.x !== expected.x || city.y !== expected.y) {
    failed += 1;
    projOk = false;
    console.error(
      `FAIL cities geo: ${city.name} x/y (${city.x},${city.y}) != projected (${expected.x},${expected.y})`,
    );
  }
}
if (projOk) {
  console.log('OK   cities x/y match historical seat projection');
}

// key geographic ordering (史实)
type CityCoord = { name: string; x: number; y: number };
const byName = Object.fromEntries(cities.map((c) => [c.name, c])) as Record<string, CityCoord>;
const geoChecks: [string, string, 'x' | 'y', '<' | '>'][] = [
  ['长安', '洛阳', 'x', '<'],
  ['成都', '长安', 'x', '<'],
  ['冀县', '长安', 'x', '<'],
  ['姑臧', '冀县', 'x', '<'],
  ['汉中', '成都', 'y', '<'],
  ['江陵', '襄阳', 'y', '>'],
  ['寿春', '襄阳', 'x', '>'],
  ['建业', '寿春', 'x', '>'],
  ['晋阳', '邺', 'x', '<'],
  ['龙编', '番禺', 'x', '<'],
  ['襄平', '蓟', 'x', '>'],
];
let orderOk = true;
for (const [a, b, axis, op] of geoChecks) {
  const ca = byName[a];
  const cb = byName[b];
  if (!ca || !cb) {
    failed += 1;
    orderOk = false;
    console.error(`FAIL geo order: missing ${a} or ${b}`);
    continue;
  }
  const av = ca[axis];
  const bv = cb[axis];
  const ok = op === '<' ? av < bv : av > bv;
  if (!ok) {
    failed += 1;
    orderOk = false;
    console.error(`FAIL geo order: ${a}.${axis}=${av} should be ${op} ${b}.${axis}=${bv}`);
  }
}
if (orderOk) {
  console.log('OK   cities geographic ordering (史实)');
}

console.log(`\nListed data files: ${readdirSync(dataDir).filter((f) => f.endsWith('.json')).join(', ')}`);
if (failed > 0) {
  console.error(`\n${failed} validation failure(s)`);
  process.exit(1);
}
console.log('\nAll data validation passed.');
