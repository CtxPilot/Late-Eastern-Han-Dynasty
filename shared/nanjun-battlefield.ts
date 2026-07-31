// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * BF-P1 南郡郡域战场实例生成（`docs/21-battlefield-scene-design.md` §3.2/§8.2）
 *
 * 从 BF-P0 静态历史地理数据 `nanjun190` 生成 `BattlefieldInstance`。
 * 纯函数，无 server runtime 依赖，可单测。
 *
 * 本轮只验证「江陵围城」主场景：nodeStates 含全郡 16 县（静态展示），
 * 江陵为 seat（守方据点），其余县中立（rulerFactionId=null）；routeStates 含全 11 路线。
 */

import { nanjun190 } from './data/historical-geography/index.js';
import { generateCommanderyBattlefield } from './commandery-battlefield.js';
import { BATTLEFIELD_TEMPLATE_VERSION, type BattlefieldInstance } from './types/battlefield-instance.js';

const NANJUN_TEMPLATE_ID = 'nanjun-190';
const JIANGLING_ID = 'nanjun_jiangling';

export interface GenerateNanjunBattlefieldOpts {
  instanceId: string;
  warId: string;
  attackerFactionId: number;
  defenderFactionId: number;
  armyIds: string[];
  seatGarrison?: number;
  seatWallDurability?: number;
  rngDrawStart: number;
  scenarioDateAtCreation?: string;
  /** BF-P3：省略时保持静态模板零 RNG 消费。 */
  dynamic?: { rng: () => number; currentMonth: number };
}

const NANJUN_ENTRY_NODES = ['nanjun_dangyang', 'nanjun_zhijiang'];

export function generateNanjunBattlefield(opts: GenerateNanjunBattlefieldOpts): BattlefieldInstance {
  return generateCommanderyBattlefield({
    ...opts,
    bundle: nanjun190,
    templateId: NANJUN_TEMPLATE_ID,
    entryNodeIds: NANJUN_ENTRY_NODES,
  });
}

export const NANJUN_JIANGLING_NODE_ID = JIANGLING_ID;
export const NANJUN_TEMPLATE_VERSION = BATTLEFIELD_TEMPLATE_VERSION;
