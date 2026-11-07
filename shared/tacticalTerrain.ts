// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { TerrainType } from './enums/index.js';

export interface TacticalTerrainInfo {
  type: TerrainType;
  name: string;
  moveCost: number;
  attackMod: number; // e.g. -0.1
  defenseMod: number; // e.g. 0.2
  title: string;
  description: string;
  tacticalTip: string;
}

export const TACTICAL_TERRAIN_INFO: Record<TerrainType, TacticalTerrainInfo> = {
  [TerrainType.PLAIN]: {
    type: TerrainType.PLAIN,
    name: '平原',
    moveCost: 1,
    attackMod: 0,
    defenseMod: 0,
    title: '开阔旷野',
    description: '地势平坦坦荡，行军通畅无阻。',
    tacticalTip: '大军团展开阵型基准，骑兵在此可发动冲锋造成额外伤害。',
  },
  [TerrainType.FOREST]: {
    type: TerrainType.FOREST,
    name: '林地',
    moveCost: 2,
    attackMod: -0.1,
    defenseMod: 0.2,
    title: '茂密丛林',
    description: '林木幽深，草木蔽日，视野受限。',
    tacticalTip: '步兵隐蔽防御+20%；骑兵移动力减半且冲锋失效；极易受火计延烧。',
  },
  [TerrainType.MOUNTAIN]: {
    type: TerrainType.MOUNTAIN,
    name: '山地',
    moveCost: 3,
    attackMod: -0.2,
    defenseMod: 0.3,
    title: '险峻重峦',
    description: '奇峰突起，岩石嶙峋，攀援维艰。',
    tacticalTip: '居高临下防御+30%，视野+1格；攀爬消耗3点移动力，骑兵难行。',
  },
  [TerrainType.WATER]: {
    type: TerrainType.WATER,
    name: '水域',
    moveCost: 4,
    attackMod: -0.3,
    defenseMod: -0.2,
    title: '汪洋江泽',
    description: '波涛滚滚，水网纵横，非舟楫莫渡。',
    tacticalTip: '陆上部队涉水攻防大降，易遭迟滞；水军在此发挥全额战力，火攻减弱。',
  },
  [TerrainType.SWAMP]: {
    type: TerrainType.SWAMP,
    name: '沼泽',
    moveCost: 3,
    attackMod: -0.15,
    defenseMod: -0.1,
    title: '泥泞沼洼',
    description: '烂泥深陷，芦苇丛生，步履蹒跚。',
    tacticalTip: '部队行进迟滞，攻防皆有折损；若遭伏兵水攻易陷万劫不复。',
  },
  [TerrainType.WALL]: {
    type: TerrainType.WALL,
    name: '城垣',
    moveCost: 99,
    attackMod: -0.3,
    defenseMod: 0.4,
    title: '高耸壁垒',
    description: '夯土砖石砌就之御敌要塞。',
    tacticalTip: '常规陆军无法翻越；墙堞之上弓弩居高俯射，防御+40%。',
  },
  [TerrainType.CITY]: {
    type: TerrainType.CITY,
    name: '城塞',
    moveCost: 99,
    attackMod: -0.2,
    defenseMod: 0.5,
    title: '坚固城坊',
    description: '郡治军塞核心，楼橹森严。',
    tacticalTip: '守军依托城池据守防御+50%，士气稳固；须使用冲车投石等攻城器械。',
  },
};

export function getTacticalTerrainInfo(type: TerrainType | string): TacticalTerrainInfo {
  return (
    TACTICAL_TERRAIN_INFO[type as TerrainType] ?? {
      type: TerrainType.PLAIN,
      name: '未知',
      moveCost: 1,
      attackMod: 0,
      defenseMod: 0,
      title: '未知地貌',
      description: '未勘明之地势。',
      tacticalTip: '按平原一般规则处置。',
    }
  );
}
