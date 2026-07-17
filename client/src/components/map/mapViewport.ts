// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { MAP_GEO } from '@leh/shared';

const MAP_W = MAP_GEO.width;
const MAP_H = MAP_GEO.height;

/**
 * Cover scale: map image always fills the viewport (no black bars).
 * minScale = max(vw/MAP_W, vh/MAP_H)
 */
export function coverScale(viewW: number, viewH: number): number {
  if (viewW <= 0 || viewH <= 0) return 0.2;
  return Math.max(viewW / MAP_W, viewH / MAP_H);
}

/** Max zoom relative to cover (≈ 1:1 map pixels at 8K on large monitors may be less). */
export function maxScale(viewW: number, viewH: number): number {
  const min = coverScale(viewW, viewH);
  // allow up to ~6× cover, or absolute 1.2 for sharp basemap
  return Math.max(min * 6, Math.min(1.2, min * 8));
}

/**
 * Clamp stage position so the map always covers the viewport (no empty edges).
 * Stage uses: screen = world * scale + pos
 */
export function clampPos(
  scale: number,
  pos: { x: number; y: number },
  viewW: number,
  viewH: number,
): { x: number; y: number } {
  const mapScreenW = MAP_W * scale;
  const mapScreenH = MAP_H * scale;

  let x = pos.x;
  let y = pos.y;

  if (mapScreenW <= viewW) {
    x = (viewW - mapScreenW) / 2;
  } else {
    // map larger than view: x in [viewW - mapScreenW, 0]
    x = Math.min(0, Math.max(viewW - mapScreenW, x));
  }

  if (mapScreenH <= viewH) {
    y = (viewH - mapScreenH) / 2;
  } else {
    y = Math.min(0, Math.max(viewH - mapScreenH, y));
  }

  return { x, y };
}

/** Center map in cover mode (default full-screen view). */
export function coverCenter(viewW: number, viewH: number): {
  scale: number;
  pos: { x: number; y: number };
} {
  const scale = coverScale(viewW, viewH);
  // center the overflow crop so map covers viewport
  const mapScreenW = MAP_W * scale;
  const mapScreenH = MAP_H * scale;
  return {
    scale,
    pos: {
      x: (viewW - mapScreenW) / 2,
      y: (viewH - mapScreenH) / 2,
    },
  };
}

export { MAP_W, MAP_H };
