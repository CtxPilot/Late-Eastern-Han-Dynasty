// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { SerializableRng, type SerializableRngState } from '@leh/shared';

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
