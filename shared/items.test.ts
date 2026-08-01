// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  canEquipItem,
  equipmentStatBonus,
  equipSlotFor,
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
  it('equipSlotFor 映射 5 槽', () => {
    expect(equipSlotFor(ItemCategory.WEAPON_PRIMARY)).toBe('weaponPrimary');
    expect(equipSlotFor(ItemCategory.WEAPON_SECONDARY)).toBe('weaponSecondary');
    expect(equipSlotFor(ItemCategory.ARMOR)).toBe('armor');
    expect(equipSlotFor(ItemCategory.MOUNT)).toBe('mount');
    expect(equipSlotFor(ItemCategory.BOOK)).toBe('tome');
    expect(equipSlotFor(ItemCategory.SPECIAL)).toBeNull();
    expect(equipSlotFor(ItemCategory.CONSUMABLE)).toBeNull();
  });

  it('EQUIP_SLOT_ORDER/LABELS 覆盖 5 槽', () => {
    expect(EQUIP_SLOT_ORDER).toEqual(['weaponPrimary', 'weaponSecondary', 'armor', 'mount', 'tome']);
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

  it('equipmentStatBonus 累计 baseStats（去重）', () => {
    const itemById = (id: number) =>
      baseItem({ id, baseStats: id === 1 ? { war: 5 } : { war: 3, leadership: 2 } });
    const bonus = equipmentStatBonus(
      { weaponPrimary: 1, armor: 2, mount: 2 },
      itemById,
    );
    expect(bonus.war).toBe(8);
    expect(bonus.leadership).toBe(2);
  });

  it('equipmentStatBonus 空装备返回空', () => {
    expect(equipmentStatBonus(undefined, () => undefined)).toEqual({});
    expect(equipmentStatBonus({}, () => undefined)).toEqual({});
  });
});
