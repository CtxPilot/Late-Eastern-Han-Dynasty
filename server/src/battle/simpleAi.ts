// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { BattleUnit, HexCoord, Officer, TerrainType, UnitTemplate, UnitType } from '@leh/shared';
import { hexDistance, hexKey } from './hex.js';
import { reachable } from './pathfinding.js';
import { calcDamage, getUnitMatchup } from './damage.js';
import { resolveAttack as resolveCritAttack, type AttackActor, type CritRng } from './crit.js';

/**
 * Demo-proven hard-coded battle AI — used as P1-09 placeholder seed.
 * NOT Phase 5 formal AI decision engine.
 */
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

    const target = nearest(live, next, playerSide);
    if (!target) continue;

    const ut = unitTemplates[live.unitType];
    if (!ut) continue;
    const dist = hexDistance(live.position, target.position);

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
    let bestDist = dist;
    for (const key of range.keys()) {
      const [q, r] = key.split(',').map(Number);
      const d = hexDistance({ q, r }, target.position);
      if (d < bestDist) {
        bestDist = d;
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
      if (bestDist <= ut.range) {
        const still = next.find((u) => u.id === target.id && !u.isDestroyed);
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

function nearest(
  unit: BattleUnit,
  units: BattleUnit[],
  side: 'attacker' | 'defender',
): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestDist = Infinity;
  for (const p of units.filter((u) => u.side === side && !u.isDestroyed && u.troopCount > 0)) {
    const d = hexDistance(unit.position, p.position);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
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
