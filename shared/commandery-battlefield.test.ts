// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { yingchuan190 } from './data/historical-geography/yingchuan-190.js';
import { generateCommanderyBattlefield } from './commandery-battlefield.js';
import { BattlefieldInstanceSchema } from './battlefield-instance-schema.js';

const base = {
  bundle: yingchuan190,
  templateId: 'yingchuan-190',
  instanceId: 'bf-yingchuan-test',
  warId: 'war-yingchuan-test',
  attackerFactionId: 1,
  defenderFactionId: 2,
  armyIds: ['army-b', 'army-a'],
  entryNodeIds: ['yingchuan_xiangcheng', 'yingchuan_changshe'],
  rngDrawStart: 9,
};

describe('BF-P4 generic commandery battlefield', () => {
  it('builds Yingchuan without commandery-name branching or static RNG draws', () => {
    const instance = generateCommanderyBattlefield(base);
    expect(BattlefieldInstanceSchema.safeParse(instance).success).toBe(true);
    expect(instance.targetSeatNodeId).toBe('yingchuan_yangdi');
    expect(instance.nodeStates).toHaveLength(17);
    expect(instance.routeStates.length).toBeGreaterThan(11);
    expect(instance.generationAudit.rngDrawEnd).toBe(9);
  });

  it('is deterministic with an injected authoritative stream', () => {
    const make = () => {
      const values = [.9, .1, .8, .2, .7, .3, .6, .4];
      let index = 0;
      return generateCommanderyBattlefield({
        ...base,
        dynamic: { currentMonth: 10, rng: () => values[index++] ?? .5 },
      });
    };
    expect(make()).toEqual(make());
    expect(make().dynamicSituation?.deployments.map(({ armyId }) => armyId)).toEqual(['army-a', 'army-b']);
  });

  it('rejects an entry node outside the selected template', () => {
    expect(() => generateCommanderyBattlefield({ ...base, entryNodeIds: ['nanjun_dangyang'] }))
      .toThrow('战场入口必须引用模板内县节点');
  });

  it('deploys defender armies to defender frontier nodes (R6) and merges armyIds', () => {
    const values = [.9, .1, .8, .2, .7, .3, .6, .4];
    let index = 0;
    const instance = generateCommanderyBattlefield({
      ...base,
      armyIds: ['army-b', 'army-a'],
      defenderArmyIds: ['army-d2', 'army-d1'],
      defenderEntryNodeIds: ['yingchuan_wuyang', 'yingchuan_fucheng'],
      dynamic: { currentMonth: 10, rng: () => values[index++] ?? .5 },
    });
    // inst.armyIds 合并攻守并排序
    expect(instance.armyIds).toEqual(['army-a', 'army-b', 'army-d1', 'army-d2']);
    // 攻方 Army → 攻方入口县；守方 Army → 守方纵深前沿县
    const deployments = instance.dynamicSituation!.deployments;
    expect(deployments.filter((d) => d.armyId.startsWith('army-d')).map((d) => d.nodeId))
      .toEqual(expect.arrayContaining(['yingchuan_wuyang', 'yingchuan_fucheng']));
    expect(deployments.filter((d) => !d.armyId.startsWith('army-d')).map((d) => d.nodeId))
      .toEqual(expect.arrayContaining(['yingchuan_xiangcheng', 'yingchuan_changshe']));
    // nodeStates 位置表同时记录守方 Army（补给线/迷雾权威来源）
    const nodeWithDefender = instance.nodeStates.find((n) => n.armyIds.length > 0 && n.armyIds.some((id) => id.startsWith('army-d')));
    expect(nodeWithDefender).toBeDefined();
    expect(['yingchuan_wuyang', 'yingchuan_fucheng']).toContain(nodeWithDefender!.nodeId);
    // 审计记录守方部署
    expect(instance.generationAudit.decisions.some((d) => d.startsWith('deployments=') && d.includes('army-d1@'))).toBe(true);
  });

  it('keeps BF-P3 RNG sequence unchanged when no defender armies present', () => {
    const values = [.9, .1, .8, .2, .7, .3, .6, .4];
    let indexA = 0;
    const withoutDefender = generateCommanderyBattlefield({
      ...base,
      dynamic: { currentMonth: 10, rng: () => values[indexA++] ?? .5 },
    });
    let indexB = 0;
    const withDefender = generateCommanderyBattlefield({
      ...base,
      defenderArmyIds: [],
      defenderEntryNodeIds: ['yingchuan_wuyang'],
      dynamic: { currentMonth: 10, rng: () => values[indexB++] ?? .5 },
    });
    expect(withDefender.dynamicSituation).toEqual(withoutDefender.dynamicSituation);
    expect(withDefender.generationAudit).toEqual(withoutDefender.generationAudit);
  });
});
