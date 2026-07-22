// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Season,
  TerrainType,
  beautySeekLeftFromFemales,
  calcStaminaMax,
  emptyIntel,
  maskGameStateForPlayer,
  parseCurrentSaveEnvelope,
  splitDemographics,
  type BattleState,
  type City,
  type FemaleCharacter,
  type Faction,
  type EventSourceClass,
  type GameState,
  type Officer,
  type ScenarioStatic,
} from '@leh/shared';
import { staticData } from '../data/loader.js';
import { advanceTurn } from '../engine/turn.js';
import { catchUpChildren } from '../engine/child.js';
import {
  conscript,
  developCity,
  developFarm,
  relief,
  trainTroops,
  type DevelopKind,
} from '../engine/civil.js';
import {
  lootBeautyOnCapture,
  rewardBeautyStock,
  seekBeauty,
} from '../engine/beauty.js';
import {
  attackUnit,
  castAbility,
  castFireTactic,
  challengeDuel,
  createBattle,
  finishPlayerAction,
  getMoveRange,
  getUsableAbilities,
  moveUnit,
  runEnemyPhase,
  skipBattleDuel,
  stepBattleDuel,
} from '../engine/battle.js';
import {
  advisorAction as campaignAdvisorAction,
  assault as campaignAssaultEngine,
  buildCampaignNodes,
  buildStructure as campaignBuildStructure,
  getCampaignNodes,
  orderMarch as campaignOrderMarch,
  retreatArmy as campaignRetreatArmy,
  startCampaign as campaignStartCampaign,
  tickCampaignGarrison,
  tickCampaignMarch,
  tickConstruction,
  trySiegeSurrender as campaignTrySiegeSurrender,
  type AdvisorAction,
} from '../engine/campaign.js';
import {
  isMarchTargetReachable,
  pickDefaultFromCity,
  prepareMarch,
  settleBattle,
} from '../engine/march.js';
import {
  giftBeauty,
  marryFemale,
  recruitOfficer,
  searchTalent,
} from '../engine/personnel.js';
import { grantBattleIntel } from '../engine/intel.js';
import { formAlliance, giftBeautyStock, tributeGold } from '../engine/diplomacy.js';
import { launchPlot } from '../engine/plot.js';
import { joinFaction, releaseOfficer, tickFollowCheck } from '../engine/family.js';
import {
  dispatchMission,
  recruitSpies,
  resolveCaptive,
  stationCounter,
  trainFemaleSpy,
  plantFemaleFromGift,
  unstationCounter,
} from '../engine/spy.js';
import { syncFactionResources } from '../engine/economy.js';
import { extractBattlefieldNodes, generateBattlefield, tickBattlefieldMarch } from '../engine/battlefield.js';
import { applyMeleeRoundResult, createMeleeState, getTacticalActionCost, refreshMeleeState, runMeleeRound } from '../engine/meleeRound.js';
import {
  appointGrandStrategist as gsAppoint,
  dismissGrandStrategist as gsDismiss,
  switchStrategy as gsSwitchStrategy,
  tickGrandStrategists as gsTick,
  getFactionStrategy,
  calcStrategyModifiers,
} from '../engine/grandStrategist.js';
import { resolveEventChoice } from '../engine/event.js';
import { appointOfficer } from '../engine/appoint.js';
import { broadcast } from '../ws/broadcast.js';
import { resetRuntimeRng, restoreRuntimeRng } from '../runtime-rng.js';
import { PlotType, SpyCaptiveAction, SpyMissionType, type BattlefieldMap, type CampaignArmy, type CampaignFormationOptions, type CampaignNode, type MeleeState, type PositionTrack, type StructureType } from '@leh/shared';

let currentGame: GameState | null = null;
// Sec-6: 简单请求锁，防止并发操作导致状态不一致
let isProcessing = false;

/** 串行化所有写操作：取锁 → 执行 → 释放。若锁占用则抛错。 */
function withLock<T>(fn: () => T): T {
  if (isProcessing) throw new Error('操作处理中，请稍候（避免并发冲突）');
  isProcessing = true;
  try {
    return fn();
  } finally {
    isProcessing = false;
  }
}

export function createGame(
  scenarioId: number,
  playerFactionId: number,
  requestedEventLayers?: EventSourceClass[],
): GameState {
  return withLock(() => {
    const scenario = staticData.scenarios.find((s) => s.id === scenarioId);
    if (!scenario) throw new Error('剧本不存在');
    if (!scenario.playableFactions.includes(playerFactionId)) throw new Error('该势力不可玩');
    if (!scenario.startState.activeFactionIds.includes(playerFactionId)) throw new Error('该势力未在本剧本登场');

    const availableLayers = new Set(scenario.availableEventLayers);
    const enabledEventLayers = requestedEventLayers ?? scenario.defaultEventLayers;
    if (enabledEventLayers.length === 0 || enabledEventLayers.some((layer) => !availableLayers.has(layer))) {
      throw new Error('事件史料层配置无效');
    }

    const state = buildGameState(scenario, playerFactionId, enabledEventLayers);

    resetRuntimeRng((scenarioId * 0x9e3779b1) ^ playerFactionId);
    currentGame = state;
    return getClientGame();
  });
}

function buildGameState(
  scenario: ScenarioStatic,
  playerFactionId: number,
  enabledEventLayers: EventSourceClass[],
): GameState {
  const { startState } = scenario;
  const officers: Record<number, Officer> = {};
  const availableOfficerIds = new Set(scenario.availableOfficerIds);
  for (const o of staticData.officers.filter((item) => availableOfficerIds.has(item.id))) {
    const pos = startState.officerPositions.find((p) => p.officerId === o.id);
    officers[o.id] = {
      ...o,
      skills: o.skills.map((s) => ({ ...s, useCount: 0 })),
      faction: pos?.factionId ?? null,
      location: pos?.cityId ?? null,
      loyalty: pos?.loyalty ?? 50,
      experience: 0,
      status: pos ? OfficerStatus.ACTIVE : OfficerStatus.FREE,
      civilPosition: (pos?.civilPosition as CivilPosition) ?? CivilPosition.NONE,
      localPosition: (pos?.localPosition as LocalPosition) ?? LocalPosition.NONE,
      militaryPosition: (pos?.militaryPosition as MilitaryPosition) ?? MilitaryPosition.NONE,
      nobilityRank: (pos?.nobilityRank as NobilityRank) ?? NobilityRank.NONE,
      merit: pos?.merit ?? 0,
      stamina: calcStaminaMax(o, pos?.merit ?? 0, scenario.noLifespan ? 40 : (startState.year - o.birthYear)),
      wifeId: null,
      beauties: [],
    };
  }

  const cities: Record<number, City> = {};
  for (const c of staticData.cities) {
    const ruler = startState.cityOwnership[String(c.id)] ?? null;
    const cityOfficers = startState.officerPositions
      .filter((p) => p.cityId === c.id)
      .map((p) => p.officerId);
    const population = Math.floor(c.maxPopulation * 0.7);
    const demographics = splitDemographics(population);
    cities[c.id] = {
      ...c,
      terrain: TerrainType.PLAIN,
      stats: {
        farm: c.initialStats.farm,
        commerce: c.initialStats.commerce,
        wall: c.initialStats.wall,
        morale: 70,
      },
      gold: 2000 + c.initialStats.commerce,
      food: 3000 + c.initialStats.farm,
      population,
      demographics,
      beautySeekLeft: beautySeekLeftFromFemales(demographics.adultFemale),
      troops: 5000,
      troopsMorale: 70,
      officers: cityOfficers,
      ruler,
      facilities: c.facilities ?? [],
      policy: c.policy ?? null,
      developmentProgress: c.developmentProgress ?? { farm: 0, commerce: 0, wall: 0 },
    };
  }

  const factions: Record<number, Faction> = {};
  for (const fid of startState.activeFactionIds) {
    const setup = scenario.factionSetups.find((item) => item.id === fid);
    if (!setup) throw new Error(`势力 ${fid} 缺少剧本定义`);
    const cityIds = Object.entries(startState.cityOwnership)
      .filter(([, v]) => v === fid)
      .map(([k]) => Number(k));
    const officerIds = startState.officerPositions
      .filter((p) => p.factionId === fid)
      .map((p) => p.officerId);
    if (cityIds.length === 0) throw new Error(`0-A 势力「${setup.name}」至少需要一个补给据点`);
    if (!cityIds.includes(setup.capitalCityId)) throw new Error(`势力「${setup.name}」的开局治所不在控制据点中`);
    if (!officerIds.includes(setup.rulerId)) throw new Error(`势力「${setup.name}」的领袖未在本剧本登场`);
    factions[fid] = {
      id: fid,
      name: setup.name,
      color: setup.color,
      rulerId: setup.rulerId,
      capitalCityId: setup.capitalCityId,
      scenarioMode: setup.mode,
      headquartersLabel: setup.headquartersLabel,
      gold: 5000,
      food: 8000,
      beautyStock: 0,
      cityIds,
      officerIds,
      isPlayer: fid === playerFactionId,
      isAlive: true,
    };
  }

  const females: Record<number, FemaleCharacter> = {};
  const availableFemaleIds = new Set(scenario.availableFemaleIds);
  for (const f of staticData.females.filter((item) => availableFemaleIds.has(item.id))) {
    const pos = startState.femalePositions.find((p) => p.femaleId === f.id);
    const husbandId = pos?.husbandId ?? f.initialHusbandId;
    females[f.id] = {
      ...f,
      status: pos?.status ?? f.initialStatus,
      husbandId,
      factionId: pos?.factionId ?? f.factionId,
      locationId: pos?.cityId ?? f.locationId,
      giftedToOfficerId: null,
    };
    // 开局已婚：回写武将 wifeId
    if (husbandId != null && officers[husbandId]) {
      officers[husbandId] = {
        ...officers[husbandId],
        wifeId: f.id,
      };
    }
  }

  // 初始化季节（与 turn.monthToSeason 一致）
  const season = Math.floor((startState.month - 1) / 3) as Season;

  const draft: GameState = {
    scenarioId: scenario.id,
    enabledEventLayers: [...enabledEventLayers],
    enabledChildEventIds: [...scenario.childEventIds],
    currentYear: startState.year,
    currentMonth: startState.month,
    season,
    playerFactionId,
    officers,
    cities,
    factions,
    females,
    armys: [],
    campaignArmies: [],
    campaignNodes: [], // 在 syncFactionResources 之后用 buildCampaignNodes 填充
    grandStrategists: [],
    activeBattles: [],
    activeBattlefield: null,
    activeMelee: null,
    diplomacy: startState.initialDiplomacy,
    intel: emptyIntel(),
    plots: [],
    completedEvents: [...startState.completedEvents],
    pendingEvents: [],
    invalidatedEvents: [],
    eventChoices: {},
    actionLog: [
      {
        year: startState.year,
        month: startState.month,
        type: 'game_start',
        message: `开始剧本「${scenario.name}」，扮演 ${factions[playerFactionId]?.name}`,
      },
    ],
  };
  // 子女补登：appearYear ≤ 开局年则直接入库（0-A 起 190 年通常无人）
  const withChildren = catchUpChildren(draft);
  // 城池金粮为真源，开局即同步 faction 缓存
  const synced = syncFactionResources(withChildren);
  // 战役节点：基于同步后的城池状态生成
  return { ...synced, campaignNodes: buildCampaignNodes(synced) };
}

/** 服务端真源（全量，勿直接下发客户端） */
export function getGame(): GameState {
  if (!currentGame) throw new Error('尚无进行中的游戏');
  return currentGame;
}

/**
 * 将已版本迁移并完整校验的存档快照安装为服务端权威状态。
 *
 * 这是 S16 的内存恢复边界，不读取磁盘，也不恢复 WebSocket 连接、请求锁、
 * 客户端动画/选择框等进程或客户端瞬态上下文。请求锁由 withLock 的 finally
 * 重新归零；静态数据缓存与 WebSocket 服务保持当前进程实例。
 */
export function restoreGameFromEnvelope(input: unknown): GameState {
  return withLock(() => {
    const envelope = parseCurrentSaveEnvelope(input);
    const scenario = staticData.scenarios.find((item) => item.id === envelope.scenarioId);
    if (!scenario) throw new Error('存档引用的剧本不存在');

    const availableLayers = new Set(scenario.availableEventLayers);
    if (envelope.snapshot.enabledEventLayers.some((layer) => !availableLayers.has(layer))) {
      throw new Error('存档事件史料层与当前剧本不兼容');
    }

    restoreRuntimeRng(envelope.rng);
    currentGame = envelope.snapshot;
    return getClientGame();
  });
}

/**
 * 当前 Demo 只允许一场六角战斗；权威状态统一存放在 GameState.activeBattles。
 * 保留数组形状是为了兼容未来多战场，但服务层暂不静默引入多战斗调度语义。
 */
function getActiveBattle(state: GameState = getGame()): BattleState | null {
  return state.activeBattles[0] ?? null;
}

function commitActiveBattle(battle: BattleState | null, state: GameState = getGame()): GameState {
  currentGame = { ...state, activeBattles: battle ? [battle] : [] };
  return currentGame;
}

/** S06：下发客户端的脱敏投影 */
export function getClientGame(): GameState {
  return maskGameStateForPlayer(getGame());
}

/** P1-08 别名 → 客户端投影 */
export function getGameState(): GameState {
  return getClientGame();
}

export function endTurn(): GameState {
  return withLock(() => {
    const before = getGame();
    if ((before.pendingEvents ?? []).length > 0) {
      throw new Error('请先处理待决事件');
    }
    broadcast({ type: 'turn_progress', phase: 'ai', message: '回合结算中…', progress: 10 });
    let next = advanceTurn(before);
    // 战役层：行军推进 + 驻守恢复（0-A 最小切片，玩家 Army 与 AI Army 同步推进）
    next = tickCampaignMarch(next);
    next = tickCampaignGarrison(next);
    next = tickConstruction(next); // 设施建造回合化推进
    next = gsTick(next); // 总军师系统：忠诚/被俘自动解职
    next = { ...next, campaignNodes: getCampaignNodes(next) };
    currentGame = next;
    const g = getClientGame();
    broadcast({
      type: 'turn_complete',
      message: `${g.currentYear}年${g.currentMonth}月 — 回合结束`,
    });
    if ((g.pendingEvents ?? []).length > 0) {
      broadcast({
        type: 'event_triggered',
        name: 'event',
        message: `待决事件 ${g.pendingEvents.length} 件`,
        payload: { pendingEvents: g.pendingEvents },
      });
    } else {
      const lastEvent = g.actionLog.find((l) => l.type === 'event');
      if (lastEvent) {
        broadcast({ type: 'event_triggered', name: 'event', message: lastEvent.message });
      }
    }
    return g;
  });
}

/** S14 玩家选择事件选项 */
export function doEventChoice(eventId: number, choiceIndex: number): GameState {
  return withLock(() => {
    currentGame = resolveEventChoice(getGame(), eventId, choiceIndex);
    return getClientGame();
  });
}

export function doDevelopFarm(cityId: number): GameState {
  return withLock(() => {
    currentGame = developFarm(getGame(), cityId);
    return getClientGame();
  });
}

export function doDevelop(cityId: number, kind: DevelopKind): GameState {
  return withLock(() => {
    currentGame = developCity(getGame(), cityId, kind);
    return getClientGame();
  });
}

export function doConscript(cityId: number): GameState {
  return withLock(() => {
    currentGame = conscript(getGame(), cityId);
    return getClientGame();
  });
}

export function doRelief(cityId: number): GameState {
  return withLock(() => {
    currentGame = relief(getGame(), cityId);
    return getClientGame();
  });
}

export function doTrain(cityId: number): GameState {
  return withLock(() => {
    currentGame = trainTroops(getGame(), cityId);
    return getClientGame();
  });
}

export function doSeekBeauty(cityId: number): GameState {
  return withLock(() => {
    currentGame = seekBeauty(getGame(), cityId);
    return getClientGame();
  });
}

export function doRewardBeautyStock(officerId: number, amount?: number): GameState {
  return withLock(() => {
    currentGame = rewardBeautyStock(getGame(), officerId, amount);
    return getClientGame();
  });
}

/** 占城抢夺美女（内部） */
export function applyLootBeauty(cityId: number, attackerFactionId: number): void {
  withLock(() => {
    currentGame = lootBeautyOnCapture(getGame(), cityId, attackerFactionId);
  });
}

export function doMarry(femaleId: number, officerId: number): GameState {
  return withLock(() => {
    currentGame = marryFemale(getGame(), femaleId, officerId);
    return getClientGame();
  });
}

export function doGiftBeauty(femaleId: number, officerId: number): GameState {
  return withLock(() => {
    currentGame = giftBeauty(getGame(), femaleId, officerId);
    return getClientGame();
  });
}

export function doSearchTalent(cityId: number): GameState {
  return withLock(() => {
    currentGame = searchTalent(getGame(), cityId);
    return getClientGame();
  });
}

export function doRecruitOfficer(officerId: number, recruiterId?: number): GameState {
  return withLock(() => {
    currentGame = recruitOfficer(
      getGame(),
      officerId,
      recruiterId != null ? recruiterId : undefined,
    );
    return getClientGame();
  });
}

/** S11/S12 任命三轨官职 */
export function doAppoint(
  officerId: number,
  track: PositionTrack,
  position: string,
  cityId?: number,
): GameState {
  return withLock(() => {
    currentGame = appointOfficer(
      getGame(),
      officerId,
      track,
      position,
      cityId != null ? cityId : undefined,
    );
    return getClientGame();
  });
}

export function doTribute(targetFactionId: number): GameState {
  return withLock(() => {
    currentGame = tributeGold(getGame(), targetFactionId);
    return getClientGame();
  });
}

export function doGiftBeautyDip(targetFactionId: number, amount?: number): GameState {
  return withLock(() => {
    currentGame = giftBeautyStock(
      getGame(),
      targetFactionId,
      amount != null ? amount : 1,
    );
    return getClientGame();
  });
}

export function doAlliance(targetFactionId: number): GameState {
  return withLock(() => {
    currentGame = formAlliance(getGame(), targetFactionId);
    return getClientGame();
  });
}

export function doRecruitSpies(cityId: number): GameState {
  return withLock(() => {
    currentGame = recruitSpies(getGame(), cityId);
    return getClientGame();
  });
}

export function doTrainFemaleSpy(cityId: number): GameState {
  return withLock(() => {
    currentGame = trainFemaleSpy(getGame(), cityId);
    return getClientGame();
  });
}

/** 献美→点化女间谍 */
export function doPlantFemale(targetFactionId: number, homeCityId?: number): GameState {
  return withLock(() => {
    currentGame = plantFemaleFromGift(getGame(), targetFactionId, homeCityId);
    return getClientGame();
  });
}

export function doSpyMission(
  agentId: string,
  type: string,
  targetCityId: number,
  targetOfficerId?: number,
): GameState {
  return withLock(() => {
    currentGame = dispatchMission(getGame(), {
      agentId,
      type: type as SpyMissionType,
      targetCityId,
      targetOfficerId,
    });
    return getClientGame();
  });
}

export function doStationCounter(agentId: string, cityId: number): GameState {
  return withLock(() => {
    currentGame = stationCounter(getGame(), agentId, cityId);
    return getClientGame();
  });
}

export function doUnstationCounter(cityId: number): GameState {
  return withLock(() => {
    currentGame = unstationCounter(getGame(), cityId);
    return getClientGame();
  });
}

export function doResolveCaptive(agentId: string, action: string): GameState {
  return withLock(() => {
    currentGame = resolveCaptive(
      getGame(),
      agentId,
      action as SpyCaptiveAction,
    );
    return getClientGame();
  });
}

export function doLaunchPlot(
  type: string,
  targetFactionId: number | undefined,
  targetCityId: number | undefined,
  targetOfficerId: number | undefined,
  agentId: string | undefined,
): GameState {
  return withLock(() => {
    currentGame = launchPlot(getGame(), {
      type: type as PlotType,
      targetFactionId,
      targetCityId,
      targetOfficerId,
      agentId: agentId || undefined,
    });
    return getClientGame();
  });
}

export function doJoinFaction(officerId: number, factionId: number, cityId?: number): GameState {
  return withLock(() => {
    const state = getGame();
    // Sec-2: 仅允许将**在野**武将加入**玩家自己势力**，防止越权注入他方势力
    const officer = state.officers[officerId];
    if (!officer) throw new Error('武将不存在');
    if (officer.faction != null) throw new Error('该武将已有势力，不可直接加入');
    if (factionId !== state.playerFactionId) {
      throw new Error('仅可招募武将加入己方势力');
    }
    currentGame = joinFaction(state, officerId, factionId, cityId);
    return getClientGame();
  });
}

export function doReleaseOfficer(officerId: number): GameState {
  return withLock(() => {
    const state = getGame();
    // Sec-1: 仅允许释放**己方势力**武将，防止越权瓦解他方
    const officer = state.officers[officerId];
    if (!officer) throw new Error('武将不存在');
    if (officer.faction !== state.playerFactionId) {
      throw new Error('仅可释放己方势力武将');
    }
    currentGame = releaseOfficer(state, officerId);
    return getClientGame();
  });
}

export function doFollowCheck(): GameState {
  return withLock(() => {
    currentGame = tickFollowCheck(getGame());
    return getClientGame();
  });
}

export function canMarchTo(targetCityId: number): boolean {
  return isMarchTargetReachable(getGame(), targetCityId);
}

/**
 * 兼容旧路径：无 fromCity 时自动选最近己方城出征；
 * 若仍无可用城则回退为纯演示战（不扣兵、不占城）。
 */
export function startBattle(cityId: number, fromCityId?: number): BattleState {
  return withLock(() => {
    const state = getGame();
    const from = fromCityId ?? pickDefaultFromCity(state, cityId);
    if (from != null) {
      const result = prepareMarch(state, { fromCityId: from, targetCityId: cityId });
      commitActiveBattle(result.battle, result.state);
      return result.battle;
    }
    const battle = createBattle(state, cityId);
    commitActiveBattle(battle, state);
    return battle;
  });
}

/** Demo 出征：明确出发城 + 可选兵力 */
export function startMarch(
  targetCityId: number,
  fromCityId?: number,
  troopCount?: number,
): { game: GameState; battle: BattleState } {
  return withLock(() => {
    const state = getGame();
    const from = fromCityId ?? pickDefaultFromCity(state, targetCityId);
    if (from == null) throw new Error('没有可出征的己方城（需至少 1000 兵）');
    const result = prepareMarch(state, {
      fromCityId: from,
      targetCityId,
      troopCount,
    });
    // 出征即获表面战地情报
    const stateWithIntel = grantBattleIntel(result.state, targetCityId);
    commitActiveBattle(result.battle, stateWithIntel);
    return { game: getClientGame(), battle: result.battle };
  });
}

export function getBattle(): BattleState | null {
  return getActiveBattle();
}

export function battleMove(unitId: string, q: number, r: number): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = moveUnit(battle, unitId, q, r);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

export function battleAttack(attackerId: string, defenderId: string): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = attackUnit(battle, attackerId, defenderId, getGame());
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

export function battleFire(attackerId: string, targetId: string): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = castFireTactic(battle, attackerId, targetId, getGame());
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 战法施放 */
export function battleAbility(attackerId: string, targetId: string, abilityId: string): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = castAbility(battle, attackerId, targetId, abilityId, getGame());
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 查询可用战法列表 */
export function battleUsableAbilities(unitId: string): { id: string; name: string; level: number; energyCost: number; power: number; specialEffect: string; minRange: number; maxRange: number }[] {
  const battle = getActiveBattle();
  if (!battle) return [];
  const abilities = getUsableAbilities(getGame(), battle, unitId);
  return abilities.map(({ ability, level, levelData }) => ({
    id: ability.id,
    name: ability.name,
    level,
    energyCost: levelData.energyCost,
    power: levelData.power,
    specialEffect: ability.specialEffect,
    minRange: ability.minRange,
    maxRange: ability.maxRange,
  }));
}

export function battleFinishPlayer(): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = finishPlayerAction(battle);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 §8 玩家发起单挑 */
export function battleChallengeDuel(challengerUnitId: string, targetUnitId: string): BattleState {
  return withLock(() => {
    const activeBattle = getActiveBattle();
    if (!activeBattle) throw new Error('无战斗');
    const { battle, accepted } = challengeDuel(activeBattle, challengerUnitId, targetUnitId, getGame());
    if (!accepted) {
      commitActiveBattle(battle);
      return battle;
    }
    // 接受后立即自动推进首回合 (全自动结算) — 内联避免嵌套锁
    const nextBattle = stepBattleDuel(battle, getGame());
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 §8 推进单挑一回合 (观看演出) */
export function battleDuelStep(): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = stepBattleDuel(battle, getGame());
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 §8 跳过单挑动画直接结算 */
export function battleDuelSkip(): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = skipBattleDuel(battle, getGame());
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

export function battleEnemyPhase(): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = runEnemyPhase(battle, getGame());
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

export function battleMoveRange(unitId: string): string[] {
  const battle = getActiveBattle();
  if (!battle) return [];
  return getMoveRange(battle, unitId);
}

/** 退出战场并结算占城/残兵回流，返回最新 GameState */
export function exitBattle(): GameState {
  return withLock(() => {
    const state = getGame();
    const battle = getActiveBattle(state);
    if (!battle) return getClientGame();
    let nextState = state;
    if (!battle.settled && battle.fromCityId != null) {
      nextState = settleBattle(state, battle);
    } else if (!battle.settled && battle.cityId != null && battle.phase === 'over') {
      // 无出发城的旧演示战：胜也不占城，仅记日志
      if (battle.winner === 'attacker') {
        nextState = {
          ...state,
          actionLog: [
            {
              year: state.currentYear,
              month: state.currentMonth,
              type: 'battle_demo',
              message: `演示战胜利（未关联出征，未改城池归属）`,
            },
            ...state.actionLog,
          ].slice(0, 80),
        };
      }
    }
    commitActiveBattle(null, nextState);
    return getClientGame();
  });
}

export function suggestFromCity(targetCityId: number): number | null {
  return pickDefaultFromCity(getGame(), targetCityId);
}

export function listStatic() {
  return {
    officers: staticData.officers.length,
    cities: staticData.cities,
    units: staticData.units,
    formations: staticData.formations,
    children: staticData.children.map((c) => ({
      childId: c.childId,
      childName: c.childName,
      fatherId: c.fatherId,
      motherId: c.motherId,
      birthYear: c.birthYear,
      appearYear: c.appearYear,
      source: c.source,
    })),
    /** 事件目录（不含 effects，防剧透；效果仅服务端应用） */
    events: staticData.events.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description,
      category: e.category,
      sourceClass: e.sourceClass,
      sources: e.sources,
      dialogues: e.dialogues,
      choices: e.choices.map((c) => ({ label: c.label })),
    })),
    scenarios: staticData.scenarios.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      description: s.description,
      startYear: s.startYear,
      startMonth: s.startState.month,
      scopeNote: s.scopeNote,
      playableFactions: s.playableFactions,
      recommendedFaction: s.recommendedFaction,
      factionSetups: s.factionSetups,
      availableEventLayers: s.availableEventLayers,
      defaultEventLayers: s.defaultEventLayers,
    })),
  };
}

// ====== 战役层 service（05 §十二~§十七） ======

/** 战役：编成出征 */
export function campaignStart(opts: CampaignFormationOptions): { game: GameState; army: CampaignArmy } {
  return withLock(() => {
    const result = campaignStartCampaign(getGame(), opts);
    currentGame = result.state;
    return { game: getClientGame(), army: result.army };
  });
}

/** 战役：行军指令 */
export function campaignMarch(armyId: string, targetNodeId: number): GameState {
  return withLock(() => {
    currentGame = campaignOrderMarch(getGame(), armyId, targetNodeId);
    return getClientGame();
  });
}

/** 战役：建造设施 */
export function campaignBuild(armyId: string, structureType: StructureType): GameState {
  return withLock(() => {
    currentGame = campaignBuildStructure(getGame(), armyId, structureType);
    return getClientGame();
  });
}

/** 战役：强攻（自动战斗结算） */
export function doCampaignAssault(armyId: string): { game: GameState; result: import('@leh/shared').AutoBattleResult } {
  return withLock(() => {
    const result = campaignAssaultEngine(getGame(), armyId);
    currentGame = result.state;
    return { game: getClientGame(), result: result.result };
  });
}

/** 战役：劝降 */
export function campaignSiegeSurrender(armyId: string): { game: GameState; success: boolean } {
  return withLock(() => {
    const result = campaignTrySiegeSurrender(getGame(), armyId);
    currentGame = result.state;
    return { game: getClientGame(), success: result.success };
  });
}

/** 战役：撤退 */
export function campaignRetreat(armyId: string): GameState {
  return withLock(() => {
    currentGame = campaignRetreatArmy(getGame(), armyId);
    return getClientGame();
  });
}

/** 战役：参谋行动 */
export function campaignAdvisor(armyId: string, action: AdvisorAction): GameState {
  return withLock(() => {
    currentGame = campaignAdvisorAction(getGame(), armyId, action);
    return getClientGame();
  });
}

/** 战役：获取节点状态 */
export function campaignNodes(): CampaignNode[] {
  return getCampaignNodes(getGame());
}

// ====== 战场地图（Tier I） ======

/** 为指定城市生成战场地图 */
export function battlefieldInit(targetCityId: number, fromCityId: number): BattlefieldMap {
  return withLock(() => {
    const state = getGame();
    const nodes = extractBattlefieldNodes(state, targetCityId, fromCityId);

    const targetCity = state.cities[targetCityId];
    const fromCity = state.cities[fromCityId];
    if (!targetCity || !fromCity) throw new Error('城市不存在');
    if (fromCity.ruler !== state.playerFactionId) throw new Error('出发城市不属于玩家势力');
    if (targetCity.ruler == null) throw new Error('中立城市没有可进入白刃战的防守势力');
    if (targetCity.ruler === state.playerFactionId) throw new Error('不能对己方城市初始化战场');

    const bfId = `bf-${targetCityId}-${fromCityId}-${Date.now() % 100000}`;
    const warId = `war-${targetCityId}-${Date.now() % 10000}`;

    const battlefieldArmyIds = [...new Set(nodes.flatMap((node) => node.armyIds))];
    const battlefield = generateBattlefield(
      bfId, warId, nodes,
      state.playerFactionId,
      targetCity.ruler,
      targetCityId,
      battlefieldArmyIds,
    );

    currentGame = { ...state, activeBattlefield: battlefield, activeMelee: null };
    return battlefield;
  });
}

/** 获取当前战场地图 */
export function getBattlefield(): BattlefieldMap | null {
  return getGame().activeBattlefield;
}

/** 执行战场行军（设置目标并推进一回合） */
export function battlefieldMarch(armyId: string, targetNodeId: number): { game: GameState; battlefield: BattlefieldMap } {
  return withLock(() => {
    const state = getGame();
    const battlefield = state.activeBattlefield;
    if (!battlefield) throw new Error('没有活跃战场');

    const army = state.campaignArmies.find((a) => a.id === armyId);
    if (!army) throw new Error('Army 不存在');

    // 验证目标在战场节点中且邻接
    const targetNode = battlefield.nodes.find((n) => n.id === targetNodeId);
    if (!targetNode) throw new Error('目标节点不在战场范围内');
    if (!targetNode.adjacentNodeIds.includes(army.currentNodeId)) {
      throw new Error('目标节点不邻接当前节点');
    }

    // 设置行军目标并切换行军阶段
    const armiesWithPath = state.campaignArmies.map((a) =>
      a.id === armyId
        ? { ...a, path: [targetNodeId], targetNodeId, phase: 'marching' as const }
        : a,
    );
    const stateWithPath = { ...state, campaignArmies: armiesWithPath };

    // 推进一回合行军
    const marchResult = tickBattlefieldMarch(stateWithPath, battlefield);
    currentGame = { ...marchResult.state, activeBattlefield: marchResult.battlefield };

    // 到达目标 → 围城或野战
    const updatedArmy = currentGame.campaignArmies.find((a) => a.id === armyId);
    if (updatedArmy && updatedArmy.path.length === 0) {
      const tCity = state.cities[targetNodeId];
      if (tCity && tCity.ruler !== state.playerFactionId) {
        currentGame = {
          ...currentGame!,
          actionLog: [{ year: state.currentYear, month: state.currentMonth, type: 'battlefield', message: `${army.name} 抵达 ${tCity?.name ?? '目标'}，进入围城` }, ...currentGame!.actionLog].slice(0, 80),
        } as GameState;
      }
    }

    return { game: getClientGame(), battlefield: getGame().activeBattlefield! };
  });
}

/** 退出战场，返回行政大地图 */
export function battlefieldExit(): GameState {
  return withLock(() => {
    currentGame = { ...getGame(), activeBattlefield: null, activeMelee: null };
    return getClientGame();
  });
}

// ====== 白刃战（Tier II） ======

/** 发起白刃战（两军同节点时调用） */
export function meleeStart(
  attackerArmyId: string,
  defenderArmyId: string,
): { game: GameState; melee: MeleeState } {
  return withLock(() => {
    const state = getGame();
    const atkArmy = state.campaignArmies.find((a) => a.id === attackerArmyId);
    const defArmy = state.campaignArmies.find((a) => a.id === defenderArmyId);
    if (!atkArmy || !defArmy) throw new Error('Army 不存在');
    const battlefield = state.activeBattlefield;
    if (!battlefield) throw new Error('没有活跃战场');
    if (attackerArmyId === defenderArmyId) throw new Error('白刃战双方不能是同一支 Army');
    if (atkArmy.factionId === defArmy.factionId) throw new Error('白刃战双方必须属于敌对势力');
    if (atkArmy.currentNodeId !== defArmy.currentNodeId) throw new Error('白刃战双方必须位于同一节点');
    if (!battlefield.armyIds.includes(attackerArmyId) || !battlefield.armyIds.includes(defenderArmyId)) {
      throw new Error('白刃战双方必须属于当前战场');
    }

    const atkCommander = state.officers[atkArmy.commanderId];

    const melee = createMeleeState(
      battlefield.id,
      attackerArmyId,
      defenderArmyId,
      atkArmy.factionId,
      defArmy.factionId,
      atkArmy.troops,
      defArmy.troops,
      atkArmy.formation,
      defArmy.formation,
      atkCommander?.stats.intelligence ?? 50,
    );

    currentGame = { ...state, activeMelee: melee };
    return { game: getClientGame(), melee };
  });
}

/** 获取当前白刃战状态 */
export function getMelee(): MeleeState | null {
  return getGame().activeMelee;
}

/** 执行一回合白刃战 */
export function meleeRound(
  actionType: string,
): { game: GameState; result: import('@leh/shared').MeleeRoundResult; melee: MeleeState } {
  return withLock(() => {
    const state = getGame();
    const melee = state.activeMelee;
    if (!melee) throw new Error('没有活跃白刃战');
    if (melee.phase !== 'active') throw new Error('白刃战已结束');
    const atkArmy = state.campaignArmies.find((a) => a.id === melee.attackerArmyId);
    const atkCommander = atkArmy ? state.officers[atkArmy.commanderId] : undefined;

    const typedAction = actionType as import('@leh/shared').TacticalActionType;
    const cost = getTacticalActionCost(typedAction);
    if (cost === null) throw new Error('未知的白刃战行动');
    if (melee.tacticalPoints < cost) throw new Error('战术点不足');
    const action = { type: typedAction };
    const result = runMeleeRound(melee, action, atkCommander?.stats.intelligence ?? 50);

    const nextMelee = applyMeleeRoundResult(melee, result, cost);
    currentGame = { ...state, activeMelee: nextMelee };

    // 如果战斗结束，同步回战场地图数据
    if (result.phase !== 'active' && state.activeBattlefield) {
      const atkRemaining = result.attackerTroopsAfter;
      const defRemaining = result.defenderTroopsAfter;

      currentGame = {
        ...getGame(),
        campaignArmies: getGame().campaignArmies.map((a) => {
          if (a.id === nextMelee.attackerArmyId) {
            return { ...a, troops: atkRemaining, morale: result.attackerMoraleAfter };
          }
          if (a.id === nextMelee.defenderArmyId) {
            return { ...a, troops: defRemaining, morale: result.defenderMoraleAfter };
          }
          return a;
        }),
      };
    }

    return { game: getClientGame(), result, melee: getGame().activeMelee! };
  });
}

/** 刷新白刃战战术点 */
export function meleeRefresh(): MeleeState {
  return withLock(() => {
    const state = getGame();
    const melee = state.activeMelee;
    if (!melee) throw new Error('没有活跃白刃战');
    const atkArmy = state.campaignArmies.find((a) => a.id === melee.attackerArmyId);
    const int = atkArmy ? (state.officers[atkArmy.commanderId]?.stats.intelligence ?? 50) : 50;
    const nextMelee = refreshMeleeState(melee, int);
    currentGame = { ...state, activeMelee: nextMelee };
    return nextMelee;
  });
}

/** 退出白刃战 */
export function meleeExit(): { game: GameState } {
  return withLock(() => {
    currentGame = { ...getGame(), activeMelee: null };
    return { game: getClientGame() };
  });
}

// ====== 总军师系统（§十四/§二十.2.6） ======

/** 任命总军师 */
export function grandStrategistAppoint(officerId: number): { game: GameState; strategist: import('@leh/shared').GrandStrategist } {
  return withLock(() => {
    const state = getGame();
    const result = gsAppoint(state, state.playerFactionId, officerId);
    currentGame = result.state;
    return { game: getClientGame(), strategist: result.strategist };
  });
}

/** 解职总军师 */
export function grandStrategistDismiss(): { game: GameState; log: string } {
  return withLock(() => {
    const state = getGame();
    const result = gsDismiss(state, state.playerFactionId);
    currentGame = result.state;
    return { game: getClientGame(), log: result.log };
  });
}

/** 切换态势 */
export function grandStrategistSwitch(newStrategy: string): { game: GameState; log: string } {
  return withLock(() => {
    const state = getGame();
    const result = gsSwitchStrategy(state, state.playerFactionId, newStrategy as import('@leh/shared').StrategyType);
    currentGame = result.state;
    return { game: getClientGame(), log: result.log };
  });
}

/** 获取当前势力态势加成 */
export function grandStrategistStatus(): {
  strategist: import('@leh/shared').GrandStrategist | null;
  modifiers: ReturnType<typeof calcStrategyModifiers>;
  hasStrategist: boolean;
} {
  const state = getGame();
  const gs = state.grandStrategists.find((g) => g.factionId === state.playerFactionId) ?? null;
  const { strategy, hasStrategist } = getFactionStrategy(state, state.playerFactionId);
  const int = gs ? (state.officers[gs.officerId]?.stats.intelligence ?? 85) : 85;
  const mods = calcStrategyModifiers(strategy, int);
  return { strategist: gs, modifiers: mods, hasStrategist };
}
