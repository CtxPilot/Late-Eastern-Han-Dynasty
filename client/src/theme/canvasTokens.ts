// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Canvas/Konva 裸 hex 集中收口（ArtDirection.md §1.2 + §8）。
 * 组件内直接写裸 hex 视为 review 不通过；此处集中以便审计与未来统一换色。
 *
 * 当前值与历史内联值逐一等价（本轮色板 token 化零视觉改动）；
 * 战斗层 BattleView / BattlefieldSceneView 的换色属第一梯队 Step 2，不在本文件范围。
 * 头像 OfficerPortrait 的 HERO_PRESETS 专属墨/朱色属头像系统数据，由 B 层重建时收口。
 */

export const MAP_TOKENS = {
  background: '#121c2a',
  provinceLabel: '#c9b882',
  adminSubLabel: '#a89870',
  road: '#8a7355',
  cityUnknownTroops: '#666',
  cityUnknownFill: '#4a4a4a',
  cityFriendlyTroops: '#8aaa90',
  cityStrokeDefault: '#0a0a0a',
  cityStrokeSelected: '#ffd700',
  cityStrokeMine: '#e8d48b',
  cityNameMine: '#ffe9a8',
  cityNameOther: '#fff8e7',
  unitText: '#fff',
  shadow: '#000',
  factionFallback: '#666',
} as const;

export type MapTokenKey = keyof typeof MAP_TOKENS;