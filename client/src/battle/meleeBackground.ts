// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { generateInkMountainLayers, type CanvasContextLike } from '@leh/shared';

export interface MeleeBackgroundOptions {
  width: number;
  height: number;
  cameraX?: number;
  frame?: number;
  terrain?: string;
  seed?: number;
}

/**
 * S20-W3 / S21-W8: 白刃战视差水墨背景 PCG 渲染器 (meleeBackground.ts)
 *
 * 规格：
 * - 纯数学确定性算法，无外部资产依赖；
 * - 4 层视差分层：
 *   1. 暮色天空渐变 (固定)
 *   2. 青黛远山 (视差系数 0.10)
 *   3. 烟岚中峰与旌旗残影 (视差系数 0.35)
 *   4. 近景战阵沙土地面与石块 (视差系数 1.0)
 * - 60 FPS 预算内高性能命令式绘制。
 */
export function renderMeleeParallaxBackground(
  ctx: CanvasContextLike | any,
  options: MeleeBackgroundOptions,
): void {
  const { width, height, cameraX = 0, frame = 0, seed = 190 } = options;

  // 1. 天空渐变
  if (ctx.createLinearGradient) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.7);
    skyGrad.addColorStop(0, '#1c1917');
    skyGrad.addColorStop(1, '#292524');
    ctx.fillStyle = skyGrad;
  } else {
    ctx.fillStyle = '#1c1917';
  }
  ctx.globalAlpha = 1.0;
  ctx.fillRect ? ctx.fillRect(0, 0, width, height) : ctx.rect?.(0, 0, width, height);

  // 2. 远山与中景山峦 (视差平移)
  const mountainLayers = generateInkMountainLayers({
    width: width * 1.5,
    height: Math.round(height * 0.8),
    seed,
  });

  // 远景 (layer 0)
  if (mountainLayers[0]) {
    const l0 = mountainLayers[0];
    const offX = -Math.round((cameraX * 0.1) % (width * 0.5));
    ctx.save?.();
    ctx.translate?.(offX, 0);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = l0.fill;
    ctx.beginPath();
    ctx.moveTo(l0.points[0].x, l0.points[0].y);
    for (let i = 1; i < l0.points.length; i++) {
      ctx.lineTo(l0.points[i].x, l0.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore?.();
  }

  // 中景 (layer 1)
  if (mountainLayers[1]) {
    const l1 = mountainLayers[1];
    const offX = -Math.round((cameraX * 0.35) % (width * 0.5));
    ctx.save?.();
    ctx.translate?.(offX, 0);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = l1.fill;
    ctx.beginPath();
    ctx.moveTo(l1.points[0].x, l1.points[0].y);
    for (let i = 1; i < l1.points.length; i++) {
      ctx.lineTo(l1.points[i].x, l1.points[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore?.();
  }

  // 3. 前景战场沙土地面
  const groundY = Math.round(height * 0.68);
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = '#171412';
  ctx.beginPath();
  ctx.rect?.(0, groundY, width, height - groundY);
  ctx.fill();

  // 地面交界沙土墨线
  ctx.strokeStyle = '#44403c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(width, groundY);
  ctx.stroke();

  // 4. 地面微小飞沙点缀
  const gritCount = 12;
  ctx.fillStyle = '#78716c';
  for (let g = 0; g < gritCount; g++) {
    const gx = ((g * 137 + cameraX * 0.8 + frame * 0.3) % width + width) % width;
    const gy = groundY + 10 + (g * 19) % (height - groundY - 20);
    ctx.globalAlpha = 0.4 + (g % 3) * 0.2;
    ctx.beginPath();
    ctx.arc?.(gx, gy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
