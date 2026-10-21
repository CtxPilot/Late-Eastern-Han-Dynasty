// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { OfficerStats } from './types/common.js';
import type { ItemEffect, ItemStatic, Equipment } from './types/item.js';

/**
 * S13 装备与宝物系统 · 套装体系（L3 Set Tier）数据与纯函数
 * 依据：docs/04 §12.2、docs/49
 */

export interface ItemSetTier {
  count: number;
  statMultiplier?: number;
  bonusStats?: Partial<OfficerStats>;
  bonusEffects?: ItemEffect[];
  name: string;
  description: string;
}

export interface ItemSet {
  id: number;
  name: string;
  itemIds: number[];
  description: string;
  tiers: ItemSetTier[];
}

export interface ActiveSetResult {
  set: ItemSet;
  equippedCount: number;
  equippedItemIds: number[];
  activeTier: ItemSetTier | null;
  allTiers: {
    tier: ItemSetTier;
    active: boolean;
  }[];
}

/**
 * 十大经典史实/演义套装定义
 */
export const ITEM_SETS: readonly ItemSet[] = [
  {
    id: 1,
    name: '威震华夏',
    itemIds: [1, 10, 117], // 青龙偃月刀, 赤兔马, 假节钺
    description: '关云长所执名器坐骑与印节，汉寿亭侯威震江汉。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { war: 3 },
        bonusEffects: [{ type: 'charge_damage', value: 15, description: '【武圣神威】突击伤害+15%' }],
        name: '武圣神威',
        description: '突击伤害+15%，武力+3',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { leadership: 4 },
        bonusEffects: [
          { type: 'crit_rate', value: 10, description: '【威震华夏】暴击率+10%' },
          { type: 'duel_boost', value: 20, description: '单挑战意+20%' },
        ],
        name: '威震华夏',
        description: '暴击率+10%，单挑战意+20%，统率+4',
      },
    ],
  },
  {
    id: 2,
    name: '天下无双',
    itemIds: [2, 67, 73, 10], // 方天画戟, 兽面吞头连环铠, 三叉紫金冠, 赤兔马
    description: '人中吕布，马中赤兔。飞将临阵，睥睨群雄。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { war: 4 },
        bonusEffects: [{ type: 'crit_rate', value: 10, description: '【飞将暴威】暴击率+10%' }],
        name: '飞将暴威',
        description: '暴击率+10%，武力+4',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { war: 2 },
        bonusEffects: [
          { type: 'charge_damage', value: 20, description: '【陷阵无双】突击伤害+20%' },
          { type: 'defense', value: 15, description: '防御+15' },
        ],
        name: '陷阵无双',
        description: '突击伤害+20%，防御+15',
      },
      {
        count: 4,
        statMultiplier: 2.0,
        bonusStats: { war: 5, leadership: 5 },
        bonusEffects: [
          { type: 'armor_pierce', value: 20, description: '【虓虎绝伦】破甲伤害+20%' },
          { type: 'duel_boost', value: 30, description: '单挑战意+30%' },
        ],
        name: '虓虎绝伦',
        description: '破甲伤害+20%，单挑战意+30%，统武提升',
      },
    ],
  },
  {
    id: 3,
    name: '魏武雄风',
    itemIds: [4, 12, 14, 123], // 倚天剑, 绝影, 孟德新书, 锦袍金带
    description: '魏王曹孟德戎马一生之佩剑宝驹与兵法纶音。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { leadership: 3, intelligence: 3 },
        bonusEffects: [{ type: 'authority', value: 10, description: '【魏武之治】威信+10' }],
        name: '魏武之治',
        description: '统率+3，智谋+3，威信+10',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { leadership: 3 },
        bonusEffects: [{ type: 'recruit_bonus', value: 15, description: '【征辟唯才】募兵量+15%' }],
        name: '唯才是举',
        description: '募兵量+15%，统率+3',
      },
      {
        count: 4,
        statMultiplier: 2.0,
        bonusStats: { war: 4, leadership: 4, intelligence: 4 },
        bonusEffects: [{ type: 'tactic_power', value: 20, description: '【超世之杰】计谋战法威力+20%' }],
        name: '超世之杰',
        description: '计谋战法威力+20%，全能力大幅提升',
      },
    ],
  },
  {
    id: 4,
    name: '昭烈仁德',
    itemIds: [5, 11, 115], // 雌雄双股剑, 的卢, 玉带诏
    description: '汉昭烈帝刘玄德仁义播于海内，以德化民。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { charisma: 5 },
        bonusEffects: [{ type: 'defense', value: 10, description: '【仁德卫军】部队防御+10' }],
        name: '仁德卫军',
        description: '魅力+5，部队防御+10',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { leadership: 4, charisma: 5 },
        bonusEffects: [{ type: 'morale', value: 15, description: '【汉昭烈帝】部队初始士气+15' }],
        name: '皇叔仁义',
        description: '士气+15，统率+4，魅力+5',
      },
    ],
  },
  {
    id: 5,
    name: '卧龙天机',
    itemIds: [7, 13, 126, 127], // 诸葛连弩, 孙子兵法, 纶巾, 木牛流马
    description: '诸葛孔明运筹帷幄之羽扇纶巾、木牛流马与连弩天书。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { intelligence: 4, politics: 4 },
        bonusEffects: [{ type: 'tactic_power', value: 15, description: '【奇门遁甲】计谋威力+15%' }],
        name: '奇门遁甲',
        description: '智谋+4，政治+4，计策威力+15%',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { intelligence: 3 },
        bonusEffects: [
          { type: 'mobility', value: 1, description: '【木牛流马】机动力+1' },
          { type: 'range', value: 1, description: '【神臂连弩】远程射程+1' },
        ],
        name: '神机妙算',
        description: '射程+1，机动力+1，智谋+3',
      },
      {
        count: 4,
        statMultiplier: 2.0,
        bonusStats: { intelligence: 5, politics: 5 },
        bonusEffects: [{ type: 'recruit_bonus', value: 15, description: '【屯垦足食】募兵量+15%' }],
        name: '鞠躬尽瘁',
        description: '募兵量+15%，智谋+5，政治+5',
      },
    ],
  },
  {
    id: 6,
    name: '常胜龙胆',
    itemIds: [46, 68, 6], // 龙胆亮银枪, 白银铠, 宝雕弓
    description: '常山赵子龙银枪白铠，单骑救主，一身是胆。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { war: 3 },
        bonusEffects: [{ type: 'defense', value: 10, description: '【白马义从】防御+10' }],
        name: '龙胆不破',
        description: '防御+10，武力+3',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { war: 3, leadership: 3 },
        bonusEffects: [
          { type: 'crit_rate', value: 10, description: '【一身是胆】暴击率+10%' },
          { type: 'mobility', value: 1, description: '机动力+1' },
        ],
        name: '一身是胆',
        description: '暴击率+10%，机动力+1，统武+3',
      },
    ],
  },
  {
    id: 7,
    name: '江东霸业',
    itemIds: [22, 128, 51], // 古锭刀, 赤罽帻, 铁胎弓
    description: '江东猛虎孙破虏与小霸王孙伯符横扫六郡之传世戎装。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { war: 3, leadership: 3 },
        bonusEffects: [{ type: 'charge_damage', value: 15, description: '【小霸王】突击伤害+15%' }],
        name: '破虏雄烈',
        description: '突击伤害+15%，统武+3',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { war: 4 },
        bonusEffects: [{ type: 'crit_rate', value: 10, description: '【江东烈火】暴击率+10%' }],
        name: '江东霸业',
        description: '暴击率+10%，武力+4',
      },
    ],
  },
  {
    id: 8,
    name: '万人莫敌',
    itemIds: [3, 66, 79], // 丈八蛇矛, 锁子甲, 铁兜鍪
    description: '燕人张翼德据水断桥，厉声大喝，当阳退敌。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { war: 4 },
        bonusEffects: [{ type: 'charge_damage', value: 15, description: '【当阳怒吼】突击伤害+15%' }],
        name: '咆哮破阵',
        description: '突击伤害+15%，武力+4',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { war: 4 },
        bonusEffects: [{ type: 'duel_boost', value: 25, description: '【万人敌】单挑战意+25%' }],
        name: '万人莫敌',
        description: '单挑战意+25%，武力+4',
      },
    ],
  },
  {
    id: 9,
    name: '锦马银枪',
    itemIds: [47, 75, 70], // 虎头湛金枪, 红锦战袍, 熟铜盔
    description: '锦马超西凉雄烈，神威天将，突阵破围。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { war: 3 },
        bonusEffects: [{ type: 'mobility', value: 1, description: '【西凉铁骑】机动力+1' }],
        name: '西凉雄风',
        description: '机动力+1，武力+3',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { war: 4 },
        bonusEffects: [{ type: 'charge_damage', value: 25, description: '【神威天将军】突击伤害+25%' }],
        name: '神威天将',
        description: '突击伤害+25%，武力+4',
      },
    ],
  },
  {
    id: 10,
    name: '社稷正朔',
    itemIds: [15, 18, 120], // 传国玉玺, 兵符, 金印紫绶
    description: '受命于天，既寿永昌。汉统社稷之权威印玺与紫绶。',
    tiers: [
      {
        count: 2,
        statMultiplier: 1.2,
        bonusStats: { charisma: 5 },
        bonusEffects: [{ type: 'authority', value: 15, description: '【汉家符节】威信+15' }],
        name: '汉家符节',
        description: '威信+15，魅力+5',
      },
      {
        count: 3,
        statMultiplier: 1.5,
        bonusStats: { charisma: 5, leadership: 5 },
        bonusEffects: [{ type: 'authority', value: 20, description: '【受命于天】威信+20' }],
        name: '九五之尊',
        description: '威信+20，统率+5，魅力+5',
      },
    ],
  },
];

const setIndex = new Map<number, ItemSet>(ITEM_SETS.map((s) => [s.id, s]));

export function getItemSetById(id: number): ItemSet | undefined {
  return setIndex.get(id);
}

export function allItemSets(): readonly ItemSet[] {
  return ITEM_SETS;
}

/**
 * 计算武将装备当前激活的全部套装状态
 */
export function getActiveItemSets(
  equipment: Equipment | undefined,
  getItem: (id: number) => ItemStatic | undefined,
): ActiveSetResult[] {
  if (!equipment) return [];

  // 1. 统计当前佩戴的所有有效宝物
  const equippedItemIds = Object.values(equipment).filter((id): id is number => typeof id === 'number');
  if (equippedItemIds.length === 0) return [];

  // 2. 统计每个套装包含的件数
  const setCounts = new Map<number, number[]>();
  for (const itemId of equippedItemIds) {
    const item = getItem(itemId);
    if (!item || !item.sets || item.sets.length === 0) continue;
    for (const setId of item.sets) {
      const list = setCounts.get(setId) ?? [];
      list.push(itemId);
      setCounts.set(setId, list);
    }
  }

  const results: ActiveSetResult[] = [];
  for (const [setId, itemIds] of setCounts.entries()) {
    const set = getItemSetById(setId);
    if (!set) continue;
    const count = itemIds.length;
    // 找出最高达成的 tier
    let activeTier: ItemSetTier | null = null;
    const allTiers = set.tiers.map((tier) => {
      const active = count >= tier.count;
      if (active && (!activeTier || tier.count > activeTier.count)) {
        activeTier = tier;
      }
      return { tier, active };
    });

    results.push({
      set,
      equippedCount: count,
      equippedItemIds: itemIds,
      activeTier,
      allTiers,
    });
  }

  // 按套装 ID 稳定排序
  return results.sort((a, b) => a.set.id - b.set.id);
}
