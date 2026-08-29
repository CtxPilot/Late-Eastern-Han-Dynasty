// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { nanjun190 } from './data/historical-geography/nanjun-190.js';
import { generateCommanderyBattlefield } from './commandery-battlefield.js';
import {
  isCountyPathBlockedBy,
  monthlyArmyFoodCost,
  resolveArmyCountyNodeId,
  shortestCountyPath,
} from './army-county-mapping.js';

const base = {
  bundle: nanjun190,
  templateId: 'nanjun-190',
  instanceId: 'bf-nanjun-supply-test',
  warId: 'war-nanjun-supply-test',
  attackerFactionId: 1,
  defenderFactionId: 2,
  armyIds: ['army-a', 'army-b'],
  entryNodeIds: ['nanjun_zhijiang', 'nanjun_huarong'],
  rngDrawStart: 9,
};

function makeInstance() {
  const values = [0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6];
  let index = 0;
  return generateCommanderyBattlefield({
    ...base,
    dynamic: { currentMonth: 10, rng: () => values[index++] ?? 0.5 },
  });
}

describe('BF-P5 army-county-mapping', () => {
  it('resolves army county node from runtime nodeStates.armyIds, falling back to deployments', () => {
    const instance = makeInstance();
    const deployed = instance.dynamicSituation!.deployments.find((d) => d.armyId === 'army-a')!;

    expect(resolveArmyCountyNodeId(instance, 'army-a')).toBe(deployed.nodeId);
    expect(instance.nodeStates.find((n) => n.nodeId === deployed.nodeId)?.armyIds).toContain('army-a');

    const noRuntime = {
      ...instance,
      nodeStates: instance.nodeStates.map((n) => ({ ...n, armyIds: [] })),
    };
    expect(resolveArmyCountyNodeId(noRuntime, 'army-a')).toBe(deployed.nodeId);
    expect(resolveArmyCountyNodeId(instance, 'army-unknown')).toBeNull();
  });

  it('computes movementCost-weighted shortest county path (unit costs ≡ hop BFS on nanjun)', () => {
    const instance = makeInstance();
    expect(instance.routeStates.every((r) => typeof r.movementCost === 'number')).toBe(true);

    const toZhouling = shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_zhouling');
    expect(toZhouling).toEqual({
      nodeIds: ['nanjun_jiangling', 'nanjun_huarong', 'nanjun_zhouling'],
      totalCost: expect.any(Number),
    });
    expect(toZhouling!.totalCost).toBeGreaterThan(0);

    const toHenshan = shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_henshan');
    expect(toHenshan!.nodeIds).toEqual([
      'nanjun_jiangling',
      'nanjun_zhijiang',
      'nanjun_yidao',
      'nanjun_henshan',
    ]);
    expect(shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_jiangling')).toEqual({
      nodeIds: ['nanjun_jiangling'],
      totalCost: 0,
    });
    expect(shortestCountyPath(instance, 'nanjun_jiangling', 'yingchuan_yangdi')).toBeNull();
  });

  it('prefers lower movementCost over fewer hops when costs diverge', () => {
    // 人工菱形：A—B—D 代价 10+10；A—C—D 代价 1+1 → 加权选经 C
    const synthetic = {
      ...makeInstance(),
      nodeStates: [
        {
          nodeId: 'a', name: 'A', role: 'seat' as const, rulerFactionId: 2,
          garrison: 0, wallDurability: 0, maxWallDurability: 0, armyIds: [],
          adjacentNodeIds: ['b', 'c'], localX: 0, localY: 0, controlTurns: 0,
        },
        {
          nodeId: 'b', name: 'B', role: 'county' as const, rulerFactionId: null,
          garrison: 0, wallDurability: 0, maxWallDurability: 0, armyIds: [],
          adjacentNodeIds: ['a', 'd'], localX: 0, localY: 0, controlTurns: 0,
        },
        {
          nodeId: 'c', name: 'C', role: 'county' as const, rulerFactionId: null,
          garrison: 0, wallDurability: 0, maxWallDurability: 0, armyIds: [],
          adjacentNodeIds: ['a', 'd'], localX: 0, localY: 0, controlTurns: 0,
        },
        {
          nodeId: 'd', name: 'D', role: 'county' as const, rulerFactionId: null,
          garrison: 0, wallDurability: 0, maxWallDurability: 0, armyIds: [],
          adjacentNodeIds: ['b', 'c'], localX: 0, localY: 0, controlTurns: 0,
        },
      ],
      routeStates: [
        { routeId: 'ab', fromNodeId: 'a', toNodeId: 'b', type: 'road', movementCost: 10 },
        { routeId: 'bd', fromNodeId: 'b', toNodeId: 'd', type: 'road', movementCost: 10 },
        { routeId: 'ac', fromNodeId: 'a', toNodeId: 'c', type: 'road', movementCost: 1 },
        { routeId: 'cd', fromNodeId: 'c', toNodeId: 'd', type: 'road', movementCost: 1 },
      ],
    };
    const path = shortestCountyPath(synthetic, 'a', 'd');
    expect(path).toEqual({ nodeIds: ['a', 'c', 'd'], totalCost: 2 });

    // 旧档无 movementCost → 全部按 1，两路径代价同为 2，稳定取字典序更小的首跳（b < c → 经 b）
    const legacy = {
      ...synthetic,
      routeStates: synthetic.routeStates.map(({ movementCost: _c, ...r }) => r),
    };
    const legacyPath = shortestCountyPath(legacy, 'a', 'd');
    expect(legacyPath!.totalCost).toBe(2);
    expect(legacyPath!.nodeIds).toEqual(['a', 'b', 'd']);
  });

  it('flags a supply path blocked only when a non-entry node is occupied by the blocker', () => {
    const instance = makeInstance();
    const jianglingToZhouling = shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_zhouling')!.nodeIds;
    const jianglingToYidao = shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_yidao')!.nodeIds;

    const occupied = (nodeIds: string[]) => ({
      ...instance,
      nodeStates: instance.nodeStates.map((n) =>
        nodeIds.includes(n.nodeId) ? { ...n, rulerFactionId: 1 } : n,
      ),
    });

    expect(isCountyPathBlockedBy(occupied(['nanjun_huarong']), jianglingToZhouling, 1)).toBe(true);
    expect(isCountyPathBlockedBy(instance, jianglingToZhouling, 1)).toBe(false);
    expect(isCountyPathBlockedBy(occupied(['nanjun_jiangling']), jianglingToZhouling, 1)).toBe(false);
    expect(isCountyPathBlockedBy(occupied(['nanjun_huarong']), jianglingToYidao, 1)).toBe(false);
  });

  it('converts monthly food cost from troops with a floor of 1', () => {
    expect(monthlyArmyFoodCost(100)).toBe(3);
    expect(monthlyArmyFoodCost(50)).toBe(1);
    expect(monthlyArmyFoodCost(1000)).toBe(30);
    expect(monthlyArmyFoodCost(0)).toBe(1);
  });
});
