// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type Konva from 'konva';

export interface StageLike {
  width(val?: number): number | this;
  height(val?: number): number | this;
  container(): HTMLElement | null;
}

/**
 * 获取当前窗口的有效设备像素比（DPR），支持 Linux Wayland 分数倍缩放（1.25, 1.5, 1.75 等）。
 * 边界保护：安全范围夹紧于 [1, 3]，防止超高分屏导致显存缓冲区溢出。
 */
export function getEffectiveDpr(customWindow?: Window): number {
  const win = customWindow ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win) return 1;
  const raw = Number(win.devicePixelRatio) || 1;
  return Math.min(3, Math.max(1, Math.round(raw * 100) / 100));
}

/**
 * 监听分辨率 / 像素比动态变化（例如在 Linux 多屏切换、Wayland 缩放调整或浏览器缩放）。
 * 返回注销监听器的清理函数。
 */
export function observePixelRatio(
  onChange: (dpr: number) => void,
  customWindow?: Window,
): () => void {
  const win = customWindow ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win || typeof win.matchMedia !== 'function') {
    return () => {};
  }

  let active = true;
  let currentDpr = getEffectiveDpr(win);
  let removeCurrentListener: (() => void) | null = null;

  const bind = () => {
    if (!active) return;
    const mqString = `(resolution: ${currentDpr}dppx)`;
    const mql = win.matchMedia(mqString);
    const handler = () => {
      if (!active) return;
      const nextDpr = getEffectiveDpr(win);
      if (Math.abs(nextDpr - currentDpr) > 0.01) {
        currentDpr = nextDpr;
        onChange(nextDpr);
        if (removeCurrentListener) removeCurrentListener();
        bind();
      }
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      removeCurrentListener = () => mql.removeEventListener('change', handler);
    } else if (typeof (mql as unknown as { addListener?: (fn: () => void) => void }).addListener === 'function') {
      (mql as unknown as { addListener: (fn: () => void) => void }).addListener(handler);
      removeCurrentListener = () => (mql as unknown as { removeListener: (fn: () => void) => void }).removeListener(handler);
    }
  };

  bind();

  return () => {
    active = false;
    if (removeCurrentListener) {
      removeCurrentListener();
      removeCurrentListener = null;
    }
  };
}

/**
 * 为 Konva Stage 配置 HiDPI 缩放与逻辑像素对齐。
 * 确保 Stage 在分数倍与高分屏下渲染线条和文字锐利无锯齿。
 */
export function setupHiDPIStage(
  stage: StageLike,
  logicalWidth: number,
  logicalHeight: number,
  customDpr?: number,
): number {
  const dpr = customDpr ?? getEffectiveDpr();

  // 若浏览器全局或当前环境存在 Konva，同步设置 Konva.pixelRatio
  const globalKonva = (typeof window !== 'undefined'
    ? (window as unknown as { Konva?: typeof Konva }).Konva
    : (globalThis as unknown as { Konva?: typeof Konva }).Konva);
  if (globalKonva) {
    globalKonva.pixelRatio = dpr;
  }

  stage.width(logicalWidth);
  stage.height(logicalHeight);

  // 确保 stage 容器 DOM 和画布样式尺寸为逻辑像素
  const container = stage.container();
  if (container && container.style) {
    container.style.width = `${logicalWidth}px`;
    container.style.height = `${logicalHeight}px`;
  }

  return dpr;
}

/**
 * 获取图层烘焙缓存的标准 pixelRatio 选项。
 */
export function getLayerCacheOptions(customDpr?: number): { pixelRatio: number } {
  return { pixelRatio: customDpr ?? getEffectiveDpr() };
}
