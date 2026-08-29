// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 双端共用编排管线（离线可玩版 Session 372 Phase 3）。
 *
 * 自 services/game.ts 原样搬移：服务端 Express 与浏览器 Worker 共用同一实现，
 * 保证在线/离线结算逐字节一致。静态数据经 ../data/loader.js 注入——浏览器构建由
 * client/vite.config.ts 的 leh-browser-loader 插件重定向到 Vite JSON 导入 shim。
 */
import {
  parseCurrentSaveEnvelope,
  rejoinSaveStaticEchoes,
  STATIC_ECHO_OFFICER_KEYS,
  type SerializableRngState,
  CivilPosition,
  LocalPosition,
  MilitaryPosition,
  NobilityRank,
  OfficerStatus,
  Season,
  TerrainType,
  initialCourtNetworkOpportunities,
  calcStaminaMax,
  meritLevelFor,
  emptyIntel,
  CURRENT_SAVE_SCHEMA_VERSION,
  splitDemographics,
  syncMerit,
  deriveCityFactions,
  type City,
  type EventSourceClass,
  type GameState,
  type FemaleCharacter,
  type Faction,
  type Officer,
  type ScenarioStatic,
} from '@leh/shared';
import { staticData } from '../data/loader.js';
import { advanceTurn, tickBattlefieldInstance } from './turn.js';
import { catchUpChildren } from './child.js';
import { applyInitialItems } from './items.js';
import {
  buildCampaignNodes,
  getCampaignNodes,
  tickCampaignGarrison,
  tickCampaignMarch,
  tickConstruction,
} from './campaign.js';
import { syncFactionResources } from './economy.js';
import { tickGrandStrategists as gsTick } from './grandStrategist.js';

export function buildGameState(
  scenario: ScenarioStatic,
  playerFactionId: number,
  enabledEventLayers: EventSourceClass[],
): GameState {
  const { startState } = scenario;
  const officers: Record<number, Officer> = {};
  const availableOfficerIds = new Set(scenario.availableOfficerIds);
  for (const o of staticData.officers.filter((item) => availableOfficerIds.has(item.id))) {
    const pos = startState.officerPositions.find((p) => p.officerId === o.id);
    officers[o.id] = syncMerit({
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
      stamina: calcStaminaMax(o, meritLevelFor(pos?.merit ?? 0), scenario.noLifespan ? 40 : (startState.year - o.birthYear)),
      actionsPerMonth: 1,
      wifeId: null,
      beauties: [],
    });
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
        culture: 0,
      },
      gold: 2000 + c.initialStats.commerce,
      food: 3000 + c.initialStats.farm,
      population,
      demographics,
      courtNetworkOpportunities: initialCourtNetworkOpportunities({
        isCapital: c.isCapital,
        commerce: c.initialStats.commerce,
        morale: 70,
      }),
      troops: 5000,
      troopsMorale: 70,
      officers: cityOfficers,
      ruler,
      facilities: c.facilities ?? [],
      policy: c.policy ?? null,
      developmentProgress: c.developmentProgress ?? { farm: 0, commerce: 0, wall: 0 },
      cityFactions: deriveCityFactions(c.id),
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
      courtNetwork: 0,
      cityIds,
      officerIds,
      isPlayer: fid === playerFactionId,
      isAlive: true,
      fame: 100,
      politicalStage: 'vassal',
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
    nationalPolicies: [],
    completedEvents: [...startState.completedEvents],
    pendingEvents: [],
    invalidatedEvents: [],
    eventChoices: {},
    pendingFamilyTreatment: null,
    actionLog: [
      {
        year: startState.year,
        month: startState.month,
        type: 'game_start',
        message: `开始剧本「${scenario.name}」，扮演 ${factions[playerFactionId]?.name}`,
      },
    ],
    // HC-P0-1（docs/26 Q1 方案A）：汉献帝开局在洛阳（id=1）。
    // 两个剧本均 190 年正月开局，汉帝此时在洛阳（董卓迁都长安是二月事件，开局未触发）。
    // 城池易主时本字段不变，"控制汉帝"由 controlsEmperor() 按当前城池归属动态判定。
    emperorLocation: 1,
    // S24：运行时亲和度表（空表=全部回退 pairAffinity 基线）
    relationAffinities: {},
  };
  // 子女补登：appearYear ≤ 开局年则直接入库（0-A 起 190 年通常无人）
  const withChildren = catchUpChildren(draft);
  // 初始宝配：签名武将装备 + 其余 initial 宝物入势力库存（S13 Session 266）
  const withItems = applyInitialItems(withChildren);
  // 城池金粮为真源，开局即同步 faction 缓存
  const synced = syncFactionResources(withItems);
  // 战役节点：基于同步后的城池状态生成
  return { ...synced, campaignNodes: buildCampaignNodes(synced) };
}

/** 回合结算统一管线：advanceTurn → 战役行军/驻守/建造 → 总军师 → 郡域战场 → 节点重建。 */
export function runEndTurnPipeline(before: GameState, rng: () => number): GameState {
  let next = advanceTurn(before, rng);
  next = tickCampaignMarch(next);
  next = tickCampaignGarrison(next);
  next = tickConstruction(next);
  next = gsTick(next, rng);
  next = tickBattlefieldInstance(next, rng);
  return { ...next, campaignNodes: getCampaignNodes(next) };
}

/** 存档信封组装（rng 快照由调用方按所在域注入）。
 * P2-2（Session 414）：officers 静态回声键在保存侧剥离（biography/hidden/unitProficiency/
 * formationMastery/tags/avatarGene/appearance），加载时 adoptSaveEnvelope 经
 * rejoinSaveStaticEchoes 从静态名录回注——0-B 1000+ 武将下 officers 段体积约降 60%+。
 * 返回类型按语义标注为完整 GameState 信封（剥离仅是序列化体积优化，语义由回注保证）。 */
export function buildSaveEnvelope(snapshot: GameState, rng: SerializableRngState): import('@leh/shared').SaveEnvelopeV1<GameState> {
  const now = new Date().toISOString();
  const slimOfficers = Object.fromEntries(
    Object.entries(snapshot.officers).map(([id, officer]) => {
      const next: Record<string, unknown> = { ...officer };
      for (const key of STATIC_ECHO_OFFICER_KEYS) delete next[key];
      return [id, next];
    }),
  );
  return {
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    scenarioId: snapshot.scenarioId,
    rng,
    snapshot: { ...snapshot, officers: slimOfficers },
  } as unknown as import('@leh/shared').SaveEnvelopeV1<GameState>;
}

/** 读档校验链：迁移 + 完整 Schema + 剧本存在性与史料层兼容；返回快照与 rng 状态。 */
export function adoptSaveEnvelope(input: unknown): { snapshot: GameState; rng: SerializableRngState } {
  // P2-2：剥离态 officers 先从静态名录回注，再走完整 Schema 校验（旧档键已在，幂等）。
  const envelope = parseCurrentSaveEnvelope(rejoinSaveStaticEchoes(input, staticData.officers));
  const scenario = staticData.scenarios.find((item) => item.id === envelope.scenarioId);
  if (!scenario) throw new Error('存档引用的剧本不存在');
  const availableLayers = new Set(scenario.availableEventLayers);
  if (envelope.snapshot.enabledEventLayers.some((layer) => !availableLayers.has(layer))) {
    throw new Error('存档事件史料层与当前剧本不兼容');
  }
  return { snapshot: envelope.snapshot, rng: envelope.rng };
}
