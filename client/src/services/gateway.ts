// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 离线可玩版（Session 372 Phase 2）：在线/离线统一网关。
 *
 * - `?offline=1` 或 `VITE_OFFLINE=1` 时优先走浏览器内权威引擎（offline-api），
 *   未覆盖指令回退在线实现（断网时以既有错误提示呈现，不静默吞掉）；
 * - 默认（本地 pnpm dev / Pages 在线预览）保持纯在线链路不变。
 */
import * as online from './api';
import * as offline from './offline/offline-api';

export function isOfflinePreferred(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.has('offline') || import.meta.env.VITE_OFFLINE === '1';
}

type Api = typeof online;

const merged: Api = isOfflinePreferred()
  ? { ...online, ...(offline as Partial<Api>) }
  : online;

export const gameApi = merged;
