// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { OfficerStats } from './types/common.js';
import type { EquipSlot, Equipment, ItemEffect, ItemStatic } from './types/item.js';
import { ItemCategory } from './enums/index.js';

/**
 * S13 宝物系统共享纯函数（Session 266 5 槽，Session 450 扩展至 8 槽与专属共鸣 L2）。
 * 服务端引擎（equip/unequip/赏赐/搜索入库）见 server/src/engine/items.ts。
 */

/** 宝物品类 → 装备槽位映射（8 槽位；special 兼容映射至 accessory；consumable 不入槽）。 */
export function equipSlotFor(category: ItemCategory): EquipSlot | null {
  switch (category) {
    case ItemCategory.WEAPON_PRIMARY:
      return 'weaponPrimary';
    case ItemCategory.WEAPON_SECONDARY:
      return 'weaponSecondary';
    case ItemCategory.HEADWEAR:
      return 'headwear';
    case ItemCategory.ARMOR:
      return 'armor';
    case ItemCategory.ROBE:
      return 'robe';
    case ItemCategory.MOUNT:
      return 'mount';
    case ItemCategory.BOOK:
      return 'tome';
    case ItemCategory.ACCESSORY:
    case ItemCategory.SPECIAL:
      return 'accessory';
    case ItemCategory.CONSUMABLE:
      return null;
  }
}

/** 专属羁绊判定（L2 专属共鸣：武将 ID 与宝物 bond.officerId 一致时触发）。 */
export function isItemBondActive(item: ItemStatic, officerId?: number): boolean {
  if (officerId == null || !item.bond) return false;
  return item.bond.officerId === officerId;
}

/** 装备门槛判定（属性门槛 + 专属武将白名单）。 */
export function canEquipItem(
  officer: { id: number; stats: OfficerStats },
  item: ItemStatic,
): { ok: boolean; reason?: string } {
  const req = item.equipRequirement;
  if (!req) return { ok: true };
  const s = officer.stats;
  const checks: Array<[string, number | undefined, number]> = [
    ['武力', req.minWar, s.war],
    ['统帅', req.minLeadership, s.leadership],
    ['智力', req.minIntelligence, s.intelligence],
    ['政治', req.minPolitics, s.politics],
    ['魅力', req.minCharisma, s.charisma],
  ];
  for (const [label, need, have] of checks) {
    if (need != null && have < need) {
      return { ok: false, reason: `${label}不足（需 ${need}，当前 ${have}）` };
    }
  }
  if (req.officerIds && req.officerIds.length > 0 && !req.officerIds.includes(officer.id)) {
    return { ok: false, reason: '仅限指定武将装备' };
  }
  return { ok: true };
}

/** 单件宝物在特定武将下的有效属性加成（共鸣激活时 1.5 倍 + bonusStats）。 */
export function itemEffectiveStatBonus(item: ItemStatic, officerId?: number): Partial<OfficerStats> {
  const acc: Partial<OfficerStats> = {};
  const isBond = isItemBondActive(item, officerId);
  const mul = isBond ? 1.5 : 1.0;
  for (const [k, v] of Object.entries(item.baseStats)) {
    if (v == null) continue;
    const key = k as keyof OfficerStats;
    acc[key] = Math.floor(v * mul);
  }
  if (isBond && item.bond?.bonusStats) {
    for (const [k, v] of Object.entries(item.bond.bonusStats)) {
      if (v == null) continue;
      const key = k as keyof OfficerStats;
      acc[key] = (acc[key] ?? 0) + v;
    }
  }
  return acc;
}

/** 统计装备槽位累计属性加成（支持指定武将专属共鸣倍率）。 */
export function equipmentStatBonus(
  equipment: Equipment | undefined,
  itemById: (id: number) => ItemStatic | undefined,
  officerId?: number,
): Partial<OfficerStats> {
  const acc: Partial<OfficerStats> = {};
  if (!equipment) return acc;
  const seen = new Set<number>();
  for (const itemId of Object.values(equipment)) {
    if (itemId == null || seen.has(itemId)) continue;
    seen.add(itemId);
    const item = itemById(itemId);
    if (!item) continue;
    const bonus = itemEffectiveStatBonus(item, officerId);
    for (const [k, v] of Object.entries(bonus)) {
      const key = k as keyof OfficerStats;
      acc[key] = (acc[key] ?? 0) + (v ?? 0);
    }
  }
  return acc;
}

/** 单件宝物基础属性加成（用于展示无共鸣基础值）。 */
export function itemStatBonus(item: ItemStatic): Partial<OfficerStats> {
  return { ...item.baseStats };
}

/** 单件宝物在特定武将下的有效效果列表（共鸣激活时 1.5 倍基础效果 + bonusEffect）。 */
export function itemEffectiveEffects(item: ItemStatic, officerId?: number): ItemEffect[] {
  const isBond = isItemBondActive(item, officerId);
  const mul = isBond ? 1.5 : 1.0;
  const effects: ItemEffect[] = item.baseEffect.map((e) => ({
    type: e.type,
    value: Math.floor(e.value * mul),
    description: e.description,
  }));
  if (isBond && item.bond?.bonusEffect) {
    effects.push(...item.bond.bonusEffect);
  }
  return effects;
}

/** 统计装备槽位累计有效效果列表。 */
export function equipmentEffectiveEffects(
  equipment: Equipment | undefined,
  itemById: (id: number) => ItemStatic | undefined,
  officerId?: number,
): ItemEffect[] {
  const acc: ItemEffect[] = [];
  if (!equipment) return acc;
  const seen = new Set<number>();
  for (const itemId of Object.values(equipment)) {
    if (itemId == null || seen.has(itemId)) continue;
    seen.add(itemId);
    const item = itemById(itemId);
    if (!item) continue;
    acc.push(...itemEffectiveEffects(item, officerId));
  }
  return acc;
}

/** 装备槽位有序列表（8 格，docs/04 §12.1）。 */
export const EQUIP_SLOT_ORDER: EquipSlot[] = [
  'weaponPrimary',
  'weaponSecondary',
  'headwear',
  'armor',
  'robe',
  'mount',
  'tome',
  'accessory',
];

/** 槽位中文标签。 */
export const EQUIP_SLOT_LABELS: Record<EquipSlot, string> = {
  weaponPrimary: '主武器',
  weaponSecondary: '副武器',
  headwear: '兜鍪/冠',
  armor: '铠甲',
  robe: '战袍/绶带',
  mount: '坐骑',
  tome: '兵书/典籍',
  accessory: '配饰/印信',
};
