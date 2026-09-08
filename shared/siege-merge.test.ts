// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * docs/43 S1 围城合流纯函数（Session 433）：D3 合流判定 / D4 合成军 / D7 损耗分摊。
 */
import { describe, expect, it } from 'vitest';
import { FormationType, UnitType } from './enums/index.js';
import type { CampaignArmy } from './types/campaign.js';
import {
  apportionArmyLosses,
  buildMergedSiegeArmy,
  collectSiegeMergeGroup,
} from './campaign-utils.js';

function army(overrides: Partial<CampaignArmy> & { id: string; troops: number }): CampaignArmy {
  return {
    factionId: 1,
    name: `${overrides.id}军`,
    commanderId: 10,
    subCommanderIds: [],
    unitType: UnitType.LIGHT_INFANTRY,
    formation: FormationType.SQUARE,
    currentNodeId: 11,
    targetNodeId: 11,
    path: [],
    phase: 'sieging',
    maxTroops: overrides.troops,
    food: 3000,
    maxFood: 9000,
    morale: 80,
    organization: 80,
    experience: 0,
    fatigue: 0,
    squads: [],
    structures: [],
    fromNodeId: 5,
    ...overrides,
  };
}

describe('collectSiegeMergeGroup（D3 合流判定）', () => {
  it('只收集同势力 + 同围城目标 + sieging 的军，兵力降序 → id 升序', () => {
    const armies = [
      army({ id: 'b', troops: 3000 }),
      army({ id: 'a', troops: 3000 }),
      army({ id: 'c', troops: 5000 }),
      army({ id: 'd', troops: 9000, factionId: 2 }),
      army({ id: 'e', troops: 9000, targetNodeId: 12 }),
      army({ id: 'f', troops: 9000, phase: 'engaged' }),
    ];
    const group = collectSiegeMergeGroup(armies, 'a');
    expect(group.map((a) => a.id)).toEqual(['c', 'a', 'b']);
  });

  it('非围城军 / 未知 id 返回空数组', () => {
    const armies = [army({ id: 'f', troops: 9000, phase: 'engaged' })];
    expect(collectSiegeMergeGroup(armies, 'f')).toEqual([]);
    expect(collectSiegeMergeGroup(armies, 'nope')).toEqual([]);
  });

  it('targetNodeId 缺省回退 currentNodeId', () => {
    const armies = [
      army({ id: 'a', troops: 1000, targetNodeId: undefined, currentNodeId: 11 }),
      army({ id: 'b', troops: 2000, targetNodeId: 11, currentNodeId: 12 }),
    ];
    expect(collectSiegeMergeGroup(armies, 'a').map((a) => a.id)).toEqual(['b', 'a']);
  });
});

describe('buildMergedSiegeArmy（D4 合成军）', () => {
  it('单军组原样返回真身（R4）', () => {
    const solo = army({ id: 'solo', troops: 4000 });
    expect(buildMergedSiegeArmy([solo])).toBe(solo);
  });

  it('兵力/粮草求和，品质四维按兵力加权 floor，主军主导编成', () => {
    const primary = army({
      id: 'p',
      troops: 6000,
      food: 1000,
      maxTroops: 6000,
      maxFood: 18000,
      morale: 90,
      organization: 60,
      fatigue: 10,
      experience: 900,
      commanderId: 1,
      subCommanderIds: [2],
    });
    const second = army({
      id: 's',
      troops: 4000,
      food: 500,
      maxTroops: 4000,
      maxFood: 12000,
      morale: 40,
      organization: 90,
      fatigue: 60,
      experience: 400,
      commanderId: 3,
      subCommanderIds: [4],
    });
    const merged = buildMergedSiegeArmy([primary, second]);
    expect(merged.id).toBe('p');
    expect(merged.commanderId).toBe(1);
    expect(merged.unitType).toBe(primary.unitType);
    expect(merged.formation).toBe(primary.formation);
    expect(merged.troops).toBe(10000);
    expect(merged.maxTroops).toBe(10000);
    expect(merged.food).toBe(1500);
    expect(merged.maxFood).toBe(30000);
    // 加权 floor：(90×6000 + 40×4000)/10000 = 70；(60×6000+90×4000)/10000 = 72；(10×6000+60×4000)/10000 = 30
    expect(merged.morale).toBe(70);
    expect(merged.organization).toBe(72);
    expect(merged.fatigue).toBe(30);
    expect(merged.experience).toBe(700);
    // 非主军主将以协同指挥身份参战，可成为战损对象
    expect(merged.subCommanderIds).toEqual([2, 3, 4]);
  });

  it('squads/structures 按军序拼接，保侧击/器械语义', () => {
    const squad = (position: 'left' | 'right', officerId: number): CampaignArmy['squads'][number] => ({
      officerId,
      role: 'main',
      position,
      unitType: UnitType.LIGHT_INFANTRY,
      troops: 1000,
      morale: 80,
    });
    const structure = (
      type: 'ram' | 'catapult',
      builderId: number,
    ): CampaignArmy['structures'][number] => ({
      type,
      builderId,
      buildProgress: 1,
      durability: 100,
      effect: '',
      nodeId: 11,
    });
    const primary = army({
      id: 'p',
      troops: 6000,
      squads: [squad('left', 1)],
      structures: [structure('ram', 1)],
    });
    const second = army({
      id: 's',
      troops: 4000,
      squads: [squad('right', 3)],
      structures: [structure('catapult', 3)],
    });
    const merged = buildMergedSiegeArmy([primary, second]);
    expect(merged.squads.map((s) => s.position)).toEqual(['left', 'right']);
    expect(merged.structures.map((s) => s.type)).toEqual(['ram', 'catapult']);
  });
});

describe('apportionArmyLosses（D7/R2 损耗分摊）', () => {
  it('按兵力占比 floor 分摊，尾差归主军', () => {
    const group = [
      army({ id: 'p', troops: 6000 }),
      army({ id: 's', troops: 4000 }),
      army({ id: 't', troops: 1000 }),
    ];
    const losses = apportionArmyLosses(group, 1234);
    expect(losses).toEqual([674, 448, 112]);
    expect(losses.reduce((n, l) => n + l, 0)).toBe(1234);
  });

  it('零损耗/空组返回全零', () => {
    expect(apportionArmyLosses([army({ id: 'p', troops: 1000 })], 0)).toEqual([0]);
    expect(apportionArmyLosses([], 100)).toEqual([]);
  });

  it('损耗夹紧到各军兵力（不出现负兵力）', () => {
    const group = [army({ id: 'p', troops: 1 }), army({ id: 's', troops: 1 })];
    const losses = apportionArmyLosses(group, 2);
    expect(losses).toEqual([1, 1]);
    expect(losses.every((l, i) => l <= group[i]!.troops)).toBe(true);
  });
});
