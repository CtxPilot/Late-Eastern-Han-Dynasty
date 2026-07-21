// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import axios, { isAxiosError } from 'axios';
import type { AutoBattleResult, BattleState, BattlefieldMap, CampaignArmy, CampaignNode, EventSourceClass, GameState, MeleeRoundResult, MeleeState, ScenarioFactionSetup } from '@leh/shared';

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
}> {
  const { data } = await http.get<{
    children?: ChildCatalogEntry[];
    events?: EventCatalogEntry[];
    scenarios?: ScenarioCatalogEntry[];
  }>('/static');
  return { children: data.children ?? [], events: data.events ?? [], scenarios: data.scenarios ?? [] };
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

export async function developFarm(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/develop-farm', { cityId });
  return data;
}

export async function develop(cityId: number, kind: DevelopKind): Promise<GameState> {
  const { data } = await http.post<GameState>('/civil/develop', { cityId, kind });
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

/** 寻访：势力 beautyStock+1，城可寻次数−1 */
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

export async function giftBeauty(
  femaleId: number,
  officerId: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/gift-beauty', {
    femaleId,
    officerId,
  });
  return data;
}

export async function searchTalent(cityId: number): Promise<GameState> {
  const { data } = await http.post<GameState>('/personnel/search', { cityId });
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

/** S11/S12 任命三轨 */
export async function appointOfficer(
  officerId: number,
  track: 'civil' | 'local' | 'military',
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

export async function giftBeautyDip(
  targetFactionId: number,
  amount?: number,
): Promise<GameState> {
  const { data } = await http.post<GameState>('/diplomacy/gift-beauty', {
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

/** S10 §8 玩家发起单挑 */
export async function battleDuelChallenge(challengerUnitId: string, targetUnitId: string): Promise<BattleState> {
  const { data } = await http.post<BattleState>('/battle/duel/challenge', { challengerUnitId, targetUnitId });
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

/** 执行一回合白刃战 */
export async function meleeRound(actionType: string): Promise<{ game: GameState; result: MeleeRoundResult; melee: MeleeState }> {
  const { data } = await http.post<{ game: GameState; result: MeleeRoundResult; melee: MeleeState }>('/melee/round', { actionType });
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
export async function grandStrategistAppoint(officerId: number): Promise<{ game: GameState; strategist: import('@leh/shared').GrandStrategist }> {
  const { data } = await http.post('/grand-strategist/appoint', { officerId });
  return data as any;
}

/** 解职总军师 */
export async function grandStrategistDismiss(): Promise<{ game: GameState; log: string }> {
  const { data } = await http.post('/grand-strategist/dismiss');
  return data as any;
}

/** 切换态势 */
export async function grandStrategistSwitch(strategy: string): Promise<{ game: GameState; log: string }> {
  const { data } = await http.post('/grand-strategist/strategy', { strategy });
  return data as any;
}

/** 获取总军师状态 */
export async function grandStrategistStatus(): Promise<{
  strategist: import('@leh/shared').GrandStrategist | null;
  modifiers: any;
  hasStrategist: boolean;
}> {
  const { data } = await http.get('/grand-strategist/status');
  return data as any;
}
