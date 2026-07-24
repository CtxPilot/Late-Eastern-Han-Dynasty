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
import {
  BATTLEFIELD_TEMPLATE_VERSION,
  type BattlefieldInstance,
  type BattlefieldNodeState,
  type BattlefieldRouteState,
} from './types/battlefield-instance.js';

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
}

const NANJUN_ENTRY_NODES = ['nanjun_dangyang', 'nanjun_zhijiang'];

export function generateNanjunBattlefield(opts: GenerateNanjunBattlefieldOpts): BattlefieldInstance {
  const commandery = nanjun190.commanderies[0];
  if (!commandery) throw new Error('nanjun190 缺少 commandery 定义');

  const seatGarrison = opts.seatGarrison ?? 5000;
  const seatWall = opts.seatWallDurability ?? 100;

  const nodeStates: BattlefieldNodeState[] = nanjun190.counties.map((c) => {
    const isSeat = c.id === JIANGLING_ID;
    return {
      nodeId: c.id,
      name: c.name,
      role: c.role,
      rulerFactionId: isSeat ? opts.defenderFactionId : null,
      garrison: isSeat ? seatGarrison : 0,
      wallDurability: isSeat ? seatWall : 0,
      maxWallDurability: isSeat ? seatWall : 0,
      armyIds: [],
      adjacentNodeIds: c.adjacentCountyIds,
      localX: c.localX,
      localY: c.localY,
    };
  });

  const routeStates: BattlefieldRouteState[] = nanjun190.routes.map((r) => ({
    routeId: r.id,
    fromNodeId: r.fromNodeId,
    toNodeId: r.toNodeId,
    type: r.kind,
  }));

  return {
    id: opts.instanceId,
    warId: opts.warId,
    templateId: NANJUN_TEMPLATE_ID,
    templateVersion: BATTLEFIELD_TEMPLATE_VERSION,
    scenarioDateAtCreation: new Date().toISOString(),
    targetCommanderyId: commandery.id,
    targetSeatNodeId: JIANGLING_ID,
    entryNodeIds: NANJUN_ENTRY_NODES,
    nodeStates,
    routeStates,
    armyIds: opts.armyIds,
    encounters: [],
    turn: 0,
    phase: 'active',
    generationAudit: {
      rngAlgorithm: 'xorshift32-v1',
      rngDrawStart: opts.rngDrawStart,
      rngDrawEnd: opts.rngDrawStart,
      decisions: ['generateNanjunBattlefield:seat=jiangling,entries=dangyang+zhijiang'],
    },
  };
}

export const NANJUN_JIANGLING_NODE_ID = JIANGLING_ID;
export const NANJUN_TEMPLATE_VERSION = BATTLEFIELD_TEMPLATE_VERSION;
