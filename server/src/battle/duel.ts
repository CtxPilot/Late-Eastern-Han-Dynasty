// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Single-duel (单挑) engine — docs/05-combat-system.md §8.
 *
 * Fully auto-resolved: the engine picks both combatants' commands each round
 * via the AI weight tables (§8.13.2), resolves the core-triangle + auxiliary
 *克制链, computes damage (§8.6), crit/counter/chain (§8.11), injury (§8.7),
 * and finally the outcome (§8.8). Players only watch the playback.
 *
 * 0-A 最小切片 scope notes (documented honestly in progress):
 *   - 武器: inferred from officer id / uniqueSkill (no GameState equip system yet)
 *   - 通用技能/特性联动: read from officer.skills where present; defaults otherwise
 *   - 专属技能: 吕布/关羽/张飞/赵云/太史慈/典韦/许褚/马超/祝融 implemented;
 *     others fall back to generic weights
 *   - 宿命对决 (§8.14.1): trigger detection + outcome bias for 关羽vs华雄 demo;
 *     full table deferred
 *   - 受伤战后延续 (§8.7.3): injury applied to runtime officer stamina/merit only
 */

import {
  Personality,
  PrimaryWeaponSubType,
  SecondaryWeaponSubType,
  type Officer,
} from '@leh/shared';
import {
  DuelCommand,
  type DuelCombatantState,
  type DuelDialog,
  type DuelEngineConfig,
  type DuelInjury,
  type DuelResult,
  type DuelRound,
  type DuelState,
} from '@leh/shared';

// ---------------------------------------------------------------------------
// Defaults & helpers
// ---------------------------------------------------------------------------

export const DEFAULT_DUEL_CONFIG: DuelEngineConfig = {
  maxRounds: 10,
  baseHp: 100,
  challengeEnergyCost: 20,
};

/** Deterministic RNG interface (so tests can seed). */
export type DuelRng = () => number;

export function makeSeededRng(seed: number): DuelRng {
  let s = seed >>> 0;
  return () => {
    // xorshift32
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function pickWeighted<T>(items: [T, number][], rng: DuelRng): T {
  const total = items.reduce((s, [, w]) => s + Math.max(0, w), 0);
  if (total <= 0) return items[0][0];
  let r = rng() * total;
  for (const [it, w] of items) {
    r -= Math.max(0, w);
    if (r <= 0) return it;
  }
  return items[items.length - 1][0];
}

// ---------------------------------------------------------------------------
// Weapon resolution (0-A: inferred from officer id + uniqueSkill)
// ---------------------------------------------------------------------------

interface WeaponProfile {
  type: PrimaryWeaponSubType;
  power: number;      // weaponPower (§8.9.1)
  hitBonus: number;   // +%
  firstBonus: number; // +%
  critBonus: number;  // +%
}

const WEAPON_BY_TYPE: Record<PrimaryWeaponSubType, WeaponProfile> = {
  [PrimaryWeaponSubType.SWORD]: { type: PrimaryWeaponSubType.SWORD, power: 1.0, hitBonus: 10, firstBonus: 0, critBonus: 0 },
  [PrimaryWeaponSubType.BLADE]: { type: PrimaryWeaponSubType.BLADE, power: 1.2, hitBonus: 0, firstBonus: 0, critBonus: 5 },
  [PrimaryWeaponSubType.SPEAR]: { type: PrimaryWeaponSubType.SPEAR, power: 1.1, hitBonus: 0, firstBonus: 15, critBonus: 0 },
  [PrimaryWeaponSubType.HALBERD]: { type: PrimaryWeaponSubType.HALBERD, power: 1.3, hitBonus: -5, firstBonus: -5, critBonus: 0 },
  [PrimaryWeaponSubType.BLUNT]: { type: PrimaryWeaponSubType.BLUNT, power: 1.4, hitBonus: -10, firstBonus: -10, critBonus: 10 },
};

/** 0-A mapping: signature weapon per famous officer; others default to blade. */
const SIGNATURE_WEAPON: Record<number, PrimaryWeaponSubType> = {
  5: PrimaryWeaponSubType.HALBERD,  // 吕布 方天画戟
  6: PrimaryWeaponSubType.BLADE,    // 关羽 青龙偃月刀
  7: PrimaryWeaponSubType.SPEAR,    // 张飞 丈八蛇矛
  2: PrimaryWeaponSubType.SWORD,    // 刘备 双股剑
  1: PrimaryWeaponSubType.SWORD,    // 曹操 倚天剑
  10: PrimaryWeaponSubType.SPEAR,   // 赵云 银枪
  9: PrimaryWeaponSubType.HALBERD,  // 夏侯惇 (重兵器)
};

function resolveWeapon(officer: Officer): WeaponProfile {
  const sub = SIGNATURE_WEAPON[officer.id] ?? PrimaryWeaponSubType.BLADE;
  return WEAPON_BY_TYPE[sub];
}

/** 0-A: signature secondary weapon (弓/弩/暗器) for pre-duel 射箭 + 暗袭. */
function resolveSecondary(officer: Officer): SecondaryWeaponSubType | null {
  // None of the 0-A officers carry a notable ranged weapon by default.
  // 祝融 (0-B) → throwing; leave null for now.
  void officer;
  return null;
}

// ---------------------------------------------------------------------------
// Unique-skill helpers (§8.10.3) — 0-A subset
// ---------------------------------------------------------------------------

type UniqueId =
  | 'wushuang'   // 无双 吕布
  | 'wusheng'    // 武圣 关羽
  | 'longdan'    // 龙胆 赵云
  | 'paoxiao'    // 咆哮 张飞
  | 'tianyi'     // 天义 太史慈
  | 'elai'       // 恶来 典韦
  | 'ganglie'    // 刚烈 张飞(独占, 冲突时优先)
  | 'huchi'      // 虎痴 许褚
  | 'qishen'     // 骑神 马超
  | 'huoshen'    // 火神 祝融
  | null;

function uniqueOf(officer: Officer): UniqueId {
  const id = officer.uniqueSkill;
  if (!id) return null;
  if (id === 'wushuang') return 'wushuang';
  if (id === 'wusheng') return 'wusheng';
  if (id === 'longdan') return 'longdan';
  if (id === 'paoxiao') return 'paoxiao';
  if (id === 'tianyi') return 'tianyi';
  if (id === 'elai') return 'elai';
  if (id === 'ganglie') return 'ganglie';
  if (id === 'huchi') return 'huchi';
  if (id === 'qishen') return 'qishen';
  if (id === 'huoshen') return 'huoshen';
  return null;
}

function skillLevel(officer: Officer, skillId: string): number {
  const s = officer.skills.find((x) => x.skillId === skillId);
  return s ? clamp(s.level, 1, 5) : 0;
}

// ---------------------------------------------------------------------------
// Combatant init
// ---------------------------------------------------------------------------

function staminaFactor(hpRatio: number): number {
  // §8.6.4 体力系数
  if (hpRatio >= 0.8) return 1.0;
  if (hpRatio >= 0.6) return 0.95;
  if (hpRatio >= 0.4) return 0.9;
  if (hpRatio >= 0.2) return 0.8;
  return 0.7;
}

function makeCombatant(officer: Officer, cfg: DuelEngineConfig): DuelCombatantState {
  // HP scaled by 武力 + 力量 (§8.6 design intent: ~100 baseline)
  const hp = Math.round(cfg.baseHp + officer.stats.war * 0.3 + officer.hidden.power * 0.2);
  return {
    officerId: officer.id,
    hp,
    maxHp: hp,
    energy: 100,
    maxEnergy: 100,
    injury: null,
    sneakUsed: false,
    consecutiveBlocks: 0,
    lastCommand: null,
  };
}

// ---------------------------------------------------------------------------
// 克制链 (§8.5.2)
// ---------------------------------------------------------------------------

interface ClashResult {
  /** attacker side modifier on damage (e.g. +0.3 if 克制) */
  atkDamageMod: number;
  /** defender side modifier on damage */
  defDamageMod: number;
  /** attacker hit bonus (+/- %) */
  atkHitMod: number;
  /** special: 牵制克必杀 → 必杀伤害 -50% */
  finisherResolved: boolean;
  /** special: 周旋克格挡 → 反手失效 */
  parryCounterDisabled: boolean;
  /** special: 周旋克闪避 → 闪避免疫失效 + 周旋 +30% */
  dodgePierced: boolean;
  /** special: 闪避免免疫猛攻/牵制 */
  dodgeEvades: boolean;
  /** 必杀无视闪避 */
  finisherIgnoresDodge: boolean;
}

function resolveClash(atk: DuelCommand, def: DuelCommand): ClashResult {
  const base: ClashResult = {
    atkDamageMod: 0,
    defDamageMod: 0,
    atkHitMod: 0,
    finisherResolved: false,
    parryCounterDisabled: false,
    dodgePierced: false,
    dodgeEvades: false,
    finisherIgnoresDodge: false,
  };

  // Core triangle
  if (atk === DuelCommand.FIERCE_ATTACK && def === DuelCommand.RESTRAIN) {
    return { ...base, atkDamageMod: 0.3, atkHitMod: 0, defDamageMod: -0.15 };
  }
  if (atk === DuelCommand.RESTRAIN && def === DuelCommand.FINISHER) {
    // 牵制克必杀 → 必杀伤害 -50%, 牵制方正常计算
    return { ...base, finisherResolved: true, defDamageMod: -0.5 };
  }
  if (atk === DuelCommand.FINISHER && def === DuelCommand.FIERCE_ATTACK) {
    // 必杀克猛攻 → 必中 + 猛攻方防御 -20% 已含在指令修正
    return { ...base, atkDamageMod: 0.3, finisherIgnoresDodge: true };
  }

  // Auxiliary chain
  if (atk === DuelCommand.FIERCE_ATTACK && def === DuelCommand.PROBE) {
    return { ...base, atkDamageMod: 0.3 };
  }
  if (atk === DuelCommand.PROBE && def === DuelCommand.DODGE) {
    return { ...base, atkDamageMod: 0.3, dodgePierced: true };
  }
  if (atk === DuelCommand.PROBE && def === DuelCommand.PARRY) {
    return { ...base, parryCounterDisabled: true };
  }
  if (atk === DuelCommand.FINISHER && def === DuelCommand.DODGE) {
    return { ...base, finisherIgnoresDodge: true };
  }

  // 闪避 vs 猛攻/牵制 → 免疫
  if (def === DuelCommand.DODGE && (atk === DuelCommand.FIERCE_ATTACK || atk === DuelCommand.RESTRAIN)) {
    return { ...base, dodgeEvades: true };
  }

  return base;
}

// ---------------------------------------------------------------------------
// Damage (§8.6.1)
// ---------------------------------------------------------------------------

function computeDamage(
  atkOff: Officer,
  defOff: Officer,
  atk: DuelCombatantState,
  cmd: DuelCommand,
  weapon: WeaponProfile,
  clash: ClashResult,
  rng: DuelRng,
): { damage: number; hit: boolean } {
  // 必杀 always hits (穿透闪避); 暗袭 95%; others base 80% + 敏捷差 + 武器命中 + 指令
  let hitRate: number;
  if (cmd === DuelCommand.FINISHER) {
    hitRate = 100;
  } else if (cmd === DuelCommand.SNEAK_ATTACK) {
    hitRate = 95;
  } else {
    hitRate =
      80 +
      (atkOff.hidden.agility - defOff.hidden.agility) / 10 +
      weapon.hitBonus +
      commandHitBonus(cmd) +
      clash.atkHitMod;
  }
  // §8.14 夜间/雨雪 简化: 略
  const hit = rng() * 100 < clamp(hitRate, 3, 100);

  // 闪避免疫
  if (clash.dodgeEvades && !clash.finisherIgnoresDodge) {
    return { damage: 0, hit: false };
  }

  if (!hit) return { damage: 0, hit: false };

  // baseDamage = |武差| × weaponPower × (1 + 指令修正)
  const warDiff = Math.abs(atkOff.stats.war - defOff.stats.war);
  const cmdMod = commandDamageMod(cmd);
  let base = warDiff * weapon.power * (1 + cmdMod + clash.atkDamageMod);
  // 保底: 即使武差为 0 也应有伤害 (用进攻方武力兜底)
  if (base < atkOff.stats.war * weapon.power * 0.2) {
    base = atkOff.stats.war * weapon.power * 0.2;
  }

  // 力量附加 (§8.6.2)
  const stamina = staminaFactor(atk.hp / atk.maxHp);
  const power = atkOff.hidden.power * stamina;
  base += power * weapon.power * 0.1;
  if (cmd === DuelCommand.FIERCE_ATTACK) base += power / 50;

  // 体力系数
  base *= 0.5 + 0.5 * (atk.hp / atk.maxHp);

  // 浮动 ±10%
  base *= 0.9 + rng() * 0.2;

  // 牵制化解 → 必杀伤害 -50% (clash.defDamageMod = -0.5 已设置在 defender 侧语义;
  // 这里 atk 是发起必杀方时, clash.finisherResolved 表示被牵制化解)
  if (clash.finisherResolved && cmd === DuelCommand.FINISHER) {
    base *= 0.5;
  }

  // 格挡减伤
  if (cmd !== DuelCommand.SNEAK_ATTACK && cmd !== DuelCommand.FINISHER) {
    // 格挡由对方指令处理 (在 resolveRound 中对防御方指令判定)
  }

  // 受伤攻击惩罚
  if (atk.injury?.attackPenalty) base *= 1 - atk.injury.attackPenalty;

  return { damage: Math.max(1, Math.round(base)), hit: true };
}

function commandDamageMod(cmd: DuelCommand): number {
  switch (cmd) {
    case DuelCommand.FIERCE_ATTACK: return 0.3;
    case DuelCommand.RESTRAIN: return 0;
    case DuelCommand.FINISHER: return 1.0; // MAX
    case DuelCommand.PROBE: return 0;
    case DuelCommand.PARRY: return -0.5;
    case DuelCommand.DODGE: return 0;
    case DuelCommand.SNEAK_ATTACK: return 0;
  }
}

function commandHitBonus(cmd: DuelCommand): number {
  switch (cmd) {
    case DuelCommand.FIERCE_ATTACK: return 0;
    case DuelCommand.RESTRAIN: return 15;
    case DuelCommand.FINISHER: return 0; // 100% handled separately
    case DuelCommand.PROBE: return 20;
    case DuelCommand.PARRY: return 0;
    case DuelCommand.DODGE: return 0;
    case DuelCommand.SNEAK_ATTACK: return 0; // 95% handled
  }
}

// ---------------------------------------------------------------------------
// Crit / Counter / Chain (§8.11)
// ---------------------------------------------------------------------------

function computeCritRate(
  officer: Officer,
  weapon: WeaponProfile,
  cmd: DuelCommand,
  unique: UniqueId,
): number {
  if (cmd === DuelCommand.FINISHER || cmd === DuelCommand.PARRY || cmd === DuelCommand.DODGE || cmd === DuelCommand.SNEAK_ATTACK) {
    return 0;
  }
  let rate = officer.stats.war / 50 + weapon.critBonus / 100 + commandCritBonus(cmd);
  rate += skillLevel(officer, 'bravery') * 0.02;
  // 豪勇 特性 (0-A: approximate via bravery skill proxy) — kept generic
  if (unique === 'wusheng') rate += 0.30;
  if (unique === 'wushuang') rate += 0.20;
  rate += officer.hidden.luck / 500;
  // 牵制 -5%
  if (cmd === DuelCommand.RESTRAIN) rate -= 0.05;
  return clamp(rate, 0.03, 0.70);
}

function commandCritBonus(cmd: DuelCommand): number {
  if (cmd === DuelCommand.FIERCE_ATTACK) return 0.10;
  if (cmd === DuelCommand.PROBE) return 0.05;
  return 0;
}

function critMultiplier(officer: Officer, unique: UniqueId, weapon: WeaponProfile): number {
  let mult = 1.5;
  if (unique === 'wusheng') {
    mult = 2.5;
    // 青龙偃月刀 (blade) → ×3.0
    if (weapon.type === PrimaryWeaponSubType.BLADE) mult = 3.0;
  }
  // 刚力 特性 proxy via bravery level (0-A simplification)
  const lv = skillLevel(officer, 'bravery');
  if (lv > 0) mult *= 1 + lv * 0.05;
  return mult;
}

function computeCounterRate(
  officer: Officer,
  unique: UniqueId,
  parryCounterDisabled: boolean,
): number {
  if (parryCounterDisabled) return 0;
  let rate = 0.30;
  rate += skillLevel(officer, 'hold') * 0.05;
  if (unique === 'elai') rate += 0.30;
  if (unique === 'ganglie') rate = 1.0; // 必反
  rate += officer.hidden.agility / 1000;
  return clamp(rate, 0, 1);
}

// ---------------------------------------------------------------------------
// AI command selection (§8.13.2)
// ---------------------------------------------------------------------------

function aiCommand(
  officer: Officer,
  self: DuelCombatantState,
  foe: DuelCombatantState,
  foeLast: DuelCommand | null,
  unique: UniqueId,
  rng: DuelRng,
): DuelCommand {
  const p = officer.hidden.personality;
  let weights: [DuelCommand, number][] = baseWeights(p);

  // 专属风格调整
  weights = applyUniqueWeights(weights, unique);

  // 动态调整 (§8.13.2)
  if (foeLast === DuelCommand.FINISHER) weights = bump(weights, DuelCommand.RESTRAIN, 30);
  if (foeLast === DuelCommand.RESTRAIN) weights = bump(weights, DuelCommand.FIERCE_ATTACK, 25);
  if (foe.hp / foe.maxHp < 0.3) weights = bump(weights, DuelCommand.FINISHER, 100); // ×2
  if (self.energy >= 50) weights = bump(weights, DuelCommand.FINISHER, 100);
  if (self.hp / self.maxHp < 0.3) {
    weights = bump(weights, DuelCommand.PARRY, 20);
    weights = bump(weights, DuelCommand.DODGE, 20);
    weights = bump(weights, DuelCommand.FIERCE_ATTACK, -20);
  }
  if (!self.sneakUsed && foeLast !== null) weights = bump(weights, DuelCommand.SNEAK_ATTACK, 15);
  if (foe.consecutiveBlocks >= 2) weights = bump(weights, DuelCommand.PROBE, 30);

  // 必杀气力门槛
  if (self.energy < 50) weights = setWeight(weights, DuelCommand.FINISHER, 0);
  // 暗袭每场 1 次
  if (self.sneakUsed) weights = setWeight(weights, DuelCommand.SNEAK_ATTACK, 0);

  // 易怒 (0-A proxy: reckless personality) → 仅猛攻/必杀
  if (p === Personality.RECKLESS && self.hp / self.maxHp < 0.5) {
    weights = weights.map(([c]) => [c, c === DuelCommand.FIERCE_ATTACK || c === DuelCommand.FINISHER ? 1 : 0] as [DuelCommand, number]);
  }

  return pickWeighted(weights, rng);
}

function baseWeights(p: Personality): [DuelCommand, number][] {
  switch (p) {
    case Personality.BRAVE:    return [[DuelCommand.FIERCE_ATTACK, 30], [DuelCommand.RESTRAIN, 15], [DuelCommand.FINISHER, 15], [DuelCommand.PARRY, 15], [DuelCommand.DODGE, 10], [DuelCommand.PROBE, 10], [DuelCommand.SNEAK_ATTACK, 5]];
    case Personality.CALM:     return [[DuelCommand.FIERCE_ATTACK, 10], [DuelCommand.RESTRAIN, 25], [DuelCommand.FINISHER, 5], [DuelCommand.PARRY, 30], [DuelCommand.DODGE, 20], [DuelCommand.PROBE, 5], [DuelCommand.SNEAK_ATTACK, 5]];
    case Personality.RECKLESS: return [[DuelCommand.FIERCE_ATTACK, 35], [DuelCommand.RESTRAIN, 5], [DuelCommand.FINISHER, 25], [DuelCommand.PARRY, 10], [DuelCommand.DODGE, 5], [DuelCommand.PROBE, 15], [DuelCommand.SNEAK_ATTACK, 5]];
    case Personality.CAUTIOUS: return [[DuelCommand.FIERCE_ATTACK, 10], [DuelCommand.RESTRAIN, 20], [DuelCommand.FINISHER, 5], [DuelCommand.PARRY, 25], [DuelCommand.DODGE, 25], [DuelCommand.PROBE, 10], [DuelCommand.SNEAK_ATTACK, 5]];
    case Personality.BOLD:     return [[DuelCommand.FIERCE_ATTACK, 25], [DuelCommand.RESTRAIN, 15], [DuelCommand.FINISHER, 20], [DuelCommand.PARRY, 10], [DuelCommand.DODGE, 10], [DuelCommand.PROBE, 15], [DuelCommand.SNEAK_ATTACK, 5]];
    case Personality.GENTLE:   return [[DuelCommand.FIERCE_ATTACK, 15], [DuelCommand.RESTRAIN, 25], [DuelCommand.FINISHER, 5], [DuelCommand.PARRY, 20], [DuelCommand.DODGE, 20], [DuelCommand.PROBE, 10], [DuelCommand.SNEAK_ATTACK, 5]];
  }
}

function applyUniqueWeights(w: [DuelCommand, number][], u: UniqueId): [DuelCommand, number][] {
  switch (u) {
    case 'wushuang':
      return bump(bump(bump(w, DuelCommand.FINISHER, 50), DuelCommand.FIERCE_ATTACK, 20), DuelCommand.SNEAK_ATTACK, 5);
    case 'wusheng':
      return bump(w, DuelCommand.FIERCE_ATTACK, 15);
    case 'longdan':
      return bump(bump(w, DuelCommand.PROBE, 15), DuelCommand.DODGE, 10);
    case 'tianyi':
      return bump(w, DuelCommand.FINISHER, 20);
    case 'elai':
    case 'huchi':
      return bump(w, DuelCommand.PARRY, 25);
    case 'paoxiao':
    case 'ganglie':
      return bump(w, DuelCommand.FIERCE_ATTACK, 20);
    case 'qishen':
      return bump(w, DuelCommand.FIERCE_ATTACK, 15);
    default:
      return w;
  }
}

function bump(w: [DuelCommand, number][], cmd: DuelCommand, delta: number): [DuelCommand, number][] {
  return w.map(([c, x]) => [c, c === cmd ? Math.max(0, x + delta) : x] as [DuelCommand, number]);
}

function setWeight(w: [DuelCommand, number][], cmd: DuelCommand, val: number): [DuelCommand, number][] {
  return w.map(([c, x]) => [c, c === cmd ? val : x] as [DuelCommand, number]);
}

// ---------------------------------------------------------------------------
// Pre-duel (§8.4): dialogue + 射箭
// ---------------------------------------------------------------------------

function buildPreDuel(
  challenger: Officer,
  defender: Officer,
  uniqueAtk: UniqueId,
  uniqueDef: UniqueId,
): { dialogs: DuelDialog[]; arrowDmg: Record<number, number> } {
  const dialogs: DuelDialog[] = [];
  const arrowDmg: Record<number, number> = { [challenger.id]: 0, [defender.id]: 0 };

  // 阵前对话 (§8.4.1) — small 0-A flavor set
  const atkName = challenger.name;
  const defName = defender.name;
  let atkText = `${atkName} 拍马而出，厉声喝道：「${defName}，可敢与我一战？」`;
  let defText = `${defName} 冷笑应道：「有何不敢！」`;

  if (uniqueAtk === 'wushuang') atkText = `吕布在此！谁来送死？`;
  if (uniqueAtk === 'wusheng') atkText = `关羽凤目圆睁，厉声喝道：「${defName}，汝比颜良文丑如何？」`;
  if (uniqueAtk === 'paoxiao') atkText = `张飞环眼怒睁，一声断喝：「燕人张翼德在此！」`;
  if (uniqueDef === 'wushuang') defText = `吕布狂笑：「哈哈哈哈——你找死！」`;

  dialogs.push({ speakerId: challenger.id, text: atkText, moraleEffect: 0 });
  dialogs.push({ speakerId: defender.id, text: defText, moraleEffect: 0 });

  // 武圣/咆哮 阵前威压
  if (uniqueAtk === 'wusheng') dialogs.push({ speakerId: challenger.id, text: `${atkName} 威压所致，敌军心生畏惧。`, moraleEffect: -10 });
  if (uniqueAtk === 'paoxiao') dialogs.push({ speakerId: challenger.id, text: `${atkName} 一声咆哮，声如巨雷！`, moraleEffect: -15 });

  // 弓弩射箭 (§8.4.2)
  const secAtk = resolveSecondary(challenger);
  const secDef = resolveSecondary(defender);
  if (secAtk === SecondaryWeaponSubType.BOW) arrowDmg[defender.id] = Math.round(challenger.stats.war * 0.5);
  if (secAtk === SecondaryWeaponSubType.CROSSBOW) arrowDmg[defender.id] = Math.round(challenger.stats.war * 0.7);
  if (secDef === SecondaryWeaponSubType.BOW) arrowDmg[challenger.id] = Math.round(defender.stats.war * 0.5);
  if (secDef === SecondaryWeaponSubType.CROSSBOW) arrowDmg[challenger.id] = Math.round(defender.stats.war * 0.7);

  return { dialogs, arrowDmg };
}

// ---------------------------------------------------------------------------
// Narrative (§8.4.3)
// ---------------------------------------------------------------------------

function narrativeFor(
  atkName: string,
  defName: string,
  atkCmd: DuelCommand,
  defCmd: DuelCommand,
  hit: boolean,
  crit: boolean,
  counter: boolean,
  chain: boolean,
  injury: DuelInjury | null,
  defeated: boolean,
  atkUnique: UniqueId,
  weaponType: PrimaryWeaponSubType,
): string {
  const weaponLabel: Record<PrimaryWeaponSubType, string> = {
    [PrimaryWeaponSubType.SWORD]: '剑',
    [PrimaryWeaponSubType.BLADE]: '刀',
    [PrimaryWeaponSubType.SPEAR]: '枪',
    [PrimaryWeaponSubType.HALBERD]: '戟',
    [PrimaryWeaponSubType.BLUNT]: '钝器',
  };
  const w = weaponLabel[weaponType] ?? '兵器';

  if (defeated) return `手起刀落！${defName} 被 ${atkName} 斩于马下！`;
  if (injury) {
    const part: Record<DuelInjury['part'], string> = { arm: '左臂', leg: '右腿', rib: '肋部', head: '额头', severe: '要害' };
    return `${defName} 闷哼一声，${part[injury.part]}中招，鲜血迸流！`;
  }
  if (atkCmd === DuelCommand.FINISHER && defCmd === DuelCommand.RESTRAIN) {
    return `${atkName} 大喝一声，手中${w}化作一道寒光——必杀！岂料 ${defName} 早有防备，巧妙一带，千钧之力竟被尽数化解！`;
  }
  if (atkCmd === DuelCommand.FINISHER && hit) {
    if (atkUnique === 'wushuang') return `吕布狂笑，方天画戟化作漫天血光——必杀！`;
    return `${atkName} 大喝一声，手中${w}化作一道寒光——必杀！`;
  }
  if (crit) {
    if (atkUnique === 'wusheng') return `关羽凤目圆睁，青龙偃月刀当头劈下！`;
    if (atkUnique === 'wushuang') return `吕布狂笑一声，方天画戟挟风雷之势！`;
    if (atkUnique === 'paoxiao') return `张飞环眼怒睁，丈八蛇矛如毒蛇出洞！`;
    return `${atkName} 看准破绽，一刀砍中 ${defName} 要害！`;
  }
  if (chain) return `${atkName} 一招得手，攻势如潮，连番进击！`;
  if (counter) return `${defName} 架住来招，反手便是一击！`;
  if (!hit && defCmd === DuelCommand.DODGE) return `${defName} 身形一闪，${atkName} 的攻击落了空。`;
  if (!hit) return `${atkName} 拍马舞刀，与 ${defName} 战在一处。`;
  return `${atkName} 拍马舞${w}，与 ${defName} 战在一处。`;
}

// ---------------------------------------------------------------------------
// Injury (§8.7)
// ---------------------------------------------------------------------------

function maybeInjury(
  officer: Officer,
  self: DuelCombatantState,
  rng: DuelRng,
): DuelInjury | null {
  const hpRatio = self.hp / self.maxHp;
  // 触发: 每损失30% HP → 判定一次. 简化: 当前 HP 跨越阈值时由调用方判定;
  // 这里按概率(50% - 运气/20 - 体力修正)
  let chance = 0.5 - officer.hidden.luck / 200;
  if (hpRatio > 0.5) chance -= 0.1;
  chance = clamp(chance, 0.05, 0.6);
  if (rng() > chance) return null;

  const roll = rng();
  if (roll < 0.25) return { part: 'arm', attackPenalty: 0.1, dodgePenalty: 0, blockPenalty: 0, stunTurns: 0 };
  if (roll < 0.5) return { part: 'leg', attackPenalty: 0, dodgePenalty: 0.15, blockPenalty: 0, stunTurns: 0 };
  if (roll < 0.7) return { part: 'rib', attackPenalty: 0, dodgePenalty: 0, blockPenalty: 0.2, stunTurns: 0 };
  if (roll < 0.85) return { part: 'head', attackPenalty: 0, dodgePenalty: 0, blockPenalty: 0, stunTurns: 1 };
  return { part: 'severe', attackPenalty: 0.2, dodgePenalty: 0.1, blockPenalty: 0.1, stunTurns: 0 };
}

// ---------------------------------------------------------------------------
// Outcome (§8.8)
// ---------------------------------------------------------------------------

function resolveOutcome(
  winnerOff: Officer,
  loserOff: Officer,
  loserHp: number,
  winnerUnique: UniqueId,
  loserUnique: UniqueId,
  isFatedKill: boolean,
  rng: DuelRng,
): { outcome: DuelResult['outcome']; epilogue: string } {
  // 无双 → 不会被斩/俘
  if (loserUnique === 'wushuang' && !isFatedKill) {
    return { outcome: 'escaped', epilogue: `${loserOff.name} 借赤兔马之速，扬长而去——天下无双，不败于此。` };
  }
  // 历史宿命 → 必斩
  if (isFatedKill) {
    return { outcome: 'killed', epilogue: `${winnerOff.name} 手起刀落，${loserOff.name} 被斩于马下！` };
  }

  // 被斩概率
  let killChance = 0.15 + (winnerOff.hidden.valor - loserOff.hidden.valor) * 0.02;
  if (winnerUnique === 'wushuang') killChance += 0.10;
  if (rng() < clamp(killChance, 0.05, 0.85)) {
    return { outcome: 'killed', epilogue: `${winnerOff.name} 将 ${loserOff.name} 斩于马下。` };
  }
  // 被俘概率
  const captureChance = clamp(0.4 - loserHp * 0.002, 0.1, 0.5);
  if (rng() < captureChance) {
    return { outcome: 'captured', epilogue: `${loserOff.name} 力竭被俘。` };
  }
  // 投降 (体力 <15%)
  if (loserHp / 100 < 0.15 && rng() < 0.3) {
    return { outcome: 'surrendered', epilogue: `${loserOff.name} 丢下兵器，翻身下马请降。` };
  }
  return { outcome: 'escaped', epilogue: `${loserOff.name} 拨马便走，退回本阵。` };
}

// ---------------------------------------------------------------------------
// 宿命对决 (§8.14.1) — 0-A: dataset has no 华雄 yet; fated table is name-based
// and remains empty for 0-A. The hook is wired for 0-B when 华雄 is added.
// ---------------------------------------------------------------------------

const FATED_DUO_PAIRS: Array<[number, number]> = [
  // [关羽, 华雄] — 华雄 absent from 0-A dataset; enabled in 0-B
];

function isFatedDuel(aId: number, bId: number): boolean {
  return FATED_DUO_PAIRS.some(([x, y]) => (x === aId && y === bId) || (x === bId && y === aId));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DuelOfficers {
  challenger: Officer;
  defender: Officer;
}

/** Begin a duel: builds initial state with pre-duel phase resolved. */
export function createDuel(
  battleId: string,
  challenger: Officer,
  defender: Officer,
  cfg: DuelEngineConfig = DEFAULT_DUEL_CONFIG,
  rng: DuelRng = Math.random,
): DuelState {
  const uniqueAtk = uniqueOf(challenger);
  const uniqueDef = uniqueOf(defender);
  const { dialogs, arrowDmg } = buildPreDuel(challenger, defender, uniqueAtk, uniqueDef);

  const atk = makeCombatant(challenger, cfg);
  const def = makeCombatant(defender, cfg);

  // Apply 射箭 damage
  atk.hp = Math.max(1, atk.hp - (arrowDmg[challenger.id] ?? 0));
  def.hp = Math.max(1, def.hp - (arrowDmg[defender.id] ?? 0));

  // 先手判定 (§8.3.3)
  const atkFirstScore = Math.max(challenger.hidden.agility, challenger.hidden.burst) + resolveWeapon(challenger).firstBonus;
  const defFirstScore = Math.max(defender.hidden.agility, defender.hidden.burst) + resolveWeapon(defender).firstBonus;
  let firstId = challenger.id;
  if (defFirstScore > atkFirstScore) firstId = defender.id;
  else if (defFirstScore === atkFirstScore && rng() < 0.5) firstId = defender.id;
  // 无双 / 天义 → 必先手
  if (uniqueAtk === 'wushuang' || uniqueAtk === 'tianyi') firstId = challenger.id;
  if (uniqueDef === 'wushuang' || uniqueDef === 'tianyi' && firstId === challenger.id) firstId = defender.id;

  return {
    battleId,
    phase: 'dueling',
    challengerId: challenger.id,
    defenderId: defender.id,
    round: 0,
    combatants: {
      [challenger.id]: atk,
      [defender.id]: def,
    },
    turnOrder: [firstId, firstId === challenger.id ? defender.id : challenger.id],
    preDuelDone: true,
    dialogueLog: dialogs,
    roundHistory: [],
    autoResolve: true,
    speedMode: 'full',
  };
}

/** Run a single round and append it to history. Returns updated state. */
export function stepDuel(
  state: DuelState,
  challenger: Officer,
  defender: Officer,
  cfg: DuelEngineConfig = DEFAULT_DUEL_CONFIG,
  rng: DuelRng = Math.random,
): DuelState {
  if (state.phase !== 'dueling') return state;

  const [firstId, secondId] = state.turnOrder;
  const firstOff = firstId === challenger.id ? challenger : defender;
  const secondOff = secondId === challenger.id ? challenger : defender;
  const firstC = state.combatants[firstId];
  const secondC = state.combatants[secondId];
  const firstUnique = uniqueOf(firstOff);
  const secondUnique = uniqueOf(secondOff);
  const firstWeapon = resolveWeapon(firstOff);
  const secondWeapon = resolveWeapon(secondOff);

  // 选指令
  const firstCmd = aiCommand(firstOff, firstC, secondC, secondC.lastCommand, firstUnique, rng);
  const secondCmd = aiCommand(secondOff, secondC, firstC, firstC.lastCommand, secondUnique, rng);

  // 解算: 先手方攻击后手方, 然后后手方攻击先手方 (若仍存活)
  const round = resolveExchange(firstId, secondId, firstCmd, secondCmd, firstOff, secondOff, firstC, secondC, firstWeapon, secondWeapon, firstUnique, secondUnique, state.round + 1, rng);

  // 更新 combatants
  const combatants: Record<number, DuelCombatantState> = {
    ...state.combatants,
    [firstId]: { ...firstC, hp: round.hpAfter[firstId], lastCommand: firstCmd, consecutiveBlocks: firstCmd === DuelCommand.PARRY ? firstC.consecutiveBlocks + 1 : 0, sneakUsed: firstC.sneakUsed || firstCmd === DuelCommand.SNEAK_ATTACK, injury: round.injuryApplied[firstId] ?? firstC.injury },
    [secondId]: { ...secondC, hp: round.hpAfter[secondId], lastCommand: secondCmd, consecutiveBlocks: secondCmd === DuelCommand.PARRY ? secondC.consecutiveBlocks + 1 : 0, sneakUsed: secondC.sneakUsed || secondCmd === DuelCommand.SNEAK_ATTACK, injury: round.injuryApplied[secondId] ?? secondC.injury },
  };

  const nextRound = state.round + 1;
  const firstDead = combatants[firstId].hp <= 0;
  const secondDead = combatants[secondId].hp <= 0;
  const roundsOver = nextRound >= cfg.maxRounds;

  if (firstDead || secondDead || roundsOver) {
    return finalizeDuel(state, challenger, defender, combatants, round, rng);
  }

  return {
    ...state,
    round: nextRound,
    combatants,
    roundHistory: [...state.roundHistory, round],
  };
}

function resolveExchange(
  firstId: number,
  secondId: number,
  firstCmd: DuelCommand,
  secondCmd: DuelCommand,
  firstOff: Officer,
  secondOff: Officer,
  firstC: DuelCombatantState,
  secondC: DuelCombatantState,
  firstWeapon: WeaponProfile,
  secondWeapon: WeaponProfile,
  firstUnique: UniqueId,
  secondUnique: UniqueId,
  roundNum: number,
  rng: DuelRng,
): DuelRound {
  const commands: [DuelCommand, DuelCommand] = [firstCmd, secondCmd];
  const hits: Record<number, boolean> = { [firstId]: false, [secondId]: false };
  const damages: Record<number, number> = { [firstId]: 0, [secondId]: 0 };
  const criticals: Record<number, boolean> = { [firstId]: false, [secondId]: false };
  const counterDamages: Record<number, number> = { [firstId]: 0, [secondId]: 0 };
  const counterCriticals: Record<number, boolean> = { [firstId]: false, [secondId]: false };
  const chainHits: Record<number, number[]> = { [firstId]: [], [secondId]: [] };
  const injuryApplied: Record<number, DuelInjury | null> = { [firstId]: null, [secondId]: null };
  const hpAfter: Record<number, number> = { [firstId]: firstC.hp, [secondId]: secondC.hp };

  let atkName = firstOff.name;
  let defName = secondOff.name;
  let atkUnique = firstUnique;
  let weaponType = firstWeapon.type;
  let defeated = false;

  // 先手 → 后手
  {
    const clash = resolveClash(firstCmd, secondCmd);
    const { damage, hit } = computeDamage(firstOff, secondOff, firstC, firstCmd, firstWeapon, clash, rng);
    hits[firstId] = hit;
    // 暴击
    let crit = false;
    let finalDmg = damage;
    if (hit && firstCmd !== DuelCommand.FINISHER && firstCmd !== DuelCommand.SNEAK_ATTACK && firstCmd !== DuelCommand.PARRY && firstCmd !== DuelCommand.DODGE) {
      const critRate = computeCritRate(firstOff, firstWeapon, firstCmd, firstUnique);
      crit = rng() < critRate;
      if (crit) finalDmg = Math.round(finalDmg * critMultiplier(firstOff, firstUnique, firstWeapon));
    }
    criticals[firstId] = crit;
    damages[firstId] = finalDmg;
    hpAfter[secondId] = Math.max(0, hpAfter[secondId] - finalDmg);
    atkName = firstOff.name; defName = secondOff.name; atkUnique = firstUnique; weaponType = firstWeapon.type;

    // 连击 (专属)
    if (hit && (firstUnique === 'wushuang' || firstUnique === 'tianyi' || firstUnique === 'longdan' || firstUnique === 'wusheng')) {
      const chains = computeChain(firstUnique, finalDmg, firstOff, firstWeapon, rng);
      chainHits[firstId] = chains.hits;
      hpAfter[secondId] = Math.max(0, hpAfter[secondId] - chains.totalExtra);
    }

    // 格挡反手 (后手方若选格挡且未被周旋克)
    if (hit && secondCmd === DuelCommand.PARRY && !clash.parryCounterDisabled && secondC.hp > 0) {
      const counterRate = computeCounterRate(secondOff, secondUnique, false);
      if (rng() < counterRate) {
        let counterDmg = Math.max(1, Math.round(finalDmg * 0.5));
        if (secondUnique === 'ganglie') counterDmg = finalDmg; // 伤害×1.0
        const counterCrit = rng() < computeCritRate(secondOff, secondWeapon, DuelCommand.FIERCE_ATTACK, secondUnique);
        if (counterCrit) counterDmg = Math.round(counterDmg * critMultiplier(secondOff, secondUnique, secondWeapon));
        counterDamages[secondId] = counterDmg;
        counterCriticals[secondId] = counterCrit;
        hpAfter[firstId] = Math.max(0, hpAfter[firstId] - counterDmg);
      }
    }

    // 受伤判定 (后手方)
    if (hit && finalDmg > 0) {
      const newRatio = hpAfter[secondId] / secondC.maxHp;
      const oldRatio = secondC.hp / secondC.maxHp;
      if (Math.floor(oldRatio / 0.3) > Math.floor(newRatio / 0.3)) {
        const inj = maybeInjury(secondOff, { ...secondC, hp: hpAfter[secondId] }, rng);
        if (inj) injuryApplied[secondId] = inj;
      }
    }

    if (hpAfter[secondId] <= 0) defeated = true;
  }

  // 后手 → 先手 (若后手存活且非纯防御被秒)
  if (!defeated && hpAfter[secondId] > 0 && secondCmd !== DuelCommand.PARRY && secondCmd !== DuelCommand.DODGE) {
    const clash2 = resolveClash(secondCmd, firstCmd);
    const { damage, hit } = computeDamage(secondOff, firstOff, { ...secondC, hp: hpAfter[secondId] }, secondCmd, secondWeapon, clash2, rng);
    hits[secondId] = hit;
    let crit = false;
    let finalDmg = damage;
    if (hit && secondCmd !== DuelCommand.FINISHER && secondCmd !== DuelCommand.SNEAK_ATTACK) {
      const critRate = computeCritRate(secondOff, secondWeapon, secondCmd, secondUnique);
      crit = rng() < critRate;
      if (crit) finalDmg = Math.round(finalDmg * critMultiplier(secondOff, secondUnique, secondWeapon));
    }
    criticals[secondId] = crit;
    damages[secondId] = finalDmg;
    hpAfter[firstId] = Math.max(0, hpAfter[firstId] - finalDmg);
    atkName = secondOff.name; defName = firstOff.name; atkUnique = secondUnique; weaponType = secondWeapon.type;
    if (hpAfter[firstId] <= 0) defeated = true;

    if (hit && finalDmg > 0) {
      const newRatio = hpAfter[firstId] / firstC.maxHp;
      const oldRatio = firstC.hp / firstC.maxHp;
      if (Math.floor(oldRatio / 0.3) > Math.floor(newRatio / 0.3)) {
        const inj = maybeInjury(firstOff, { ...firstC, hp: hpAfter[firstId] }, rng);
        if (inj) injuryApplied[firstId] = inj;
      }
    }
  }

  const description = narrativeFor(atkName, defName, firstCmd, secondCmd, hits[firstId], criticals[firstId], counterDamages[secondId] > 0, chainHits[firstId].length > 0, injuryApplied[secondId], defeated, atkUnique, weaponType);

  const detail = `R${roundNum}: ${firstOff.name}[${cmdLabel(firstCmd)}] vs ${secondOff.name}[${cmdLabel(secondCmd)}] | 命中:${hits[firstId] ? '是' : '否'} 伤害:${damages[firstId]}${criticals[firstId] ? '(暴)' : ''}${chainHits[firstId].length ? `(连${chainHits[firstId].length})` : ''}${counterDamages[secondId] ? ` 反手:${counterDamages[secondId]}` : ''}`;

  return {
    round: roundNum,
    commands,
    hits,
    damages,
    criticals,
    counterDamages,
    counterCriticals,
    chainHits,
    injuryApplied,
    hpAfter,
    description,
    detail,
  };
}

function computeChain(
  unique: UniqueId,
  baseDmg: number,
  officer: Officer,
  weapon: WeaponProfile,
  rng: DuelRng,
): { hits: number[]; totalExtra: number } {
  // 吕布 三连击 (第二×0.7, 第三×0.5); 天义 二连 (第二×0.8); 龙胆 累加概率; 武圣 击败后连击(此处简化)
  if (unique === 'wushuang') {
    const h2 = Math.max(1, Math.round(baseDmg * 0.7 * (0.9 + rng() * 0.2)));
    const h3 = Math.max(1, Math.round(baseDmg * 0.5 * (0.9 + rng() * 0.2)));
    return { hits: [h2, h3], totalExtra: h2 + h3 };
  }
  if (unique === 'tianyi') {
    const h2 = Math.max(1, Math.round(baseDmg * 0.8 * (0.9 + rng() * 0.2)));
    return { hits: [h2], totalExtra: h2 };
  }
  if (unique === 'longdan') {
    // 累加概率 (上限60%, 简化: 30% 一次连击)
    if (rng() < 0.3) {
      const h2 = Math.max(1, Math.round(baseDmg * 0.6));
      return { hits: [h2], totalExtra: h2 };
    }
  }
  void officer; void weapon;
  return { hits: [], totalExtra: 0 };
}

function cmdLabel(c: DuelCommand): string {
  switch (c) {
    case DuelCommand.FIERCE_ATTACK: return '猛攻';
    case DuelCommand.RESTRAIN: return '牵制';
    case DuelCommand.FINISHER: return '必杀';
    case DuelCommand.PARRY: return '格挡';
    case DuelCommand.DODGE: return '闪避';
    case DuelCommand.PROBE: return '周旋';
    case DuelCommand.SNEAK_ATTACK: return '暗袭';
  }
}

function finalizeDuel(
  state: DuelState,
  challenger: Officer,
  defender: Officer,
  combatants: Record<number, DuelCombatantState>,
  lastRound: DuelRound,
  rng: DuelRng,
): DuelState {
  const cHp = combatants[challenger.id].hp;
  const dHp = combatants[defender.id].hp;
  const rounds = [...state.roundHistory, lastRound];

  let winnerOff: Officer;
  let loserOff: Officer;
  let winnerId: number;
  let loserId: number;
  let draw = false;

  if (cHp <= 0 && dHp <= 0) draw = true;
  else if (cHp <= 0) { winnerOff = defender; loserOff = challenger; winnerId = defender.id; loserId = challenger.id; }
  else if (dHp <= 0) { winnerOff = challenger; loserOff = defender; winnerId = challenger.id; loserId = challenger.id; }
  else draw = true; // 回合耗尽

  if (draw) {
    const result: DuelResult = {
      winnerId: 0,
      loserId: 0,
      outcome: 'draw',
      rounds,
      moraleChange: { winner: 3, loser: 3 },
      audienceMoraleChange: 3,
      meritReward: 5,
      epilogue: `双方大战 ${rounds.length} 回合，不分胜负，各回本阵。`,
    };
    return { ...state, round: state.round + 1, combatants, roundHistory: rounds, phase: 'resolved', result };
  }

  const winnerUnique = uniqueOf(winnerOff!);
  const loserUnique = uniqueOf(loserOff!);
  const fated = isFatedDuel(challenger.id, defender.id);
  const { outcome, epilogue } = resolveOutcome(winnerOff!, loserOff!, combatants[loserId!].hp, winnerUnique, loserUnique, fated, rng);

  const moraleTable: Record<DuelResult['outcome'], { winner: number; loser: number; audience: number; merit: number }> = {
    killed:      { winner: 15, loser: 0,  audience: -10, merit: 30 },
    captured:    { winner: 10, loser: 0,  audience: -5,  merit: 20 },
    escaped:     { winner: 5,  loser: 0,  audience: 2,   merit: 10 },
    surrendered: { winner: 8,  loser: 0,  audience: -8,  merit: 15 },
    draw:        { winner: 3,  loser: 3,  audience: 3,   merit: 5 },
  };
  const morale = moraleTable[outcome];

  const result: DuelResult = {
    winnerId: winnerId!,
    loserId: loserId!,
    outcome,
    rounds,
    moraleChange: { winner: morale.winner, loser: morale.loser },
    audienceMoraleChange: morale.audience,
    meritReward: morale.merit,
    epilogue,
  };

  return {
    ...state,
    round: state.round + 1,
    combatants,
    roundHistory: rounds,
    phase: 'resolved',
    result,
  };
}

/** Run a duel to completion (skip mode). */
export function runDuelToCompletion(
  state: DuelState,
  challenger: Officer,
  defender: Officer,
  cfg: DuelEngineConfig = DEFAULT_DUEL_CONFIG,
  rng: DuelRng = Math.random,
): DuelState {
  let s = state;
  let guard = 0;
  while (s.phase === 'dueling' && guard < cfg.maxRounds + 5) {
    s = stepDuel(s, challenger, defender, cfg, rng);
    guard++;
  }
  return s;
}

/** Check whether a challenge is valid given battle context (§8.3). */
export function canChallenge(
  challenger: Officer,
  defender: Officer,
  challengerEnergy: number,
  cfg: DuelEngineConfig = DEFAULT_DUEL_CONFIG,
): { ok: boolean; reason?: string } {
  if (challengerEnergy < cfg.challengeEnergyCost) return { ok: false, reason: '气力不足' };
  // 文官不可发起 (武 < 50 视为文官, 0-A 简化)
  if (challenger.stats.war < 50) return { ok: false, reason: '文官不可发起单挑' };
  if (defender.stats.war < 50) return { ok: false, reason: '文官不可被挑战' };
  return { ok: true };
}

/** AI 决策是否接受挑战 (§8.13.1). */
export function aiAcceptChallenge(
  challenger: Officer,
  defender: Officer,
  defenderStaminaRatio: number,
): boolean {
  void challenger;
  void defender;
  if (defenderStaminaRatio < 0.4) return false;
  const diff = (challenger?.stats.war ?? 0) - (defender?.stats.war ?? 0);
  if (diff >= 15) return false; // 拒绝保命
  return true;
}