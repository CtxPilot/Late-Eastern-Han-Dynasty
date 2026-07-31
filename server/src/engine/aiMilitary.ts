// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S15 军事 AI：外交过滤、君主激进度、边境袭扰与 CampaignArmy 出征。
 */
import {
  FormationType,
  OfficerStatus,
  UnitType,
  canMarchAlongRoad,
  isHostileOrAtWar,
  roadNeighbors,
  type GameState,
  type Officer,
} from '@leh/shared';
import { getPlotAttackModifier, isEmptyFortDeterring } from './plot.js';
import { assaultForFaction, startCampaignForFaction } from './campaign.js';

export const AI_MILITARY_CONFIG = Object.freeze({
  minRaidSourceTroops: 2_000,
  minCampaignTroops: 3_500,
  garrisonReserve: 500,
  raidForce: 800,
  minSourceTargetRatio: 0.9,
  baseCampaignChance: 0.2,
  maxCampaignChance: 0.72,
  baseRaidChance: 0.12,
  baitedRaidBonus: 0.25,
  maxActiveFronts: 2,
  threatenedReserveRatio: 0.25,
  retreatTroopRatio: 0.55,
  retreatFoodMonths: 2,
});

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

/** 军事行动仅允许战争/敌对关系；缺失关系按中立处理。 */
export function canAiAttackFaction(state: GameState, attackerId: number, defenderId: number): boolean {
  return isHostileOrAtWar(state.diplomacy, attackerId, defenderId);
}

/** 君主野心为主、统率为辅，派生 0.75~1.35 的军事激进度。 */
export function getFactionAggression(state: GameState, factionId: number): number {
  const faction = state.factions[factionId];
  const ruler = faction ? state.officers[faction.rulerId] : undefined;
  if (!ruler) return 1;
  const score = 0.75 + ruler.hidden.ambition * 0.03 + ruler.stats.leadership * 0.0015;
  return Math.max(0.75, Math.min(1.35, score));
}

function pickCommander(state: GameState, factionId: number, cityId: number): Officer | undefined {
  const deployed = new Set(state.campaignArmies.flatMap((army) => [
    army.commanderId,
    ...army.subCommanderIds,
    ...(army.advisorId == null ? [] : [army.advisorId]),
    ...(army.subAdvisorId == null ? [] : [army.subAdvisorId]),
  ]));
  return Object.values(state.officers)
    .filter((officer) =>
      officer.faction === factionId &&
      officer.status === OfficerStatus.ACTIVE &&
      officer.location === cityId &&
      !deployed.has(officer.id)
    )
    .sort((a, b) =>
      (b.stats.leadership * 2 + b.stats.war) - (a.stats.leadership * 2 + a.stats.war) ||
      a.id - b.id
    )[0];
}

function monthlyArmyFood(troops: number): number {
  return Math.max(1, Math.floor((troops / 100) * 3));
}

function planWithdrawalPath(fromId: number, destinationId: number): number[] {
  if (fromId === destinationId) return [];
  const queue: Array<{ id: number; path: number[] }> = [{ id: fromId, path: [] }];
  const visited = new Set([fromId]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const nextId of [...roadNeighbors(current.id)].sort((a, b) => a - b)) {
      if (visited.has(nextId)) continue;
      const path = [...current.path, nextId];
      if (nextId === destinationId) return path;
      visited.add(nextId);
      queue.push({ id: nextId, path });
    }
  }
  return [];
}

function withdrawAiArmy(state: GameState, armyId: string, reason: string): GameState {
  const army = state.campaignArmies.find((item) => item.id === armyId);
  if (!army) return state;
  const destination = army.fromNodeId ?? army.currentNodeId;
  const path = planWithdrawalPath(army.currentNodeId, destination);
  const armies = state.campaignArmies.map((item) =>
    item.id === armyId
      ? {
          ...item,
          phase: 'marching' as const,
          targetNodeId: destination,
          path,
          morale: Math.max(0, item.morale - 10),
          siegeState: undefined,
        }
      : item,
  );
  return pushLog(
    { ...state, campaignArmies: armies },
    'ai_retreat',
    `【军情】${army.name}${reason}，撤回${state.cities[destination]?.name ?? '本营'}`,
  );
}

function requiredReserve(state: GameState, factionId: number, cityId: number): number {
  const largestAdjacentEnemy = Object.values(state.cities)
    .filter((target) =>
      target.ruler != null &&
      target.ruler !== factionId &&
      canAiAttackFaction(state, factionId, target.ruler) &&
      canMarchAlongRoad(cityId, target.id)
    )
    .reduce((largest, target) => Math.max(largest, target.troops), 0);
  return Math.max(
    AI_MILITARY_CONFIG.garrisonReserve,
    Math.floor(largestAdjacentEnemy * AI_MILITARY_CONFIG.threatenedReserveRatio),
  );
}

/**
 * 对每个 AI 势力：评估邻接敌城权重，受计谋修正后决定暂缓 / 袭扰 / 出征占城
 */
export function runAiMilitary(
  state: GameState,
  resolutionRng: () => number,
  decisionRng: () => number = resolutionRng,
): GameState {
  let s = state;
  for (const f of Array.from(Object.values(s.factions)).sort((a, b) => a.id - b.id)) {
    if (!f.isAlive || f.isPlayer) continue;
    const engaged = s.campaignArmies.filter((army) =>
      army.factionId === f.id && (army.phase === 'sieging' || army.phase === 'engaged')
    ).sort((a, b) => a.id.localeCompare(b.id));
    for (const army of engaged) {
      const target = s.cities[army.targetNodeId ?? army.currentNodeId];
      if (!target?.ruler || !canAiAttackFaction(s, f.id, target.ruler)) {
        s = withdrawAiArmy(s, army.id, '因战事已止');
        continue;
      }
      const lacksSupply =
        army.food < monthlyArmyFood(army.troops) * AI_MILITARY_CONFIG.retreatFoodMonths;
      const outmatched = army.troops < target.troops * AI_MILITARY_CONFIG.retreatTroopRatio;
      if (lacksSupply || outmatched) {
        s = withdrawAiArmy(s, army.id, lacksSupply ? '因粮道不继' : '因敌强我弱');
        continue;
      }
      const beforeTroops = army.troops;
      const outcome = assaultForFaction(s, army.id, f.id, resolutionRng);
      const factionName = s.factions[f.id]?.name ?? '某军';
      const result = outcome.result;
      s = pushLog(
        outcome.state,
        'ai_battle_report',
        `【战报】${factionName}攻${target.name}${result.winner === 'attacker' ? '得胜' : '失利'}：攻方损${result.attackerCasualties}、守方损${result.defenderCasualties}（出阵${beforeTroops}）`,
      );
    }
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
  const activeFronts = state.campaignArmies.filter((army) =>
    army.factionId === factionId && army.phase !== 'garrison' && army.phase !== 'retreating'
  ).length;
  let frontSlots = Math.max(0, AI_MILITARY_CONFIG.maxActiveFronts - activeFronts);
  if (frontSlots === 0) return state;
  let s = state;
  const usedSources = new Set<number>();

  while (frontSlots > 0) {
    const cands: Cand[] = [];
    for (const from of Object.values(s.cities).filter((city) => city.ruler === factionId)) {
      if (usedSources.has(from.id) || from.troops < AI_MILITARY_CONFIG.minRaidSourceTroops) continue;
      for (const target of Object.values(s.cities)) {
        if (target.ruler == null || target.ruler === factionId) continue;
        if (!canAiAttackFaction(s, factionId, target.ruler)) continue;
        if (!canMarchAlongRoad(from.id, target.id)) continue;
        const mod = getPlotAttackModifier(s, target.id, factionId);
        const base = Math.max(100, 12000 - target.troops);
        const score = base * mod;
        cands.push({ fromId: from.id, targetId: target.id, score, mod });
      }
    }
    if (cands.length === 0) break;

    cands.sort((a, b) => b.score - a.score || a.fromId - b.fromId || a.targetId - b.targetId);
    const best = cands[0];
    const from = s.cities[best.fromId];
    const target = s.cities[best.targetId];
    if (!from || !target) break;
    usedSources.add(from.id);

    const factionName = s.factions[factionId]?.name ?? '某军';
    const targetName = target.name;
    const aggression = getFactionAggression(s, factionId);

    if (best.mod < 0.3 || isEmptyFortDeterring(s, best.targetId)) {
      s = pushLog(s, 'ai_military', `${factionName}因空城疑兵暂缓进攻 ${targetName}`);
      continue;
    }

    const baited = best.mod >= 2;
    const reserve = requiredReserve(s, factionId, from.id);
    const canCapture =
      from.troops - reserve >= AI_MILITARY_CONFIG.minCampaignTroops &&
      from.troops >= target.troops * AI_MILITARY_CONFIG.minSourceTargetRatio &&
      !baited;

    if (canCapture) {
      const advantage = (from.troops - target.troops) / Math.max(target.troops, 1);
      const captureChance = Math.min(
        AI_MILITARY_CONFIG.maxCampaignChance,
        Math.max(0.05, (AI_MILITARY_CONFIG.baseCampaignChance + advantage * 0.15) * aggression),
      );
      if (decisionRng() < captureChance) {
        const commander = pickCommander(s, factionId, from.id);
        if (commander) {
          const troopShare = Math.min(0.9, 0.7 + (aggression - 0.75) * 0.3);
          const troopCount = Math.min(
            from.troops - reserve,
            Math.max(AI_MILITARY_CONFIG.minCampaignTroops, Math.floor(from.troops * troopShare)),
          );
          const food = Math.min(from.food, troopCount * 3);
          const started = startCampaignForFaction(s, {
            fromNodeId: from.id,
            targetNodeId: target.id,
            commanderId: commander.id,
            subCommanderIds: [],
            unitType: UnitType.LIGHT_INFANTRY,
            formation: FormationType.SQUARE,
            troopCount,
            food,
          }, factionId);
          s = pushLog(
            started.state,
            'ai_war_report',
            `【军情】${factionName}命${commander.name}率${troopCount}兵自${from.name}出征${targetName}`,
          );
          frontSlots -= 1;
          continue;
        }
      }
    }

    const chance =
      (AI_MILITARY_CONFIG.baseRaidChance + (baited ? AI_MILITARY_CONFIG.baitedRaidBonus : 0)) *
      aggression;
    if (decisionRng() > chance) {
      if (baited) {
        s = pushLog(
          s,
          'ai_military',
          `${factionName}受假情报影响，意图进攻 ${targetName}（本月未成行）`,
        );
      }
      continue;
    }

    const force = Math.min(AI_MILITARY_CONFIG.raidForce, from.troops - reserve);
    if (force < 400) continue;
    const defLoss = Math.min(target.troops, Math.floor(force * (0.4 + resolutionRng() * 0.35)));
    const atkLoss = Math.floor(force * (0.25 + resolutionRng() * 0.3));

    const cities = {
      ...s.cities,
      [from.id]: { ...from, troops: from.troops - atkLoss },
      [target.id]: { ...target, troops: Math.max(0, target.troops - defLoss) },
    };

    const baitNote = baited ? '（假情报/识破空城诱使）' : '';
    s = pushLog(
      s,
      'ai_war_report',
      `【战报】${factionName}自${from.name}袭扰 ${targetName}${baitNote}：敌损约${defLoss}，己损约${atkLoss}`,
      { cities },
    );
  }
  return s;
}
