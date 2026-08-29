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

/**
 * 六角战术层（BattleView）与郡域沙盘（BattlefieldSceneView）裸 hex 集中收口（批次① · Session 407）。
 * 当前值与历史内联值逐一等价（零视觉改动）；`ArtDirection.md` §七「水墨浊色」换肤属批次④，
 * 届时只改本文件即可整体换肤。CSS 容器底色的 Tailwind 任意值类（bg-[#…]）由批次② StonePanel 收口。
 */
export const BATTLE_TOKENS = {
  // BattleView 六角
  battleBackground: '#1b1d17',
  terrainPlain: '#8B8B6A',
  terrainForest: '#4A5A44',
  terrainWater: '#4A5E6A',
  terrainMountain: '#6A5F4C',
  terrainSwamp: '#5A5A44',
  terrainWall: '#7A6A58',
  terrainCity: '#8A7A62',
  terrainUnknown: '#6A655A',
  moveFill: '#3E5A5E', // §七 移动范围墨青
  moveStroke: '#2E4A4E',
  hexStroke: '#2a3020',
  unitAttacker: '#E8DCC0', // 旗帜形：攻方纸面
  unitDefender: '#D6C9AC', // 旗帜形：守方纸面
  unitSelected: '#D7AA62', // §七 选中金印描边
  unitStroke: '#111',
  unitText: '#fff',
  attackRing: '#A61919', // §七 可攻击朱砂描边
  // BattlefieldSceneView 郡域 SVG 沙盘
  sceneRiver: '#487d92',
  sceneRoad: '#806a3f',
  sceneFog: '#141a14',
  sceneWar: '#a21d24',
  sceneOwned: '#2d5a2d',
  sceneFirstBatch: '#5a4a2a',
  sceneDefault: '#3a3a32',
  sceneFogStroke: '#000',
  sceneSeat: '#ffd700',
  sceneOwnedStroke: '#4a8a4a',
  sceneNodeStroke: '#111',
  sceneFogText: '#4a554a',
  sceneOwnedText: '#8aff8a',
  sceneText: '#cfc0a0',
  flagText: '#2A2320',
  flagSeal: '#7A2820',
  flagEdgeA: '#A61919',
  flagEdgeD: '#3F3A32',
  hpBack: '#3A352C',
  hpFill: '#D7AA62',
  sceneGarrisonText: '#5a6a5a',
  // 批次②：战场容器底色（原 Tailwind 任意值类 bg-[#…] 收口）
  sceneShell: '#171b14',
  sceneHeader: 'rgba(23, 23, 16, 0.9)',
  sceneField: '#22261b',
  meleeMapPanel: '#292116',
  panelShell: '#15120d',
  panelHeader: 'rgba(33, 26, 17, 0.95)',
} as const;

export type BattleTokenKey = keyof typeof BATTLE_TOKENS;