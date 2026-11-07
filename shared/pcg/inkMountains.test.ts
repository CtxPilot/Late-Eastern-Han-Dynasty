// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, it, expect } from 'vitest';
import {
  generateInkMountainLayers,
  renderInkMountains,
  generateNaturalRiver,
  renderNaturalRiver,
  generateTerrainTileElements,
  renderTerrainTile,
  drawProceduralGridFlame,
  drawProceduralWaterRipple,
  drawProceduralAmbushMist,
  drawLevel1StrategemVisuals,
} from './index.js';

describe('PCG Modules - S20-W3 Clean-room Procedural Graphics', () => {
  describe('inkMountains', () => {
    it('generates deterministic multi-tier mountain layers', () => {
      const layers1 = generateInkMountainLayers({ width: 1000, height: 600, seed: 190 });
      const layers2 = generateInkMountainLayers({ width: 1000, height: 600, seed: 190 });

      expect(layers1.length).toBe(3);
      expect(layers1).toEqual(layers2); // 相同种子像素级完全一致

      // 验证图层属性与结构
      for (const layer of layers1) {
        expect(layer.points.length).toBeGreaterThan(10);
        expect(layer.pathString).toMatch(/^M \d+ \d+/);
        expect(layer.pathString.endsWith('Z')).toBe(true);
        expect(layer.fill).toBeDefined();
        expect(layer.opacity).toBeGreaterThan(0);
      }

      // 不同种子产生差异
      const layersDiff = generateInkMountainLayers({ width: 1000, height: 600, seed: 999 });
      expect(layers1[0].points[5].y).not.toEqual(layersDiff[0].points[5].y);
    });

    it('renders ink mountain layers to mock canvas without crashing', () => {
      const layers = generateInkMountainLayers({ width: 800, height: 400 });
      let opCount = 0;
      const mockCtx = {
        fillStyle: '',
        strokeStyle: '',
        globalAlpha: 1,
        beginPath: () => { opCount++; },
        moveTo: () => { opCount++; },
        lineTo: () => { opCount++; },
        closePath: () => { opCount++; },
        fill: () => { opCount++; },
        stroke: () => { opCount++; },
        arc: () => {},
        rect: () => {},
      };

      renderInkMountains(mockCtx, layers);
      expect(opCount).toBeGreaterThan(20);
    });
  });

  describe('naturalRiver', () => {
    it('generates natural river with main branch and tributaries', () => {
      const river = generateNaturalRiver({
        start: { x: 50, y: 50 },
        end: { x: 500, y: 400 },
        seed: 123,
        baseWidth: 20,
        tributariesCount: 2,
      });

      expect(river.mainBranch.centerline.length).toBeGreaterThan(10);
      expect(river.mainBranch.polygon.length).toBeGreaterThan(20);
      expect(river.mainBranch.pathString).toMatch(/^M \d+ \d+/);
      expect(river.tributaries.length).toBe(2);
      expect(river.tributaries[0].centerline.length).toBeGreaterThan(5);
    });

    it('renders river to mock canvas', () => {
      const river = generateNaturalRiver({
        start: { x: 0, y: 0 },
        end: { x: 200, y: 200 },
        seed: 456,
      });

      let draws = 0;
      const mockCtx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => { draws++; },
        stroke: () => { draws++; },
        arc: () => {},
        rect: () => {},
      };

      renderNaturalRiver(mockCtx, river);
      expect(draws).toBeGreaterThanOrEqual(1);
    });
  });

  describe('terrainTiles', () => {
    it('generates procedural elements for all 6 tactical terrain types', () => {
      const terrains = ['plain', 'forest', 'mountain', 'water', 'swamp', 'city'];
      for (const t of terrains) {
        const elements = generateTerrainTileElements(t, { x: 100, y: 100 }, 30, 77);
        expect(elements.length).toBeGreaterThan(0);
        for (const el of elements) {
          expect(el.points.length).toBeGreaterThan(0);
        }
      }
    });

    it('renders terrain tile without crashing', () => {
      let strokeCalls = 0;
      const mockCtx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => { strokeCalls++; },
        arc: () => {},
        rect: () => {},
      };

      renderTerrainTile(mockCtx, 'mountain', 50, 50, 25, 88);
      expect(strokeCalls).toBeGreaterThan(0);
    });
  });

  describe('strategemVisuals', () => {
    it('draws procedural flame, water ripple, and ambush mist', () => {
      let arcCount = 0;
      const mockCtx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        beginPath: () => {},
        arc: () => { arcCount++; },
        rect: () => {},
        fill: () => {},
        stroke: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
      };

      drawProceduralGridFlame(mockCtx, 100, 100, 30, 10);
      expect(arcCount).toBeGreaterThan(5);

      const prevArc = arcCount;
      drawProceduralWaterRipple(mockCtx, 100, 100, 30, 10);
      expect(arcCount).toBeGreaterThan(prevArc);

      const prevArc2 = arcCount;
      drawProceduralAmbushMist(mockCtx, 100, 100, 30, 10);
      expect(arcCount).toBeGreaterThan(prevArc2);
    });

    it('draws Level 1 strategem visuals for all types', () => {
      let rectCount = 0;
      let arcCount = 0;
      const mockCtx = {
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        globalAlpha: 1,
        beginPath: () => {},
        arc: () => { arcCount++; },
        rect: () => { rectCount++; },
        fill: () => {},
        stroke: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
      };

      drawLevel1StrategemVisuals(mockCtx, 'none', 800, 600, 0);
      expect(arcCount).toBe(0);

      drawLevel1StrategemVisuals(mockCtx, 'fire', 800, 600, 10);
      expect(arcCount).toBeGreaterThan(10);

      drawLevel1StrategemVisuals(mockCtx, 'ambush', 800, 600, 10);
      expect(rectCount).toBe(2);
    });
  });
});
