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

  it('L3 套装体系与件数阶梯激活（2件/3件/4件）', () => {
    // 关羽威震华夏套：1 青龙偃月刀, 10 赤兔马, 117 假节钺
    const qinglong = baseItem({
      id: 1,
      name: '青龙偃月刀',
      sets: [1],
      baseStats: { war: 10 },
      bond: { officerId: 6, bonusStats: { war: 2 } },
      baseEffect: [{ type: 'crit_rate', value: 5 }],
    });
    const chitu = baseItem({
      id: 10,
      name: '赤兔马',
      sets: [1, 2],
      baseStats: { war: 2 },
      bond: { officerId: 6 },
      baseEffect: [{ type: 'mobility', value: 5 }],
    });
    const jiajeyue = baseItem({
      id: 117,
      name: '假节钺',
      sets: [1],
      baseStats: { leadership: 3 },
      bond: { officerId: 6 },
      baseEffect: [{ type: 'authority', value: 8 }],
    });

    const itemMap = new Map<number, ItemStatic>([
      [1, qinglong],
      [10, chitu],
      [117, jiajeyue],
    ]);
    const getItem = (id: number) => itemMap.get(id);

    // 1件（青龙刀）：无套装效果
    const bonus1 = equipmentStatBonus({ weaponPrimary: 1 }, getItem, 9); // 夏侯惇
    expect(bonus1.war).toBe(10);

    // 2件（青龙刀 + 赤兔马）：夏侯惇装备触发 2 件套（1.2 倍加成 + bonusStats { war: 3 }）
    // 青龙刀: floor(10 * 1.2) = 12; 赤兔马: floor(2 * 1.2) = 2; 套装加成: 3 -> 总计 17
    const bonus2 = equipmentStatBonus({ weaponPrimary: 1, mount: 10 }, getItem, 9);
    expect(bonus2.war).toBe(17);

    // 3件全套（青龙刀 + 赤兔马 + 假节钺）：关羽装备同时触发 L2 专属共鸣（1.5 倍）与 L3 3件套（1.5 倍）！
    // 乘区: 1.5 * 1.5 = 2.25倍
    // 青龙刀: floor(10 * 2.25) = 22 + 青龙刀专属 bonusStats(war: 2) = 24
    // 赤兔马: floor(2 * 2.25) = 4
    // 假节钺: floor(3 * 2.25) = 6 (leadership)
    // 套装 2 件套 bonusStats: war + 3
    // 套装 3 件套 bonusStats: leadership + 4
    // 关羽最终 war: 24 + 4 + 3 = 31
    // 关羽最终 leadership: 6 + 4 = 10
    const bonus3 = equipmentStatBonus({ weaponPrimary: 1, mount: 10, accessory: 117 }, getItem, 6);
    expect(bonus3.war).toBe(31);
    expect(bonus3.leadership).toBe(10);

    // 检查效果累加：包含青龙刀暴击、赤兔马机动、假节钺威信、以及套装解锁特技词条
    const effs = equipmentEffectiveEffects({ weaponPrimary: 1, mount: 10, accessory: 117 }, getItem, 6);
    expect(effs.some((e) => e.type === 'charge_damage' && e.value === 15)).toBe(true); // 套装2件【武圣神威】
    expect(effs.some((e) => e.type === 'crit_rate' && e.value === 10)).toBe(true); // 套装3件【威震华夏】
    expect(effs.some((e) => e.type === 'duel_boost' && e.value === 20)).toBe(true); // 套装3件单挑战意
  });

  it('equipmentStatBonus 空装备返回空', () => {
    expect(equipmentStatBonus(undefined, () => undefined)).toEqual({});
    expect(equipmentStatBonus({}, () => undefined)).toEqual({});
  });
});
