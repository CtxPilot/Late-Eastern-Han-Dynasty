// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/** 离线可玩版（Session 372）主线程 ↔ Worker 的消息契约。 */
export interface RpcRequest {
  id: number;
  method: string;
  args: unknown[];
}

export type RpcResponse =
  | { id: number; ok: true; data: unknown; patch?: unknown }
  | { id: number; ok: true; patchOnly: true; patch: unknown }
  | { id: number; ok: false; error: string };
