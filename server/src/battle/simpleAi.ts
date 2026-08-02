// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { Weather, type BattleUnit, type HexCoord, type Officer, type TerrainType, type UnitTemplate, type UnitType } from '@leh/shared';
import { hexDistance, hexKey } from './hex.js';
import { reachable } from './pathfinding.js';
import { calcDamage, getUnitMatchup } from './damage.js';
import { resolveAttack as resolveCritAttack, type AttackActor, type CritRng } from './crit.js';

/** S10 0-A tactical AI: deterministic scoring with attacks, fire tactics and terrain-aware movement. */
export function runSimpleEnemyAi(
  units: BattleUnit[],
  terrainMap: TerrainType[][],
  unitTemplates: Record<string, UnitTemplate>,
  officerStats: Record<number, { war: number; leadership: number; name: string }>,
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
  const enemies = units.filter((u) => u.side === enemySide && !u.isDestroyed && u.troopCount > 0);
  const players = units.filter((u) => u.side === playerSide && !u.isDestroyed && u.troopCount > 0);

  if (enemies.length === 0) {
    return { units, message: '敌军全灭', over: true, winner: playerSide };
  }
  if (players.length === 0) {
    return { units, message: '我军全灭', over: true, winner: enemySide };
  }

  let next = units.map((u) => ({ ...u }));
  const messages: string[] = [];

  for (const enemy of enemies) {
    const live = next.find((u) => u.id === enemy.id);
    if (!live || live.isDestroyed) continue;

    const target = selectTarget(live, next, playerSide, unitTemplates, strongAgainst);
    if (!target) continue;

    const ut = unitTemplates[live.unitType];
    if (!ut) continue;
    const dist = hexDistance(live.position, target.position);

    const fire = tryFireTactic(next, live, target, terrainMap, officers, weather, rng);
    if (fire) {
      next = fire.units;
      messages.push(fire.message);
      if (fire.over) return { units: next, message: messages.join('；'), over: true, winner: fire.winner };
      continue;
    }

    if (dist <= ut.range) {
      const r = doAttack(next, live, target, terrainMap, unitTemplates, officerStats, rng, strongAgainst, officers, battleTurn);
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
      live.maxMp,
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
        u.id === live.id ? { ...u, position: { q: best!.q, r: best!.r } } : u,
      );
      const name = officerStats[live.commanderId]?.name ?? '敌军';
      messages.push(`${name} 向我军移动`);
      const moved = next.find((u) => u.id === live.id)!;
      const movedTarget = selectTarget(moved, next, playerSide, unitTemplates, strongAgainst);
      if (movedTarget && hexDistance(moved.position, movedTarget.position) <= ut.range) {
        const still = next.find((u) => u.id === movedTarget.id && !u.isDestroyed);
        if (still) {
          const r = doAttack(next, moved, still, terrainMap, unitTemplates, officerStats, rng, strongAgainst, officers, battleTurn);
          next = r.units;
          messages.push(r.message);
          if (r.over) {
            return { units: next, message: messages.join('；'), over: true, winner: r.winner };
          }
        }
      }
    }
  }

  return {
    units: next,
    message: messages.join('；') || '敌军待机',
    over: false,
    winner: null,
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
  return {
    units: next,
    message: `${atk.name} 施火计，造成 ${damage} 伤害${terrain === 'forest' ? '（林中火势）' : weatherMod < 1 ? '（雨势减半）' : ''}`,
    over: troops <= 0,
    winner: troops <= 0 ? attacker.side : null,
  };
}

function doAttack(
  units: BattleUnit[],
  attacker: BattleUnit,
  defender: BattleUnit,
  terrainMap: TerrainType[][],
  unitTemplates: Record<string, UnitTemplate>,
  officerStats: Record<number, { war: number; leadership: number; name: string }>,
  rng: CritRng,
  strongAgainst: Record<string, UnitType[]> = {},
  officers?: Record<number, Officer>,
  battleTurn?: number,
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
      matchup,
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
      isFirstRound: battleTurn === 1, attackerMoved: attacker.mp < attacker.maxMp,
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
        energy: Math.max(0, (u.energy ?? 100) - (totalDamage > dmg ? 5 : 0)),
      };
    }
    return u;
  });

  // 攻方被反击致死
  if (attackerDestroyed && newDefTroops > 0) {
    return {
      units: next,
      message: `${atkO.name} 攻击 ${defO.name}，却被反击致死！${eventLabel}`,
      over: true,
      winner: defender.side,
    };
  }

  const msg = `${atkO.name} 攻击 ${defO.name}，造成 ${totalDamage} 伤害${matchupLabel}${eventLabel}（剩余 ${newDefTroops}）${counterDamage ? ` · 反击-${counterDamage}` : ''}`;
  if (newDefTroops <= 0) {
    return {
      units: next,
      message: msg + ' — 目标溃败',
      over: true,
      winner: attacker.side,
    };
  }
  void details;
  return { units: next, message: msg, over: false, winner: null };
}
