// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['tactical-grid.ts', 'tactical-system.ts', 'melee-engagement.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 },
    },
  },
});
