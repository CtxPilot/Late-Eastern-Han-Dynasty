// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 白刃战标准模式引擎（05 §20.3 Tier II）
 *
 * runMeleeRound — 单回合结算
 * - 接受玩家本回合的战术点动作输入
 * - 先手判定（阵型机动+统率）
 * - 执行双方动作（含克制/暴击/反击/连击，复用 §6 引擎）
 * - 计谋结算（复用 §7 火计引擎）
 * - 单挑结算（复用 §8 duel.ts）
 * - 胜负判定
 *
 * 0-A 简化：
 * - 6 基础阵型 Lv1，无双轴成长/科技树
 * - 战术点：基础 5/回合，主将智≥80 +1，上限 10
 * - 伤害公式简化：基于兵力比 × 基础系数
 */
import {
  FormationType,
  type Formation,
  type MeleeState,
  type MeleeRoundResult,
  type TacticalAction,
  type TacticalActionType,
  type TacticalConfigV2,
  resolveTacticSynergy,
  tacticModifiers,
} from '@leh/shared';
import { applyOrganizationExecution, resolveFormationContribution } from '@leh/shared';

// ====== 常量 ======

/** 每回合基础战术点 */
const BASE_TACTICAL_POINTS = 5;
/** 战术点上限 */
const MAX_TACTICAL_POINTS = 10;
/** 白刃战最大回合数 */
const MAX_MELEE_ROUNDS = 20;

/** 白刃战基础伤害系数（0-A 简化，与 Session 277 百分比基线同构；0.08 + 阵型攻修正） */
const BASE_DAMAGE_MULT = 0.08;

/** 战术动作消耗表 */
const TACTICAL_COSTS: Record<TacticalActionType, number> = {
  normal_attack: 0,
  ability_attack: 3,
  change_formation: 1,
  use_stratagem: 3,
  initiate_duel: 2,
  all_out_assault: 4,
  hold_firm: 2,
  reorganize: 2,
  retreat_prep: 3,
  counter_stratagem: 2,
};

export function getTacticalActionCost(actionType: TacticalActionType): number | null {
  return TACTICAL_COSTS[actionType] ?? null;
}

/**
 * 等价性单点换算（FM-P3a 点值迁移，N1 已审）。
 *
 * 唯一运行量纲 = formations.json `tiers[0]` 点值（攻/防/机/射），经下列系数换算为标准模式
 * 伤害/先手修正；meleePercent 过渡字段已退役，meleeRound 不再持有任何阵型数值硬编码表。
 * 系数选择使六阵攻守角色与先手语义与 Session 277 百分比基线对齐；逐阵迁移前后差异表见
 * `docs/formation-catalog-migration.md` §4（诚实标注：点值与百分比分布不同，不逐点相等）。
 */
export const MELEE_ATK_GAIN = 0.1; // 1 点攻 ≈ +10% 伤害系数（进 0.08+atk 倍率）
export const MELEE_DEF_GAIN = 0.1; // 1 点防 ≈ -10% 承受伤害（进 (1-def) 减伤）
export const MELEE_MOB_GAIN = 0.5; // 1 点机 ≈ 先手比较 +0.5
export const MELEE_MOB_BASE = 1.0; // 先手比较基准

/** 组织度缺省（optional 旧档兼容）：60 → orderly 档 ×1.0，使旧档/未携带不改变行为 */
const ORDERLY_ORGANIZATION = 60;

/**
 * 注入的阵型目录（单一内容源，服务端启动时 `setMeleeFormationCatalog(staticData.formations)`）。
 * null（纯单测/脚本未注入）时回退中性：等价"无阵型加成"，不再存在第二套数值表。
 */
let MELEE_CATALOG: readonly Formation[] | null = null;

/** 注入静态阵型目录（null 恢复中性回退）。 */
export function setMeleeFormationCatalog(catalog: readonly Formation[] | null): void {
  MELEE_CATALOG = catalog;
}

/**
 * 注入 TacticalConfig v2（战术协同矩阵单一真源，服务端启动 `setMeleeTacticalConfig(parse(...v2.json))`）。
 * null（纯单测/脚本未注入）时战术按中性处理（无协同、无战术修正）。
 */
let TACTICAL_CONFIG: TacticalConfigV2 | null = null;

/** 注入 TacticalConfig v2（null 恢复中性回退）。 */
export function setMeleeTacticalConfig(config: TacticalConfigV2 | null): void {
  TACTICAL_CONFIG = config;
}

/**
 * 标准模式阵型修正：tiers[0] 点值 × 等价性系数，正面增量再按组织度执行档缩放（负修正原值保留）。
 * 导出供战报复算/客户端解释复算（计划 §7.2 解释器可复算、§9.6 可解释性）。
 * @param organization 0..100；undefined 按 orderly（×1.0 中性）解析，保证旧档/未携带不漂移。
 */
export function standardMeleeMods(
  f: FormationType,
  organization?: number,
): { atk: number; def: number; mobility: number } {
  const catalog = MELEE_CATALOG;
  if (!catalog) return { atk: 0, def: 0, mobility: MELEE_MOB_BASE };
  const contrib = resolveFormationContribution(catalog, f, organization ?? ORDERLY_ORGANIZATION);
  const exec = contrib.organizationExecution;
  return {
    atk: applyOrganizationExecution(contrib.attack, exec) * MELEE_ATK_GAIN,
    def: applyOrganizationExecution(contrib.defense, exec) * MELEE_DEF_GAIN,
    mobility: MELEE_MOB_BASE + MELEE_MOB_GAIN * applyOrganizationExecution(contrib.mobility, exec),
  };
}

// ====== 战术点刷新 ======

/** 计算本回合获得的战术点数 */
export function calcTacticalPointsGain(commanderInt: number, currentPoints: number): number {
  const base = BASE_TACTICAL_POINTS;
  const bonus = commanderInt >= 80 ? 1 : 0;
  const total = currentPoints + base + bonus;
  return Math.min(total, MAX_TACTICAL_POINTS);
}

/** 验证战术动作是否可执行 */
export function validateTacticalAction(
  _action: TacticalAction,
  currentPoints: number,
  actionType: TacticalActionType,
): boolean {
  const cost = TACTICAL_COSTS[actionType];
  if (cost === undefined) return false;
  return currentPoints >= cost;
}

// ====== 单回合结算 ======

/**
 * 执行一回合白刃战
 * @param state 当前白刃战状态
 * @param attackerAction 进攻方玩家的战术动作
 * @param attackerInt 进攻方主将智力
 * @returns 单回合结算结果
 */
export function runMeleeRound(
  state: MeleeState,
  attackerAction: TacticalAction | null,
  _attackerInt: number,
): MeleeRoundResult {
  if (state.phase !== 'active') {
    return {
      round: state.round,
      attackerDamage: 0,
      defenderDamage: 0,
      attackerTroopsAfter: state.attackerTroops,
      defenderTroopsAfter: state.defenderTroops,
      attackerMoraleAfter: state.attackerMorale,
      defenderMoraleAfter: state.defenderMorale,
      events: ['战斗已结束'],
      phase: state.phase,
    };
  }

  const events: string[] = [];
  const round = state.round + 1;

  // 1. 先手判定（阵型机动 + 战术先手 + 主将统率简化；点值经等价性换算读入，含组织度执行档）
  const atkMod = standardMeleeMods(state.attackerFormation, state.attackerOrganization);
  const defMod = standardMeleeMods(state.defenderFormation, state.defenderOrganization);
  // FM-P3 战术协同矩阵：T_base（战术自身修正，不受组织度缩放）+ synergy（对敌方阵型的协同区 ×1.1/×1.0）
  const tMods = TACTICAL_CONFIG ? tacticModifiers(TACTICAL_CONFIG, state.tactic) : { attack: 0, defense: 0, initiative: 0 };
  const synergy = TACTICAL_CONFIG
    ? resolveTacticSynergy(TACTICAL_CONFIG, state.tactic, state.defenderFormation)
    : 1.0;
  const attackerFirst = (atkMod.mobility + tMods.initiative) >= defMod.mobility;

  // 2. 基础伤害计算（简化：基于兵力 × 阵型修正；点值换算为 atk/def 修正 + 战术 T_base）
  //    resolvedDelta = (F_effective + T_base) × synergy（计划 §5.2；仅攻击方增量，守方无战术）
  let atkDamageMult = BASE_DAMAGE_MULT + (atkMod.atk + tMods.attack) * synergy;
  let defDamageMult = BASE_DAMAGE_MULT + (defMod.atk || 0);

  if (state.tactic && TACTICAL_CONFIG) {
    const t = TACTICAL_CONFIG.tactics.find((item) => item.id === state.tactic);
    if (t) events.push(`战术·${t.name}：攻${tMods.attack >= 0 ? '+' : ''}${Math.round(tMods.attack * 100)}% 防${tMods.defense >= 0 ? '+' : ''}${Math.round(tMods.defense * 100)}% 先手${tMods.initiative >= 0 ? '+' : ''}${Math.round(tMods.initiative * 100)}%${synergy > 1 ? '（克制敌方阵型 ×1.1）' : ''}`);
  }

  // 突击效果
  if (attackerAction?.type === 'all_out_assault') {
    atkDamageMult += 0.30;
    defDamageMult += 0.05; // 防守方也有机会反击
    events.push('进攻方发动全军突击！攻+30%，防-20%');
  }

  // 坚守效果
  if (attackerAction?.type === 'hold_firm') {
    defDamageMult -= 0.30;
    events.push('进攻方转为坚守，防+30%');
  }

  // 整顿效果
  if (attackerAction?.type === 'reorganize') {
    // 士气恢复在下面处理
    events.push('进攻方进行整顿，士气恢复');
  }

  // 防御修正（守方用其阵型防；我方 = 阵型防 + 战术防修正，正=更能扛）
  const defDefMod = defMod.def || 0;
  const atkDefMod = (atkMod.def || 0) + tMods.defense;

  // 进攻方对防守方造成的伤害
  let attackerDamage: number;
  let defenderDamage: number;

  if (attackerFirst) {
    // 进攻方先攻击
    attackerDamage = Math.floor(state.attackerTroops * atkDamageMult * (1 - defDefMod));
    attackerDamage = Math.min(attackerDamage, state.defenderTroops);

    // 防守方反击（兵力减少后）
    const defenderAfterAtk = state.defenderTroops - attackerDamage;
    defenderDamage = Math.floor(defenderAfterAtk * defDamageMult * (1 - atkDefMod));
    defenderDamage = Math.min(defenderDamage, state.attackerTroops);
  } else {
    // 防守方先攻击
    defenderDamage = Math.floor(state.defenderTroops * defDamageMult * (1 - atkDefMod));
    defenderDamage = Math.min(defenderDamage, state.attackerTroops);

    // 进攻方反击
    const attackerAfterDef = state.attackerTroops - defenderDamage;
    attackerDamage = Math.floor(attackerAfterDef * atkDamageMult * (1 - defDefMod));
    attackerDamage = Math.min(attackerDamage, state.defenderTroops);
  }

  // 3. 士气变化
  let atkMorale = state.attackerMorale;
  let defMorale = state.defenderMorale;

  // 伤亡影响士气
  const atkLossRatio = state.attackerTroops > 0 ? defenderDamage / state.attackerTroops : 0;
  const defLossRatio = state.defenderTroops > 0 ? attackerDamage / state.defenderTroops : 0;

  atkMorale = Math.max(0, Math.min(100, atkMorale - Math.floor(atkLossRatio * 30)));
  defMorale = Math.max(0, Math.min(100, defMorale - Math.floor(defLossRatio * 30)));

  // 整顿士气恢复
  if (attackerAction?.type === 'reorganize') {
    atkMorale = Math.min(100, atkMorale + 10);
  }

  // 4. 计算战后兵力
  const atkTroopsAfter = Math.max(0, state.attackerTroops - defenderDamage);
  const defTroopsAfter = Math.max(0, state.defenderTroops - attackerDamage);

  events.push(
    `第 ${round} 回合：进攻方 ${attackerFirst ? '先' : '后'}手，损失 ${defenderDamage}，敌损 ${attackerDamage}`,
  );

  // 5. 胜负判定
  let phase: MeleeRoundResult['phase'] = 'active';
  if (atkTroopsAfter <= 0 && defTroopsAfter <= 0) {
    phase = 'stalemate';
    events.push('双方两败俱伤，战斗僵持');
  } else if (atkTroopsAfter <= 0) {
    phase = 'defender_victory';
    events.push('进攻方全军覆没，防守方胜利');
  } else if (defTroopsAfter <= 0) {
    phase = 'attacker_victory';
    events.push('防守方全军覆没，进攻方胜利');
  } else if (atkMorale <= 0) {
    phase = 'defender_victory';
    events.push('进攻方士气崩溃，防守方胜利');
  } else if (defMorale <= 0) {
    phase = 'attacker_victory';
    events.push('防守方士气崩溃，进攻方胜利');
  } else if (round >= MAX_MELEE_ROUNDS) {
    phase = 'stalemate';
    events.push('20 回合未分胜负，各自收兵');
  }

  return {
    round,
    attackerDamage: defenderDamage, // 攻方 inflicted on def
    defenderDamage: attackerDamage, // 守方 inflicted on atk
    attackerTroopsAfter: atkTroopsAfter,
    defenderTroopsAfter: defTroopsAfter,
    attackerMoraleAfter: atkMorale,
    defenderMoraleAfter: defMorale,
    events,
    phase,
  };
}

/** 刷新白刃战状态（每回合开始调用） */
export function refreshMeleeState(
  state: MeleeState,
  commanderInt: number,
): MeleeState {
  const newPoints = calcTacticalPointsGain(commanderInt, state.tacticalPoints);
  return {
    ...state,
    tacticalPoints: newPoints,
    tacticalPointsUsed: 0,
  };
}

/** 应用回合结果到白刃战状态 */
export function applyMeleeRoundResult(
  state: MeleeState,
  result: MeleeRoundResult,
  actionCost: number,
): MeleeState {
  return {
    ...state,
    round: result.round,
    attackerTroops: result.attackerTroopsAfter,
    defenderTroops: result.defenderTroopsAfter,
    attackerMorale: result.attackerMoraleAfter,
    defenderMorale: result.defenderMoraleAfter,
    tacticalPoints: state.tacticalPoints - actionCost,
    tacticalPointsUsed: state.tacticalPointsUsed + actionCost,
    phase: result.phase,
    eventLog: [...state.eventLog, ...result.events],
  };
}

/** 创建初始白刃战状态 */
export function createMeleeState(
  battlefieldId: string,
  attackerArmyId: string,
  defenderArmyId: string,
  attackerFactionId: number,
  defenderFactionId: number,
  attackerTroops: number,
  defenderTroops: number,
  attackerFormation: FormationType,
  defenderFormation: FormationType,
  commanderInt: number,
  attackerOrganization?: number,
  defenderOrganization?: number,
): MeleeState {
  return {
    battlefieldId,
    attackerArmyId,
    defenderArmyId,
    attackerFactionId,
    defenderFactionId,
    entryMode: null,
    settlementApplied: false,
    round: 0,
    maxRounds: MAX_MELEE_ROUNDS,
    attackerTroops,
    defenderTroops,
    attackerMorale: 85,
    defenderMorale: 85,
    attackerFatigue: 0,
    defenderFatigue: 0,
    attackerFormation,
    defenderFormation,
    attackerOrganization,
    defenderOrganization,
    tacticalPoints: BASE_TACTICAL_POINTS + (commanderInt >= 80 ? 1 : 0),
    tacticalPointsUsed: 0,
    phase: 'active',
    eventLog: [],
    commandCache: {},
  };
}
