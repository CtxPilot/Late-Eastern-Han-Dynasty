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
  formationTroopCap,
  getCommanderyTemplateByTemplateId,
  isHostileOrAtWar,
  resolveArmyCountyNodeId,
  roadNeighbors,
  type GameState,
  type Officer,
} from '@leh/shared';
import { getPlotAttackModifier, isEmptyFortDeterring, isSecretCrossingGarrisonHold } from './plot.js';
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
  // 郡域增援（R6 后续 · S15 深化，Session 260）
  reinforceChanceBase: 0.3,
  reinforceChancePerHeldCounty: 0.1,
  reinforceChanceCap: 0.7,
  minReinforceTroops: 1_000,
  maxReinforceArmies: 2,
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
    // R6 后续 · S15 深化（Session 260）：郡域增援 —— 该 AI 势力为郡域守方时，
    // 评估是否从郡治大地图城市编成增援 Army 直接入场（不走大地图行军）。
    // 置于常规出征之前（守土优先）：增援军 phase='garrison' 不占 activeFronts 名额，
    // 常规出征决策仍可用双线名额；但郡治城兵力被增援占用后该月不再作出征源。
    s = maybeReinforceCommandery(s, f.id, decisionRng);
    s = aiMilitaryTurn(s, f.id, resolutionRng, decisionRng);
  }
  return s;
}

/**
 * 郡域增援决策（R6 后续 · S15 深化，Session 260）。
 *
 * 条件链（任一不满足即返回原 state，**RNG 零消费**，保持既有 AI 军事流确定性）：
 *   1. `activeBattlefieldInstance` 存在且该 AI 势力为守方（seat.rulerFactionId）；
 *   2. 郡域内守方 Army 数 < `maxReinforceArmies`（2）；
 *   3. 模板可解析且郡治大地图城市（worldCityId）仍属该势力；
 *   4. 郡治城可调兵力（troops - 动态守备 requiredReserve）≥ `minReinforceTroops`；
 *   5. `decisionRng()` < 增援概率（基础 0.3 + 攻方每占 1 县 +0.1，上限 0.7）。
 *
 * 触发后：`startCampaignForFaction` 从郡治城编成（扣城兵力/粮草、武将 IN_BATTLE），
 * 新 Army 置 phase='garrison'（不走大地图行军），直接入场：
 *   - `inst.armyIds` 追加；
 *   - 部署到守方纵深前沿县（`defenderEntryNodeIds` 中首个未被攻方占领者；
 *     全被占则部署 seat），`nodeStates[].armyIds` 与 `dynamicSituation.deployments`
 *     同步（位置一致性，见 `docs/25-bf-p2-design.md` §2.6.4）。
 * 设计真源：`docs/25-bf-p2-design.md` §2.6.4；`docs/12-system-map.md` S15。
 */
export function maybeReinforceCommandery(
  state: GameState,
  factionId: number,
  decisionRng: () => number,
): GameState {
  const inst = state.activeBattlefieldInstance;
  if (!inst) return state;
  const seat = inst.nodeStates.find((n) => n.nodeId === inst.targetSeatNodeId);
  if (seat?.rulerFactionId !== factionId) return state;

  const defenderArmyCount = state.campaignArmies.filter(
    (army) => army.factionId === factionId && resolveArmyCountyNodeId(inst, army.id) != null,
  ).length;
  if (defenderArmyCount >= AI_MILITARY_CONFIG.maxReinforceArmies) return state;

  const template = getCommanderyTemplateByTemplateId(inst.templateId);
  if (template == null) return state;
  const seatCityId = template.bundle.commanderies[0]?.worldCityId;
  if (seatCityId == null) return state;
  const from = state.cities[seatCityId];
  if (!from || from.ruler !== factionId) return state;
  const reserve = requiredReserve(state, factionId, seatCityId);
  const available = from.troops - reserve;
  if (available < AI_MILITARY_CONFIG.minReinforceTroops) return state;

  // 增援概率：攻方（玩家）占领县越多，守方越急
  const heldByAttacker = inst.nodeStates.filter(
    (n) => n.rulerFactionId === state.playerFactionId,
  ).length;
  const chance = Math.min(
    AI_MILITARY_CONFIG.reinforceChanceCap,
    AI_MILITARY_CONFIG.reinforceChanceBase +
      heldByAttacker * AI_MILITARY_CONFIG.reinforceChancePerHeldCounty,
  );
  if (decisionRng() >= chance) return state;

  const commander = pickCommander(state, factionId, seatCityId);
  if (!commander) return state;
  // 出征上限（docs/04 §7.5 + 6.2 带兵+，Session 265）：AI 与玩家同规则
  const troopCount = Math.min(
    available,
    Math.max(AI_MILITARY_CONFIG.minReinforceTroops, Math.floor(available * 0.6)),
    formationTroopCap(commander),
  );
  const food = Math.min(from.food, troopCount * 3);
  const started = startCampaignForFaction(state, {
    fromNodeId: seatCityId,
    targetNodeId: seatCityId,
    commanderId: commander.id,
    subCommanderIds: [],
    unitType: UnitType.LIGHT_INFANTRY,
    formation: FormationType.SQUARE,
    troopCount,
    food,
  }, factionId, { skipTargetValidation: true, phase: 'garrison' });
  const army = started.army;
  // 增援军不走大地图行军：startCampaignForFaction 以 phase='garrison'、path=[] 编成

  // 入场：部署到守方纵深前沿县（未被攻方占领者优先，全被占则 seat）
  const deployNodeId =
    template.defenderEntryNodeIds.find((nodeId) => {
      const node = inst.nodeStates.find((n) => n.nodeId === nodeId);
      return node && node.rulerFactionId !== state.playerFactionId;
    }) ?? inst.targetSeatNodeId;
  const nodeStates = inst.nodeStates.map((n) =>
    n.nodeId === deployNodeId ? { ...n, armyIds: [...n.armyIds, army.id] } : n,
  );
  const newInst: typeof inst = {
    ...inst,
    armyIds: [...inst.armyIds, army.id],
    nodeStates,
    dynamicSituation: inst.dynamicSituation
      ? {
          ...inst.dynamicSituation,
          deployments: [
            ...(inst.dynamicSituation.deployments ?? []),
            { armyId: army.id, nodeId: deployNodeId },
          ],
        }
      : inst.dynamicSituation,
  };

  const factionName = state.factions[factionId]?.name ?? '某军';
  return pushLog(
    { ...started.state, activeBattlefieldInstance: newInst },
    'ai_war_report',
    `【军情】${factionName}命${commander.name}率${troopCount}兵增援${template.label}（部署 ${deployNodeId}）`,
  );
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
      // 暗渡陈仓明修：守军不得轻离此城出征
      if (isSecretCrossingGarrisonHold(s, from.id)) continue;
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
          // 出征上限（docs/04 §7.5 + 6.2 带兵+，Session 265）：AI 与玩家同规则
          const troopCount = Math.min(
            from.troops - reserve,
            Math.max(AI_MILITARY_CONFIG.minCampaignTroops, Math.floor(from.troops * troopShare)),
            formationTroopCap(commander),
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
