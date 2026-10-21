// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  canEquipItem,
  equipmentStatBonus,
  equipmentEffectiveEffects,
  equipSlotFor,
  isItemBondActive,
  itemEffectiveStatBonus,
  itemEffectiveEffects,
  EQUIP_SLOT_LABELS,
  EQUIP_SLOT_ORDER,
} from './items.js';
import { ItemCategory } from './enums/index.js';
import type { ItemStatic } from './types/item.js';

const baseItem = (over: Partial<ItemStatic> = {}): ItemStatic => ({
  id: 999,
  name: '测试宝物',
  category: ItemCategory.WEAPON_PRIMARY,
  quality: 'rare',
  baseStats: {},
  baseEffect: [],
  equipRequirement: {},
  acquisition: ['search'],
  description: '测试',
  ...over,
});

const officer = {
  id: 1,
  stats: { war: 80, leadership: 70, intelligence: 60, politics: 50, charisma: 55 },
};

describe('shared/items', () => {
  it('equipSlotFor 映射 8 槽（及 special 兼容与 consumable 拒绝）', () => {
    expect(equipSlotFor(ItemCategory.WEAPON_PRIMARY)).toBe('weaponPrimary');
    expect(equipSlotFor(ItemCategory.WEAPON_SECONDARY)).toBe('weaponSecondary');
    expect(equipSlotFor(ItemCategory.HEADWEAR)).toBe('headwear');
    expect(equipSlotFor(ItemCategory.ARMOR)).toBe('armor');
    expect(equipSlotFor(ItemCategory.ROBE)).toBe('robe');
    expect(equipSlotFor(ItemCategory.MOUNT)).toBe('mount');
    expect(equipSlotFor(ItemCategory.BOOK)).toBe('tome');
    expect(equipSlotFor(ItemCategory.ACCESSORY)).toBe('accessory');
    expect(equipSlotFor(ItemCategory.SPECIAL)).toBe('accessory');
    expect(equipSlotFor(ItemCategory.CONSUMABLE)).toBeNull();
  });

  it('EQUIP_SLOT_ORDER/LABELS 覆盖 8 槽', () => {
    expect(EQUIP_SLOT_ORDER).toEqual([
      'weaponPrimary',
      'weaponSecondary',
      'headwear',
      'armor',
      'robe',
      'mount',
      'tome',
      'accessory',
    ]);
    expect(EQUIP_SLOT_ORDER).toHaveLength(8);
    for (const slot of EQUIP_SLOT_ORDER) {
      expect(EQUIP_SLOT_LABELS[slot]).toBeTruthy();
    }
  });

  it('canEquipItem 满足/不满足属性门槛', () => {
    const sword = baseItem({ equipRequirement: { minWar: 80 } });
    expect(canEquipItem(officer, sword).ok).toBe(true);
    const tooHigh = baseItem({ equipRequirement: { minWar: 90 } });
    expect(canEquipItem(officer, tooHigh).ok).toBe(false);
    expect(canEquipItem(officer, tooHigh).reason).toContain('武力');
  });

  it('canEquipItem 专属白名单', () => {
    const bonded = baseItem({ equipRequirement: { officerIds: [2] } });
    expect(canEquipItem(officer, bonded).ok).toBe(false);
    expect(canEquipItem({ ...officer, id: 2 }, bonded).ok).toBe(true);
  });

  it('isItemBondActive 判定羁绊激活', () => {
    const blade = baseItem({
      bond: { officerId: 6, bonusEffect: [{ type: 'duel_boost', value: 20 }] },
    });
    expect(isItemBondActive(blade, 6)).toBe(true);
    expect(isItemBondActive(blade, 1)).toBe(false);
    expect(isItemBondActive(blade, undefined)).toBe(false);
    expect(isItemBondActive(baseItem({}), 6)).toBe(false);
  });

  it('itemEffectiveStatBonus 与共鸣 1.5 倍加成', () => {
    const blade = baseItem({
      baseStats: { war: 10, leadership: 4 },
      bond: {
        officerId: 6,
        bonusStats: { war: 2 },
        bonusEffect: [{ type: 'crit_rate', value: 5 }],
      },
    });
    // 非专属：100%
    const normal = itemEffectiveStatBonus(blade, 1);
    expect(normal.war).toBe(10);
    expect(normal.leadership).toBe(4);

    // 专属武将（ID 6）：150% + bonusStats
    const resonant = itemEffectiveStatBonus(blade, 6);
    expect(resonant.war).toBe(15 + 2); // 10 * 1.5 + 2 = 17
    expect(resonant.leadership).toBe(6); // 4 * 1.5 = 6
  });

  it('itemEffectiveEffects 包含 1.5 倍基础效果与隐藏共鸣词条', () => {
    const blade = baseItem({
      baseEffect: [{ type: 'crit_rate', value: 5, description: '暴击+5%' }],
      bond: {
        officerId: 6,
        bonusEffect: [{ type: 'duel_boost', value: 20, description: '【武圣】单挑战意+20%' }],
      },
    });
    // 非专属
    const normalEff = itemEffectiveEffects(blade, 1);
    expect(normalEff).toHaveLength(1);
    expect(normalEff[0].value).toBe(5);

    // 专属
    const resonantEff = itemEffectiveEffects(blade, 6);
    expect(resonantEff).toHaveLength(2);
    expect(resonantEff[0].value).toBe(7); // floor(5 * 1.5) = 7
    expect(resonantEff[1].type).toBe('duel_boost');
    expect(resonantEff[1].value).toBe(20);
  });

  it('equipmentStatBonus 累计 8 槽（支持专属武将共鸣）', () => {
    const itemById = (id: number) => {
      if (id === 1) {
        return baseItem({
          id: 1,
          baseStats: { war: 10 },
          bond: { officerId: 6, bonusEffect: [] },
        });
      }
      if (id === 2) {
        return baseItem({ id: 2, baseStats: { leadership: 4 } });
      }
      return undefined;
    };

    // 非专属武将（ID 1）装备：不触发共鸣
    const bonusNormal = equipmentStatBonus(
      { weaponPrimary: 1, armor: 2 },
      itemById,
      1,
    );
    expect(bonusNormal.war).toBe(10);
    expect(bonusNormal.leadership).toBe(4);

    // 专属武将关羽（ID 6）装备：触发青龙刀共鸣（10 * 1.5 = 15）
    const bonusResonant = equipmentStatBonus(
      { weaponPrimary: 1, armor: 2 },
      itemById,
      6,
    );
    expect(bonusResonant.war).toBe(15);
    expect(bonusResonant.leadership).toBe(4);
  });

  it('equipmentStatBonus 空装备返回空', () => {
    expect(equipmentStatBonus(undefined, () => undefined)).toEqual({});
    expect(equipmentStatBonus({}, () => undefined)).toEqual({});
  });
});
