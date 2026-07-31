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
});
