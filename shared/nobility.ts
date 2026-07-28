// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { NobilityRank } from './enums/index.js';

export const NOBILITY_RANKS = [
  NobilityRank.NONE,
  NobilityRank.GUANNEI_MARQUIS,
  NobilityRank.TING_MARQUIS,
  NobilityRank.XIANG_MARQUIS,
  NobilityRank.XIAN_MARQUIS,
  NobilityRank.DUKE,
  NobilityRank.KING,
  NobilityRank.EMPEROR,
] as const;

export const NOBILITY_LABELS: Record<NobilityRank, string> = {
  [NobilityRank.NONE]: '无爵',
  [NobilityRank.GUANNEI_MARQUIS]: '关内侯',
  [NobilityRank.TING_MARQUIS]: '亭侯',
  [NobilityRank.XIANG_MARQUIS]: '乡侯',
  [NobilityRank.XIAN_MARQUIS]: '县侯',
  [NobilityRank.DUKE]: '公',
  [NobilityRank.KING]: '王',
  [NobilityRank.EMPEROR]: '皇帝',
};

export function nextNobilityRank(rank: NobilityRank): NobilityRank | null {
  const index = NOBILITY_RANKS.indexOf(rank);
  return index < 0 || index === NOBILITY_RANKS.length - 1
    ? null
    : NOBILITY_RANKS[index + 1];
}
