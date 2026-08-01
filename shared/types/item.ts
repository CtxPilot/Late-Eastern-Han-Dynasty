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
  bonusEffect: ItemEffect[];
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
 * 装备槽位（0-A 精简 5 槽，docs/04 §12.1；8+2 槽全量设计留 0-B）。
 * 与 07-ui-design.md §7.3 现有装备区块占位一致：主武器/副武器/铠甲/坐骑/兵书。
 */
export type EquipSlot =
  | 'weaponPrimary'
  | 'weaponSecondary'
  | 'armor'
  | 'mount'
  | 'tome';

/** Officer.equipment: 槽位 → 宝物 id（未装备的槽位缺省）。 */
export type Equipment = Partial<Record<EquipSlot, number>>;

/** Faction.inventory: 宝物 id → 数量（势力未分配库存）。 */
export type ItemInventory = Record<number, number>;
