// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // P2-5（Session 417）：server 单测起步——引擎/服务层纯逻辑单测；
    // 与 verify-* 端到端确定性脚本互补（脚本管「对不对」，单测管「回归面」）。
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
  },
});
