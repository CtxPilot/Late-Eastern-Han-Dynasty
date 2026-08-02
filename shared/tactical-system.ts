// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';

/** 细分回合状态；服务端只能按此有向图推进，禁止 UI 自行跳段。 */
export const TACTICAL_PHASES = ['turn_start', 'move', 'attack', 'skill', 'turn_end', 'enemy', 'over'] as const;
export type TacticalPhase = typeof TACTICAL_PHASES[number];

const PHASE_NEXT: Record<TacticalPhase, readonly TacticalPhase[]> = {
  turn_start: ['move'], move: ['attack', 'turn_end'], attack: ['skill', 'turn_end'],
  skill: ['turn_end'], turn_end: ['enemy'], enemy: ['turn_start', 'over'], over: [],
};

export interface TacticalTransition {
  from: TacticalPhase;
  to: TacticalPhase;
  /** 确定性逻辑时间戳：战斗回合×1000+事件序号，不使用墙钟时间污染回放。 */
  logicalTimestamp: number;
  source: 'player' | 'ai' | 'system';
}

export function transitionTacticalPhase(current: TacticalPhase, to: TacticalPhase, turn: number, sequence: number, source: TacticalTransition['source']): TacticalTransition {
  if (!PHASE_NEXT[current].includes(to)) throw new Error(`INVALID_PHASE_TRANSITION:${current}->${to}`);
  return { from: current, to, logicalTimestamp: turn * 1000 + sequence, source };
}

export type TacticalEvent =
  | { type: 'phase.changed'; payload: TacticalTransition }
  | { type: 'unit.moved'; payload: { unitId: string; from: string; to: string; cost: number } }
  | { type: 'unit.attacked'; payload: { attackerId: string; defenderId: string; damage: number } }
  | { type: 'unit.status'; payload: { unitId: string; status: string; active: boolean } }
  | { type: 'duel.started'; payload: { challengerId: number; defenderId: number; source: 'battlefield' | 'melee' } };

type TacticalEventType = TacticalEvent['type'];
type EventOf<T extends TacticalEventType> = Extract<TacticalEvent, { type: T }>;
type EventHandler<T extends TacticalEventType> = (event: EventOf<T>) => void | Promise<void>;

/** 同步用于权威状态归约；异步用于表现/遥测，异步失败不回滚已提交的权威事件。 */
export class TacticalEventBus {
  private syncHandlers = new Map<TacticalEventType, Set<(event: TacticalEvent) => void | Promise<void>>>();
  private asyncHandlers = new Map<TacticalEventType, Set<(event: TacticalEvent) => void | Promise<void>>>();
  subscribe<T extends TacticalEventType>(type: T, handler: EventHandler<T>, mode: 'sync' | 'async' = 'sync'): () => void {
    const registry = mode === 'sync' ? this.syncHandlers : this.asyncHandlers;
    const set = registry.get(type) ?? new Set(); const broad = handler as unknown as (event: TacticalEvent) => void | Promise<void>;
    set.add(broad); registry.set(type, set);
    return () => set.delete(broad);
  }
  emit(event: TacticalEvent): void {
    for (const handler of this.syncHandlers.get(event.type) ?? []) void handler(event);
    for (const handler of this.asyncHandlers.get(event.type) ?? []) void Promise.resolve().then(() => handler(event));
  }
  async emitAndWait(event: TacticalEvent): Promise<void> {
    for (const handler of this.syncHandlers.get(event.type) ?? []) await handler(event);
    await Promise.all([...this.asyncHandlers.get(event.type) ?? []].map((handler) => handler(event)));
  }
}

export interface UndoableCommand<T> {
  id: string;
  kind: 'move' | 'attack';
  before: T;
  after: T;
  reversible: boolean;
  logicalTimestamp: number;
}

/** 最多三步。攻击一旦消费 RNG 或揭示信息必须以 reversible=false 入栈并拒绝撤销。 */
export class TacticalUndoStack<T> {
  private commands: UndoableCommand<T>[] = [];
  constructor(private readonly capacity = 3) {}
  push(command: UndoableCommand<T>) { this.commands = [...this.commands, command].slice(-this.capacity); }
  peek() { return this.commands.at(-1) ?? null; }
  undo(): T {
    const command = this.commands.at(-1);
    if (!command) throw new Error('UNDO_EMPTY');
    if (!command.reversible) throw new Error(`UNDO_IRREVERSIBLE:${command.kind}`);
    this.commands.pop(); return command.before;
  }
  snapshot() { return [...this.commands]; }
}

export const TacticalConfigSchema = z.object({
  schemaVersion: z.literal(1),
  grid: z.object({ maxWidth: z.number().int().min(1).max(100), maxHeight: z.number().int().min(1).max(100), animationFps: z.number().int().min(30).max(120) }),
  duel: z.object({ battlefieldChance: z.number().min(0).max(1), meleeChance: z.number().min(0).max(1), maxRounds: z.number().int().min(1).max(10) }),
  formations: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), attack: z.number(), defense: z.number(), mobility: z.number(), morale: z.number(), weakAgainst: z.array(z.string()) })).min(5),
  tactics: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), attack: z.number(), defense: z.number(), initiative: z.number(), strongAgainst: z.array(z.string()) })).min(3),
});
export type TacticalConfig = z.infer<typeof TacticalConfigSchema>;
export const parseTacticalConfig = (input: unknown): TacticalConfig => TacticalConfigSchema.parse(input);

// ====== TacticalConfig v2（FM-P1）======
//
// v2 不再复制阵型名称或攻防机射值；战术关系用稳定数字 ID（FormationType）表达。
// v1 文件只读保留为兼容/迁移测试夹具，见 `shared/data/tactical-system.v1.json`。
// 参考 `29-formation-integration-development-plan.md` §4.6 的 v1→v2 语义映射。

const TacticalTacticV2Schema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 强攻/固守/奇袭协同区 1.1 / 0.9 / 1.0 依赖这些数字 ID 关系；attack/defense 基础修正仍为战术自身，不受组织度缩放 */
  attack: z.number(),
  defense: z.number(),
  initiative: z.number(),
  /** 0-A 活跃协同阵型 ID（FormationType 稳定数字 ID），长蛇(8) 关系后置到 FM-P6/0-B */
  strongAgainstFormationIds: z.array(z.number().int().min(0).max(26)),
});

export const TacticalConfigV2Schema = z.object({
  schemaVersion: z.literal(2),
  grid: z.object({ maxWidth: z.number().int().min(1).max(100), maxHeight: z.number().int().min(1).max(100), animationFps: z.number().int().min(30).max(120) }),
  duel: z.object({ battlefieldChance: z.number().min(0).max(1), meleeChance: z.number().min(0).max(1), maxRounds: z.number().int().min(1).max(10) }),
  tactics: z.array(TacticalTacticV2Schema).min(3),
});
export type TacticalConfigV2 = z.infer<typeof TacticalConfigV2Schema>;
export const parseTacticalConfigV2 = (input: unknown): TacticalConfigV2 => TacticalConfigV2Schema.parse(input);

/** v1 阵型字符串 id → 0-A 活跃阵型数字 ID 映射（FM 计划 §4.6）。 */
const V1_FORMATION_ID_MAP: Record<string, number> = {
  square_circle: 0, // 方阵（v1 把方/圆合并为 square_circle；0-A 强攻协同区取方/圆/雁行 [0,1,3]）
  goose_wing: 3, // 雁行
  crane_wing: 4, // 鹤翼
  arrow: 6, // 锋矢
};

/**
 * v1 → v2 迁移夹具。仅用于把旧字符串关系映射为数字 ID 以验证迁移正确性；
 * v1 文件保持只读，不原地改形状，也不作为运行真源。
 */
export function migrateTacticalV1ToV2(v1: TacticalConfig): TacticalConfigV2 {
  const formationIdsFor = (ids: string[]): number[] => {
    const out = new Set<number>();
    for (const id of ids) {
      const mapped = V1_FORMATION_ID_MAP[id];
      if (mapped !== undefined) out.add(mapped);
    }
    return [...out].sort((a, b) => a - b);
  };

  // v1 每个战术 strongAgainst 是字符串数组；按 §4.6 语义重映射
  const resolve = (tacticId: string): number[] => {
    if (tacticId === 'assault') return [0, 1, 3]; // 强攻：方/圆/雁行
    if (tacticId === 'hold') return [6]; // 固守：锋矢（长蛇后置）
    if (tacticId === 'ambush') return [4]; // 奇袭：鹤翼（长蛇后置）
    return [];
  };

  return {
    schemaVersion: 2,
    grid: v1.grid,
    duel: v1.duel,
    tactics: v1.tactics.map((t) => ({
      id: t.id,
      name: t.name,
      attack: t.attack,
      defense: t.defense,
      initiative: t.initiative,
      strongAgainstFormationIds: resolve(t.id).length > 0 ? resolve(t.id) : formationIdsFor(t.strongAgainst),
    })),
  };
}

/** 插件式规则策略：第三方规则只能经 init/execute/settle 三段进入编排层。 */
export interface BattleRuleStrategy<TContext, TCommand, TResult> {
  readonly id: string;
  initialize(context: TContext): TContext;
  execute(context: TContext, command: TCommand): TResult;
  settle(context: TContext, results: readonly TResult[]): TContext;
}

export class BattleRuleRegistry {
  private rules = new Map<string, BattleRuleStrategy<unknown, unknown, unknown>>();
  register<TC, TM, TR>(rule: BattleRuleStrategy<TC, TM, TR>): void {
    if (this.rules.has(rule.id)) throw new Error(`RULE_ALREADY_REGISTERED:${rule.id}`);
    this.rules.set(rule.id, rule as BattleRuleStrategy<unknown, unknown, unknown>);
  }
  resolve<TC, TM, TR>(id: string): BattleRuleStrategy<TC, TM, TR> {
    const rule = this.rules.get(id); if (!rule) throw new Error(`RULE_NOT_FOUND:${id}`);
    return rule as BattleRuleStrategy<TC, TM, TR>;
  }
}

export interface FormationTacticModifiers { attack: number; defense: number; mobility: number; morale: number; initiative: number; synergy: number }
/** 加法修正先合并，协同/克制作为最后乘区；避免不同插件改变运算顺序。 */
export function resolveFormationTactic(config: TacticalConfig, formationId: string, tacticId: string): FormationTacticModifiers {
  const formation = config.formations.find((item) => item.id === formationId); const tactic = config.tactics.find((item) => item.id === tacticId);
  if (!formation) throw new Error(`FORMATION_NOT_FOUND:${formationId}`); if (!tactic) throw new Error(`TACTIC_NOT_FOUND:${tacticId}`);
  const weak = formation.weakAgainst.includes(tacticId); const strong = tactic.strongAgainst.includes(formationId);
  const synergy = strong ? 1.1 : weak ? 0.9 : 1;
  return { attack: (formation.attack + tactic.attack) * synergy, defense: (formation.defense + tactic.defense) * synergy, mobility: formation.mobility, morale: formation.morale, initiative: tactic.initiative, synergy };
}

export interface DuelTriggerInput { source: 'battlefield' | 'melee'; adjacent: boolean; bothCommandersActive: boolean; challengerMorale: number; defenderMorale: number; challengerBravery: number; configuredChance: number }
export function duelTriggerChance(input: DuelTriggerInput): number {
  if (!input.adjacent || !input.bothCommandersActive || (input.source === 'melee' && Math.min(input.challengerMorale, input.defenderMorale) < 40)) return 0;
  return Math.min(0.95, Math.max(0, input.configuredChance + input.challengerBravery * 0.01 + (input.challengerMorale - input.defenderMorale) * 0.002));
}

// ====== 战术协同矩阵（FM-P3 · TacticalConfig v2 真源） ======

/** 0-A 可设定的持久战术姿态（计划 §4.6：强攻/固守/奇袭，v2 tactics id） */
export const ACTIVE_TACTIC_IDS = ['assault', 'hold', 'ambush'] as const;
export type TacticalTacticId = typeof ACTIVE_TACTIC_IDS[number];

/** 协同区 1.1 / 0.9 / 1.0（计划 §4.6、27 §6.3）。 */
export const TACTIC_SYNERGY_STRONG = 1.1;
export const TACTIC_SYNERGY_CONFLICT = 0.9;
export const TACTIC_SYNERGY_NEUTRAL = 1.0;

/**
 * 战术对敌方阵型的协同区：敌方阵型 ∈ 本战术 `strongAgainstFormationIds` → 1.1（协同），
 * 否则 1.0（中性）。**冲突 0.9 在 0-A 无战术×阵型反向关系表（计划 §4.6 不扩 6×6 矩阵），
 * 不存在独立触发源，因此不产生 0.9 结果**；常量保留供 0-B 扩展反向关系时使用。
 */
export function resolveTacticSynergy(
  config: TacticalConfigV2,
  tacticId: TacticalTacticId | null | undefined,
  enemyFormationId: number,
): number {
  if (!tacticId) return TACTIC_SYNERGY_NEUTRAL;
  const tactic = config.tactics.find((item) => item.id === tacticId);
  if (!tactic) return TACTIC_SYNERGY_NEUTRAL;
  return tactic.strongAgainstFormationIds.includes(enemyFormationId)
    ? TACTIC_SYNERGY_STRONG
    : TACTIC_SYNERGY_NEUTRAL;
}

/** 战术自身基础修正（T_base，计划 §5.2：不受组织度缩放）。未设战术/未知 id 返回全 0。 */
export function tacticModifiers(
  config: TacticalConfigV2,
  tacticId: TacticalTacticId | null | undefined,
): { attack: number; defense: number; initiative: number } {
  if (!tacticId) return { attack: 0, defense: 0, initiative: 0 };
  const tactic = config.tactics.find((item) => item.id === tacticId);
  return tactic
    ? { attack: tactic.attack, defense: tactic.defense, initiative: tactic.initiative }
    : { attack: 0, defense: 0, initiative: 0 };
}
