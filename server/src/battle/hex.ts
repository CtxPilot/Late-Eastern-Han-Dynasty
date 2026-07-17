// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { HexCoord } from '@leh/shared';

export function hexKey(h: HexCoord): string {
  return `${h.q},${h.r}`;
}

export function neighbors(h: HexCoord): HexCoord[] {
  const dirs: HexCoord[] = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];
  return dirs.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  return (
    (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2
  );
}

export function hexToPixel(h: HexCoord, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * h.q + (Math.sqrt(3) / 2) * h.r);
  const y = size * ((3 / 2) * h.r);
  return { x, y };
}

export function hexCorners(size: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(size * Math.cos(angle), size * Math.sin(angle));
  }
  return pts;
}
