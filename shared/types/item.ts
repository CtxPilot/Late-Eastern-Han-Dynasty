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
