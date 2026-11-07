// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { StrategemType, CanvasContextLike } from '@leh/shared';

/**
 * S20-W3 / S21-W8: 白刃战三级计谋全屏程序化粒子叠加 (meleeStrategem.ts)
 *
 * 规格：
 * - 纯数学确定性算法，无外部资产依赖；
 * - 依据 activeStrategem 渲染全屏环境粒子：
 *   - 'fire': 烈焰余烬、火星升腾与暖橙烟熏暗角；
 *   - 'water': 斜织暴雨丝、地面溅水波纹与冷水雾；
 *   - 'ambush': 弥天幽雾、伏兵暗影与四周黑角遮蔽；
 * - 60 FPS 命令式 Canvas 2D 绘制。
 */
export function drawLevel3StrategemOverlays(
  ctx: CanvasContextLike | any,
  width: number,
  height: number,
  strategem: StrategemType,
  frame: number,
  seed = 500,
): void {
  if (strategem === 'none') return;

  switch (strategem) {
    case 'fire': {
      // 1. 全局橘红烟熏色调
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#ea580c';
      ctx.fillRect ? ctx.fillRect(0, 0, width, height) : ctx.rect?.(0, 0, width, height);
      ctx.fill();

      // 2. 升腾火星粒子 (30 粒)
      const sparkCount = 30;
      for (let s = 0; s < sparkCount; s++) {
        const sSeed = (seed + s * 29) % 1000;
        const speed = 1.2 + (sSeed % 6) * 0.4;
        const sx = ((sSeed * 31 + Math.sin(frame * 0.05 + s) * 20) % width + width) % width;
        const sy = height - (((frame * speed + sSeed * 17) % height));
        const progress = (height - sy) / height;

        ctx.globalAlpha = Math.max(0, (1 - progress) * 0.85);
        ctx.fillStyle = s % 3 === 0 ? '#fde047' : s % 3 === 1 ? '#f97316' : '#ef4444';
        ctx.beginPath();
        ctx.arc?.(sx, sy, 1.5 + (s % 3) * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'water': {
      // 1. 细密斜织雨丝 (40 根)
      const rainCount = 40;
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 1;
      for (let r = 0; r < rainCount; r++) {
        const rSeed = (seed + r * 43) % 1000;
        const rx = ((rSeed * 23 + frame * 4) % (width + 100)) - 50;
        const ry = ((frame * 12 + rSeed * 37) % (height + 50)) - 25;
        const len = 16 + (rSeed % 12);

        ctx.globalAlpha = 0.35 + (rSeed % 3) * 0.15;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + len);
        ctx.stroke();
      }

      // 2. 地面溅水波纹
      const groundY = Math.round(height * 0.7);
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.2;
      for (let w = 0; w < 6; w++) {
        const wx = ((w * 173 + frame * 0.5) % width);
        const waveProgress = ((frame + w * 20) % 60) / 60;
        const wr = waveProgress * 15;
        ctx.globalAlpha = Math.max(0, (1 - waveProgress) * 0.6);
        ctx.beginPath();
        ctx.arc?.(wx, groundY + 5, wr, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'ambush': {
      // 1. 四周深黑暗角遮蔽 (Vignette)
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#05070a';
      // 顶部与底部暗带
      ctx.fillRect ? ctx.fillRect(0, 0, width, height * 0.2) : ctx.rect?.(0, 0, width, height * 0.2);
      ctx.fill();
      ctx.fillRect ? ctx.fillRect(0, height * 0.8, width, height * 0.2) : ctx.rect?.(0, height * 0.8, width, height * 0.2);
      ctx.fill();

      // 2. 贴地滚动的伏兵幽雾
      const mistCount = 6;
      ctx.fillStyle = '#1e293b';
      for (let m = 0; m < mistCount; m++) {
        const mx = ((m * 180 + frame * 0.4) % (width + 200)) - 100;
        const my = height * 0.65 + Math.sin(frame * 0.03 + m) * 15;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc?.(mx, my, 45, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
  }
}
