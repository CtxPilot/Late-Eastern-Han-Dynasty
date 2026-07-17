// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { FactionId } from '../enums/index.js';

export interface Faction {
  id: FactionId;
  name: string;
  color: string;
  rulerId: number;
  capitalCityId: number;
  gold: number;
  food: number;
  /**
   * 美女资源库存（势力级，像金；04§30）
   * 寻访/抢夺增加；赏赐/献美/女间谍消耗
   */
  beautyStock: number;
  cityIds: number[];
  officerIds: number[];
  isPlayer: boolean;
  isAlive: boolean;
}
