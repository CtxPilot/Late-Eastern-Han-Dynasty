// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import {
  ORGANIZATION_BANDS,
  applyOrganizationExecution,
  explainFormationResolution,
  getAvailableFormations,
  organizationBandFor,
  projectHexDeployment,
  resolveFormationContribution,
  resolveFormationDeployment,
} from './formation-core.js';
import type { Formation } from './types/formation.js';

const baseFormation = (overrides: Partial<Formation>): Formation => ({
  id: 0, name: '方阵', description: '', historicalSource: '',
  family: 'land',
  tiers: [{ level: 1, attack: 1, defense: 1, mobility: 0, range: 0 }],
  ultimate: { attackBonus: 0, defenseBonus: 0, mobilityBonus: 0, rangeBonus: 0, effect: '', proficiencyRequired: 500 },
  effects: [],
  allowedUnits: ['lightInfantry'], bestUnits: ['heavyInfantry'], restrictedUnits: ['heavyCavalry'],
  terrainModifiers: {},
  deployment: {
    slots: { center: { q: 0, r: 0 }, vanguard: { q: 0, r: 1 }, left: { q: -1, r: 0 }, right: { q: 1, r: 0 }, rearguard: { q: 0, r: -1 } },
    fallbackOrder: ['rearguard', 'vanguard', 'left', 'right'],
    symmetry: 'symmetric',
  },
  ...overrides,
});

const catalog: readonly Formation[] = [
  baseFormation({}),
  baseFormation({ id: 1, name: '圆阵', effects: [{ name: '反击', description: '', modifier: { type: 'counter_rate', value: 10 } }] }),
  baseFormation({ id: 2, name: '锥形', allowedUnits: ['heavyCavalry'], effects: [{ name: '连击', description: '', modifier: { type: 'chain_rate', value: 5 } }] }),
  baseFormation({ id: 3, name: '雁行' }),
  baseFormation({ id: 4, name: '鹤翼' }),
  baseFormation({ id: 6, name: '锋矢' }),
];

describe('formation-core', () => {
  it('组织度五档边界准确', () => {
    expect(organizationBandFor(80).band).toBe('intact');
    expect(organizationBandFor(79).band).toBe('orderly');
    expect(organizationBandFor(60).band).toBe('orderly');
    expect(organizationBandFor(59).band).toBe('loose');
    expect(organizationBandFor(40).band).toBe('loose');
    expect(organizationBandFor(39).band).toBe('chaos');
    expect(organizationBandFor(20).band).toBe('chaos');
    expect(organizationBandFor(19).band).toBe('broken');
    expect(ORGANIZATION_BANDS).toHaveLength(5);
  });

  it('getAvailableFormations 尊重精通/兵种限制', () => {
    const avail = getAvailableFormations({ catalog, mastered: [0, 2] });
    const byId = Object.fromEntries(avail.map((a) => [a.formationId, a]));
    expect(byId[0].available).toBe(true);
    expect(byId[2].available).toBe(true); // 已掌握且兵种允许
    expect(byId[1].available).toBe(false); // 未掌握
    // 锥形限制重骑，用轻步则不可用
    const inf = getAvailableFormations({ catalog, mastered: [0, 1, 2], unitType: 'lightInfantry' });
    expect(inf.find((a) => a.formationId === 2)?.available).toBe(false);
    expect(inf.find((a) => a.formationId === 2)?.blockReason).toBe('unit_not_allowed');
  });

  it('getAvailableFormations 不含冲阵 16', () => {
    const avail = getAvailableFormations({ catalog, mastered: [0, 1, 2, 3, 4, 6, 16] });
    expect(avail.map((a) => a.formationId)).toEqual([0, 1, 2, 3, 4, 6]);
  });

  it('被协同包围时只保留方阵', () => {
    const avail = getAvailableFormations({ catalog, mastered: [0, 1, 2, 3, 4, 6], isSurrounded: true });
    const byId = Object.fromEntries(avail.map((a) => [a.formationId, a]));
    expect(byId[0].available).toBe(true);
    expect(byId[1].available).toBe(false);
    expect(byId[1].blockReason).toBe('surrounded');
  });

  it('resolveFormationContribution 读 tiers[0] 与 effects 暴击链', () => {
    const c = resolveFormationContribution(catalog, 1, 75);
    expect(c.attack).toBe(1);
    expect(c.counterRate).toBe(10);
    expect(c.organizationBand).toBe('orderly');
    expect(c.organizationExecution).toBe(1.0);
  });

  it('组织度只缩放正面增量，负修正原值保留', () => {
    expect(applyOrganizationExecution(5, 1.2)).toBe(6);
    expect(applyOrganizationExecution(-2, 1.2)).toBe(-2);
    expect(applyOrganizationExecution(5, 0)).toBe(0);
    expect(applyOrganizationExecution(-2, 0)).toBe(-2);
  });

  it('resolveFormationDeployment 主将在中军、缺部收缩', () => {
    const record = catalog[0];
    const dep = resolveFormationDeployment(record, ['vanguard', 'center', 'left', 'right']);
    expect(dep.occupied).toContain('center');
    expect(dep.slots.center).toEqual({ q: 0, r: 0 });
  });

  it('projectHexDeployment 按攻守镜像并避开已占格', () => {
    const record = catalog[0];
    const deployment = resolveFormationDeployment(record, ['center', 'left', 'right']);
    const attacker = projectHexDeployment(deployment, ['center', 'left', 'right'], { q: 5, r: 5 }, 'attacker', { width: 20, height: 15 });
    const defender = projectHexDeployment(deployment, ['center', 'left', 'right'], { q: 14, r: 9 }, 'defender', { width: 20, height: 15 });
    expect(attacker.center?.position).toEqual({ q: 5, r: 5 });
    expect(attacker.left?.position).toEqual({ q: 4, r: 5 });
    expect(defender.left?.position).toEqual({ q: 15, r: 9 });
    expect(new Set(Object.values(attacker).map((item) => `${item.position.q},${item.position.r}`)).size).toBe(3);
  });

  it('explainFormationResolution 逐项解释', () => {
    const c = resolveFormationContribution(catalog, 6, 80);
    const items = explainFormationResolution(c, catalog.find((f) => f.id === 6));
    expect(items.some((i) => i.dimension === 'base')).toBe(true);
    expect(items.some((i) => i.dimension === 'organization')).toBe(true);
  });
});
