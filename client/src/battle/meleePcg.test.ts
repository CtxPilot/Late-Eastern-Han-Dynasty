// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import {
  getGlobalFrame,
  stepGlobalFrame,
  setGlobalFrame,
  resetGlobalFrame,
  subscribeFrame,
  renderMeleeParallaxBackground,
  drawLevel3StrategemOverlays,
} from './index';

describe('Battle PCG & Frame Modules - S20-W3 / S21-W8', () => {
  describe('frameCount', () => {
    it('manages global frame counter and subscriber notifications', () => {
      resetGlobalFrame();
      expect(getGlobalFrame()).toBe(0);

      let heard = 0;
      const unsubscribe = subscribeFrame((f) => {
        heard = f;
      });

      stepGlobalFrame(2);
      expect(getGlobalFrame()).toBe(2);
      expect(heard).toBe(2);

      setGlobalFrame(100);
      expect(getGlobalFrame()).toBe(100);
      expect(heard).toBe(100);

      unsubscribe();
      stepGlobalFrame(1);
      expect(getGlobalFrame()).toBe(101);
      expect(heard).toBe(100); // 退订后不再更新

      resetGlobalFrame();
      expect(getGlobalFrame()).toBe(0);
    });
  });

  describe('meleeBackground', () => {
    it('renders parallax background layers to mock canvas', () => {
      let paths = 0;
      let fills = 0;
      const mockCtx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        beginPath: () => { paths++; },
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => { fills++; },
        stroke: () => {},
        arc: () => {},
        rect: () => {},
        fillRect: () => { fills++; },
        save: () => {},
        restore: () => {},
        translate: () => {},
      };

      renderMeleeParallaxBackground(mockCtx, {
        width: 1000,
        height: 600,
        cameraX: 200,
        frame: 15,
        seed: 190,
      });

      expect(paths).toBeGreaterThan(0);
      expect(fills).toBeGreaterThan(0);
    });
  });

  describe('meleeStrategem', () => {
    it('draws level 3 strategem overlays for fire, water, and ambush', () => {
      let arcCount = 0;
      let fillCount = 0;
      const mockCtx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        beginPath: () => {},
        arc: () => { arcCount++; },
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => { fillCount++; },
        fillRect: () => { fillCount++; },
        rect: () => {},
      };

      // None - 零绘制
      drawLevel3StrategemOverlays(mockCtx, 800, 600, 'none', 0);
      expect(arcCount).toBe(0);
      expect(fillCount).toBe(0);

      // Fire - 橘红烟熏 + 火星粒子
      drawLevel3StrategemOverlays(mockCtx, 800, 600, 'fire', 20);
      expect(arcCount).toBeGreaterThan(10);
      expect(fillCount).toBeGreaterThan(0);

      // Water - 雨丝与水波
      const prevArcs = arcCount;
      drawLevel3StrategemOverlays(mockCtx, 800, 600, 'water', 20);
      expect(arcCount).toBeGreaterThan(prevArcs);

      // Ambush - 幽雾与暗角
      const prevFills = fillCount;
      drawLevel3StrategemOverlays(mockCtx, 800, 600, 'ambush', 20);
      expect(fillCount).toBeGreaterThan(prevFills);
    });
  });
});
