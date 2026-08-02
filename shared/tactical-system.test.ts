// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import configJson from './data/tactical-system.v1.json';
import v2ConfigJson from './data/tactical-system.v2.json';
import { BattleRuleRegistry, TACTIC_SYNERGY_NEUTRAL, TacticalEventBus, TacticalUndoStack, duelTriggerChance, migrateTacticalV1ToV2, parseTacticalConfig, parseTacticalConfigV2, resolveFormationTactic, resolveTacticSynergy, tacticModifiers, transitionTacticalPhase } from './tactical-system.js';

describe('tactical-system', () => {
  it('配置 v1 经 Zod 校验且含5阵3术', () => { const c = parseTacticalConfig(configJson); expect(c.formations).toHaveLength(5); expect(c.tactics).toHaveLength(3); });
  it('配置 v2 经 Zod 校验且不含阵型属性', () => { const c = parseTacticalConfigV2(v2ConfigJson); expect(c.schemaVersion).toBe(2); expect(c.tactics).toHaveLength(3); expect('formations' in c).toBe(false); expect(c.tactics[0].strongAgainstFormationIds).toEqual([0, 1, 3]); });
  it('v1→v2 迁移夹具：强攻/固守/奇袭数字 ID 关系准确', () => {
    const v2 = migrateTacticalV1ToV2(parseTacticalConfig(configJson));
    expect(v2.schemaVersion).toBe(2);
    expect(v2.tactics.find((t) => t.id === 'assault')?.strongAgainstFormationIds).toEqual([0, 1, 3]); // 方/圆/雁行
    expect(v2.tactics.find((t) => t.id === 'hold')?.strongAgainstFormationIds).toEqual([6]); // 锋矢，长蛇后置
    expect(v2.tactics.find((t) => t.id === 'ambush')?.strongAgainstFormationIds).toEqual([4]); // 鹤翼，长蛇后置
    expect(() => parseTacticalConfigV2(v2)).not.toThrow();
  });
  it('v1 文件保持只读，不因迁移改变', () => { expect(configJson.formations).toHaveLength(5); expect(configJson.schemaVersion).toBe(1); });
  it('阶段仅允许规定方向且记录确定性来源时间', () => {
    expect(transitionTacticalPhase('turn_start', 'move', 2, 4, 'system')).toMatchObject({ logicalTimestamp: 2004, source: 'system' });
    expect(() => transitionTacticalPhase('move', 'skill', 1, 1, 'player')).toThrow('INVALID_PHASE_TRANSITION');
  });
  it('事件总线支持同步、异步与退订', async () => {
    const bus = new TacticalEventBus(); const sync = vi.fn(); const async = vi.fn();
    const off = bus.subscribe('unit.moved', sync); bus.subscribe('unit.moved', async, 'async');
    const event = { type: 'unit.moved' as const, payload: { unitId: 'u', from: '0,0', to: '1,0', cost: 1 } };
    await bus.emitAndWait(event); expect(sync).toHaveBeenCalledOnce(); expect(async).toHaveBeenCalledOnce(); off(); bus.emit(event); expect(sync).toHaveBeenCalledOnce();
  });
  it('撤销栈最多3步并拒绝撤销已消费随机数的攻击', () => {
    const stack = new TacticalUndoStack<number>(); for (let i = 0; i < 4; i++) stack.push({ id: `${i}`, kind: 'move', before: i, after: i + 1, reversible: true, logicalTimestamp: i });
    expect(stack.snapshot()).toHaveLength(3); expect(stack.undo()).toBe(3);
    stack.push({ id: 'attack', kind: 'attack', before: 3, after: 2, reversible: false, logicalTimestamp: 9 }); expect(() => stack.undo()).toThrow('UNDO_IRREVERSIBLE:attack');
  });
  it('规则注册表遵守三段式并拒绝重复/未知规则', () => {
    const registry = new BattleRuleRegistry(); const rule = { id: 'demo', initialize: (n: number) => n + 1, execute: (n: number, x: number) => n * x, settle: (n: number, xs: readonly number[]) => n + xs.reduce((a, b) => a + b, 0) };
    registry.register(rule); const resolved = registry.resolve<number, number, number>('demo'); expect(resolved.settle(resolved.initialize(1), [resolved.execute(2, 3)])).toBe(8);
    expect(() => registry.register(rule)).toThrow('RULE_ALREADY_REGISTERED'); expect(() => registry.resolve('missing')).toThrow('RULE_NOT_FOUND');
  });
  it('阵型战术按固定叠加顺序产生协同/克制', () => { const c = parseTacticalConfig(configJson); const m = resolveFormationTactic(c, 'goose_wing', 'assault'); expect(m.synergy).toBe(1.1); expect(m.attack).toBeCloseTo(0.363); });
  it('单挑双入口门禁和概率封顶', () => {
    expect(duelTriggerChance({ source: 'melee', adjacent: true, bothCommandersActive: true, challengerMorale: 30, defenderMorale: 80, challengerBravery: 7, configuredChance: 0.1 })).toBe(0);
    expect(duelTriggerChance({ source: 'battlefield', adjacent: true, bothCommandersActive: true, challengerMorale: 100, defenderMorale: 0, challengerBravery: 99, configuredChance: 0.5 })).toBe(0.95);
  });
  it('战术协同矩阵（FM-P3）：synergy 1.1/1.0、0-A 无 0.9 触发源、null 中性', () => {
    const c = parseTacticalConfigV2(v2ConfigJson);
    expect(resolveTacticSynergy(c, 'assault', 0)).toBe(1.1); // 强攻克方阵
    expect(resolveTacticSynergy(c, 'assault', 3)).toBe(1.1); // 强攻克雁行
    expect(resolveTacticSynergy(c, 'assault', 2)).toBe(1.0); // 锥形中性
    expect(resolveTacticSynergy(c, 'hold', 6)).toBe(1.1);    // 固守克锋矢
    expect(resolveTacticSynergy(c, 'ambush', 4)).toBe(1.1);  // 奇袭克鹤翼
    expect(resolveTacticSynergy(c, 'hold', 0)).toBe(1.0);    // 无反向表 → 无 0.9
    expect(resolveTacticSynergy(c, null, 0)).toBe(1.0);      // 未设战术中性
    expect(resolveTacticSynergy(c, undefined, 0)).toBe(1.0);
    expect(resolveTacticSynergy(c, 'ambush', 2)).toBe(TACTIC_SYNERGY_NEUTRAL); // 1.0
  });
  it('战术自身修正（T_base，不受组织度缩放）', () => {
    const c = parseTacticalConfigV2(v2ConfigJson);
    expect(tacticModifiers(c, 'assault')).toEqual({ attack: 0.25, defense: -0.15, initiative: 0.1 });
    expect(tacticModifiers(c, 'hold')).toEqual({ attack: -0.1, defense: 0.3, initiative: -0.1 });
    expect(tacticModifiers(c, 'ambush')).toEqual({ attack: 0.15, defense: -0.05, initiative: 0.3 });
    expect(tacticModifiers(c, null)).toEqual({ attack: 0, defense: 0, initiative: 0 });
    expect(tacticModifiers(c, undefined)).toEqual({ attack: 0, defense: 0, initiative: 0 });
  });
});
