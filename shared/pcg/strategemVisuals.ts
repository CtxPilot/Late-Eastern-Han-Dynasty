// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S20-W3: PCG 计谋战术程序化视觉纯函数引擎 (strategemVisuals.ts)
 *
 * 规格：
 * - 纯数学确定性算法，无外部资产依赖；
 * - 服务于 Level 1 (大地图异象) 与 Level 2 (战术格地貌侵蚀/火舌/正弦水纹/迷雾)；
 * - 纯 Canvas 2D 绘图命令，具备 60 FPS 高性能与帧间平滑连续性。
 */

import type { CanvasContextLike } from './inkMountains.js';

export type StrategemType = 'none' | 'fire' | 'water' | 'ambush';

/**
 * 二级战术格火计：程序化火舌、飞舞余烬与地面炭黑
 */
export function drawProceduralGridFlame(
  ctx: CanvasContextLike,
  x: number,
  y: number,
  radius: number,
  frame: number,
  seed = 100,
): void {
  // 1. 底层炭黑烘托
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#1c130e';
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.85, 0, Math.PI * 2);
  ctx.fill();

  // 2. 升腾火舌 (5 条双正弦扰动火焰)
  const flameCount = 5;
  for (let i = 0; i < flameCount; i++) {
    const angle = ((i * 2 + (frame % 20) * 0.1) * Math.PI) / flameCount;
    const flicker = Math.sin((frame * 0.2) + i + seed) * (radius * 0.25);
    const fx = x + Math.cos(angle) * (radius * 0.35);
    const fy = y - radius * 0.2 - Math.abs(flicker);
    const sparkRadius = Math.max(3, radius * 0.28 + flicker * 0.4);

    ctx.globalAlpha = 0.65;
    ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#ef4444';
    ctx.beginPath();
    ctx.arc(fx, fy, sparkRadius, 0, Math.PI * 2);
    ctx.fill();

    // 焰心亮金
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(fx, fy + 3, sparkRadius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. 升空火星粒子
  for (let p = 0; p < 4; p++) {
    const pPhase = (frame * 1.5 + p * 25 + seed * 7) % 100;
    const progress = pPhase / 100;
    const px = x + Math.sin(progress * Math.PI * 2 + p) * (radius * 0.5);
    const py = y - progress * radius * 1.4;

    ctx.globalAlpha = Math.max(0, 1 - progress);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 二级战术格水计：同心正弦波浪水环与泛滥蓝流
 */
export function drawProceduralWaterRipple(
  ctx: CanvasContextLike,
  x: number,
  y: number,
  radius: number,
  frame: number,
  seed = 200,
): void {
  // 1. 水泊浸润底色
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#0f2b38';
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // 2. 扩散同心圆水纹
  const rippleCount = 3;
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 1.5;

  for (let r = 0; r < rippleCount; r++) {
    const phase = ((frame * 0.8 + r * 30 + seed * 3) % 90) / 90;
    const curR = phase * radius * 0.85;
    const alpha = Math.max(0, (1 - phase) * 0.7);

    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, curR, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * 二级战术格伏兵：幽暗旋雾与隐蔽阴影
 */
export function drawProceduralAmbushMist(
  ctx: CanvasContextLike,
  x: number,
  y: number,
  radius: number,
  frame: number,
  seed = 300,
): void {
  // 环状聚散迷雾团
  const cloudCount = 4;
  for (let c = 0; c < cloudCount; c++) {
    const angle = (c * 2 * Math.PI) / cloudCount + frame * 0.02;
    const drift = Math.sin(frame * 0.05 + c + seed) * (radius * 0.15);
    const cx = x + Math.cos(angle) * (radius * 0.4 + drift);
    const cy = y + Math.sin(angle) * (radius * 0.4 + drift);
    const cr = radius * 0.35;

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * 一级大地图异象层（全屏计谋天象：火烟粒子 / 蔚蓝波纹 / 迷雾树影）
 */
export function drawLevel1StrategemVisuals(
  ctx: CanvasContextLike,
  strategem: StrategemType,
  width: number,
  height: number,
  frame: number,
  seed = 400,
): void {
  if (strategem === 'none') return;

  switch (strategem) {
    case 'fire': {
      // 烽烟火星：自下而上漂浮的橘红光粒
      const particleCount = 20;
      for (let p = 0; p < particleCount; p++) {
        const pSeed = (seed + p * 37) % 1000;
        const speed = 1.0 + (pSeed % 5) * 0.3;
        const px = ((pSeed * 17 + frame * 0.5) % width);
        const py = height - (((frame * speed + pSeed * 23) % height));
        const progress = (height - py) / height;

        ctx.globalAlpha = Math.max(0, (1 - progress) * 0.8);
        ctx.fillStyle = p % 2 === 0 ? '#f97316' : '#fbbf24';
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'water': {
      // 全局微风水气波光
      const waveCount = 5;
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      for (let w = 0; w < waveCount; w++) {
        const yBase = (height / waveCount) * w + (frame * 0.4) % (height / waveCount);
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(width * 0.5, yBase, width * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'ambush': {
      // 四周幽暗 Vignette 雾障
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#090d13';
      ctx.beginPath();
      ctx.rect(0, 0, width, height * 0.15); // 上缘
      ctx.rect(0, height * 0.85, width, height * 0.15); // 下缘
      ctx.fill();
      break;
    }
  }
}
