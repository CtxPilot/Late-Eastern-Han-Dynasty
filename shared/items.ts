// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { OfficerStats } from './types/common.js';
import type { EquipSlot, Equipment, ItemStatic } from './types/item.js';
import { ItemCategory } from './enums/index.js';

/**
 * S13 宝物系统共享纯函数（Session 266 实装，0-A 5 槽）。
 * 服务端引擎（equip/unequip/赏赐/搜索入库）见 server/src/engine/items.ts。
 */

/** 宝物品类 → 装备槽位映射（0-A 5 槽；special/consumable 不入槽，存势力库存）。 */
export function equipSlotFor(category: ItemCategory): EquipSlot | null {
  switch (category) {
    case ItemCategory.WEAPON_PRIMARY:
      return 'weaponPrimary';
    case ItemCategory.WEAPON_SECONDARY:
      return 'weaponSecondary';
    case ItemCategory.ARMOR:
      return 'armor';
    case ItemCategory.MOUNT:
      return 'mount';
    case ItemCategory.BOOK:
      return 'tome';
    case ItemCategory.SPECIAL:
    case ItemCategory.CONSUMABLE:
      return null;
  }
}

/** 装备门槛判定（0-A 简化：属性门槛 + 专属武将白名单）。 */
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

/** 统计装备槽位累计属性加成（baseStats 求和，0-A 无套装/专属倍率）。 */
export function equipmentStatBonus(
  equipment: Equipment | undefined,
  itemById: (id: number) => ItemStatic | undefined,
): Partial<OfficerStats> {
  const acc: Partial<OfficerStats> = {};
  if (!equipment) return acc;
  const seen = new Set<number>();
  for (const itemId of Object.values(equipment)) {
    if (itemId == null || seen.has(itemId)) continue;
    seen.add(itemId);
    const item = itemById(itemId);
    if (!item) continue;
    for (const [k, v] of Object.entries(item.baseStats)) {
      const key = k as keyof OfficerStats;
      acc[key] = (acc[key] ?? 0) + (v ?? 0);
    }
  }
  return acc;
}

/** 单件宝物属性加成（用于展示）。 */
export function itemStatBonus(item: ItemStatic): Partial<OfficerStats> {
  return { ...item.baseStats };
}

/** 装备槽位有序列表（UI 展示顺序）。 */
export const EQUIP_SLOT_ORDER: EquipSlot[] = [
  'weaponPrimary',
  'weaponSecondary',
  'armor',
  'mount',
  'tome',
];

/** 槽位中文标签。 */
export const EQUIP_SLOT_LABELS: Record<EquipSlot, string> = {
  weaponPrimary: '主武器',
  weaponSecondary: '副武器',
  armor: '铠甲',
  mount: '坐骑',
  tome: '兵书',
};
