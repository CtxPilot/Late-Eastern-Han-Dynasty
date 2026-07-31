// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  computeRevealedNodeIds,
  maskBattlefieldInstanceForPlayer,
} from './commandery-fog.js';
import { nanjun190 } from './data/historical-geography/nanjun-190.js';
import { generateCommanderyBattlefield } from './commandery-battlefield.js';

function buildNanjunInstance(overrides?: {
  occupiedByPlayer?: string[];
  playerArmyNode?: string;
}) {
  const base = generateCommanderyBattlefield({
    bundle: nanjun190,
    templateId: 'nanjun-190',
    instanceId: 'bf-fog-test',
    warId: 'war-fog-test',
    attackerFactionId: 1,
    defenderFactionId: 2,
    armyIds: overrides?.playerArmyNode ? ['army-p1'] : [],
    entryNodeIds: ['nanjun_dangyang', 'nanjun_zhijiang'],
    rngDrawStart: 0,
  });
  const nodeStates = base.nodeStates.map((n) => {
    let next = n;
    if (overrides?.occupiedByPlayer?.includes(n.nodeId)) {
      next = { ...next, rulerFactionId: 1, garrison: 500 };
    }
    if (overrides?.playerArmyNode && n.nodeId === overrides.playerArmyNode) {
      next = { ...next, armyIds: ['army-p1'] };
    }
    return next;
  });
  return { ...base, nodeStates };
}

const PLAYER_FACTION_ID = 1;

describe('computeRevealedNodeIds', () => {
  it('入口县、郡治及其一跳邻接初始揭示', () => {
    const inst = buildNanjunInstance();
    const revealed = computeRevealedNodeIds(inst, PLAYER_FACTION_ID, []);
    // 入口：当阳/枝江；郡治：江陵
    expect(revealed).toContain('nanjun_dangyang');
    expect(revealed).toContain('nanjun_zhijiang');
    expect(revealed).toContain('nanjun_jiangling');
    // 当阳一跳邻接（临沮/编/宜城/鄀/江陵/枝江）
    expect(revealed).toContain('nanjun_linju');
    expect(revealed).toContain('nanjun_bian');
    expect(revealed).toContain('nanjun_yicheng');
    expect(revealed).toContain('nanjun_ruo');
    // 江陵（郡治）一跳邻接华容 → 揭示（首批可攻打县华容可点）
    expect(revealed).toContain('nanjun_huarong');
    // 远郊县（州陵/巫/秭归/夷陵）不被初始揭示
    expect(revealed).not.toContain('nanjun_zhouling');
    expect(revealed).not.toContain('nanjun_wu');
    expect(revealed).not.toContain('nanjun_zigui');
    expect(revealed).not.toContain('nanjun_yiling');
  });

  it('占领县及其一跳邻接被揭示（视野扩张）', () => {
    const inst = buildNanjunInstance({ occupiedByPlayer: ['nanjun_huarong'] });
    const revealed = computeRevealedNodeIds(inst, PLAYER_FACTION_ID, []);
    expect(revealed).toContain('nanjun_huarong');
    // 华容一跳邻接：州陵 → 被揭示
    expect(revealed).toContain('nanjun_zhouling');
  });

  it('攻方 Army 所在县及其一跳邻接被揭示', () => {
    const inst = buildNanjunInstance({ playerArmyNode: 'nanjun_yiling' });
    const revealed = computeRevealedNodeIds(inst, PLAYER_FACTION_ID, ['army-p1']);
    expect(revealed).toContain('nanjun_yiling');
    expect(revealed).toContain('nanjun_yidao');
    expect(revealed).toContain('nanjun_zigui');
    // 非邻接远郊县仍迷雾
    expect(revealed).not.toContain('nanjun_zhouling');
  });

  it('守方 Army 所在县不被攻方视为揭示源', () => {
    const inst = buildNanjunInstance({ playerArmyNode: 'nanjun_yiling' });
    // 攻方 Army 列表不含 army-d1 → 该节点（及其邻接）不作为揭示源
    const revealed = computeRevealedNodeIds(inst, PLAYER_FACTION_ID, []);
    expect(revealed).not.toContain('nanjun_yiling');
  });
});

describe('maskBattlefieldInstanceForPlayer', () => {
  it('未揭示县军情置未知并记入 foggedNodeIds，地理字段保留', () => {
    const inst = buildNanjunInstance({ occupiedByPlayer: ['nanjun_dangyang'] });
    const masked = maskBattlefieldInstanceForPlayer(inst, PLAYER_FACTION_ID, []);
    const fogged = new Set(masked.foggedNodeIds ?? []);
    // 揭示：入口（当阳/枝江）+ 郡治江陵 + 占领当阳 + 各一跳邻接
    expect(fogged).toContain('nanjun_zhouling');
    expect(fogged).toContain('nanjun_wu');
    expect(fogged).not.toContain('nanjun_jiangling');
    expect(fogged).not.toContain('nanjun_dangyang');

    const foggedNode = masked.nodeStates.find((n) => n.nodeId === 'nanjun_zhouling')!;
    expect(foggedNode.garrison).toBe(0);
    expect(foggedNode.wallDurability).toBe(0);
    expect(foggedNode.armyIds).toEqual([]);
    // 地理层保留
    expect(foggedNode.name).toBe('州陵');
    expect(foggedNode.localX).toBeGreaterThan(0);
    expect(foggedNode.adjacentNodeIds).toContain('nanjun_huarong');
  });

  it('已揭示县军情原样保留', () => {
    const inst = buildNanjunInstance({ occupiedByPlayer: ['nanjun_huarong'] });
    const masked = maskBattlefieldInstanceForPlayer(inst, PLAYER_FACTION_ID, []);
    const huarong = masked.nodeStates.find((n) => n.nodeId === 'nanjun_huarong')!;
    expect(huarong.rulerFactionId).toBe(1);
    expect(huarong.garrison).toBe(500);
    // 郡治江陵始终揭示（守军可见）
    const jiangling = masked.nodeStates.find((n) => n.nodeId === 'nanjun_jiangling')!;
    expect(masked.foggedNodeIds).not.toContain('nanjun_jiangling');
    expect(jiangling.garrison).toBeGreaterThan(0);
  });

  it('dynamicSituation.deployments 只保留已揭示节点的攻方 Army', () => {
    const inst = buildNanjunInstance({ playerArmyNode: 'nanjun_yiling' });
    const withDeployments = {
      ...inst,
      dynamicSituation: {
        weather: 'clear' as const,
        deployments: [
          { armyId: 'army-p1', nodeId: 'nanjun_yiling' },
          { armyId: 'army-d1', nodeId: 'nanjun_zhouling' },
        ],
        attackerScouted: true,
        defenderScouted: false,
        ambush: 'none' as const,
        encounterOrder: ['army-p1'],
      },
    };
    const masked = maskBattlefieldInstanceForPlayer(withDeployments, PLAYER_FACTION_ID, ['army-p1']);
    // 攻方 Army 在已揭示节点 → 保留；守方 Army 在迷雾节点 → 剔除
    expect(masked.dynamicSituation?.deployments).toEqual([
      { armyId: 'army-p1', nodeId: 'nanjun_yiling' },
    ]);
  });

  it('不修改入参（纯函数）', () => {
    const inst = buildNanjunInstance({ occupiedByPlayer: ['nanjun_dangyang'] });
    const before = JSON.stringify(inst);
    maskBattlefieldInstanceForPlayer(inst, PLAYER_FACTION_ID, []);
    expect(JSON.stringify(inst)).toBe(before);
  });
});
