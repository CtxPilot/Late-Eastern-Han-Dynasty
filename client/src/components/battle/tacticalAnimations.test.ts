// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  fireFlicker,
  marchDashOffset,
  shockwave,
  waterRipple,
} from './tacticalAnimations';

describe('P5-08 Canvas 战术动画几何计算引擎 (tacticalAnimations.ts)', () => {
  it('行军虚线偏移随时间单调流动且周期循环', () => {
    const t0 = marchDashOffset(0);
    const t1 = marchDashOffset(200);
    const t2 = marchDashOffset(400);

    expect(t0).toBe(-0);
    expect(t1).toBeLessThan(0);
    expect(t2).toBeLessThan(t1);
    // 周期约束
    expect(Math.abs(marchDashOffset(24 / 0.03))).toBeCloseTo(0, 1);
  });

  it('水纹扩散半径单调递增，透明度由实到虚', () => {
    const r0 = waterRipple(0, 30, 1000);
    const rMid = waterRipple(500, 30, 1000);
    const rEnd = waterRipple(990, 30, 1000);

    expect(r0.radius).toBe(2);
    expect(r0.opacity).toBe(0.75);

    expect(rMid.radius).toBeCloseTo(15, 0);
    expect(rMid.opacity).toBeLessThan(r0.opacity);

    expect(rEnd.radius).toBeCloseTo(30, 0);
    expect(rEnd.opacity).toBeLessThan(0.1);
  });

  it('火光微颤振幅与透明度严格维持在可控常模范围内', () => {
    for (let t = 0; t <= 1000; t += 100) {
      const f = fireFlicker(t, 1);
      expect(f.scale).toBeGreaterThanOrEqual(0.7);
      expect(f.scale).toBeLessThanOrEqual(1.3);
      expect(f.opacity).toBeGreaterThanOrEqual(0.4);
      expect(f.opacity).toBeLessThanOrEqual(1.0);
      expect(f.offsetY).toBeLessThanOrEqual(0);
    }
  });

  it('伏兵/落石震波半径自中心扩散，线条由粗变细', () => {
    const s0 = shockwave(0, 1000, 40);
    const sMid = shockwave(500, 1000, 40);
    const sEnd = shockwave(990, 1000, 40);

    expect(s0.radius).toBe(4);
    expect(s0.opacity).toBe(1);
    expect(s0.strokeWidth).toBe(3);

    expect(sMid.radius).toBeCloseTo(20, 0);
    expect(sMid.strokeWidth).toBeLessThan(3);

    expect(sEnd.radius).toBeCloseTo(40, 0);
    expect(sEnd.opacity).toBeLessThan(0.05);
  });
});
