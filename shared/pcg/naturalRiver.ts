// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { Point2D, CanvasContextLike } from './inkMountains.js';

/**
 * S20-W3: PCG 自然河流与水系纯函数引擎 (naturalRiver.ts)
 *
 * 规格：
 * - 纯数学确定性算法，无外部资产依赖；
 * - 依据始末端点、种子与弯曲振幅生成自然蜿蜒水系（干流与支流）；
 * - 左右岸多边形自适应扩充与正弦曲折波动；
 * - 输出可直接供 Canvas 2D / SVG path / Konva Line 消费。
 */

export interface RiverBranch {
  centerline: Point2D[];
  leftBank: Point2D[];
  rightBank: Point2D[];
  polygon: Point2D[];
  pathString: string;
  width: number;
}

export interface RiverTributary {
  centerline: Point2D[];
  pathString: string;
  width: number;
}

export interface NaturalRiverSystem {
  seed: number;
  mainBranch: RiverBranch;
  tributaries: RiverTributary[];
}

export interface RiverOptions {
  start: Point2D;
  end: Point2D;
  seed?: number;
  baseWidth?: number;
  meanderAmplitude?: number;
  tributariesCount?: number;
  segments?: number;
}

function createRng(seed: number) {
  let s = (seed ^ 0x3f5a892b) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 生成自然蜿蜒水系
 */
export function generateNaturalRiver(options: RiverOptions): NaturalRiverSystem {
  const { start, end } = options;
  const seed = options.seed ?? 184;
  const baseWidth = options.baseWidth ?? 24;
  const meanderAmp = options.meanderAmplitude ?? 40;
  const tributariesCount = options.tributariesCount ?? 2;
  const segments = options.segments ?? 32;

  const rng = createRng(seed);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const totalLength = Math.hypot(dx, dy);
  const perpX = -dy / (totalLength || 1);
  const perpY = dx / (totalLength || 1);

  // 1. 生成干流中心线
  const centerline: Point2D[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    // 线性基点
    const lx = start.x + dx * t;
    const ly = start.y + dy * t;

    // 两头端点位移为 0，中间正弦大弯 + 高频轻微扰动
    const envelope = Math.sin(t * Math.PI);
    const wave1 = Math.sin(t * Math.PI * 3 + rng() * 0.5) * meanderAmp;
    const wave2 = Math.sin(t * Math.PI * 7) * (meanderAmp * 0.25);
    const offset = envelope * (wave1 + wave2);

    centerline.push({
      x: Math.round(lx + perpX * offset),
      y: Math.round(ly + perpY * offset),
    });
  }

  // 2. 生成左右岸多边形
  const leftBank: Point2D[] = [];
  const rightBank: Point2D[] = [];

  for (let i = 0; i < centerline.length; i++) {
    const cur = centerline[i];
    const prev = centerline[Math.max(0, i - 1)];
    const next = centerline[Math.min(centerline.length - 1, i + 1)];

    const cdx = next.x - prev.x;
    const cdy = next.y - prev.y;
    const cLen = Math.hypot(cdx, cdy) || 1;
    const nx = -cdy / cLen;
    const ny = cdx / cLen;

    // 宽度沿程微变（下游渐宽）
    const t = i / (centerline.length - 1);
    const curHalfWidth = (baseWidth * (0.8 + t * 0.4)) / 2;

    leftBank.push({
      x: Math.round(cur.x + nx * curHalfWidth),
      y: Math.round(cur.y + ny * curHalfWidth),
    });
    rightBank.push({
      x: Math.round(cur.x - nx * curHalfWidth),
      y: Math.round(cur.y - ny * curHalfWidth),
    });
  }

  // 岸边界逆向合并为闭合多边形
  const polygon = [...leftBank, ...rightBank.slice().reverse()];

  const mainPathParts = [`M ${polygon[0].x} ${polygon[0].y}`];
  for (let i = 1; i < polygon.length; i++) {
    mainPathParts.push(`L ${polygon[i].x} ${polygon[i].y}`);
  }
  mainPathParts.push('Z');
  const mainPathString = mainPathParts.join(' ');

  // 3. 支流生成
  const tributaries: RiverTributary[] = [];
  for (let b = 0; b < tributariesCount; b++) {
    // 随机选取干流中段一个锚点
    const anchorIdx = Math.floor(segments * (0.25 + (b + 0.5) * 0.25));
    const anchor = centerline[anchorIdx];
    const branchDir = b % 2 === 0 ? 1 : -1;
    const branchLength = totalLength * (0.2 + rng() * 0.15);
    const tribWidth = Math.max(4, Math.round(baseWidth * 0.4));

    const tribPoints: Point2D[] = [anchor];
    const tribSegments = 10;
    for (let k = 1; k <= tribSegments; k++) {
      const kt = k / tribSegments;
      const tx = anchor.x + perpX * branchDir * (branchLength * kt);
      const ty = anchor.y + perpY * branchDir * (branchLength * kt);
      const tWobble = Math.sin(kt * Math.PI * 2) * (meanderAmp * 0.3);
      tribPoints.push({
        x: Math.round(tx + perpY * tWobble),
        y: Math.round(ty - perpX * tWobble),
      });
    }

    const tribPath = [`M ${tribPoints[0].x} ${tribPoints[0].y}`];
    for (let i = 1; i < tribPoints.length; i++) {
      tribPath.push(`L ${tribPoints[i].x} ${tribPoints[i].y}`);
    }

    tributaries.push({
      centerline: tribPoints,
      pathString: tribPath.join(' '),
      width: tribWidth,
    });
  }

  return {
    seed,
    mainBranch: {
      centerline,
      leftBank,
      rightBank,
      polygon,
      pathString: mainPathString,
      width: baseWidth,
    },
    tributaries,
  };
}

/**
 * Canvas 2D 渲染辅助函数
 */
export function renderNaturalRiver(
  ctx: CanvasContextLike,
  river: NaturalRiverSystem,
  riverColor = '#487d92',
): void {
  // 1. 绘制干流面
  ctx.fillStyle = riverColor;
  ctx.beginPath();
  const poly = river.mainBranch.polygon;
  if (poly.length > 0) {
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // 2. 绘制支流线
  ctx.strokeStyle = riverColor;
  for (const trib of river.tributaries) {
    if (trib.centerline.length < 2) continue;
    ctx.lineWidth = trib.width;
    ctx.beginPath();
    ctx.moveTo(trib.centerline[0].x, trib.centerline[0].y);
    for (let i = 1; i < trib.centerline.length; i++) {
      ctx.lineTo(trib.centerline[i].x, trib.centerline[i].y);
    }
    ctx.stroke();
  }
}
