// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S15 军事 AI：外交过滤、君主激进度、边境袭扰与 CampaignArmy 出征。
 */
import {
  DipRelation,
  FormationType,
  OfficerStatus,
  UnitType,
  canMarchAlongRoad,
  findDiplomacy,
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
  const relation = findDiplomacy(state.diplomacy, attackerId, defenderId)?.relation ?? DipRelation.NEUTRAL;
  return relation === DipRelation.WAR || relation === DipRelation.HOSTILE;
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
      (b.stats.leadership * 2 + b.stats.war) - (a.stats.leadership * 2 + a.stats.war)
    )[0];
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
  for (const f of Object.values(s.factions)) {
    if (!f.isAlive || f.isPlayer) continue;
    const engaged = s.campaignArmies.filter((army) =>
      army.factionId === f.id && (army.phase === 'sieging' || army.phase === 'engaged')
    );
    for (const army of engaged) {
      const target = s.cities[army.targetNodeId ?? army.currentNodeId];
      if (!target?.ruler || !canAiAttackFaction(s, f.id, target.ruler)) continue;
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
  if (state.campaignArmies.some((army) =>
    army.factionId === factionId && army.phase !== 'garrison' && army.phase !== 'retreating'
  )) return state;

  type Cand = { fromId: number; targetId: number; score: number; mod: number };
  const cands: Cand[] = [];

  for (const from of myCities) {
    if (from.troops < AI_MILITARY_CONFIG.minRaidSourceTroops) continue;
    for (const target of Object.values(state.cities)) {
      if (target.ruler == null || target.ruler === factionId) continue;
      if (!canAiAttackFaction(state, factionId, target.ruler)) continue;
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
  const aggression = getFactionAggression(state, factionId);

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
    from.troops - AI_MILITARY_CONFIG.garrisonReserve >= AI_MILITARY_CONFIG.minCampaignTroops &&
    from.troops >= target.troops * AI_MILITARY_CONFIG.minSourceTargetRatio &&
    !baited; // 诱饵不真占（假情报是陷阱）

  if (canCapture) {
    const advantage = (from.troops - target.troops) / Math.max(target.troops, 1);
    const captureChance = Math.min(
      AI_MILITARY_CONFIG.maxCampaignChance,
      Math.max(0.05, (AI_MILITARY_CONFIG.baseCampaignChance + advantage * 0.15) * aggression),
    );
    if (decisionRng() < captureChance) {
      const commander = pickCommander(state, factionId, from.id);
      if (commander) {
        const troopShare = Math.min(0.9, 0.7 + (aggression - 0.75) * 0.3);
        const troopCount = Math.min(
          from.troops - AI_MILITARY_CONFIG.garrisonReserve,
          Math.max(AI_MILITARY_CONFIG.minCampaignTroops, Math.floor(from.troops * troopShare)),
        );
        const food = Math.min(from.food, troopCount * 3);
        const started = startCampaignForFaction(state, {
          fromNodeId: from.id,
          targetNodeId: target.id,
          commanderId: commander.id,
          subCommanderIds: [],
          unitType: UnitType.LIGHT_INFANTRY,
          formation: FormationType.SQUARE,
          troopCount,
          food,
        }, factionId);
        return pushLog(
          started.state,
          'ai_war_report',
          `【军情】${factionName}命${commander.name}率${troopCount}兵自${from.name}出征${targetName}`,
        );
      }
    }
  }

  // 参数化基础袭扰率；诱饵和君主激进度共同修正。
  const chance =
    (AI_MILITARY_CONFIG.baseRaidChance + (baited ? AI_MILITARY_CONFIG.baitedRaidBonus : 0)) *
    aggression;
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
  const force = Math.min(AI_MILITARY_CONFIG.raidForce, from.troops - AI_MILITARY_CONFIG.garrisonReserve);
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
    'ai_war_report',
    `【战报】${factionName}自${from.name}袭扰 ${targetName}${baitNote}：敌损约${defLoss}，己损约${atkLoss}`,
    { cities },
  );
}
