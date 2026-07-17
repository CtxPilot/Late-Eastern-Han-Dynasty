// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战场暴击/反击/连击引擎 — docs/05-combat-system.md §6.2~§6.5.
 *
 * 与单挑(§8)完全隔离。本模块作用于战场部队系统(BattleUnit)。
 *
 * 事件流 (§6.5):
 *   攻方A 攻击 守方B
 *     ❶ 暴击判定 → 伤害结算(§6.1)
 *     ➋ 反击阶段(B存活+可反击) → 反击暴击 → 反击后连击
 *     ➌ 连击阶段(A的攻击后) → 连击暴击
 *
 * 防循环: 连击不再触连击/反击; 反击不再触反击; 战法不计入(§6.5表).
 *
 * 0-A 最小切片 scope notes (documented honestly):
 *   - 通用技能: 从 officer.skills 读取(骑术/弓术/急攻/固守/勇武/洞察/疾驰/奇袭/强行军/沉着/布阵)
 *   - 武将特性: 0-A officers.json 无 traits 字段, 用 skills proxy 近似(刚力→bravery, 铁壁→hold)
 *   - 专属技能: 0-A officers.json 无 uniqueSkill 字段, 按 officer.id 识别(关羽6/吕布5/张飞7/赵云10/典韦13/许褚/马超/太史慈)
 *   - 阵型暴击/反击/连击修正: 按 §4.2 表硬编码(0-A formations.json 无 crit 字段)
 *   - 宝物修正: 0-A 无 GameState 装备系统, 按 officer.id 签名武器映射(方天画戟/青龙偃月刀/丈八蛇矛/双铁戟)
 */
import {
  FormationType,
  UnitProficiency,
  type BattleUnit,
  type Officer,
  type UnitTemplate,
  type UnitType,
} from '@leh/shared';
import type { TerrainType } from '@leh/shared';
import { getUnitMatchup } from './damage.js';

// ---------------------------------------------------------------------------
// Deterministic RNG (testable)
// ---------------------------------------------------------------------------

export type CritRng = () => number;

export function makeSeededRng(seed: number): CritRng {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// 阵型修正表 (§4.2)
// ---------------------------------------------------------------------------

interface FormationMods {
  crit: number;       // +%
  counter: number;    // +%
  chain: number;      // +%
  counterCoeff: number; // +反击系数
}

const FORMATION_MODS: Record<number, FormationMods> = {
  [FormationType.SQUARE]: { crit: 0, counter: 0, chain: 0, counterCoeff: 0 },
  [FormationType.CIRCLE]: { crit: 0, counter: 10, chain: 0, counterCoeff: 0.1 },
  [FormationType.WEDGE]: { crit: 0, counter: 0, chain: 5, counterCoeff: 0 },
  [FormationType.GOOSE]: { crit: 0, counter: 0, chain: 0, counterCoeff: 0 },
  [FormationType.CRANE_WING]: { crit: 20, counter: 0, chain: 0, counterCoeff: 0 }, // 侧击+20%
  [FormationType.FISH_SCALE]: { crit: 0, counter: 5, chain: 0, counterCoeff: 0 },
  [FormationType.ARROWHEAD]: { crit: 5, counter: 0, chain: 3, counterCoeff: 0 },
  [FormationType.CRESCENT]: { crit: 0, counter: 5, chain: 0, counterCoeff: 0 },
  [FormationType.LONG_SNAKE]: { crit: 0, counter: 0, chain: 3, counterCoeff: 0 },
  [FormationType.YOKE]: { crit: 0, counter: 3, chain: 0, counterCoeff: 0 },
  [FormationType.SPARSE]: { crit: 0, counter: 0, chain: 0, counterCoeff: 0 },
  [FormationType.DENSE]: { crit: 3, counter: 0, chain: 3, counterCoeff: 0 },
  [FormationType.HOOK]: { crit: 15, counter: 0, chain: 0, counterCoeff: 0 }, // 侧击+15%
  [FormationType.MYSTERIOUS]: { crit: 0, counter: 0, chain: 0, counterCoeff: 0 },
  [FormationType.CHARIOT_WHEEL]: { crit: 5, counter: 0, chain: 5, counterCoeff: 0 },
  [FormationType.EIGHT_TRIGRAMS]: { crit: 5, counter: 5, chain: 5, counterCoeff: 0 },
  [FormationType.CHARGE]: { crit: 10, counter: 0, chain: 5, counterCoeff: 0 },
  [FormationType.CLOUD]: { crit: 0, counter: 0, chain: 0, counterCoeff: 0 }, // 云阵(17)
};

function formationMods(f: FormationType): FormationMods {
  return FORMATION_MODS[f] ?? { crit: 0, counter: 0, chain: 0, counterCoeff: 0 };
}

// ---------------------------------------------------------------------------
// 兵种修正
// ---------------------------------------------------------------------------

function unitCritBonus(type: UnitType): number {
  if (type === 'archer') return 5;
  if (type === 'crossbowman') return 3;
  if (type === 'lightCavalry' || type === 'heavyCavalry' || type === 'horseArcher') return 2;
  return 0;
}

function unitChainBonus(type: UnitType): number {
  if (type === 'lightCavalry') return 5;
  if (type === 'lightInfantry') return 3;
  return 0;
}

/** 近战(可反击) vs 远程(不可反击). */
function isMelee(type: UnitType): boolean {
  return type !== 'archer' && type !== 'crossbowman';
}

function baseCounterCoeff(type: UnitType): number {
  if (!isMelee(type)) return 0; // 弓弩不可反击
  if (type === 'spearman') return 0.5;
  if (type === 'horseArcher') return 0.4;
  return 0.6; // 近战步兵/骑兵/水军
}

// ---------------------------------------------------------------------------
// 专属识别 (0-A: by officer.id; 0-B 改读 uniqueSkill 字段)
// ---------------------------------------------------------------------------

type UniqueId =
  | 'wushuang' | 'wusheng' | 'longdan' | 'paoxiao' | 'tianyi'
  | 'elai' | 'ganglie' | 'huchi' | 'qishen' | 'shenjiang' | null;

const UNIQUE_BY_ID: Record<number, UniqueId> = {
  5: 'wushuang',  // 吕布
  6: 'wusheng',   // 关羽
  7: 'paoxiao',   // 张飞 (ganglie 冲突时按 paoxiao; 反击必暴由刚烈—此处张飞用 paoxiao, 反击刚烈效果合并)
  10: 'longdan',  // 赵云 (神将合并)
  13: 'elai',     // 典韦
  // 许褚/马超/太史慈 0-A 数据集无对应 id; 留空走 generic
};

function uniqueOf(officer: Officer): UniqueId {
  if (officer.uniqueSkill) {
    const u = officer.uniqueSkill;
    if (u === 'wushuang' || u === 'wusheng' || u === 'longdan' || u === 'paoxiao' ||
        u === 'tianyi' || u === 'elai' || u === 'ganglie' || u === 'huchi' || u === 'qishen' || u === 'shenjiang') {
      return u as UniqueId;
    }
  }
  return UNIQUE_BY_ID[officer.id] ?? null;
}

function skillLevel(officer: Officer, skillId: string): number {
  const s = officer.skills.find((x) => x.skillId === skillId);
  return s ? clamp(s.level, 1, 5) : 0;
}

/** 0-A 签名武器暴击加成 (无装备系统时按 officer.id 推断). */
function weaponCritBonus(officer: Officer): number {
  const id = officer.id;
  if (id === 5) return 5;  // 方天画戟 +5%
  if (id === 6) return 5;  // 青龙偃月刀 +5%
  if (id === 7) return 5;  // 丈八蛇矛 +5% (连击+5% 另计)
  if (id === 13) return 8; // 双铁戟 +8% (连击)
  return 0;
}

function weaponChainBonus(officer: Officer): number {
  if (officer.id === 7) return 5;  // 丈八蛇矛 +5%
  if (officer.id === 13) return 8; // 双铁戟 +8%
  return 0;
}

// ---------------------------------------------------------------------------
// 适性 → 修正
// ---------------------------------------------------------------------------

function profToBonus(prof: UnitProficiency | undefined): { crit: number; chain: number } {
  switch (prof) {
    case UnitProficiency.S: return { crit: 5, chain: 5 };
    case UnitProficiency.A: return { crit: 3, chain: 3 };
    case UnitProficiency.B: return { crit: 1, chain: 1 };
    case UnitProficiency.C: return { crit: 0, chain: 0 };
    default: return { crit: 0, chain: 0 }; // NONE
  }
}

// ---------------------------------------------------------------------------
// 暴击率 (§6.2)
// ---------------------------------------------------------------------------

export interface CritContext {
  officer: Officer;
  unitType: UnitType;
  formation: FormationType;
  proficiency: UnitProficiency | undefined;
  terrain: TerrainType;
  /** 攻方 vs 守方 兵种克制 (1.3 克制 / 0.7 被克 / 1.0) */
  matchup: number;
  weather?: string;
  isSiege?: boolean;
  isNight?: boolean;
  isSurrounded?: boolean; // 被围(乱战)
}

export function computeCritRate(ctx: CritContext): number {
  const { officer, unitType, formation, proficiency, terrain, matchup } = ctx;
  const o = officer;
  const u = uniqueOf(o);
  const fm = formationMods(formation);
  const pf = profToBonus(proficiency);

  let rate = 5; // 基础 5%
  rate += o.stats.war / 50;
  rate += unitCritBonus(unitType);
  rate += pf.crit;
  rate += fm.crit;
  // 地形: 高地+3% (0-A 简化: 山地视为高地)
  if (terrain === ('mountain' as TerrainType)) rate += 3;

  // 通用技能 (§6.2.1)
  if (unitType === 'lightCavalry' || unitType === 'heavyCavalry' || unitType === 'horseArcher') {
    rate += skillLevel(o, 'riding') * 2;
  }
  if (unitType === 'archer' || unitType === 'crossbowman') {
    rate += skillLevel(o, 'archery') * 2;
  }
  // 急攻 → 暴击伤害(非率), 此处跳过

  // 特性 proxy (§6.2.2): 0-A 无 traits
  //   刚力 → bravery skill proxy (暴击伤害, 非率)
  //   猛进/先登/乱战/夜战 → 率加成, 用 skill 近似或省略

  // 专属 (§6.2.3)
  if (u === 'wusheng') rate += 15;
  if (u === 'wushuang') rate += 20;
  if (u === 'qishen') rate += 15;
  if (u === 'shenjiang') rate += 15;

  // 宝物
  rate += weaponCritBonus(o);

  // 暴击惩罚
  if (matchup < 1) rate -= 5;       // 被克
  if (ctx.weather === 'rain') rate -= 3;
  if (terrain === ('forest' as TerrainType)) rate -= 2;
  if (unitType === 'archer' && ctx.isSiege) rate += 0; // 先登特性后置

  // 夜战 (§6.2.2 夜战特性; 0-A 简化: 夜间基础-5, 有 night context 略)
  // 乱战: 被围 +5%~25% — 简化: isSurrounded → +10
  if (ctx.isSurrounded) rate += 10;

  return clamp(rate, 2, 60) / 100;
}

/** 暴击伤害倍率 (§6.2). */
export function computeCritMultiplier(ctx: CritContext): number {
  const o = ctx.officer;
  const u = uniqueOf(o);
  let mult = 1.5;
  if (u === 'wusheng') mult = 2.5; // 青龙刀 ×3.0 由 weaponCritBonus 上下文; 此处简化用 2.5, 0-B 装备后改
  // 刚力特性 → +10~40%; 0-A proxy: bravery skill level
  const brv = skillLevel(o, 'bravery');
  if (brv > 0) mult *= 1 + brv * 0.075;
  // 急攻 → 暴击伤害 +5~25%
  const rap = skillLevel(o, 'rapidAttack');
  if (rap > 0) mult *= 1 + rap * 0.05;
  return mult;
}

// ---------------------------------------------------------------------------
// 反击 (§6.3)
// ---------------------------------------------------------------------------

export interface CounterContext {
  officer: Officer;
  unitType: UnitType;
  formation: FormationType;
  /** 攻方距离(反击需在范围内; 近战=1, 长枪=1-2) */
  distance: number;
  morale: number;
  hasActed: boolean;
  /** 状态: 混乱/眩晕 */
  confused: boolean;
}

export function canCounter(ctx: CounterContext): boolean {
  if (!isMelee(ctx.unitType)) return false; // 弓弩不可反击
  if (ctx.hasActed) return false;
  if (ctx.morale <= 30) return false;
  if (ctx.confused) {
    // 沉着 Lv≥3 免疫
    if (skillLevel(ctx.officer, 'calm') < 3) return false;
  }
  // 长枪兵反击范围 1-2; 近战 1
  const range = ctx.unitType === 'spearman' ? 2 : 1;
  return ctx.distance <= range;
}

export function computeCounterRate(ctx: CounterContext, baseCritRate: number): number {
  const o = ctx.officer;
  const u = uniqueOf(o);
  const fm = formationMods(ctx.formation);
  // 反击率基础 = 兵种反击触发率(简化 50%) + 加成
  // §6.3 未给统一"反击率"基础; 用 50% 基础 + 修正
  let rate = 0.5;
  rate += skillLevel(o, 'hold') * 0.05; // 固守 +5~25%
  rate += fm.counter / 100;
  // 特性 proxy: 铁壁 → hold skill; 镇守/乱战/殿军 后置
  if (u === 'ganglie') return 1.0; // 必反
  if (u === 'elai') rate += 0.30;
  if (u === 'longdan') rate += 0.20;
  if (u === 'huchi' && ctx.morale < 20) return 1.0;
  // 反击暴击率 = 基础暴击率 + 5%
  void baseCritRate;
  return clamp(rate, 0, 1);
}

/** 反击伤害系数 (§6.3). */
export function computeCounterCoeff(ctx: CounterContext): number {
  const o = ctx.officer;
  const u = uniqueOf(o);
  let coeff = baseCounterCoeff(ctx.unitType);
  coeff += skillLevel(o, 'hold') * 0.05;
  const fm = formationMods(ctx.formation);
  coeff += fm.counterCoeff;
  if (u === 'ganglie') coeff = 1.0; // 取代 0.6
  if (u === 'elai') coeff = 1.2;
  if (u === 'longdan') coeff = 0.8;
  return coeff;
}

// ---------------------------------------------------------------------------
// 连击 (§6.4)
// ---------------------------------------------------------------------------

export interface ChainContext {
  officer: Officer;
  unitType: UnitType;
  formation: FormationType;
  proficiency: UnitProficiency | undefined;
  morale: number;
  /** 体力比 0~1 (stamina/maxStamina) */
  staminaRatio: number;
  isFirstRound?: boolean;
  movedThisTurn?: boolean;
}

export function computeChainRate(ctx: ChainContext): number {
  const o = ctx.officer;
  const u = uniqueOf(o);
  const fm = formationMods(ctx.formation);
  const pf = profToBonus(ctx.proficiency);

  let rate = 10; // 基础 10%
  rate += o.stats.war / 100;
  rate += unitChainBonus(ctx.unitType);
  rate += pf.chain;
  rate += fm.chain;

  // 通用技能 (§6.4.1)
  rate += skillLevel(o, 'rapidAttack') * 5;
  if (ctx.unitType === 'lightCavalry' || ctx.unitType === 'heavyCavalry' || ctx.unitType === 'horseArcher') {
    rate += skillLevel(o, 'gallop') * 3;
    rate += skillLevel(o, 'forcedMarch') * (ctx.movedThisTurn ? 3 : 0);
  }
  if (ctx.isFirstRound) rate += skillLevel(o, 'raid') * 10;

  // 专属 (§6.4.3)
  if (u === 'wushuang') rate += 25;
  if (u === 'longdan') rate += 20;
  if (u === 'paoxiao' && ctx.isFirstRound) rate += 50;
  if (u === 'huchi' && ctx.morale < 20) rate += 30;

  // 宝物
  rate += weaponChainBonus(o);

  // 惩罚
  if (ctx.morale < 50) rate -= 5;
  if (ctx.staminaRatio < 0.4) rate -= 5;

  return clamp(rate, 3, 40) / 100;
}

/** 连击伤害系数 (§6.4). */
export function computeChainCoeff(ctx: ChainContext): number {
  const u = uniqueOf(ctx.officer);
  if (u === 'wushuang') return 1.0; // 不衰减
  return 0.6;
}

/** 连击暴击率衰减 (§6.4). */
export function chainCritRateFn(baseCritRate: number, ctx: ChainContext): number {
  const u = uniqueOf(ctx.officer);
  if (u === 'wushuang') return baseCritRate; // 不衰减
  if (u === 'tianyi') return baseCritRate;   // 二连独立暴击
  return baseCritRate * 0.7;
}

// ---------------------------------------------------------------------------
// 完整攻击结算 (§6.5 事件流)
// ---------------------------------------------------------------------------

export interface AttackActor {
  unit: BattleUnit;
  officer: Officer;
  template: UnitTemplate;
  proficiency: UnitProficiency | undefined;
}

export interface AttackResult {
  /** 主攻伤害 */
  damage: number;
  /** 主攻是否暴击 */
  crit: boolean;
  /** 暴击倍率 */
  critMult: number;
  /** 反击伤害(守方对攻方) */
  counterDamage: number;
  counterCrit: boolean;
  /** 连击伤害(攻方追加) */
  chainDamage: number;
  chainCrit: boolean;
  /** 守方剩余兵力(结算后) */
  defenderTroopsAfter: number;
  /** 攻方剩余兵力(反击后) */
  attackerTroopsAfter: number;
  /** 守方是否溃败 */
  defenderDestroyed: boolean;
  /** 攻方是否溃败(反击致死) */
  attackerDestroyed: boolean;
  /** 文字描述片段(暴击/反击/连击标签) */
  labels: string[];
  /** 详细日志行 */
  details: string[];
}

export interface ResolveAttackOpts {
  attacker: AttackActor;
  defender: AttackActor;
  baseDamage: number; // §6.1 calcDamage 结果
  matchup: number;
  attackerTerrain: TerrainType;
  defenderTerrain: TerrainType;
  distance: number;
  /** 是否首回合(奇袭/咆哮加成) */
  isFirstRound: boolean;
  /** 攻方本回合是否已移动(强行军连击) */
  attackerMoved: boolean;
  rng: CritRng;
}

/**
 * 结算一次完整攻击事件流: 暴击 → 伤害 → 反击 → 连击.
 * 不修改 BattleUnit; 调用方根据 result 应用兵力变化.
 */
export function resolveAttack(opts: ResolveAttackOpts): AttackResult {
  const { attacker, defender, baseDamage, matchup, distance, isFirstRound, attackerMoved, rng } = opts;
  const labels: string[] = [];
  const details: string[] = [];

  const atkOff = attacker.officer;
  const defOff = defender.officer;
  const atkU = uniqueOf(atkOff);
  const defU = uniqueOf(defOff);

  // ❶ 暴击判定
  const atkCritCtx: CritContext = {
    officer: atkOff, unitType: attacker.unit.unitType, formation: attacker.unit.formation,
    proficiency: attacker.proficiency, terrain: opts.attackerTerrain, matchup,
  };
  const critRate = computeCritRate(atkCritCtx);
  const critMult = computeCritMultiplier(atkCritCtx);
  const crit = rng() < critRate;
  let mainDamage = baseDamage;
  if (crit) {
    mainDamage = Math.round(mainDamage * critMult);
    labels.push('暴击');
    details.push(`暴击 ×${critMult.toFixed(1)} → ${mainDamage}`);
  }

  // 伤害结算
  let defenderTroopsAfter = Math.max(0, defender.unit.troopCount - mainDamage);
  const defenderDestroyed = defenderTroopsAfter <= 0;

  let attackerTroopsAfter = attacker.unit.troopCount;
  let attackerDestroyed = false;

  let counterDamage = 0;
  let counterCrit = false;
  let chainDamage = 0;
  let chainCrit = false;

  // ➋ 反击阶段 (守方存活 + 可反击)
  if (!defenderDestroyed) {
    const counterCtx: CounterContext = {
      officer: defOff, unitType: defender.unit.unitType, formation: defender.unit.formation,
      distance, morale: defender.unit.morale, hasActed: false,
      confused: defender.unit.statusEffects.some((e) => e.type === 'confusion' || e.type === 'stun'),
    };
    if (canCounter(counterCtx)) {
      const counterRate = computeCounterRate(counterCtx, critRate);
      if (rng() < counterRate) {
        // 反击基础伤害 = 反击方 calcDamage 简化(用 baseDamage × 兵种反击系数)
        // 0-A 简化: 反击伤害 = 守方对攻方的一次 calcDamage 结果 × 反击系数
        const counterCoeff = computeCounterCoeff(counterCtx);
        // 用守方作为攻方计算一次伤害(近似)
        const counterBase = estimateDamage(defender, attacker, matchup > 0 ? 1 / matchup : 1, opts.defenderTerrain, opts.attackerTerrain);
        counterDamage = Math.max(1, Math.round(counterBase * counterCoeff));
        // 反击暴击 (§6.3): 独立roll, 基础暴击率 + 5%
        const defCritCtx: CritContext = {
          officer: defOff, unitType: defender.unit.unitType, formation: defender.unit.formation,
          proficiency: defender.proficiency, terrain: opts.defenderTerrain, matchup: 1 / matchup,
        };
        const counterCritRate = clamp(computeCritRate(defCritCtx) + 0.05, 0.02, 0.6);
        counterCrit = rng() < counterCritRate;
        if (counterCrit) {
          counterDamage = Math.round(counterDamage * computeCritMultiplier(defCritCtx));
        }
        // 刚烈: 反击必暴击
        if (defU === 'ganglie') {
          counterCrit = true;
          counterDamage = Math.round(counterDamage * computeCritMultiplier(defCritCtx));
        }
        attackerTroopsAfter = Math.max(0, attackerTroopsAfter - counterDamage);
        attackerDestroyed = attackerTroopsAfter <= 0;
        labels.push('反击');
        if (counterCrit) labels.push('反击暴击');
        details.push(`反击 ${counterDamage}${counterCrit ? '(暴)' : ''}`);
      }
    }
  }

  // ➌ 连击阶段 (攻方攻击后; 守方存活 + 攻方存活 + 本回合未连击过)
  // 注: 防循环 — 连击仅触发一次, 由调用方保证(chainTriggeredThisTurn 标志); 此处默认未触发
  if (!defenderDestroyed && !attackerDestroyed) {
    const chainCtx: ChainContext = {
      officer: atkOff, unitType: attacker.unit.unitType, formation: attacker.unit.formation,
      proficiency: attacker.proficiency, morale: attacker.unit.morale,
      staminaRatio: (atkOff.stamina || 100) / 100, isFirstRound, movedThisTurn: attackerMoved,
    };
    let chainRate = computeChainRate(chainCtx);
    // 天义: 必定二连击
    const mustChain = atkU === 'tianyi';
    if (mustChain) chainRate = 1.0;
    if (rng() < chainRate) {
      const chainCoeff = computeChainCoeff(chainCtx);
      chainDamage = Math.max(1, Math.round(baseDamage * chainCoeff));
      // 连击暴击 (×0.7 衰减; 无双/天义 不衰减)
      const cRate = chainCritRateFn(critRate, chainCtx);
      chainCrit = rng() < cRate;
      if (chainCrit) {
        chainDamage = Math.round(chainDamage * critMult);
      }
      defenderTroopsAfter = Math.max(0, defenderTroopsAfter - chainDamage);
      labels.push('连击');
      if (chainCrit) labels.push('连击暴击');
      details.push(`连击 ${chainDamage}${chainCrit ? '(暴)' : ''}`);
    }
  }

  return {
    damage: mainDamage,
    crit,
    critMult,
    counterDamage,
    counterCrit,
    chainDamage,
    chainCrit,
    defenderTroopsAfter,
    attackerTroopsAfter,
    defenderDestroyed: defenderTroopsAfter <= 0,
    attackerDestroyed: attackerTroopsAfter <= 0,
    labels,
    details,
  };
}

/** 0-A 简化: 用 calcDamage 公式近似估算反击/连击的基础伤害(不重新引入 random). */
function estimateDamage(
  attacker: AttackActor,
  defender: AttackActor,
  matchup: number,
  atkTerrain: TerrainType,
  defTerrain: TerrainType,
): number {
  // 复用 getUnitMatchup 语义: 传 matchup 系数
  const aT = attacker.template;
  const dT = defender.template;
  const baseAttack = aT.attack + attacker.officer.stats.war / 10;
  const baseDefense = dT.defense + defender.officer.stats.leadership / 10;
  const troopFactor = 0.3 + 0.7 * (attacker.unit.troopCount / Math.max(1, attacker.unit.maxTroops));
  const moraleFactor = 0.6 + 0.4 * (attacker.unit.morale / 100);
  const finalAttack = baseAttack * matchup * (1 + 0) * troopFactor * moraleFactor;
  const finalDefense = baseDefense * (1 + 0);
  const raw = Math.max(1.5, finalAttack - finalDefense + 2);
  void atkTerrain; void defTerrain;
  return Math.max(1, Math.round(raw * (attacker.unit.troopCount / 30) * 1.0));
}

/** 重导出 getUnitMatchup 便于调用方. */
export { getUnitMatchup };