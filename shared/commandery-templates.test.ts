// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { describe, expect, it } from 'vitest';
import {
  COMMANDERY_TEMPLATES,
  getCommanderyIds,
  getCommanderyLabel,
  getCommanderyLabelByTemplateId,
  getCommanderyTemplate,
  getCommanderyTemplateByTemplateId,
} from './commandery-templates.js';
import { HistoricalGeographyBundleSchema } from './data/historical-geography/schema.js';
import { generateCommanderyBattlefield } from './commandery-battlefield.js';

const BASE_OPTS = {
  instanceId: 'bf-test',
  warId: 'war-test',
  attackerFactionId: 1,
  defenderFactionId: 2,
  armyIds: [],
  entryNodeIds: [] as string[],
  rngDrawStart: 0,
};

describe('COMMANDERY_TEMPLATES — 目录登记', () => {
  it('南郡与颍川已登记', () => {
    expect(getCommanderyIds().sort()).toEqual(['nanjun', 'yingchuan'].sort());
  });

  it('每项 bundle 均通过 Zod schema（目录是逐郡校验唯一真源）', () => {
    for (const entry of Object.values(COMMANDERY_TEMPLATES)) {
      expect(HistoricalGeographyBundleSchema.safeParse(entry.bundle).success).toBe(true);
    }
  });

  it('entryNodeIds 必须引用模板内县节点（供 generateCommanderyBattlefield 消费）', () => {
    for (const entry of Object.values(COMMANDERY_TEMPLATES)) {
      const countyIds = new Set(entry.bundle.counties.map(({ id }) => id));
      expect(entry.entryNodeIds.length).toBeGreaterThan(0);
      for (const id of entry.entryNodeIds) {
        expect(countyIds.has(id)).toBe(true);
      }
    }
  });

  it('entryNodeIds 可直接生成实例（模板目录→生成器闭环）', () => {
    for (const entry of Object.values(COMMANDERY_TEMPLATES)) {
      const inst = generateCommanderyBattlefield({
        ...BASE_OPTS,
        instanceId: `bf-${entry.id}-t`,
        warId: `war-${entry.id}-t`,
        bundle: entry.bundle,
        templateId: entry.templateId,
        entryNodeIds: entry.entryNodeIds,
      });
      expect(inst.templateId).toBe(entry.templateId);
      expect(inst.entryNodeIds).toEqual(entry.entryNodeIds);
      expect(inst.targetSeatNodeId).toBe(entry.bundle.commanderies[0].seatCountyId);
    }
  });
});

describe('COMMANDERY_TEMPLATES — 查找助手', () => {
  it('getCommanderyTemplate / getCommanderyTemplateByTemplateId 命中与缺失', () => {
    expect(getCommanderyTemplate('nanjun')?.label).toBe('南郡');
    expect(getCommanderyTemplate('nope')).toBeUndefined();
    expect(getCommanderyTemplateByTemplateId('yingchuan-190')?.id).toBe('yingchuan');
    expect(getCommanderyTemplateByTemplateId('nope-190')).toBeUndefined();
  });

  it('getCommanderyLabel / getCommanderyLabelByTemplateId 命中与缺失', () => {
    expect(getCommanderyLabel('yingchuan')).toBe('颍川郡');
    expect(getCommanderyLabel('nope')).toBeUndefined();
    expect(getCommanderyLabelByTemplateId('nanjun-190')).toBe('南郡');
    expect(getCommanderyLabelByTemplateId('nope-190')).toBeUndefined();
  });
});
