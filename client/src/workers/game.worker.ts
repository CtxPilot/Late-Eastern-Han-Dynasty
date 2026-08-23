// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 离线可玩版（Session 372 Phase 3）：浏览器内权威引擎宿主 Worker。
 *
 * 与 server/src/services/game.ts 逐函数镜像（withLock/currentGame/commitActiveBattle/
 * 脱敏投影），复用同一套 engine/* 纯函数与 state-pipeline 编排，保证在线/离线
 * 结算一致；静态数据经 browser-loader shim（Vite 插件把引擎内 '../data/loader.js'
 * 重定向到本目录同一模块）。存档槽位介质在主线程 save-idb.ts（IndexedDB），
 * 信封生成与读档校验链仍在本 Worker 完成。
 */
import {
  maskGameStateForPlayer,
  NobilityRank,
  PolicyType,
  PlotType,
  SpyCaptiveAction,
  SpyMissionType,
  getRuntimeRngState,
  resetRuntimeRng,
  restoreRuntimeRng,
  runtimeRandom,
  type BattleState,
  type BattlefieldMap,
  type DuelStance,
  type EventSourceClass,
  type FamilyTreatmentMode,
  type FormationType,
  type GameState,
  type MeleeEntryMode,
  type MeleeRoundResult,
  type MeleeState,
  type PositionTrack,
  type StructureType,
} from '@leh/shared';
import { staticData } from './browser-loader';
import { relations as relationsJson } from 'virtual:leh-data';
import {
  adoptSaveEnvelope,
  buildGameState,
  buildSaveEnvelope,
  runEndTurnPipeline,
} from '../../../server/src/engine/state-pipeline.js';
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
} from '../../../server/src/engine/civil.js';
import { buyArms, patrolCity, reclaimLand, resolveImpeachment } from '../../../server/src/engine/factionPolitics.js';
import { resolveFamilyTreatment } from '../../../server/src/engine/hostageFamilies.js';
import { seekBeauty, rewardBeautyStock } from '../../../server/src/engine/beauty.js';
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
} from '../../../server/src/engine/battle.js';
import {
  advisorAction as campaignAdvisorActionEngine,
  assault as campaignAssaultEngine,
  orderMarch as campaignOrderMarchEngine,
  retreatArmy as campaignRetreatArmyEngine,
  startCampaign as campaignStartEngine,
  trySiegeSurrender as campaignTrySiegeSurrenderEngine,
  buildStructure as campaignBuildStructureEngine,
  runAutoBattle,
  setAutoFormationCatalog,
  type AdvisorAction,
} from '../../../server/src/engine/campaign.js';
import {
  extractBattlefieldNodes,
  generateBattlefield,
  tickBattlefieldMarch,
} from '../../../server/src/engine/battlefield.js';
import {
  applyMeleeRoundResult,
  applyMeleeSettlement,
  createMeleeState,
  getTacticalActionCost,
  refreshMeleeState,
  runMeleeRound,
  setMeleeFormationCatalog,
  setMeleeTacticalConfig,
} from '../../../server/src/engine/meleeRound.js';
import {
  isMarchTargetReachable,
  pickDefaultFromCity,
  prepareMarch,
  settleBattle,
} from '../../../server/src/engine/march.js';
import { marryFemale, recruitOfficer, searchTalent } from '../../../server/src/engine/personnel.js';
import { grantBattleIntel } from '../../../server/src/engine/intel.js';
import { formAlliance, transferCourtNetwork, tributeGold } from '../../../server/src/engine/diplomacy.js';
import {
  declareWarByFalseDecree,
  establishHegemony,
  getKingRequirements,
  proclaimKing,
} from '../../../server/src/engine/hegemony.js';
import { launchPlot, cancelPlot } from '../../../server/src/engine/plot.js';
import { setNationalPolicy } from '../../../server/src/engine/policy.js';
import { joinFaction, releaseOfficer, tickFollowCheck } from '../../../server/src/engine/family.js';
import {
  dispatchMission,
  recruitSpies,
  resolveCaptive,
  stationCounter,
  trainFemaleSpy,
  plantFemaleFromGift,
  unstationCounter,
} from '../../../server/src/engine/spy.js';
import { equipItem, grantTreasure, unequipItem } from '../../../server/src/engine/items.js';
import { buildAnnualBudget } from '../../../server/src/engine/budget.js';
import { appointOfficer } from '../../../server/src/engine/appoint.js';
import { grantNobility } from '../../../server/src/engine/nobility.js';
import { setStaticRelationsForTest } from '../../../server/src/engine/relations.js';
import { resolveEventChoice } from '../../../server/src/engine/event.js';
import { setFormationCatalog } from '../../../server/src/battle/crit.js';
import { setHexFormationCatalog } from '../../../server/src/battle/hex-formation.js';
import { loadTacticalSystemV2 } from './browser-loader';

// ====== 进程级权威状态（与 services/game.ts 镜像） ======
let currentGame: GameState | null = null;
let isProcessing = false;

// 离线：预注入静态关系表，使引擎懒加载不触达 Node fs shim。
setStaticRelationsForTest(
  ((relationsJson as { relations?: unknown }).relations ?? relationsJson) as Parameters<
    typeof setStaticRelationsForTest
  >[0],
);

// 离线：镜像 server/src/index.ts 启动注入——FM-P3 各战斗模式从 formations.json
// tiers[0] 点值读取阵型贡献（单一内容源）；未注入时引擎静默回退中性值，
// 会把离线战斗的阵型/暴击/协同数值悄悄清零（Session 374 修补）。
setFormationCatalog(staticData.formations);
setMeleeFormationCatalog(staticData.formations);
setAutoFormationCatalog(staticData.formations);
setHexFormationCatalog(staticData.formations);
setMeleeTacticalConfig(loadTacticalSystemV2());

function withLock<T>(fn: () => T): T {
  if (isProcessing) throw new Error('操作处理中，请稍候（避免并发冲突）');
  isProcessing = true;
  try {
    return fn();
  } finally {
    isProcessing = false;
  }
}

function getGame(): GameState {
  if (!currentGame) throw new Error('尚无进行中的游戏');
  return currentGame;
}

function getActiveBattle(state: GameState = getGame()): BattleState | null {
  return state.activeBattles[0] ?? null;
}

function commitActiveBattle(battle: BattleState | null, state: GameState = getGame()): GameState {
  currentGame = { ...state, activeBattles: battle ? [battle] : [] };
  return currentGame;
}

function getClientGame(): GameState {
  return maskGameStateForPlayer(getGame());
}

// ====== 处理器表：逐函数镜像 services/game.ts ======

const handlers: Record<string, (...args: never[]) => unknown> = {
  /** S16 静态目录（镜像 listStatic） */
  listStatic() {
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
  },

  createGame(scenarioId: number, playerFactionId: number, requestedEventLayers?: EventSourceClass[]): GameState {
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
  },

  getGameState(): GameState {
    return getClientGame();
  },

  endTurn(): GameState {
    return withLock(() => {
      const before = getGame();
      if ((before.pendingEvents ?? []).length > 0) throw new Error('请先处理待决事件');
      if (before.pendingFamilyTreatment) throw new Error('请先处理家属处置');
      currentGame = runEndTurnPipeline(before, runtimeRandom);
      return getClientGame();
    });
  },

  chooseEvent(eventId: number, choiceIndex: number): GameState {
    return withLock(() => {
      currentGame = resolveEventChoice(getGame(), eventId, choiceIndex);
      return getClientGame();
    });
  },

  getAnnualBudget() {
    const game = getGame();
    return buildAnnualBudget(game, game.playerFactionId);
  },

  developFarm(cityId: number): GameState {
    return withLock(() => {
      const officerId = getGame().cities[cityId]?.officers[0];
      if (officerId == null) throw new Error('本城没有可指派武将');
      currentGame = developFarm(getGame(), cityId, officerId);
      return getClientGame();
    });
  },

  develop(cityId: number, kind: DevelopKind, officerId?: number): GameState {
    return withLock(() => {
      const assignedOfficerId = officerId ?? getGame().cities[cityId]?.officers[0];
      if (assignedOfficerId == null) throw new Error('本城没有可指派武将');
      currentGame = developCity(getGame(), cityId, kind, assignedOfficerId);
      return getClientGame();
    });
  },

  conscript(cityId: number): GameState {
    return withLock(() => {
      currentGame = conscript(getGame(), cityId, runtimeRandom);
      return getClientGame();
    });
  },

  relief(cityId: number): GameState {
    return withLock(() => {
      currentGame = relief(getGame(), cityId, runtimeRandom);
      return getClientGame();
    });
  },

  train(cityId: number): GameState {
    return withLock(() => {
      currentGame = trainTroops(getGame(), cityId, runtimeRandom);
      return getClientGame();
    });
  },

  setCivilianFarming(cityId: number, households: number): GameState {
    return withLock(() => {
      currentGame = setCivilianFarming(getGame(), cityId, households);
      return getClientGame();
    });
  },

  setMilitaryFarming(cityId: number, enabled: boolean): GameState {
    return withLock(() => {
      currentGame = setMilitaryFarming(getGame(), cityId, enabled);
      return getClientGame();
    });
  },

  relocateGarrisonFamilies(fromCityId: number, toCityId: number): GameState {
    return withLock(() => {
      currentGame = relocateGarrisonFamilies(getGame(), fromCityId, toCityId);
      return getClientGame();
    });
  },

  resolveFamilyTreatment(mode: FamilyTreatmentMode): GameState {
    return withLock(() => {
      currentGame = resolveFamilyTreatment(getGame(), mode);
      return getClientGame();
    });
  },

  setNationalPolicy(type: string, targetCityId?: number): GameState {
    return withLock(() => {
      currentGame = setNationalPolicy(getGame(), type as PolicyType, { targetCityId });
      return getClientGame();
    });
  },

  patrolCity(cityId: number, officerId: number): GameState {
    return withLock(() => {
      currentGame = patrolCity(getGame(), cityId, officerId, runtimeRandom);
      return getClientGame();
    });
  },

  reclaimLand(cityId: number, officerId: number): GameState {
    return withLock(() => {
      currentGame = reclaimLand(getGame(), cityId, officerId, runtimeRandom);
      return getClientGame();
    });
  },

  buyArms(amount: number): GameState {
    return withLock(() => {
      currentGame = buyArms(getGame(), amount);
      return getClientGame();
    });
  },

  resolveImpeachment(cityId: number, action: 'appease' | 'remove'): GameState {
    return withLock(() => {
      currentGame = resolveImpeachment(getGame(), cityId, action);
      return getClientGame();
    });
  },

  seekBeauty(cityId: number): GameState {
    return withLock(() => {
      currentGame = seekBeauty(getGame(), cityId, runtimeRandom);
      return getClientGame();
    });
  },

  rewardBeautyStock(officerId: number, amount?: number): GameState {
    return withLock(() => {
      currentGame = rewardBeautyStock(getGame(), officerId, amount);
      return getClientGame();
    });
  },

  marry(femaleId: number, officerId: number): GameState {
    return withLock(() => {
      currentGame = marryFemale(getGame(), femaleId, officerId);
      return getClientGame();
    });
  },

  searchTalent(cityId: number): GameState {
    return withLock(() => {
      currentGame = searchTalent(getGame(), cityId, runtimeRandom);
      return getClientGame();
    });
  },

  recruitOfficer(officerId: number, recruiterId?: number): GameState {
    return withLock(() => {
      currentGame = recruitOfficer(getGame(), officerId, runtimeRandom, recruiterId != null ? recruiterId : undefined);
      return getClientGame();
    });
  },

  appoint(officerId: number, track: PositionTrack, position: string, cityId?: number): GameState {
    return withLock(() => {
      currentGame = appointOfficer(getGame(), officerId, track, position, cityId != null ? cityId : undefined);
      return getClientGame();
    });
  },

  grantNobility(officerId: number, targetRank: NobilityRank): GameState {
    return withLock(() => {
      currentGame = grantNobility(getGame(), getGame().playerFactionId, officerId, targetRank);
      return getClientGame();
    });
  },

  joinFaction(officerId: number, factionId: number, cityId?: number): GameState {
    return withLock(() => {
      const state = getGame();
      const officer = state.officers[officerId];
      if (!officer) throw new Error('武将不存在');
      if (officer.faction != null) throw new Error('该武将已有势力，不可直接加入');
      if (factionId !== state.playerFactionId) throw new Error('仅可招募武将加入己方势力');
      currentGame = joinFaction(state, officerId, factionId, runtimeRandom, cityId);
      return getClientGame();
    });
  },

  releaseOfficer(officerId: number): GameState {
    return withLock(() => {
      const state = getGame();
      const officer = state.officers[officerId];
      if (!officer) throw new Error('武将不存在');
      if (officer.faction !== state.playerFactionId) throw new Error('仅可释放己方势力武将');
      currentGame = releaseOfficer(state, officerId);
      return getClientGame();
    });
  },

  followCheck(): GameState {
    return withLock(() => {
      currentGame = tickFollowCheck(getGame(), runtimeRandom);
      return getClientGame();
    });
  },

  equipItem(officerId: number, itemId: number): GameState {
    return withLock(() => {
      currentGame = equipItem(getGame(), officerId, itemId);
      return getClientGame();
    });
  },

  unequipItem(officerId: number, itemId: number): GameState {
    return withLock(() => {
      currentGame = unequipItem(getGame(), officerId, itemId);
      return getClientGame();
    });
  },

  grantTreasure(officerId: number, itemId: number): GameState {
    return withLock(() => {
      currentGame = grantTreasure(getGame(), officerId, itemId);
      return getClientGame();
    });
  },

  tribute(targetFactionId: number): GameState {
    return withLock(() => {
      currentGame = tributeGold(getGame(), targetFactionId);
      return getClientGame();
    });
  },

  transferCourtNetwork(targetFactionId: number, amount?: number): GameState {
    return withLock(() => {
      currentGame = transferCourtNetwork(getGame(), targetFactionId, amount != null ? amount : 1);
      return getClientGame();
    });
  },

  alliance(targetFactionId: number): GameState {
    return withLock(() => {
      currentGame = formAlliance(getGame(), targetFactionId, runtimeRandom);
      return getClientGame();
    });
  },

  establishHegemony(): GameState {
    return withLock(() => {
      currentGame = establishHegemony(getGame(), getGame().playerFactionId);
      return getClientGame();
    });
  },

  kingRequirements() {
    return getKingRequirements(getGame(), getGame().playerFactionId);
  },

  proclaimKing(kingdomName: string): GameState {
    return withLock(() => {
      currentGame = proclaimKing(getGame(), getGame().playerFactionId, kingdomName);
      return getClientGame();
    });
  },

  falseDecreeWar(targetFactionId: number): GameState {
    return withLock(() => {
      currentGame = declareWarByFalseDecree(getGame(), getGame().playerFactionId, targetFactionId);
      return getClientGame();
    });
  },

  recruitSpies(cityId: number): GameState {
    return withLock(() => {
      currentGame = recruitSpies(getGame(), cityId, runtimeRandom);
      return getClientGame();
    });
  },

  trainFemaleSpy(cityId: number): GameState {
    return withLock(() => {
      currentGame = trainFemaleSpy(getGame(), cityId, runtimeRandom);
      return getClientGame();
    });
  },

  plantFemale(targetFactionId: number): GameState {
    return withLock(() => {
      currentGame = plantFemaleFromGift(getGame(), targetFactionId, runtimeRandom);
      return getClientGame();
    });
  },

  spyMission(agentId: string, type: string, targetCityId: number, targetOfficerId?: number): GameState {
    return withLock(() => {
      currentGame = dispatchMission(getGame(), {
        agentId,
        type: type as SpyMissionType,
        targetCityId,
        targetOfficerId,
      }, runtimeRandom);
      return getClientGame();
    });
  },

  stationCounter(agentId: string, cityId: number): GameState {
    return withLock(() => {
      currentGame = stationCounter(getGame(), agentId, cityId);
      return getClientGame();
    });
  },

  unstationCounter(cityId: number): GameState {
    return withLock(() => {
      currentGame = unstationCounter(getGame(), cityId);
      return getClientGame();
    });
  },

  captive(agentId: string, action: string): GameState {
    return withLock(() => {
      currentGame = resolveCaptive(getGame(), agentId, action as SpyCaptiveAction);
      return getClientGame();
    });
  },

  launchPlot(
    type: string,
    opts: {
      targetFactionId?: number;
      targetCityId?: number;
      feintCityId?: number;
      secondaryFactionId?: number;
      targetOfficerId?: number;
      agentId?: string;
    },
  ): GameState {
    return withLock(() => {
      currentGame = launchPlot(getGame(), {
        type: type as PlotType,
        targetFactionId: opts.targetFactionId,
        targetCityId: opts.targetCityId,
        feintCityId: opts.feintCityId,
        secondaryFactionId: opts.secondaryFactionId,
        targetOfficerId: opts.targetOfficerId,
        agentId: opts.agentId || undefined,
      }, runtimeRandom);
      return getClientGame();
    });
  },

  cancelPlot(plotId: string): GameState {
    return withLock(() => {
      currentGame = cancelPlot(getGame(), plotId);
      return getClientGame();
    });
  },

  canReach(targetCityId: number): boolean {
    return isMarchTargetReachable(getGame(), targetCityId);
  },

  suggestFromCity(targetCityId: number): number | null {
    return pickDefaultFromCity(getGame(), targetCityId);
  },

  /** 兼容旧路径：无出发城时回退纯演示战。 */
  startBattle(cityId: number, fromCityId?: number): BattleState {
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
  },

  march(targetCityId: number, fromCityId?: number, troopCount?: number): { game: GameState; battle: BattleState } {
    return withLock(() => {
      const state = getGame();
      const from = fromCityId ?? pickDefaultFromCity(state, targetCityId);
      if (from == null) throw new Error('没有可出征的己方城（需至少 1000 兵）');
      const result = prepareMarch(state, { fromCityId: from, targetCityId, troopCount });
      const stateWithIntel = grantBattleIntel(result.state, targetCityId);
      commitActiveBattle(result.battle, stateWithIntel);
      return { game: getClientGame(), battle: result.battle };
    });
  },

  getBattle(): BattleState | null {
    return getActiveBattle();
  },

  moveRange(unitId: string): string[] {
    const battle = getActiveBattle();
    if (!battle) return [];
    return getMoveRange(battle, unitId);
  },

  movePath(unitId: string, q: number, r: number) {
    const battle = getActiveBattle();
    if (!battle) throw new Error('无战斗');
    return getMovePath(battle, unitId, q, r);
  },

  move(unitId: string, q: number, r: number): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = moveUnit(battle, unitId, q, r);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  undo(): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = undoLastBattleAction(battle);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  attack(attackerId: string, defenderId: string): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = attackUnit(battle, attackerId, defenderId, getGame(), runtimeRandom);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  fire(attackerId: string, targetId: string): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = castFireTactic(battle, attackerId, targetId, getGame(), runtimeRandom);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  weather(attackerId: string, weather: string): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = castWeatherSkill(battle, attackerId, weather, getGame());
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  usableAbilities(unitId: string) {
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
  },

  ability(attackerId: string, targetId: string, abilityId: string): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = castAbility(battle, attackerId, targetId, abilityId, getGame(), runtimeRandom);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  finishPlayer(): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = finishPlayerAction(battle);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  retreat(): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = retreatBattle(battle);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  formation(unitId: string, targetFormation: FormationType): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = changeBattleFormation(battle, unitId, targetFormation, getGame());
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  duelChallenge(challengerUnitId: string, targetUnitId: string, stance: DuelStance): BattleState {
    return withLock(() => {
      const activeBattle = getActiveBattle();
      if (!activeBattle) throw new Error('无战斗');
      const { battle, accepted } = challengeDuel(activeBattle, challengerUnitId, targetUnitId, getGame(), runtimeRandom, stance);
      if (!accepted) {
        commitActiveBattle(battle);
        return battle;
      }
      const nextBattle = stepBattleDuel(battle, getGame(), runtimeRandom);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  duelStep(): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = stepBattleDuel(battle, getGame(), runtimeRandom);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  duelSkip(): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = skipBattleDuel(battle, getGame(), runtimeRandom);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  enemyPhase(): BattleState {
    return withLock(() => {
      const battle = getActiveBattle();
      if (!battle) throw new Error('无战斗');
      const nextBattle = runEnemyPhase(battle, getGame(), runtimeRandom);
      commitActiveBattle(nextBattle);
      return nextBattle;
    });
  },

  exitBattle(): GameState {
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
        const voluntaryRetreat = battle.units.some((unit) => unit.side === 'attacker' && unit.isRetreated);
        const attackerTroopsBeforeRetreat = battle.units
          .filter((unit) => unit.side === 'attacker' && !unit.isDestroyed)
          .reduce((sum, unit) => sum + unit.troopCount, 0);
        const attackerTroops = voluntaryRetreat
          ? Math.floor(attackerTroopsBeforeRetreat * 0.5)
          : battle.units
            .filter((unit) => unit.side === 'attacker' && !unit.isDestroyed && !unit.isRetreated)
            .reduce((sum, unit) => sum + unit.troopCount, 0);
        const defenderTroops = battle.units
          .filter((unit) => unit.side === 'defender' && !unit.isDestroyed && !unit.isRetreated)
          .reduce((sum, unit) => sum + unit.troopCount, 0);
        const resolved = {
          ...tacticalMelee,
          attackerTroops,
          defenderTroops,
          attackerMorale: battle.units.find((unit) => unit.side === 'attacker')?.morale ?? 0,
          defenderMorale: battle.units.find((unit) => unit.side === 'defender')?.morale ?? 0,
          attackerFormation: battle.units.find((unit) => unit.side === 'attacker')?.formation ?? tacticalMelee.attackerFormation,
          phase: battle.winner === 'attacker' ? ('attacker_victory' as const) : ('defender_victory' as const),
          eventLog: [...tacticalMelee.eventLog, `六角微操结算：${voluntaryRetreat ? '战术撤退（50%回流）' : battle.winner === 'attacker' ? '攻方胜' : '守方胜'}`],
        };
        const withoutBattle = {
          ...state,
          activeBattles: state.activeBattles.filter((item) => item.id !== battle.id),
          activeMelee: resolved,
        };
        currentGame = applyMeleeSettlement(withoutBattle, resolved);
        return getClientGame();
      }
      let nextState = state;
      if (!battle.settled && battle.fromCityId != null) {
        nextState = settleBattle(state, battle, runtimeRandom);
      } else if (!battle.settled && battle.cityId != null && battle.phase === 'over') {
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
  },

  // ====== 战场地图（Tier I，镜像 services/game.ts §战场地图） ======

  battlefieldInit(targetCityId: number, fromCityId: number): BattlefieldMap {
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
  },

  getBattlefield(): BattlefieldMap | null {
    return getGame().activeBattlefield;
  },

  battlefieldMarch(armyId: string, targetNodeId: number): { game: GameState; battlefield: BattlefieldMap } {
    return withLock(() => {
      const state = getGame();
      const battlefield = state.activeBattlefield;
      if (!battlefield) throw new Error('没有活跃战场');

      const army = state.campaignArmies.find((a) => a.id === armyId);
      if (!army) throw new Error('Army 不存在');

      const targetNode = battlefield.nodes.find((n) => n.id === targetNodeId);
      if (!targetNode) throw new Error('目标节点不在战场范围内');
      if (!targetNode.adjacentNodeIds.includes(army.currentNodeId)) {
        throw new Error('目标节点不邻接当前节点');
      }

      const armiesWithPath = state.campaignArmies.map((a) =>
        a.id === armyId
          ? { ...a, path: [targetNodeId], targetNodeId, phase: 'marching' as const }
          : a,
      );
      const stateWithPath = { ...state, campaignArmies: armiesWithPath };

      const marchResult = tickBattlefieldMarch(stateWithPath, battlefield);
      currentGame = { ...marchResult.state, activeBattlefield: marchResult.battlefield };

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

      return { game: getClientGame(), battlefield: currentGame.activeBattlefield! };
    });
  },

  battlefieldExit(): GameState {
    return withLock(() => {
      currentGame = { ...getGame(), activeBattlefield: null, activeMelee: null };
      return getClientGame();
    });
  },

  // ====== 白刃战（Tier II，镜像 services/game.ts §白刃战） ======

  meleeStart(attackerArmyId: string, defenderArmyId: string): { game: GameState; melee: MeleeState } {
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
  },

  getMelee(): MeleeState | null {
    return getGame().activeMelee;
  },

  /** 从同一白刃战快照选择唯一结算模式；重复提交同一模式幂等，不得改选。 */
  meleeSelectMode(mode: MeleeEntryMode): { game: GameState; melee: MeleeState; battle?: BattleState } {
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
        // 结果桥接回 melee 状态后由 applyMeleeSettlement 一次回写。
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
        return { game: getClientGame(), melee: currentGame.activeMelee! };
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
  },

  /** 执行一回合白刃战（FM-P3 §7.5 动作级幂等：commandId + expectedRound） */
  meleeRound(
    actionType: string,
    targetFormation?: FormationType,
    commandId?: string,
    expectedRound?: number,
  ): { game: GameState; result: MeleeRoundResult; melee: MeleeState } {
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

      return { game: getClientGame(), result, melee: currentGame.activeMelee! };
    });
  },

  /** 刷新白刃战战术点 */
  meleeRefresh(): MeleeState {
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
  },

  /** 退出白刃战 */
  meleeExit(): { game: GameState } {
    return withLock(() => {
      currentGame = { ...getGame(), activeMelee: null };
      return { game: getClientGame() };
    });
  },

  /** 设定攻方玩家持久战术姿态（FM-P3）：null 清除为中性；不耗 TP、不推进回合。 */
  meleeSetTactic(tactic: import('@leh/shared').TacticalTacticId | null): { game: GameState; melee: MeleeState } {
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
  },

  exportSave() {
    return buildSaveEnvelope(getGame(), getRuntimeRngState());
  },

  importSave(input: unknown): GameState {
    return withLock(() => {
      const adopted = adoptSaveEnvelope(input);
      restoreRuntimeRng(adopted.rng);
      currentGame = adopted.snapshot;
      return getClientGame();
    });
  },

  campaignStart(opts: Parameters<typeof campaignStartEngine>[1]): { game: GameState; army: ReturnType<typeof campaignStartEngine>['army'] } {
    return withLock(() => {
      const result = campaignStartEngine(getGame(), opts);
      currentGame = result.state;
      return { game: getClientGame(), army: result.army };
    });
  },

  campaignMarch(armyId: string, targetNodeId: number): GameState {
    return withLock(() => {
      currentGame = campaignOrderMarchEngine(getGame(), armyId, targetNodeId);
      return getClientGame();
    });
  },

  campaignBuild(armyId: string, structureType: string): GameState {
    return withLock(() => {
      currentGame = campaignBuildStructureEngine(getGame(), armyId, structureType as StructureType);
      return getClientGame();
    });
  },

  campaignAssault(armyId: string): { game: GameState; result: ReturnType<typeof campaignAssaultEngine>['result'] } {
    return withLock(() => {
      const result = campaignAssaultEngine(getGame(), armyId, runtimeRandom);
      currentGame = result.state;
      return { game: getClientGame(), result: result.result };
    });
  },

  campaignSiegeSurrender(armyId: string): { game: GameState; success: boolean } {
    return withLock(() => {
      const result = campaignTrySiegeSurrenderEngine(getGame(), armyId, runtimeRandom);
      currentGame = result.state;
      return { game: getClientGame(), success: result.success };
    });
  },

  campaignRetreat(armyId: string): GameState {
    return withLock(() => {
      currentGame = campaignRetreatArmyEngine(getGame(), armyId);
      return getClientGame();
    });
  },

  campaignAdvisor(armyId: string, action: AdvisorAction): GameState {
    return withLock(() => {
      currentGame = campaignAdvisorActionEngine(getGame(), armyId, action);
      return getClientGame();
    });
  },
};

// ====== RPC 入口 ======
self.addEventListener('message', (event: MessageEvent<{ id: number; method: string; args?: unknown[] }>) => {
  const { id, method } = event.data;
  const args = event.data.args ?? [];
  try {
    const handler = handlers[method] as ((...a: unknown[]) => unknown) | undefined;
    if (!handler) throw new Error(`离线版暂未实装指令：${method}`);
    const data = handler(...args);
    void (self as unknown as { postMessage: (msg: unknown) => void }).postMessage({ id, ok: true, data });
  } catch (e) {
    void (self as unknown as { postMessage: (msg: unknown) => void }).postMessage({
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
