// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { DevelopmentProjectKind } from './types/city.js';

/**
 * 持续内政项目的数值真源（S03 0-A）。
 *
 * `culture` 是 Session 362 首个文化切片：先把按月推进、暂停与存档链打通；
 * 文化对人才吸引/技术研发的后续消费仍保持独立，避免在本切片复制人事公式。
 */
export interface DevelopmentProjectConfig {
  totalGoldCost: number;
  label: string;
  stat: DevelopmentProjectKind;
  totalMonths: number;
  gain: number;
}

export const DEVELOPMENT_PROJECT_CONFIG: Record<DevelopmentProjectKind, DevelopmentProjectConfig> = {
  farm: { totalGoldCost: 300, label: '农业', stat: 'farm', totalMonths: 9, gain: 100 },
  commerce: { totalGoldCost: 400, label: '商业', stat: 'commerce', totalMonths: 6, gain: 100 },
  wall: { totalGoldCost: 500, label: '城防', stat: 'wall', totalMonths: 12, gain: 100 },
  culture: { totalGoldCost: 360, label: '文化', stat: 'culture', totalMonths: 6, gain: 60 },
};

export function developmentInitialGoldCost(kind: DevelopmentProjectKind): number {
  return Math.ceil(DEVELOPMENT_PROJECT_CONFIG[kind].totalGoldCost / 3);
}
