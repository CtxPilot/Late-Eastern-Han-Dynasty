// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { DevelopmentProjectKind } from './types/city.js';

/**
 * 持续内政项目的数值真源（S03 0-A）。
 *
 * `culture` 是 Session 362 首个文化切片：先把按月推进、暂停与存档链打通；
 * 文化对人才吸引/技术研发的后续消费仍保持独立，避免在本切片复制人事公式。
 * `craft`（Session 397）同构落库；Session 401 起征兵质量以部队士气加成消费；器械建造速度仍后置。
 * `transport`（Session 398）同构落库；Session 402 起行军运输损耗减免消费；行军速度仍后置。
 * `sanitation`（Session 399）同构：落库/展示/存档；瘟疫抗性与人口增长率消费后置。
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
  craft: { totalGoldCost: 360, label: '工艺', stat: 'craft', totalMonths: 6, gain: 60 },
  transport: { totalGoldCost: 360, label: '交通', stat: 'transport', totalMonths: 6, gain: 60 },
  sanitation: { totalGoldCost: 360, label: '卫生', stat: 'sanitation', totalMonths: 6, gain: 60 },
};

/** 文化/工艺等可选运行时统计上限（与 Session 362 文化封顶同源） */
export const OPTIONAL_DEVELOP_STAT_MAX = 999;

export function developmentInitialGoldCost(kind: DevelopmentProjectKind): number {
  return Math.ceil(DEVELOPMENT_PROJECT_CONFIG[kind].totalGoldCost / 3);
}
