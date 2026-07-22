// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  FormationType,
  OfficerStatus,
  TerrainType,
  UnitProficiency,
  Weather,
  type BattleState,
  type BattleUnit,
  type CombatAbilityDef,
  type CombatAbilityLevel,
  type DuelState,
  type GameState,
  type Officer,
  type UnitType,
} from '@leh/shared';
import { getUnitByType } from '../data/loader.js';
import { hexDistance, hexKey } from '../battle/hex.js';
import { reachable } from '../battle/pathfinding.js';
import { calcDamage, getUnitMatchup } from '../battle/damage.js';
import { runSimpleEnemyAi } from '../battle/simpleAi.js';
import {
  aiAcceptChallenge,
  canChallenge,
  createDuel,
  runDuelToCompletion,
  stepDuel,
} from '../battle/duel.js';
import {
  resolveAttack as resolveCritAttack,
  type AttackActor,
  type CritRng,
} from '../battle/crit.js';

const COLS = 20;
const ROWS = 15;

function buildStrongAgainstMap(): Record<string, UnitType[]> {
  const units = getUnitByType();
  const map: Record<string, UnitType[]> = {};
  for (const [type, tmpl] of Object.entries(units)) {
    map[type] = (tmpl.strongAgainst ?? []) as UnitType[];
  }
  return map;
}

function buildTerrain(): TerrainType[][] {
  const map: TerrainType[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: TerrainType[] = [];
    for (let q = 0; q < COLS; q++) {
      if (r >= 6 && r <= 8 && q >= 5 && q <= 14) row.push(TerrainType.WATER);
      else if ((q + r) % 7 === 0 || (q * 3 + r) % 11 === 0) row.push(TerrainType.FOREST);
      else row.push(TerrainType.PLAIN);
    }
    map.push(row);
  }
  return map;
}

export interface CreateBattleOpts {
  fromCityId?: number;
  attackTroops?: number;
  defendTroops?: number;
  attackMorale?: number;
  defendMorale?: number;
}

export function createBattle(
  state: GameState,
  cityId: number,
  opts: CreateBattleOpts = {},
): BattleState {
  const city = state.cities[cityId];
  if (!city) throw new Error('城市不存在');

  const playerFaction = state.playerFactionId;
  const defenderFaction = city.ruler ?? 1;
  const fromCityId = opts.fromCityId;

  // 优先用出发城主将，其次任意己方现役
  const playerOfficer =
    (fromCityId != null
      ? Object.values(state.officers).find(
          (o: Officer) =>
            o.faction === playerFaction &&
            o.status === OfficerStatus.ACTIVE &&
            o.location === fromCityId,
        )
      : undefined) ??
    Object.values(state.officers).find(
      (o: Officer) =>
        o.faction === playerFaction &&
        o.status === OfficerStatus.ACTIVE &&
        o.location === cityId,
    ) ??
    Object.values(state.officers).find(
      (o: Officer) => o.faction === playerFaction && o.status === OfficerStatus.ACTIVE,
    ) ??
    Object.values(state.officers).find((o: Officer) => o.faction === playerFaction);

  // 优先本城守将；无则用势力内非君主武将（避免无城守将时曹操全国飞守）
  const defenderRulerId = state.factions[defenderFaction]?.rulerId;
  const enemyOfficer =
    Object.values(state.officers).find(
      (o: Officer) =>
        o.faction === defenderFaction &&
        o.status === OfficerStatus.ACTIVE &&
        o.location === cityId &&
        o.id !== playerOfficer?.id,
    ) ??
    Object.values(state.officers).find(
      (o: Officer) =>
        o.faction === defenderFaction &&
        o.status === OfficerStatus.ACTIVE &&
        o.id !== defenderRulerId &&
        o.id !== playerOfficer?.id,
    ) ??
    Object.values(state.officers).find(
      (o: Officer) => o.faction === defenderFaction && o.id !== playerOfficer?.id,
    ) ??
    Object.values(state.officers).find((o: Officer) => o.faction !== playerFaction);

  if (!playerOfficer || !enemyOfficer) throw new Error('缺少参战武将');

  const pType = 'heavyCavalry' as UnitType;
  const eType = 'heavyInfantry' as UnitType;
  const unitMap = getUnitByType();
  const pUnit = unitMap[pType];
  const eUnit = unitMap[eType];

  const atkTroops = Math.max(1, opts.attackTroops ?? 5000);
  const defTroops = Math.max(1, opts.defendTroops ?? Math.max(500, city.troops || 4500));
  const atkMorale = opts.attackMorale ?? 90;
  const defMorale = opts.defendMorale ?? 80;

  const units: BattleUnit[] = [
    {
      id: 'atk-1',
      armyId: 'a1',
      commanderId: playerOfficer.id,
      factionId: playerFaction,
      side: 'attacker',
      unitType: pType,
      formation: FormationType.WEDGE,
      troopCount: atkTroops,
      maxTroops: atkTroops,
      morale: atkMorale,
      food: 1000,
      position: { q: 2, r: 3 },
      mp: pUnit.mobility,
      maxMp: pUnit.mobility,
      energy: 100,
      maxEnergy: 100,
      hasActed: false,
      isRetreated: false,
      isDestroyed: false,
      statusEffects: [],
    },
    {
      id: 'def-1',
      armyId: 'd1',
      commanderId: enemyOfficer.id,
      factionId: defenderFaction,
      side: 'defender',
      unitType: eType,
      formation: FormationType.SQUARE,
      troopCount: defTroops,
      maxTroops: defTroops,
      morale: defMorale,
      food: 1000,
      position: { q: 16, r: 11 },
      mp: eUnit.mobility,
      maxMp: eUnit.mobility,
      energy: 100,
      maxEnergy: 100,
      hasActed: false,
      isRetreated: false,
      isDestroyed: false,
      statusEffects: [],
    },
  ];

  const fromName =
    fromCityId != null ? state.cities[fromCityId]?.name ?? String(fromCityId) : null;
  const openMsg = fromName
    ? `${fromName} 军进攻 ${city.name}（攻 ${atkTroops} / 守 ${defTroops}）`
    : `于 ${city.name} 附近开战（攻 ${atkTroops} / 守 ${defTroops}）`;

  return {
    id: `battle-${cityId}-${Date.now()}`,
    turn: 1,
    weather: Weather.CLEAR,
    attackerFaction: playerFaction,
    defenderFaction,
    isSiege: true,
    cityId,
    fromCityId,
    settled: false,
    units,
    phase: 'player',
    winner: null,
    hexGrid: { width: COLS, height: ROWS, terrain: buildTerrain() },
    log: [{ turn: 1, message: openMsg }],
    message: '出征开战！移动/攻击，歼灭守军即可占城',
  };
}

export function getMoveRange(battle: BattleState, unitId: string): string[] {
  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || unit.hasActed || unit.side !== 'attacker') return [];
  const blocked = new Set(
    battle.units
      .filter((u) => u.id !== unitId && !u.isDestroyed && u.troopCount > 0)
      .map((u) => hexKey(u.position)),
  );
  const range = reachable(
    unit.position,
    unit.mp,
    COLS,
    ROWS,
    (h) => battle.hexGrid.terrain[h.r]?.[h.q] ?? TerrainType.PLAIN,
    blocked,
  );
  range.delete(hexKey(unit.position));
  return [...range.keys()];
}

export function moveUnit(battle: BattleState, unitId: string, q: number, r: number): BattleState {
  if (battle.phase !== 'player') throw new Error('非玩家回合');
  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || unit.side !== 'attacker' || unit.hasActed) throw new Error('无法移动该部队');

  const keys = getMoveRange(battle, unitId);
  if (!keys.includes(hexKey({ q, r }))) throw new Error('目标不在移动范围内');

  const units = battle.units.map((u) =>
    u.id === unitId ? { ...u, position: { q, r }, mp: 0 } : u,
  );
  return {
    ...battle,
    units,
    message: '已移动；可攻击或结束行动',
  };
}

export function attackUnit(
  battle: BattleState,
  attackerId: string,
  defenderId: string,
  state: GameState,
  rng: CritRng,
): BattleState {
  if (battle.phase !== 'player') throw new Error('非玩家回合');
  const attacker = battle.units.find((u) => u.id === attackerId);
  const defender = battle.units.find((u) => u.id === defenderId);
  if (!attacker || !defender) throw new Error('单位不存在');
  if (attacker.side !== 'attacker' || defender.side !== 'defender') throw new Error('非法攻击目标');

  const unitMap = getUnitByType();
  const atkT = unitMap[attacker.unitType];
  const defT = unitMap[defender.unitType];
  if (hexDistance(attacker.position, defender.position) > atkT.range) {
    throw new Error('超出攻击范围');
  }

  const atkO = state.officers[attacker.commanderId];
  const defO = state.officers[defender.commanderId];
  if (!atkO || !defO) throw new Error('缺少主将');

  const strongMap = buildStrongAgainstMap();
  const matchup = getUnitMatchup(attacker.unitType, defender.unitType, strongMap);
  const atkTerrain = battle.hexGrid.terrain[attacker.position.r][attacker.position.q];
  const defTerrain = battle.hexGrid.terrain[defender.position.r][defender.position.q];

  // §6.1 基础伤害
  const baseDamage = calcDamage(
    {
      unitAttack: atkT.attack,
      unitDefense: atkT.defense,
      officerWar: atkO.stats.war,
      officerLeadership: atkO.stats.leadership,
      troops: attacker.troopCount,
      maxTroops: attacker.maxTroops,
      morale: attacker.morale,
      terrain: atkTerrain,
      matchup,
    },
    {
      unitAttack: defT.attack,
      unitDefense: defT.defense,
      officerWar: defO.stats.war,
      officerLeadership: defO.stats.leadership,
      troops: defender.troopCount,
      maxTroops: defender.maxTroops,
      morale: defender.morale,
      terrain: defTerrain,
    },
    rng,
  );

  // §6.5 暴击/反击/连击事件流
  const atkActor: AttackActor = {
    unit: attacker, officer: atkO, template: atkT,
    proficiency: atkO.unitProficiency[attacker.unitType],
  };
  const defActor: AttackActor = {
    unit: defender, officer: defO, template: defT,
    proficiency: defO.unitProficiency[defender.unitType],
  };
  const result = resolveCritAttack({
    attacker: atkActor,
    defender: defActor,
    baseDamage,
    matchup,
    attackerTerrain: atkTerrain,
    defenderTerrain: defTerrain,
    distance: hexDistance(attacker.position, defender.position),
    isFirstRound: battle.turn === 1,
    attackerMoved: attacker.mp < attacker.maxMp,
    rng,
  });

  const totalDamage = result.damage + result.chainDamage;
  const matchupLabel = matchup > 1 ? '（克制）' : matchup < 1 ? '（被克）' : '';
  const eventLabel = result.labels.length ? `〔${result.labels.join('·')}〕` : '';

  // 应用兵力变化
  const units = battle.units.map((u) => {
    if (u.id === defender.id) {
      return { ...u, troopCount: result.defenderTroopsAfter, isDestroyed: result.defenderDestroyed, morale: Math.max(0, u.morale - 3) };
    }
    if (u.id === attacker.id) {
      return {
        ...u,
        troopCount: result.attackerTroopsAfter,
        isDestroyed: result.attackerDestroyed,
        hasActed: true,
        mp: 0,
        energy: Math.max(0, (u.energy ?? 100) - (result.chainDamage > 0 ? 5 : 0)),
      };
    }
    return u;
  });

  // 攻方被反击致死 → 守方胜
  if (result.attackerDestroyed && !result.defenderDestroyed) {
    return {
      ...battle,
      units,
      phase: 'over',
      winner: 'defender',
      message: `${atkO.name} 攻击 ${defO.name}，却被反击致死！${eventLabel}`,
      log: [...battle.log, { turn: battle.turn, message: `${atkO.name} 被 ${defO.name} 反击斩杀` }],
    };
  }

  if (result.defenderDestroyed) {
    return {
      ...battle,
      units,
      phase: 'over',
      winner: 'attacker',
      message: `${atkO.name} 造成 ${totalDamage} 伤害${matchupLabel}${eventLabel} — 敌军溃败！${result.counterDamage ? `（反击-${result.counterDamage}）` : ''}`,
      log: [...battle.log, { turn: battle.turn, message: `击败 ${defO.name}${eventLabel}` }],
    };
  }

  return {
    ...battle,
    units,
    phase: 'enemy',
    message: `${atkO.name} 造成 ${totalDamage} 伤害${matchupLabel}${eventLabel}（敌剩余 ${result.defenderTroopsAfter}）${result.counterDamage ? ` · 反击-${result.counterDamage}` : ''} — 敌军回合…`,
    log: [...battle.log, { turn: battle.turn, message: `${atkO.name} 攻 ${defO.name} ${totalDamage}${eventLabel}${result.details.length ? ' | ' + result.details.join(' ') : ''}` }],
  };
}

export function finishPlayerAction(battle: BattleState): BattleState {
  if (battle.phase !== 'player') return battle;
  const units = battle.units.map((u) =>
    u.side === 'attacker' ? { ...u, hasActed: true, mp: 0 } : u,
  );
  return {
    ...battle,
    units,
    phase: 'enemy',
    message: '敌军回合…',
  };
}

const FIRE_COST = 30;
const FIRE_MULT = [0.8, 1.0, 1.3, 1.6, 2.0, 2.5] as const;

function fireSkillLevel(state: GameState, officerId: number): number {
  const o = state.officers[officerId];
  if (!o) return 0;
  const sk = o.skills.find((s) => s.skillId === 'fire');
  return sk ? Math.min(5, Math.max(1, sk.level)) : 0;
}

function fireRange(level: number): number {
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

/** 火计（05§7 最小切片）：消耗气力，智力判定，对敌军一格起火伤害 */
export function castFireTactic(
  battle: BattleState,
  attackerId: string,
  targetId: string,
  state: GameState,
  rng: () => number,
): BattleState {
  if (battle.phase !== 'player') throw new Error('非玩家回合');
  if (battle.weather === Weather.SNOW) throw new Error('雪天不可用火计');

  const attacker = battle.units.find((u) => u.id === attackerId);
  const target = battle.units.find((u) => u.id === targetId);
  if (!attacker || !target) throw new Error('单位不存在');
  if (attacker.side !== 'attacker' || target.side !== 'defender') {
    throw new Error('火计只能对敌军施放');
  }
  if (attacker.hasActed) throw new Error('该部队已行动');
  if (attacker.isDestroyed || attacker.troopCount <= 0) throw new Error('部队已溃');
  if (target.isDestroyed || target.troopCount <= 0) throw new Error('目标已溃');

  const energy = attacker.energy ?? 100;
  if (energy < FIRE_COST) throw new Error(`气力不足（需${FIRE_COST}，当前${energy}）`);

  const level = fireSkillLevel(state, attacker.commanderId);
  const range = fireRange(level);
  if (hexDistance(attacker.position, target.position) > range) {
    throw new Error(`超出火计范围（${range}格）`);
  }

  const atkO = state.officers[attacker.commanderId];
  const defO = state.officers[target.commanderId];
  if (!atkO || !defO) throw new Error('缺少主将');

  const successRate = Math.min(
    95,
    Math.max(15, 30 + (atkO.stats.intelligence - defO.stats.intelligence) * 2 + level * 8),
  );
  const roll = rng() * 100;
  const spent = battle.units.map((u) =>
    u.id === attacker.id
      ? { ...u, energy: energy - FIRE_COST, hasActed: true, mp: 0 }
      : u,
  );

  if (roll >= successRate) {
    return {
      ...battle,
      units: spent,
      phase: 'enemy',
      message: `${atkO.name} 火计失败（成功率${successRate}%）— 敌军回合…`,
      log: [
        ...battle.log,
        { turn: battle.turn, message: `${atkO.name} 火计失手` },
      ],
    };
  }

  const mult = FIRE_MULT[level] ?? FIRE_MULT[0];
  let weatherMod = 1;
  if (battle.weather === Weather.RAIN || battle.weather === Weather.STORM) weatherMod = 0.5;

  const tTerrain =
    battle.hexGrid.terrain[target.position.r]?.[target.position.q] ?? TerrainType.PLAIN;
  let terrainMod = 1;
  if (tTerrain === TerrainType.FOREST) terrainMod = 1.25;
  if (tTerrain === TerrainType.WATER) terrainMod = 0.65;

  const base = atkO.stats.intelligence * mult * 6;
  const dmg = Math.max(
    1,
    Math.round(base * weatherMod * terrainMod * (0.9 + rng() * 0.2)),
  );
  const newTroops = Math.max(0, target.troopCount - dmg);
  const burnTurns = level >= 4 ? 2 : level >= 1 ? 1 : 0;

  const units = spent.map((u) => {
    if (u.id !== target.id) return u;
    const effects = [...u.statusEffects];
    if (burnTurns > 0 && newTroops > 0) {
      effects.push({ type: 'burn', remainingTurns: burnTurns, value: Math.max(1, Math.floor(dmg * 0.15)) });
    }
    return {
      ...u,
      troopCount: newTroops,
      isDestroyed: newTroops <= 0,
      statusEffects: effects,
      morale: Math.max(0, u.morale - 5),
    };
  });

  const terrainNote =
    tTerrain === TerrainType.FOREST ? '·林中火势' : tTerrain === TerrainType.WATER ? '·水上减弱' : '';
  const weatherNote = weatherMod < 1 ? '·雨势减半' : '';
  const skillNote = level > 0 ? `火计·${['', '初', '通', '精', '极', '神'][level]}` : '火计（无技能）';

  if (newTroops <= 0) {
    return {
      ...battle,
      units,
      phase: 'over',
      winner: 'attacker',
      message: `${atkO.name} ${skillNote} 造成 ${dmg} 伤害${terrainNote}${weatherNote} — 敌军溃败！`,
      log: [
        ...battle.log,
        { turn: battle.turn, message: `${skillNote}击破 ${defO.name}` },
      ],
    };
  }

  return {
    ...battle,
    units,
    phase: 'enemy',
    message: `${atkO.name} ${skillNote} 造成 ${dmg} 伤害${terrainNote}${weatherNote}（敌剩余 ${newTroops}）— 敌军回合…`,
    log: [
      ...battle.log,
      { turn: battle.turn, message: `${skillNote} 对 ${defO.name} 造成 ${dmg}` },
    ],
  };
}

// ====== S10 战法引擎（最小切片） ======

/** 适性 → 可用战法等级上限（S→5, A→3, B→2, C→1, NONE→0） */
function proficiencyToMaxLevel(prof: UnitProficiency | undefined): number {
  switch (prof) {
    case UnitProficiency.S:
      return 5;
    case UnitProficiency.A:
      return 3;
    case UnitProficiency.B:
      return 2;
    case UnitProficiency.C:
      return 1;
    default:
      return 0;
  }
}

/** 查找武将对该兵种的适性 */
function getOfficerProficiency(state: GameState, officerId: number, unitType: UnitType): UnitProficiency {
  const o = state.officers[officerId];
  if (!o) return UnitProficiency.NONE;
  return o.unitProficiency[unitType] ?? UnitProficiency.NONE;
}

/** 查找武将可施放的战法（适性等级 ≥ 战法层级门槛） */
export function getUsableAbilities(
  state: GameState,
  battle: BattleState,
  unitId: string,
): { ability: CombatAbilityDef; level: number; levelData: CombatAbilityLevel }[] {
  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || unit.isDestroyed || unit.troopCount <= 0) return [];
  const tmpl = getUnitByType()[unit.unitType];
  if (!tmpl) return [];
  const prof = getOfficerProficiency(state, unit.commanderId, unit.unitType);
  const maxLevel = proficiencyToMaxLevel(prof);
  if (maxLevel === 0) return [];

  const result: { ability: CombatAbilityDef; level: number; levelData: CombatAbilityLevel }[] = [];
  for (const ability of tmpl.abilities ?? []) {
    if (ability.leveling !== 'leveled') continue;
    const perLevel = ability.perLevel ?? [];
    for (const lvData of perLevel) {
      if (lvData.level <= maxLevel) {
        result.push({ ability, level: lvData.level, levelData: lvData });
      }
    }
  }
  return result;
}

/**
 * 施放兵种战法（S10 最小切片）
 * - 消耗气力（energyCost）
 * - 适性等级决定可用层级（S→5, A→3, B→2, C→1）
 * - 威力 = 基础伤害 × power 倍率
 * - 附带 specialEffect 状态效果（stun/knockback/fire/morale 等）
 * - 连携 coopAllowed 仅数据标记，引擎后置
 */
export function castAbility(
  battle: BattleState,
  attackerId: string,
  targetId: string,
  abilityId: string,
  state: GameState,
  rng: () => number,
): BattleState {
  if (battle.phase !== 'player') throw new Error('非玩家回合');

  const attacker = battle.units.find((u) => u.id === attackerId);
  const target = battle.units.find((u) => u.id === targetId);
  if (!attacker || !target) throw new Error('单位不存在');
  if (attacker.side !== 'attacker' || target.side !== 'defender') {
    throw new Error('战法只能对敌军施放');
  }
  if (attacker.hasActed) throw new Error('该部队已行动');
  if (attacker.isDestroyed || attacker.troopCount <= 0) throw new Error('部队已溃');
  if (target.isDestroyed || target.troopCount <= 0) throw new Error('目标已溃');

  // 查找战法定义
  const tmpl = getUnitByType()[attacker.unitType];
  if (!tmpl) throw new Error('兵种数据缺失');
  const ability = (tmpl.abilities ?? []).find((a) => a.id === abilityId);
  if (!ability) throw new Error('该兵种无此战法');
  if (ability.leveling !== 'leveled') throw new Error('proficiency 战法引擎后置');

  // 适性等级门槛
  const prof = getOfficerProficiency(state, attacker.commanderId, attacker.unitType);
  const maxLevel = proficiencyToMaxLevel(prof);
  if (maxLevel === 0) throw new Error('适性不足，无法施放战法');

  // 玩家选择层级 = 可用最高层（最小切片简化；后续可加 UI 选层）
  const usableLevels = (ability.perLevel ?? []).filter((lv) => lv.level <= maxLevel);
  if (usableLevels.length === 0) throw new Error('无可用战法层级');
  const levelData = usableLevels[usableLevels.length - 1];

  // 气力消耗
  const energy = attacker.energy ?? 100;
  if (energy < levelData.energyCost) {
    throw new Error(`气力不足（需${levelData.energyCost}，当前${energy}）`);
  }

  // 射程检查
  const dist = hexDistance(attacker.position, target.position);
  if (dist < ability.minRange || dist > ability.maxRange) {
    throw new Error(`超出战法射程（${ability.minRange}-${ability.maxRange}格，当前${dist}格）`);
  }

  const atkO = state.officers[attacker.commanderId];
  const defO = state.officers[target.commanderId];
  if (!atkO || !defO) throw new Error('缺少主将');

  // 命中率
  const baseHit = 80 + levelData.hitRateBonus;
  const hitRoll = rng() * 100;
  const isHit = hitRoll < baseHit;

  // 扣气力 + 标记已行动
  const spent = battle.units.map((u) =>
    u.id === attacker.id
      ? { ...u, energy: energy - levelData.energyCost, hasActed: true, mp: 0 }
      : u,
  );

  if (!isHit) {
    return {
      ...battle,
      units: spent,
      phase: 'enemy',
      message: `${atkO.name} ${ability.name} 未命中（命中率${baseHit}%）— 敌军回合…`,
      log: [...battle.log, { turn: battle.turn, message: `${atkO.name} ${ability.name} 失手` }],
    };
  }

  // 计算伤害：基础伤害（用 calcDamage 的结构）× power 倍率
  const atkT = tmpl;
  const defT = getUnitByType()[target.unitType];
  const strongMap = buildStrongAgainstMap();
  const matchup = getUnitMatchup(attacker.unitType, target.unitType, strongMap);
  const baseDmg = calcDamage(
    {
      unitAttack: atkT.attack,
      unitDefense: atkT.defense,
      officerWar: atkO.stats.war,
      officerLeadership: atkO.stats.leadership,
      troops: attacker.troopCount,
      maxTroops: attacker.maxTroops,
      morale: attacker.morale,
      terrain: battle.hexGrid.terrain[attacker.position.r][attacker.position.q],
      matchup,
    },
    {
      unitAttack: defT.attack,
      unitDefense: defT.defense,
      officerWar: defO.stats.war,
      officerLeadership: defO.stats.leadership,
      troops: target.troopCount,
      maxTroops: target.maxTroops,
      morale: target.morale,
      terrain: battle.hexGrid.terrain[target.position.r][target.position.q],
    },
    rng,
  );
  const dmg = Math.max(1, Math.round(baseDmg * levelData.power * (0.9 + rng() * 0.2)));
  const newTroops = Math.max(0, target.troopCount - dmg);

  // 特殊效果
  const effects = [...target.statusEffects];
  const effectLabel = applySpecialEffect(ability, effects, levelData.level);

  const units = spent.map((u) => {
    if (u.id !== target.id) return u;
    return {
      ...u,
      troopCount: newTroops,
      isDestroyed: newTroops <= 0,
      statusEffects: effects,
      morale: ability.specialEffect === 'morale' ? Math.max(0, u.morale - Math.floor(dmg * 0.1)) : Math.max(0, u.morale - 3),
    };
  });

  const levelLabel = ['', '初', '通', '精', '极', '神'][levelData.level] ?? '';
  const fullLabel = `${ability.name}·${levelLabel}`;

  if (newTroops <= 0) {
    return {
      ...battle,
      units,
      phase: 'over',
      winner: 'attacker',
      message: `${atkO.name} ${fullLabel} 造成 ${dmg} 伤害${effectLabel} — 敌军溃败！`,
      log: [...battle.log, { turn: battle.turn, message: `${fullLabel}击破 ${defO.name}` }],
    };
  }

  return {
    ...battle,
    units,
    phase: 'enemy',
    message: `${atkO.name} ${fullLabel} 造成 ${dmg} 伤害${effectLabel}（敌剩余 ${newTroops}）— 敌军回合…`,
    log: [...battle.log, { turn: battle.turn, message: `${fullLabel} 对 ${defO.name} 造成 ${dmg}${effectLabel}` }],
  };
}

/** 应用战法特殊效果到 statusEffects 数组，返回效果描述 */
function applySpecialEffect(
  ability: CombatAbilityDef,
  effects: BattleUnit['statusEffects'],
  level: number,
): string {
  switch (ability.specialEffect) {
    case 'stun':
      effects.push({ type: 'stun', remainingTurns: 1, value: level });
      return '（眩晕）';
    case 'knockback':
      effects.push({ type: 'knockback', remainingTurns: 1, value: level });
      return '（击退）';
    case 'fire':
      effects.push({ type: 'burn', remainingTurns: level >= 4 ? 2 : 1, value: Math.max(1, Math.floor(level * 5)) });
      return '（起火）';
    case 'confusion':
      effects.push({ type: 'confusion', remainingTurns: 1, value: level });
      return '（混乱）';
    case 'charge':
      effects.push({ type: 'charge', remainingTurns: 1, value: level });
      return '（冲锋）';
    case 'pierce':
      return '（贯穿）';
    case 'aoe':
      return '（范围）';
    case 'morale':
      return '（降士气）';
    default:
      return '';
  }
}

function tickBurnAndEnergy(
  units: BattleUnit[],
  state: GameState,
): { units: BattleUnit[]; burnNotes: string[] } {
  const burnNotes: string[] = [];
  const next = units.map((u) => {
    if (u.isDestroyed || u.troopCount <= 0) return u;
    let troops = u.troopCount;
    const effects: typeof u.statusEffects = [];
    for (const e of u.statusEffects) {
      if (e.type === 'burn' && (e.remainingTurns ?? 0) > 0) {
        const tick = e.value ?? 10;
        troops = Math.max(0, troops - tick);
        const left = (e.remainingTurns ?? 1) - 1;
        if (left > 0) effects.push({ ...e, remainingTurns: left });
        const name = state.officers[u.commanderId]?.name ?? u.id;
        burnNotes.push(`${name} 灼烧 -${tick}`);
      } else if ((e.remainingTurns ?? 0) > 0) {
        effects.push({ ...e, remainingTurns: (e.remainingTurns ?? 1) - 1 });
      }
    }
    return {
      ...u,
      troopCount: troops,
      isDestroyed: troops <= 0,
      statusEffects: effects,
    };
  });
  return { units: next, burnNotes };
}

export function runEnemyPhase(battle: BattleState, state: GameState, rng: CritRng): BattleState {
  if (battle.phase !== 'enemy') return battle;

  const burned = tickBurnAndEnergy(battle.units, state);
  if (burned.units.some((u) => u.side === 'defender' && (u.isDestroyed || u.troopCount <= 0))) {
    const atkAlive = burned.units.some(
      (u) => u.side === 'attacker' && !u.isDestroyed && u.troopCount > 0,
    );
    if (atkAlive) {
      return {
        ...battle,
        units: burned.units,
        phase: 'over',
        winner: 'attacker',
        message: `灼烧持续 — 敌军溃败！${burned.burnNotes.join('；')}`,
        log: [
          ...battle.log,
          { turn: battle.turn, message: burned.burnNotes.join('；') || '灼烧击破' },
        ],
      };
    }
  }

  const officerStats = Object.fromEntries(
    Object.values(state.officers).map((o: Officer) => [
      o.id,
      { war: o.stats.war, leadership: o.stats.leadership, name: o.name },
    ]),
  );

  const result = runSimpleEnemyAi(
    burned.units,
    battle.hexGrid.terrain,
    getUnitByType(),
    officerStats,
    COLS,
    ROWS,
    'defender',
    'attacker',
    rng,
    buildStrongAgainstMap(),
    state.officers,
    battle.turn,
  );

  if (result.over) {
    return {
      ...battle,
      units: result.units,
      phase: 'over',
      winner: result.winner,
      message: result.message,
      log: [...battle.log, { turn: battle.turn, message: result.message }],
    };
  }

  // 新回合：恢复气力 = 智/10
  const units = result.units.map((u) => {
    if (u.side === 'attacker' && !u.isDestroyed) {
      const int = state.officers[u.commanderId]?.stats.intelligence ?? 50;
      const recover = Math.max(1, Math.floor(int / 10));
      const maxE = u.maxEnergy ?? 100;
      const cur = u.energy ?? maxE;
      return {
        ...u,
        hasActed: false,
        mp: u.maxMp,
        energy: Math.min(maxE, cur + recover),
      };
    }
    return u;
  });

  const burnMsg = burned.burnNotes.length ? burned.burnNotes.join('；') + ' | ' : '';
  return {
    ...battle,
    units,
    turn: battle.turn + 1,
    phase: 'player',
    message: burnMsg + result.message + ' | 你的回合',
    log: [
      ...battle.log,
      ...(burned.burnNotes.length
        ? [{ turn: battle.turn, message: burned.burnNotes.join('；') }]
        : []),
      { turn: battle.turn, message: result.message },
    ],
  };
}

// ====== 单挑 S10 §8 引擎接入 ======

const DUEL_CHALLENGE_COST = 20;

/** 玩家发起单挑: challengerId/targetId 为 BattleUnit.id (取其 commanderId 作为武将). */
export function challengeDuel(
  battle: BattleState,
  challengerUnitId: string,
  targetUnitId: string,
  state: GameState,
): { battle: BattleState; accepted: boolean } {
  if (battle.phase !== 'player') throw new Error('非玩家回合');
  if (battle.duel) throw new Error('已有进行中的单挑');

  const atkUnit = battle.units.find((u) => u.id === challengerUnitId);
  const defUnit = battle.units.find((u) => u.id === targetUnitId);
  if (!atkUnit || !defUnit) throw new Error('单位不存在');
  if (atkUnit.side !== 'attacker' || defUnit.side !== 'defender') throw new Error('只能向敌将发起单挑');
  if (atkUnit.isDestroyed || defUnit.isDestroyed) throw new Error('部队已溃');

  const challenger = state.officers[atkUnit.commanderId];
  const defender = state.officers[defUnit.commanderId];
  if (!challenger || !defender) throw new Error('缺少主将');

  // 相邻判定
  if (hexDistance(atkUnit.position, defUnit.position) > 1) {
    throw new Error('单挑需与敌将相邻');
  }

  // 气力
  const energy = atkUnit.energy ?? 100;
  const check = canChallenge(challenger, defender, energy);
  if (!check.ok) throw new Error(check.reason ?? '不可发起单挑');

  // AI 决策是否接受
  const defStaminaRatio = (defender.stamina || 100) / 100;
  const accepted = aiAcceptChallenge(challenger, defender, defStaminaRatio);

  if (!accepted) {
    // 拒绝: 士气 -15, 声望 -5 (简化为士气), 不消耗气力
    const units = battle.units.map((u) =>
      u.id === defUnit.id ? { ...u, morale: Math.max(0, u.morale - 15) } : u,
    );
    return {
      battle: {
        ...battle,
        units,
        message: `${defender.name} 拒绝了 ${challenger.name} 的单挑挑战！（士气-15）`,
        log: [...battle.log, { turn: battle.turn, message: `${defender.name} 拒单挑` }],
      },
      accepted: false,
    };
  }

  // 接受: 扣发起方气力, 创建单挑
  const spentUnits = battle.units.map((u) =>
    u.id === atkUnit.id ? { ...u, energy: energy - DUEL_CHALLENGE_COST } : u,
  );
  const duel = createDuel(battle.id, challenger, defender);
  return {
    battle: {
      ...battle,
      units: spentUnits,
      duel,
      message: `${challenger.name} 向 ${defender.name} 发起单挑！`,
      log: [...battle.log, { turn: battle.turn, message: `单挑: ${challenger.name} vs ${defender.name}` }],
    },
    accepted: true,
  };
}

/** 推进单挑一回合 (观看演出模式). */
export function stepBattleDuel(
  battle: BattleState,
  state: GameState,
): BattleState {
  if (!battle.duel || battle.duel.phase !== 'dueling') return battle;
  const challenger = state.officers[battle.duel.challengerId];
  const defender = state.officers[battle.duel.defenderId];
  if (!challenger || !defender) return battle;
  const duel = stepDuel(battle.duel, challenger, defender);
  return applyDuelPhase(battle, duel, state);
}

/** 跳过单挑动画, 直接结算 (fast/skip). */
export function skipBattleDuel(
  battle: BattleState,
  state: GameState,
): BattleState {
  if (!battle.duel) return battle;
  if (battle.duel.phase === 'resolved') return applyDuelOutcome(battle, state);
  const challenger = state.officers[battle.duel.challengerId];
  const defender = state.officers[battle.duel.defenderId];
  if (!challenger || !defender) return battle;
  const duel = runDuelToCompletion(battle.duel, challenger, defender);
  return applyDuelPhase(battle, duel, state);
}

function applyDuelPhase(battle: BattleState, duel: DuelState, state: GameState): BattleState {
  if (duel.phase !== 'resolved') {
    return { ...battle, duel, message: duel.roundHistory[duel.roundHistory.length - 1]?.description ?? battle.message };
  }
  return applyDuelOutcome({ ...battle, duel }, state);
}

/** 单挑结算: 将结果应用到战场单位与武将. */
function applyDuelOutcome(battle: BattleState, state: GameState): BattleState {
  const duel = battle.duel;
  if (!duel || !duel.result) return battle;

  const result = duel.result;
  const loserUnit = battle.units.find((u) => u.commanderId === result.loserId);
  const winnerUnit = battle.units.find((u) => u.commanderId === result.winnerId);
  const loserOff = state.officers[result.loserId];
  const winnerOff = state.officers[result.winnerId];

  let units = battle.units;
  let message = result.epilogue;

  if (result.outcome === 'killed' && loserOff) {
    // 武将死亡 + 部队溃散
    loserOff.status = OfficerStatus.DEAD;
    loserOff.location = null;
    if (loserUnit) {
      units = units.map((u) =>
        u.id === loserUnit.id ? { ...u, troopCount: 0, isDestroyed: true, morale: 0 } : u,
      );
    }
    message = `${winnerOff?.name ?? '胜方'} 斩杀 ${loserOff.name}！敌军溃散！`;
  } else if (result.outcome === 'captured' || result.outcome === 'surrendered') {
    if (loserOff) {
      loserOff.status = OfficerStatus.PRISONER;
    }
    if (loserUnit) {
      units = units.map((u) =>
        u.id === loserUnit.id ? { ...u, troopCount: 0, isDestroyed: true, morale: 0 } : u,
      );
    }
    message = `${winnerOff?.name ?? '胜方'} 俘获 ${loserOff?.name ?? '败将'}！`;
  } else if (result.outcome === 'escaped') {
    if (loserUnit) {
      units = units.map((u) =>
        u.id === loserUnit.id ? { ...u, morale: Math.max(0, u.morale - 10) } : u,
      );
    }
  }

  // 胜方士气 + 功绩
  if (winnerUnit) {
    units = units.map((u) =>
      u.id === winnerUnit.id ? { ...u, morale: Math.min(120, u.morale + result.moraleChange.winner) } : u,
    );
  }
  if (winnerOff) {
    winnerOff.merit = (winnerOff.merit ?? 0) + result.meritReward;
  }

  // 观众效应: 敌军士气 -10/友军 +5 (简化: 对所有敌方单位)
  units = units.map((u) => {
    if (u.commanderId === result.winnerId) return u;
    if (u.commanderId === result.loserId) return u;
    // 同侧增, 异侧减
    const winnerSide = winnerUnit?.side;
    if (u.side === winnerSide) {
      return { ...u, morale: Math.min(120, u.morale + Math.max(0, result.audienceMoraleChange)) };
    }
    return { ...u, morale: Math.max(0, u.morale + Math.min(0, result.audienceMoraleChange)) };
  });

  // 检查战斗是否结束
  const atkAlive = units.some((u) => u.side === 'attacker' && !u.isDestroyed && u.troopCount > 0);
  const defAlive = units.some((u) => u.side === 'defender' && !u.isDestroyed && u.troopCount > 0);

  if (!atkAlive || !defAlive) {
    return {
      ...battle,
      units,
      duel: null,
      phase: 'over',
      winner: !defAlive ? 'attacker' : 'defender',
      message,
      log: [...battle.log, { turn: battle.turn, message: `单挑终结: ${result.epilogue}` }],
    };
  }

  return {
    ...battle,
    units,
    duel: null,
    phase: 'player',
    message: `单挑结束 — ${message} | 你的回合`,
    log: [...battle.log, { turn: battle.turn, message: `单挑: ${result.epilogue}` }],
  };
}
