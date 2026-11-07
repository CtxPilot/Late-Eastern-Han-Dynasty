// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { Point2D, CanvasContextLike } from './inkMountains.js';

/**
 * S20-W3: PCG 战术六角格地形与水墨纹理纯函数 (terrainTiles.ts)
 *
 * 规格：
 * - 纯数学确定性算法，无外部资产依赖；
 * - 针对 6 大战术地形（平原、森林、山地、水域、沼泽、城塞）生成古典水墨装饰微缩图元；
 * - 兼备纯几何数据提取（供 SVG / Konva）与 Canvas 2D 高性能命令式绘制。
 */

export interface TerrainTileElement {
  kind: 'path' | 'circle' | 'lines';
  points: Point2D[];
  stroke?: string;
  fill?: string;
  lineWidth?: number;
  opacity?: number;
}

function createRng(seed: number) {
  let s = (seed ^ 0x2c1b9f7a) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 依据地形类型生成水墨装饰图元
 */
export function generateTerrainTileElements(
  type: string,
  center: Point2D,
  radius: number,
  seed = 42,
): TerrainTileElement[] {
  const rng = createRng(seed);
  const elements: TerrainTileElement[] = [];

  switch (type) {
    case 'forest': {
      // 树木拓片小品：3~4 株水墨树冠与树干
      const treeCount = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < treeCount; i++) {
        const angle = (i * 2 * Math.PI) / treeCount + (rng() - 0.5) * 0.4;
        const dist = radius * (0.2 + rng() * 0.35);
        const tx = Math.round(center.x + Math.cos(angle) * dist);
        const ty = Math.round(center.y + Math.sin(angle) * dist);
        const crownR = Math.round(radius * (0.16 + rng() * 0.08));

        // 树干
        elements.push({
          kind: 'lines',
          points: [
            { x: tx, y: ty },
            { x: tx, y: ty + crownR + 4 },
          ],
          stroke: '#283618',
          lineWidth: 2,
          opacity: 0.8,
        });

        // 水墨伞状树冠点集
        const crownPts: Point2D[] = [];
        const segs = 8;
        for (let s = 0; s < segs; s++) {
          const a = (s * 2 * Math.PI) / segs;
          const r = crownR * (0.8 + rng() * 0.4);
          crownPts.push({
            x: Math.round(tx + Math.cos(a) * r),
            y: Math.round(ty + Math.sin(a) * r),
          });
        }
        elements.push({
          kind: 'path',
          points: crownPts,
          fill: '#354f26',
          stroke: '#1c2e12',
          lineWidth: 1,
          opacity: 0.85,
        });
      }
      break;
    }

    case 'mountain': {
      // 峭壁与双峰峦轮廓
      const p1 = { x: center.x - radius * 0.35, y: center.y + radius * 0.3 };
      const peak1 = { x: center.x - radius * 0.15, y: center.y - radius * 0.45 };
      const valley = { x: center.x, y: center.y + radius * 0.05 };
      const peak2 = { x: center.x + radius * 0.25, y: center.y - radius * 0.35 };
      const p2 = { x: center.x + radius * 0.4, y: center.y + radius * 0.3 };

      elements.push({
        kind: 'path',
        points: [p1, peak1, valley, peak2, p2],
        stroke: '#4a3f35',
        fill: '#2b231c',
        lineWidth: 2,
        opacity: 0.9,
      });

      // 山脊阴影褶皱线
      elements.push({
        kind: 'lines',
        points: [peak1, { x: peak1.x + 4, y: peak1.y + radius * 0.4 }],
        stroke: '#1f1914',
        lineWidth: 1.5,
        opacity: 0.7,
      });
      break;
    }

    case 'water': {
      // 3 条平滑微风正弦水波纹
      for (let w = -1; w <= 1; w++) {
        const yOff = w * (radius * 0.28);
        const wavePts: Point2D[] = [];
        const segs = 12;
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          const wx = center.x - radius * 0.5 + t * radius;
          const wy = center.y + yOff + Math.sin(t * Math.PI * 2 + w) * (radius * 0.08);
          wavePts.push({ x: Math.round(wx), y: Math.round(wy) });
        }
        elements.push({
          kind: 'lines',
          points: wavePts,
          stroke: '#64a6bd',
          lineWidth: 1.5,
          opacity: 0.75,
        });
      }
      break;
    }

    case 'swamp': {
      // 芦苇浅滩点线与泥泞斑块
      const mudPts: Point2D[] = [];
      const segs = 7;
      for (let s = 0; s < segs; s++) {
        const a = (s * 2 * Math.PI) / segs;
        const mr = radius * 0.25 * (0.8 + rng() * 0.4);
        mudPts.push({
          x: Math.round(center.x + Math.cos(a) * mr),
          y: Math.round(center.y + Math.sin(a) * mr),
        });
      }
      elements.push({
        kind: 'path',
        points: mudPts,
        fill: '#383b2a',
        opacity: 0.6,
      });

      // 芦苇茎秆
      for (let r = 0; r < 4; r++) {
        const rx = center.x + (r - 1.5) * (radius * 0.16);
        const ry = center.y + (rng() - 0.5) * 8;
        elements.push({
          kind: 'lines',
          points: [
            { x: Math.round(rx), y: Math.round(ry + 10) },
            { x: Math.round(rx + 3), y: Math.round(ry - 10) },
          ],
          stroke: '#606c38',
          lineWidth: 1.5,
          opacity: 0.85,
        });
      }
      break;
    }

    case 'city':
    case 'wall': {
      // 城垛石墙与雉堞矩形几何
      const halfW = radius * 0.4;
      const halfH = radius * 0.25;
      const wallPoly: Point2D[] = [
        { x: Math.round(center.x - halfW), y: Math.round(center.y - halfH) },
        { x: Math.round(center.x + halfW), y: Math.round(center.y - halfH) },
        { x: Math.round(center.x + halfW), y: Math.round(center.y + halfH) },
        { x: Math.round(center.x - halfW), y: Math.round(center.y + halfH) },
      ];
      elements.push({
        kind: 'path',
        points: wallPoly,
        fill: '#4a4439',
        stroke: '#8b7a63',
        lineWidth: 1.5,
        opacity: 0.9,
      });

      // 女墙齿垛
      for (let c = 0; c < 3; c++) {
        const cx = center.x - halfW * 0.6 + c * (halfW * 0.6);
        elements.push({
          kind: 'lines',
          points: [
            { x: Math.round(cx), y: Math.round(center.y - halfH) },
            { x: Math.round(cx), y: Math.round(center.y - halfH - 4) },
          ],
          stroke: '#cfc0a0',
          lineWidth: 2,
          opacity: 0.9,
        });
      }
      break;
    }

    case 'plain':
    default: {
      // 平原金石草茎点缀
      for (let g = 0; g < 3; g++) {
        const gx = center.x + (rng() - 0.5) * radius * 0.7;
        const gy = center.y + (rng() - 0.5) * radius * 0.7;
        elements.push({
          kind: 'lines',
          points: [
            { x: Math.round(gx), y: Math.round(gy) },
            { x: Math.round(gx + 2), y: Math.round(gy - 6) },
          ],
          stroke: '#6a7a58',
          lineWidth: 1,
          opacity: 0.6,
        });
      }
      break;
    }
  }

  return elements;
}

/**
 * Canvas 2D 渲染辅助函数
 */
export function renderTerrainTile(
  ctx: CanvasContextLike,
  type: string,
  cx: number,
  cy: number,
  radius: number,
  seed = 42,
): void {
  const elements = generateTerrainTileElements(type, { x: cx, y: cy }, radius, seed);

  for (const el of elements) {
    if (el.points.length === 0) continue;
    ctx.globalAlpha = el.opacity ?? 1.0;
    if (el.lineWidth) ctx.lineWidth = el.lineWidth;
    if (el.stroke) ctx.strokeStyle = el.stroke;
    if (el.fill) ctx.fillStyle = el.fill;

    ctx.beginPath();
    ctx.moveTo(el.points[0].x, el.points[0].y);
    for (let i = 1; i < el.points.length; i++) {
      ctx.lineTo(el.points[i].x, el.points[i].y);
    }

    if (el.kind === 'path' && el.fill) {
      ctx.closePath();
      ctx.fill();
      if (el.stroke) ctx.stroke();
    } else {
      ctx.stroke();
    }
  }
}
