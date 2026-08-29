// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  NobilityRank,
  OfficerStatus,
  grantMerit,
  maskGameStateForPlayer,
  setTournamentPreferredMode,
  setTournamentPlayerEntries,
  placeTournamentChampionBet,
  clearTournamentChampionBet,
  type BattleState,
  type EventSourceClass,
  type GameState,
  type Officer,
  PolicyType,
  type FamilyTreatmentMode,
  type DelegationPolicyLike,
} from '@leh/shared';
import { adoptSaveEnvelope, buildGameState, buildSaveEnvelope, runEndTurnPipeline } from '../engine/state-pipeline.js';
import { staticData } from '../data/loader.js';
import { duelEquipBonusFor, equipItem, grantTreasure, unequipItem } from '../engine/items.js';
import {
  conscript,
  developCity,
  developFarm,
  relief,
  trainTroops,
  setCivilianFarming,
  setMilitaryFarming,
  relocateGarrisonFamilies,
  type DevelopKind,
} from '../engine/civil.js';
import { buyArms, patrolCity, reclaimLand, resolveImpeachment } from '../engine/factionPolitics.js';
import { resolveFamilyTreatment } from '../engine/hostageFamilies.js';
import {
  assignDelegationCity,
  createDelegationRegion,
  disbandDelegationRegion,
  updateDelegationRegion,
} from '../engine/delegation.js';
import {
  lootBeautyOnCapture,
  rewardBeautyStock,
  seekBeauty,
} from '../engine/beauty.js';
import {
  attackUnit,
  castAbility,
  castFireTactic,
  castWeatherSkill,
  changeBattleFormation,
  challengeDuel,
  createBattle,
  finishPlayerAction,
  getMoveRange,
  getMovePath,
  getUsableAbilities,
  moveUnit,
  runEnemyPhase,
  retreatBattle,
  skipBattleDuel,
  stepBattleDuel,
  undoLastBattleAction,
  settleTacticalMeleeTroops,
  collectAnnihilatedDefenderCommanders,
} from '../engine/battle.js';
import {
  advisorAction as campaignAdvisorAction,
  assault as campaignAssaultEngine,
  buildStructure as campaignBuildStructure,
  getCampaignNodes,
  orderMarch as campaignOrderMarch,
  retreatArmy as campaignRetreatArmy,
  runAutoBattle,
  startCampaign as campaignStartCampaign,
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
  marryFemale,
  recruitOfficer,
  searchTalent,
} from '../engine/personnel.js';
import { grantBattleIntel } from '../engine/intel.js';
import { formAlliance, transferCourtNetwork, tributeGold } from '../engine/diplomacy.js';
import {
  declareWarByFalseDecree,
  establishHegemony,
  getKingRequirements,
  proclaimKing,
} from '../engine/hegemony.js';
import { launchPlot, cancelPlot } from '../engine/plot.js';
import { setNationalPolicy } from '../engine/policy.js';
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
import { buildAnnualBudget } from '../engine/budget.js';
import { extractBattlefieldNodes, generateBattlefield, tickBattlefieldMarch } from '../engine/battlefield.js';
import { applyMeleeRoundResult, applyMeleeSettlement, createMeleeState, getTacticalActionCost, refreshMeleeState, runMeleeRound } from '../engine/meleeRound.js';
import {
  appointGrandStrategist as gsAppoint,
  dismissGrandStrategist as gsDismiss,
  switchStrategy as gsSwitchStrategy,
  getFactionStrategy,
  calcStrategyModifiers,
} from '../engine/grandStrategist.js';
import { resolveEventChoice } from '../engine/event.js';
import { appointOfficer } from '../engine/appoint.js';
import { grantNobility } from '../engine/nobility.js';
import { broadcast } from '../ws/broadcast.js';
import { listSaveSlots, readSaveSlot, writeSaveSlot, type SaveSlotMeta } from './save-store.js';
import { getRuntimeRngState, resetRuntimeRng, restoreRuntimeRng, runtimeRandom } from '../runtime-rng.js';
import { createDuel, DEFAULT_DUEL_CONFIG, runDuelToCompletion, stepDuel } from '../battle/duel.js';
import { PlotType, SpyCaptiveAction, SpyMissionType, type BattlefieldDuelContext, type BattlefieldInstance, type BattlefieldMap, type CampaignArmy, type CampaignFormationOptions, type CampaignNode, type DuelStance, type MeleeEntryMode, type MeleeState, type PositionTrack, type StructureType, FIRST_BATCH_COUNTY_IDS, generateCommanderyBattlefield, getCommanderyIds, getCommanderyTemplate } from '@leh/shared';

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

/** 服务端真源（全量，勿直接下发客户端） */
export function getGame(): GameState {
  if (!currentGame) throw new Error('尚无进行中的游戏');
  return currentGame;
}

/** 导出浏览器文件用的完整权威存档信封；不使用脱敏客户端投影。 */
export function exportSaveEnvelope() {
  return buildSaveEnvelope(getGame(), getRuntimeRngState());
}

export function listDiskSaveSlots(): SaveSlotMeta[] {
  return listSaveSlots();
}

export function saveGameToDisk(slot: string): SaveSlotMeta {
  return writeSaveSlot(slot, exportSaveEnvelope());
}

export function loadGameFromDisk(slot: string): GameState {
  return restoreGameFromEnvelope(readSaveSlot(slot));
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
    const adopted = adoptSaveEnvelope(input);
    restoreRuntimeRng(adopted.rng);
    currentGame = adopted.snapshot;
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
    if (before.pendingFamilyTreatment) {
      throw new Error('请先处理家属处置');
    }
    broadcast({ type: 'turn_progress', phase: 'ai', message: '回合结算中…', progress: 10 });
    currentGame = runEndTurnPipeline(before, runtimeRandom);
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
    if (g.pendingFamilyTreatment) {
      broadcast({
        type: 'event_triggered',
        name: 'family_treatment',
        message: `待处置家属 ${g.pendingFamilyTreatment.familyCount} 口`,
      });
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
    const officerId = getGame().cities[cityId]?.officers[0];
    if (officerId == null) throw new Error('本城没有可指派武将');
    currentGame = developFarm(getGame(), cityId, officerId);
    return getClientGame();
  });
}

export function getAnnualBudget() {
  const game = getGame();
  return buildAnnualBudget(game, game.playerFactionId);
}

export function doDevelop(cityId: number, kind: DevelopKind, officerId?: number): GameState {
  return withLock(() => {
    const assignedOfficerId = officerId ?? getGame().cities[cityId]?.officers[0];
    if (assignedOfficerId == null) throw new Error('本城没有可指派武将');
    currentGame = developCity(getGame(), cityId, kind, assignedOfficerId);
    return getClientGame();
  });
}

export function doConscript(cityId: number): GameState {
  return withLock(() => {
    currentGame = conscript(getGame(), cityId, runtimeRandom);
    return getClientGame();
  });
}

export function doRelief(cityId: number): GameState {
  return withLock(() => {
    currentGame = relief(getGame(), cityId, runtimeRandom);
    return getClientGame();
  });
}

export function doSetCivilianFarming(cityId: number, households: number): GameState {
  return withLock(() => {
    currentGame = setCivilianFarming(getGame(), cityId, households);
    return getClientGame();
  });
}

export function doSetMilitaryFarming(cityId: number, enabled: boolean): GameState {
  return withLock(() => {
    currentGame = setMilitaryFarming(getGame(), cityId, enabled);
    return getClientGame();
  });
}

export function doRelocateGarrisonFamilies(fromCityId: number, toCityId: number): GameState {
  return withLock(() => {
    currentGame = relocateGarrisonFamilies(getGame(), fromCityId, toCityId);
    return getClientGame();
  });
}

export function doResolveFamilyTreatment(mode: FamilyTreatmentMode): GameState {
  return withLock(() => {
    currentGame = resolveFamilyTreatment(getGame(), mode);
    return getClientGame();
  });
}

// ====== 委任军团（docs/04 §39 + docs/42，S15；与 worker 镜像同源） ======

export function doCreateDelegationRegion(input: {
  name?: string;
  cityIds: number[];
  governorId: number;
  policy?: string;
  autoRecruit?: boolean;
  autoReward?: boolean;
}): GameState {
  return withLock(() => {
    currentGame = createDelegationRegion(getGame(), {
      name: input.name,
      cityIds: input.cityIds,
      governorId: input.governorId,
      policy: input.policy as DelegationPolicyLike,
      autoRecruit: input.autoRecruit,
      autoReward: input.autoReward,
    });
    return getClientGame();
  });
}

export function doUpdateDelegationRegion(input: {
  regionId: number;
  name?: string;
  policy?: string;
  autoRecruit?: boolean;
  autoReward?: boolean;
}): GameState {
  return withLock(() => {
    currentGame = updateDelegationRegion(getGame(), {
      regionId: input.regionId,
      name: input.name,
      policy: input.policy as DelegationPolicyLike | undefined,
      autoRecruit: input.autoRecruit,
      autoReward: input.autoReward,
    });
    return getClientGame();
  });
}

export function doAssignDelegationCity(input: { regionId: number; cityId: number; remove?: boolean }): GameState {
  return withLock(() => {
    currentGame = assignDelegationCity(getGame(), input);
    return getClientGame();
  });
}

export function doDisbandDelegationRegion(regionId: number): GameState {
  return withLock(() => {
    currentGame = disbandDelegationRegion(getGame(), regionId);
    return getClientGame();
  });
}

export function doSetNationalPolicy(type: string, targetCityId?: number): GameState {
  return withLock(() => {
    currentGame = setNationalPolicy(getGame(), type as PolicyType, {
      targetCityId,
    });
    return getClientGame();
  });
}

export function doSetTournamentPreferredMode(mode: string): GameState {
  return withLock(() => {
    if (mode !== 'fair' && mode !== 'unrestricted') {
      throw new Error('无效的大会模式');
    }
    currentGame = setTournamentPreferredMode(getGame(), mode);
    return getClientGame();
  });
}

export function doSetTournamentPlayerEntries(officerIds: number[]): GameState {
  return withLock(() => {
    const result = setTournamentPlayerEntries(getGame(), officerIds);
    currentGame = result.state;
    return getClientGame();
  });
}

export function doPlaceTournamentChampionBet(officerId: number, amount: number): GameState {
  return withLock(() => {
    currentGame = placeTournamentChampionBet(getGame(), officerId, amount);
    return getClientGame();
  });
}

export function doClearTournamentChampionBet(): GameState {
  return withLock(() => {
    currentGame = clearTournamentChampionBet(getGame());
    return getClientGame();
  });
}

export function doTrain(cityId: number): GameState {
  return withLock(() => {
    currentGame = trainTroops(getGame(), cityId, runtimeRandom);
    return getClientGame();
  });
}

/** S27 开垦：乡政派系命令（docs/34 §四 1） */
export function doReclaimLand(cityId: number, officerId: number): GameState {
  return withLock(() => {
    currentGame = reclaimLand(getGame(), cityId, officerId, runtimeRandom);
    return getClientGame();
  });
}

/** S27 巡查：乡政派系命令（docs/34 §四 2） */
export function doPatrolCity(cityId: number, officerId: number): GameState {
  return withLock(() => {
    currentGame = patrolCity(getGame(), cityId, officerId, runtimeRandom);
    return getClientGame();
  });
}

/** S27 兵装采购：10 金/件（docs/34 §五） */
export function doBuyArms(amount: number): GameState {
  return withLock(() => {
    currentGame = buyArms(getGame(), amount);
    return getClientGame();
  });
}

/** S27 深化：弹劾处理（docs/34 §十一）——安抚（appease）或撤换城主（remove） */
export function doResolveImpeachment(cityId: number, action: 'appease' | 'remove'): GameState {
  return withLock(() => {
    currentGame = resolveImpeachment(getGame(), cityId, action);
    return getClientGame();
  });
}

export function doSeekBeauty(cityId: number): GameState {
  return withLock(() => {
    currentGame = seekBeauty(getGame(), cityId, runtimeRandom);
    return getClientGame();
  });
}

export function doRewardBeautyStock(officerId: number, amount?: number): GameState {
  return withLock(() => {
    currentGame = rewardBeautyStock(getGame(), officerId, amount);
    return getClientGame();
  });
}

/** 占城接管地方人脉（内部） */
export function applyLootBeauty(cityId: number, attackerFactionId: number): void {
  withLock(() => {
    currentGame = lootBeautyOnCapture(getGame(), cityId, attackerFactionId, runtimeRandom);
  });
}

export function doMarry(femaleId: number, officerId: number): GameState {
  return withLock(() => {
    currentGame = marryFemale(getGame(), femaleId, officerId);
    return getClientGame();
  });
}

export function doSearchTalent(cityId: number): GameState {
  return withLock(() => {
    currentGame = searchTalent(getGame(), cityId, runtimeRandom);
    return getClientGame();
  });
}

/** S13 宝物装备（Session 266）。 */
export function doEquipItem(officerId: number, itemId: number): GameState {
  return withLock(() => {
    currentGame = equipItem(getGame(), officerId, itemId);
    return getClientGame();
  });
}

/** S13 宝物卸下。 */
export function doUnequipItem(officerId: number, itemId: number): GameState {
  return withLock(() => {
    currentGame = unequipItem(getGame(), officerId, itemId);
    return getClientGame();
  });
}

/** S13 宝物赏赐（04 §11.1：忠诚+5~20 按品质 + 自动装备）。 */
export function doGrantTreasure(officerId: number, itemId: number): GameState {
  return withLock(() => {
    currentGame = grantTreasure(getGame(), officerId, itemId);
    return getClientGame();
  });
}

export function doRecruitOfficer(officerId: number, recruiterId?: number): GameState {
  return withLock(() => {
    currentGame = recruitOfficer(
      getGame(),
      officerId,
      runtimeRandom,
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

export function doGrantNobility(officerId: number, targetRank: NobilityRank): GameState {
  return withLock(() => {
    currentGame = grantNobility(
      getGame(),
      getGame().playerFactionId,
      officerId,
      targetRank,
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

export function doTransferCourtNetwork(targetFactionId: number, amount?: number): GameState {
  return withLock(() => {
    currentGame = transferCourtNetwork(
      getGame(),
      targetFactionId,
      amount != null ? amount : 1,
    );
    return getClientGame();
  });
}

export function doAlliance(targetFactionId: number): GameState {
  return withLock(() => {
    currentGame = formAlliance(getGame(), targetFactionId, runtimeRandom);
    return getClientGame();
  });
}

export function doEstablishHegemony(): GameState {
  return withLock(() => {
    currentGame = establishHegemony(getGame(), getGame().playerFactionId);
    return getClientGame();
  });
}

/** HC-P1-5：朝廷抽屉只读称王门槛；候选与阈值始终来自权威引擎。 */
export function getCurrentKingRequirements() {
  return getKingRequirements(getGame(), getGame().playerFactionId);
}

/** HC-P1-2：服务层只编排权威 proclaimKing；withLock 拦截并发朝廷写操作。 */
export function doProclaimKing(kingdomName: string): GameState {
  return withLock(() => {
    currentGame = proclaimKing(getGame(), getGame().playerFactionId, kingdomName);
    return getClientGame();
  });
}

export function doFalseDecreeWar(targetFactionId: number): GameState {
  return withLock(() => {
    currentGame = declareWarByFalseDecree(
      getGame(),
      getGame().playerFactionId,
      targetFactionId,
    );
    return getClientGame();
  });
}

export function doRecruitSpies(cityId: number): GameState {
  return withLock(() => {
    currentGame = recruitSpies(getGame(), cityId, runtimeRandom);
    return getClientGame();
  });
}

export function doTrainFemaleSpy(cityId: number): GameState {
  return withLock(() => {
    currentGame = trainFemaleSpy(getGame(), cityId, runtimeRandom);
    return getClientGame();
  });
}

/** 宫廷牵线→人脉掩护女间谍 */
export function doPlantFemale(targetFactionId: number, homeCityId?: number): GameState {
  return withLock(() => {
    currentGame = plantFemaleFromGift(getGame(), targetFactionId, runtimeRandom, homeCityId);
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
    }, runtimeRandom);
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
  casterOfficerId?: number,
  feintCityId?: number,
  secondaryFactionId?: number,
): GameState {
  return withLock(() => {
    currentGame = launchPlot(getGame(), {
      type: type as PlotType,
      targetFactionId,
      targetCityId,
      feintCityId,
      secondaryFactionId,
      targetOfficerId,
      agentId: agentId || undefined,
      casterOfficerId,
    }, runtimeRandom);
    return getClientGame();
  });
}

export function doCancelPlot(plotId: string): GameState {
  return withLock(() => {
    currentGame = cancelPlot(getGame(), plotId);
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
    currentGame = joinFaction(state, officerId, factionId, runtimeRandom, cityId);
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
    currentGame = tickFollowCheck(getGame(), runtimeRandom);
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

export function battleUndo(): BattleState {
  return withLock(() => {
    const battle = getActiveBattle(); if (!battle) throw new Error('无战斗');
    const nextBattle = undoLastBattleAction(battle); commitActiveBattle(nextBattle); return nextBattle;
  });
}

export function battleAttack(attackerId: string, defenderId: string): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = attackUnit(battle, attackerId, defenderId, getGame(), runtimeRandom);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

export function battleFire(attackerId: string, targetId: string): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = castFireTactic(battle, attackerId, targetId, getGame(), runtimeRandom);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 05 §3.2 天气主动技能 */
export function battleWeather(attackerId: string, weather: string): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = castWeatherSkill(battle, attackerId, weather, getGame());
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 战法施放 */
export function battleAbility(attackerId: string, targetId: string, abilityId: string): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = castAbility(battle, attackerId, targetId, abilityId, getGame(), runtimeRandom);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 查询可用战法列表 */
export function battleUsableAbilities(unitId: string): {
  id: string;
  name: string;
  level: number;
  energyCost: number;
  power: number;
  specialEffect: string;
  minRange: number;
  maxRange: number;
  leveling: string;
  abilityUses: number;
}[] {
  const battle = getActiveBattle();
  if (!battle) return [];
  const state = getGame();
  const unit = battle.units.find((u) => u.id === unitId);
  const abilityUses = unit
    ? (state.officers[unit.commanderId]?.unitUsageRecords?.find((r) => r.unitType === unit.unitType)?.abilityUses ?? 0)
    : 0;
  const abilities = getUsableAbilities(state, battle, unitId);
  return abilities.map(({ ability, level, levelData }) => ({
    id: ability.id,
    name: ability.name,
    level,
    energyCost: levelData.energyCost,
    power: levelData.power,
    specialEffect: ability.specialEffect,
    minRange: ability.minRange,
    maxRange: ability.maxRange,
    leveling: ability.leveling,
    abilityUses: ability.leveling === 'proficiency' ? abilityUses : 0,
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

/** S10 六角战术撤退：标记有序撤出，随后由 exitBattle 统一回写残兵。 */
export function battleRetreat(): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = retreatBattle(battle);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

export function battleChangeFormation(unitId: string, targetFormation: import('@leh/shared').FormationType): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = changeBattleFormation(battle, unitId, targetFormation, getGame());
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 §8 玩家发起单挑 */
export function battleChallengeDuel(
  challengerUnitId: string,
  targetUnitId: string,
  stance: import('@leh/shared').DuelStance,
): BattleState {
  return withLock(() => {
    const activeBattle = getActiveBattle();
    if (!activeBattle) throw new Error('无战斗');
    const { battle, accepted } = challengeDuel(activeBattle, challengerUnitId, targetUnitId, getGame(), runtimeRandom, stance);
    if (!accepted) {
      commitActiveBattle(battle);
      return battle;
    }
    // 接受后立即自动推进首回合 (全自动结算) — 内联避免嵌套锁
    const nextBattle = stepBattleDuel(battle, getGame(), runtimeRandom);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 §8 推进单挑一回合 (观看演出) */
export function battleDuelStep(): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = stepBattleDuel(battle, getGame(), runtimeRandom);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

/** S10 §8 跳过单挑动画直接结算 */
export function battleDuelSkip(): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = skipBattleDuel(battle, getGame(), runtimeRandom);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

export function battleEnemyPhase(): BattleState {
  return withLock(() => {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    const nextBattle = runEnemyPhase(battle, getGame(), runtimeRandom);
    commitActiveBattle(nextBattle);
    return nextBattle;
  });
}

export function battleMoveRange(unitId: string): string[] {
  const battle = getActiveBattle();
  if (!battle) return [];
  return getMoveRange(battle, unitId);
}

export function battleMovePath(unitId: string, q: number, r: number) {
  const battle = getActiveBattle();
  if (!battle) throw new Error('无战斗');
  return getMovePath(battle, unitId, q, r);
}

/** 退出战场并结算占城/残兵回流，返回最新 GameState */
export function exitBattle(): GameState {
  return withLock(() => {
    const state = getGame();
    const battle = getActiveBattle(state);
    if (!battle) return getClientGame();
    const tacticalMelee = state.activeMelee?.entryMode === 'tactical'
      && state.activeMelee.tacticalBattleId === battle.id
      ? state.activeMelee
      : null;
  if (tacticalMelee) {
      if (battle.phase !== 'over') throw new Error('六角微操尚未结束，不能提前结算');
      // P1-3（Session 411）：结算口径收口到 engine 纯函数（撤退 50% 等价；攻方胜伤兵归队 15%）
      const tacticalSettlement = settleTacticalMeleeTroops(battle);
      const attackerTroops = tacticalSettlement.attackerTroops;
      const defenderTroops = tacticalSettlement.defenderTroops;
      // P1-3（Session 418）：战场生擒——攻方胜利且守方单位被歼，其主将径直被俘（确定性无掷点）
      // 战术撤退（voluntaryRetreat）不触发生擒；生擒语义=歼灭守方单位的战场后果
      const capturedIds = battle.winner === 'attacker'
        ? collectAnnihilatedDefenderCommanders(battle)
        : [];
      const resolved: MeleeState = {
        ...tacticalMelee,
        attackerTroops,
        defenderTroops,
        attackerMorale: battle.units.find((unit) => unit.side === 'attacker')?.morale ?? 0,
        defenderMorale: battle.units.find((unit) => unit.side === 'defender')?.morale ?? 0,
        attackerFormation: battle.units.find((unit) => unit.side === 'attacker')?.formation ?? tacticalMelee.attackerFormation,
        phase: battle.winner === 'attacker' ? 'attacker_victory' : 'defender_victory',
        eventLog: [...tacticalMelee.eventLog, `六角微操结算：${tacticalSettlement.note}`],
      };
      let withoutBattle: GameState = {
        ...state,
        activeBattles: state.activeBattles.filter((item) => item.id !== battle.id),
        activeMelee: resolved,
      };
      if (capturedIds.length > 0) {
        const names: string[] = [];
        withoutBattle = {
          ...withoutBattle,
          officers: Object.fromEntries(
            Object.entries(withoutBattle.officers).map(([id, officer]) => {
              if (!capturedIds.includes(officer.id)) return [id, officer];
              names.push(officer.name);
              return [id, { ...officer, status: OfficerStatus.PRISONER }];
            }),
          ),
          actionLog: [
            {
              year: withoutBattle.currentYear,
              month: withoutBattle.currentMonth,
              type: 'battle_capture',
              message: `【战报】战场生擒：${names.join('、')}`,
            },
            ...withoutBattle.actionLog,
          ].slice(0, 80),
        };
      }
      currentGame = applyMeleeSettlement(withoutBattle, resolved);
      return getClientGame();
    }
    let nextState = state;
    if (!battle.settled && battle.fromCityId != null) {
      nextState = settleBattle(state, battle, runtimeRandom);
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
    items: staticData.items,
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
    const result = campaignAssaultEngine(getGame(), armyId, runtimeRandom);
    currentGame = result.state;
    return { game: getClientGame(), result: result.result };
  });
}

/** 战役：劝降 */
export function campaignSiegeSurrender(armyId: string): { game: GameState; success: boolean } {
  return withLock(() => {
    const result = campaignTrySiegeSurrender(getGame(), armyId, runtimeRandom);
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

// ====== 郡域战场实例（Tier II；BF-P2 Q10） ======

/**
 * 进入郡域战场：从 shared 郡国模板目录生成 BattlefieldInstance 并写入
 * GameState.activeBattlefieldInstance。与 activeBattlefield（Tier I 大地图层）
 * 场景栈互斥；进入时必须保证 activeBattlefield 为 null。
 * 互斥护栏在 Zod 层（GameStateBattleSchema superRefine）兜底；本函数额外断言
 * 以便在写入前快速失败。
 *
 * 郡国由模板目录 `COMMANDERY_TEMPLATES`（shared/commandery-templates.ts）驱动，
 * 新增郡国无需改动本函数；未登记 id 直接抛错。
 *
 * RNG 边界（为 BF-P3 预留）：generateCommanderyBattlefield 是零 RNG 纯函数
 * （静态模板生成不消费随机数）；当前 enterNanjunBattlefield 不注入 RNG。
 * 未来 BF-P3 实施"动态部署/遭遇/AI 行动"扩展点时，须显式注入权威
 * runtimeRandom（xorshift32-v1），不得引入 Math.random()——参见
 * docs/21-battlefield-scene-design.md §九 RNG 与确定性。
 */
export function enterNanjunBattlefield(commandery = 'nanjun'): GameState {
  return withLock(() => {
    const state = getGame();
    if (state.activeBattlefield) {
      throw new Error('已有进行中的 Tier I 大地图战场；先退出再进入郡域战场');
    }
    const template = getCommanderyTemplate(commandery);
    if (!template) {
      throw new Error(`未知郡国模板：${commandery}（已登记：${getCommanderyIds().join('、')}）`);
    }
    const attackerFactionId = state.playerFactionId;
    const seatCityId = template.bundle.commanderies[0]?.worldCityId;
    const seatRuler = seatCityId != null ? state.cities[seatCityId]?.ruler : null;
    // 守方势力：优先郡治大地图城市实际占领势力（郡国归属语义，R6）；郡治无主或
    // 属玩家时回退任意非玩家存活势力（既有行为）。
    const defenderFactionId = seatRuler != null && seatRuler !== attackerFactionId
      ? seatRuler
      : (() => {
          const fallback = Object.values(state.factions).find(
            (faction) => faction.id !== attackerFactionId && faction.isAlive,
          );
          if (!fallback) throw new Error('未找到敌方势力');
          return fallback.id;
        })();
    const armyIds = state.campaignArmies
      .filter((army) => army.factionId === attackerFactionId)
      .map((army) => army.id);
    // R6 守方 Army 入郡域场景：郡治大地图城市（worldCityId）驻留的守方势力
    // Army 一并入场，部署到守方纵深前沿县（模板 defenderEntryNodeIds）。
    const defenderArmyIds = state.campaignArmies
      .filter((army) => army.factionId === defenderFactionId && army.currentNodeId === seatCityId)
      .map((army) => army.id);
    const beforeRng = getRuntimeRngState();
    const stableSuffix = `${state.currentYear}-${state.currentMonth}-${beforeRng.draws}`;
    const instance = generateCommanderyBattlefield({
      instanceId: `${template.instancePrefix}-${stableSuffix}`,
      warId: `${template.warPrefix}-${stableSuffix}`,
      bundle: template.bundle,
      templateId: template.templateId,
      attackerFactionId,
      defenderFactionId,
      armyIds,
      entryNodeIds: template.entryNodeIds,
      defenderArmyIds,
      defenderEntryNodeIds: template.defenderEntryNodeIds,
      rngDrawStart: beforeRng.draws,
      scenarioDateAtCreation: `${state.currentYear}-${String(state.currentMonth).padStart(2, '0')}`,
      dynamic: { rng: runtimeRandom, currentMonth: state.currentMonth },
    });
    currentGame = { ...state, activeBattlefieldInstance: instance };
    return getClientGame();
  });
}

/** 退出南郡郡域战场：清空 activeBattlefieldInstance，返回行政大地图。 */
export function exitNanjunBattlefield(): GameState {
  return withLock(() => {
    currentGame = { ...getGame(), activeBattlefieldInstance: null };
    return getClientGame();
  });
}

/** 获取当前郡域战场实例（如有）。 */
export function getBattlefieldInstance(): BattlefieldInstance | null {
  return getGame().activeBattlefieldInstance ?? null;
}

function pickBattlefieldDuelOfficer(
  state: GameState,
  factionId: number,
  preferredId?: number,
): Officer {
  const candidates = Object.values(state.officers)
    .filter((officer) => officer.faction === factionId && officer.status === OfficerStatus.ACTIVE)
    .sort((a, b) => b.stats.war - a.stats.war || a.id - b.id);
  const preferred = preferredId == null ? undefined : candidates.find((officer) => officer.id === preferredId);
  const picked = preferred ?? candidates[0];
  if (!picked) throw new Error('该势力没有可参与单挑的武将');
  return picked;
}

/** BF-P4：从郡域层发起阵前/城下挑战，完整 DuelState 由既有 S10 引擎创建。 */
export function startBattlefieldDuel(
  kind: BattlefieldDuelContext['kind'],
  nodeId: string,
  stance: DuelStance = 'delegate',
): GameState {
  return withLock(() => {
    const state = getGame();
    const inst = state.activeBattlefieldInstance;
    if (!inst || inst.phase !== 'active') throw new Error('没有活跃郡域战场');
    if (inst.activeDuel) throw new Error('已有进行中的阵前单挑');
    const node = inst.nodeStates.find((item) => item.nodeId === nodeId);
    if (!node) throw new Error('单挑节点不在当前战场');
    if (kind === 'city_front' && nodeId !== inst.targetSeatNodeId) throw new Error('城下挑战只能在郡治发起');
    if (kind === 'formation_front' && !inst.entryNodeIds.includes(nodeId)) throw new Error('阵前挑战只能在战场入口发起');
    const seatDefenderFactionId = inst.nodeStates.find((item) => item.nodeId === inst.targetSeatNodeId)?.rulerFactionId;
    const fallbackDefenderFactionId = Object.values(state.factions)
      .find((faction) => faction.id !== state.playerFactionId && faction.isAlive)?.id;
    const defenderFactionId = node.rulerFactionId != null && node.rulerFactionId !== state.playerFactionId
      ? node.rulerFactionId
      : seatDefenderFactionId ?? fallbackDefenderFactionId;
    if (defenderFactionId == null || defenderFactionId === state.playerFactionId) throw new Error('该节点没有敌方守军');

    const attackerArmy = state.campaignArmies
      .filter((army) => army.factionId === state.playerFactionId && army.troops > 0)
      .sort((a, b) => a.id.localeCompare(b.id))[0];
    const challenger = pickBattlefieldDuelOfficer(state, state.playerFactionId, attackerArmy?.commanderId);
    const defender = pickBattlefieldDuelOfficer(state, defenderFactionId);
    const duel = createDuel(`${inst.id}:${kind}:${nodeId}`, challenger, defender, DEFAULT_DUEL_CONFIG, runtimeRandom, stance);
    const activeDuel: BattlefieldDuelContext = {
      kind,
      nodeId,
      ...(attackerArmy ? { attackerArmyId: attackerArmy.id } : {}),
      challengerId: challenger.id,
      defenderId: defender.id,
      duel,
      settlementApplied: false,
    };
    currentGame = { ...state, activeBattlefieldInstance: { ...inst, activeDuel } };
    return getClientGame();
  });
}

function settleBattlefieldDuel(state: GameState, context: BattlefieldDuelContext): GameState {
  const result = context.duel.result;
  const inst = state.activeBattlefieldInstance;
  if (!inst || !result || context.settlementApplied) return state;
  const challengerWon = result.winnerId === context.challengerId && result.outcome !== 'draw';
  const officers = { ...state.officers };
  const factions = { ...state.factions };
  let cities = state.cities;
  const winner = officers[result.winnerId];
  const loser = officers[result.loserId];
  const loserFaction = loser?.faction == null ? undefined : factions[loser.faction];
  if (loser && loserFaction?.rulerId === loser.id
    && (result.outcome === 'killed' || result.outcome === 'captured' || result.outcome === 'surrendered')) {
    const successor = Object.values(officers)
      .filter((officer) => officer.id !== loser.id
        && officer.faction === loser.faction
        && officer.status === OfficerStatus.ACTIVE)
      .sort((a, b) => b.stats.leadership - a.stats.leadership || a.id - b.id)[0];
    if (!successor) throw new Error('势力君主单挑败亡但无可用继承者');
    factions[loserFaction.id] = { ...loserFaction, rulerId: successor.id };
  }
  // 君主不参与功绩系统（docs/04 §3.8/§6.5）：胜方为君主时不发功绩，避免双重计数
  if (winner) {
    const winnerIsRuler = state.factions[winner.faction ?? 0]?.rulerId === winner.id;
    officers[winner.id] = winnerIsRuler ? winner : grantMerit(winner, result.meritReward);
  }
  if (loser) {
    if (result.outcome === 'killed') {
      officers[loser.id] = { ...loser, status: OfficerStatus.DEAD, faction: null, location: null, stamina: 0 };
      if (loserFaction) {
        factions[loserFaction.id] = {
          ...factions[loserFaction.id],
          officerIds: factions[loserFaction.id].officerIds.filter((id) => id !== loser.id),
        };
      }
      cities = Object.fromEntries(Object.entries(state.cities).map(([id, city]) => [
        id,
        city.officers.includes(loser.id)
          ? { ...city, officers: city.officers.filter((officerId) => officerId !== loser.id) }
          : city,
      ]));
    } else if (result.outcome === 'captured' || result.outcome === 'surrendered') {
      officers[loser.id] = { ...loser, status: OfficerStatus.PRISONER };
    } else {
      officers[loser.id] = { ...loser, stamina: Math.max(1, loser.stamina - 20) };
    }
  }
  const campaignArmies = state.campaignArmies.map((army) => {
    if (army.id !== context.attackerArmyId) return army;
    const delta = challengerWon ? result.moraleChange.winner : result.moraleChange.loser;
    return { ...army, morale: Math.max(0, Math.min(100, army.morale + delta)) };
  });
  const nodeStates = inst.nodeStates.map((node) =>
    node.nodeId === context.nodeId && challengerWon
      ? { ...node, garrison: Math.max(0, Math.floor(node.garrison * 0.85)) }
      : node,
  );
  const settledContext = { ...context, settlementApplied: true };
  const label = context.kind === 'city_front' ? '城下' : '阵前';
  return {
    ...state,
    officers,
    factions,
    cities,
    campaignArmies,
    activeBattlefieldInstance: { ...inst, nodeStates, activeDuel: settledContext },
    actionLog: [{
      year: state.currentYear,
      month: state.currentMonth,
      type: 'battlefield_duel',
      message: `${label}单挑：${result.epilogue}${challengerWon ? '；守军震动，驻军-15%' : ''}`,
    }, ...state.actionLog].slice(0, 80),
  };
}

export function stepBattlefieldDuel(): GameState {
  return withLock(() => {
    const state = getGame();
    const inst = state.activeBattlefieldInstance;
    const context = inst?.activeDuel;
    if (!inst || !context) throw new Error('没有进行中的阵前单挑');
    if (context.duel.phase === 'resolved') {
      currentGame = settleBattlefieldDuel(state, context);
      return getClientGame();
    }
    const challenger = state.officers[context.challengerId];
    const defender = state.officers[context.defenderId];
    if (!challenger || !defender) throw new Error('单挑武将不存在');
    const duel = stepDuel(context.duel, challenger, defender, DEFAULT_DUEL_CONFIG, runtimeRandom, {
      [challenger.id]: duelEquipBonusFor(challenger),
      [defender.id]: duelEquipBonusFor(defender),
    });
    const next = { ...context, duel };
    const nextState = { ...state, activeBattlefieldInstance: { ...inst, activeDuel: next } };
    currentGame = duel.phase === 'resolved' ? settleBattlefieldDuel(nextState, next) : nextState;
    return getClientGame();
  });
}

export function skipBattlefieldDuel(): GameState {
  return withLock(() => {
    const state = getGame();
    const inst = state.activeBattlefieldInstance;
    const context = inst?.activeDuel;
    if (!inst || !context) throw new Error('没有进行中的阵前单挑');
    if (context.duel.phase === 'resolved') {
      currentGame = settleBattlefieldDuel(state, context);
      return getClientGame();
    }
    const challenger = state.officers[context.challengerId];
    const defender = state.officers[context.defenderId];
    if (!challenger || !defender) throw new Error('单挑武将不存在');
    const duel = runDuelToCompletion(context.duel, challenger, defender, DEFAULT_DUEL_CONFIG, runtimeRandom, {
      [challenger.id]: duelEquipBonusFor(challenger),
      [defender.id]: duelEquipBonusFor(defender),
    });
    const next = { ...context, duel };
    currentGame = settleBattlefieldDuel(
      { ...state, activeBattlefieldInstance: { ...inst, activeDuel: next } },
      next,
    );
    return getClientGame();
  });
}

export function closeBattlefieldDuel(): GameState {
  return withLock(() => {
    const state = getGame();
    const inst = state.activeBattlefieldInstance;
    if (!inst?.activeDuel) throw new Error('没有可关闭的阵前单挑');
    if (!inst.activeDuel.settlementApplied) throw new Error('单挑尚未结算');
    currentGame = { ...state, activeBattlefieldInstance: { ...inst, activeDuel: undefined } };
    return getClientGame();
  });
}

/**
 * BF-P2 Q9：攻打郡域县节点（当阳/华容/枝江）。
 *
 * 接受字符串 countyId（区别于 P1 engageJiangling 借用数字 cityId=14 的 hack）。
 * 复用既有 runAutoBattle 自动结算引擎（设计文档 §7.2 三种结算模式之一），
 * 不调 createBattle（六角，需数字 cityId 体系，县级无映射）。
 *
 * 攻占效果契约（Q6/Q9 边界）：不写入 GameState.cities、不产生金粮收入、
 * 不触发 S03/S04；仅更新 BattlefieldInstance.nodeStates + CampaignArmy.troops。
 *
 * RNG 边界：runAutoBattle 接受 runtimeRandom（权威 xorshift32-v1），
 * generateNanjunBattlefield 保持零 RNG 纯函数不变。
 */
export function engageCounty(countyId: string): GameState {
  return withLock(() => {
    const state = getGame();
    const inst = state.activeBattlefieldInstance;
    if (!inst) throw new Error('未进入郡域战场');

    if (!(FIRST_BATCH_COUNTY_IDS as readonly string[]).includes(countyId)) {
      throw new Error(`${countyId} 不在首批可攻打县列表（当阳/华容/枝江）`);
    }

    const nodeIndex = inst.nodeStates.findIndex((n) => n.nodeId === countyId);
    if (nodeIndex < 0) throw new Error(`县节点 ${countyId} 不在战场中`);
    const node = inst.nodeStates[nodeIndex];
    if (node.rulerFactionId === state.playerFactionId) {
      throw new Error(`${node.name} 已是己方控制`);
    }

    // 选第一支攻方 Army 作为攻打部队
    const atkArmy = state.campaignArmies.find(
      (a) => a.factionId === state.playerFactionId && a.troops > 0,
    );
    if (!atkArmy) throw new Error('没有可用于攻县的己方 CampaignArmy（需先编成出征军）');

    // 首次攻打时若县无守军，设为小驻军（模拟县民兵），让攻打有实际意义
    const defGarrison = node.garrison > 0 ? node.garrison : 1000;
    const defWall = node.wallDurability;

    // R6 县级主动 AI（Session 259）：县内守方 Army 参战 —— 取兵力最大一支为
    // defArmy 合成副本（troops = 驻军 + Σ守方 Army.troops，不改动 Army 真身），
    // 结算后按比例回填各守方 Army 与县驻军；攻方胜 → 守方 Army 溃退
    // （seat 未被攻方占 → 移驻 seat 县；被占 → 撤出郡域回大地图）。
    const seat = inst.nodeStates.find((n) => n.nodeId === inst.targetSeatNodeId);
    const defenderFactionId = seat?.rulerFactionId ?? null;
    const defenderArmies = node.armyIds
      .map((id) => state.campaignArmies.find((a) => a.id === id))
      .filter((a): a is CampaignArmy => !!a && a.factionId === defenderFactionId);
    const defenderArmyTotal = defenderArmies.reduce((s, a) => s + a.troops, 0);
    const defenderTotal = defGarrison + defenderArmyTotal;

    const result = defenderArmies.length > 0
      ? runAutoBattle(
          state,
          atkArmy,
          { ...[...defenderArmies].sort((a, b) => b.troops - a.troops)[0], troops: defenderTotal },
          null, // 守方 Army 迎战（野战），不叠加城墙惩罚（见 docs/25 §2.6.4）
          runtimeRandom,
        )
      : runAutoBattle(
          state,
          atkArmy,
          null,
          { cityId: 0, garrison: defGarrison, wall: defWall },
          runtimeRandom,
        );

    // 按比例回填守方残兵：Army 分摊 = defenderRemaining × (Σ守方 Army / 总守军)，尾差归 garrison
    const armyShare = defenderTotal > 0 ? defenderArmyTotal / defenderTotal : 0;
    const armyRemainingTotal = defenderTotal > 0
      ? Math.min(defenderArmyTotal, Math.round(result.defenderRemaining * armyShare))
      : 0;
    const garrisonRemaining = Math.max(0, result.defenderRemaining - armyRemainingTotal);

    // 各守方 Army 残兵分配（按各自兵力占比，尾差归最大支）
    const remainingByArmy = new Map<string, number>();
    let allotted = 0;
    const sortedDefArmies = [...defenderArmies].sort((a, b) => b.troops - a.troops);
    sortedDefArmies.forEach((a, idx) => {
      const share = idx === sortedDefArmies.length - 1
        ? armyRemainingTotal - allotted
        : Math.round(armyRemainingTotal * (a.troops / Math.max(1, defenderArmyTotal)));
      allotted += share;
      remainingByArmy.set(a.id, share);
    });

    const occupied = result.winner === 'attacker';
    const defenderArmyIdsSet = new Set(defenderArmies.map((a) => a.id));
    const defenderFlee = occupied && defenderArmies.length > 0;
    const seatHeldByAttacker = seat?.rulerFactionId === state.playerFactionId;

    // 更新 nodeStates：目标县（占领/留守 + 守方 Army 移除或保留）+ 溃退移驻 seat
    let newNodeStates = inst.nodeStates.map((n) => {
      if (n.nodeId !== countyId) return n;
      if (occupied) {
        return {
          ...n,
          rulerFactionId: state.playerFactionId,
          garrison: result.attackerRemaining,
          wallDurability: Math.max(0, n.wallDurability - Math.floor(n.maxWallDurability * 0.5)),
          controlTurns: 0,
          armyIds: defenderFlee ? n.armyIds.filter((id) => !defenderArmyIdsSet.has(id)) : n.armyIds,
        };
      }
      return { ...n, garrison: garrisonRemaining };
    });
    if (defenderFlee && !seatHeldByAttacker && seat) {
      newNodeStates = newNodeStates.map((n) =>
        n.nodeId === seat.nodeId
          ? { ...n, armyIds: [...n.armyIds, ...sortedDefArmies.map((a) => a.id)] }
          : n,
      );
    }
    // 同步 deployments 回退表（溃退移驻 seat → 改 nodeId；撤出郡域 → 移除）
    let nextDeployments = inst.dynamicSituation?.deployments ?? null;
    if (defenderFlee && nextDeployments != null) {
      if (!seatHeldByAttacker && seat) {
        nextDeployments = nextDeployments.map((d) =>
          defenderArmyIdsSet.has(d.armyId) ? { ...d, nodeId: seat.nodeId } : d,
        );
      } else {
        nextDeployments = nextDeployments.filter((d) => !defenderArmyIdsSet.has(d.armyId));
      }
    }

    // 更新攻方 Army 兵力（消耗）+ morale clamp 到 0-100（Zod schema 约束）；
    // 守方 Army 兵力/士气按回填更新（溃退 Army 同样带回残兵）
    const newCampaignArmies = state.campaignArmies.map((a) => {
      if (a.id === atkArmy.id) {
        return {
          ...a,
          troops: result.attackerRemaining,
          morale: Math.max(0, Math.min(100, result.attackerMoraleAfter)),
        };
      }
      const remaining = remainingByArmy.get(a.id);
      if (remaining != null) {
        return {
          ...a,
          troops: remaining,
          morale: Math.max(0, Math.min(100, result.defenderMoraleAfter)),
        };
      }
      return a;
    });

    const fleeMsg = defenderFlee
      ? seatHeldByAttacker
        ? '，守方 Army 溃逃出郡域'
        : `，守方 Army 溃退至 ${seat?.name ?? '郡治'}`
      : defenderArmies.length > 0
        ? '，守方 Army 参战'
        : '';
    const logMsg = occupied
      ? `${atkArmy.name} 攻占 ${node.name}（剩兵 ${result.attackerRemaining}），守方残兵 ${result.defenderRemaining}${fleeMsg}`
      : `${atkArmy.name} 攻打 ${node.name} 失利（剩兵 ${result.attackerRemaining}），守方残兵 ${result.defenderRemaining}${fleeMsg}`;

    currentGame = {
      ...state,
      campaignArmies: newCampaignArmies,
      activeBattlefieldInstance: defenderFlee && inst.dynamicSituation && nextDeployments != null
        ? { ...inst, nodeStates: newNodeStates, dynamicSituation: { ...inst.dynamicSituation, deployments: nextDeployments } }
        : { ...inst, nodeStates: newNodeStates },
      actionLog: [{
        year: state.currentYear,
        month: state.currentMonth,
        type: 'battlefield',
        message: logMsg,
      }, ...state.actionLog].slice(0, 80),
    };
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
      // FM-P3a 点值迁移：快照各军组织度供阵型执行档消费（optional，旧档缺省 orderly ×1.0）
      atkArmy.organization,
      defArmy.organization,
    );

    currentGame = { ...state, activeMelee: melee };
    return { game: getClientGame(), melee };
  });
}

/** 获取当前白刃战状态 */
export function getMelee(): MeleeState | null {
  return getGame().activeMelee;
}

/** 从同一白刃战快照选择唯一结算模式；重复提交同一模式幂等，不得改选。 */
export function meleeSelectMode(
  mode: MeleeEntryMode,
): { game: GameState; melee: MeleeState; battle?: BattleState } {
  return withLock(() => {
    const state = getGame();
    const melee = state.activeMelee;
    if (!melee) throw new Error('没有活跃白刃战');
    if (melee.entryMode && melee.entryMode !== mode) throw new Error('本次交战已经选择其他结算模式');
    if (melee.settlementApplied) return { game: getClientGame(), melee };
    if (melee.entryMode === mode) {
      const battle = melee.tacticalBattleId
        ? state.activeBattles.find((item) => item.id === melee.tacticalBattleId)
        : undefined;
      return { game: getClientGame(), melee, ...(battle ? { battle } : {}) };
    }

    let selected: MeleeState = { ...melee, entryMode: mode };
    if (mode === 'auto') {
      // FM-P3：自动结算恢复调用既有 runAutoBattle（05 §20.3.5 / 计划 §2.2 §7.4），
      // 取代此前的 runMeleeRound 循环漂移。结果桥接回 melee 状态后由 applyMeleeSettlement 一次回写。
      const atkArmy = state.campaignArmies.find((a) => a.id === melee.attackerArmyId);
      const defArmy = state.campaignArmies.find((a) => a.id === melee.defenderArmyId);
      if (!atkArmy || !defArmy) throw new Error('自动结算缺少攻守 Army');
      const autoResult = runAutoBattle(state, atkArmy, defArmy, null, runtimeRandom);
      const phase: MeleeState['phase'] = autoResult.winner === 'attacker' ? 'attacker_victory' : 'defender_victory';
      selected = {
        ...selected,
        attackerTroops: autoResult.attackerRemaining,
        defenderTroops: autoResult.defenderRemaining,
        attackerMorale: autoResult.attackerMoraleAfter,
        defenderMorale: autoResult.defenderMoraleAfter,
        phase,
      };
      currentGame = applyMeleeSettlement({ ...state, activeMelee: selected }, selected);
      return { game: getClientGame(), melee: getGame().activeMelee! };
    }

    if (mode === 'tactical') {
      const battlefield = state.activeBattlefield;
      if (!battlefield) throw new Error('六角微操必须归属于活跃战场');
      const attackerArmy = state.campaignArmies.find((army) => army.id === melee.attackerArmyId);
      const defenderArmy = state.campaignArmies.find((army) => army.id === melee.defenderArmyId);
      const battle = createBattle(state, battlefield.targetCityId, {
        attackTroops: melee.attackerTroops,
        defendTroops: melee.defenderTroops,
        attackMorale: melee.attackerMorale,
        defendMorale: melee.defenderMorale,
        attackerArmy,
        defenderArmy,
      });
      selected = { ...selected, tacticalBattleId: battle.id };
      currentGame = { ...state, activeMelee: selected, activeBattles: [...state.activeBattles, battle] };
      return { game: getClientGame(), melee: selected, battle };
    }

    currentGame = { ...state, activeMelee: selected };
    return { game: getClientGame(), melee: selected };
  });
}

/** 执行一回合白刃战（FM-P3 §7.5 动作级幂等：commandId + expectedRound） */
export function meleeRound(
  actionType: string,
  targetFormation?: import('@leh/shared').FormationType,
  commandId?: string,
  expectedRound?: number,
): { game: GameState; result: import('@leh/shared').MeleeRoundResult; melee: MeleeState } {
  return withLock(() => {
    const state = getGame();
    const melee = state.activeMelee;
    if (!melee) throw new Error('没有活跃白刃战');
    if (melee.entryMode !== 'standard') throw new Error('只有标准模式可提交逐回合战术');
    if (melee.phase !== 'active') throw new Error('白刃战已结束');

    // 动作级幂等（FM-P3 §7.5）
    const cache = melee.commandCache ?? {};
    if (commandId != null) {
      const cached = cache[commandId];
      if (cached) {
        if (cached.round !== expectedRound) throw new Error('expectedRound 过期，命令拒绝');
        const cur = getGame().activeMelee!;
        return { game: getClientGame(), result: cached.result, melee: cur };
      }
    }

    const atkArmy = state.campaignArmies.find((a) => a.id === melee.attackerArmyId);
    const atkCommander = atkArmy ? state.officers[atkArmy.commanderId] : undefined;

    const typedAction = actionType as import('@leh/shared').TacticalActionType;
    const cost = getTacticalActionCost(typedAction);
    if (cost === null) throw new Error('未知的白刃战行动');
    if (melee.tacticalPoints < cost) throw new Error('战术点不足');
    const allowedFormations = [0, 1, 2, 3, 4, 6] as const;
    if (typedAction === 'change_formation' && !allowedFormations.includes(targetFormation as (typeof allowedFormations)[number])) {
      throw new Error('变阵必须指定 0-A 基础阵型');
    }
    const effectiveMelee = typedAction === 'change_formation' ? { ...melee, attackerFormation: targetFormation! } : melee;
    const action = { type: typedAction, targetFormation };
    const result = runMeleeRound(effectiveMelee, action, atkCommander?.stats.intelligence ?? 50);

    // 写入幂等缓存（仅标准模式，命令成功）
    const nextCache = commandId != null ? { ...cache, [commandId]: { round: melee.round, result } } : cache;
    const nextMelee = applyMeleeRoundResult({ ...effectiveMelee, commandCache: nextCache }, result, cost);
    currentGame = result.phase === 'active'
      ? { ...state, activeMelee: nextMelee }
      : applyMeleeSettlement({ ...state, activeMelee: nextMelee }, nextMelee);

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

/** 设定攻方玩家持久战术姿态（FM-P3）：null 清除为中性；不耗 TP、不推进回合。 */
export function meleeSetTactic(
  tactic: import('@leh/shared').TacticalTacticId | null,
): { game: GameState; melee: MeleeState } {
  const allowed = ['assault', 'hold', 'ambush'];
  if (tactic != null && !allowed.includes(tactic)) throw new Error('非法战术');
  return withLock(() => {
    const state = getGame();
    const melee = state.activeMelee;
    if (!melee) throw new Error('没有活跃白刃战');
    if (melee.phase !== 'active') throw new Error('白刃战已结束');
    const nextMelee = { ...melee, tactic };
    currentGame = { ...state, activeMelee: nextMelee };
    return { game: getClientGame(), melee: nextMelee };
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

// ====== 关系网 API（S24） ======

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  mergeSkillsWithTree,
  resolveAffinity,
  relationState,
  skillPointsForMerit,
  traitPointsForMerit,
} from '@leh/shared';
import type { StaticRelation, OfficerRelation, SkillTreeDef } from '@leh/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _relationsCache: StaticRelation[] | null = null;
function loadRelations(): StaticRelation[] {
  if (_relationsCache) return _relationsCache;
  const raw = JSON.parse(readFileSync(join(__dirname, '../data/relations.json'), 'utf-8'));
  _relationsCache = raw.relations ?? raw;
  return _relationsCache!;
}

let _skillTreesCache: SkillTreeDef[] | null = null;
function loadSkillTrees(): SkillTreeDef[] {
  if (_skillTreesCache) return _skillTreesCache;
  const raw = JSON.parse(readFileSync(join(__dirname, '../data/skill-trees.json'), 'utf-8'));
  _skillTreesCache = raw.trees ?? raw;
  return _skillTreesCache!;
}

export function getOfficerRelations(officerId: number): OfficerRelation[] {
  const state = getGame();
  const officer = state.officers[officerId];
  if (!officer) return [];
  const allRelations = loadRelations();
  const result: OfficerRelation[] = [];
  const seen = new Set<string>();
  for (const rel of allRelations) {
    if (rel.fromId === officerId) {
      const key = `${Math.min(officerId, rel.toId)}:${Math.max(officerId, rel.toId)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const target = state.officers[rel.toId];
      if (!target) continue;
      const aff = resolveAffinity(officer, target, state.relationAffinities);
      result.push({
        targetId: rel.toId,
        targetName: target.name,
        type: rel.type,
        source: rel.source,
        state: relationState(aff),
        affinity: Math.round(aff),
      });
    } else if (rel.toId === officerId) {
      const key = `${Math.min(officerId, rel.fromId)}:${Math.max(officerId, rel.fromId)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const target = state.officers[rel.fromId];
      if (!target) continue;
      const aff = resolveAffinity(officer, target, state.relationAffinities);
      result.push({
        targetId: rel.fromId,
        targetName: target.name,
        type: rel.type,
        source: rel.source,
        state: relationState(aff),
        affinity: Math.round(aff),
      });
    }
  }
  return result;
}

export function getSkillTrees(): SkillTreeDef[] {
  return loadSkillTrees();
}

export function getOfficerSkillState(officerId: number): {
  skillTreeState: Record<string, number>;
  skillPointsSpent: number;
  totalSkillPoints: number;
  traitLevels: Record<string, number>;
  traitPointsSpent: number;
  totalTraitPoints: number;
} {
  const state = getGame();
  const officer = state.officers[officerId];
  if (!officer) throw new Error('武将不存在');
  const meritLv = officer.meritLevel ?? 1;
  return {
    skillTreeState: officer.skillTreeState ?? {},
    skillPointsSpent: officer.skillPointsSpent ?? 0,
    totalSkillPoints: skillPointsForMerit(meritLv),
    traitLevels: officer.traitLevels ?? {},
    traitPointsSpent: officer.traitPointsSpent ?? 0,
    totalTraitPoints: traitPointsForMerit(meritLv),
  };
}

function baselineSkillsFor(officerId: number): import('@leh/shared').OfficerSkillStatic[] {
  return staticData.officers.find((o) => o.id === officerId)?.skills ?? [];
}

/** 验证脚本专用：抬高 meritLevel 以获得技能点（不改累计 merit 叙事）。 */
export const skillTreeTestHooks = {
  setMeritLevelForTest(officerId: number, meritLevel: number): void {
    withLock(() => {
      const state = getGame();
      const officer = state.officers[officerId];
      if (!officer) throw new Error('武将不存在');
      currentGame = {
        ...state,
        officers: {
          ...state.officers,
          [officerId]: { ...officer, meritLevel, peakMeritLevel: Math.max(officer.peakMeritLevel ?? 0, meritLevel) },
        },
      };
    });
  },
};

export function upgradeSkillNode(officerId: number, nodeId: string): ReturnType<typeof getOfficerSkillState> {
  return withLock(() => {
    const state = getGame();
    const officer = state.officers[officerId];
    if (!officer) throw new Error('武将不存在');
    const trees = loadSkillTrees();
    let node: import('@leh/shared').SkillTreeNodeDef | undefined;
    for (const tree of trees) {
      node = tree.nodes.find((n) => n.id === nodeId);
      if (node) break;
    }
    if (!node) throw new Error('技能节点不存在');
    const treeState = { ...(officer.skillTreeState ?? {}) };
    const currentLevel = treeState[nodeId] ?? 0;
    if (currentLevel >= node.maxLevel) throw new Error('已达最高等级');
    const spent = officer.skillPointsSpent ?? 0;
    const total = skillPointsForMerit(officer.meritLevel ?? 1);
    if (spent + node.costPerLevel > total) throw new Error('技能点不足');
    for (const prereq of node.prerequisites) {
      if ((treeState[prereq] ?? 0) < 1) throw new Error(`前置技能 ${prereq} 未解锁`);
    }
    treeState[nodeId] = currentLevel + 1;
    // S25：加点同步 officer.skills，供火计/暴击/单挑/内政消费（docs/30 §8.3）
    const syncedSkills = mergeSkillsWithTree(
      baselineSkillsFor(officerId),
      officer.skills,
      treeState,
      trees,
    );
    currentGame = {
      ...state,
      officers: {
        ...state.officers,
        [officerId]: {
          ...officer,
          skillTreeState: treeState,
          skillPointsSpent: spent + node.costPerLevel,
          skills: syncedSkills,
        },
      },
    };
    return getOfficerSkillState(officerId);
  });
}

export function upgradeTrait(officerId: number, traitId: string): ReturnType<typeof getOfficerSkillState> {
  return withLock(() => {
    const state = getGame();
    const officer = state.officers[officerId];
    if (!officer) throw new Error('武将不存在');
    const traitLevels = officer.traitLevels ?? {};
    const currentLevel = traitLevels[traitId] ?? 0;
    if (currentLevel >= 5) throw new Error('已达最高等级');
    const spent = officer.traitPointsSpent ?? 0;
    const total = traitPointsForMerit(officer.meritLevel ?? 1);
    if (spent + 1 > total) throw new Error('特性点不足');
    traitLevels[traitId] = currentLevel + 1;
    currentGame = {
      ...state,
      officers: {
        ...state.officers,
        [officerId]: {
          ...officer,
          traitLevels,
          traitPointsSpent: spent + 1,
        },
      },
    };
    return getOfficerSkillState(officerId);
  });
}

export function resetSkillTree(officerId: number): ReturnType<typeof getOfficerSkillState> {
  return withLock(() => {
    const state = getGame();
    const officer = state.officers[officerId];
    if (!officer) throw new Error('武将不存在');
    const trees = loadSkillTrees();
    // 清空树后按静态基线重合并，避免树加点抬高的 skills 残留
    const restoredSkills = mergeSkillsWithTree(
      baselineSkillsFor(officerId),
      officer.skills,
      {},
      trees,
    );
    currentGame = {
      ...state,
      officers: {
        ...state.officers,
        [officerId]: {
          ...officer,
          skillTreeState: {},
          skillPointsSpent: 0,
          traitLevels: {},
          traitPointsSpent: 0,
          skills: restoredSkills,
        },
      },
    };
    return getOfficerSkillState(officerId);
  });
}

// ====== 天命-人心 API（S26） ======

import { computeMandate, computePopularWill, mandateLabel, popularWillLabel, mandateDiplomacyModifier, popularWillDesertionModifier, popularWillRecruitModifier, fameLabel } from '@leh/shared';

export function getFactionOverview(): {
  factionId: number;
  factionName: string;
  mandate: number;
  mandateLabel: string;
  mandateDiplomacyModifier: number;
  popularWill: number;
  popularWillLabel: string;
  popularWillDesertionModifier: number;
  popularWillRecruitModifier: number;
  fame: number;
  fameLabel: string;
  arms: number;
  cityCount: number;
  officerCount: number;
  commanderyCount: number;
} {
  const state = getGame();
  const playerFaction = Object.values(state.factions).find((f) => f.id === state.playerFactionId);
  if (!playerFaction) throw new Error('玩家势力不存在');
  const mandate = computeMandate(playerFaction, state);
  const popularWill = computePopularWill(playerFaction, state);
  return {
    factionId: playerFaction.id,
    factionName: playerFaction.name,
    mandate,
    mandateLabel: mandateLabel(mandate),
    mandateDiplomacyModifier: mandateDiplomacyModifier(mandate),
    popularWill,
    popularWillLabel: popularWillLabel(popularWill),
    popularWillDesertionModifier: popularWillDesertionModifier(popularWill),
    popularWillRecruitModifier: popularWillRecruitModifier(popularWill),
    fame: playerFaction.fame ?? 0,
    fameLabel: fameLabel(playerFaction.fame ?? 0),
    arms: playerFaction.arms ?? 0,
    cityCount: playerFaction.cityIds?.length ?? 0,
    officerCount: playerFaction.officerIds?.length ?? 0,
    commanderyCount: countOwnedCommanderies(playerFaction.id, state),
  };
}

function countOwnedCommanderies(factionId: number, state: import('@leh/shared').GameState): number {
  const owned = new Set<string>();
  for (const city of Object.values(state.cities)) {
    if (city.ruler === factionId) {
      owned.add(city.adminName ?? city.province);
    }
  }
  return owned.size;
}
