// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  FormationType,
  OfficerStatus,
  PolicyType,
  Season,
  aristocracyDefenderMoralePenalty,
  armsCombatMultiplier,
  defenderMilitia,
  factionHasActivePolicy,
  prepareDefenseHexMobility,
  syncMerit,
  TerrainType,
  UnitProficiency,
  UnitType,
  Weather,
  meritEffects,
  meritLevelFor,
  meritStatBonus,
  type BattleActionRecord,
  type BattleState,
  type BattleUnit,
  type CampaignArmy,
  type CampaignSquad,
  type CombatAbilityDef,
  type CombatAbilityLevel,
  type DuelState,
  type GameState,
  type Officer,
  findTacticalPath,
  type PathResult,
  type TacticalGrid,
  checkMeleeTarget,
  directionTo,
  getAvailableFormations,
  projectHexDeployment,
  resolveFormationDeployment,
  duelTriggerChance,
  tacticalTurnFromTimestamp,
  canUseWeatherActive,
  weatherActiveEnergyCost,
  isValidBattleWeather,
  WEATHER_ACTIVE_TIMER_RESET,
  getUnitAbilityUses,
  recordUnitAbilityUse,
  resolveProficiencyPower,
  isUnitSurrounded,
  isCurrentWukui,
  isCurrentPojun,
  isLvBuOfficerId,
  WUKUI_DUEL_OPPONENT_MORALE_DELTA,
  POJUN_DUEL_VS_LVBU_MORALE_DELTA,
} from '@leh/shared';
import { getStaticData, getUnitByType } from '../data/loader.js';
import { duelEquipBonusFor, equipArmorDefenseFor, equipBonusFor, equipCritRateFor } from './items.js';
import { hexDistance, hexKey } from '../battle/hex.js';
import { reachable } from '../battle/pathfinding.js';
import { calcDamage, getUnitMatchup } from '../battle/damage.js';
import { hexFormationMods } from '../battle/hex-formation.js';
import { effectiveMovement, effectiveUnitRange, hasMovedThisTurn } from '../battle/weather.js';
import { applySpecialEffect } from '../battle/special-effects.js';
import { runSimpleEnemyAi } from '../battle/simpleAi.js';
import {
  aiAcceptChallenge,
  canChallenge,
  createDuel,
  DEFAULT_DUEL_CONFIG,
  runDuelToCompletion,
  stepDuel,
} from '../battle/duel.js';
import {
  applyChargeToBaseDamage,
  resolveAttack as resolveCritAttack,
  resolveChargeBonus,
  type AttackActor,
  type CritRng,
} from '../battle/crit.js';

const COLS = 20;
const ROWS = 15;
const HEX_TACTICAL_POINTS = 5;
const HEX_TACTICAL_POINT_CAP = 10;

function sideAlive(units: readonly BattleUnit[], side: 'attacker' | 'defender'): boolean {
  return units.some((unit) => unit.side === side && isActiveBattleUnit(unit));
}

/** 撤退单位可留在快照供战后结算，但不再参与六角战的活跃逻辑。 */
function isActiveBattleUnit(unit: BattleUnit): boolean {
  return !unit.isDestroyed && !unit.isRetreated && unit.troopCount > 0;
}

/** 08 §二十八：守城防御加成（isSiege 时守方 formationDef +3）。 */
function siegeDefBonus(battle: BattleState, side: 'attacker' | 'defender'): number {
  return battle.isSiege && side === 'defender' ? 3 : 0;
}

function isEdgeForSiegeBreakout(unit: BattleUnit, battle: BattleState): boolean {
  return unit.position.q === 0
    || unit.position.q === battle.hexGrid.width - 1
    || unit.position.r === 0
    || unit.position.r === battle.hexGrid.height - 1;
}

/**
 * 玩家把控制权交给敌军时，开启一个新的敌军行动窗口。
 * 同一敌军阶段内仍由 hasActed 阻止重入；只有这条 player -> enemy 边界会恢复敌军行动资格。
 */
function enterEnemyPhase(battle: BattleState): BattleState {
  return {
    ...battle,
    phase: 'enemy',
    actionHistory: battle.actionHistory?.map((action) => action.reversible ? { ...action, reversible: false } : action),
    units: battle.units.map((unit) => unit.side === 'defender' && isActiveBattleUnit(unit)
      ? { ...unit, hasActed: false, mp: effectiveMovement(unit.maxMp, battle.weather) }
      : unit),
  };
}

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
  /** 可选战役编成；缺省时保留 0-A 单位演示入口。 */
  attackerArmy?: CampaignArmy;
  defenderArmy?: CampaignArmy;
}

const WEATHER_CHANGE_MIN = 3;
const WEATHER_CHANGE_MAX = 8;

/** 05 §3.2：按季节概率抽取下一天气，排除当前天气以保证“切换”语义。 */
function rollNextWeather(current: Weather, season: Season, rng: CritRng): Weather {
  const weights: Array<[Weather, number]> = season === Season.WINTER
    ? [[Weather.CLEAR, 55], [Weather.CLOUDY, 15], [Weather.FOG, 10], [Weather.SNOW, 20]]
    : season === Season.SUMMER
      ? [[Weather.CLEAR, 45], [Weather.CLOUDY, 15], [Weather.RAIN, 25], [Weather.STORM, 5], [Weather.FOG, 10]]
      : [[Weather.CLEAR, 60], [Weather.CLOUDY, 15], [Weather.RAIN, 15], [Weather.FOG, 10]];
  const candidates = weights.filter(([weather]) => weather !== current);
  const total = candidates.reduce((sum, [, weight]) => sum + weight, 0);
  let cursor = rng() * total;
  for (const [weather, weight] of candidates) {
    cursor -= weight;
    if (cursor < 0) return weather;
  }
  return candidates.at(-1)![0];
}

function tickBattleWeather(battle: BattleState, season: Season, rng: CritRng): { weather: Weather; timer?: number; changed: boolean } {
  if (battle.weatherChangeTimer == null) return { weather: battle.weather, changed: false };
  const remaining = battle.weatherChangeTimer - 1;
  if (remaining > 0) return { weather: battle.weather, timer: remaining, changed: false };
  return {
    weather: rollNextWeather(battle.weather, season, rng),
    timer: WEATHER_CHANGE_MIN + Math.floor(rng() * (WEATHER_CHANGE_MAX - WEATHER_CHANGE_MIN + 1)),
    changed: true,
  };
}

function allocateTroops(squads: readonly CampaignSquad[], total: number): number[] {
  const sourceTotal = squads.reduce((sum, squad) => sum + Math.max(0, Math.floor(squad.troops)), 0);
  if (sourceTotal <= 0) return squads.map(() => 0);
  let remaining = Math.max(squads.length, Math.floor(total));
  return squads.map((squad, index) => {
    if (index === squads.length - 1) return remaining;
    const share = Math.max(1, Math.floor((Math.max(0, squad.troops) / sourceTotal) * total));
    const value = Math.min(share, Math.max(0, remaining - (squads.length - index - 1)));
    remaining -= value;
    return value;
  });
}

function unitsFromArmy(
  state: GameState,
  army: CampaignArmy,
  side: 'attacker' | 'defender',
  totalTroops: number,
  moraleOverride: number | undefined,
  anchor: { q: number; r: number },
): BattleUnit[] {
  const formations = getStaticData().formations;
  const record = formations.find((formation) => formation.id === army.formation);
  if (!record) throw new Error(`阵型不存在: ${army.formation}`);
  const squads = army.squads.length > 0
    ? army.squads
    : [{ officerId: army.commanderId, role: 'main' as const, position: 'center' as const, unitType: army.unitType, troops: army.troops, morale: army.morale }];
  const positions = [...new Set(squads.map((squad) => squad.role === 'main' ? 'center' : squad.position))];
  const deployment = resolveFormationDeployment(record, positions);
  const projected = projectHexDeployment(deployment, positions, anchor, side, { width: COLS, height: ROWS });
  const troopAllocation = allocateTroops(squads, totalTroops);
  return squads.map((squad, index) => {
    const officer = state.officers[squad.officerId];
    const template = getUnitByType()[squad.unitType];
    if (!officer || !template) throw new Error(`编成单位缺少武将或兵种: ${squad.officerId}/${squad.unitType}`);
    const position = squad.role === 'main' ? 'center' : squad.position;
    const projection = projected[position] ?? { position: anchor, facing: side === 'attacker' ? 0 as const : 3 as const };
    const troops = troopAllocation[index];
    const mobility = prepareDefenseHexMobility(
      template.mobility,
      factionHasActivePolicy(state, army.factionId, PolicyType.PREPARE_DEFENSE),
    );
    return {
      id: `${side}-${army.id}-${squad.officerId}`,
      armyId: army.id,
      commanderId: officer.id,
      commanderName: officer.name,
      factionId: army.factionId,
      side,
      unitType: squad.unitType,
      formation: army.formation,
      troopCount: troops,
      maxTroops: troops,
      morale: Math.max(0, Math.min(100, moraleOverride ?? squad.morale)),
      food: Math.max(0, army.food),
      position: projection.position,
      facing: projection.facing,
      mp: mobility,
      maxMp: mobility,
      energy: 100,
      maxEnergy: 100,
      hasActed: false,
      isRetreated: false,
      isDestroyed: false,
      statusEffects: [],
    };
  });
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
  const attackerArmy = opts.attackerArmy;
  const defenderArmy = opts.defenderArmy;

  // 优先用出发城主将，其次任意己方现役
  const playerOfficer = attackerArmy
    ? state.officers[attackerArmy.commanderId]
    :
    (
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
    Object.values(state.officers).find((o: Officer) => o.faction === playerFaction)
    );

  // 优先本城守将；无则用势力内非君主武将（避免无城守将时曹操全国飞守）
  const defenderRulerId = state.factions[defenderFaction]?.rulerId;
  const enemyOfficer = defenderArmy
    ? state.officers[defenderArmy.commanderId]
    :
    (
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
    Object.values(state.officers).find((o: Officer) => o.faction !== playerFaction)
    );

  if (!playerOfficer || !enemyOfficer) throw new Error('缺少参战武将');

  const pType = 'heavyCavalry' as UnitType;
  const eType = 'heavyInfantry' as UnitType;
  const unitMap = getUnitByType();
  const pUnit = unitMap[pType];
  const eUnit = unitMap[eType];
  const atkMobility = prepareDefenseHexMobility(
    pUnit.mobility,
    factionHasActivePolicy(state, playerFaction, PolicyType.PREPARE_DEFENSE),
  );
  const defMobility = prepareDefenseHexMobility(
    eUnit.mobility,
    factionHasActivePolicy(state, defenderFaction, PolicyType.PREPARE_DEFENSE),
  );

  const atkTroops = Math.max(1, opts.attackTroops ?? attackerArmy?.troops ?? 5000);
  // S27 守方民兵：民心 ≥60 时 floor(人口 × 0.02 × 民心/100)（docs/08 §十七）
  const militia = defenderMilitia(city.population, city.stats.morale ?? 70);
  const defTroops = Math.max(1, (opts.defendTroops ?? defenderArmy?.troops ?? Math.max(500, city.troops || 4500)) + militia);
  let atkMorale = opts.attackMorale ?? 90;
  let defMorale = opts.defendMorale ?? 80;
  // S27 世家暗通：世家满意度 <30 → 守军士气 −15%（docs/08 §十七）
  defMorale = Math.max(0, defMorale * (1 - aristocracyDefenderMoralePenalty(city.cityFactions ?? [])));
  // S27 兵装战力修正（docs/08 §十七）
  atkMorale = Math.min(120, atkMorale * (1 + armsCombatMultiplier(state.factions[playerFaction]?.arms ?? 0, atkTroops)));
  defMorale = Math.min(120, defMorale * (1 + armsCombatMultiplier(state.factions[defenderFaction]?.arms ?? 0, defTroops)));

  const legacyUnits: BattleUnit[] = [
    {
      id: 'atk-1',
      armyId: 'a1',
      commanderId: playerOfficer.id,
      commanderName: playerOfficer.name,
      factionId: playerFaction,
      side: 'attacker',
      unitType: pType,
      formation: FormationType.WEDGE,
      troopCount: atkTroops,
      maxTroops: atkTroops,
      morale: atkMorale,
      food: 1000,
      position: { q: 2, r: 3 },
      facing: 0,
      mp: atkMobility,
      maxMp: atkMobility,
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
      commanderName: enemyOfficer.name,
      factionId: defenderFaction,
      side: 'defender',
      unitType: eType,
      formation: FormationType.SQUARE,
      troopCount: defTroops,
      maxTroops: defTroops,
      morale: defMorale,
      food: 1000,
      position: { q: 16, r: 11 },
      facing: 3,
      mp: defMobility,
      maxMp: defMobility,
      energy: 100,
      maxEnergy: 100,
      hasActed: false,
      isRetreated: false,
      isDestroyed: false,
      statusEffects: [],
    },
  ];
  const units: BattleUnit[] = attackerArmy || defenderArmy
    ? [
      ...(attackerArmy
        ? unitsFromArmy(state, attackerArmy, 'attacker', atkTroops, opts.attackMorale, { q: 2, r: 3 })
        : [legacyUnits[0]]),
      ...(defenderArmy
        ? unitsFromArmy(state, defenderArmy, 'defender', defTroops, opts.defendMorale, { q: 16, r: 11 })
        : [legacyUnits[1]]),
    ]
    : legacyUnits;

  const fromName =
    fromCityId != null ? state.cities[fromCityId]?.name ?? String(fromCityId) : null;
  const openMsg = fromName
    ? `${fromName} 军进攻 ${city.name}（攻 ${atkTroops} / 守 ${defTroops}）`
    : `于 ${city.name} 附近开战（攻 ${atkTroops} / 守 ${defTroops}）`;

  return {
    id: `battle-${cityId}-${Date.now()}`,
    turn: 1,
    weather: Weather.CLEAR,
    weatherChangeTimer: WEATHER_CHANGE_MIN,
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
    actionHistory: [],
    tacticalPoints: HEX_TACTICAL_POINTS + ((state.officers[playerOfficer.id]?.stats.intelligence ?? 50) >= 80 ? 1 : 0),
    tacticalPointsUsed: 0,
    message: '出征开战！移动/攻击，歼灭守军即可占城',
  };
}

/**
 * 六角战中变阵：只改变本次六角战的攻方 BattleUnit 快照，不调用白刃回合。
 * 规则：1 TP、每回合一次、主将未行动、变阵后主将行动结束；合法性由共享阵型解析器裁决。
 */
/** 单挑进行中战场暂停：禁止一切军阵动作，仅允许 duel step/skip。 */
function assertBattleNotPausedForDuel(battle: BattleState): void {
  if (battle.duel && battle.duel.phase !== 'resolved') {
    throw new Error('DUEL_BATTLE_PAUSED');
  }
}

/**
 * 同回合审计序号：取当前回合已有记录的 max(timestamp%1000)+1。
 * 不能用 history.length——slice(-3) 后长度封顶会导致 ID/时间戳重复。
 */
function nextBattleActionSeq(battle: BattleState): number {
  let maxSeq = 0;
  for (const action of battle.actionHistory ?? []) {
    if (tacticalTurnFromTimestamp(action.logicalTimestamp) !== battle.turn) continue;
    maxSeq = Math.max(maxSeq, action.logicalTimestamp % 1000);
  }
  return maxSeq + 1;
}

function appendBattleAction(
  battle: BattleState,
  idPrefix: 'move' | 'attack' | 'formation',
  record: Omit<BattleActionRecord, 'id' | 'logicalTimestamp'>,
): BattleActionRecord[] {
  const seq = nextBattleActionSeq(battle);
  return [...(battle.actionHistory ?? []), {
    ...record,
    id: `${idPrefix}-${battle.turn}-${seq}`,
    logicalTimestamp: battle.turn * 1000 + seq,
  }].slice(-3);
}

export function changeBattleFormation(
  battle: BattleState,
  unitId: string,
  targetFormation: FormationType,
  state: GameState,
): BattleState {
  if (battle.phase !== 'player') throw new Error('非玩家回合');
  assertBattleNotPausedForDuel(battle);
  const mainUnit = battle.units.find((unit) => unit.id === unitId && unit.side === 'attacker');
  if (!mainUnit || !isActiveBattleUnit(mainUnit)) throw new Error('变阵主将不存在或已溃');
  const army = state.campaignArmies.find((candidate) => candidate.id === mainUnit.armyId);
  const commanderId = army?.commanderId ?? mainUnit.commanderId;
  const commanderUnit = battle.units.find((unit) => unit.side === 'attacker' && unit.commanderId === commanderId) ?? mainUnit;
  if (!isActiveBattleUnit(commanderUnit)) throw new Error('变阵主将不存在或已溃');
  if (commanderUnit.hasActed) throw new Error('主将本回合已经行动，不能变阵');
  if ((battle.tacticalPoints ?? HEX_TACTICAL_POINTS) < 1) throw new Error('六角战术点不足');
  if ((battle.tacticalPointsUsed ?? 0) >= 1) throw new Error('本回合已经变阵');
  if (commanderUnit.formation === targetFormation) throw new Error('目标阵型与当前相同');

  const catalog = getStaticData().formations;
  const mastery = state.officers[commanderId]?.formationMastery ?? [];
  const checks = battle.units
    .filter((unit) => unit.side === 'attacker' && isActiveBattleUnit(unit))
    .map((unit) => getAvailableFormations({
        catalog,
        mastered: mastery,
        unitType: unit.unitType,
        terrain: battle.hexGrid.terrain[unit.position.r]?.[unit.position.q],
        isSurrounded: isUnitSurrounded(battle.units, unit.id),
      }).find((entry) => entry.formationId === targetFormation));
  if (!checks.length || checks.some((entry) => !entry?.available)) {
    const reason = checks.find((entry) => entry && !entry.available)?.blockReason ?? 'unknown';
    throw new Error(`不能变更为目标阵型（${reason}）`);
  }

  const units = battle.units.map((unit) => unit.side === 'attacker' && isActiveBattleUnit(unit)
    ? { ...unit, formation: targetFormation }
    : unit);
  const actionHistory = appendBattleAction(battle, 'formation', {
    kind: 'formation',
    unitId: commanderUnit.id,
    source: 'player',
    reversible: false,
    beforeFormation: commanderUnit.formation,
    afterFormation: targetFormation,
  });
  return {
    ...battle,
    units: units.map((unit) => unit.id === commanderUnit.id ? { ...unit, hasActed: true, mp: 0 } : unit),
    tacticalPoints: (battle.tacticalPoints ?? HEX_TACTICAL_POINTS) - 1,
    tacticalPointsUsed: (battle.tacticalPointsUsed ?? 0) + 1,
    actionHistory,
    message: `${commanderUnit.commanderName} 变阵为 ${catalog.find((formation) => formation.id === targetFormation)?.name ?? targetFormation}，主将行动结束（耗 1 TP）`,
    log: [...battle.log, {
      turn: battle.turn,
      message: `${commanderUnit.commanderName} 变阵`,
      explanation: {
        kind: 'formation' as const,
        tacticalPointsBefore: battle.tacticalPoints ?? HEX_TACTICAL_POINTS,
        tacticalPointsAfter: (battle.tacticalPoints ?? HEX_TACTICAL_POINTS) - 1,
        formationBefore: commanderUnit.formation,
        formationAfter: targetFormation,
      },
    }],
  };
}

export function getMoveRange(battle: BattleState, unitId: string): string[] {
  if (battle.duel && battle.duel.phase !== 'resolved') return [];
  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || !isActiveBattleUnit(unit) || unit.hasActed || unit.side !== 'attacker') return [];
  const blocked = new Set(
    battle.units
      .filter((u) => u.id !== unitId && isActiveBattleUnit(u))
      .map((u) => hexKey(u.position)),
  );
  const range = reachable(
    unit.position,
    unit.mp,
    battle.hexGrid.width,
    battle.hexGrid.height,
    (h) => battle.hexGrid.terrain[h.r]?.[h.q] ?? TerrainType.PLAIN,
    blocked,
  );
  range.delete(hexKey(unit.position));
  return [...range.keys()];
}

/**
 * 路径预览/服务端落子共用的 A* 计划。当前 0-A 兵种沿用既有“可涉水”规则，
 * 因此使用 amphibious；实体单位映射为 unit 障碍，不能穿越或落在占用格。
 */
export function getMovePath(battle: BattleState, unitId: string, q: number, r: number): PathResult {
  if (battle.duel && battle.duel.phase !== 'resolved') {
    return { found: false, path: [], totalCost: 0, visited: 0, reason: 'UNREACHABLE' };
  }
  const unit = battle.units.find((candidate) => candidate.id === unitId);
  if (!unit || !isActiveBattleUnit(unit) || unit.hasActed || unit.side !== 'attacker') return { found: false, path: [], totalCost: 0, visited: 0, reason: 'UNREACHABLE' };
  const occupied = new Set(battle.units.filter((candidate) => candidate.id !== unitId && isActiveBattleUnit(candidate)).map((candidate) => hexKey(candidate.position)));
  const grid: TacticalGrid = {
    width: battle.hexGrid.width,
    height: battle.hexGrid.height,
    cells: battle.hexGrid.terrain.map((row, rowIndex) => row.map((terrain, columnIndex) => ({
      terrain,
      obstacle: occupied.has(`${columnIndex},${rowIndex}`) ? 'unit' as const : undefined,
      elevation: terrain === TerrainType.MOUNTAIN ? 1 : 0,
    }))),
  };
  return findTacticalPath(grid, unit.position, { q, r }, unit.mp, { mobility: 'amphibious' });
}

export function moveUnit(battle: BattleState, unitId: string, q: number, r: number): BattleState {
  if (battle.phase !== 'player') throw new Error('非玩家回合');
  assertBattleNotPausedForDuel(battle);
  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || !isActiveBattleUnit(unit) || unit.side !== 'attacker' || unit.hasActed) throw new Error('无法移动该部队');

  const plan = getMovePath(battle, unitId, q, r);
  if (!plan.found) throw new Error(`目标不在移动范围内（${plan.reason ?? 'UNREACHABLE'}）`);

  const units = battle.units.map((u) =>
    u.id === unitId ? { ...u, position: { q, r }, facing: directionTo(u.position, { q, r }), mp: 0 } : u,
  );
  return {
    ...battle,
    units,
    message: `已移动 ${plan.path.length - 1} 格，消耗 ${plan.totalCost} 移动力，剩余 ${plan.path.at(-1)?.remaining ?? 0}；可攻击或结束行动`,
    log: [...battle.log, { turn: battle.turn, message: `${unit.commanderName} 行军 ${plan.path.length - 1} 格（耗${plan.totalCost}）` }],
    actionHistory: appendBattleAction(battle, 'move', {
      kind: 'move',
      unitId,
      source: 'player',
      reversible: true,
      beforePosition: unit.position,
      afterPosition: { q, r },
      beforeMp: unit.mp,
      beforeFacing: unit.facing ?? 0,
    }),
  };
}

/** 仅撤销尚未被攻击/技能/RNG 消费封闭的最后一次玩家移动。 */
export function undoLastBattleAction(battle: BattleState): BattleState {
  if (battle.phase !== 'player') throw new Error('UNDO_PHASE_LOCKED');
  assertBattleNotPausedForDuel(battle);
  const last = battle.actionHistory?.at(-1);
  if (!last) throw new Error('UNDO_EMPTY');
  if (tacticalTurnFromTimestamp(last.logicalTimestamp) !== battle.turn) throw new Error('UNDO_TURN_LOCKED');
  if (last.source !== 'player' || !last.reversible || last.kind !== 'move' || !last.beforePosition || !last.afterPosition || last.beforeMp == null) throw new Error(`UNDO_IRREVERSIBLE:${last.kind}`);
  const unit = battle.units.find((candidate) => candidate.id === last.unitId);
  const beforeInBounds = last.beforePosition.q >= 0 && last.beforePosition.q < battle.hexGrid.width
    && last.beforePosition.r >= 0 && last.beforePosition.r < battle.hexGrid.height;
  const beforeOccupied = battle.units.some((candidate) => candidate.id !== last.unitId
    && isActiveBattleUnit(candidate)
    && candidate.position.q === last.beforePosition!.q && candidate.position.r === last.beforePosition!.r);
  if (!unit || unit.side !== 'attacker' || !isActiveBattleUnit(unit)
    || unit.position.q !== last.afterPosition.q || unit.position.r !== last.afterPosition.r
    || !beforeInBounds || beforeOccupied || !Number.isFinite(last.beforeMp)
    || last.beforeMp < 0 || last.beforeMp > unit.maxMp) {
    throw new Error('UNDO_STATE_MISMATCH');
  }
  return {
    ...battle,
    units: battle.units.map((unit) => unit.id === last.unitId
      ? {
          ...unit,
          position: last.beforePosition!,
          mp: last.beforeMp!,
          ...(last.beforeFacing !== undefined ? { facing: last.beforeFacing } : {}),
        }
      : unit),
    actionHistory: battle.actionHistory!.slice(0, -1),
    message: '已撤销上一次移动',
    log: [...battle.log, { turn: battle.turn, message: `撤销移动 ${last.id}` }],
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
  assertBattleNotPausedForDuel(battle);
  const attacker = battle.units.find((u) => u.id === attackerId);
  const defender = battle.units.find((u) => u.id === defenderId);
  if (!attacker || !defender) throw new Error('单位不存在');
  if (attacker.side !== 'attacker' || defender.side !== 'defender') throw new Error('非法攻击目标');

  const unitMap = getUnitByType();
  const atkT = unitMap[attacker.unitType];
  const defT = unitMap[defender.unitType];
  if (!atkT || !defT) throw new Error('兵种数据缺失');
  if (attacker.hasActed) throw new Error('该部队已行动');
  if (!isActiveBattleUnit(attacker)) throw new Error('部队已溃');
  if (!isActiveBattleUnit(defender)) throw new Error('目标已溃');
  const weapon = attacker.unitType === UnitType.SPEARMAN ? 'spear' : attacker.unitType === UnitType.HEAVY_INFANTRY ? 'axe' : 'sword';
  const distance = hexDistance(attacker.position, defender.position);
  if (atkT.range > 1) {
    if (battle.weather === Weather.FOG) throw new Error('雾天远程兵种不可射击');
    const range = effectiveUnitRange(atkT.range, battle.weather);
    if (distance < 1 || distance > range) {
      throw new Error(`普通攻击射程为1-${range}格（当前${distance}格）`);
    }
  }
  const targetCheck = atkT.range > 1
    ? { inRange: true, arc: 'front' as const, attackModifier: 0, distance }
    : checkMeleeTarget(attacker.position, attacker.facing ?? 0, defender.position, weapon);
  if (!targetCheck.inRange) throw new Error(`不在白刃攻击范围或朝向之外（${weapon} ${targetCheck.distance}格/${targetCheck.arc}）`);

  const atkO = state.officers[attacker.commanderId];
  const defO = state.officers[defender.commanderId];
  if (!atkO || !defO) throw new Error('缺少主将');

  const strongMap = buildStrongAgainstMap();
  const matchup = getUnitMatchup(attacker.unitType, defender.unitType, strongMap);
  const atkTerrain = battle.hexGrid.terrain[attacker.position.r][attacker.position.q];
  const defTerrain = battle.hexGrid.terrain[defender.position.r][defender.position.q];

  // §6.1 基础伤害（功绩+装备属性加成计入有效武力/统帅，Session 265+266；08 §二十八守城 +3）
  const atkEquip = equipBonusFor(atkO);
  const defEquip = equipBonusFor(defO);
  // 移动后冲锋（08 §二十九）：骑兵本回合已移动的普攻按来源叠加伤害加成
  const attackerMoved = hasMovedThisTurn(attacker.mp, attacker.maxMp, battle.weather);
  const charge = attackerMoved
    ? resolveChargeBonus({ unitType: attacker.unitType, terrain: atkTerrain, formation: attacker.formation })
    : { bonusPct: 0 };
  const rawBaseDamage = calcDamage(
    {
      unitAttack: atkT.attack,
      unitDefense: atkT.defense,
      officerWar: atkO.stats.war + meritStatBonus(atkO, 'war') + (atkEquip.war ?? 0),
      officerLeadership: atkO.stats.leadership + meritStatBonus(atkO, 'leadership') + (atkEquip.leadership ?? 0),
      troops: attacker.troopCount,
      maxTroops: attacker.maxTroops,
      morale: attacker.morale,
      terrain: atkTerrain,
      weather: battle.weather,
      matchup,
      formationAtk: hexFormationMods(attacker.formation).atk,
    },
    {
      unitAttack: defT.attack,
      unitDefense: defT.defense,
      officerWar: defO.stats.war + meritStatBonus(defO, 'war') + (defEquip.war ?? 0),
      officerLeadership: defO.stats.leadership + meritStatBonus(defO, 'leadership') + (defEquip.leadership ?? 0),
      troops: defender.troopCount,
      maxTroops: defender.maxTroops,
      morale: defender.morale,
      terrain: defTerrain,
      weather: battle.weather,
      armorDefense: equipArmorDefenseFor(defO),
      formationDef: hexFormationMods(defender.formation).def + siegeDefBonus(battle, 'defender'),
    },
    rng,
  );
  const baseDamage = Math.max(1, Math.round(
    applyChargeToBaseDamage(rawBaseDamage, charge.bonusPct) * (1 + targetCheck.attackModifier),
  ));

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
    attackerMoved,
    chargePct: charge.bonusPct,
    attackerCritBonus: equipCritRateFor(atkO),
    defenderCritBonus: equipCritRateFor(defO),
    attackerSurrounded: isUnitSurrounded(battle.units, attacker.id),
    defenderSurrounded: isUnitSurrounded(battle.units, defender.id),
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
  const actionHistory = appendBattleAction(battle, 'attack', {
    kind: 'attack',
    unitId: attacker.id,
    source: 'player',
    reversible: false,
  });

  const attackerAlive = sideAlive(units, 'attacker');
  const defenderAlive = sideAlive(units, 'defender');

  // 攻方被反击致死 → 守方胜
  if (!attackerAlive || !defenderAlive) {
    return {
      ...battle,
      units,
      actionHistory,
      phase: 'over',
      winner: defenderAlive ? 'defender' : 'attacker',
      message: !attackerAlive
        ? `${atkO.name} 攻击 ${defO.name}，却被反击致死！${eventLabel}`
        : `${atkO.name} 造成 ${totalDamage} 伤害${matchupLabel}${eventLabel} — 敌军溃败！`,
      log: [...battle.log, { turn: battle.turn, message: !attackerAlive ? `${atkO.name} 被 ${defO.name} 反击斩杀` : `击败 ${defO.name}${eventLabel}`, explanation: { kind: 'attack' as const, attackerFormation: attacker.formation, defenderFormation: defender.formation, formationAttack: hexFormationMods(attacker.formation).atk, formationDefense: hexFormationMods(defender.formation).def } }],
    };
  }

  if (result.defenderDestroyed) {
    return enterEnemyPhase({
      ...battle,
      units,
      actionHistory,
      winner: null,
      message: `${atkO.name} 造成 ${totalDamage} 伤害${matchupLabel}${eventLabel} — 击败 ${defO.name}，敌军仍有部队${result.counterDamage ? `（反击-${result.counterDamage}）` : ''}`,
      log: [...battle.log, { turn: battle.turn, message: `击败 ${defO.name}${eventLabel}`, explanation: { kind: 'attack' as const, attackerFormation: attacker.formation, defenderFormation: defender.formation, formationAttack: hexFormationMods(attacker.formation).atk, formationDefense: hexFormationMods(defender.formation).def } }],
    });
  }

  return enterEnemyPhase({
    ...battle,
    units,
    actionHistory,
    message: `${atkO.name} 造成 ${totalDamage} 伤害${matchupLabel}${eventLabel}（敌剩余 ${result.defenderTroopsAfter}）${result.counterDamage ? ` · 反击-${result.counterDamage}` : ''} — 敌军回合…`,
    log: [...battle.log, { turn: battle.turn, message: `${atkO.name} 攻 ${defO.name} ${totalDamage}${eventLabel}${result.details.length ? ' | ' + result.details.join(' ') : ''}`, explanation: { kind: 'attack' as const, attackerFormation: attacker.formation, defenderFormation: defender.formation, formationAttack: hexFormationMods(attacker.formation).atk, formationDefense: hexFormationMods(defender.formation).def } }],
  });
}

export function finishPlayerAction(battle: BattleState): BattleState {
  if (battle.phase !== 'player') return battle;
  assertBattleNotPausedForDuel(battle);
  const units = battle.units.map((u) =>
    u.side === 'attacker' ? { ...u, hasActed: true, mp: 0 } : u,
  );
  return enterEnemyPhase({
    ...battle,
    units,
    message: '敌军回合…',
  });
}

/**
 * P1-3（Session 411，`docs/40-game-evaluation.md`）六角微操结算兵力口径（纯函数、零 RNG）：
 * - 战术撤退：存活攻军（含已撤退）合计 × 50% 回流（既有规则，逐字节等价）；
 * - 攻方胜利：**亲统督战 · 伤兵归队**——存活兵额外回补重伤差值的 15%（封顶满编），
 *   与自动战（runAutoBattle 公式伤亡）形成「这仗要不要手打」的真实收益差；
 * - 守方胜利/平：无回补。
 */
export const MANUAL_VICTORY_RECOVERY_RATIO = 0.15;

/** P1-3（Session 418）：手动六角胜利且守方单位被歼 → 该主将战场生擒（确定性，无掷点）。 */
export function collectAnnihilatedDefenderCommanders(
  battle: Pick<BattleState, 'units' | 'winner'>,
): number[] {
  if (battle.winner !== 'attacker') return [];
  const ids: number[] = [];
  for (const unit of battle.units) {
    if (unit.side !== 'defender' || !unit.isDestroyed) continue;
    if (ids.includes(unit.commanderId)) continue;
    ids.push(unit.commanderId);
  }
  return ids.sort((a, b) => a - b);
}

export function settleTacticalMeleeTroops(battle: Pick<BattleState, 'units' | 'winner'>): {
  attackerTroops: number;
  defenderTroops: number;
  veteranRecovery: number;
  note: string;
} {
  const aliveAttacker = battle.units.filter((unit) => unit.side === 'attacker' && !unit.isDestroyed);
  const aliveDefender = battle.units.filter((unit) => unit.side === 'defender' && !unit.isDestroyed);
  const voluntaryRetreat = aliveAttacker.some((unit) => unit.isRetreated);
  const survivors = aliveAttacker
    .filter((unit) => !unit.isRetreated)
    .reduce((sum, unit) => sum + unit.troopCount, 0);
  const maxTroops = aliveAttacker.reduce((sum, unit) => sum + unit.maxTroops, 0);
  const defenderTroops = aliveDefender
    .filter((unit) => !unit.isRetreated)
    .reduce((sum, unit) => sum + unit.troopCount, 0);
  if (voluntaryRetreat) {
    const total = aliveAttacker.reduce((sum, unit) => sum + unit.troopCount, 0);
    return { attackerTroops: Math.floor(total * 0.5), defenderTroops, veteranRecovery: 0, note: '战术撤退（50%回流）' };
  }
  const wounded = Math.max(0, maxTroops - survivors);
  const veteranRecovery =
    battle.winner === 'attacker' ? Math.floor(wounded * MANUAL_VICTORY_RECOVERY_RATIO) : 0;
  const note =
    battle.winner === 'attacker'
      ? veteranRecovery > 0
        ? `攻方胜 · 亲统督战：伤兵归队+${veteranRecovery}`
        : '攻方胜'
      : '守方胜';
  return { attackerTroops: Math.min(maxTroops, survivors + veteranRecovery), defenderTroops, veteranRecovery, note };
}

/**
 * 六角战术撤退：将当前仍有兵力的攻方单位标记为有序撤出，并把战斗交给
 * 结算层回流残兵。包围是派生态势；若任一存活攻方单位已被协同包围，拒绝
 * 撤退，避免“被两翼锁住却瞬间全军脱离”的漏洞。该动作不消费 RNG。
 *
 * Session 367 追击：成功撤退时，每支与活跃守军相邻的攻方部队按 08 §二十七
 * 追击系数（0.6×基础伤害，中位值、必中）承受一次截击者追击；单名最强
 * 相邻截击者出手，不触发暴击/反击/连击。
 */
const RETREAT_PURSUIT_COEFF = 0.6;

function bestRetreatPursuer(
  _retreater: BattleUnit,
  candidates: readonly BattleUnit[],
  unitTemplates: Record<string, { attack: number }>,
): BattleUnit | null {
  let best: BattleUnit | null = null;
  let bestScore = -Infinity;
  for (const c of candidates) {
    const tmpl = (unitTemplates as unknown as Record<string, { attack: number }>)[c.unitType];
    const score = (tmpl?.attack ?? 0) * 10 + c.troopCount * 0.001;
    if (score > bestScore || (score === bestScore && c.id < (best?.id ?? '\uffff'))) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export function retreatBattle(battle: BattleState): BattleState {
  if (battle.phase !== 'player') throw new Error('非玩家回合');
  assertBattleNotPausedForDuel(battle);
  const attackers = battle.units.filter((unit) => unit.side === 'attacker' && isActiveBattleUnit(unit));
  if (attackers.length === 0) throw new Error('我军已无可撤部队');
  const surrounded = attackers.filter((unit) => isUnitSurrounded(battle.units, unit.id)
    && !(battle.isSiege && isEdgeForSiegeBreakout(unit, battle)));
  if (surrounded.length > 0) {
    throw new Error(`RETREAT_SURROUNDED:${surrounded.map((unit) => unit.commanderName).join('、')}`);
  }
  const names = attackers.map((unit) => unit.commanderName).join('、');
  const unitMap = getUnitByType();
  const strongMap = buildStrongAgainstMap();
  const PursuitMessages: string[] = [];
  // 先对每支撤退部队结算追击，再统一标记退场
  let working = battle.units.map((unit) => ({ ...unit }));
  for (const retreater of attackers) {
    const adjacent = working.filter((candidate) => candidate.side === 'defender'
      && isActiveBattleUnit(candidate)
      && hexDistance(candidate.position, retreater.position) === 1);
    if (adjacent.length === 0) continue;
    const pursuer = bestRetreatPursuer(retreater, adjacent, unitMap as unknown as Record<string, { attack: number }>);
    if (!pursuer) continue;
    const atkT = unitMap[pursuer.unitType];
    const defT = unitMap[retreater.unitType];
    if (!atkT || !defT) continue;
    // Effective stats: use battle commanderName lookup via current working snapshot
    // For 0-A, war/leadership fallback to 70 if officer missing, but battle pursuit
    // should align with attacker/defender formation & terrain. Officer stats
    // are fetched from runtime state? Here we approximate with base 70 + formation.
    // To keep zero new deps, use unit template attack/def as proxy and assume
    // officer war 70 for both sides if State not available; however retreatBattle
    // does not receive GameState, so use neutral 70. Future full officer-aware
    // pursuit should pass GameState explicitly.
    const matchup = getUnitMatchup(pursuer.unitType, retreater.unitType, strongMap);
    const atkTerrain = battle.hexGrid.terrain[pursuer.position.r]?.[pursuer.position.q] ?? TerrainType.PLAIN;
    const defTerrain = battle.hexGrid.terrain[retreater.position.r]?.[retreater.position.q] ?? TerrainType.PLAIN;
    const medianRng: CritRng = () => 0.5;
    const base = calcDamage(
      {
        unitAttack: atkT.attack, unitDefense: atkT.defense, officerWar: 70,
        officerLeadership: 70, troops: pursuer.troopCount, maxTroops: pursuer.maxTroops,
        morale: pursuer.morale, terrain: atkTerrain, weather: battle.weather,
        matchup, formationAtk: hexFormationMods(pursuer.formation).atk,
      },
      {
        unitAttack: defT.attack, unitDefense: defT.defense, officerWar: 70,
        officerLeadership: 70, troops: retreater.troopCount, maxTroops: retreater.maxTroops,
        morale: retreater.morale, terrain: defTerrain, weather: battle.weather,
        matchup: 1 / Math.max(0.1, matchup),
        formationDef: hexFormationMods(retreater.formation).def,
      },
      medianRng,
    );
    const dmg = Math.max(1, Math.round(base * RETREAT_PURSUIT_COEFF));
    working = working.map((unit) => {
      if (unit.id !== retreater.id) return unit;
      const troops = Math.max(0, unit.troopCount - dmg);
      return {
        ...unit,
        troopCount: troops,
        isDestroyed: troops <= 0,
        morale: Math.max(0, unit.morale - 2),
      };
    });
    const killed = (working.find((unit) => unit.id === retreater.id)?.troopCount ?? 0) <= 0;
    PursuitMessages.push(`${pursuer.commanderName} 追击 ${retreater.commanderName}，造成 ${dmg} 伤害${killed ? '—被追击溃灭' : ''}`);
  }
  const pursuitLog = PursuitMessages.length ? `；追击：${PursuitMessages.join('；')}` : '';
  return {
    ...battle,
    units: working.map((unit) => {
      if (unit.side !== 'attacker') return unit;
      const original = attackers.find((candidate) => candidate.id === unit.id);
      if (!original) return unit;
      // 已被追击至溃灭的单位不再标记撤退，保留溃灭状态
      if (unit.isDestroyed || unit.troopCount <= 0) {
        return { ...unit, hasActed: true, mp: 0 };
      }
      return { ...unit, isRetreated: true, hasActed: true, mp: 0 };
    }),
    phase: 'over',
    winner: 'defender',
    message: `我军有序撤退（${names}），残部将返回出发城${pursuitLog}`,
    log: [...battle.log, { turn: battle.turn, message: `战术撤退：${names}${pursuitLog}` }],
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
  assertBattleNotPausedForDuel(battle);
  if (battle.weather === Weather.SNOW) throw new Error('雪天不可用火计');

  const attacker = battle.units.find((u) => u.id === attackerId);
  const target = battle.units.find((u) => u.id === targetId);
  if (!attacker || !target) throw new Error('单位不存在');
  if (attacker.side !== 'attacker' || target.side !== 'defender') {
    throw new Error('火计只能对敌军施放');
  }
  if (attacker.hasActed) throw new Error('该部队已行动');
  if (!isActiveBattleUnit(attacker)) throw new Error('部队已溃');
  if (!isActiveBattleUnit(target)) throw new Error('目标已溃');

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
    return enterEnemyPhase({
      ...battle,
      units: spent,
      message: `${atkO.name} 火计失败（成功率${successRate}%）— 敌军回合…`,
      log: [
        ...battle.log,
        { turn: battle.turn, message: `${atkO.name} 火计失手` },
      ],
    });
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

  const attackerAlive = sideAlive(units, 'attacker');
  const defenderAlive = sideAlive(units, 'defender');
  if (!attackerAlive || !defenderAlive) {
    return {
      ...battle,
      units,
      phase: 'over',
      winner: defenderAlive ? 'defender' : 'attacker',
      message: `${atkO.name} ${skillNote} 造成 ${dmg} 伤害${terrainNote}${weatherNote} — ${defenderAlive ? '我军溃败！' : '敌军溃败！'}`,
      log: [
        ...battle.log,
        { turn: battle.turn, message: `${skillNote}击破 ${defO.name}` },
      ],
    };
  }

  return enterEnemyPhase({
    ...battle,
    units,
    message: `${atkO.name} ${skillNote} 造成 ${dmg} 伤害${terrainNote}${weatherNote}（敌剩余 ${newTroops}）— 敌军回合…`,
    log: [
      ...battle.log,
      { turn: battle.turn, message: `${skillNote} 对 ${defO.name} 造成 ${dmg}` },
    ],
  });
}

const WEATHER_LABEL_ZH: Record<Weather, string> = {
  [Weather.CLEAR]: '晴',
  [Weather.CLOUDY]: '阴',
  [Weather.RAIN]: '雨',
  [Weather.STORM]: '暴雨',
  [Weather.FOG]: '雾',
  [Weather.SNOW]: '雪',
};

/**
 * 05 §3.2 天气主动技能（0-A）：诸葛亮/司马懿专属。
 * 确定性成功、不消费 RNG；切换后重置 weatherChangeTimer；结束该部队行动并交权敌军。
 */
export function castWeatherSkill(
  battle: BattleState,
  attackerId: string,
  targetWeather: string,
  state: GameState,
): BattleState {
  if (battle.phase !== 'player') throw new Error('非玩家回合');
  assertBattleNotPausedForDuel(battle);
  if (!isValidBattleWeather(targetWeather)) throw new Error('目标天气无效');
  if (targetWeather === battle.weather) throw new Error('目标天气须不同于当前');

  const attacker = battle.units.find((u) => u.id === attackerId);
  if (!attacker) throw new Error('单位不存在');
  if (attacker.side !== 'attacker') throw new Error('仅我军可改天气');
  if (attacker.hasActed) throw new Error('该部队已行动');
  if (!isActiveBattleUnit(attacker)) throw new Error('部队已溃');
  if (!canUseWeatherActive(attacker.commanderId)) {
    throw new Error('主将无观天专属（仅诸葛亮/司马懿）');
  }

  const cost = weatherActiveEnergyCost(attacker.commanderId);
  const energy = attacker.energy ?? 100;
  if (energy < cost) throw new Error(`气力不足（需${cost}，当前${energy}）`);

  const atkO = state.officers[attacker.commanderId];
  if (!atkO) throw new Error('缺少主将');

  const units = battle.units.map((u) =>
    u.id === attacker.id
      ? { ...u, energy: energy - cost, hasActed: true, mp: 0 }
      : u,
  );
  const fromLabel = WEATHER_LABEL_ZH[battle.weather];
  const toLabel = WEATHER_LABEL_ZH[targetWeather];
  const skillNote = attacker.commanderId === 4 ? '借东风' : '观天';

  return enterEnemyPhase({
    ...battle,
    weather: targetWeather,
    weatherChangeTimer: WEATHER_ACTIVE_TIMER_RESET,
    units,
    message: `${atkO.name} ${skillNote}：${fromLabel}→${toLabel} — 敌军回合…`,
    log: [
      ...battle.log,
      { turn: battle.turn, message: `${atkO.name} ${skillNote}：天气 ${fromLabel}→${toLabel}` },
    ],
  });
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

/** 适性升档（全兵种适性+1 级：NONE→C→B→A→S，S 封顶） */
function boostProficiency(prof: UnitProficiency): UnitProficiency {
  switch (prof) {
    case UnitProficiency.NONE: return UnitProficiency.C;
    case UnitProficiency.C: return UnitProficiency.B;
    case UnitProficiency.B: return UnitProficiency.A;
    case UnitProficiency.A: return UnitProficiency.S;
    default: return UnitProficiency.S;
  }
}

/** 查找武将对该兵种的适性（等级表 Lv14 全兵种适性+1，Session 265 数值消费） */
function getOfficerProficiency(state: GameState, officerId: number, unitType: UnitType): UnitProficiency {
  const o = state.officers[officerId];
  if (!o) return UnitProficiency.NONE;
  const prof = o.unitProficiency[unitType] ?? UnitProficiency.NONE;
  const effects = meritEffects(meritLevelFor(o.merit ?? 0), o.meritPath ?? 'neutral');
  return effects.proficiencyBoost > 0 ? boostProficiency(prof) : prof;
}

function resolveAbilityExecution(
  ability: CombatAbilityDef,
  proficiency: UnitProficiency,
  abilityUses = 0,
): CombatAbilityLevel | null {
  const maxLevel = proficiencyToMaxLevel(proficiency);
  if (maxLevel === 0) return null;
  if (ability.leveling === 'leveled') {
    return (ability.perLevel ?? []).filter((level) => level.level <= maxLevel).at(-1) ?? null;
  }
  // Session 350：proficiency 正式按使用次数插值；适性仅作门禁（已由 maxLevel===0 拒绝）。
  const base = ability.basePower ?? 1;
  const max = ability.maxPower ?? base;
  return {
    level: 1,
    energyCost: ability.energyCost ?? 0,
    power: resolveProficiencyPower(base, max, abilityUses),
    hitRateBonus: ability.hitRateBonus ?? 0,
    requiredProficiency: proficiency,
  };
}

/** 查找武将可施放的战法（适性等级 ≥ 战法层级门槛） */
export function getUsableAbilities(
  state: GameState,
  battle: BattleState,
  unitId: string,
): { ability: CombatAbilityDef; level: number; levelData: CombatAbilityLevel }[] {
  if (battle.duel && battle.duel.phase !== 'resolved') return [];
  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit || !isActiveBattleUnit(unit)) return [];
  const tmpl = getUnitByType()[unit.unitType];
  if (!tmpl) return [];
  // 05 §1.3：雾天弓兵不可射击；能力列表与服务端施放门禁保持同源。
  if (battle.weather === Weather.FOG && tmpl.range > 1) return [];
  const prof = getOfficerProficiency(state, unit.commanderId, unit.unitType);
  const maxLevel = proficiencyToMaxLevel(prof);
  if (maxLevel === 0) return [];
  const officer = state.officers[unit.commanderId];
  const abilityUses = getUnitAbilityUses(officer, unit.unitType);

  const result: { ability: CombatAbilityDef; level: number; levelData: CombatAbilityLevel }[] = [];
  for (const ability of tmpl.abilities ?? []) {
    const levelData = resolveAbilityExecution(ability, prof, abilityUses);
    if (levelData) result.push({ ability, level: levelData.level, levelData });
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
  assertBattleNotPausedForDuel(battle);

  const attacker = battle.units.find((u) => u.id === attackerId);
  const target = battle.units.find((u) => u.id === targetId);
  if (!attacker || !target) throw new Error('单位不存在');
  if (attacker.side !== 'attacker' || target.side !== 'defender') {
    throw new Error('战法只能对敌军施放');
  }
  if (attacker.hasActed) throw new Error('该部队已行动');
  if (!isActiveBattleUnit(attacker)) throw new Error('部队已溃');
  if (!isActiveBattleUnit(target)) throw new Error('目标已溃');

  // 查找战法定义
  const tmpl = getUnitByType()[attacker.unitType];
  if (!tmpl) throw new Error('兵种数据缺失');
  const ability = (tmpl.abilities ?? []).find((a) => a.id === abilityId);
  if (!ability) throw new Error('该兵种无此战法');
  if (battle.weather === Weather.FOG && tmpl.range > 1) throw new Error('雾天弓兵不可射击');
  // 适性等级门槛
  const prof = getOfficerProficiency(state, attacker.commanderId, attacker.unitType);
  const maxLevel = proficiencyToMaxLevel(prof);
  if (maxLevel === 0) throw new Error('适性不足，无法施放战法');

  const atkOEarly = state.officers[attacker.commanderId];
  const abilityUses = getUnitAbilityUses(atkOEarly, attacker.unitType);
  const levelData = resolveAbilityExecution(ability, prof, abilityUses);
  if (!levelData) throw new Error('无可用战法层级');

  // 气力消耗
  const energy = attacker.energy ?? 100;
  if (energy < levelData.energyCost) {
    throw new Error(`气力不足（需${levelData.energyCost}，当前${energy}）`);
  }

  // 射程检查
  const dist = hexDistance(attacker.position, target.position);
  if (dist < Math.max(1, ability.minRange) || dist > ability.maxRange) {
    throw new Error(`战法射程为${Math.max(1, ability.minRange)}-${ability.maxRange}格（当前${dist}格）`);
  }

  const atkO = state.officers[attacker.commanderId];
  const defO = state.officers[target.commanderId];
  if (!atkO || !defO) throw new Error('缺少主将');

  // proficiency：扣气即计使用次数（正式熟练度记账）
  if (ability.leveling === 'proficiency') {
    recordUnitAbilityUse(atkO, attacker.unitType);
  }

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
    return enterEnemyPhase({
      ...battle,
      units: spent,
      message: `${atkO.name} ${ability.name} 未命中（命中率${baseHit}%）— 敌军回合…`,
      log: [...battle.log, { turn: battle.turn, message: `${atkO.name} ${ability.name} 失手` }],
    });
  }

  // 计算伤害：基础伤害（用 calcDamage 的结构）× power 倍率
  // 功绩属性加成计入有效武力/统帅（Session 265；08 §二十八守城 +3）
  const atkT = tmpl;
  const defT = getUnitByType()[target.unitType];
  const strongMap = buildStrongAgainstMap();
  const matchup = getUnitMatchup(attacker.unitType, target.unitType, strongMap);
  const atkEquip2 = equipBonusFor(atkO);
  const defEquip2 = equipBonusFor(defO);
  const baseDmg = calcDamage(
    {
      unitAttack: atkT.attack,
      unitDefense: atkT.defense,
      officerWar: atkO.stats.war + meritStatBonus(atkO, 'war') + (atkEquip2.war ?? 0),
      officerLeadership: atkO.stats.leadership + meritStatBonus(atkO, 'leadership') + (atkEquip2.leadership ?? 0),
      troops: attacker.troopCount,
      maxTroops: attacker.maxTroops,
      morale: attacker.morale,
      terrain: battle.hexGrid.terrain[attacker.position.r][attacker.position.q],
      weather: battle.weather,
      matchup,
      formationAtk: hexFormationMods(attacker.formation).atk,
    },
    {
      unitAttack: defT.attack,
      unitDefense: defT.defense,
      officerWar: defO.stats.war + meritStatBonus(defO, 'war') + (defEquip2.war ?? 0),
      officerLeadership: defO.stats.leadership + meritStatBonus(defO, 'leadership') + (defEquip2.leadership ?? 0),
      troops: target.troopCount,
      maxTroops: target.maxTroops,
      morale: target.morale,
      terrain: battle.hexGrid.terrain[target.position.r][target.position.q],
      weather: battle.weather,
      armorDefense: equipArmorDefenseFor(defO),
      formationDef: hexFormationMods(target.formation).def + siegeDefBonus(battle, 'defender'),
    },
    rng,
  );
  const dmg = Math.max(1, Math.round(baseDmg * levelData.power * (0.9 + rng() * 0.2)));
  const affected = spent.filter((u) => u.side === 'defender' && isActiveBattleUnit(u) &&
    (u.id === target.id || (ability.specialEffect === 'aoe' && hexDistance(u.position, target.position) <= 1)));
  const damageById = new Map(affected.map((u) => [u.id, u.id === target.id ? dmg : Math.max(1, Math.round(dmg * 0.5))]));
  const effectLabels = new Set<string>();
  const units = spent.map((u) => {
    const unitDamage = damageById.get(u.id);
    if (unitDamage == null) return u;
    const effects = [...u.statusEffects];
    const effectLabel = applySpecialEffect(ability, effects, levelData.level);
    if (effectLabel) effectLabels.add(effectLabel);
    const troops = Math.max(0, u.troopCount - unitDamage);
    return {
      ...u,
      troopCount: troops,
      isDestroyed: troops <= 0,
      statusEffects: effects,
      morale: ability.specialEffect === 'morale' ? Math.max(0, u.morale - Math.floor(unitDamage * 0.1)) : Math.max(0, u.morale - 3),
    };
  });
  const newTroops = Math.max(0, target.troopCount - dmg);
  const effectLabel = [...effectLabels].join('');

  const levelLabel = ['', '初', '通', '精', '极', '神'][levelData.level] ?? '';
  const fullLabel = ability.leveling === 'proficiency' ? ability.name : `${ability.name}·${levelLabel}`;
  const splashLabel = affected.length > 1 ? `，波及${affected.length - 1}队` : '';

  const attackerAlive = sideAlive(units, 'attacker');
  const defenderAlive = sideAlive(units, 'defender');
  if (!attackerAlive || !defenderAlive) {
    return {
      ...battle,
      units,
      phase: 'over',
      winner: defenderAlive ? 'defender' : 'attacker',
      message: `${atkO.name} ${fullLabel} 造成 ${dmg} 伤害${effectLabel}${splashLabel} — ${defenderAlive ? '我军溃败！' : '敌军溃败！'}`,
      log: [...battle.log, { turn: battle.turn, message: `${fullLabel}击破 ${defO.name}` }],
    };
  }

  return enterEnemyPhase({
    ...battle,
    units,
    message: `${atkO.name} ${fullLabel} 造成 ${dmg} 伤害${effectLabel}（敌剩余 ${newTroops}）${splashLabel} — 敌军回合…`,
    log: [...battle.log, { turn: battle.turn, message: `${fullLabel} 对 ${defO.name} 造成 ${dmg}${effectLabel}${splashLabel}` }],
  });
}

function tickBurnAndEnergy(
  units: BattleUnit[],
  state: GameState,
): { units: BattleUnit[]; burnNotes: string[] } {
  const burnNotes: string[] = [];
  const next = units.map((u) => {
    if (!isActiveBattleUnit(u)) return u;
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

/**
 * S10 0-A：敌军回合的主动单挑入口。
 *
 * 这是六角战的最小切片：只挑相邻的敌我主将，触发后复用既有 DuelState
 * 和完整 duel.ts 规则。双方没有新增“接受/拒绝”持久字段；玩家方沿用
 * 原有自动接受策略，拒绝时仅写战报并继续敌军常规战术 AI。
 */
function tryEnemyDuel(
  battle: BattleState,
  state: GameState,
  rng: CritRng,
): BattleState | null {
  if (battle.duel) return battle;
  const candidates = battle.units
    .filter((unit) => unit.side === 'defender' && isActiveBattleUnit(unit) && !unit.hasActed && (unit.energy ?? 0) >= DEFAULT_DUEL_CONFIG.challengeEnergyCost)
    .flatMap((challenger) => battle.units
      .filter((defender) => defender.side === 'attacker' && isActiveBattleUnit(defender))
      .filter((defender) => hexDistance(challenger.position, defender.position) <= 1)
      .map((defender) => ({ challenger, defender })))
    .sort((a, b) => {
      const distance = hexDistance(a.challenger.position, a.defender.position) - hexDistance(b.challenger.position, b.defender.position);
      if (distance !== 0) return distance;
      const war = (state.officers[b.challenger.commanderId]?.stats.war ?? 0) - (state.officers[a.challenger.commanderId]?.stats.war ?? 0);
      return war || a.challenger.id.localeCompare(b.challenger.id) || a.defender.id.localeCompare(b.defender.id);
    });
  const pair = candidates[0];
  if (!pair) return null;

  const challenger = state.officers[pair.challenger.commanderId];
  const defender = state.officers[pair.defender.commanderId];
  if (!challenger || !defender || challenger.status !== OfficerStatus.ACTIVE || defender.status !== OfficerStatus.ACTIVE) return null;
  const trigger = duelTriggerChance({
    source: 'melee',
    adjacent: true,
    bothCommandersActive: true,
    challengerMorale: pair.challenger.morale,
    defenderMorale: pair.defender.morale,
    challengerBravery: challenger.hidden.valor,
    configuredChance: 0.08,
  });
  if (rng() >= trigger) return null;

  const accepted = aiAcceptChallenge(challenger, defender, (defender.stamina ?? 100) / 100);
  if (!accepted) {
    return {
      ...battle,
      units: battle.units.map((unit) => unit.id === pair.challenger.id ? { ...unit, hasActed: true, mp: 0 } : unit),
      message: `${challenger.name} 向 ${defender.name} 发起单挑，但被拒绝`,
      log: [...battle.log, { turn: battle.turn, message: `${defender.name} 拒绝 ${challenger.name} 的单挑` }],
    };
  }

  const units = battle.units.map((unit) => unit.id === pair.challenger.id
    ? { ...unit, energy: Math.max(0, (unit.energy ?? 0) - DEFAULT_DUEL_CONFIG.challengeEnergyCost), hasActed: true, mp: 0 }
    : unit);
  const duel = createDuel(battle.id, challenger, defender, DEFAULT_DUEL_CONFIG, rng, 'delegate');
  return {
    ...battle,
    units,
    duel,
    message: `${challenger.name} 向 ${defender.name} 发起单挑！`,
    log: [...battle.log, { turn: battle.turn, message: `敌军单挑: ${challenger.name} vs ${defender.name}` }],
  };
}

export function runEnemyPhase(
  battle: BattleState,
  state: GameState,
  rng: CritRng,
  options?: { afterDuel?: boolean },
): BattleState {
  if (battle.phase !== 'enemy') return battle;
  // 单挑未结算时战场暂停：不得经敌军阶段推进单挑或继续 AI。
  if (!options?.afterDuel && battle.duel && battle.duel.phase !== 'resolved') {
    return battle;
  }

  const afterDuel = options?.afterDuel === true;
  const burned = afterDuel
    ? { units: battle.units, burnNotes: [] as string[] }
    : tickBurnAndEnergy(battle.units, state);
  if (!sideAlive(burned.units, 'defender')) {
    const atkAlive = sideAlive(burned.units, 'attacker');
    if (atkAlive) {
      return {
        ...battle,
        units: burned.units,
        duel: null,
        phase: 'over',
        winner: 'attacker',
        message: afterDuel
          ? `单挑后灼烧检定 — 敌军溃败！`
          : `灼烧持续 — 敌军溃败！${burned.burnNotes.join('；')}`,
        log: [
          ...battle.log,
          { turn: battle.turn, message: burned.burnNotes.join('；') || (afterDuel ? '单挑后续行' : '灼烧击破') },
        ],
      };
    }
  }

  const duelBattle = afterDuel
    ? { ...battle, units: burned.units, duel: null }
    : tryEnemyDuel({ ...battle, units: burned.units }, state, rng);
  if (!afterDuel && duelBattle?.duel) {
    // 和玩家发起单挑保持一致：先推进一回合，之后由 DuelPanel 继续观看或跳过。
    return stepBattleDuel(duelBattle, state, rng);
  }

  const officerStats = Object.fromEntries(
    Object.values(state.officers).map((o: Officer) => [
      o.id,
      {
        // 与玩家 attackUnit/castAbility 共用有效属性：功绩与装备不能因操作者是 AI 而消失。
        war: o.stats.war + meritStatBonus(o, 'war') + (equipBonusFor(o).war ?? 0),
        leadership: o.stats.leadership + meritStatBonus(o, 'leadership') + (equipBonusFor(o).leadership ?? 0),
        armorDefense: equipArmorDefenseFor(o),
        name: o.name,
      },
    ]),
  );

  const result = runSimpleEnemyAi(
    duelBattle?.units ?? burned.units,
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
    battle.weather,
    battle.isSiege,
  );

  if (result.over) {
    return {
      ...battle,
      units: result.units,
      duel: null,
      phase: 'over',
      winner: result.winner,
      message: result.message,
      log: [...(duelBattle?.log ?? battle.log), { turn: battle.turn, message: result.message }],
    };
  }

  // 新回合：恢复气力 = 智/10
  const weatherTick = tickBattleWeather(battle, state.season, rng);
  const units = result.units.map((u) => {
    if (u.side === 'attacker' && isActiveBattleUnit(u)) {
      const int = state.officers[u.commanderId]?.stats.intelligence ?? 50;
      const recover = Math.max(1, Math.floor(int / 10));
      const maxE = u.maxEnergy ?? 100;
      const cur = u.energy ?? maxE;
      return {
        ...u,
        hasActed: false,
        mp: effectiveMovement(u.maxMp, weatherTick.weather),
        energy: Math.min(maxE, cur + recover),
      };
    }
    return u;
  });

  const burnMsg = burned.burnNotes.length ? burned.burnNotes.join('；') + ' | ' : '';
  const duelResumeMsg = afterDuel ? '单挑结束，敌军续行 | ' : '';
  const weatherMsg = weatherTick.changed ? `天气转为${weatherTick.weather}` : '';
  return {
    ...battle,
    units,
    duel: null,
    weather: weatherTick.weather,
    ...(weatherTick.timer == null ? {} : { weatherChangeTimer: weatherTick.timer }),
    turn: battle.turn + 1,
    phase: 'player',
    tacticalPoints: Math.min(
      HEX_TACTICAL_POINT_CAP,
      (battle.tacticalPoints ?? HEX_TACTICAL_POINTS) + HEX_TACTICAL_POINTS
        + ((state.officers[battle.units.find((unit) => unit.side === 'attacker')?.commanderId ?? 0]?.stats.intelligence ?? 50) >= 80 ? 1 : 0),
    ),
    tacticalPointsUsed: 0,
    message: [duelResumeMsg + burnMsg + result.message, weatherMsg, '你的回合'].filter(Boolean).join(' | '),
    log: [
      ...(duelBattle?.log ?? battle.log),
      ...(burned.burnNotes.length
        ? [{ turn: battle.turn, message: burned.burnNotes.join('；') }]
        : []),
      { turn: battle.turn, message: result.message },
      ...(weatherMsg ? [{ turn: battle.turn, message: weatherMsg }] : []),
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
  rng: import('../battle/duel.js').DuelRng,
  stance: import('@leh/shared').DuelStance = 'delegate',
): { battle: BattleState; accepted: boolean } {
  if (battle.phase !== 'player') throw new Error('非玩家回合');
  if (battle.duel) throw new Error('已有进行中的单挑');

  const atkUnit = battle.units.find((u) => u.id === challengerUnitId);
  const defUnit = battle.units.find((u) => u.id === targetUnitId);
  if (!atkUnit || !defUnit) throw new Error('单位不存在');
  if (atkUnit.side !== 'attacker' || defUnit.side !== 'defender') throw new Error('只能向敌将发起单挑');
  if (!isActiveBattleUnit(atkUnit) || !isActiveBattleUnit(defUnit)) throw new Error('部队已溃');

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

  // 接受: 扣发起方气力, 创建单挑；武魁威压 / 破军遇吕布士气
  const wukuiAtk = isCurrentWukui(state, challenger.id);
  const wukuiDef = isCurrentWukui(state, defender.id);
  const pojunVsLvBuAtk = isCurrentPojun(state, challenger.id) && isLvBuOfficerId(defender.id);
  const pojunVsLvBuDef = isCurrentPojun(state, defender.id) && isLvBuOfficerId(challenger.id);
  const spentUnits = battle.units.map((u) => {
    let next = u;
    if (u.id === atkUnit.id) {
      next = { ...next, energy: energy - DUEL_CHALLENGE_COST };
      if (wukuiDef) {
        next = {
          ...next,
          morale: Math.max(0, next.morale + WUKUI_DUEL_OPPONENT_MORALE_DELTA),
        };
      }
      if (pojunVsLvBuAtk) {
        next = {
          ...next,
          morale: Math.min(120, next.morale + POJUN_DUEL_VS_LVBU_MORALE_DELTA),
        };
      }
    } else if (u.id === defUnit.id) {
      if (wukuiAtk) {
        next = {
          ...next,
          morale: Math.max(0, next.morale + WUKUI_DUEL_OPPONENT_MORALE_DELTA),
        };
      }
      if (pojunVsLvBuDef) {
        next = {
          ...next,
          morale: Math.min(120, next.morale + POJUN_DUEL_VS_LVBU_MORALE_DELTA),
        };
      }
    }
    return next;
  });
  const duel = createDuel(battle.id, challenger, defender, DEFAULT_DUEL_CONFIG, rng, stance);
  const tags: string[] = [];
  if (wukuiAtk || wukuiDef) tags.push('武魁威压：对方士气−5');
  if (pojunVsLvBuAtk || pojunVsLvBuDef) tags.push('破军：遇吕布士气+5');
  const aweMsg = tags.length ? `（${tags.join('；')}）` : '';
  return {
    battle: {
      ...battle,
      units: spentUnits,
      duel,
      message: `${challenger.name} 向 ${defender.name} 发起单挑！${aweMsg}`,
      log: [
        ...battle.log,
        {
          turn: battle.turn,
          message: `单挑: ${challenger.name} vs ${defender.name}${aweMsg}`,
        },
      ],
    },
    accepted: true,
  };
}

/** 推进单挑一回合 (观看演出模式). */
export function stepBattleDuel(
  battle: BattleState,
  state: GameState,
  rng: import('../battle/duel.js').DuelRng,
): BattleState {
  if (!battle.duel || battle.duel.phase !== 'dueling') return battle;
  const challenger = state.officers[battle.duel.challengerId];
  const defender = state.officers[battle.duel.defenderId];
  if (!challenger || !defender) return battle;
  const duel = stepDuel(battle.duel, challenger, defender, DEFAULT_DUEL_CONFIG, rng, {
    [challenger.id]: duelEquipBonusFor(challenger),
    [defender.id]: duelEquipBonusFor(defender),
  });
  return applyDuelPhase(battle, duel, state, rng);
}

/** 跳过单挑动画, 直接结算 (fast/skip). */
export function skipBattleDuel(
  battle: BattleState,
  state: GameState,
  rng: import('../battle/duel.js').DuelRng,
): BattleState {
  if (!battle.duel) return battle;
  if (battle.duel.phase === 'resolved') return applyDuelOutcome(battle, state, rng);
  const challenger = state.officers[battle.duel.challengerId];
  const defender = state.officers[battle.duel.defenderId];
  if (!challenger || !defender) return battle;
  const duel = runDuelToCompletion(battle.duel, challenger, defender, DEFAULT_DUEL_CONFIG, rng, {
    [challenger.id]: duelEquipBonusFor(challenger),
    [defender.id]: duelEquipBonusFor(defender),
  });
  return applyDuelPhase(battle, duel, state, rng);
}

function applyDuelPhase(
  battle: BattleState,
  duel: DuelState,
  state: GameState,
  rng: import('../battle/duel.js').DuelRng,
): BattleState {
  if (duel.phase !== 'resolved') {
    return { ...battle, duel, message: duel.roundHistory[duel.roundHistory.length - 1]?.description ?? battle.message };
  }
  return applyDuelOutcome({ ...battle, duel }, state, rng);
}

/** 单挑结算: 将结果应用到战场单位与武将. */
function applyDuelOutcome(
  battle: BattleState,
  state: GameState,
  rng?: import('../battle/duel.js').DuelRng,
): BattleState {
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

  // 胜方士气 + 功绩（君主不参与功绩系统，docs/04 §3.8/§6.5）
  if (winnerUnit) {
    units = units.map((u) =>
      u.id === winnerUnit.id ? { ...u, morale: Math.min(120, u.morale + result.moraleChange.winner) } : u,
    );
  }
  if (winnerOff) {
    const winnerIsRuler = state.factions[winnerOff.faction ?? 0]?.rulerId === winnerOff.id;
    if (!winnerIsRuler) {
      winnerOff.merit = (winnerOff.merit ?? 0) + result.meritReward;
      Object.assign(winnerOff, syncMerit(winnerOff));
    }
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
  const atkAlive = units.some((u) => u.side === 'attacker' && isActiveBattleUnit(u));
  const defAlive = units.some((u) => u.side === 'defender' && isActiveBattleUnit(u));

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

  const settled: BattleState = {
    ...battle,
    units,
    duel: null,
    message: `单挑结束 — ${message}`,
    log: [...battle.log, { turn: battle.turn, message: `单挑: ${result.epilogue}` }],
  };

  // 敌军阶段发起的单挑：结算后跳过重复灼烧/二次单挑，直接续行剩余敌军 AI。
  if (battle.phase === 'enemy' && rng) {
    return runEnemyPhase(settled, state, rng, { afterDuel: true });
  }

  return {
    ...settled,
    phase: 'player',
    message: `单挑结束 — ${message} | 你的回合`,
  };
}
