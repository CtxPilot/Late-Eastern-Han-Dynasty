// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S20-W3 / S21: 跨模块共享帧计数引擎 (frameCount.ts)
 *
 * 规格：
 * - 集中维护全局渲染帧计数，支持多 Stage / Canvas 协同驱动粒子与水墨涟漪；
 * - 纯内存无状态污染，支持订阅与步进。
 */

let globalFrame = 0;
const subscribers = new Set<(f: number) => void>();

export function getGlobalFrame(): number {
  return globalFrame;
}

export function setGlobalFrame(f: number): void {
  globalFrame = f;
  for (const sub of subscribers) {
    sub(globalFrame);
  }
}

export function stepGlobalFrame(delta = 1): number {
  globalFrame += delta;
  for (const sub of subscribers) {
    sub(globalFrame);
  }
  return globalFrame;
}

export function resetGlobalFrame(): void {
  globalFrame = 0;
  for (const sub of subscribers) {
    sub(globalFrame);
  }
}

export function subscribeFrame(listener: (f: number) => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}
