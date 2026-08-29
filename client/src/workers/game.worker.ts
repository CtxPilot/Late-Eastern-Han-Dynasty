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
  OfficerStatus,
  PolicyType,
  PlotType,
  SpyCaptiveAction,
  SpyMissionType,
  getRuntimeRngState,
  resetRuntimeRng,
  restoreRuntimeRng,
  runtimeRandom,
  grantMerit,
  FIRST_BATCH_COUNTY_IDS,
  generateCommanderyBattlefield,
  getCommanderyIds,
  getCommanderyTemplate,
  type BattlefieldDuelContext,
  type BattlefieldInstance,
  type BattleState,
  type BattlefieldMap,
  type CampaignArmy,
  type CampaignNode,
  type DuelStance,
  type EventSourceClass,
  type FamilyTreatmentMode,
  type FormationType,
  type GameState,
  type GrandStrategist,
  type MeleeEntryMode,
  type MeleeRoundResult,
  type MeleeState,
  type Officer,
  type OfficerRelation,
  type PositionTrack,
  type StaticRelation,
  type StrategyModifiers,
  type StrategyType,
  type StructureType,
  mergeSkillsWithTree,
  relationState,
  resolveAffinity,
  skillPointsForMerit,
  traitPointsForMerit,
  computeMandate,
  computePopularWill,
  mandateLabel,
  popularWillLabel,
  mandateDiplomacyModifier,
  popularWillDesertionModifier,
  popularWillRecruitModifier,
  fameLabel,
} from '@leh/shared';
import { staticData } from './browser-loader';
import { computeGamePatch } from '../utils/game-patch';
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
import {
  assignDelegationCity,
  createDelegationRegion,
  disbandDelegationRegion,
  updateDelegationRegion,
} from '../../../server/src/engine/delegation.js';
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
  settleTacticalMeleeTroops,
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
  getCampaignNodes,
  type AdvisorAction,
} from '../../../server/src/engine/campaign.js';
import {
  appointGrandStrategist as gsAppoint,
  dismissGrandStrategist as gsDismiss,
  switchStrategy as gsSwitchStrategy,
  getFactionStrategy,
  calcStrategyModifiers,
} from '../../../server/src/engine/grandStrategist.js';
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
import { setTournamentPreferredMode as applyTournamentPreferredMode, setTournamentPlayerEntries as applyTournamentPlayerEntries, placeTournamentChampionBet as applyPlaceTournamentChampionBet, clearTournamentChampionBet as applyClearTournamentChampionBet } from '@leh/shared';
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
import { duelEquipBonusFor, equipItem, grantTreasure, unequipItem } from '../../../server/src/engine/items.js';
import { createDuel, DEFAULT_DUEL_CONFIG, runDuelToCompletion, stepDuel } from '../../../server/src/battle/duel.js';
import { buildAnnualBudget } from '../../../server/src/engine/budget.js';
import { appointOfficer } from '../../../server/src/engine/appoint.js';
import { grantNobility } from '../../../server/src/engine/nobility.js';
import { setStaticRelationsForTest } from '../../../server/src/engine/relations.js';
import { resolveEventChoice } from '../../../server/src/engine/event.js';
import { setFormationCatalog } from '../../../server/src/battle/crit.js';
import { setHexFormationCatalog } from '../../../server/src/battle/hex-formation.js';
import { loadSkillTrees, loadTacticalSystemV2 } from './browser-loader';

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

function relationsList(): StaticRelation[] {
  return ((relationsJson as { relations?: unknown }).relations ?? relationsJson) as StaticRelation[];
}

function baselineSkillsFor(officerId: number): import('@leh/shared').OfficerSkillStatic[] {
  return staticData.officers.find((o) => o.id === officerId)?.skills ?? [];
}

function readOfficerSkillState(officerId: number) {
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

function countOwnedCommanderies(factionId: number, state: GameState): number {
  const owned = new Set<string>();
  for (const city of Object.values(state.cities)) {
    if (city.ruler === factionId) {
      owned.add(city.adminName ?? city.province);
    }
  }
  return owned.size;
}

function pickBattlefieldDuelOfficer(state: GameState, factionId: number, preferredId?: number): Officer {
  const candidates = Object.values(state.officers)
    .filter((officer) => officer.faction === factionId && officer.status === OfficerStatus.ACTIVE)
    .sort((a, b) => b.stats.war - a.stats.war || a.id - b.id);
  const preferred = preferredId == null ? undefined : candidates.find((officer) => officer.id === preferredId);
  const picked = preferred ?? candidates[0];
  if (!picked) throw new Error('该势力没有可参与单挑的武将');
  return picked;
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

// ====== 处理器表：逐函数镜像 services/game.ts ======

// P2-4（Session 418）：通用差分补丁——RPC 分发单点对「GameState 形响应」做 COW 身份差分，
// 全部端点自动获得增量通道；`prevClient` 与客户端 lastClientGame 保持镜像。
let prevClient: unknown = null;

function isGameStateLike(data: unknown): boolean {
  return typeof data === 'object' && data !== null
    && 'officers' in data && 'cities' in data && 'factions' in data && 'currentYear' in data;
}

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

  createDelegationRegion(input: {
    name?: string;
    cityIds: number[];
    governorId: number;
    policy?: string;
    autoRecruit?: boolean;
    autoReward?: boolean;
  }): GameState {
    return withLock(() => {
      currentGame = createDelegationRegion(getGame(), { ...input, policy: input.policy as import('@leh/shared').DelegationPolicy | undefined });
      return getClientGame();
    });
  },

  updateDelegationRegion(input: {
    regionId: number;
    name?: string;
    policy?: string;
    autoRecruit?: boolean;
    autoReward?: boolean;
  }): GameState {
    return withLock(() => {
      currentGame = updateDelegationRegion(getGame(), { ...input, policy: input.policy as import('@leh/shared').DelegationPolicy | undefined });
      return getClientGame();
    });
  },

  assignDelegationCity(input: { regionId: number; cityId: number; remove?: boolean }): GameState {
    return withLock(() => {
      currentGame = assignDelegationCity(getGame(), input);
      return getClientGame();
    });
  },

  disbandDelegationRegion(regionId: number): GameState {
    return withLock(() => {
      currentGame = disbandDelegationRegion(getGame(), regionId);
      return getClientGame();
    });
  },

  setNationalPolicy(type: string, targetCityId?: number): GameState {
    return withLock(() => {
      currentGame = setNationalPolicy(getGame(), type as PolicyType, { targetCityId });
      return getClientGame();
    });
  },

  setTournamentPreferredMode(mode: string): GameState {
    return withLock(() => {
      if (mode !== 'fair' && mode !== 'unrestricted') {
        throw new Error('无效的大会模式');
      }
      currentGame = applyTournamentPreferredMode(getGame(), mode);
      return getClientGame();
    });
  },

  setTournamentPlayerEntries(officerIds: number[]): GameState {
    return withLock(() => {
      currentGame = applyTournamentPlayerEntries(getGame(), officerIds).state;
      return getClientGame();
    });
  },

  placeTournamentChampionBet(officerId: number, amount: number): GameState {
    return withLock(() => {
      currentGame = applyPlaceTournamentChampionBet(getGame(), officerId, amount);
      return getClientGame();
    });
  },

  clearTournamentChampionBet(): GameState {
    return withLock(() => {
      currentGame = applyClearTournamentChampionBet(getGame());
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
        // P1-3（Session 411）：结算口径收口到 engine 纯函数（撤退 50% 等价；攻方胜伤兵归队 15%）
        const tacticalSettlement = settleTacticalMeleeTroops(battle);
        const attackerTroops = tacticalSettlement.attackerTroops;
        const defenderTroops = tacticalSettlement.defenderTroops;
        const resolved = {
          ...tacticalMelee,
          attackerTroops,
          defenderTroops,
          attackerMorale: battle.units.find((unit) => unit.side === 'attacker')?.morale ?? 0,
          defenderMorale: battle.units.find((unit) => unit.side === 'defender')?.morale ?? 0,
          attackerFormation: battle.units.find((unit) => unit.side === 'attacker')?.formation ?? tacticalMelee.attackerFormation,
          phase: battle.winner === 'attacker' ? ('attacker_victory' as const) : ('defender_victory' as const),
          eventLog: [...tacticalMelee.eventLog, `六角微操结算：${tacticalSettlement.note}`],
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

  // ====== 战役节点 / 郡域实例只读 / 总军师 / 关系网 / 技能树 / 势力总览（Session 375 离线覆盖） ======

  campaignNodes(): CampaignNode[] {
    return getCampaignNodes(getGame());
  },

  getBattlefieldInstance(): BattlefieldInstance | null {
    return getGame().activeBattlefieldInstance ?? null;
  },

  // ====== 郡域战场实例写链（BF-P2/P4，镜像 services/game.ts；Session 376 离线覆盖） ======

  enterNanjunBattlefield(commandery = 'nanjun'): GameState {
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
  },

  exitNanjunBattlefield(): GameState {
    return withLock(() => {
      currentGame = { ...getGame(), activeBattlefieldInstance: null };
      return getClientGame();
    });
  },

  grandStrategistAppoint(officerId: number): { game: GameState; strategist: GrandStrategist } {
    return withLock(() => {
      const state = getGame();
      const result = gsAppoint(state, state.playerFactionId, officerId);
      currentGame = result.state;
      return { game: getClientGame(), strategist: result.strategist };
    });
  },

  grandStrategistDismiss(): { game: GameState; log: string } {
    return withLock(() => {
      const state = getGame();
      const result = gsDismiss(state, state.playerFactionId);
      currentGame = result.state;
      return { game: getClientGame(), log: result.log };
    });
  },

  grandStrategistSwitch(strategy: string): { game: GameState; log: string } {
    return withLock(() => {
      const state = getGame();
      const result = gsSwitchStrategy(state, state.playerFactionId, strategy as StrategyType);
      currentGame = result.state;
      return { game: getClientGame(), log: result.log };
    });
  },

  grandStrategistStatus(): {
    strategist: GrandStrategist | null;
    modifiers: StrategyModifiers;
    hasStrategist: boolean;
  } {
    const state = getGame();
    const gs = state.grandStrategists.find((g) => g.factionId === state.playerFactionId) ?? null;
    const { strategy, hasStrategist } = getFactionStrategy(state, state.playerFactionId);
    const int = gs ? (state.officers[gs.officerId]?.stats.intelligence ?? 85) : 85;
    const mods = calcStrategyModifiers(strategy, int);
    return { strategist: gs, modifiers: mods, hasStrategist };
  },

  getOfficerRelations(officerId: number): OfficerRelation[] {
    const state = getGame();
    const officer = state.officers[officerId];
    if (!officer) return [];
    const result: OfficerRelation[] = [];
    const seen = new Set<string>();
    for (const rel of relationsList()) {
      if (rel.fromId !== officerId && rel.toId !== officerId) continue;
      const otherId = rel.fromId === officerId ? rel.toId : rel.fromId;
      const key = `${Math.min(officerId, otherId)}:${Math.max(officerId, otherId)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const target = state.officers[otherId];
      if (!target) continue;
      const aff = resolveAffinity(officer, target, state.relationAffinities);
      result.push({
        targetId: otherId,
        targetName: target.name,
        type: rel.type,
        source: rel.source,
        state: relationState(aff),
        affinity: Math.round(aff),
      });
    }
    return result;
  },

  getSkillTrees(): import('@leh/shared').SkillTreeDef[] {
    return loadSkillTrees();
  },

  getOfficerSkillState(officerId: number) {
    return readOfficerSkillState(officerId);
  },

  upgradeSkillNode(officerId: number, nodeId: string) {
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
      return readOfficerSkillState(officerId);
    });
  },

  upgradeTrait(officerId: number, traitId: string) {
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
      return readOfficerSkillState(officerId);
    });
  },

  resetSkillTree(officerId: number) {
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
      return readOfficerSkillState(officerId);
    });
  },

  getFactionOverview() {
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
  },

  engageCounty(countyId: string): GameState {
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

      // R6 县级主动 AI：县内守方 Army 参战 —— 取兵力最大一支为 defArmy 合成副本，
      // 结算后按比例回填各守方 Army 与县驻军；攻方胜 → 守方 Army 溃退。
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
  },

  startBattlefieldDuel(kind: BattlefieldDuelContext['kind'], nodeId: string, stance: DuelStance = 'delegate'): GameState {
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
  },

  stepBattlefieldDuel(): GameState {
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
  },

  skipBattlefieldDuel(): GameState {
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
  },

  closeBattlefieldDuel(): GameState {
    return withLock(() => {
      const state = getGame();
      const inst = state.activeBattlefieldInstance;
      if (!inst?.activeDuel) throw new Error('没有可关闭的阵前单挑');
      if (!inst.activeDuel.settlementApplied) throw new Error('单挑尚未结算');
      currentGame = { ...state, activeBattlefieldInstance: { ...inst, activeDuel: undefined } };
      return getClientGame();
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
    let patch: ReturnType<typeof computeGamePatch> | null = null;
    if (isGameStateLike(data)) {
      if (prevClient !== null) patch = computeGamePatch(prevClient, data);
      prevClient = data;
    }
    // 协议 v2：有差分且客户端持有上一帧时仅传补丁（patchOnly）；否则整态。
    void (self as unknown as { postMessage: (msg: unknown) => void }).postMessage(
      patch ? { id, ok: true, patchOnly: true, patch } : { id, ok: true, data },
    );
  } catch (e) {
    void (self as unknown as { postMessage: (msg: unknown) => void }).postMessage({
      id,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }
});
