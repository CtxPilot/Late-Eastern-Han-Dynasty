// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { Weather, UnitProficiency, meritEffects, meritLevelFor, getUnitAbilityUses, recordUnitAbilityUse, resolveProficiencyPower, isUnitSurrounded, resolveHexSurround, directionTo, type BattleUnit, type CombatAbilityDef, type CombatAbilityLevel, type HexCoord, type Officer, type TerrainType, type UnitTemplate, type UnitType } from '@leh/shared';
import { hexDistance, hexKey } from './hex.js';
import { reachable } from './pathfinding.js';
import { calcDamage, getUnitMatchup } from './damage.js';
import { hexFormationMods } from './hex-formation.js';
import { applySpecialEffect } from './special-effects.js';
import { resolveAttack as resolveCritAttack, type AttackActor, type CritRng } from './crit.js';
import { equipCritRateFor } from '../engine/items.js';
import { effectiveMovement, effectiveUnitRange, hasMovedThisTurn } from './weather.js';

export interface EnemyOfficerStats {
  war: number;
  leadership: number;
  name: string;
  /** 玩家攻击路径同源的装备护甲加成；旧调用缺省为 0。 */
  armorDefense?: number;
}

function sideAlive(units: readonly BattleUnit[], side: 'attacker' | 'defender'): boolean {
  return units.some((unit) => unit.side === side && isActiveBattleUnit(unit));
}

/** 撤退单位仍可保留兵力快照，但不再是本场战斗的活跃部队。 */
function isActiveBattleUnit(unit: BattleUnit): boolean {
  return !unit.isDestroyed && !unit.isRetreated && unit.troopCount > 0;
}

function markEnemyWaiting(units: BattleUnit[], unitId: string): BattleUnit[] {
  return units.map((unit) => unit.id === unitId ? { ...unit, hasActed: true, mp: 0 } : unit);
}

/** S10 0-A tactical AI: deterministic scoring with attacks, fire tactics and terrain-aware movement. */
function siegeDefBonus(isSiege: boolean, side: 'attacker' | 'defender'): number {
  return isSiege && side === 'defender' ? 3 : 0;
}

export function runSimpleEnemyAi(
  units: BattleUnit[],
  terrainMap: TerrainType[][],
  unitTemplates: Record<string, UnitTemplate>,
  officerStats: Record<number, EnemyOfficerStats>,
  cols: number,
  rows: number,
  enemySide: 'attacker' | 'defender',
  playerSide: 'attacker' | 'defender',
  rng: CritRng,
  strongAgainst: Record<string, UnitType[]> = {},
  officers?: Record<number, Officer>,
  battleTurn?: number,
  weather: Weather = Weather.CLEAR,
  isSiege = false,
): { units: BattleUnit[]; message: string; over: boolean; winner: 'attacker' | 'defender' | null } {
  // 行动状态是回合契约的一部分：重入 AI（例如重复请求/恢复）不得让已行动单位再次执行。
  const liveEnemies = units.filter((u) => u.side === enemySide && isActiveBattleUnit(u));
  const enemies = liveEnemies.filter((u) => !u.hasActed);
  const players = units.filter((u) => u.side === playerSide && isActiveBattleUnit(u));

  if (liveEnemies.length === 0) {
    return { units, message: '敌军全灭', over: true, winner: playerSide };
  }
  if (players.length === 0) {
    return { units, message: '我军全灭', over: true, winner: enemySide };
  }
  if (enemies.length === 0) {
    return { units, message: '敌军待机', over: false, winner: null };
  }

  let next = units.map((u) => ({ ...u }));
  const messages: string[] = [];

  for (const enemy of enemies) {
    const live = next.find((u) => u.id === enemy.id);
    if (!live || !isActiveBattleUnit(live)) continue;

    // 0-A 最小撤退语义：低士气或重创且未被协同包围的敌军直接沿既有
    // isRetreated 终态退出战场。受围单位先交给下面的突围/接战逻辑处理，
    // 避免“被锁住却瞬间消失”；该判定确定性且不消费 RNG。
    const retreatEligible = shouldEnemyRetreat(next, live);
    const intercepted = retreatEligible && isEnemyIntercepted(next, live);
    if (retreatEligible && !intercepted) {
      next = next.map((unit) => unit.id === live.id
        ? { ...unit, isRetreated: true, hasActed: true, mp: 0 }
        : unit);
      const name = officerStats[live.commanderId]?.name ?? '敌军';
      messages.push(`${name} 撤退`);
      if (!next.some((unit) => unit.side === enemySide && isActiveBattleUnit(unit))) {
        return {
          units: next,
          message: `${messages.join('；')}；敌军撤退`,
          over: true,
          winner: playerSide,
        };
      }
      continue;
    }

    if (intercepted) {
      const name = officerStats[live.commanderId]?.name ?? '敌军';
      messages.push(`${name} 被截击`);
      const pursuit = applyPursuitToRetreater(next, live, terrainMap, unitTemplates, officerStats, playerSide, strongAgainst, weather, isSiege);
      if (pursuit) {
        next = pursuit.units;
        messages.push(pursuit.message);
        const updated = next.find((unit) => unit.id === live.id);
        if (!updated || updated.isDestroyed || updated.troopCount <= 0) {
          if (pursuit.killed) {
            if (!next.some((unit) => unit.side === enemySide && isActiveBattleUnit(unit))) {
              return {
                units: next,
                message: messages.join('；'),
                over: true,
                winner: playerSide,
              };
            }
          }
          continue;
        }
        // 被截击但未溃灭的单位仍按原链继续行动，live 刷新为追击后的快照
        const refreshed = next.find((unit) => unit.id === live.id);
        if (refreshed) {
          // 更新 live 引用供后续突围/目标选择使用（保持同一对象语义）
          (live as unknown as { troopCount: number; morale: number }).troopCount = refreshed.troopCount;
          (live as unknown as { morale: number }).morale = refreshed.morale;
        }
      }
    }

    // 被截击的撤退尝试必须先处理相邻截击者；否则全局目标评分可能让低士气部队
    // 越过贴身敌军去攻击另一支更“划算”的目标，既不符合截击语义，也会让战报中的
    // “被截击”只成为旁观标签。候选仍使用同一确定性评分，不消费额外 RNG。
    const target = intercepted
      ? selectInterceptionTarget(live, next, playerSide, unitTemplates, strongAgainst)
        ?? selectTarget(live, next, playerSide, unitTemplates, strongAgainst)
      : selectTarget(live, next, playerSide, unitTemplates, strongAgainst);
    if (!target) {
      next = markEnemyWaiting(next, live.id);
      messages.push(`${officerStats[live.commanderId]?.name ?? '敌军'} 无目标，待机`);
      continue;
    }

    const ut = unitTemplates[live.unitType];
    if (!ut) {
      next = markEnemyWaiting(next, live.id);
      messages.push(`${officerStats[live.commanderId]?.name ?? '敌军'} 兵种数据缺失，待机`);
      continue;
    }
    // 受围且有空位时先尝试解除派生包围；这是一次走位，不新增“突围中”状态。
    const breakoutPosition = chooseSurroundBreakoutPosition(next, live, terrainMap, cols, rows, weather);
    let acting = live;
    let actingTarget = target;
    let brokeOut = false;
    if (breakoutPosition) {
      next = next.map((unit) => unit.id === live.id
        ? {
            ...unit,
            position: breakoutPosition,
            facing: directionTo(breakoutPosition, target.position),
            hasActed: true,
            mp: 0,
          }
        : unit);
      acting = next.find((unit) => unit.id === live.id)!;
      actingTarget = selectTarget(acting, next, playerSide, unitTemplates, strongAgainst)
        ?? next.find((unit) => unit.id === target.id && isActiveBattleUnit(unit))
        ?? target;
      if (actingTarget.id !== target.id) {
        next = next.map((unit) => unit.id === acting.id
          ? { ...unit, facing: directionTo(unit.position, actingTarget.position) }
          : unit);
        acting = next.find((unit) => unit.id === live.id)!;
      }
      brokeOut = true;
      const name = officerStats[live.commanderId]?.name ?? '敌军';
      messages.push(`${name} 突围走位`);
    }

    const dist = hexDistance(acting.position, actingTarget.position);

    const ability = tryAbilityTactic(next, acting, actingTarget, terrainMap, unitTemplates, officerStats, officers, strongAgainst, rng, weather, isSiege);
    if (ability) {
      next = ability.units;
      messages.push(ability.message);
      if (ability.over) return { units: next, message: messages.join('；'), over: true, winner: ability.winner };
      continue;
    }

    const fire = tryFireTactic(next, acting, actingTarget, terrainMap, officers, weather, rng);
    if (fire) {
      next = fire.units;
      messages.push(fire.message);
      if (fire.over) return { units: next, message: messages.join('；'), over: true, winner: fire.winner };
      continue;
    }

    const unitRange = effectiveUnitRange(ut.range, weather);
    if (dist <= unitRange) {
      if (weather === Weather.FOG && ut.range > 1) {
        const name = officerStats[live.commanderId]?.name ?? '敌军';
        next = markEnemyWaiting(next, live.id);
        messages.push(`${name} 雾中无法射击`);
        continue;
      }
      const r = doAttack(next, acting, actingTarget, terrainMap, unitTemplates, officerStats, rng, strongAgainst, officers, battleTurn, weather, isSiege);
      next = r.units;
      messages.push(r.message);
      if (r.over) return { units: next, message: messages.join('；'), over: true, winner: r.winner };
      continue;
    }

    if (brokeOut) {
      continue;
    }

    const blocked = new Set(
      next
        .filter((u) => u.id !== live.id && isActiveBattleUnit(u))
        .map((u) => hexKey(u.position)),
    );
    const range = reachable(
      live.position,
      effectiveMovement(live.maxMp, weather),
      cols,
      rows,
      (h) => terrainMap[h.r]?.[h.q] ?? ('plain' as TerrainType),
      blocked,
    );
    range.delete(hexKey(live.position));

    // 先尝试最小协同包围走位：已有一支敌军从一个有效接战方向贴住目标时，
    // 后续敌军优先占用另一个可达邻接格。包围仍由 shared 派生，不写入新状态。
    const cooperativePosition = chooseCooperativeSurroundPosition(next, live, target, range);
    let best: HexCoord | null = cooperativePosition;
    if (!best) {
      let bestScore = movementScore(live.position, target, live, terrainMap);
      for (const key of range.keys()) {
        const [q, r] = key.split(',').map(Number);
        const score = movementScore({ q, r }, target, live, terrainMap);
        if (score < bestScore) {
          bestScore = score;
          best = { q, r };
        }
      }
    }

    if (best) {
      next = next.map((u) =>
        u.id === live.id
          ? {
              ...u,
              position: { q: best!.q, r: best!.r },
              // AI 走位与玩家 moveUnit 保持同一朝向契约；否则移动后的敌军仍
              // 保留旧朝向，六角协同包围派生会把它误判为背向目标。
              facing: directionTo({ q: best!.q, r: best!.r }, target.position),
              hasActed: true,
              mp: 0,
            }
          : u,
      );
      const name = officerStats[live.commanderId]?.name ?? '敌军';
      messages.push(cooperativePosition ? `${name} 迂回包抄` : `${name} 向我军移动`);
      let moved = next.find((u) => u.id === live.id)!;
      const movedTarget = selectTarget(moved, next, playerSide, unitTemplates, strongAgainst);
      if (movedTarget && hexDistance(moved.position, movedTarget.position) <= effectiveUnitRange(ut.range, weather) && !(weather === Weather.FOG && ut.range > 1)) {
        // 目标评分可能因接敌距离变化而改选目标；若本回合继续攻击，朝向应
        // 以真正出手的目标为准，保证后续包围态势与行动演出一致。
        if (movedTarget.id !== target.id) {
          next = next.map((u) => u.id === moved.id
            ? { ...u, facing: directionTo(u.position, movedTarget.position) }
            : u);
          moved = next.find((u) => u.id === live.id)!;
        }
        const still = next.find((u) => u.id === movedTarget.id && isActiveBattleUnit(u));
        if (still) {
          const r = doAttack(next, moved, still, terrainMap, unitTemplates, officerStats, rng, strongAgainst, officers, battleTurn, weather, isSiege);
          next = r.units;
          messages.push(r.message);
          if (r.over) {
            return { units: next, message: messages.join('；'), over: true, winner: r.winner };
          }
        }
      }
    } else {
      // 被其他单位完全阻挡时也要结束本回合，避免重入 AI 无限重复寻路。
      next = markEnemyWaiting(next, live.id);
      const name = officerStats[live.commanderId]?.name ?? '敌军';
      messages.push(`${name} 无法接近目标，待机`);
    }
  }

  return {
    units: next,
    message: messages.join('；') || '敌军待机',
    over: false,
    winner: null,
  };
}

/**
 * 0-A 敌军主动撤退门槛：不受协同包围且士气≤20，或当前兵力≤最大兵力25%。
 * 这是既有 isRetreated 终态的 AI 消费；相邻截击门禁在下方单独处理，不代表完整追击/截击/攻城突围规则。
 */
function shouldEnemyRetreat(units: readonly BattleUnit[], unit: BattleUnit): boolean {
  if (isUnitSurrounded(units, unit.id)) return false;
  return unit.morale <= 20 || unit.troopCount / Math.max(1, unit.maxTroops) <= 0.25;
}

/**
 * 最小截击门禁：相邻且仍在场的敌对部队能封住瞬时脱离窗口。
 * 这只阻断“直接标记 isRetreated”，不新增追击状态；单位随后继续原有战法、火计或普攻链。
 */
function isEnemyIntercepted(units: readonly BattleUnit[], unit: BattleUnit): boolean {
  return units.some((candidate) => candidate.side !== unit.side
    && isActiveBattleUnit(candidate)
    && hexDistance(candidate.position, unit.position) === 1);
}

/** 追击系数：按 08 §二十七 取基础伤害中位值 ×0.6。 */
const PURSUIT_COEFF = 0.6;

/**
 * 被截击的撤退单位追加一次追击伤害。由相邻最强截击者出手，必中、不触发暴击/反击/连击，
 * 中位随机（0.5→1.0），仅削减被截单位的兵力/士气；不消费权威 RNG 序列。
 */
function applyPursuitToRetreater(
  units: BattleUnit[],
  retreater: BattleUnit,
  terrainMap: TerrainType[][],
  unitTemplates: Record<string, UnitTemplate>,
  officerStats: Record<number, EnemyOfficerStats>,
  playerSide: 'attacker' | 'defender',
  strongAgainst: Record<string, UnitType[]>,
  weather: Weather,
  isSiege = false,
): { units: BattleUnit[]; message: string; killed: boolean } | null {
  const interceptor = selectInterceptionTarget(retreater, units, playerSide, unitTemplates, strongAgainst);
  if (!interceptor) return null;
  const atkT = unitTemplates[interceptor.unitType];
  const defT = unitTemplates[retreater.unitType];
  const atkO = officerStats[interceptor.commanderId];
  const defO = officerStats[retreater.commanderId];
  if (!atkT || !defT || !atkO || !defO) return null;
  const matchup = getUnitMatchup(interceptor.unitType, retreater.unitType, strongAgainst);
  const atkTerrain = terrainMap[interceptor.position.r]?.[interceptor.position.q] ?? ('plain' as TerrainType);
  const defTerrain = terrainMap[retreater.position.r]?.[retreater.position.q] ?? ('plain' as TerrainType);
  const medianRng: CritRng = () => 0.5;
  const base = calcDamage(
    {
      unitAttack: atkT.attack, unitDefense: atkT.defense, officerWar: atkO.war,
      officerLeadership: atkO.leadership, troops: interceptor.troopCount, maxTroops: interceptor.maxTroops,
      morale: interceptor.morale, terrain: atkTerrain, weather, matchup,
      formationAtk: hexFormationMods(interceptor.formation).atk,
    },
    {
      unitAttack: defT.attack, unitDefense: defT.defense, officerWar: defO.war,
      officerLeadership: defO.leadership, troops: retreater.troopCount, maxTroops: retreater.maxTroops,
      morale: retreater.morale, terrain: defTerrain, weather,
      armorDefense: defO.armorDefense,
      formationDef: hexFormationMods(retreater.formation).def + siegeDefBonus(isSiege, retreater.side),
    },
    medianRng,
  );
  const pursuitDamage = Math.max(1, Math.round(base * PURSUIT_COEFF));
  const next = units.map((unit) => {
    if (unit.id !== retreater.id) return unit;
    const troops = Math.max(0, unit.troopCount - pursuitDamage);
    return {
      ...unit,
      troopCount: troops,
      isDestroyed: troops <= 0,
      morale: Math.max(0, unit.morale - 2),
    };
  });
  const killed = (next.find((unit) => unit.id === retreater.id)?.troopCount ?? 0) <= 0;
  const interceptorName = officerStats[interceptor.commanderId]?.name ?? '截击者';
  const retreaterName = officerStats[retreater.commanderId]?.name ?? '被截者';
  return {
    units: next,
    message: `${interceptorName} 追击 ${retreaterName}，造成 ${pursuitDamage} 伤害${killed ? '—被追击溃灭' : ''}`,
    killed,
  };
}

/**
 * 在不新增战场状态的前提下，为敌军寻找第二个有效接战方向。
 * 只在当前目标已有一个有效包围来源、且目标尚未被包围时触发；候选按可达剩余
 * 移动力、方向和坐标稳定排序，保证同一快照重放得到同一走位且不消费 RNG。
 */
function chooseCooperativeSurroundPosition(
  units: readonly BattleUnit[],
  mover: BattleUnit,
  target: BattleUnit,
  range: ReadonlyMap<string, number>,
): HexCoord | null {
  const current = resolveHexSurround(units, target.id);
  if (current.isSurrounded || current.enemyDirections.length === 0) return null;

  const candidates = [...range.entries()]
    .map(([key, remainingMp]) => {
      const [q, r] = key.split(',').map(Number);
      return { position: { q, r }, remainingMp };
    })
    .filter((candidate) => hexDistance(candidate.position, target.position) === 1)
    .filter((candidate) => !current.enemyDirections.includes(directionTo(target.position, candidate.position)))
    .map((candidate) => {
      const hypothetical = units.map((unit) => unit.id === mover.id
        ? {
            ...unit,
            position: candidate.position,
            facing: directionTo(candidate.position, target.position),
          }
        : unit);
      return { ...candidate, hypothetical };
    })
    .filter((candidate) => resolveHexSurround(candidate.hypothetical, target.id).isSurrounded)
    .sort((a, b) => b.remainingMp - a.remainingMp
      || directionTo(target.position, a.position) - directionTo(target.position, b.position)
      || a.position.r - b.position.r
      || a.position.q - b.position.q);

  return candidates[0]?.position ?? null;
}

/**
 * 受围敌军的最小突围走位：只接受能让派生包围消失的可达空格，优先减少接战方向，
 * 再保留更多移动力，最后按坐标稳定排序。没有合法空格时交回原有攻击/走位逻辑。
 */
function chooseSurroundBreakoutPosition(
  units: readonly BattleUnit[],
  mover: BattleUnit,
  terrainMap: TerrainType[][],
  cols: number,
  rows: number,
  weather: Weather,
): HexCoord | null {
  if (!isUnitSurrounded(units, mover.id)) return null;

  const blocked = new Set(
    units
      .filter((unit) => unit.id !== mover.id && isActiveBattleUnit(unit))
      .map((unit) => hexKey(unit.position)),
  );
  const range = reachable(
    mover.position,
    effectiveMovement(mover.maxMp, weather),
    cols,
    rows,
    (hex) => terrainMap[hex.r]?.[hex.q] ?? ('plain' as TerrainType),
    blocked,
  );
  range.delete(hexKey(mover.position));

  const candidates = [...range.entries()]
    .map(([key, remainingMp]) => {
      const [q, r] = key.split(',').map(Number);
      return { position: { q, r }, remainingMp };
    })
    .map((candidate) => {
      const hypothetical = units.map((unit) => unit.id === mover.id
        ? { ...unit, position: candidate.position }
        : unit);
      return {
        ...candidate,
        enemyDirections: resolveHexSurround(hypothetical, mover.id).enemyDirections,
      };
    })
    .filter((candidate) => candidate.enemyDirections.length < 2)
    .sort((a, b) => a.enemyDirections.length - b.enemyDirections.length
      || b.remainingMp - a.remainingMp
      || a.position.r - b.position.r
      || a.position.q - b.position.q);

  return candidates[0]?.position ?? null;
}

function proficiencyRank(value: UnitProficiency | undefined): number {
  switch (value) {
    case UnitProficiency.S: return 5;
    case UnitProficiency.A: return 3;
    case UnitProficiency.B: return 2;
    case UnitProficiency.C: return 1;
    default: return 0;
  }
}

/** 与玩家 castAbility 相同：功绩 Lv14 的全兵种适性+1 也作用于敌军 AI。 */
function effectiveProficiency(officer: Officer, unitType: UnitType): UnitProficiency {
  const raw = officer.unitProficiency[unitType] ?? UnitProficiency.NONE;
  const level = meritLevelFor(officer.merit ?? 0);
  if (meritEffects(level, officer.meritPath ?? 'neutral').proficiencyBoost <= 0) return raw;
  switch (raw) {
    case UnitProficiency.NONE: return UnitProficiency.C;
    case UnitProficiency.C: return UnitProficiency.B;
    case UnitProficiency.B: return UnitProficiency.A;
    case UnitProficiency.A: return UnitProficiency.S;
    default: return UnitProficiency.S;
  }
}

function availableEnemyAbility(
  unit: BattleUnit,
  target: BattleUnit,
  template: UnitTemplate,
  officer: Officer,
  weather: Weather,
): { ability: CombatAbilityDef; level: CombatAbilityLevel } | null {
  if (weather === Weather.FOG && template.range > 1) return null;
  const effective = effectiveProficiency(officer, unit.unitType);
  const maxLevel = proficiencyRank(effective);
  // 与玩家 castAbility 的适性门禁保持一致：NONE 不得使用 proficiency 战法。
  if (maxLevel === 0) return null;
  const energy = unit.energy ?? 0;
  const distance = hexDistance(unit.position, target.position);
  const abilityUses = getUnitAbilityUses(officer, unit.unitType);
  const candidates = (template.abilities ?? [])
    .map((ability) => {
      const level = ability.leveling === 'leveled'
        ? (ability.perLevel ?? []).filter((entry) => entry.level <= maxLevel && entry.energyCost <= energy).at(-1)
        : {
          level: 1,
          energyCost: ability.energyCost ?? 0,
          power: resolveProficiencyPower(
            ability.basePower ?? 1,
            ability.maxPower ?? ability.basePower ?? 1,
            abilityUses,
          ),
          hitRateBonus: ability.hitRateBonus ?? 0,
          requiredProficiency: effective,
        };
      return level && level.energyCost <= energy && distance >= Math.max(1, ability.minRange) && distance <= ability.maxRange
        ? { ability, level }
        : null;
    })
    .filter((candidate): candidate is { ability: CombatAbilityDef; level: CombatAbilityLevel } => candidate !== null);
  return candidates.sort((a, b) => (b.level.power - a.level.power) || a.ability.id.localeCompare(b.ability.id))[0] ?? null;
}

function tryAbilityTactic(
  units: BattleUnit[],
  attacker: BattleUnit,
  defender: BattleUnit,
  terrainMap: TerrainType[][],
  unitTemplates: Record<string, UnitTemplate>,
  officerStats: Record<number, EnemyOfficerStats>,
  officers: Record<number, Officer> | undefined,
  strongAgainst: Record<string, UnitType[]>,
  rng: CritRng,
  weather: Weather,
  isSiege = false,
): { units: BattleUnit[]; message: string; over: boolean; winner: 'attacker' | 'defender' | null } | null {
  const atkOfficer = officers?.[attacker.commanderId];
  const defOfficer = officers?.[defender.commanderId];
  const template = unitTemplates[attacker.unitType];
  const defTemplate = unitTemplates[defender.unitType];
  const atkStats = officerStats[attacker.commanderId];
  const defStats = officerStats[defender.commanderId];
  if (!atkOfficer || !defOfficer || !template || !defTemplate || !atkStats || !defStats) return null;

  const chosen = availableEnemyAbility(attacker, defender, template, atkOfficer, weather);
  if (!chosen) return null;
  const { ability, level } = chosen;
  if (ability.leveling === 'proficiency') {
    recordUnitAbilityUse(atkOfficer, attacker.unitType);
  }
  const matchup = getUnitMatchup(attacker.unitType, defender.unitType, strongAgainst);
  const hitRate = Math.min(100, Math.max(15, 80 + level.hitRateBonus));
  const spent = units.map((unit) => unit.id === attacker.id
    ? { ...unit, energy: (unit.energy ?? 0) - level.energyCost, hasActed: true, mp: 0 }
    : unit);
  if (rng() * 100 >= hitRate) {
    return { units: spent, message: `${atkOfficer.name} ${ability.name} 失手（${hitRate}%）`, over: false, winner: null };
  }

  // 与玩家 castAbility 保持相同 RNG 顺序：先命中判定，命中后才计算伤害。
  const base = calcDamage(
    {
      unitAttack: template.attack, unitDefense: template.defense, officerWar: atkStats.war,
      officerLeadership: atkStats.leadership, troops: attacker.troopCount, maxTroops: attacker.maxTroops,
      morale: attacker.morale, terrain: terrainMap[attacker.position.r]?.[attacker.position.q] ?? 'plain', matchup,
      weather,
      formationAtk: hexFormationMods(attacker.formation).atk,
    },
    {
      unitAttack: defTemplate.attack, unitDefense: defTemplate.defense, officerWar: defStats.war,
      officerLeadership: defStats.leadership, troops: defender.troopCount, maxTroops: defender.maxTroops,
      morale: defender.morale, terrain: terrainMap[defender.position.r]?.[defender.position.q] ?? 'plain',
      weather,
      armorDefense: defStats.armorDefense,
      formationDef: hexFormationMods(defender.formation).def + siegeDefBonus(isSiege, defender.side),
    },
    rng,
  );
  const damage = Math.max(1, Math.round(base * level.power * (0.9 + rng() * 0.2)));
  const affected = spent.filter((unit) => unit.side === defender.side && isActiveBattleUnit(unit) &&
    (unit.id === defender.id || (ability.specialEffect === 'aoe' && hexDistance(unit.position, defender.position) <= 1)));
  const next = spent.map((unit) => {
    if (!affected.some((victim) => victim.id === unit.id)) return unit;
    const unitDamage = unit.id === defender.id ? damage : Math.max(1, Math.round(damage * 0.5));
    const effects = unit.statusEffects.slice();
    applySpecialEffect(ability, effects, level.level);
    const troops = Math.max(0, unit.troopCount - unitDamage);
    const moraleLoss = ability.specialEffect === 'morale' ? Math.floor(unitDamage * 0.1) : 3;
    return { ...unit, troopCount: troops, isDestroyed: troops <= 0, morale: Math.max(0, unit.morale - moraleLoss), statusEffects: effects };
  });
  const attackerAlive = sideAlive(next, attacker.side);
  const defenderAlive = sideAlive(next, defender.side);
  const effect = ability.specialEffect === 'none' ? '' : `（${ability.specialEffect}）`;
  return {
    units: next,
    message: `${atkOfficer.name} ${ability.name} 造成 ${damage} 伤害${effect}${affected.length > 1 ? `，波及${affected.length - 1}队` : ''}`,
    over: !attackerAlive || !defenderAlive,
    winner: !attackerAlive ? defender.side : !defenderAlive ? attacker.side : null,
  };
}

function selectTarget(
  unit: BattleUnit,
  units: BattleUnit[],
  side: 'attacker' | 'defender',
  unitTemplates: Record<string, UnitTemplate>,
  strongAgainst: Record<string, UnitType[]>,
): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestScore = Infinity;
  for (const p of units.filter((u) => u.side === side && isActiveBattleUnit(u))) {
    const d = hexDistance(unit.position, p.position);
    const matchup = getUnitMatchup(unit.unitType, p.unitType, strongAgainst);
    const hpRatio = p.troopCount / Math.max(1, p.maxTroops);
    const threat = unitTemplates[p.unitType]?.attack ?? 0;
    // Reachable, vulnerable and dangerous targets are preferred; id is the stable tie-breaker.
    const score = d * 100 + hpRatio * 35 - matchup * 25 - threat;
    if (score < bestScore || (score === bestScore && p.id < (best?.id ?? '\uffff'))) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** 截击成立时，只在相邻活跃敌对部队中选目标，再回到普通评分作为稳定排序。 */
function selectInterceptionTarget(
  unit: BattleUnit,
  units: BattleUnit[],
  side: 'attacker' | 'defender',
  unitTemplates: Record<string, UnitTemplate>,
  strongAgainst: Record<string, UnitType[]>,
): BattleUnit | null {
  const adjacent = units.filter((candidate) =>
    candidate.side === side
      && isActiveBattleUnit(candidate)
      && hexDistance(unit.position, candidate.position) === 1,
  );
  return selectTarget(unit, adjacent, side, unitTemplates, strongAgainst);
}

function movementScore(
  position: HexCoord,
  target: BattleUnit,
  mover: BattleUnit,
  terrainMap: TerrainType[][],
): number {
  const distance = hexDistance(position, target.position);
  const terrain = terrainMap[position.r]?.[position.q] ?? ('plain' as TerrainType);
  let terrainScore = 0;
  if (terrain === 'forest') terrainScore -= 12;
  if (terrain === 'mountain') terrainScore -= 18;
  const naval = mover.unitType === 'lightNavy' || mover.unitType === 'mediumNavy' || mover.unitType === 'heavyNavy';
  if (terrain === 'water' && !naval) terrainScore += 40;
  return distance * 100 + terrainScore + position.r * 0.001 + position.q * 0.00001;
}

function tryFireTactic(
  units: BattleUnit[],
  attacker: BattleUnit,
  defender: BattleUnit,
  terrainMap: TerrainType[][],
  officers: Record<number, Officer> | undefined,
  weather: Weather,
  rng: CritRng,
): { units: BattleUnit[]; message: string; over: boolean; winner: 'attacker' | 'defender' | null } | null {
  const atk = officers?.[attacker.commanderId];
  const def = officers?.[defender.commanderId];
  const level = atk?.skills.find((skill) => skill.skillId === 'fire')?.level ?? 0;
  const energy = attacker.energy ?? 100;
  const range = level >= 5 ? 3 : level >= 3 ? 2 : 1;
  if (!atk || !def || level <= 0 || energy < 30 || weather === Weather.SNOW) return null;
  if (hexDistance(attacker.position, defender.position) > range) return null;

  const terrain = terrainMap[defender.position.r]?.[defender.position.q] ?? ('plain' as TerrainType);
  const successRate = Math.min(95, Math.max(15, 30 + (atk.stats.intelligence - def.stats.intelligence) * 2 + level * 8));
  const weatherMod = weather === Weather.RAIN || weather === Weather.STORM ? 0.5 : 1;
  const terrainMod = terrain === 'forest' ? 1.25 : terrain === 'water' ? 0.65 : 1;
  const expectedDamage = atk.stats.intelligence * ([0.8, 1, 1.3, 1.6, 2, 2.5][level] ?? 0.8) * 6
    * weatherMod * terrainMod * successRate / 100;
  // Do not waste fire on low-value odds; ordinary attacks remain the fallback.
  if (successRate < 45 || expectedDamage < 120) return null;

  const spent = units.map((unit) => unit.id === attacker.id
    ? { ...unit, energy: energy - 30, hasActed: true, mp: 0 }
    : unit);
  if (rng() * 100 >= successRate) {
    return { units: spent, message: `${atk.name} 施火计失手（${successRate}%）`, over: false, winner: null };
  }
  const damage = Math.max(1, Math.round(expectedDamage / (successRate / 100) * (0.9 + rng() * 0.2)));
  const troops = Math.max(0, defender.troopCount - damage);
  const burnTurns = level >= 4 ? 2 : 1;
  const next = spent.map((unit) => unit.id !== defender.id ? unit : {
    ...unit,
    troopCount: troops,
    isDestroyed: troops <= 0,
    morale: Math.max(0, unit.morale - 5),
    statusEffects: troops > 0
      ? [...unit.statusEffects, { type: 'burn', remainingTurns: burnTurns, value: Math.max(1, Math.floor(damage * 0.15)) }]
      : unit.statusEffects,
  });
  const enemyAlive = sideAlive(next, attacker.side);
  const playerAlive = sideAlive(next, defender.side);
  return {
    units: next,
    message: `${atk.name} 施火计，造成 ${damage} 伤害${terrain === 'forest' ? '（林中火势）' : weatherMod < 1 ? '（雨势减半）' : ''}`,
    over: !enemyAlive || !playerAlive,
    winner: !enemyAlive ? defender.side : playerAlive ? null : attacker.side,
  };
}

function doAttack(
  units: BattleUnit[],
  attacker: BattleUnit,
  defender: BattleUnit,
  terrainMap: TerrainType[][],
  unitTemplates: Record<string, UnitTemplate>,
  officerStats: Record<number, EnemyOfficerStats>,
  rng: CritRng,
  strongAgainst: Record<string, UnitType[]> = {},
  officers?: Record<number, Officer>,
  battleTurn?: number,
  weather: Weather = Weather.CLEAR,
  isSiege = false,
): {
  units: BattleUnit[];
  message: string;
  over: boolean;
  winner: 'attacker' | 'defender' | null;
} {
  const atkT = unitTemplates[attacker.unitType];
  const defT = unitTemplates[defender.unitType];
  const atkO = officerStats[attacker.commanderId];
  const defO = officerStats[defender.commanderId];
  if (!atkT || !defT || !atkO || !defO) {
    return { units, message: '攻击失败', over: false, winner: null };
  }

  const matchup = getUnitMatchup(attacker.unitType, defender.unitType, strongAgainst);
  const atkTerrain = terrainMap[attacker.position.r]?.[attacker.position.q] ?? ('plain' as TerrainType);
  const defTerrain = terrainMap[defender.position.r]?.[defender.position.q] ?? ('plain' as TerrainType);
  const dmg = calcDamage(
    {
      unitAttack: atkT.attack,
      unitDefense: atkT.defense,
      officerWar: atkO.war,
      officerLeadership: atkO.leadership,
      troops: attacker.troopCount,
      maxTroops: attacker.maxTroops,
      morale: attacker.morale,
      terrain: atkTerrain,
      weather,
      matchup,
      formationAtk: hexFormationMods(attacker.formation).atk,
    },
    {
      unitAttack: defT.attack,
      unitDefense: defT.defense,
      officerWar: defO.war,
      officerLeadership: defO.leadership,
      troops: defender.troopCount,
      maxTroops: defender.maxTroops,
      morale: defender.morale,
      terrain: defTerrain,
      weather,
      armorDefense: defO.armorDefense,
      formationDef: hexFormationMods(defender.formation).def + siegeDefBonus(isSiege, defender.side),
    },
    rng,
  );

  // §6.5 暴击/反击/连击 (若有完整 officers)
  const fullAtkO = officers?.[attacker.commanderId];
  const fullDefO = officers?.[defender.commanderId];
  let totalDamage = dmg;
  let counterDamage = 0;
  let labels: string[] = [];
  let details: string[] = [];
  let attackerTroopsAfter = attacker.troopCount;
  let attackerDestroyed = false;

  if (fullAtkO && fullDefO) {
    const atkActor: AttackActor = {
      unit: attacker, officer: fullAtkO, template: atkT,
      proficiency: fullAtkO.unitProficiency[attacker.unitType],
    };
    const defActor: AttackActor = {
      unit: defender, officer: fullDefO, template: defT,
      proficiency: fullDefO.unitProficiency[defender.unitType],
    };
    const result = resolveCritAttack({
      attacker: atkActor, defender: defActor, baseDamage: dmg, matchup,
      attackerTerrain: atkTerrain, defenderTerrain: defTerrain,
      distance: hexDistance(attacker.position, defender.position),
      isFirstRound: battleTurn === 1, attackerMoved: hasMovedThisTurn(attacker.mp, attacker.maxMp, weather),
      attackerCritBonus: equipCritRateFor(fullAtkO),
      defenderCritBonus: equipCritRateFor(fullDefO),
      attackerSurrounded: isUnitSurrounded(units, attacker.id),
      defenderSurrounded: isUnitSurrounded(units, defender.id),
      rng,
    });
    totalDamage = result.damage + result.chainDamage;
    counterDamage = result.counterDamage;
    labels = result.labels;
    details = result.details;
    attackerTroopsAfter = result.attackerTroopsAfter;
    attackerDestroyed = result.attackerDestroyed;
  }

  const matchupLabel = matchup > 1 ? '（克制）' : matchup < 1 ? '（被克）' : '';
  const eventLabel = labels.length ? `〔${labels.join('·')}〕` : '';

  // 应用兵力: 守方扣 totalDamage, 攻方扣 counterDamage
  const newDefTroops = Math.max(0, defender.troopCount - totalDamage);
  const next = units.map((u) => {
    if (u.id === defender.id) {
      return { ...u, troopCount: newDefTroops, isDestroyed: newDefTroops <= 0, morale: Math.max(0, u.morale - 3) };
    }
    if (u.id === attacker.id) {
      return {
        ...u,
        troopCount: attackerTroopsAfter,
        isDestroyed: attackerDestroyed,
        hasActed: true,
        mp: 0,
        energy: Math.max(0, (u.energy ?? 100) - (totalDamage > dmg ? 5 : 0)),
      };
    }
    return u;
  });

  // 攻方被反击致死
  const enemyAlive = sideAlive(next, attacker.side);
  const playerAlive = sideAlive(next, defender.side);
  if (!enemyAlive || !playerAlive) {
    return {
      units: next,
      message: !enemyAlive
        ? `${atkO.name} 攻击 ${defO.name}，却被反击致死！${eventLabel}`
        : `${atkO.name} 击败 ${defO.name}${eventLabel}，敌军溃败`,
      over: true,
      winner: enemyAlive ? attacker.side : defender.side,
    };
  }

  const msg = `${atkO.name} 攻击 ${defO.name}，造成 ${totalDamage} 伤害${matchupLabel}${eventLabel}（剩余 ${newDefTroops}）${counterDamage ? ` · 反击-${counterDamage}` : ''}`;
  if (newDefTroops <= 0) {
    return {
      units: next,
      message: msg + ' — 目标溃败',
      over: false,
      winner: null,
    };
  }
  void details;
  return { units: next, message: msg, over: false, winner: null };
}
