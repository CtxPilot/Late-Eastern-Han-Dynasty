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

  it('computes BFS shortest county path on the undirected county graph', () => {
    const instance = makeInstance();
    expect(shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_zhouling')).toEqual([
      'nanjun_jiangling',
      'nanjun_huarong',
      'nanjun_zhouling',
    ]);
    expect(shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_henshan')).toEqual([
      'nanjun_jiangling',
      'nanjun_zhijiang',
      'nanjun_yidao',
      'nanjun_henshan',
    ]);
    expect(shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_jiangling')).toEqual(['nanjun_jiangling']);
    expect(shortestCountyPath(instance, 'nanjun_jiangling', 'yingchuan_yangdi')).toBeNull();
  });

  it('flags a supply path blocked only when a non-entry node is occupied by the blocker', () => {
    const instance = makeInstance();
    const jianglingToZhouling = shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_zhouling')!;
    const jianglingToYidao = shortestCountyPath(instance, 'nanjun_jiangling', 'nanjun_yidao')!;

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
