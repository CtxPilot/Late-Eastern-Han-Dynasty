// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

export const SAVE_RNG_ALGORITHM = 'xorshift32-v1' as const;

export interface SerializableRngState {
  algorithm: typeof SAVE_RNG_ALGORITHM;
  /** xorshift32 当前非零寄存器值（不是仅初始 seed）。 */
  state: number;
  /** 已消费次数；用于审计和检测意外的随机流漂移。 */
  draws: number;
}

const UINT32_RANGE = 0x1_0000_0000;
const ZERO_SEED_FALLBACK = 0x6d2b79f5;

function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? ZERO_SEED_FALLBACK : normalized;
}

/** 可序列化的 xorshift32 随机流；next() 与 Math.random() 一样返回 [0, 1)。 */
export class SerializableRng {
  private state: number;
  private draws: number;

  constructor(seedOrState: number | SerializableRngState) {
    if (typeof seedOrState === 'number') {
      this.state = normalizeSeed(seedOrState);
      this.draws = 0;
      return;
    }
    if (seedOrState.algorithm !== SAVE_RNG_ALGORITHM) {
      throw new Error(`不支持的 PRNG 算法: ${String(seedOrState.algorithm)}`);
    }
    if (!Number.isInteger(seedOrState.state) || seedOrState.state <= 0 || seedOrState.state > 0xffff_ffff) {
      throw new Error('PRNG state 必须是非零 uint32');
    }
    if (!Number.isSafeInteger(seedOrState.draws) || seedOrState.draws < 0) {
      throw new Error('PRNG draws 必须是非负安全整数');
    }
    this.state = seedOrState.state >>> 0;
    this.draws = seedOrState.draws;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    this.draws += 1;
    return this.state / UINT32_RANGE;
  }

  snapshot(): SerializableRngState {
    return { algorithm: SAVE_RNG_ALGORITHM, state: this.state, draws: this.draws };
  }
}
