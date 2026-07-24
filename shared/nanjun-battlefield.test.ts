// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import { nanjun190 } from './data/historical-geography/index.js';
import { BattlefieldInstanceSchema } from './battlefield-instance-schema.js';
import { generateNanjunBattlefield, NANJUN_JIANGLING_NODE_ID } from './nanjun-battlefield.js';

const opts = {
  instanceId: 'bf-test-1',
  warId: 'war-test-1',
  attackerFactionId: 4,
  defenderFactionId: 1,
  armyIds: ['army-1'],
  rngDrawStart: 100,
};

describe('generateNanjunBattlefield — 对照 nanjun190 数据', () => {
  const inst = generateNanjunBattlefield(opts);

  it('nodeStates 含全郡 16 县', () => {
    expect(inst.nodeStates).toHaveLength(nanjun190.counties.length);
    expect(inst.nodeStates.length).toBe(16);
  });

  it('routeStates 含全 11 路线', () => {
    expect(inst.routeStates).toHaveLength(nanjun190.routes.length);
    expect(inst.routeStates.length).toBe(11);
  });

  it('targetSeatNodeId = 江陵', () => {
    expect(inst.targetSeatNodeId).toBe(NANJUN_JIANGLING_NODE_ID);
    expect(inst.targetSeatNodeId).toBe('nanjun_jiangling');
  });

  it('江陵为 seat 角色，守方据点', () => {
    const jiangling = inst.nodeStates.find((n) => n.nodeId === 'nanjun_jiangling');
    expect(jiangling?.role).toBe('seat');
    expect(jiangling?.rulerFactionId).toBe(opts.defenderFactionId);
    expect(jiangling?.garrison).toBe(5000);
    expect(jiangling?.wallDurability).toBe(100);
    expect(jiangling?.maxWallDurability).toBe(100);
  });

  it('非 seat 县中立（rulerFactionId=null, 无城防）', () => {
    const dangyang = inst.nodeStates.find((n) => n.nodeId === 'nanjun_dangyang');
    expect(dangyang?.rulerFactionId).toBeNull();
    expect(dangyang?.garrison).toBe(0);
    expect(dangyang?.wallDurability).toBe(0);
  });

  it('entryNodeIds 在 nodeStates 中', () => {
    const nodeIds = new Set(inst.nodeStates.map((n) => n.nodeId));
    for (const e of inst.entryNodeIds) {
      expect(nodeIds.has(e)).toBe(true);
    }
    expect(inst.entryNodeIds).toContain('nanjun_dangyang');
    expect(inst.entryNodeIds).toContain('nanjun_zhijiang');
  });

  it('templateId/templateVersion 正确', () => {
    expect(inst.templateId).toBe('nanjun-190');
    expect(inst.templateVersion).toBe(1);
  });

  it('生成审计 rngAlgorithm=xorshift32-v1', () => {
    expect(inst.generationAudit.rngAlgorithm).toBe('xorshift32-v1');
    expect(inst.generationAudit.rngDrawStart).toBe(100);
  });
});

describe('generateNanjunBattlefield — Zod 与存档往返', () => {
  const inst = generateNanjunBattlefield(opts);

  it('BattlefieldInstanceSchema.parse 通过', () => {
    const parsed = BattlefieldInstanceSchema.parse(inst);
    expect(parsed.id).toBe(inst.id);
    expect(parsed.nodeStates.length).toBe(16);
  });

  it('JSON 往返一致（存档序列化/反序列化）', () => {
    const json = JSON.stringify(inst);
    const restored = JSON.parse(json);
    const parsed = BattlefieldInstanceSchema.parse(restored);
    expect(parsed).toEqual(inst);
  });

  it('自定义 seatGarrison/seatWallDurability 生效', () => {
    const custom = generateNanjunBattlefield({ ...opts, seatGarrison: 3000, seatWallDurability: 150 });
    const jiangling = custom.nodeStates.find((n) => n.nodeId === 'nanjun_jiangling');
    expect(jiangling?.garrison).toBe(3000);
    expect(jiangling?.wallDurability).toBe(150);
    expect(jiangling?.maxWallDurability).toBe(150);
  });

  it('拒绝 targetSeatNodeId 不是 seat 角色', () => {
    const broken = { ...inst, targetSeatNodeId: 'nanjun_dangyang' };
    const r = BattlefieldInstanceSchema.safeParse(broken);
    expect(r.success).toBe(false);
  });

  it('拒绝空 nodeStates', () => {
    const broken = { ...inst, nodeStates: [] };
    const r = BattlefieldInstanceSchema.safeParse(broken);
    expect(r.success).toBe(false);
  });
});
