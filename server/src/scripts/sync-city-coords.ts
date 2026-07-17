// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Sync cities.json x/y from Google Maps lon/lat via equirectangular projection.
 * Run: pnpm --filter @leh/server sync-city-coords
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGameSeatPixel } from '@leh/shared';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '../data');
const path = join(dataDir, 'cities.json');

type CityRow = { name: string; adminName: string; x: number; y: number };

const cities = JSON.parse(readFileSync(path, 'utf-8')) as CityRow[];
let updated = 0;

for (const city of cities) {
  const pixel = getGameSeatPixel(city.adminName);
  if (!pixel) {
    console.error(`No GAME_SEAT_GEO for adminName=${city.adminName} (${city.name})`);
    process.exit(1);
  }
  if (city.x !== pixel.x || city.y !== pixel.y) {
    console.log(`${city.name}: (${city.x},${city.y}) → (${pixel.x},${pixel.y})`);
    city.x = pixel.x;
    city.y = pixel.y;
    updated += 1;
  }
}

writeFileSync(path, JSON.stringify(cities, null, 2) + '\n', 'utf-8');
console.log(`\nDone: ${updated}/${cities.length} cities updated (equirectangular).`);
