// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 技艺与制度研发系统（Craft & Institutions R&D）。
 *
 * 依据 docs/04 §34.6 与 docs/08-data-dictionary.md。
 * 五大路线：农政（farming）、工商（commerce）、军备（military）、城防（fortification）、教化（cultivation）。
 */
import type { ActiveResearch, TechBranch, TechLevels } from './types/faction.js';
import { CULTURE_TECH_LEVEL_THRESHOLDS } from './culture.js';

export const TECH_BRANCHES: TechBranch[] = [
  'farming',
  'commerce',
  'military',
  'fortification',
  'cultivation',
];

export const TECH_CULTURE_THRESHOLDS = CULTURE_TECH_LEVEL_THRESHOLDS; // [100, 250, 500, 700, 900]
export const TECH_GOLD_COSTS = [200, 400, 800, 1600, 3200] as const;
export const TECH_MONTHS = [2, 4, 6, 8, 12] as const;

export const DEFAULT_TECH_LEVELS: Readonly<TechLevels> = {
  farming: 0,
  commerce: 0,
  military: 0,
  fortification: 0,
  cultivation: 0,
};

export interface TechTierInfo {
  level: number;
  name: string;
  effect: string;
  cultureThreshold: number;
  goldCost: number;
  months: number;
}

export interface TechBranchOption {
  branch: TechBranch;
  name: string;
  description: string;
  currentLevel: number;
  maxLevel: number;
  nextTier: TechTierInfo | null;
  culturePassed: boolean;
  highestCulture: number;
  goldPassed: boolean;
  initialGoldCost: number;
  canResearch: boolean;
}

export interface AvailableTechResearchResult {
  factionId: number;
  branches: Record<TechBranch, TechBranchOption>;
  activeResearch: ActiveResearch | null;
  highestCulture: number;
  factionGold: number;
  hasActiveResearch: boolean;
  eligibleOfficers: { id: number; name: string; intelligence: number; politics: number }[];
}

export interface TechBranchConfig {
  branch: TechBranch;
  name: string;
  description: string;
  tiers: TechTierInfo[];
}

export const TECH_BRANCH_CONFIGS: Record<TechBranch, TechBranchConfig> = {
  farming: {
    branch: 'farming',
    name: '农政',
    description: '重农抑末、兴修水利、精耕细作与备荒仓储',
    tiers: [
      {
        level: 1,
        name: '劝课农桑',
        effect: '农业产出 +10%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[0],
        goldCost: TECH_GOLD_COSTS[0],
        months: TECH_MONTHS[0],
      },
      {
        level: 2,
        name: '民屯并举',
        effect: '农业产出累积 +20%，民屯额外产粮 +20%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[1],
        goldCost: TECH_GOLD_COSTS[1],
        months: TECH_MONTHS[1],
      },
      {
        level: 3,
        name: '水利渠堰',
        effect: '农业产出累积 +30%，冬季与枯水月免减产',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[2],
        goldCost: TECH_GOLD_COSTS[2],
        months: TECH_MONTHS[2],
      },
      {
        level: 4,
        name: '常平备籴',
        effect: '领内城池与驻军月度粮耗 -10%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[3],
        goldCost: TECH_GOLD_COSTS[3],
        months: TECH_MONTHS[3],
      },
      {
        level: 5,
        name: '四野盈畴',
        effect: '农政大成：每年秋收（8月）领内全城粮食产出额外 +25%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[4],
        goldCost: TECH_GOLD_COSTS[4],
        months: TECH_MONTHS[4],
      },
    ],
  },
  commerce: {
    branch: 'commerce',
    name: '工商',
    description: '通商惠贾、百工铸冶、官营转运与度支泉府',
    tiers: [
      {
        level: 1,
        name: '商贾互市',
        effect: '商业产出 +10%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[0],
        goldCost: TECH_GOLD_COSTS[0],
        months: TECH_MONTHS[0],
      },
      {
        level: 2,
        name: '百工齐作',
        effect: '商业产出累积 +20%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[1],
        goldCost: TECH_GOLD_COSTS[1],
        months: TECH_MONTHS[1],
      },
      {
        level: 3,
        name: '均输平准',
        effect: '商业产出累积 +30%，每月商税增发 +10%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[2],
        goldCost: TECH_GOLD_COSTS[2],
        months: TECH_MONTHS[2],
      },
      {
        level: 4,
        name: '物阜民丰',
        effect: '内政开发与修筑项目金钱花费 -15%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[3],
        goldCost: TECH_GOLD_COSTS[3],
        months: TECH_MONTHS[3],
      },
      {
        level: 5,
        name: '富国富民',
        effect: '工商大成：全势力每月商税额外增发 +20% 金',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[4],
        goldCost: TECH_GOLD_COSTS[4],
        months: TECH_MONTHS[4],
      },
    ],
  },
  military: {
    branch: 'military',
    name: '军备',
    description: '甲兵精炼、行阵操演、良驹铁骑与克敌利器',
    tiers: [
      {
        level: 1,
        name: '兵甲缮治',
        effect: '征兵部队士气额外 +5',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[0],
        goldCost: TECH_GOLD_COSTS[0],
        months: TECH_MONTHS[0],
      },
      {
        level: 2,
        name: '部曲武经',
        effect: '训练部队经验与士气增益 +25%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[1],
        goldCost: TECH_GOLD_COSTS[1],
        months: TECH_MONTHS[1],
      },
      {
        level: 3,
        name: '锋镝列阵',
        effect: '六角战与战役全军攻击力 +5%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[2],
        goldCost: TECH_GOLD_COSTS[2],
        months: TECH_MONTHS[2],
      },
      {
        level: 4,
        name: '裹粮千里',
        effect: '出征部队行军粮耗 -15%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[3],
        goldCost: TECH_GOLD_COSTS[3],
        months: TECH_MONTHS[3],
      },
      {
        level: 5,
        name: '三军夺魄',
        effect: '军备大成：全军攻防综合 +10%，部队基础士气上限提升至 105',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[4],
        goldCost: TECH_GOLD_COSTS[4],
        months: TECH_MONTHS[4],
      },
    ],
  },
  fortification: {
    branch: 'fortification',
    name: '城防',
    description: '因险固城、深沟高垒、守城器械与焦土御寇',
    tiers: [
      {
        level: 1,
        name: '版筑固墉',
        effect: '城防开发完成进度 +20%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[0],
        goldCost: TECH_GOLD_COSTS[0],
        months: TECH_MONTHS[0],
      },
      {
        level: 2,
        name: '堞楼设机',
        effect: '守城部队防御力 +15%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[1],
        goldCost: TECH_GOLD_COSTS[1],
        months: TECH_MONTHS[1],
      },
      {
        level: 3,
        name: '铁壁深堑',
        effect: '城池初始城墙耐久与城门减伤 +20%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[2],
        goldCost: TECH_GOLD_COSTS[2],
        months: TECH_MONTHS[2],
      },
      {
        level: 4,
        name: '弩台锁钥',
        effect: '守城方远程射程 +1（守军弓弩射击纵深）',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[3],
        goldCost: TECH_GOLD_COSTS[3],
        months: TECH_MONTHS[3],
      },
      {
        level: 5,
        name: '固若金汤',
        effect: '金汤大成：敌方围城每月额外损耗 +25%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[4],
        goldCost: TECH_GOLD_COSTS[4],
        months: TECH_MONTHS[4],
      },
    ],
  },
  cultivation: {
    branch: 'cultivation',
    name: '教化',
    description: '崇儒重道、延揽贤达、整肃纲纪与修德来远',
    tiers: [
      {
        level: 1,
        name: '设学立教',
        effect: '武将每月经验获取 +20%',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[0],
        goldCost: TECH_GOLD_COSTS[0],
        months: TECH_MONTHS[0],
      },
      {
        level: 2,
        name: '招贤纳士',
        effect: '人才登用成功率额外 +5 百分点',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[1],
        goldCost: TECH_GOLD_COSTS[1],
        months: TECH_MONTHS[1],
      },
      {
        level: 3,
        name: '忠义敦笃',
        effect: '武将忠诚自然衰减完全豁免',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[2],
        goldCost: TECH_GOLD_COSTS[2],
        months: TECH_MONTHS[2],
      },
      {
        level: 4,
        name: '遐迩归心',
        effect: '势力声望（fame）每季自然衰减豁免',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[3],
        goldCost: TECH_GOLD_COSTS[3],
        months: TECH_MONTHS[3],
      },
      {
        level: 5,
        name: '化民成俗',
        effect: '教化大成：领内城池民心每月自动 +1',
        cultureThreshold: TECH_CULTURE_THRESHOLDS[4],
        goldCost: TECH_GOLD_COSTS[4],
        months: TECH_MONTHS[4],
      },
    ],
  },
};

export function getTechBranchConfig(branch: TechBranch): TechBranchConfig {
  return TECH_BRANCH_CONFIGS[branch];
}

export function getTechTierInfo(branch: TechBranch, level: number): TechTierInfo | null {
  const conf = TECH_BRANCH_CONFIGS[branch];
  if (!conf || level < 1 || level > conf.tiers.length) return null;
  return conf.tiers[level - 1];
}

export function getTechInitialGoldCost(branch: TechBranch, targetLevel: number): number {
  const tier = getTechTierInfo(branch, targetLevel);
  if (!tier) return 0;
  return Math.ceil(tier.goldCost / 3);
}

export function safeTechLevels(levels?: Partial<TechLevels> | null): TechLevels {
  return {
    farming: levels?.farming ?? 0,
    commerce: levels?.commerce ?? 0,
    military: levels?.military ?? 0,
    fortification: levels?.fortification ?? 0,
    cultivation: levels?.cultivation ?? 0,
  };
}
