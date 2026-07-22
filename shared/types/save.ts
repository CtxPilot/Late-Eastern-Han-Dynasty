// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { GameState } from './game.js';
import type { SerializableRngState } from '../rng.js';

export const CURRENT_SAVE_SCHEMA_VERSION = 1 as const;

/**
 * 持久化格式的版本信封。运行时 GameState 的校验由读取端显式注入，
 * 避免把尚未稳定的运行时类型误当成永久存档格式。
 */
export interface SaveEnvelopeV1<TSnapshot = GameState> {
  schemaVersion: typeof CURRENT_SAVE_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
  scenarioId: number;
  rng: SerializableRngState;
  snapshot: TSnapshot;
}

export interface SaveSlot {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  scenarioId: number;
  year: number;
  month: number;
  snapshot: GameState;
}
