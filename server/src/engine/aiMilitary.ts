// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Demo AI 军事考量：读取 S17 假情报/空城疑兵权重，做最简边境袭扰 + 出征占城
 * 非完整出征引擎；正式战争决策属 Phase 5
 */
import {
  OfficerStatus,
  canMarchAlongRoad,
  type City,
  type GameState,
} from '@leh/shared';
import { getPlotAttackModifier, isEmptyFortDeterring } from './plot.js';
import { getUnitByType } from '../data/loader.js';
import { calcDamage, getUnitMatchup } from '../battle/damage.js';
import { lootBeautyOnCapture } from './beauty.js';
import { clearCityCounterOnCapture } from './spy.js';
import { syncFactionResources } from './economy.js';

const MIN_RAID_TROOPS = 2000;
const MIN_CAPTURE_TROOPS = 3500;
const RAID_FORCE = 800;

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<GameState> = {},
): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function recomputeFactionCities(
  cities: GameState['cities'],
  factions: GameState['factions'],
): GameState['factions'] {
  const next = { ...factions };
  for (const fid of Object.keys(next).map(Number)) {
    const f = next[fid];
    if (!f) continue;
    const cityIds = Object.values(cities)
      .filter((c) => c.ruler === fid)
      .map((c) => c.id);
    const capitalOk = cityIds.includes(f.capitalCityId);
    next[fid] = {
      ...f,
      cityIds,
      isAlive: cityIds.length > 0,
      capitalCityId: capitalOk ? f.capitalCityId : (cityIds[0] ?? f.capitalCityId),
    };
  }
  return next;
}

/**
 * 自动结算 AI vs AI 战斗（无 UI，纯数值模拟）
 * 返回攻方剩余兵力、守方剩余兵力、攻方是否胜利
 */
function autoResolveBattle(
  atkTroops: number,
  defTroops: number,
  atkUnitType: string,
  defUnitType: string,
  atkWar: number,
  atkLead: number,
  defWar: number,
  defLead: number,
  resolutionRng: () => number,
): { atkLeft: number; defLeft: number; attackerWon: boolean } {
  const unitMap = getUnitByType();
  const atkT = unitMap[atkUnitType];
  const defT = unitMap[defUnitType];
  if (!atkT || !defT) return { atkLeft: atkTroops, defLeft: defTroops, attackerWon: false };

  const strongMap: Record<string, string[]> = {};
  for (const [type, tmpl] of Object.entries(unitMap)) {
    strongMap[type] = (tmpl.strongAgainst ?? []) as string[];
  }
  const matchup = getUnitMatchup(atkUnitType as any, defUnitType as any, strongMap as any);

  let atk = atkTroops;
  let def = defTroops;
  const maxRounds = 8;

  for (let round = 0; round < maxRounds; round++) {
    if (atk <= 0 || def <= 0) break;

    const atkDmg = calcDamage(
      {
        unitAttack: atkT.attack,
        unitDefense: atkT.defense,
        officerWar: atkWar,
        officerLeadership: atkLead,
        troops: atk,
        maxTroops: atkTroops,
        morale: 80,
        terrain: 'plain' as any,
        matchup,
      },
      {
        unitAttack: defT.attack,
        unitDefense: defT.defense,
        officerWar: defWar,
        officerLeadership: defLead,
        troops: def,
        maxTroops: defTroops,
        morale: 70,
        terrain: 'plain' as any,
      },
      resolutionRng,
    );
    def = Math.max(0, def - atkDmg);

    if (def <= 0) break;

    const defDmg = calcDamage(
      {
        unitAttack: defT.attack,
        unitDefense: defT.defense,
        officerWar: defWar,
        officerLeadership: defLead,
        troops: def,
        maxTroops: defTroops,
        morale: 70,
        terrain: 'plain' as any,
        matchup: matchup > 1 ? 0.7 : matchup < 1 ? 1.3 : 1.0,
      },
      {
        unitAttack: atkT.attack,
        unitDefense: atkT.defense,
        officerWar: atkWar,
        officerLeadership: atkLead,
        troops: atk,
        maxTroops: atkTroops,
        morale: 80,
        terrain: 'plain' as any,
      },
      resolutionRng,
    );
    atk = Math.max(0, atk - defDmg);
  }

  return { atkLeft: atk, defLeft: def, attackerWon: def <= 0 && atk > 0 };
}

/**
 * 对每个 AI 势力：评估邻接敌城权重，受计谋修正后决定暂缓 / 袭扰 / 出征占城
 */
export function runAiMilitary(
  state: GameState,
  resolutionRng: () => number,
  decisionRng: () => number = Math.random,
): GameState {
  let s = state;
  for (const f of Object.values(s.factions)) {
    if (!f.isAlive || f.isPlayer) continue;
    s = aiMilitaryTurn(s, f.id, resolutionRng, decisionRng);
  }
  return s;
}

function aiMilitaryTurn(
  state: GameState,
  factionId: number,
  resolutionRng: () => number,
  decisionRng: () => number,
): GameState {
  const myCities = Object.values(state.cities).filter((c) => c.ruler === factionId);
  if (myCities.length === 0) return state;

  type Cand = { fromId: number; targetId: number; score: number; mod: number };
  const cands: Cand[] = [];

  for (const from of myCities) {
    if (from.troops < MIN_RAID_TROOPS) continue;
    for (const target of Object.values(state.cities)) {
      if (target.ruler == null || target.ruler === factionId) continue;
      if (!canMarchAlongRoad(from.id, target.id)) continue;
      const mod = getPlotAttackModifier(state, target.id, factionId);
      const base = Math.max(100, 12000 - target.troops);
      const score = base * mod;
      cands.push({ fromId: from.id, targetId: target.id, score, mod });
    }
  }

  if (cands.length === 0) return state;

  cands.sort((a, b) => b.score - a.score);
  const best = cands[0];
  const from = state.cities[best.fromId];
  const target = state.cities[best.targetId];
  if (!from || !target) return state;

  const factionName = state.factions[factionId]?.name ?? '某军';
  const targetName = target.name;

  // 强威慑：暂缓
  if (best.mod < 0.3 || isEmptyFortDeterring(state, best.targetId)) {
    return pushLog(
      state,
      'ai_military',
      `${factionName}因空城疑兵暂缓进攻 ${targetName}`,
    );
  }

  // 假情报诱饵 / 识破空城：更愿袭扰
  const baited = best.mod >= 2;

  // —— 出征占城：兵力优势足够时尝试真正占领 ——
  const canCapture =
    from.troops >= MIN_CAPTURE_TROOPS &&
    from.troops > target.troops * 1.2 &&
    !baited; // 诱饵不真占（假情报是陷阱）

  if (canCapture) {
    const captureChance = 0.25 + (from.troops - target.troops) / Math.max(target.troops, 1) * 0.15;
    if (decisionRng() < Math.min(0.7, captureChance)) {
      return doAiCapture(state, from, target, factionId, factionName, resolutionRng);
    }
  }

  // 基础 18% 袭扰；诱饵 +25%
  const chance = baited ? 0.43 : 0.18;
  if (decisionRng() > chance) {
    if (baited) {
      return pushLog(
        state,
        'ai_military',
        `${factionName}受假情报影响，意图进攻 ${targetName}（本月未成行）`,
      );
    }
    return state;
  }

  // 最简袭扰：双方掉兵，不占城
  const force = Math.min(RAID_FORCE, from.troops - 500);
  if (force < 400) return state;
  // 行动已经由 S15 独立决策流决定；伤亡是写入存档的结算结果，必须消费权威流。
  const defLoss = Math.min(target.troops, Math.floor(force * (0.4 + resolutionRng() * 0.35)));
  const atkLoss = Math.floor(force * (0.25 + resolutionRng() * 0.3));

  const cities = {
    ...state.cities,
    [from.id]: { ...from, troops: from.troops - atkLoss },
    [target.id]: {
      ...target,
      troops: Math.max(0, target.troops - defLoss),
    },
  };

  const baitNote = baited ? '（假情报/识破空城诱使）' : '';
  return pushLog(
    state,
    'ai_military',
    `${factionName}自${from.name}袭扰 ${targetName}${baitNote}：敌损约${defLoss}，己损约${atkLoss}`,
    { cities },
  );
}

/** AI 真正出征占城 */
function doAiCapture(
  state: GameState,
  from: City,
  target: City,
  factionId: number,
  factionName: string,
  resolutionRng: () => number,
): GameState {
  const atkTroops = Math.min(from.troops - 500, Math.floor(from.troops * 0.7));
  if (atkTroops < MIN_CAPTURE_TROOPS) return state;

  const defTroops = Math.max(500, Math.floor(target.troops * 0.75));

  // 找攻方武将
  const atkOfficer =
    Object.values(state.officers).find(
      (o) => o.faction === factionId && o.status === OfficerStatus.ACTIVE && o.location === from.id,
    ) ??
    Object.values(state.officers).find(
      (o) => o.faction === factionId && o.status === OfficerStatus.ACTIVE,
    );

  const defOfficer =
    Object.values(state.officers).find(
      (o) =>
        o.faction === target.ruler &&
        o.status === OfficerStatus.ACTIVE &&
        o.location === target.id,
    ) ??
    Object.values(state.officers).find(
      (o) => o.faction === target.ruler && o.status === OfficerStatus.ACTIVE,
    );

  if (!atkOfficer || !defOfficer) return state;

  const result = autoResolveBattle(
    atkTroops,
    defTroops,
    'heavyCavalry',
    'heavyInfantry',
    atkOfficer.stats.war,
    atkOfficer.stats.leadership,
    defOfficer.stats.war,
    defOfficer.stats.leadership,
    resolutionRng,
  );

  if (!result.attackerWon) {
    // 败：残兵回流
    const returned = Math.floor(result.atkLeft * 0.15);
    const cities = {
      ...state.cities,
      [from.id]: { ...from, troops: from.troops - atkTroops + returned },
      [target.id]: { ...target, troops: Math.max(0, result.defLeft) },
    };
    return pushLog(
      state,
      'ai_military',
      `${factionName}自${from.name}攻 ${target.name} 失败（损${atkTroops - returned}兵）`,
      { cities },
    );
  }

  // 胜：占城
  const prevRuler = target.ruler;
  const garrison = Math.max(0, result.atkLeft);
  let cities = { ...state.cities };
  let officers = { ...state.officers };

  const nextTarget: City = {
    ...target,
    ruler: factionId,
    troops: garrison,
    troopsMorale: Math.min(80, Math.max(40, (target.troopsMorale ?? 70) - 15)),
    stats: {
      ...target.stats,
      morale: Math.max(20, (target.stats.morale ?? 70) - 25),
      wall: Math.max(0, target.stats.wall - 10),
    },
    officers: [],
  };

  // 敌方同城武将 → 在野
  const freed: string[] = [];
  const freedIds: number[] = [];
  for (const oid of target.officers) {
    const o = officers[oid];
    if (!o) continue;
    if (o.faction === prevRuler) {
      officers[oid] = {
        ...o,
        faction: null,
        status: OfficerStatus.FREE,
        location: target.id,
        loyalty: 50,
      };
      freed.push(o.name);
      freedIds.push(oid);
    }
  }

  // 攻方主将迁入新城
  officers[atkOfficer.id] = { ...atkOfficer, location: target.id };
  // B2: 占城后城内武将列表 = 攻方主将 + 释放的在野败将
  nextTarget.officers = [atkOfficer.id, ...freedIds];

  // 出发城扣兵
  cities[from.id] = {
    ...from,
    troops: from.troops - atkTroops,
    officers: from.officers.filter((id) => id !== atkOfficer.id),
  };
  cities[target.id] = nextTarget;

  const factions = recomputeFactionCities(cities, state.factions);
  const nextFactions = { ...factions };
  if (prevRuler != null && nextFactions[prevRuler]) {
    const pf = nextFactions[prevRuler];
    nextFactions[prevRuler] = {
      ...pf,
      officerIds: pf.officerIds.filter((id) => officers[id]?.faction === prevRuler),
    };
  }

  const freeMsg = freed.length ? `；${freed.join('、')} 流落在野` : '';
  let after: GameState = pushLog(
    { ...state, cities, officers, factions: nextFactions },
    'ai_capture',
    `${factionName}攻占 ${target.name}！驻军 ${garrison}${freeMsg}`,
  );
  after = clearCityCounterOnCapture(after, target.id);
  // S15 决策仍可独立随机；一旦决定占城，S09 战利品属于持久化结算。
  after = lootBeautyOnCapture(after, target.id, factionId, resolutionRng);
  after = syncFactionResources(after);
  return after;
}
