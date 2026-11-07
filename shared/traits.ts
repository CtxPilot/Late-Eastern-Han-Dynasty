// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 武将特性系统真源与属性天花板引擎 — docs/04-game-systems.md §26 & §27
 * 路线图 P5-15：42 项特性 × 5 级、5 大类别与关联属性天花板计算
 */
import { CeilingAttribute } from './enums/index.js';
import type { Officer } from './types/officer.js';
import {
  CEILING_HOLDERS,
  SECOND_TIER_FLOOR,
  EFFECTIVE_STAT_HARD_CAP,
} from './ceiling.js';
import { meritStatBonus } from './stamina.js';

export enum TraitCategory {
  STRATEGY = 'strategy',       // 战略（统率）
  TACTICS = 'tactics',         // 战术（智谋）
  COMBAT = 'combat',           // 战斗（武力）
  CIVIL = 'civil',             // 内政（政治）
  PERSONALITY = 'personality', // 人格（魅力）
}

export interface TraitDef {
  id: string;
  name: string;
  category: TraitCategory;
  attribute: CeilingAttribute;
  description: string;
  levels: [string, string, string, string, string]; // Lv1~5 描述
}

export const TRAITS: readonly TraitDef[] = [
  // --- 战略 (8项, 统率 leadership) ---
  {
    id: 'logistics',
    name: '后勤',
    category: TraitCategory.STRATEGY,
    attribute: CeilingAttribute.LEADERSHIP,
    description: '行军辎重与粮道管理，降低部队粮耗与运输损耗',
    levels: [
      '粮耗 -5%',
      '粮耗 -10%',
      '粮耗 -15%',
      '粮耗 -20%',
      '粮耗 -30%，运输损耗 -20%',
    ],
  },
  {
    id: 'readiness',
    name: '整备',
    category: TraitCategory.STRATEGY,
    attribute: CeilingAttribute.LEADERSHIP,
    description: '兵士整饬与动员编制，提升征兵速度与新兵品质',
    levels: [
      '征兵速度 +10%',
      '征兵速度 +18%',
      '征兵速度 +25%',
      '征兵速度 +32%',
      '征兵速度 +40%，初入伍兵质 +1',
    ],
  },
  {
    id: 'foresight',
    name: '远虑',
    category: TraitCategory.STRATEGY,
    attribute: CeilingAttribute.LEADERSHIP,
    description: '洞察天下大势与邦交走势，提升外交成功率与预见力',
    levels: [
      '外交成功率 +5%',
      '外交成功率 +8%',
      '外交成功率 +12%',
      '外交成功率 +16%',
      '外交成功率 +20%，可预知一季外交变化',
    ],
  },
  {
    id: 'garrison',
    name: '镇守',
    category: TraitCategory.STRATEGY,
    attribute: CeilingAttribute.LEADERSHIP,
    description: '据城固守与防线整饬，强化守城防御与反击',
    levels: [
      '守城防御 +5%，守城反击率 +10%',
      '守城防御 +10%，守城反击率 +15%',
      '守城防御 +15%，守城反击率 +20%',
      '守城防御 +22%，守城反击率 +30%',
      '守城防御 +30%，守城反击率 +40%，城墙修复速度 ×2',
    ],
  },
  {
    id: 'supervise',
    name: '督战',
    category: TraitCategory.STRATEGY,
    attribute: CeilingAttribute.LEADERSHIP,
    description: '三军整饬与军纪严明，维系部队士气并激发暴击潜能',
    levels: [
      '部队士气 +2/季，士气≥80 暴击率 +3%',
      '部队士气 +3/季，士气≥80 暴击率 +4%',
      '部队士气 +5/季，士气≥80 暴击率 +6%',
      '部队士气 +7/季，士气≥80 暴击率 +8%',
      '士气永不低于 60，全军士气 +5，士气≥80 暴击率 +10%',
    ],
  },
  {
    id: 'raid',
    name: '奇袭',
    category: TraitCategory.STRATEGY,
    attribute: CeilingAttribute.LEADERSHIP,
    description: '兵贵神速出其不意，急行军机动力提升与首回合连击爆发',
    levels: [
      '急行军机动 +2，首回合连击率 +15%',
      '急行军机动 +3，首回合连击率 +20%',
      '急行军机动 +4，首回合连击率 +30%',
      '急行军机动 +5，首回合连击率 +40%',
      '急行军机动 +6，首回合连击率 +50%，敌军首回合无法反应',
    ],
  },
  {
    id: 'planning',
    name: '布划',
    category: TraitCategory.STRATEGY,
    attribute: CeilingAttribute.LEADERSHIP,
    description: '战场变阵随心所欲，削减变阵消耗并联动连击反击',
    levels: [
      '阵型切换消耗 -30%，切阵后首回合连击 +10%、反击 +20%',
      '阵型切换消耗 -45%，切阵后首回合连击 +15%、反击 +30%',
      '阵型切换消耗 -60%，切阵后首回合连击 +20%、反击 +40%',
      '阵型切换消耗 -75%，切阵后首回合连击 +25%、反击 +50%',
      '阵型切换免费，切阵后全属性 +1，连击 +30%、反击 +60%',
    ],
  },
  {
    id: 'supply',
    name: '兵站',
    category: TraitCategory.STRATEGY,
    attribute: CeilingAttribute.LEADERSHIP,
    description: '兵站节点与转运网络，削减粮道途耗并提升运粮队移速',
    levels: [
      '粮道损耗 -10%',
      '粮道损耗 -20%',
      '粮道损耗 -30%',
      '粮道损耗 -40%',
      '粮道损耗 -50%，运粮队移动 +2',
    ],
  },

  // --- 战术 (9项, 智谋 intelligence) ---
  {
    id: 'cunning',
    name: '诡计',
    category: TraitCategory.TACTICS,
    attribute: CeilingAttribute.INTELLIGENCE,
    description: '算无遗策与奇谋暗伏，提升计策成功率与计策暴击',
    levels: [
      '计策成功率 +5%，计策暴击率 +5%',
      '计策成功率 +8%，计策暴击率 +8%',
      '计策成功率 +12%，计策暴击率 +12%',
      '计策成功率 +16%，计策暴击率 +16%',
      '计策成功率 +20%，识破敌方计策 +15%，计策暴击率 +20%',
    ],
  },
  {
    id: 'ambush',
    name: '伏兵',
    category: TraitCategory.TACTICS,
    attribute: CeilingAttribute.INTELLIGENCE,
    description: '隐蔽伏击以逸待劳，提高伏兵伤害并在现身时致命打击',
    levels: [
      '伏兵伤害 +10%',
      '伏兵伤害 +18%',
      '伏兵伤害 +25%',
      '伏兵伤害 +32%',
      '伏兵伤害 +40%，出伏攻击必定暴击',
    ],
  },
  {
    id: 'lure',
    name: '诱敌',
    category: TraitCategory.TACTICS,
    attribute: CeilingAttribute.INTELLIGENCE,
    description: '示弱诱敌步步为营，提高诱敌成功率与陷阱困敌回合',
    levels: [
      '诱敌成功率 +10%',
      '诱敌成功率 +18%',
      '诱敌成功率 +25%',
      '诱敌成功率 +32%',
      '诱敌成功率 +40%，诱入陷阱额外困敌 1 回合',
    ],
  },
  {
    id: 'formation_break',
    name: '破阵',
    category: TraitCategory.TACTICS,
    attribute: CeilingAttribute.INTELLIGENCE,
    description: '观敌之隙破其阵脚，针对特定阵型增伤并在破阵后击溃敌军态势',
    levels: [
      '对特定阵型伤害 +10%，破阵后暴击率 +10%',
      '对特定阵型伤害 +18%，破阵后暴击率 +15%',
      '对特定阵型伤害 +25%，破阵后暴击率 +20%',
      '对特定阵型伤害 +32%，破阵后暴击率 +25%',
      '对特定阵型伤害 +40%，破阵后敌军混乱且暴击率 +30%（持续 2 回合）',
    ],
  },
  {
    id: 'fire_attack',
    name: '火攻',
    category: TraitCategory.TACTICS,
    attribute: CeilingAttribute.INTELLIGENCE,
    description: '因风施火烈焰焚营，强化火计伤害与火势蔓延',
    levels: [
      '火计伤害 +10%',
      '火计伤害 +18%',
      '火计伤害 +25%',
      '火计伤害 +32%',
      '火计伤害 +40%，火势蔓延率 +20%',
    ],
  },
  {
    id: 'water_combat',
    name: '水战',
    category: TraitCategory.TACTICS,
    attribute: CeilingAttribute.INTELLIGENCE,
    description: '通晓水势善操舟师，提升水面作战攻击力与暴击率',
    levels: [
      '水面攻击 +10%，水面暴击率 +5%',
      '水面攻击 +18%，水面暴击率 +8%',
      '水面攻击 +25%，水面暴击率 +12%',
      '水面攻击 +32%，水面暴击率 +16%',
      '水面攻击 +40%，水面暴击率 +20%，水上机动力不减',
    ],
  },
  {
    id: 'night_combat',
    name: '夜战',
    category: TraitCategory.TACTICS,
    attribute: CeilingAttribute.INTELLIGENCE,
    description: '夜幕掩护奇袭暗战，免除夜间惩罚并大幅强化夜间连击暴击',
    levels: [
      '夜间属性不减，夜间暴击率 +5%，连击率 +5%',
      '夜间攻击 +5%，夜间暴击率 +8%，连击率 +8%',
      '夜间攻击 +10%，夜间暴击率 +12%，连击率 +12%',
      '夜间攻击 +15%，夜间暴击率 +16%，连击率 +16%',
      '夜间攻击 +20%，敌军受夜战惩罚，夜间暴击 +20%，连击 +20%',
    ],
  },
  {
    id: 'surprise_stratagem',
    name: '奇策',
    category: TraitCategory.TACTICS,
    attribute: CeilingAttribute.INTELLIGENCE,
    description: '奇谋迭出层出不穷，增加单场战斗内可释放计策次数',
    levels: [
      '战斗可用计策次数 +1',
      '战斗可用计策次数 +1',
      '战斗可用计策次数 +1',
      '战斗可用计策次数 +2',
      '战斗可用计策次数 +2（达上限）',
    ],
  },
  {
    id: 'insight',
    name: '虚实',
    category: TraitCategory.TACTICS,
    attribute: CeilingAttribute.INTELLIGENCE,
    description: '明察秋毫洞悉诡计，提升识破敌方计策概率并在识破后反噬敌军',
    levels: [
      '识破敌计 +10%，识破后本回合暴击率 +10%',
      '识破敌计 +18%，识破后本回合暴击率 +15%',
      '识破敌计 +25%，识破后本回合暴击率 +20%',
      '识破敌计 +32%，识破后本回合暴击率 +25%',
      '识破敌计 +40%，识破后反噬敌军且本回合暴击率 +30%',
    ],
  },

  // --- 战斗 (10项, 武力 war) ---
  {
    id: 'bravery',
    name: '豪勇',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '万夫不当单骑陷阵，强化单挑能力与暴击、反击、连击联动',
    levels: [
      '单挑胜率 +5%，单挑暴击 +5%，连击 +5%，反击 +10%',
      '单挑胜率 +10%，单挑暴击 +10%，连击 +10%，反击 +15%',
      '单挑胜率 +15%，单挑暴击 +15%，连击 +15%，反击 +20%',
      '单挑胜率 +22%，单挑暴击 +22%，连击 +20%，反击 +30%',
      '单挑胜率 +30%，首回合必定暴击，单挑暴击 +30%，连击 +25%，反击 +40%',
    ],
  },
  {
    id: 'dash',
    name: '猛进',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '铁骑破阵锋芒毕露，提升骑兵冲锋伤害、冲锋暴击与冲锋连击',
    levels: [
      '骑兵冲锋伤害 +10%，冲锋暴击率 +10%，冲锋后连击率 +10%',
      '骑兵冲锋伤害 +18%，冲锋暴击率 +18%，冲锋后连击率 +18%',
      '骑兵冲锋伤害 +25%，冲锋暴击率 +25%，冲锋后连击率 +25%',
      '骑兵冲锋伤害 +32%，冲锋暴击率 +32%，冲锋后连击率 +32%',
      '骑兵冲锋伤害 +40%，冲锋暴击 +40%，连击 +40%，冲锋后可二次行动',
    ],
  },
  {
    id: 'iron_wall',
    name: '铁壁',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '不动如山固若金汤，受击时防御提升、反击率增加并反击强化',
    levels: [
      '被攻击防御 +5%，反击率 +5%，反击伤害 +3%，被暴伤 -5%',
      '被攻击防御 +10%，反击率 +10%，反击伤害 +6%，被暴伤 -8%',
      '被攻击防御 +15%，反击率 +15%，反击伤害 +9%，被暴伤 -12%',
      '被攻击防御 +22%，反击率 +20%，反击伤害 +12%，被暴伤 -16%',
      '被攻击防御 +30%，反击率 +25%，反击伤害 +15%，被暴伤 -20%',
    ],
  },
  {
    id: 'siege_lead',
    name: '先登',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '蚁附先登直取坚城，大幅提升攻城伤害、攻城暴击与攻城连击',
    levels: [
      '攻城伤害 +10%，攻城暴击率 +10%，攻城连击率 +10%',
      '攻城伤害 +18%，攻城暴击率 +18%，攻城连击率 +15%',
      '攻城伤害 +25%，攻城暴击率 +25%，攻城连击率 +20%',
      '攻城伤害 +32%，攻城暴击率 +32%，攻城连击率 +25%',
      '攻城伤害 +40%，破门必定暴击，攻城暴击 +40%，连击 +30%',
    ],
  },
  {
    id: 'rear_guard',
    name: '殿军',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '从容断后死守生门，削减撤退损耗并在敌军追击时反噬敌兵',
    levels: [
      '撤退损失 -10%',
      '撤退损失 -20%',
      '撤退无损耗',
      '撤退无损耗，受追击伤害 -50%',
      '撤退无损耗，对追击敌军反向反击伤害',
    ],
  },
  {
    id: 'melee_fight',
    name: '乱战',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '身陷重围遇强则强，被围攻时化劣势为战意，全面爆发暴击反击',
    levels: [
      '被围攻击惩罚减半，被围每多1敌暴击+3%、反击+3%、连击+3%',
      '被围惩罚免除，被围每多1敌暴击+6%、反击+6%、连击+6%',
      '被围攻击反 +5%，被围每多1敌暴击+9%、反击+9%、连击+9%',
      '被围攻击反 +10%，被围每多1敌暴击+12%、反击+12%、连击+12%',
      '被围攻击不降反升 +15%，被围每多1敌暴击+15%、反击+15%、连击+15%（上限3敌）',
    ],
  },
  {
    id: 'cavalry_combat',
    name: '骑战',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '人马一体纵横驰骋，减免复杂地形对骑兵的惩罚并强化骑兵连击',
    levels: [
      '骑兵山林地形惩罚 -1，骑兵连击率 +5%',
      '骑兵山林地形惩罚 -2，骑兵连击率 +8%',
      '骑兵山林地形惩罚 -3，骑兵连击率 +12%',
      '骑兵山林地形惩罚 -4，骑兵连击率 +16%',
      '全地形骑兵战斗力不减，骑兵连击率 +20%（无视地形衰减）',
    ],
  },
  {
    id: 'archery',
    name: '弓术',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '百步穿杨弦无虚发，提升远程弓弩部队暴击率并在高阶实现移动后射击',
    levels: [
      '弓兵暴击率 +5%',
      '弓兵暴击率 +8%',
      '弓兵暴击率 +12%',
      '弓兵暴击率 +16%',
      '弓兵暴击率 +20%，移动后仍可远射',
    ],
  },
  {
    id: 'might',
    name: '刚力',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '拔山盖世刚猛沉雄，大幅提高暴击伤害倍率与反击暴击率',
    levels: [
      '暴击伤害 +10%，反击暴击率 +5%',
      '暴击伤害 +18%，反击暴击率 +10%',
      '暴击伤害 +25%，反击暴击率 +15%',
      '暴击伤害 +32%，反击暴击率 +20%',
      '暴击伤害 +40%，反击暴击率 +25%',
    ],
  },
  {
    id: 'continuous_strike',
    name: '连战',
    category: TraitCategory.COMBAT,
    attribute: CeilingAttribute.WAR,
    description: '气贯长虹锐不可当，提升连击率并在连续击破敌军后进入战意狂暴',
    levels: [
      '连击率 +5%，击破 3 队后攻击 +20%',
      '连击率 +10%，击破 3 队后攻击 +25%',
      '连击率 +15%，击破 3 队后攻击 +30%',
      '连击率 +20%，击破 2 队后攻击 +40%',
      '连击率 +25%，击破 2 队后攻击 +50% 且下回合必定连击（持续 2 回合）',
    ],
  },

  // --- 内政 (9项, 政治 politics) ---
  {
    id: 'diligent',
    name: '能吏',
    category: TraitCategory.CIVIL,
    attribute: CeilingAttribute.POLITICS,
    description: '案牍无壅奉公尽瘁，大幅提高城池内政开发效率',
    levels: [
      '开发效率 +10%',
      '开发效率 +18%',
      '开发效率 +25%',
      '开发效率 +32%',
      '开发效率 +40%，可同时主持 2 项城池开发',
    ],
  },
  {
    id: 'commerce',
    name: '商才',
    category: TraitCategory.CIVIL,
    attribute: CeilingAttribute.POLITICS,
    description: '通商惠工货殖财阜，提高城池商业税收并缩减买卖差价',
    levels: [
      '商业收入 +5%',
      '商业收入 +10%',
      '商业收入 +15%',
      '商业收入 +22%',
      '商业收入 +30%，买卖物资差价 -20%',
    ],
  },
  {
    id: 'farming',
    name: '屯田',
    category: TraitCategory.CIVIL,
    attribute: CeilingAttribute.POLITICS,
    description: '劝课农桑积谷防饥，提高城池粮食产出并在荒年保收',
    levels: [
      '粮食产出 +10%',
      '粮食产出 +18%',
      '粮食产出 +25%',
      '粮食产出 +32%',
      '粮食产出 +40%，灾年不减收',
    ],
  },
  {
    id: 'hydrology',
    name: '水利',
    category: TraitCategory.CIVIL,
    attribute: CeilingAttribute.POLITICS,
    description: '导江理水防患未然，降低乃至免疫水灾并以洪水御敌',
    levels: [
      '水灾损失 -50%',
      '水灾损失 -75%',
      '免疫水灾',
      '免疫水灾，水利设施效率 +20%',
      '免疫水灾，暴涨洪水反向对敌军造成损耗',
    ],
  },
  {
    id: 'education',
    name: '教化',
    category: TraitCategory.CIVIL,
    attribute: CeilingAttribute.POLITICS,
    description: '设庠序施德教，加速领内文化增长并吸引四方贤才投奔',
    levels: [
      '文化增长 +15%/季',
      '文化增长 +22%/季',
      '文化增长 +30%/季',
      '文化增长 +40%/季',
      '文化增长 +50%/季，在野人才投奔率 +5%',
    ],
  },
  {
    id: 'medicine',
    name: '医术',
    category: TraitCategory.CIVIL,
    attribute: CeilingAttribute.POLITICS,
    description: '悬壶济世调理营卫，提升伤兵治愈速度并免疫时疫侵害',
    levels: [
      '伤兵恢复 +5%/季',
      '伤兵恢复 +10%/季',
      '伤兵恢复 +15%/季',
      '伤兵恢复 +20%/季',
      '伤兵恢复 +25%/季，所在城池免疫瘟疫',
    ],
  },
  {
    id: 'prestige',
    name: '人望',
    category: TraitCategory.CIVIL,
    attribute: CeilingAttribute.POLITICS,
    description: '名重士林天下归心，提高在野人才出仕与相邻城投奔概率',
    levels: [
      '在野人才投奔率 +3%',
      '在野人才投奔率 +5%',
      '在野人才投奔率 +8%',
      '在野人才投奔率 +11%',
      '在野人才投奔率 +15%，相邻城池在野贤才亦来投奔',
    ],
  },
  {
    id: 'inspection',
    name: '监察',
    category: TraitCategory.CIVIL,
    attribute: CeilingAttribute.POLITICS,
    description: '整肃风纪防微杜渐，大幅抑制民变叛乱并破获敌国细作',
    levels: [
      '城池叛乱率 -30%',
      '城池叛乱率 -45%',
      '城池叛乱率 -60%',
      '城池叛乱率 -75%',
      '免疫民变叛乱，破获敌方间谍概率 +20%',
    ],
  },
  {
    id: 'fortification',
    name: '筑城',
    category: TraitCategory.CIVIL,
    attribute: CeilingAttribute.POLITICS,
    description: '版筑固城深沟高垒，缩短防御工事工期并减少城防维保',
    levels: [
      '建筑工期 -10%',
      '建筑工期 -18%',
      '建筑工期 -25%',
      '建筑工期 -32%',
      '建筑工期 -40%，城墙维护费 -50%',
    ],
  },

  // --- 人格 (6项, 魅力 charisma) ---
  {
    id: 'benevolence',
    name: '仁德',
    category: TraitCategory.PERSONALITY,
    attribute: CeilingAttribute.CHARISMA,
    description: '仁者爱民恩泽黎庶，持续滋养辖区民心并促进人口繁衍',
    levels: [
      '所在城民心 +1/季',
      '所在城民心 +2/季',
      '所在城民心 +3/季',
      '所在城民心 +4/季',
      '所在城民心 +5/季，领内人口增长率 +2%',
    ],
  },
  {
    id: 'dignity',
    name: '威严',
    category: TraitCategory.PERSONALITY,
    attribute: CeilingAttribute.CHARISMA,
    description: '威重沉穆令行禁止，延缓部将忠诚衰减并在惩处时免受怨望',
    levels: [
      '部下忠诚降速 -10%',
      '部下忠诚降速 -18%',
      '部下忠诚降速 -25%',
      '部下忠诚降速 -32%',
      '部下忠诚降速 -40%，惩处部将不降低忠诚度',
    ],
  },
  {
    id: 'bodyguard',
    name: '护卫',
    category: TraitCategory.PERSONALITY,
    attribute: CeilingAttribute.CHARISMA,
    description: '忠贞死义肉盾保全，大幅减免同部队主将所受负伤甚至免伤',
    levels: [
      '同部队主将受伤率 -20%',
      '同部队主将受伤率 -35%',
      '同部队主将受伤率 -50%',
      '同部队主将受伤率 -70%',
      '主将免疫阵上负伤，自身防御 +20%',
    ],
  },
  {
    id: 'calm',
    name: '沉着',
    category: TraitCategory.PERSONALITY,
    attribute: CeilingAttribute.CHARISMA,
    description: '泰山崩前神色自若，免疫挑衅混乱并在异常状态下坚守反击',
    levels: [
      '免疫挑衅与混乱概率 +30%',
      '免疫挑衅与混乱概率 +45%',
      '免疫挑衅与混乱概率 +60%，混乱状态下仍保有反击能力',
      '免疫挑衅与混乱概率 +75%，混乱状态下仍保有反击能力',
      '免疫所有挑衅、混乱及异常状态，始终保有反击能力',
    ],
  },
  {
    id: 'greedy',
    name: '贪财',
    category: TraitCategory.PERSONALITY,
    attribute: CeilingAttribute.CHARISMA,
    description: '重利轻生金帛动心，金帛赏赐效果翻倍但更易受敌离间',
    levels: [
      '赏赐满意度 +30%',
      '赏赐满意度 +45%',
      '赏赐满意度 +60%',
      '赏赐满意度 +80%',
      '赏赐满意度 +100%（但被敌方收买概率 +20%）',
    ],
  },
  {
    id: 'wrath',
    name: '易怒',
    category: TraitCategory.PERSONALITY,
    attribute: CeilingAttribute.CHARISMA,
    description: '性烈如火受辱必战，受挑衅必应战但化怒为杀伐暴击',
    levels: [
      '受敌挑衅必应战出击',
      '受敌挑衅必出击，首回合攻击 +10%',
      '受敌挑衅必出击，暴击率 +15%',
      '受敌挑衅必出击，暴击率 +20%',
      '受挑衅出击首回合必定暴击，暴击率 +30%（持续 2 回合）',
    ],
  },
];

export const TRAIT_MAP: Readonly<Record<string, TraitDef>> = Object.freeze(
  Object.fromEntries(TRAITS.map((t) => [t.id, t])),
);

/**
 * 计算武将某维有效属性（docs/04 §27.2）：
 * 包含：裸属性 + 天花板隐藏断层加成 + 功绩属性加成 + 装备加成，截断于 EFFECTIVE_STAT_HARD_CAP(255)。
 */
export function getEffectiveStat(
  officer: Officer,
  attribute: CeilingAttribute,
  equipBonus = 0,
): number {
  const bare = officer.stats?.[attribute] ?? 0;
  const cb = officer.hidden?.ceilingBonus;
  let ceiling = 0;
  if (cb && cb.attribute === attribute) {
    ceiling = cb.hiddenBonus;
  } else if (officer.name === CEILING_HOLDERS[attribute]?.name) {
    ceiling = CEILING_HOLDERS[attribute].hiddenBonus;
  }
  const merit = meritStatBonus(officer, attribute);
  const total = bare + ceiling + merit + equipBonus;
  return Math.max(0, Math.min(EFFECTIVE_STAT_HARD_CAP, Math.floor(total)));
}

/**
 * 获取升至 targetLevel 时对对应属性的最低要求（docs/30 §5.3）：
 * Lv1: 0 (无)
 * Lv2: 60
 * Lv3: 80
 * Lv4: 90
 * Lv5: 武力 97 / 其余维 99
 */
export function getTraitRequiredStat(
  targetLevel: number,
  attribute: CeilingAttribute,
): number {
  switch (targetLevel) {
    case 1:
      return 0;
    case 2:
      return 60;
    case 3:
      return 80;
    case 4:
      return 90;
    case 5:
      return SECOND_TIER_FLOOR[attribute] ?? 97;
    default:
      return 0;
  }
}

/**
 * 根据武将某维有效属性计算允许达到的特性天花板等级（1~5 级）：
 */
export function getTraitCeilingLevel(
  effectiveStat: number,
  attribute: CeilingAttribute,
): number {
  const lv5Req = SECOND_TIER_FLOOR[attribute] ?? 97;
  if (effectiveStat >= lv5Req) return 5;
  if (effectiveStat >= 90) return 4;
  if (effectiveStat >= 80) return 3;
  if (effectiveStat >= 60) return 2;
  return 1;
}

/**
 * 获取武将当前特定特性的等级（0 表示未拥有）
 */
export function getOfficerTraitLevel(
  officer: { traitLevels?: Record<string, number> },
  traitId: string,
): number {
  return officer.traitLevels?.[traitId] ?? 0;
}
