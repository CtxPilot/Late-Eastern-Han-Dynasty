// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Print 0-A city Google Maps links vs equirectangular map pixels.
 * Run: pnpm --filter @leh/server verify-geo-google
 */
import { GAME_SEAT_GEO, getGameSeatPixel, lonLatToPixel } from '@leh/shared';

const seats = Object.entries(GAME_SEAT_GEO);

console.log('adminName | lon,lat (Google WGS84) | equirect pixel | Google Maps');
console.log('-'.repeat(90));

for (const [admin, geo] of seats) {
  const pixel = getGameSeatPixel(admin);
  const projected = lonLatToPixel(geo.lon, geo.lat);
  const url = `https://www.google.com/maps?q=${geo.lat},${geo.lon}`;
  console.log(
    `${admin.padEnd(8)} | ${geo.lon.toFixed(4)},${geo.lat.toFixed(4)} | ` +
      `${pixel?.x},${pixel?.y} (proj ${projected.x},${projected.y}) | ${url}`,
  );
}
