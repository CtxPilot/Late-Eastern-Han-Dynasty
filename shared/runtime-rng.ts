// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 进程级权威随机流单例（xorshift32-v1）。
 *
 * 离线可玩版（Session 372 Phase 0）：自 server/src/runtime-rng.ts 上移为双端共享，
 * 服务端、浏览器主线程与 Web Worker 各持独立的模块级单例（不同 JS 域互不干扰）。
 * 存档信封（SaveEnvelopeV1.rng）在持久化时外提快照，读档经 restoreRuntimeRng 复原，
 * 实现“确定性续玩”；禁止任何引擎直接使用 Math.random。
 */
import { SerializableRng, type SerializableRngState } from './rng.js';

let authoritativeRng = new SerializableRng(0x4c454831);

export function runtimeRandom(): number {
  return authoritativeRng.next();
}

export function getRuntimeRngState(): SerializableRngState {
  return authoritativeRng.snapshot();
}

export function restoreRuntimeRng(state: SerializableRngState): void {
  authoritativeRng = new SerializableRng(state);
}

export function resetRuntimeRng(seed: number): void {
  authoritativeRng = new SerializableRng(seed);
}
