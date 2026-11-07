// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * P5-08 Canvas 战术动画几何计算引擎（ArtDirection.md 批次④ 程序化几何特效）。
 * 纯数学、零外部美术资产依赖、100% 确定性。
 */

export interface WaterRippleState {
  radius: number;
  opacity: number;
}

export interface FireFlickerState {
  scale: number;
  opacity: number;
  offsetY: number;
}

export interface ShockwaveState {
  radius: number;
  opacity: number;
  strokeWidth: number;
}

/**
 * 计算行军路径虚线流光的位移偏量（实现箭头/折线朝目标行进的流光感）。
 */
export function marchDashOffset(timeMs: number, speed = 0.03, cyclePeriod = 24): number {
  const normTime = Math.max(0, timeMs);
  return -((normTime * speed) % cyclePeriod);
}

/**
 * 计算水攻/水系减速的同心波纹几何扩展状态。
 */
export function waterRipple(timeMs: number, maxRadius = 32, cycleMs = 1600): WaterRippleState {
  const normTime = Math.max(0, timeMs);
  const progress = (normTime % cycleMs) / cycleMs;
  return {
    radius: Math.max(2, Math.round(progress * maxRadius * 10) / 10),
    opacity: Math.max(0, Math.min(1, Math.round((1 - progress) * 0.75 * 100) / 100)),
  };
}

/**
 * 计算火计/灼烧的几何火光微颤动与上升位移。
 */
export function fireFlicker(timeMs: number, offsetIndex = 0): FireFlickerState {
  const normTime = Math.max(0, timeMs) + offsetIndex * 150;
  const sinVal = Math.sin(normTime / 120);
  const cosVal = Math.cos(normTime / 180);
  return {
    scale: Math.max(0.7, Math.min(1.3, Math.round((0.95 + 0.18 * sinVal) * 100) / 100)),
    opacity: Math.max(0.4, Math.min(1, Math.round((0.7 + 0.25 * cosVal) * 100) / 100)),
    offsetY: Math.round(-3 * Math.abs(Math.sin(normTime / 140)) * 10) / 10,
  };
}

/**
 * 计算伏兵出伏/落石震地的六角震波光环几何状态。
 */
export function shockwave(timeMs: number, durationMs = 1200, maxRadius = 36): ShockwaveState {
  const normTime = Math.max(0, timeMs);
  const progress = Math.min(1, (normTime % durationMs) / durationMs);
  return {
    radius: Math.max(4, Math.round(progress * maxRadius * 10) / 10),
    opacity: Math.max(0, Math.min(1, Math.round((1 - progress) * 100) / 100)),
    strokeWidth: Math.max(1, Math.round((3 - 2 * progress) * 10) / 10),
  };
}
