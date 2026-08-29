// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { HistoricalGeographyBundle } from './data/historical-geography/schema.js';
import {
  BATTLEFIELD_TEMPLATE_VERSION,
  type BattlefieldInstance,
  type BattlefieldNodeState,
} from './types/battlefield-instance.js';

export interface GenerateCommanderyBattlefieldOpts {
  bundle: HistoricalGeographyBundle;
  templateId: string;
  instanceId: string;
  warId: string;
  attackerFactionId: number;
  defenderFactionId: number;
  /** 攻方 Army id 列表（部署到入口县）。 */
  armyIds: string[];
  /** 攻方部署入口县（边界入口）。 */
  entryNodeIds: string[];
  /** 守方 Army id 列表（R6：部署到守方纵深前沿县；缺省/空 = 无守方 Army）。 */
  defenderArmyIds?: string[];
  /** 守方部署节点（守方纵深前沿县）；缺省/空但存在 defenderArmyIds 时回退郡治 seat。 */
  defenderEntryNodeIds?: string[];
  seatGarrison?: number;
  seatWallDurability?: number;
  rngDrawStart: number;
  scenarioDateAtCreation?: string;
  dynamic?: { rng: () => number; currentMonth: number };
}

/**
 * BF-P4 通用郡域实例生成器：只消费模板与显式入口，不按郡名分支。
 *
 * 攻方 Army（`opts.armyIds`）部署到攻方边界入口 `opts.entryNodeIds`；
 * 守方 Army（`opts.defenderArmyIds`，R6 守方 Army 入郡域场景）部署到
 * 守方纵深前沿县 `opts.defenderEntryNodeIds`（缺省回退郡治 seat）。
 * 无守方 Army 时全部行为与 BF-P3 完全一致（RNG 零新增消费、审计不变）。
 */
export function generateCommanderyBattlefield(opts: GenerateCommanderyBattlefieldOpts): BattlefieldInstance {
  const commandery = opts.bundle.commanderies[0];
  if (!commandery) throw new Error(`${opts.bundle.sliceId} 缺少 commandery 定义`);
  const countyIds = new Set(opts.bundle.counties.map(({ id }) => id));
  if (opts.entryNodeIds.length === 0 || opts.entryNodeIds.some((id) => !countyIds.has(id))) {
    throw new Error('战场入口必须引用模板内县节点');
  }

  const seatGarrison = opts.seatGarrison ?? 5000;
  const seatWall = opts.seatWallDurability ?? 100;
  const nodeStates: BattlefieldNodeState[] = opts.bundle.counties.map((county) => {
    const isSeat = county.id === commandery.seatCountyId;
    return {
      nodeId: county.id,
      name: county.name,
      role: county.role,
      rulerFactionId: isSeat ? opts.defenderFactionId : null,
      garrison: isSeat ? seatGarrison : 0,
      wallDurability: isSeat ? seatWall : 0,
      maxWallDurability: isSeat ? seatWall : 0,
      armyIds: [],
      adjacentNodeIds: county.adjacentCountyIds,
      localX: county.localX,
      localY: county.localY,
      controlTurns: 0,
    };
  });
  const decisions = [
    `generateCommanderyBattlefield:template=${opts.templateId},seat=${commandery.seatCountyId},entries=${opts.entryNodeIds.join('+')}`,
  ];
  let draws = opts.rngDrawStart;
  const draw = () => {
    draws += 1;
    return opts.dynamic!.rng();
  };
  const dynamicSituation = opts.dynamic ? (() => {
    const wetSeason = opts.dynamic.currentMonth >= 4 && opts.dynamic.currentMonth <= 9;
    const weatherRoll = draw();
    const weather = weatherRoll < (wetSeason ? .45 : .18)
      ? 'rain' as const
      : weatherRoll < (wetSeason ? .62 : .38) ? 'fog' as const : 'clear' as const;
    // 攻方 Army → 入口县（BF-P3 确定性序列：稳定排序后逐支 draw 选入口）。
    const attackerDeployments = [...opts.armyIds].sort().map((armyId) => ({
      armyId,
      nodeId: opts.entryNodeIds[Math.floor(draw() * opts.entryNodeIds.length)]!,
    }));
    // 守方 Army → 守方纵深前沿县（R6，`docs/23-design-consistency-remediation.md` §三）。
    // 无守方 Army 或未提供守方节点时零 RNG 消费（回退郡治 seat，确定性部署），
    // 保证 BF-P3 既有序列（无 defenderArmyIds 时）完全不变。
    const defenderArmyIds = opts.defenderArmyIds ?? [];
    const defenderNodes = opts.defenderEntryNodeIds?.length
      ? opts.defenderEntryNodeIds
      : [commandery.seatCountyId];
    const defenderDeployments = defenderArmyIds.length === 0
      ? []
      : [...defenderArmyIds].sort().map((armyId) => ({
          armyId,
          nodeId: opts.defenderEntryNodeIds?.length
            ? defenderNodes[Math.floor(draw() * defenderNodes.length)]!
            : commandery.seatCountyId,
        }));
    const deployments = [...attackerDeployments, ...defenderDeployments];
    const attackerScouted = draw() < .55;
    const defenderScouted = draw() < .5;
    const ambushRoll = draw();
    const ambush = ambushRoll < .2 ? 'attacker' as const : ambushRoll < .4 ? 'defender' as const : 'none' as const;
    const encounterOrder = deployments
      .map((deployment) => ({ armyId: deployment.armyId, order: draw() }))
      .sort((a, b) => a.order - b.order || a.armyId.localeCompare(b.armyId))
      .map(({ armyId }) => armyId);
    decisions.push(
      `weather=${weather}`,
      `deployments=${deployments.map(({ armyId, nodeId }) => `${armyId}@${nodeId}`).join(',') || 'none'}`,
      `scout=attacker:${attackerScouted},defender:${defenderScouted}`,
      `ambush=${ambush}`,
      `encounterOrder=${encounterOrder.join(',') || 'none'}`,
    );
    return { weather, deployments, attackerScouted, defenderScouted, ambush, encounterOrder };
  })() : undefined;

  // Army—县位置映射：把创建时部署（dynamicSituation.deployments）写入 nodeStates[].armyIds，
  // 作为运行时权威位置来源（BF-P5，`shared/army-county-mapping.ts` 读取）。
  const nodeStatesWithArmyPositions = dynamicSituation
    ? (() => {
        const armyIdsByNode = new Map<string, string[]>();
        for (const { armyId, nodeId } of dynamicSituation.deployments) {
          armyIdsByNode.set(nodeId, [...(armyIdsByNode.get(nodeId) ?? []), armyId]);
        }
        return nodeStates.map((node) => ({
          ...node,
          armyIds: armyIdsByNode.get(node.nodeId) ?? [],
        }));
      })()
    : nodeStates;

  return {
    id: opts.instanceId,
    warId: opts.warId,
    templateId: opts.templateId,
    templateVersion: BATTLEFIELD_TEMPLATE_VERSION,
    scenarioDateAtCreation: opts.scenarioDateAtCreation ?? opts.bundle.sliceId,
    targetCommanderyId: commandery.id,
    targetSeatNodeId: commandery.seatCountyId,
    entryNodeIds: [...opts.entryNodeIds],
    nodeStates: nodeStatesWithArmyPositions,
    routeStates: opts.bundle.routes.map((route) => ({
      routeId: route.id,
      fromNodeId: route.fromNodeId,
      toNodeId: route.toNodeId,
      type: route.kind,
      movementCost: route.movementCost,
    })),
    armyIds: [...opts.armyIds, ...(opts.defenderArmyIds ?? [])].sort(),
    encounters: [],
    turn: 0,
    phase: 'active',
    generationAudit: {
      rngAlgorithm: 'xorshift32-v1',
      rngDrawStart: opts.rngDrawStart,
      rngDrawEnd: draws,
      decisions,
    },
    dynamicSituation,
  };
}
