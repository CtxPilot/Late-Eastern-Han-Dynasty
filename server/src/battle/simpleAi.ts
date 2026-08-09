// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { Weather, UnitProficiency, meritEffects, meritLevelFor, type BattleUnit, type CombatAbilityDef, type CombatAbilityLevel, type HexCoord, type Officer, type TerrainType, type UnitTemplate, type UnitType } from '@leh/shared';
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
  return units.some((unit) => unit.side === side && !unit.isDestroyed && unit.troopCount > 0);
}

function markEnemyWaiting(units: BattleUnit[], unitId: string): BattleUnit[] {
  return units.map((unit) => unit.id === unitId ? { ...unit, hasActed: true, mp: 0 } : unit);
}

/** S10 0-A tactical AI: deterministic scoring with attacks, fire tactics and terrain-aware movement. */
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
): { units: BattleUnit[]; message: string; over: boolean; winner: 'attacker' | 'defender' | null } {
  // 行动状态是回合契约的一部分：重入 AI（例如重复请求/恢复）不得让已行动单位再次执行。
  const liveEnemies = units.filter((u) => u.side === enemySide && !u.isDestroyed && u.troopCount > 0);
  const enemies = liveEnemies.filter((u) => !u.hasActed);
  const players = units.filter((u) => u.side === playerSide && !u.isDestroyed && u.troopCount > 0);

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
    if (!live || live.isDestroyed) continue;

    const target = selectTarget(live, next, playerSide, unitTemplates, strongAgainst);
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
    const dist = hexDistance(live.position, target.position);

    const ability = tryAbilityTactic(next, live, target, terrainMap, unitTemplates, officerStats, officers, strongAgainst, rng, weather);
    if (ability) {
      next = ability.units;
      messages.push(ability.message);
      if (ability.over) return { units: next, message: messages.join('；'), over: true, winner: ability.winner };
      continue;
    }

    const fire = tryFireTactic(next, live, target, terrainMap, officers, weather, rng);
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
      const r = doAttack(next, live, target, terrainMap, unitTemplates, officerStats, rng, strongAgainst, officers, battleTurn, weather);
      next = r.units;
      messages.push(r.message);
      if (r.over) return { units: next, message: messages.join('；'), over: true, winner: r.winner };
      continue;
    }

    const blocked = new Set(
      next
        .filter((u) => u.id !== live.id && !u.isDestroyed && u.troopCount > 0)
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

    let best: HexCoord | null = null;
    let bestScore = movementScore(live.position, target, live, terrainMap);
    for (const key of range.keys()) {
      const [q, r] = key.split(',').map(Number);
      const score = movementScore({ q, r }, target, live, terrainMap);
      if (score < bestScore) {
        bestScore = score;
        best = { q, r };
      }
    }

    if (best) {
      next = next.map((u) =>
        u.id === live.id ? { ...u, position: { q: best!.q, r: best!.r }, hasActed: true, mp: 0 } : u,
      );
      const name = officerStats[live.commanderId]?.name ?? '敌军';
      messages.push(`${name} 向我军移动`);
      const moved = next.find((u) => u.id === live.id)!;
      const movedTarget = selectTarget(moved, next, playerSide, unitTemplates, strongAgainst);
      if (movedTarget && hexDistance(moved.position, movedTarget.position) <= effectiveUnitRange(ut.range, weather) && !(weather === Weather.FOG && ut.range > 1)) {
        const still = next.find((u) => u.id === movedTarget.id && !u.isDestroyed);
        if (still) {
          const r = doAttack(next, moved, still, terrainMap, unitTemplates, officerStats, rng, strongAgainst, officers, battleTurn, weather);
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
  const candidates = (template.abilities ?? [])
    .map((ability) => {
      const level = ability.leveling === 'leveled'
        ? (ability.perLevel ?? []).filter((entry) => entry.level <= maxLevel && entry.energyCost <= energy).at(-1)
        : {
          level: maxLevel,
          energyCost: ability.energyCost ?? 0,
          power: (ability.basePower ?? 1) + ((ability.maxPower ?? ability.basePower ?? 1) - (ability.basePower ?? 1)) * ((maxLevel - 1) / 4),
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
      formationDef: hexFormationMods(defender.formation).def,
    },
    rng,
  );
  const damage = Math.max(1, Math.round(base * level.power * (0.9 + rng() * 0.2)));
  const affected = spent.filter((unit) => unit.side === defender.side && !unit.isDestroyed && unit.troopCount > 0 &&
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
  for (const p of units.filter((u) => u.side === side && !u.isDestroyed && u.troopCount > 0)) {
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
      formationDef: hexFormationMods(defender.formation).def,
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
