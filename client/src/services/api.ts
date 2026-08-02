// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import axios, { isAxiosError } from 'axios';
import type { AutoBattleResult, BattleState, BattlefieldInstance, BattlefieldMap, CampaignArmy, CampaignNode, EventSourceClass, GameState, GrandStrategist, ItemStatic, MeleeRoundResult, MeleeState, OfficerRelation, ScenarioFactionSetup, SkillTreeDef, StrategyModifiers, StrategyType } from '@leh/shared';

const http = axios.create({ baseURL: '/api/game' });

function errMsg(e: unknown, fallback: string): string {
  if (isAxiosError(e) && e.response?.data && typeof e.response.data === 'object') {
    const data = e.response.data as { error?: string };
    if (data.error) return data.error;
  }
  if (e instanceof Error) return e.message;
  return fallback;
}

export { errMsg };

export interface ChildCatalogEntry {
  childId: number;
  childName: string;
  fatherId: number;
  motherId: number;
  birthYear: number;
  appearYear: number;
  source: string;
}

export interface EventCatalogEntry {
  id: number;
  name: string;
  description: string;
  category: string;
  sourceClass: EventSourceClass;
  sources: string[];
  dialogues: { speakerId?: number; speakerName: string; text: string }[];
  choices: { label: string }[];
}

export interface ScenarioCatalogEntry {
  id: number;
  name: string;
  type?: 'historical' | 'whatif';
  description: string;
  startYear: number;
  startMonth: number;
  scopeNote?: string;
  playableFactions: number[];
  recommendedFaction?: number;
  factionSetups: ScenarioFactionSetup[];
  availableEventLayers: EventSourceClass[];
  defaultEventLayers: EventSourceClass[];
}

export async function fetchStatic(): Promise<{
  children: ChildCatalogEntry[];
  events: EventCatalogEntry[];
  scenarios: ScenarioCatalogEntry[];
  items: ItemStatic[];
}> {
  const { data } = await http.get<{
    children?: ChildCatalogEntry[];
    events?: EventCatalogEntry[];
    scenarios?: ScenarioCatalogEntry[];
    items?: ItemStatic[];
  }>('/static');
  return {
    children: data.children ?? [],
    events: data.events ?? [],
    scenarios: data.scenarios ?? [],
    items: data.items ?? [],
  };
}

export async function chooseEvent(
  eventId: number,
  choiceIndex: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/event/choose', {
    eventId,
    choiceIndex,
  });
  return data;
}

export async function createGame(
  scenarioId: number,
  playerFactionId: number,
  eventLayers: EventSourceClass[],
): Promise<GameState> {
  const { data } = await http.post<GameState>('/create', {
    scenarioId,
    playerFactionId,
    eventLayers,
  });
  return data;
}

export async function getGameState(): Promise<GameState> {
  const { data } = await http.get<GameState>('/state');
  return data;
}

export async function endTurn(): Promise<GameState> {
  const { data } = await http.post<GameState>('/end-turn');
  return data;
}

export type DevelopKind = 'farm' | 'commerce' | 'wall';
export interface AnnualBudget {
  cityCount: number;
  months: 12;
  goldIncome: number;
  foodProduced: number;
  civilianAndMilitaryFood: number;
  projectGold: number;
  administrativeGold: number;
  salaryGold: 0;
  warLossGold: 0;
  netGold: number;
  netFood: number;
  notes: string[];
}

export async function getAnnualBudget(): Promise<AnnualBudget> {
  const { data } = await http.get<AnnualBudget>('/civil/budget');
  return data;
}

export async function developFarm(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/develop-farm', { cityId });
  return data;
}

export async function develop(cityId: number, kind: DevelopKind, officerId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/develop', { cityId, kind, officerId });
  return data;
}

export async function conscript(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/conscript', { cityId });
  return data;
}

export async function relief(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/relief', { cityId });
  return data;
}

export async function trainTroops(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/train', { cityId });
  return data;
}

/** S27 开垦：乡政派系命令（50金；智≥60 武将） */
export async function reclaimLand(cityId: number, officerId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/reclaim', { cityId, officerId });
  return data;
}

/** S27 巡查：乡政派系命令（30金；武≥60 武将） */
export async function patrolCity(cityId: number, officerId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/patrol', { cityId, officerId });
  return data;
}

/** S27 兵装采购（10金/件） */
export async function buyArms(amount: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/faction/buy-arms', { amount });
  return data;
}

/** S27 深化：弹劾处理（appease 安抚 / remove 撤换城主） */
export async function resolveImpeachment(cityId: number, action: 'appease' | 'remove'): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/impeach', { cityId, action });
  return data;
}

/** 地方结交：势力 courtNetwork+1，城市机会−1 */
export async function seekBeauty(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/seek-beauty', { cityId });
  return data;
}

/** @deprecated 同 seekBeauty */
export async function searchBeauty(cityId: number): Promise<GameState> {
  return seekBeauty(cityId);
}

/** 赏赐美女资源（库存点）加忠诚 */
export async function rewardBeautyStock(
  officerId: number,
  amount?: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/reward-beauty', {
    officerId,
    amount,
  });
  return data;
}

export async function marry(femaleId: number, officerId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/marry', {
    femaleId,
    officerId,
  });
  return data;
}

export async function searchTalent(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/search', { cityId });
  return data;
}

/** S13 宝物装备（Session 266）。 */
export async function equipItem(officerId: number, itemId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/items/equip', { officerId, itemId });
  return data;
}

/** S13 宝物卸下。 */
export async function unequipItem(officerId: number, itemId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/items/unequip', { officerId, itemId });
  return data;
}

/** S13 宝物赏赐（忠诚+5~20 + 自动装备）。 */
export async function grantTreasure(officerId: number, itemId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/items/grant', { officerId, itemId });
  return data;
}

export async function recruitOfficer(
  officerId: number,
  recruiterId?: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/recruit', {
    officerId,
    recruiterId,
  });
  return data;
}

/** S11/S12 任命三轨 + 霸府 */
export async function appointOfficer(
  officerId: number,
  track: 'civil' | 'local' | 'military' | 'hegemony',
  position: string,
  cityId?: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/appoint', {
    officerId,
    track,
    position,
    cityId,
  });
  return data;
}

export async function grantNobility(officerId: number, targetRank: string): Promise<GameState> {
  const { data } = await http.post<GameState>('/court/grant-nobility', {
    officerId,
    targetRank,
  });
  return data;
}

export async function recruitSpies(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/intel/recruit', { cityId });
  return data;
}

export async function plantFemale(targetFactionId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/intel/plant-female', {
    targetFactionId,
  });
  return data;
}

export async function trainFemaleSpy(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/intel/recruit-female', { cityId });
  return data;
}

export async function spyMission(
  agentId: string,
  type: string,
  targetCityId: number,
  targetOfficerId?: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/intel/mission', {
    agentId,
    type,
    targetCityId,
    targetOfficerId,
  });
  return data;
}

export async function stationCounter(
  agentId: string,
  cityId: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/intel/station', {
    agentId,
    cityId,
  });
  return data;
}

export async function unstationCounter(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/intel/unstation', { cityId });
  return data;
}

export async function resolveCaptive(
  agentId: string,
  action: string,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/intel/captive', {
    agentId,
    action,
  });
  return data;
}

export async function launchPlot(
  type: string,
  opts: {
    targetFactionId?: number;
    targetCityId?: number;
    targetOfficerId?: number;
    agentId?: string;
  },
): Promise<GameState> {
  const { data } = await http.post<GameState>('/plot/launch', {
    type,
    ...opts,
  });
  return data;
}

export async function joinFaction(
  officerId: number,
  factionId: number,
  cityId?: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/join-faction', {
    officerId,
    factionId,
    cityId,
  });
  return data;
}

export async function releaseOfficer(officerId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/release-officer', {
    officerId,
  });
  return data;
}

export async function followCheck(): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/follow-check', {});
  return data;
}

export async function transferCourtNetwork(
  targetFactionId: number,
  amount?: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/diplomacy/court-network', {
    targetFactionId,
    amount,
  });
  return data;
}

export async function tribute(targetFactionId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/diplomacy/tribute', {
    targetFactionId,
  });
  return data;
}

export async function formAlliance(targetFactionId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/diplomacy/alliance', {
    targetFactionId,
  });
  return data;
}

export async function startBattle(
  cityId: number,
  fromCityId?: number,
): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/start', {
    cityId,
    fromCityId,
  });
  return data;
}

/** 出征：扣兵粮并开战 */
export async function march(
  targetCityId: number,
  fromCityId?: number,
  troopCount?: number,
): Promise<{ game: GameState; battle: BattleState }> {
  const { data } = await http.post<{ game: GameState; battle: BattleState }>('/march', {
    targetCityId,
    fromCityId,
    troopCount,
  });
  return data;
}

export async function suggestFromCity(
  targetCityId: number,
): Promise<number | null> {
  const { data } = await http.get<{ fromCityId: number | null }>(
    `/march/suggest-from/${targetCityId}`,
  );
  return data.fromCityId;
}

export async function battleMove(unitId: string, q: number, r: number): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/move', { unitId, q, r });
  return data;
}

export async function battleUndo(): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/undo'); return data;
}

export async function battleAttack(attackerId: string, defenderId: string): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/attack', { attackerId, defenderId });
  return data;
}

export async function battleFire(attackerId: string, targetId: string): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/fire', { attackerId, targetId });
  return data;
}

export interface UsableAbility {
  id: string;
  name: string;
  level: number;
  energyCost: number;
  power: number;
  specialEffect: string;
  minRange: number;
  maxRange: number;
}

export async function battleUsableAbilities(unitId: string): Promise<UsableAbility[]> {
  const { data } = await http.get<{ abilities: UsableAbility[] }>(
    `/battle/abilities/${unitId}`,
  );
  return data.abilities ?? [];
}

export async function battleAbility(
  attackerId: string,
  targetId: string,
  abilityId: string,
): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/ability', {
    attackerId,
    targetId,
    abilityId,
  });
  return data;
}

export async function battleFinishPlayer(): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/finish-player');
  return data;
}

export async function getActiveBattle(): Promise<BattleState | null> {
  try {
    const { data } = await http.get<BattleState>('/battle');
    return data;
  } catch {
    return null;
  }
}

/** S10 §8 玩家发起单挑 */
export async function battleDuelChallenge(
  challengerUnitId: string,
  targetUnitId: string,
  stance: import('@leh/shared').DuelStance,
): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/duel/challenge', { challengerUnitId, targetUnitId, stance });
  return data;
}

/** S10 §8 推进单挑一回合 */
export async function battleDuelStep(): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/duel/step');
  return data;
}

/** S10 §8 跳过单挑动画 */
export async function battleDuelSkip(): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/duel/skip');
  return data;
}

export async function battleEnemyPhase(): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/enemy-phase');
  return data;
}

export async function battleMoveRange(unitId: string): Promise<string[]> {
  const { data } = await http.get<{ keys: string[] }>(`/battle/move-range/${unitId}`);
  return data.keys;
}

export async function battleMovePath(unitId: string, q: number, r: number): Promise<import('@leh/shared').PathResult> {
  const { data } = await http.get<import('@leh/shared').PathResult>(`/battle/move-path/${unitId}/${q}/${r}`);
  return data;
}

/** 退出战场并结算；返回最新 GameState（含占城） */
export async function exitBattle(): Promise<GameState> {
  const { data } = await http.post<GameState>('/battle/exit');
  return data;
}

// ====== 战役层 API（05 §十二~§十七 · 06 §2.14） ======

export interface CampaignStartBody {
  commanderId: number;
  subCommanderIds: number[];
  advisorId?: number;
  subAdvisorId?: number;
  fromNodeId: number;
  targetNodeId: number;
  unitType: string;
  formation: number;
  troopCount: number;
  food: number;
}

export async function campaignStart(body: CampaignStartBody): Promise<{ game: GameState; army: CampaignArmy }> {
  const { data } = await http.post<{ game: GameState; army: CampaignArmy }>('/campaign/start', body);
  return data;
}

export async function campaignMarch(armyId: string, targetNodeId: number): Promise<GameState> {
  const { data } = await http.post<GameState>(`/campaign/${armyId}/march`, { targetNodeId });
  return data;
}

export async function campaignBuild(armyId: string, structureType: string): Promise<GameState> {
  const { data } = await http.post<GameState>(`/campaign/${armyId}/build`, { structureType });
  return data;
}

export async function campaignAssault(armyId: string): Promise<{ game: GameState; result: AutoBattleResult }> {
  const { data } = await http.post<{ game: GameState; result: AutoBattleResult }>(`/campaign/${armyId}/assault`);
  return data;
}

export async function campaignSiegeSurrender(armyId: string): Promise<{ game: GameState; success: boolean }> {
  const { data } = await http.post<{ game: GameState; success: boolean }>(`/campaign/${armyId}/siege/surrender`);
  return data;
}

export async function campaignRetreat(armyId: string): Promise<GameState> {
  const { data } = await http.post<GameState>(`/campaign/${armyId}/retreat`);
  return data;
}

export async function campaignAdvisorAction(armyId: string, action: 'inspire' | 'trap' | 'retreat' | 'scout'): Promise<GameState> {
  const { data } = await http.post<GameState>(`/campaign/${armyId}/advisor/action`, { action });
  return data;
}

export async function campaignNodes(): Promise<CampaignNode[]> {
  const { data } = await http.get<{ nodes: CampaignNode[] }>('/campaign/nodes');
  return data.nodes ?? [];
}

// ====== 战场地图 API（Tier I） ======

/** 初始化战场地图 */
export async function battlefieldInit(targetCityId: number, fromCityId: number): Promise<BattlefieldMap> {
  const { data } = await http.post<BattlefieldMap>('/battlefield/init', { targetCityId, fromCityId });
  return data;
}

/** 获取当前战场地图 */
export async function getBattlefield(): Promise<BattlefieldMap | null> {
  try {
    const { data } = await http.get<BattlefieldMap>('/battlefield');
    return data;
  } catch {
    return null;
  }
}

/** 战场行军 */
export async function battlefieldMarch(armyId: string, targetNodeId: number): Promise<{ game: GameState; battlefield: BattlefieldMap }> {
  const { data } = await http.post<{ game: GameState; battlefield: BattlefieldMap }>('/battlefield/march', { armyId, targetNodeId });
  return data;
}

/** 退出战场 */
export async function battlefieldExit(): Promise<GameState> {
  const { data } = await http.post<GameState>('/battlefield/exit');
  return data;
}

// ====== 郡域战场实例 API（BF-P2 Q10 Tier II 郡域层） ======

/** 进入郡域战场：服务端生成 BattlefieldInstance 并写入 GameState（郡 id 见 shared 模板目录） */
export async function enterNanjunBattlefield(commandery = 'nanjun'): Promise<GameState> {
  const { data } = await http.post<GameState>('/battlefield-instance/enter', { commandery });
  return data;
}

/** 退出南郡郡域战场：清空 activeBattlefieldInstance */
export async function exitNanjunBattlefield(): Promise<GameState> {
  const { data } = await http.post<GameState>('/battlefield-instance/exit');
  return data;
}

/** BF-P2 Q9：攻打郡域县节点（当阳/华容/枝江） */
export async function engageCounty(countyId: string): Promise<GameState> {
  const { data } = await http.post<GameState>('/battlefield-instance/engage-county', { countyId });
  return data;
}

export async function startBattlefieldDuel(
  kind: 'formation_front' | 'city_front',
  nodeId: string,
  stance: import('@leh/shared').DuelStance,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/battlefield-instance/duel/start', { kind, nodeId, stance });
  return data;
}

export async function stepBattlefieldDuel(): Promise<GameState> {
  const { data } = await http.post<GameState>('/battlefield-instance/duel/step');
  return data;
}

export async function skipBattlefieldDuel(): Promise<GameState> {
  const { data } = await http.post<GameState>('/battlefield-instance/duel/skip');
  return data;
}

export async function closeBattlefieldDuel(): Promise<GameState> {
  const { data } = await http.post<GameState>('/battlefield-instance/duel/close');
  return data;
}

/** 获取当前郡域战场实例（如有） */
export async function getBattlefieldInstance(): Promise<BattlefieldInstance | null> {
  try {
    const { data } = await http.get<BattlefieldInstance>('/battlefield-instance');
    return data;
  } catch {
    return null;
  }
}

// ====== 白刃战 API（Tier II） ======

/** 发起白刃战 */
export async function meleeStart(attackerArmyId: string, defenderArmyId: string): Promise<{ game: GameState; melee: MeleeState }> {
  const { data } = await http.post<{ game: GameState; melee: MeleeState }>('/melee/start', { attackerArmyId, defenderArmyId });
  return data;
}

/** 获取当前白刃战状态 */
export async function getMelee(): Promise<MeleeState | null> {
  try {
    const { data } = await http.get<MeleeState>('/melee');
    return data;
  } catch {
    return null;
  }
}

export async function meleeSelectMode(
  mode: import('@leh/shared').MeleeEntryMode,
): Promise<{ game: GameState; melee: MeleeState; battle?: BattleState }> {
  const { data } = await http.post<{ game: GameState; melee: MeleeState; battle?: BattleState }>('/melee/mode', { mode });
  return data;
}

/** 执行一回合白刃战（FM-P3 动作级幂等：commandId + expectedRound） */
export async function meleeRound(actionType: string, targetFormation?: import('@leh/shared').FormationType, commandId?: string, expectedRound?: number): Promise<{ game: GameState; result: MeleeRoundResult; melee: MeleeState }> {
  const { data } = await http.post<{ game: GameState; result: MeleeRoundResult; melee: MeleeState }>('/melee/round', { actionType, targetFormation, commandId, expectedRound });
  return data;
}

/** 刷新白刃战战术点 */
export async function meleeRefresh(): Promise<MeleeState> {
  const { data } = await http.post<MeleeState>('/melee/refresh');
  return data;
}

/** 退出白刃战 */
export async function meleeExit(): Promise<{ game: GameState }> {
  const { data } = await http.post<{ game: GameState }>('/melee/exit');
  return data;
}

// ====== 总军师 API ======

/** 任命总军师 */
export async function grandStrategistAppoint(officerId: number): Promise<{ game: GameState; strategist: GrandStrategist }> {
  const { data } = await http.post<{ game: GameState; strategist: GrandStrategist }>('/grand-strategist/appoint', { officerId });
  return data;
}

/** 解职总军师 */
export async function grandStrategistDismiss(): Promise<{ game: GameState; log: string }> {
  const { data } = await http.post<{ game: GameState; log: string }>('/grand-strategist/dismiss');
  return data;
}

/** 切换态势 */
export async function grandStrategistSwitch(strategy: StrategyType): Promise<{ game: GameState; log: string }> {
  const { data } = await http.post<{ game: GameState; log: string }>('/grand-strategist/strategy', { strategy });
  return data;
}

/** 获取总军师状态 */
export async function grandStrategistStatus(): Promise<{
  strategist: GrandStrategist | null;
  modifiers: StrategyModifiers;
  hasStrategist: boolean;
}> {
  const { data } = await http.get<{
    strategist: GrandStrategist | null;
    modifiers: StrategyModifiers;
    hasStrategist: boolean;
  }>('/grand-strategist/status');
  return data;
}

/** 开霸府（HC-P0-3）。前置：控制汉献帝 + 当前 politicalStage='vassal'。 */
export async function establishHegemony(): Promise<GameState> {
  const { data } = await http.post<GameState>('/hegemony/establish');
  return data;
}

/** HC-P1-2 引擎/API/store 接入；UI 命令留 HC-P1-5。 */
export async function proclaimKing(kingdomName: string): Promise<GameState> {
  const { data } = await http.post<GameState>('/hegemony/proclaim-king', { kingdomName });
  return data;
}

export interface KingRequirementsDto {
  factionExists: { current: boolean; threshold: boolean; passed: boolean };
  factionAlive: { current: boolean; threshold: boolean; passed: boolean };
  politicalStage: { current: string; threshold: string; passed: boolean };
  cityCount: { current: number; threshold: number; passed: boolean };
  politicalStageAgeMonths: { current: number; threshold: number; passed: boolean };
  imperialAuthority: { current: number; threshold: number; passed: boolean };
  kingdomNameCandidates: Array<{
    name: string;
    source: 'scenario' | 'geography' | 'faction';
    available: boolean;
  }>;
  contestableCityCount: number;
  allPassed: boolean;
}

/** HC-P1-5 朝廷称王进度与有限王号候选。 */
export async function getKingRequirements(): Promise<KingRequirementsDto> {
  const { data } = await http.get<KingRequirementsDto>('/hegemony/king-requirements');
  return data;
}

export async function falseDecreeWar(targetFactionId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/hegemony/false-decree-war', { targetFactionId });
  return data;
}

// ====== 关系网 API（S24） ======

export async function getOfficerRelations(officerId: number): Promise<OfficerRelation[]> {
  const { data } = await http.get<OfficerRelation[]>(`/relations/${officerId}`);
  return data;
}

// ====== 技能树 API（S25） ======

export async function getSkillTrees(): Promise<SkillTreeDef[]> {
  const { data } = await http.get<SkillTreeDef[]>('/skill-trees');
  return data;
}

export interface OfficerSkillState {
  skillTreeState: Record<string, number>;
  skillPointsSpent: number;
  totalSkillPoints: number;
  traitLevels: Record<string, number>;
  traitPointsSpent: number;
  totalTraitPoints: number;
}

export async function getOfficerSkillState(officerId: number): Promise<OfficerSkillState> {
  const { data } = await http.get<OfficerSkillState>(`/officer/${officerId}/skills`);
  return data;
}

export async function upgradeSkillNode(officerId: number, nodeId: string): Promise<OfficerSkillState> {
  const { data } = await http.post<OfficerSkillState>('/skill-tree/upgrade', { officerId, nodeId });
  return data;
}

export async function upgradeTrait(officerId: number, traitId: string): Promise<OfficerSkillState> {
  const { data } = await http.post<OfficerSkillState>('/trait/upgrade', { officerId, traitId });
  return data;
}

export async function resetSkillTree(officerId: number): Promise<OfficerSkillState> {
  const { data } = await http.post<OfficerSkillState>('/skill-tree/reset', { officerId });
  return data;
}

// ====== 天命-人心 API（S26） ======

export interface FactionOverview {
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
}

export async function getFactionOverview(): Promise<FactionOverview> {
  const { data } = await http.get<FactionOverview>('/faction/overview');
  return data;
}
