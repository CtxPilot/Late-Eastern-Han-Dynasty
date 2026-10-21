// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type {
  AcquisitionMethod,
  ArmorSubType,
  ItemCategory,
  ItemQuality,
  PrimaryWeaponSubType,
  SecondaryWeaponSubType,
} from '../enums/index.js';
import type { OfficerStats } from './common.js';

export interface ItemEffect {
  type: string;
  value: number;
  description?: string;
}

export interface ItemEquipRequirement {
  minWar?: number;
  minLeadership?: number;
  minIntelligence?: number;
  minPolitics?: number;
  minCharisma?: number;
  officerIds?: number[];
}

export interface ItemBond {
  officerId: number;
  bonusStats?: Partial<OfficerStats>;
  bonusEffect: ItemEffect[];
  description?: string;
}

export interface ConsumableDef {
  effect: {
    type: string;
    value: number;
    description?: string;
  };
  maxStack: number;
}

/** Static JSON record (items.json) */
export interface ItemStatic {
  id: number;
  name: string;
  category: ItemCategory;
  quality: ItemQuality;
  primaryWeaponSubType?: PrimaryWeaponSubType;
  secondaryWeaponSubType?: SecondaryWeaponSubType;
  armorSubType?: ArmorSubType;
  baseStats: Partial<OfficerStats>;
  baseEffect: ItemEffect[];
  equipRequirement: ItemEquipRequirement;
  bond?: ItemBond;
  sets?: number[];
  consumable?: ConsumableDef;
  acquisition: AcquisitionMethod[];
  shopPrice?: number;
  description: string;
}

/**
 * 装备槽位（docs/04 §12.1 8 装备槽 + 2 快捷槽）。
 * 8 格装备槽：主武器 / 副武器 / 兜鍪冠 / 铠甲 / 战袍绶带 / 坐骑 / 兵书典籍 / 配饰印信。
 */
export type EquipSlot =
  | 'weaponPrimary'
  | 'weaponSecondary'
  | 'headwear'
  | 'armor'
  | 'robe'
  | 'mount'
  | 'tome'
  | 'accessory';

/** Officer.equipment: 槽位 → 宝物 id（未装备的槽位缺省）。 */
export type Equipment = Partial<Record<EquipSlot, number>>;

/** Faction.inventory: 宝物 id → 数量（势力未分配库存）。 */
export type ItemInventory = Record<number, number>;

/**
 * Officer.consumableSlots 条目（S13 Session 435）：快捷槽一种消耗品 + 叠加数。
 * 至多 2 条（04 §12.3），每条 count 1~99。
 */
export interface ConsumableSlot {
  itemId: number;
  count: number;
}
