// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 战役层引擎最小切片（05 §十二~§十七）
 * - 编成 CampaignArmy（主将+副将+参谋+Squad 五部阵位）
 * - 多回合行军（沿道路节点逐节点推进）
 * - 自动战斗算法（§17 战力公式 + 多回合推演 + 单挑事件）
 * - 围城状态机（围困/劝降/强攻/撤围）
 * - 战后结算（占城/残兵回流/武将伤亡）
 *
 * 简化/占位标注（0-A 最小切片）：
 * - 设施建造：仅记录结构，建造回合扣减简化为即时（大型器械后续接§15.2）
 * - 参谋主动策略：激励/陷阱/撤退休整已实现基础效果，数值简化
 * - 总军师态势：仅记录字段，态势加成暂未接入自动战斗公式（后置）
 * - 单挑事件：概率触发 + 简单胜负判定（复用 duel 引擎的 createDuel/runDuelToCompletion
 *   需 BattleState 上下文，此处简化为基于武力的快速判定，完整单挑演出后置）
 * - 郡国归属算法（§17.6）：0-A 30 城 = 30 郡国各 1 治所，占治所 = 全郡归属（简化规则）
 */
import {
  OfficerStatus,
  areCitiesRoadAdjacent,
  aristocracyDefenderMoralePenalty,
  applyOrganizationExecution,
  armsCombatMultiplier,
  defenderMilitia,
  formationTroopCap,
  isFriendlyOrBetter,
  isHostileOrAtWar,
  roadNeighbors,
  meritEffects,
  meritLevelFor,
  meritStatBonus,
  resolveFormationContribution,
  UnitType,
  PolicyType,
  POLICY_PREPARE_FIRST_ROUND_MUL,
  POLICY_PREPARE_INCOMING_MUL,
  POLICY_SCORCHED_FOOD_COST_MUL,
  POLICY_STRIKE_WEAK_HIT_MUL,
  POLICY_STRIKE_WEAK_OTHER_MUL,
  FAMILY_CAPTURE_MORALE_HIT,
  buildPendingFamilyTreatment,
  citiesShockedByFamilyCapture,
  familyRepressionAttackMultiplier,
  factionHasActivePolicy,
  isScorchedCity,
  weakestHostileCityId,
  type AutoBattleResult,
  type CampaignArmy,
  type CampaignFormationOptions,
  type CampaignNode,
  type CampStructure,
  type Formation,
  type GameState,
  type Officer,
  type StructureType,
} from '@leh/shared';
import { clearCityCounterOnCapture } from './spy.js';
import { lootBeautyOnCapture } from './beauty.js';
import { syncFactionResources } from './economy.js';
import { equipBonusFor } from './items.js';
import { grantMeritTo } from './meritGrant.js';
import { FAME_CAPTURE_CITY, FAME_OCCUPY_CITY, FAME_ANNIHILATE_FACTION, grantFame } from './factionPolitics.js';
import {
  MERIT_ANNIHILATE_FACTION,
  MERIT_CAPTURE_CITY,
  MERIT_DEFEND_CITY,
  MERIT_FIELD_ANNIHILATE,
  MERIT_FIELD_ROUT,
  pickDefenderCommander,
} from './militaryMerit.js';
import { applyCapturedRelations, applyJointExpeditionRelations } from './relations.js';
import { getUndermineArmyModifiers, getSecretCrossingBattleMul, getStrikeWhileHotFirstHitMul, getLureTigerWallMul, getSwapPillarLeadershipPenalty } from './plot.js';

// 功绩获取数值（docs/04 §6.1 外交条；固定值不消耗权威 RNG，待平衡）
const MERIT_SIEGE_SURRENDER = 30;

// ====== 常量 ======

export const MIN_CAMPAIGN_TROOPS = 1000;
export const GARRISON_RESERVE = 500;
/** 每 100 兵力每回合耗粮 × 地形系数 */
export const FOOD_PER_100_PER_TURN = 3;
/** 行军每回合疲劳增量 */
export const MARCH_FATIGUE = 10;
/** 驻守每回合疲劳恢复 */
export const GARRISON_FATIGUE_RECOVER = 10;
/** 行军每回合士气衰减 */
export const MARCH_MORALE_DECAY = 2;
/** 组织度行军衰减 */
export const MARCH_ORG_DECAY = 1;
/** 驻守组织度恢复 */
export const GARRISON_ORG_RECOVER = 5;

// ====== 节点初始化 ======

/** 从 GameState.cities 生成战役节点（0-A：30 治所 = 30 节点） */
export function buildCampaignNodes(state: GameState): CampaignNode[] {
  const cities = Object.values(state.cities);
  return cities.map((c) => {
    const adjacent = roadNeighbors(c.id);
    const wall = c.stats.wall ?? 0;
    return {
      id: c.id,
      name: c.name,
      type: 'major_city' as const,
      x: c.x,
      y: c.y,
      ruler: c.ruler,
      commanderyId: c.id, // 0-A: 一城一郡国
      adjacentNodeIds: adjacent,
      garrison: c.troops,
      wallDurability: wall * 100, // 城墙耐久 = 城防×100（0-A 简化）
      maxWallDurability: wall * 100,
      farm: c.stats.farm,
      commerce: c.stats.commerce,
      population: c.population,
      morale: c.stats.morale ?? 70,
    };
  });
}

/** 同步城池最新状态回节点（garrison/ruler/wall 等随内政/征兵变化） */
export function syncNodesFromCities(state: GameState): CampaignNode[] {
  const existing = state.campaignNodes.length > 0
    ? new Map(state.campaignNodes.map((n) => [n.id, n]))
    : new Map<number, CampaignNode>();
  return Object.values(state.cities).map((c) => {
    const prev = existing.get(c.id);
    const wall = c.stats.wall ?? 0;
    return {
      ...(prev ?? { commanderyId: c.id, type: 'major_city' as const }),
      id: c.id,
      name: c.name,
      x: c.x,
      y: c.y,
      ruler: c.ruler,
      adjacentNodeIds: roadNeighbors(c.id),
      garrison: c.troops,
      wallDurability: wall * 100,
      maxWallDurability: wall * 100,
      farm: c.stats.farm,
      commerce: c.stats.commerce,
      population: c.population,
      morale: c.stats.morale ?? 70,
    } satisfies CampaignNode;
  });
}

// ====== 编成 ======

function pushLog(state: GameState, type: string, message: string): GameState {
  return {
    ...state,
    actionLog: [
      { year: state.currentYear, month: state.currentMonth, type, message },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

function genArmyId(state: GameState, commanderId: number): string {
  const prefix = `army-${commanderId}-${state.currentYear}-${state.currentMonth}`;
  let sequence = 1;
  while (state.campaignArmies.some((army) => army.id === `${prefix}-${sequence}`)) {
    sequence += 1;
  }
  return `${prefix}-${sequence}`;
}

function officerName(state: GameState, id: number): string {
  return state.officers[id]?.name ?? `武将${id}`;
}

/** 校验编成选项合法性（目标侧 + 源侧；顺序贴近原实现：target 校验先于主将等源侧校验） */
export function validateFormation(
  state: GameState,
  opts: CampaignFormationOptions,
  actingFactionId: number = state.playerFactionId,
): void {
  // 顺序贴近原实现：出发节点 → 目标侧 → 主将等源侧（错误优先级与历史一致）
  const from = state.cities[opts.fromNodeId];
  if (!from) throw new Error('出发节点不存在');
  if (from.ruler !== actingFactionId) throw new Error('出发节点非己方');
  validateFormationTarget(state, opts, actingFactionId);
  validateFormationSourceRest(state, opts, actingFactionId);
}

/** 源侧校验：出发城/主将/副将/参谋/兵力/携粮（非行军编成如郡域增援同样适用）。 */
export function validateFormationSource(
  state: GameState,
  opts: CampaignFormationOptions,
  actingFactionId: number = state.playerFactionId,
): void {
  const from = state.cities[opts.fromNodeId];
  if (!from) throw new Error('出发节点不存在');
  if (from.ruler !== actingFactionId) throw new Error('出发节点非己方');
  validateFormationSourceRest(state, opts, actingFactionId);
}

/** 源侧后段：主将/副将/参谋/兵力/携粮（不含出发节点校验，供完整与源侧校验复用）。 */
function validateFormationSourceRest(
  state: GameState,
  opts: CampaignFormationOptions,
  actingFactionId: number,
): void {
  const from = state.cities[opts.fromNodeId];

  const commander = state.officers[opts.commanderId];
  if (!commander) throw new Error('主将不存在');
  if (commander.faction !== actingFactionId) throw new Error('主将非己方');
  if (commander.status !== OfficerStatus.ACTIVE) throw new Error('主将不可出征');
  if (commander.location !== opts.fromNodeId) throw new Error('主将须在出发节点');
  if (state.campaignArmies.some((army) =>
    [army.commanderId, ...army.subCommanderIds, army.advisorId, army.subAdvisorId].includes(opts.commanderId)
  )) throw new Error('主将已在其他战役 Army 中');

  for (const sid of opts.subCommanderIds) {
    const sub = state.officers[sid];
    if (!sub) throw new Error(`副将 ${sid} 不存在`);
    if (sub.faction !== actingFactionId) throw new Error(`${sub.name} 非己方`);
    if (sub.location !== opts.fromNodeId) throw new Error(`${sub.name} 须在出发节点`);
  }

  if (opts.advisorId != null) {
    const adv = state.officers[opts.advisorId];
    if (!adv) throw new Error('参谋不存在');
    if (adv.faction !== actingFactionId) throw new Error('参谋非己方');
    if (adv.stats.intelligence < 85) throw new Error('参谋智力须 ≥85（§5.5.8）');
    if (adv.location !== opts.fromNodeId) throw new Error('参谋须在出发节点');
  }

  if (!Number.isFinite(opts.troopCount) || opts.troopCount < MIN_CAMPAIGN_TROOPS) {
    throw new Error(`出征兵力至少 ${MIN_CAMPAIGN_TROOPS}`);
  }
  if (opts.troopCount > from.troops) throw new Error('出征兵力超过节点驻军');
  // 出征上限（docs/04 §7.5 + 6.2 带兵+，Session 265）：min(驻军, 5000 + 武官等级×500 + 功绩带兵+)
  const cap = Math.min(from.troops, formationTroopCap(commander));
  if (opts.troopCount > cap) {
    throw new Error(
      `${commander.name} 出征上限 ${cap} 兵（功绩带兵+ 与武官等级合计），当前 ${opts.troopCount}`,
    );
  }

  if (!Number.isFinite(opts.food) || opts.food < 0) throw new Error('携粮数值非法');
  if (opts.food > from.food) throw new Error('携粮超过节点库存');
}

/** 目标侧校验：目标非己方/有主/官道邻接（仅行军编成需要）。 */
export function validateFormationTarget(
  state: GameState,
  opts: CampaignFormationOptions,
  actingFactionId: number = state.playerFactionId,
): void {
  const target = state.cities[opts.targetNodeId];
  if (!target) throw new Error('目标节点不存在');
  if (target.ruler === actingFactionId) throw new Error('目标已是己方');
  if (target.ruler == null) throw new Error('暂不支持攻打无主节点');
  const from = state.cities[opts.fromNodeId];
  if (!areCitiesRoadAdjacent(opts.fromNodeId, opts.targetNodeId)) {
    throw new Error(`${from?.name ?? '出发城'} 与 ${target.name} 无官道直达（战役层首跳须邻接）`);
  }
}

/** 计算副将数上限（§5.5.1 简化：武官官职 + 爵位） */
function subCommanderLimit(state: GameState, commanderId: number): number {
  const o = state.officers[commanderId];
  if (!o) return 0;
  // 君主 4 · 大将军 3 · 将军 2 · 校尉 1 · 其它 1
  const ruler = Object.values(state.factions).find((f) => f.rulerId === commanderId);
  if (ruler) return 4;
  switch (o.militaryPosition) {
    case 'grandGeneral': return 3;
    case 'general': return 2;
    case 'colonel':
    case 'captain':
    case 'none':
    default:
      return 1;
  }
}

/** 编成 Squad 五部阵位（简化：主将中军，副将按序填先锋/左/右/后卫） */
function buildSquads(
  opts: CampaignFormationOptions,
): CampaignArmy['squads'] {
  const positions: CampaignArmy['squads'] = [];
  // 主将中军
  positions.push({
    officerId: opts.commanderId,
    role: 'main',
    position: 'center',
    unitType: opts.unitType,
    troops: Math.floor(opts.troopCount * 0.5),
    morale: 80,
  });
  const subs = opts.subCommanderIds.slice(0, 4);
  const slots: Array<'vanguard' | 'left' | 'right' | 'rearguard'> = [
    'vanguard', 'left', 'right', 'rearguard',
  ];
  const perSub = Math.floor((opts.troopCount * 0.5) / Math.max(1, subs.length));
  subs.forEach((sid, i) => {
    positions.push({
      officerId: sid,
      role: 'sub',
      position: slots[i] ?? 'rearguard',
      unitType: opts.unitType,
      troops: perSub,
      morale: 75,
    });
  });
  return positions;
}

/** 出征编成：扣出发节点兵力/粮草，生成 CampaignArmy 进入行军阶段 */
export function startCampaign(
  state: GameState,
  opts: CampaignFormationOptions,
): { state: GameState; army: CampaignArmy } {
  return startCampaignForFaction(state, opts, state.playerFactionId);
}

/** 服务端权威入口：为指定势力创建 CampaignArmy；玩家 API 仍走 startCampaign。 */
export function startCampaignForFaction(
  state: GameState,
  opts: CampaignFormationOptions,
  actingFactionId: number = state.playerFactionId,
  flags: { skipTargetValidation?: boolean; phase?: 'marching' | 'garrison' } = {},
): { state: GameState; army: CampaignArmy } {
  if (flags.skipTargetValidation) {
    validateFormationSource(state, opts, actingFactionId);
  } else {
    validateFormation(state, opts, actingFactionId);
  }

  const from = state.cities[opts.fromNodeId];
  const limit = subCommanderLimit(state, opts.commanderId);
  if (opts.subCommanderIds.length > limit) {
    throw new Error(`副将数超限（${officerName(state, opts.commanderId)} 上限 ${limit}）`);
  }

  const troops = Math.floor(opts.troopCount);
  const food = Math.floor(opts.food);
  const commander = state.officers[opts.commanderId];
  const undermine = getUndermineArmyModifiers(state, opts.fromNodeId);
  const baseMorale = 85 - (undermine?.moralePenalty ?? 0);

  // 扣出发城兵力/粮草
  const cities = {
    ...state.cities,
    [opts.fromNodeId]: {
      ...from,
      troops: from.troops - troops,
      food: from.food - food,
    },
  };

  const army: CampaignArmy = {
    id: genArmyId(state, opts.commanderId),
    factionId: actingFactionId,
    name: `${commander.name}军`,
    commanderId: opts.commanderId,
    subCommanderIds: opts.subCommanderIds,
    advisorId: opts.advisorId,
    subAdvisorId: opts.subAdvisorId,
    unitType: opts.unitType,
    formation: opts.formation,
    currentNodeId: opts.fromNodeId,
    targetNodeId: opts.targetNodeId,
    path: flags.phase === 'garrison' ? [] : [opts.targetNodeId],
    phase: flags.phase ?? 'marching',
    troops,
    maxTroops: troops,
    food,
    maxFood: Math.max(food, troops * 3),
    morale: Math.max(1, baseMorale),
    organization: 80,
    experience: 0,
    fatigue: 0,
    squads: buildSquads(opts),
    structures: [],
    fromNodeId: opts.fromNodeId,
  };

  // 主将与副将/参谋标记为 IN_BATTLE 位置 → 移至目标节点（行军中视为"在前线"）
  const officers = { ...state.officers };
  const allMilIds = [opts.commanderId, ...opts.subCommanderIds];
  if (opts.advisorId != null) allMilIds.push(opts.advisorId);
  if (opts.subAdvisorId != null) allMilIds.push(opts.subAdvisorId);
  for (const oid of allMilIds) {
    if (officers[oid]) {
      officers[oid] = { ...officers[oid], location: opts.fromNodeId };
    }
  }
  // 从出发城 officers 列表移除主将/副将/参谋
  cities[opts.fromNodeId] = {
    ...cities[opts.fromNodeId],
    officers: cities[opts.fromNodeId].officers.filter((id) => !allMilIds.includes(id)),
  };

  let next: GameState = {
    ...state,
    cities,
    officers,
    campaignArmies: [...state.campaignArmies, army],
    campaignNodes: syncNodesFromCities({ ...state, cities }),
  };
  next = applyJointExpeditionRelations(next, allMilIds);
  const undermineNote = undermine
    ? `；釜底抽薪：士气−${undermine.moralePenalty}、行军粮耗×${undermine.foodCostMul}`
    : '';
  next = pushLog(
    next,
    'campaign_start',
    `${army.name} 自 ${from.name} 出征 ${targetName(state, opts.targetNodeId)}（兵 ${troops}，粮 ${food}${undermineNote}）`,
  );
  return { state: next, army };
}

function targetName(state: GameState, id: number): string {
  return state.cities[id]?.name ?? `节点${id}`;
}

// ====== 行军 ======

/** 规划路径（0-A：道路邻接 BFS，取最短路径） */
export function planPath(_state: GameState, fromId: number, targetId: number): number[] {
  if (fromId === targetId) return [];
  const visited = new Set<number>([fromId]);
  const queue: Array<{ id: number; path: number[] }> = [{ id: fromId, path: [] }];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of roadNeighbors(cur.id)) {
      if (visited.has(next)) continue;
      visited.add(next);
      const newPath = [...cur.path, next];
      if (next === targetId) return newPath;
      queue.push({ id: next, path: newPath });
    }
  }
  return [];
}

/** 行军指令：设置新目标，重算路径 */
export function orderMarch(state: GameState, armyId: string, targetNodeId: number): GameState {
  const army = state.campaignArmies.find((a) => a.id === armyId);
  if (!army) throw new Error('Army 不存在');
  if (army.factionId !== state.playerFactionId) throw new Error('非己方 Army');
  if (army.phase !== 'marching' && army.phase !== 'garrison') {
    throw new Error(`当前阶段（${army.phase}）不可行军`);
  }
  const target = state.cities[targetNodeId];
  if (!target) throw new Error('目标节点不存在');
  if (target.ruler === state.playerFactionId && targetNodeId !== army.currentNodeId) {
    // 己方城：调遣，到达后驻守
  }
  const path = planPath(state, army.currentNodeId, targetNodeId);
  if (path.length === 0 && army.currentNodeId !== targetNodeId) {
    throw new Error('无可达路径');
  }
  const armies = state.campaignArmies.map((a) =>
    a.id === armyId
      ? {
          ...a,
          targetNodeId,
          path,
          phase: 'marching' as const,
        }
      : a,
  );
  return pushLog(
    { ...state, campaignArmies: armies },
    'campaign_march',
    `${army.name} 奉令开赴 ${target.name}（路径 ${path.length} 节点）`,
  );
}

/** 回合推进：所有 marching 状态 Army 前进一节点 + 补给消耗 + 事件触发 */
export function tickCampaignMarch(state: GameState): GameState {
  let armies = [...state.campaignArmies];
  let cities = { ...state.cities };
  const officers = { ...state.officers };
  const logs: string[] = [];

  for (let i = 0; i < armies.length; i++) {
    const a = armies[i];
    if (!a || a.phase !== 'marching') continue;
    if (a.path.length === 0) {
      // 到达目标 → 视目标归属决定驻守/围城/野战
      const target = state.cities[a.targetNodeId ?? a.currentNodeId];
      if (
        target &&
        target.ruler != null &&
        target.ruler !== a.factionId &&
        isHostileOrAtWar(state.diplomacy, a.factionId, target.ruler)
      ) {
        armies[i] = { ...a, phase: 'sieging', currentNodeId: a.targetNodeId ?? a.currentNodeId };
        logs.push(`${a.name} 抵达 ${target.name}，进入围城`);
      } else {
        armies[i] = { ...a, phase: 'garrison', currentNodeId: a.targetNodeId ?? a.currentNodeId };
        const stayLabel =
          target?.ruler === a.factionId
            ? '驻守己方城池'
            : target?.ruler != null &&
                isFriendlyOrBetter(state.diplomacy, a.factionId, target.ruler)
              ? '暂驻友方城池'
              : '暂驻非敌对城池';
        logs.push(`${a.name} 到达 ${target?.name ?? '目的地'}，${stayLabel}待命`);
      }
      continue;
    }

    const nextNodeId = a.path[0];
    const restPath = a.path.slice(1);
    const targetCity = state.cities[nextNodeId];

    // 补给消耗
    const terrainMul = 1.0; // 0-A 简化：平原
    const undermineMul =
      a.fromNodeId != null
        ? (getUndermineArmyModifiers(state, a.fromNodeId)?.foodCostMul ?? 1)
        : 1;
    const scorchedMul =
      targetCity &&
      isScorchedCity(state, nextNodeId) &&
      targetCity.ruler != null &&
      targetCity.ruler !== a.factionId
        ? POLICY_SCORCHED_FOOD_COST_MUL
        : 1;
    const foodCost = Math.max(
      1,
      Math.floor((a.troops / 100) * FOOD_PER_100_PER_TURN * terrainMul * undermineMul * scorchedMul),
    );
    let food = a.food - foodCost;
    let morale = a.morale - MARCH_MORALE_DECAY;
    let organization = a.organization - MARCH_ORG_DECAY;
    let fatigue = a.fatigue + MARCH_FATIGUE;

    let phase: CampaignArmy['phase'] = 'marching';
    let siegeState = a.siegeState;
    let msg: string | null = null;

    // 缺粮效果
    if (food <= 0) {
      food = 0;
      morale -= 15;
      organization -= 10;
      msg = `${a.name} 缺粮，士气大降`;
    }

    // 目标节点有敌方 Army → 野战
    const enemyArmy = armies.find(
      (other) =>
        other.id !== a.id &&
        other.factionId !== a.factionId &&
        isHostileOrAtWar(state.diplomacy, a.factionId, other.factionId) &&
        other.currentNodeId === nextNodeId &&
        other.phase !== 'retreating',
    );
    // 目标节点为敌方城 → 围城
    const isEnemyCity =
      targetCity &&
      targetCity.ruler != null &&
      targetCity.ruler !== a.factionId &&
      isHostileOrAtWar(state.diplomacy, a.factionId, targetCity.ruler);

    // 经过己方城 → 自动补粮（取该城库存 50%）
    if (targetCity && targetCity.ruler === a.factionId && restPath.length > 0) {
      const refill = Math.floor(targetCity.food * 0.5);
      food = Math.min(a.maxFood, food + refill);
      cities = {
        ...cities,
        [nextNodeId]: { ...targetCity, food: targetCity.food - refill },
      };
      msg = `${a.name} 经 ${targetCity.name} 补给 +${refill} 粮`;
    }

    if (enemyArmy) {
      phase = 'engaged';
      msg = `${a.name} 在 ${targetCity?.name ?? nextNodeId} 与 ${enemyArmy.name} 遭遇，进入野战`;
    } else if (isEnemyCity && restPath.length === 0) {
      phase = 'sieging';
      siegeState = {
        wallDurability: (targetCity.stats.wall ?? 0) * 100,
        maxWallDurability: (targetCity.stats.wall ?? 0) * 100,
        gateDurability: 100,
        siegeTurns: 0,
        attackerStructures: [],
        defenderBonus: 0,
        surrenderChance: 10,
      };
      msg = `${a.name} 兵临 ${targetCity.name}，开始围城`;
    }

    armies[i] = {
      ...a,
      currentNodeId: nextNodeId,
      path: restPath,
      phase,
      food,
      morale: Math.max(0, Math.min(100, morale)),
      organization: Math.max(0, Math.min(100, organization)),
      fatigue: Math.max(0, Math.min(100, fatigue)),
      siegeState,
      targetNodeId: restPath.length > 0 ? a.targetNodeId : nextNodeId,
    };

    if (msg) logs.push(msg);
  }

  let next: GameState = { ...state, campaignArmies: armies, cities, officers };
  for (const m of logs) next = pushLog(next, 'campaign_march_tick', m);
  return next;
}

// ====== 自动战斗算法（§17） ======

/** 兵种基础战力系数（§17.2 unitPower 表） */
function unitPower(unitType: UnitType): number {
  switch (unitType) {
    case 'lightInfantry': return 1.0;
    case 'heavyInfantry': return 1.3;
    case 'spearman': return 1.2;
    case 'archer': return 0.9;
    case 'crossbowman': return 1.1;
    case 'lightCavalry': return 1.2;
    case 'heavyCavalry': return 1.6;
    case 'horseArcher': return 1.0;
    case 'lightNavy': return 0.8;
    case 'mediumNavy': return 1.2;
    case 'heavyNavy': return 1.5;
    default: return 1.0;
  }
}

/** 经验等级系数 Lv1~7 */
function expLevelCoeff(xp: number): number {
  const lv = Math.min(7, 1 + Math.floor(xp / 400));
  return 0.8 + (lv - 1) * 0.083; // Lv1→0.8, Lv7→1.3
}

// ====== 自动战斗阵型贡献（FM-P3 剩余 · 唯一量纲 = tiers[0] 点值） ======

/**
 * 自动战斗阵型目录注入（服务端启动时 `setAutoFormationCatalog(staticData.formations)`）。
 * null（纯单测/脚本未注入）回退中性（0，无阵型修正），不携带第二套数值表。
 */
let AUTO_FORMATION_CATALOG: readonly Formation[] | null = null;

/** 注入自动战斗阵型目录（null 恢复中性回退）。 */
export function setAutoFormationCatalog(catalog: readonly Formation[] | null): void {
  AUTO_FORMATION_CATALOG = catalog;
}

/** 自动战斗等价性系数（与标准模式同源：1 点 ≈ 10% 战力；计划 §5.2 同源消费、不叠加） */
const AUTO_FORM_ATK_GAIN = 0.1;
const AUTO_FORM_DEF_GAIN = 0.1;
/** 五部侧击 +10%（05 §13.3）：己方有左/右翼 Squad 视为对敌侧翼施加侧击 */
const SQUAD_FLANK_BONUS = 0.1;

/** 五部侧击：左/右翼位存在 → 自动战斗 +10%（0-A 简化：不判敌展开结构，攻防对称）。 */
export function squadFlankBonus(squads: CampaignArmy['squads']): number {
  return squads.some((s) => s.position === 'left' || s.position === 'right') ? SQUAD_FLANK_BONUS : 0;
}

/**
 * 自动战斗阵型战力修正：攻/防点值（正面增量按组织度执行档缩放，负修正原值保留）合并为加性
 * 战力修正 + 五部侧击。mobility/range 点值不参与自动战力（自动无走向/射程概念）。
 * 组织度执行档与全局 `orgCoeff`（战备状态）分项解释，不重复乘算（计划 §4.4）。
 * 导出供战报复算/客户端解释复算与验证脚本。
 */
export function autoFormationMods(
  formationId: number,
  organization: number,
  squads: CampaignArmy['squads'],
): number {
  const catalog = AUTO_FORMATION_CATALOG;
  if (!catalog) return 0;
  const contrib = resolveFormationContribution(catalog, formationId, organization);
  const exec = contrib.organizationExecution;
  const atkEff = applyOrganizationExecution(contrib.attack, exec);
  const defEff = applyOrganizationExecution(contrib.defense, exec);
  return atkEff * AUTO_FORM_ATK_GAIN + defEff * AUTO_FORM_DEF_GAIN + squadFlankBonus(squads);
}

interface ArmyPowerInput {
  troops: number;
  unitType: UnitType;
  commander: Officer | undefined;
  subCommanders: Officer[];
  advisor?: Officer;
  morale: number;
  organization: number;
  experience: number;
  fatigue: number;
  /** 阵型战力修正（FM-P3 剩余：攻防点值 + 五部侧击；缺省 0 等价无阵型加成） */
  formationMod?: number;
  /** 攻城器械加成 0~0.5 */
  siegeEquipBonus?: number;
  /** 城墙惩罚 0~0.4 */
  wallPenalty?: number;
  /** 计谋修正乘数（默认 1） */
  stratagemMod?: number;
  /** S27 兵装战力修正乘数（默认 1）：武装充足 +5%、缺口过半 −10%（docs/08 §十七） */
  armsMod?: number;
}

/** §17.2 战力公式 */
function computePower(inp: ArmyPowerInput): number {
  const base = inp.troops * unitPower(inp.unitType);

  // 功绩+装备属性加成计入有效属性（Session 265 数值消费 + Session 266 装备）
  const effStat = (o: Officer, stat: 'leadership' | 'war' | 'intelligence'): number =>
    o.stats[stat] + meritStatBonus(o, stat) + (equipBonusFor(o)[stat] ?? 0);

  const mainMod = inp.commander
    ? 1 + (effStat(inp.commander, 'leadership') + effStat(inp.commander, 'war') / 2) / 200
    : 1;
  const subMod = inp.subCommanders.length > 0
    ? inp.subCommanders.reduce((s, o) => s + effStat(o, 'leadership') * 0.3, 0) / inp.subCommanders.length
    : 0;
  const advisorMod = inp.advisor ? effStat(inp.advisor, 'intelligence') / 200 : 0;
  const formationMod = inp.formationMod ?? 0; // FM-P3：攻防点值 + 五部侧击（性加项，不重复乘 orgCoeff）
  const commandMod = mainMod + subMod + advisorMod + formationMod;

  const moraleCoeff = 0.4 + (inp.morale / 100) * 0.6;
  const orgCoeff = 0.5 + (inp.organization / 100) * 0.7;
  const expCoeff = expLevelCoeff(inp.experience);
  const fatigueCoeff = 1.0 - inp.fatigue / 200;
  const statusMod = moraleCoeff * orgCoeff * expCoeff * fatigueCoeff;

  const envMod = 1.0; // 0-A 简化：平原/晴
  const stratagemMod = inp.stratagemMod ?? 1.0;
  const armsMod = inp.armsMod ?? 1.0;
  const siegeMod = 1.0 + (inp.siegeEquipBonus ?? 0) - (inp.wallPenalty ?? 0);

  return base * commandMod * statusMod * envMod * stratagemMod * siegeMod * armsMod;
}

interface BattleSide {
  army: CampaignArmy;
  commander: Officer | undefined;
  subCommanders: Officer[];
  advisor?: Officer;
  unitType: UnitType;
  /** 攻城战：攻方=器械加成，守方=城墙加成 */
  siegeEquipBonus?: number;
  wallPenalty?: number;
}

/** §17.4 单挑事件快速判定（简化版：基于武力的随机单挑） */
function maybeDuel(
  atk: BattleSide,
  def: BattleSide,
  rng: () => number,
): { triggered: boolean; attacker: number; defender: number; winner: number; description: string } {
  const atkCmd = atk.commander;
  const defCmd = def.commander;
  if (!atkCmd || !defCmd) return { triggered: false, attacker: 0, defender: 0, winner: 0, description: '' };
  const warDiff = Math.abs(atkCmd.stats.war - defCmd.stats.war);
  let chance = 0.05 + warDiff / 10;
  // 吕布加成（虓虎之勇）
  if (atkCmd.id === 5 || defCmd.id === 5) chance += 0.15;
  // 守城方低士气
  if (def.army.morale <= 40) chance += 0.05;
  if (rng() > chance) return { triggered: false, attacker: 0, defender: 0, winner: 0, description: '' };

  // 胜负：武力高者胜 + 10% 概率爆冷
  const atkWar = atkCmd.stats.war + atkCmd.hidden.power / 10;
  const defWar = defCmd.stats.war + defCmd.hidden.power / 10;
  const upset = rng() < 0.1;
  const atkWin = upset ? atkWar < defWar : atkWar > defWar;
  const winnerId = atkWin ? atkCmd.id : defCmd.id;
  // 5% 概率被斩（仅败方）
  const killed = rng() < 0.05;
  const desc = killed
    ? `${atkCmd.name} 与 ${defCmd.name} 单挑，${winnerId === atkCmd.id ? defCmd.name : atkCmd.name} 被斩！`
    : `${atkCmd.name} 与 ${defCmd.name} 单挑，${winnerId === atkCmd.id ? atkCmd.name : defCmd.name} 胜`;
  return { triggered: true, attacker: atkCmd.id, defender: defCmd.id, winner: winnerId, description: desc };
}

/** §17.3 多回合推演 */
export function runAutoBattle(
  state: GameState,
  atkArmy: CampaignArmy,
  defArmy: CampaignArmy | null,
  defCity: { cityId: number; garrison: number; wall: number; commanderId?: number } | null,
  rng: () => number = Math.random,
): AutoBattleResult {
  const atkCmd = state.officers[atkArmy.commanderId];
  const atkSubs = atkArmy.subCommanderIds.map((id) => state.officers[id]).filter(Boolean) as Officer[];
  const atkAdv = atkArmy.advisorId != null ? state.officers[atkArmy.advisorId] : undefined;

  let defCmd: Officer | undefined;
  let defSubs: Officer[] = [];
  let defAdv: Officer | undefined;
  let defTroopsInitial: number;
  let defenderLabel: string;
  let defUnitType: UnitType = UnitType.HEAVY_INFANTRY;
  let wallPenalty = 0;
  let siegeEquipBonus = 0;

  if (defArmy) {
    defCmd = state.officers[defArmy.commanderId];
    defSubs = defArmy.subCommanderIds.map((id) => state.officers[id]).filter(Boolean) as Officer[];
    defAdv = defArmy.advisorId != null ? state.officers[defArmy.advisorId] : undefined;
    defTroopsInitial = defArmy.troops;
    defenderLabel = defArmy.name;
    defUnitType = defArmy.unitType;
  } else if (defCity) {
    // 守城：优先本城守将
    const city = state.cities[defCity.cityId];
    defenderLabel = city?.name ?? `城${defCity.cityId}`;
    // S27 民兵：民心 ≥60 时 floor(人口 × 0.02 × 民心/100)（docs/08 §十七）
    const militia = city
      ? defenderMilitia(city.population, city.stats.morale ?? 70)
      : 0;
    defTroopsInitial = defCity.garrison + militia;
    wallPenalty = Math.min(0.4, defCity.wall / 1000 * 0.4) || 0.3;
    wallPenalty *= getLureTigerWallMul(state, defCity.cityId);
    // 攻城器械：从 Army structures 取已完工最高级
    const built = atkArmy.structures.filter((s) => s.buildProgress >= 1);
    if (built.some((s) => s.type === 'catapult')) siegeEquipBonus = 0.5;
    else if (built.some((s) => s.type === 'ram')) siegeEquipBonus = 0.3;
    else if (built.some((s) => s.type === 'siege_tower')) siegeEquipBonus = 0.25;
    else if (built.some((s) => s.type === 'ladder')) siegeEquipBonus = 0.2;
    // 守将：城内武将武力最高者
    if (city) {
      const candidates = city.officers
        .map((id) => state.officers[id])
        .filter((o): o is Officer => !!o && o.faction === city.ruler && o.status === OfficerStatus.ACTIVE);
      candidates.sort((a, b) => b.stats.war - a.stats.war);
      defCmd = candidates[0];
      const leadPen = getSwapPillarLeadershipPenalty(state, defCity.cityId);
      if (defCmd && leadPen > 0) {
        defCmd = {
          ...defCmd,
          stats: { ...defCmd.stats, leadership: Math.max(1, defCmd.stats.leadership - leadPen) },
        };
      }
    }
  } else {
    // 无防守方：默认攻方胜
    return {
      winner: 'attacker',
      rounds: 1,
      battlefield: state.cities[atkArmy.currentNodeId]?.name ?? '',
      attackerCasualties: 0,
      defenderCasualties: 0,
      attackerRemaining: atkArmy.troops,
      defenderRemaining: 0,
      commanderStatus: {},
      duels: [],
      attackerMoraleAfter: atkArmy.morale,
      defenderMoraleAfter: 0,
      prisoners: 0,
      spoils: { gold: 0, food: 0 },
      events: [],
    };
  }

  // S27 兵装战力修正：武装充足（arms×100≥兵力）+5%、缺口过半且已有库存 −10%
  const atkArmsMod = 1 + armsCombatMultiplier(
    state.factions[atkArmy.factionId]?.arms ?? 0,
    atkArmy.troops,
  );
  let defArmsMod = 1;
  if (defArmy) {
    defArmsMod = 1 + armsCombatMultiplier(
      state.factions[defArmy.factionId]?.arms ?? 0,
      defArmy.troops,
    );
  } else if (defCity) {
    const city = state.cities[defCity.cityId];
    if (city?.ruler != null) {
      defArmsMod = 1 + armsCombatMultiplier(
        state.factions[city.ruler]?.arms ?? 0,
        defTroopsInitial,
      );
    }
  }

  const atkSide: BattleSide = { army: atkArmy, commander: atkCmd, subCommanders: atkSubs, advisor: atkAdv, unitType: atkArmy.unitType, siegeEquipBonus, wallPenalty };
  const defSide: BattleSide = { army: defArmy ?? atkArmy, commander: defCmd, subCommanders: defSubs, advisor: defAdv, unitType: defUnitType };

  // L2 暗渡陈仓：对暗渡城方向攻防 ×1.2
  const secretTargetId = defCity?.cityId ?? atkArmy.targetNodeId;
  const secretCrossingMul =
    secretTargetId != null
      ? getSecretCrossingBattleMul(state, atkArmy.factionId, secretTargetId)
      : 1;
  const familyRepressionMul =
    defCity != null
      ? familyRepressionAttackMultiplier(state.cities[defCity.cityId], atkArmy.factionId)
      : 1;

  // L2 趁火打劫：目标势力仍多线交战时，首击伤害 ×1.2（docs/04 §31.5）
  const defenderFactionId = defArmy
    ? defArmy.factionId
    : defCity
      ? (state.cities[defCity.cityId]?.ruler ?? null)
      : null;
  const strikeWhileHotMul =
    defenderFactionId != null
      ? getStrikeWhileHotFirstHitMul(state, atkArmy.factionId, defenderFactionId)
      : 1;

  // FM-P3：自动战斗阵型战力修正（每回合按当回合组织度求值；守城无 Army 时无阵型贡献，
  // 城墙惩罚/wallPenalty 已表达守势，不虚拟守方阵型）
  const atkFormMod = (org: number) => autoFormationMods(atkArmy.formation, org, atkArmy.squads);
  const defFormMod = (org: number) => (defArmy
    ? autoFormationMods(defArmy.formation, org, defArmy.squads)
    : 0);

  let atkTroops = atkArmy.troops;
  let defTroops = defTroopsInitial;
  let atkMorale = atkArmy.morale;
  let defMorale = defArmy?.morale ?? (state.cities[defCity?.cityId ?? 0]?.troopsMorale ?? 70);
  // S27 世家暗通：守方城市世家满意度 <30 → 守军士气 −15%（docs/08 §十七）
  if (!defArmy && defCity) {
    const city = state.cities[defCity.cityId];
    if (city) {
      defMorale = Math.max(0, defMorale * (1 - aristocracyDefenderMoralePenalty(city.cityFactions ?? [])));
    }
  }
  let atkOrg = atkArmy.organization;
  let defOrg = defArmy?.organization ?? 70;

  const events: AutoBattleResult['events'] = [];
  const duels: AutoBattleResult['duels'] = [];
  const commanderStatus: Record<number, 'alive' | 'wounded' | 'captured' | 'killed'> = {};

  const atkInitial = atkArmy.troops;
  const defInitial = defTroopsInitial;

  if (secretCrossingMul > 1) {
    events.push({
      round: 0,
      type: 'stratagem',
      description: `暗渡陈仓：攻防×${secretCrossingMul}`,
    });
  }
  if (familyRepressionMul > 1) {
    events.push({
      round: 0,
      type: 'stratagem',
      description: `家属镇压激怒旧主：攻城战力×${familyRepressionMul.toFixed(1)}`,
    });
  }
  if (defCity && getLureTigerWallMul(state, defCity.cityId) < 1) {
    events.push({
      round: 0,
      type: 'stratagem',
      description: `调虎离山：城防减半`,
    });
  }
  if (defCity && getSwapPillarLeadershipPenalty(state, defCity.cityId) > 0) {
    events.push({
      round: 0,
      type: 'stratagem',
      description: `偷梁换柱：守将统率−${getSwapPillarLeadershipPenalty(state, defCity.cityId)}`,
    });
  }

  // §17.3 模拟回合数
  const atkPower0 = computePower({ ...atkSide, troops: atkTroops, morale: atkMorale, organization: atkOrg, experience: atkArmy.experience, fatigue: atkArmy.fatigue, armsMod: atkArmsMod, formationMod: atkFormMod(atkOrg) }) * secretCrossingMul * familyRepressionMul;
  const defPower0 = defArmy
    ? computePower({ ...defSide, troops: defTroops, morale: defMorale, organization: defOrg, experience: defArmy.experience, fatigue: defArmy.fatigue, armsMod: defArmsMod, formationMod: defFormMod(defOrg) })
    : computePower({ ...defSide, troops: defTroops, morale: defMorale, organization: defOrg, experience: 0, fatigue: 0, wallPenalty: 0, armsMod: defArmsMod, formationMod: defFormMod(defOrg) });
  const totalPowerDiff = Math.abs(atkPower0 - defPower0);
  const rounds = Math.min(10, 3 + Math.floor(totalPowerDiff / 1000));

  for (let r = 1; r <= rounds; r++) {
    const atkP = computePower({ ...atkSide, troops: atkTroops, morale: atkMorale, organization: atkOrg, experience: atkArmy.experience, fatigue: atkArmy.fatigue, armsMod: atkArmsMod, formationMod: atkFormMod(atkOrg) }) * secretCrossingMul * familyRepressionMul * (0.9 + rng() * 0.2);
    const defP = (defArmy
      ? computePower({ ...defSide, troops: defTroops, morale: defMorale, organization: defOrg, experience: defArmy.experience, fatigue: defArmy.fatigue, armsMod: defArmsMod, formationMod: defFormMod(defOrg) })
      : computePower({ ...defSide, troops: defTroops, morale: defMorale, organization: defOrg, experience: 0, fatigue: 0, wallPenalty: 0, armsMod: defArmsMod, formationMod: defFormMod(defOrg) })
    ) * (0.9 + rng() * 0.2);

    const ratio = atkP / Math.max(1, defP);
    const atkLossRatio = 0.05 + Math.max(0, (1 / ratio - 1)) * 0.1;
    const defLossRatio = 0.05 + Math.max(0, (ratio - 1)) * 0.1;
    let atkLoss = Math.floor(atkTroops * Math.min(0.4, atkLossRatio));
    let defLoss = Math.floor(defTroops * Math.min(0.4, defLossRatio));
    // L2 趁火打劫：首击伤害 ×1.2（仅第一回合，目标仍多线交战才生效）
    if (r === 1 && strikeWhileHotMul > 1) {
      defLoss = Math.floor(defLoss * strikeWhileHotMul);
      events.push({
        round: 1,
        type: 'stratagem',
        description: `趁火打劫：首击伤害×${strikeWhileHotMul}`,
      });
    }
    if (r === 1) {
      const atkPrep = factionHasActivePolicy(state, atkArmy.factionId, PolicyType.PREPARE_DEFENSE);
      const defPrep =
        defenderFactionId != null &&
        factionHasActivePolicy(state, defenderFactionId, PolicyType.PREPARE_DEFENSE);
      if (atkPrep) {
        defLoss = Math.floor(defLoss * POLICY_PREPARE_FIRST_ROUND_MUL);
        atkLoss = Math.floor(atkLoss * POLICY_PREPARE_INCOMING_MUL);
        events.push({ round: 1, type: 'stratagem', description: '以逸待劳：首回合攻防+10%' });
      }
      if (defPrep) {
        atkLoss = Math.floor(atkLoss * POLICY_PREPARE_FIRST_ROUND_MUL);
        defLoss = Math.floor(defLoss * POLICY_PREPARE_INCOMING_MUL);
        events.push({ round: 1, type: 'stratagem', description: '守方以逸待劳：首回合攻防+10%' });
      }
      if (factionHasActivePolicy(state, atkArmy.factionId, PolicyType.STRIKE_WEAK)) {
        const weakId = weakestHostileCityId(state, atkArmy.factionId);
        const targetId = defCity?.cityId ?? null;
        if (targetId != null && weakId === targetId) {
          defLoss = Math.floor(defLoss * POLICY_STRIKE_WEAK_HIT_MUL);
          events.push({ round: 1, type: 'stratagem', description: '避实击虚：对该城伤害+15%' });
        } else {
          defLoss = Math.floor(defLoss * POLICY_STRIKE_WEAK_OTHER_MUL);
          events.push({ round: 1, type: 'stratagem', description: '避实击虚：非弱点方向伤害−10%' });
        }
      }
    }
    atkTroops = Math.max(0, atkTroops - atkLoss);
    defTroops = Math.max(0, defTroops - defLoss);

    atkOrg = Math.max(0, atkOrg - 5);
    defOrg = Math.max(0, defOrg - 5);

    // 单挑事件
    const duel = maybeDuel(atkSide, defSide, rng);
    if (duel.triggered) {
      duels.push(duel);
      events.push({ round: r, type: 'duel', description: duel.description });
      // 胜方士气 +15，败方 -10
      if (duel.winner === atkCmd?.id) {
        atkMorale = Math.min(120, atkMorale + 15);
        defMorale = Math.max(0, defMorale - 10);
      } else {
        defMorale = Math.min(120, defMorale + 15);
        atkMorale = Math.max(0, atkMorale - 10);
        // 攻方主将被斩 → 立即战败
        if (duel.description.includes('被斩')) {
          commanderStatus[atkCmd!.id] = 'killed';
          events.push({ round: r, type: 'rout', description: `${atkCmd!.name} 阵亡，攻方溃败` });
          break;
        }
      }
      // 败方主将被斩
      if (duel.description.includes('被斩')) {
        const loserId = duel.winner === atkCmd?.id ? defCmd?.id : atkCmd?.id;
        if (loserId != null) commanderStatus[loserId] = 'killed';
      }
    }

    // 士气变化
    if (atkP > defP) {
      atkMorale = Math.min(120, atkMorale + 5);
      defMorale = Math.max(0, defMorale - 10);
    } else {
      defMorale = Math.min(120, defMorale + 5);
      atkMorale = Math.max(0, atkMorale - 10);
    }

    // 提前结束
    if (atkTroops <= atkInitial * 0.3) {
      events.push({ round: r, type: 'rout', description: '攻方溃散' });
      break;
    }
    if (defTroops <= defInitial * 0.3) {
      events.push({ round: r, type: 'rout', description: '守方溃散' });
      break;
    }
  }

  const winner: 'attacker' | 'defender' = atkTroops > defTroops ? 'attacker' : 'defender';

  // 将领伤亡判定（按兵力损失比例）
  const atkLossRatio = (atkInitial - atkTroops) / Math.max(1, atkInitial);
  const defLossRatio = (defInitial - defTroops) / Math.max(1, defInitial);
  if (atkCmd && commanderStatus[atkCmd.id] == null) {
    commanderStatus[atkCmd.id] = atkLossRatio > 0.5 ? (rng() < 0.1 ? 'killed' : rng() < 0.3 ? 'wounded' : 'alive') : 'alive';
  }
  if (defCmd && commanderStatus[defCmd.id] == null) {
    if (winner === 'attacker' && defTroops <= 0) {
      // 被俘概率（等级表 Lv12 被俘-20%，Session 265：被俘者视角抗被俘）
      const captureResist = meritEffects(
        meritLevelFor(defCmd.merit ?? 0),
        defCmd.meritPath ?? 'neutral',
      ).captureResist;
      const captureRoll = 0.5 - captureResist;
      commanderStatus[defCmd.id] = rng() < captureRoll ? 'captured' : rng() < 0.2 ? 'killed' : 'wounded';
    } else {
      commanderStatus[defCmd.id] = defLossRatio > 0.5 ? (rng() < 0.15 ? 'killed' : rng() < 0.3 ? 'wounded' : 'alive') : 'alive';
    }
  }

  const prisoners = winner === 'attacker' ? Math.floor(defTroops * 0.3) : 0;
  const spoils = winner === 'attacker' && defCity
    ? {
        gold: Math.floor((state.cities[defCity.cityId]?.gold ?? 0) * 0.5),
        food: Math.floor((state.cities[defCity.cityId]?.food ?? 0) * 0.5),
      }
    : { gold: 0, food: 0 };

  return {
    winner,
    rounds,
    battlefield: defenderLabel,
    attackerCasualties: atkInitial - atkTroops,
    defenderCasualties: defInitial - defTroops,
    attackerRemaining: atkTroops,
    defenderRemaining: defTroops,
    commanderStatus,
    duels,
    attackerMoraleAfter: atkMorale,
    defenderMoraleAfter: defMorale,
    prisoners,
    spoils,
    events,
  };
}

// ====== 围城 / 强攻 / 劝降 ======

/** 劝降（§16.5） */
export function trySiegeSurrender(state: GameState, armyId: string, rng: () => number = Math.random): {
  state: GameState;
  success: boolean;
} {
  const army = state.campaignArmies.find((a) => a.id === armyId);
  if (!army) throw new Error('Army 不存在');
  if (army.factionId !== state.playerFactionId) throw new Error('非己方 Army');
  if (army.phase !== 'sieging') throw new Error('当前非围城阶段');

  const targetCity = state.cities[army.targetNodeId ?? army.currentNodeId];
  if (!targetCity) throw new Error('围城目标不存在');
  if (
    targetCity.ruler == null ||
    targetCity.ruler === army.factionId ||
    !isHostileOrAtWar(state.diplomacy, army.factionId, targetCity.ruler)
  ) {
    throw new Error('目标非敌方');
  }

  const commander = state.officers[army.commanderId];
  // 守将
  const defenders = targetCity.officers
    .map((id) => state.officers[id])
    .filter((o): o is Officer => !!o && o.faction === targetCity.ruler && o.status === OfficerStatus.ACTIVE);
  const defCmd = defenders.sort((a, b) => b.stats.charisma - a.stats.charisma)[0];

  const turns = army.siegeState?.siegeTurns ?? 0;
  let chance = 10 + (commander ? (commander.stats.charisma - (defCmd?.stats.charisma ?? 70)) * 0.5 : 0) + turns * 2;
  chance = Math.max(5, Math.min(60, chance));

  const roll = rng() * 100;
  if (roll >= chance) {
    const armies = state.campaignArmies.map((a) =>
      a.id === armyId && a.siegeState
        ? { ...a, siegeState: { ...a.siegeState, siegeTurns: (a.siegeState.siegeTurns ?? 0) + 1 } }
        : a,
    );
    return {
      state: pushLog({ ...state, campaignArmies: armies }, 'campaign_surrender_fail', `${targetCity.name} 拒不投降（成功率 ${chance.toFixed(0)}%）`),
      success: false,
    };
  }

  // 投降 → 占城
  const captured = applyBattleResultToState(state, army, {
    winner: 'attacker',
    rounds: 0,
    battlefield: targetCity.name,
    attackerCasualties: 0,
    defenderCasualties: 0,
    attackerRemaining: army.troops,
    defenderRemaining: 0,
    commanderStatus: defCmd ? { [defCmd.id]: 'captured' } : {},
    duels: [],
    attackerMoraleAfter: army.morale,
    defenderMoraleAfter: 0,
    prisoners: Math.floor(targetCity.troops * 0.5),
    spoils: { gold: Math.floor(targetCity.gold * 0.5), food: Math.floor(targetCity.food * 0.5) },
    events: [{ round: 0, type: 'stratagem', description: `${targetCity.name} 开城投降` }],
  }, { type: 'siege_surrender', defCityId: targetCity.id }, rng);
  return {
    state: commander ? grantMeritTo(captured, commander.id, MERIT_SIEGE_SURRENDER) : captured,
    success: true,
  };
}

/** 强攻 = 攻城自动战斗（§16.6） */
export function assault(
  state: GameState,
  armyId: string,
  rng: () => number,
): { state: GameState; result: AutoBattleResult } {
  return assaultForFaction(state, armyId, state.playerFactionId, rng);
}

/** 服务端权威入口：指定势力对其已接战 Army 执行自动强攻。 */
export function assaultForFaction(
  state: GameState,
  armyId: string,
  actingFactionId: number,
  rng: () => number,
): { state: GameState; result: AutoBattleResult } {
  const army = state.campaignArmies.find((a) => a.id === armyId);
  if (!army) throw new Error('Army 不存在');
  if (army.factionId !== actingFactionId) throw new Error('非己方 Army');
  if (army.phase !== 'sieging' && army.phase !== 'engaged') {
    throw new Error('当前阶段不可强攻');
  }

  const targetId = army.targetNodeId ?? army.currentNodeId;
  const targetCity = state.cities[targetId];
  if (!targetCity) throw new Error('目标节点不存在');

  // 查找同节点敌方 Army
  const enemyArmy = state.campaignArmies.find(
    (a) =>
      a.id !== army.id &&
      a.factionId !== army.factionId &&
      isHostileOrAtWar(state.diplomacy, army.factionId, a.factionId) &&
      a.currentNodeId === targetId,
  );
  if (
    !enemyArmy &&
    (
      targetCity.ruler == null ||
      targetCity.ruler === army.factionId ||
      !isHostileOrAtWar(state.diplomacy, army.factionId, targetCity.ruler)
    )
  ) {
    throw new Error('目标非敌方');
  }

  const result = runAutoBattle(
    state,
    army,
    enemyArmy ?? null,
    enemyArmy ? null : { cityId: targetId, garrison: targetCity.troops, wall: targetCity.stats.wall ?? 0 },
    rng,
  );

  const next = applyBattleResultToState(state, army, result, {
    type: enemyArmy ? 'field_battle' : 'assault',
    defCityId: enemyArmy ? undefined : targetId,
    enemyArmyId: enemyArmy?.id,
  }, rng);
  return { state: next, result };
}

/** 撤退（§16.5 撤围 / §16.3 行军撤退） */
export function retreatArmy(state: GameState, armyId: string): GameState {
  const army = state.campaignArmies.find((a) => a.id === armyId);
  if (!army) throw new Error('Army 不存在');
  if (army.factionId !== state.playerFactionId) throw new Error('非己方 Army');
  if (army.phase === 'garrison') throw new Error('驻守中无需撤退');

  const fromId = army.fromNodeId ?? army.currentNodeId;
  const path = planPath(state, army.currentNodeId, fromId);
  const morale = Math.max(0, army.morale - 10);
  const armies = state.campaignArmies.map((a) =>
    a.id === armyId
      ? {
          ...a,
          phase: 'marching' as const,
          targetNodeId: fromId,
          path,
          morale,
          siegeState: undefined,
        }
      : a,
  );
  return pushLog(
    { ...state, campaignArmies: armies },
    'campaign_retreat',
    `${army.name} 撤退（士气 -10）`,
  );
}

// ====== 战后结算 ======

interface BattleResolution {
  type: 'field_battle' | 'assault' | 'siege_surrender';
  defCityId?: number;
  enemyArmyId?: string;
}

/** 将自动战斗结果应用到 GameState */
function applyBattleResultToState(
  state: GameState,
  army: CampaignArmy,
  result: AutoBattleResult,
  resolution: BattleResolution,
  rng: () => number,
): GameState {
  let cities = { ...state.cities };
  let officers = { ...state.officers };
  let factions = { ...state.factions };
  // 两支参战 Army 都先从权威数组移除，随后按战果各自最多回写一次。
  // 旧逻辑只移除攻方，防守方残军 push 后与原对象并存，且攻方战败分支还会重复回写攻方。
  const participantIds = new Set([
    army.id,
    ...(resolution.enemyArmyId ? [resolution.enemyArmyId] : []),
  ]);
  const armies = state.campaignArmies.filter((a) => !participantIds.has(a.id));
  const captivesByAttacker: number[] = [];
  const captivesByDefender: number[] = [];

  // 更新攻方 Army
  const updatedArmy: CampaignArmy = {
    ...army,
    troops: result.attackerRemaining,
    morale: result.attackerMoraleAfter,
    organization: Math.max(0, army.organization - 10),
    fatigue: Math.min(100, army.fatigue + 20),
    experience: army.experience + (result.winner === 'attacker' ? 50 : 20),
    phase: result.winner === 'attacker' ? 'garrison' : 'retreating',
    siegeState: undefined,
  };

  // 移除被歼灭的敌方 Army
  if (resolution.enemyArmyId) {
    const enemy = state.campaignArmies.find((a) => a.id === resolution.enemyArmyId);
    if (enemy) {
      if (result.winner === 'attacker') {
        // 敌军被歼
        if (result.defenderRemaining <= 0) {
          // 敌方主将/副将处理
          for (const oid of [enemy.commanderId, ...enemy.subCommanderIds]) {
            const o = officers[oid];
            if (!o) continue;
            const status = result.commanderStatus[oid];
            if (status === 'killed') {
              officers[oid] = { ...o, status: OfficerStatus.DEAD, location: null };
            } else if (status === 'captured') {
              officers[oid] = { ...o, status: OfficerStatus.PRISONER };
              captivesByAttacker.push(oid);
            } else if (status === 'wounded') {
              officers[oid] = { ...o, stamina: Math.max(0, o.stamina - 30) };
            }
          }
        } else {
          // 敌军残部退守
          const remaining = { ...enemy, troops: result.defenderRemaining, morale: result.defenderMoraleAfter, phase: 'garrison' as const };
          armies.push(remaining);
        }
      } else {
        // 攻方败：敌军保留
        armies.push({ ...enemy, troops: result.defenderRemaining, morale: result.defenderMoraleAfter });
      }
    }
  }

  // 攻方主将/副将伤亡
  for (const oid of [army.commanderId, ...army.subCommanderIds]) {
    const o = officers[oid];
    if (!o) continue;
    const status = result.commanderStatus[oid];
    if (status === 'killed') {
      officers[oid] = { ...o, status: OfficerStatus.DEAD, location: null };
    } else if (status === 'captured') {
      officers[oid] = { ...o, status: OfficerStatus.PRISONER };
      captivesByDefender.push(oid);
    } else if (status === 'wounded') {
      officers[oid] = { ...o, stamina: Math.max(0, o.stamina - 30) };
    }
  }

  const sealCaptures = (s: GameState): GameState => {
    let out = s;
    if (captivesByAttacker.length > 0) {
      out = applyCapturedRelations(out, captivesByAttacker, army.commanderId);
    }
    if (captivesByDefender.length > 0) {
      const enemyCmd =
        resolution.enemyArmyId != null
          ? state.campaignArmies.find((a) => a.id === resolution.enemyArmyId)?.commanderId
          : undefined;
      let siegeDefCmd: number | undefined;
      if (enemyCmd == null && resolution.defCityId != null) {
        const defCity = cities[resolution.defCityId] ?? state.cities[resolution.defCityId];
        if (defCity?.ruler != null) {
          siegeDefCmd = pickDefenderCommander(
            { ...state, cities, officers },
            defCity,
            defCity.ruler,
          )?.id;
        }
      }
      const captorId = enemyCmd ?? siegeDefCmd;
      if (captorId != null) {
        out = applyCapturedRelations(out, captivesByDefender, captorId);
      }
    }
    return out;
  };

  // 攻方胜且 defCityId → 占城
  if (result.winner === 'attacker' && resolution.defCityId != null) {
    const targetId = resolution.defCityId;
    const target = cities[targetId];
    if (target) {
      const prevRuler = target.ruler;
      const familyShockIds =
        prevRuler != null ? citiesShockedByFamilyCapture(state, targetId, prevRuler) : [];
      const pendingFamilyTreatment =
        prevRuler != null ? buildPendingFamilyTreatment(state, targetId, prevRuler) : null;
      // 敌方同城武将 → 在野
      const freedIds: number[] = [];
      for (const oid of target.officers) {
        const o = officers[oid];
        if (!o) continue;
        if (o.faction === prevRuler) {
          officers[oid] = {
            ...o,
            faction: null,
            status: OfficerStatus.FREE,
            location: targetId,
            loyalty: 50,
          };
          freedIds.push(oid);
        }
      }
      // 攻方主将调入
      const movedCmdIds = [army.commanderId, ...army.subCommanderIds];
      for (const oid of movedCmdIds) {
        if (officers[oid]) officers[oid] = { ...officers[oid], location: targetId };
      }
      // 占城
      cities[targetId] = {
        ...target,
        ruler: army.factionId,
        troops: result.attackerRemaining,
        troopsMorale: Math.min(80, Math.max(40, (target.troopsMorale ?? 70) - 15)),
        stats: {
          ...target.stats,
          morale: Math.max(20, (target.stats.morale ?? 70) - 25),
          wall: Math.max(0, target.stats.wall - 10),
        },
        officers: [...movedCmdIds, ...freedIds],
        gold: Math.max(0, target.gold - result.spoils.gold),
        food: Math.max(0, target.food - result.spoils.food),
        familyTreatment: undefined,
      };
      for (const shockedId of familyShockIds) {
        const shocked = cities[shockedId];
        if (!shocked || shocked.ruler !== prevRuler) continue;
        cities[shockedId] = {
          ...shocked,
          troopsMorale: Math.max(0, (shocked.troopsMorale ?? 70) - FAMILY_CAPTURE_MORALE_HIT),
        };
      }
      // 从出发城移除已迁入的武将
      if (army.fromNodeId != null && cities[army.fromNodeId]) {
        const from = cities[army.fromNodeId];
        cities[army.fromNodeId] = {
          ...from,
          officers: from.officers.filter((id) => !movedCmdIds.includes(id)),
        };
      }
      // 重新计算势力城池
      factions = recomputeFactionCities(cities, factions);
      // 清反间 + 抢美女
      let after: GameState = {
        ...state,
        cities,
        officers,
        factions,
        campaignArmies: [...armies, updatedArmy],
        pendingFamilyTreatment:
          army.factionId === state.playerFactionId ? pendingFamilyTreatment : null,
      };
      // 军事功绩：破城 +30（Army 主将）；若占城导致目标势力覆灭再 +50（灭国）
      after = grantMeritTo(after, army.commanderId, MERIT_CAPTURE_CITY);
      // S27 声望：强攻破城 +20 / 开城投降占城 +10；灭国再 +50（docs/08 §十七）
      after = grantFame(after, army.factionId, resolution.type === 'siege_surrender' ? FAME_OCCUPY_CITY : FAME_CAPTURE_CITY);
      if (prevRuler != null && factions[prevRuler] && !factions[prevRuler].isAlive) {
        after = grantMeritTo(after, army.commanderId, MERIT_ANNIHILATE_FACTION);
        after = grantFame(after, army.factionId, FAME_ANNIHILATE_FACTION);
      }
      after = clearCityCounterOnCapture(after, targetId);
      after = lootBeautyOnCapture(after, targetId, army.factionId, rng);
      after = syncFactionResources(after);
      const msg = resolution.type === 'siege_surrender'
        ? `${target.name} 开城投降！${army.name} 占领`
        : `${army.name} 攻占 ${target.name}！俘获士兵 ${result.prisoners}，缴获金 ${result.spoils.gold}、粮 ${result.spoils.food}${
            familyShockIds.length > 0 ? `；家属所在城失陷，${familyShockIds.length} 城士气−${FAMILY_CAPTURE_MORALE_HIT}` : ''
          }${pendingFamilyTreatment ? `；待处置家属${pendingFamilyTreatment.familyCount}口` : ''}`;
      return sealCaptures(pushLog(after, 'campaign_capture', msg));
    }
  }

  // 攻方败 → 残兵回流
  if (result.winner === 'defender' && army.fromNodeId != null) {
    const from = cities[army.fromNodeId];
    if (from) {
      cities[army.fromNodeId] = {
        ...from,
        troops: from.troops + result.attackerRemaining,
      };
    }
    // 军事功绩：守城 +8（守方主将，守方击退攻方围城；仅限围城战，野战无守城一说）
    let defeatedState: GameState = { ...state, cities, officers, factions, campaignArmies: armies };
    if (resolution.defCityId != null && cities[resolution.defCityId]) {
      const defCity = cities[resolution.defCityId];
      if (defCity.ruler != null) {
        const defCmd = pickDefenderCommander(defeatedState, defCity, defCity.ruler);
        if (defCmd) defeatedState = grantMeritTo(defeatedState, defCmd.id, MERIT_DEFEND_CITY);
      }
    } else if (resolution.enemyArmyId != null) {
      // 军事功绩：野战守方击退来敌 +10（敌方 Army 主将）
      const enemyCmd = state.campaignArmies.find((a) => a.id === resolution.enemyArmyId)?.commanderId;
      if (enemyCmd != null) {
        defeatedState = grantMeritTo(defeatedState, enemyCmd, MERIT_FIELD_ROUT);
      }
    }
    // Army 残部退回（兵力极少则解散）
    if (result.attackerRemaining > MIN_CAMPAIGN_TROOPS) {
      armies.push({ ...updatedArmy, phase: 'garrison', currentNodeId: army.fromNodeId, targetNodeId: undefined, path: [] });
    }
    return sealCaptures(pushLog(
      defeatedState,
      'campaign_defeat',
      `${army.name} 战败，残部 ${result.attackerRemaining} 退回`,
    ));
  }

  // 野战胜（无 defCityId）：Army 驻守当前节点
  armies.push({ ...updatedArmy, phase: 'garrison' });
  // 军事功绩：野战击破——守方溃散（击破敌军主力，30% 溃散线）攻方主将 +20；
  // 未溃散险胜 +10。引擎结构下守方 30% 溃散线兜底，"全歼（残 0）"不可达，
  // 故以"溃散"为重大战果判定（docs/04 §6.1）。
  const defRouted = result.events.some(
    (e) => e.type === 'rout' && e.description.includes('守方'),
  );
  let fieldState: GameState = { ...state, cities, officers, factions, campaignArmies: armies };
  fieldState = grantMeritTo(
    fieldState,
    army.commanderId,
    defRouted ? MERIT_FIELD_ANNIHILATE : MERIT_FIELD_ROUT,
  );
  return sealCaptures(pushLog(
    fieldState,
    'campaign_field_win',
    `${army.name} 野战胜利，敌军溃退`,
  ));
}

function recomputeFactionCities(
  cities: GameState['cities'],
  factions: GameState['factions'],
): GameState['factions'] {
  const next = { ...factions };
  for (const fid of Object.keys(next).map(Number)) {
    const f = next[fid];
    if (!f) continue;
    const cityIds = Object.values(cities).filter((c) => c.ruler === fid).map((c) => c.id);
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

// ====== 设施建造（简化） ======

const STRUCTURE_DEF: Record<StructureType, { turns: number; effect: string; goldCost: number }> = {
  camp: { turns: 1, effect: '粮耗-30% 防御+15%', goldCost: 100 },
  ram: { turns: 2, effect: '城墙伤害×3', goldCost: 300 },
  ladder: { turns: 2, effect: '无视城墙1回合', goldCost: 200 },
  siege_tower: { turns: 3, effect: '守军防-20%', goldCost: 400 },
  catapult: { turns: 3, effect: '城墙伤害×5', goldCost: 500 },
  supply_depot: { turns: 1, effect: '补给线+2节点', goldCost: 150 },
  trap: { turns: 1, effect: '敌经过受智×1.5伤', goldCost: 80 },
  watchtower: { turns: 1, effect: '视野+2节点', goldCost: 100 },
  palisade: { turns: 1, effect: '防+10%', goldCost: 80 },
  trench: { turns: 1, effect: '敌通过损兵3%', goldCost: 60 },
  pontoon_bridge: { turns: 1, effect: '可渡河', goldCost: 150 },
};

/**
 * 建造设施（回合化）
 * - 消耗金（0-A 简化用金代替木/铁）
 * - 大型器械（turns > 1）建造期间 Army 不可行军（0-A 简化：phase 变更为 garrison）
 * - 初始 buildProgress = 1/turns，每回合 tickConstruction 推进
 */
export function buildStructure(
  state: GameState,
  armyId: string,
  structureType: StructureType,
): GameState {
  const army = state.campaignArmies.find((a) => a.id === armyId);
  if (!army) throw new Error('Army 不存在');
  if (army.factionId !== state.playerFactionId) throw new Error('非己方 Army');
  if (army.phase !== 'sieging' && army.phase !== 'garrison' && army.phase !== 'marching') {
    throw new Error('当前阶段不可建造');
  }
  // 大型建造中不可再建
  if (army.structures.some((s) => s.buildProgress < 1)) {
    throw new Error('已有设施在建中，请等待完成');
  }

  const def = STRUCTURE_DEF[structureType];
  const builderId = army.commanderId; // 简化：主将建造；副将建造后置

  // 扣金（0-A 简化）
  const faction = state.factions[army.factionId];
  if (!faction) throw new Error('势力不存在');
  if (faction.gold < def.goldCost) throw new Error(`金不足（需 ${def.goldCost}，当前 ${faction.gold}）`);

  // 大型建造（turns > 1）→ Army 进入驻守状态不可行军
  const isLarge = def.turns > 1;
  const newPhase = isLarge ? 'garrison' as const : army.phase;

  const initProgress = 1 / def.turns;
  const structure: CampStructure = {
    type: structureType,
    builderId,
    buildProgress: initProgress,
    durability: 500 * (1 + (state.officers[builderId]?.stats.leadership ?? 50) / 200),
    effect: def.effect,
    nodeId: army.currentNodeId,
  };

  const armies = state.campaignArmies.map((a) =>
    a.id === armyId
      ? {
          ...a,
          phase: newPhase,
          // 大型器械建造中清除行军路径
          path: isLarge ? [] : a.path,
          targetNodeId: isLarge ? undefined : a.targetNodeId,
          structures: [...a.structures, structure],
          food: a.food - (isLarge ? Math.floor(a.food * 0.05) : 0), // 驻守建造额外耗粮5%
        }
      : a,
  );

  return pushLog(
    { ...state, campaignArmies: armies, factions: { ...state.factions, [faction.id]: { ...faction, gold: faction.gold - def.goldCost } } },
    'campaign_build',
    `${army.name} 开始建造 ${structureType}（需 ${def.turns} 回合${isLarge ? '，建造期间不可行军' : ''}）`,
  );
}

/** 每回合推进所有 Army 的设施建造进度 */
export function tickConstruction(state: GameState): GameState {
  let armies = [...state.campaignArmies];
  const logs: string[] = [];

  for (let i = 0; i < armies.length; i++) {
    const a = armies[i];
    const incompleteIdx = a.structures.findIndex((s) => s.buildProgress < 1);
    if (incompleteIdx === -1) continue;

    const struct = a.structures[incompleteIdx];
    const def = STRUCTURE_DEF[struct.type];
    const progressPerTurn = 1 / def.turns;
    const newProgress = Math.min(1, struct.buildProgress + progressPerTurn);

    const newStructs = [...a.structures];
    newStructs[incompleteIdx] = { ...struct, buildProgress: newProgress };

    armies[i] = { ...a, structures: newStructs };

    if (newProgress >= 1) {
      logs.push(`${a.name} 建造 ${struct.type} 完成（${def.effect}）`);
    }
  }

  if (logs.length === 0) return state;

  return pushLog(
    { ...state, campaignArmies: armies },
    'construction_progress',
    logs.join('；'),
  );
}

// ====== 参谋行动（§13.6） ======

export type AdvisorAction = 'inspire' | 'trap' | 'retreat' | 'scout';

export function advisorAction(
  state: GameState,
  armyId: string,
  action: AdvisorAction,
): GameState {
  const army = state.campaignArmies.find((a) => a.id === armyId);
  if (!army) throw new Error('Army 不存在');
  if (army.factionId !== state.playerFactionId) throw new Error('非己方 Army');
  if (army.advisorId == null) throw new Error('该 Army 无参谋');
  const adv = state.officers[army.advisorId];
  if (!adv) throw new Error('参谋不存在');

  switch (action) {
    case 'inspire': {
      if (adv.stamina < 30) throw new Error('参谋体力不足（需≥30）');
      const morale = Math.min(100, army.morale + 15);
      const officers = { ...state.officers, [adv.id]: { ...adv, stamina: Math.max(0, adv.stamina - 15) } };
      const armies = state.campaignArmies.map((a) => (a.id === armyId ? { ...a, morale } : a));
      return pushLog({ ...state, officers, campaignArmies: armies }, 'campaign_advisor', `${adv.name} 激励三军，士气 +15`);
    }
    case 'trap': {
      if (adv.stats.intelligence < 90) throw new Error('参谋智力须≥90 方可布陷阱');
      if (adv.stamina < 40) throw new Error('参谋体力不足（需≥40）');
      const officers = { ...state.officers, [adv.id]: { ...adv, stamina: Math.max(0, adv.stamina - 20) } };
      const structure: CampStructure = {
        type: 'trap',
        builderId: adv.id,
        buildProgress: 1,
        durability: 300,
        effect: '敌经过受智×1.5伤',
        nodeId: army.currentNodeId,
      };
      const armies = state.campaignArmies.map((a) =>
        a.id === armyId ? { ...a, structures: [...a.structures, structure] } : a,
      );
      return pushLog({ ...state, officers, campaignArmies: armies }, 'campaign_advisor', `${adv.name} 在 ${state.cities[army.currentNodeId]?.name ?? '当前节点'} 布下陷阱`);
    }
    case 'retreat': {
      if (adv.stamina < 20) throw new Error('参谋体力不足（需≥20）');
      const fatigue = Math.max(0, army.fatigue - 30);
      const officers = { ...state.officers, [adv.id]: { ...adv, stamina: Math.max(0, adv.stamina - 10) } };
      const armies = state.campaignArmies.map((a) => (a.id === armyId ? { ...a, fatigue } : a));
      return pushLog({ ...state, officers, campaignArmies: armies }, 'campaign_advisor', `${adv.name} 建议撤退休整，疲劳 -30`);
    }
    case 'scout': {
      // 视野+1节点（常驻，无消耗；0-A 简化：仅记录日志）
      return pushLog(state, 'campaign_advisor', `${adv.name} 派遣斥候扩大视野`);
    }
  }
}

// ====== 节点查询 ======

export function getCampaignNodes(state: GameState): CampaignNode[] {
  return syncNodesFromCities(state);
}

/** 获取指定 Army */
export function getArmy(state: GameState, armyId: string): CampaignArmy | undefined {
  return state.campaignArmies.find((a) => a.id === armyId);
}

/** 回合末维护：驻守 Army 恢复疲劳/组织度，行军 Army 已在 tickCampaignMarch 处理 */
export function tickCampaignGarrison(state: GameState): GameState {
  const armies = state.campaignArmies.map((a) => {
    if (a.phase !== 'garrison') return a;
    return {
      ...a,
      fatigue: Math.max(0, a.fatigue - GARRISON_FATIGUE_RECOVER),
      organization: Math.min(100, a.organization + GARRISON_ORG_RECOVER),
    };
  });
  return { ...state, campaignArmies: armies };
}
