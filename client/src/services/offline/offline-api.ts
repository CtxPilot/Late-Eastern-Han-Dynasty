// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 离线可玩版（Session 372 Phase 2/3）：离线实现子集。
 *
 * 与 services/api.ts 同名同签名的函数在此改走 game.worker（浏览器内权威引擎）；
 * 存档槽位介质为主线程 IndexedDB（save-idb.ts），信封生成与读档校验链仍在 Worker。
 * 未覆盖的指令由 gateway 回退到在线实现（断网时以既有错误提示呈现）。
 */
import type {
  BattleState,
  DuelStance,
  EventSourceClass,
  FamilyTreatmentMode,
  FormationType,
  GameState,
  SaveEnvelopeV1,
} from '@leh/shared';
import type { RpcRequest, RpcResponse } from '../../workers/protocol';
import { listIdbSaveSlots, readIdbSaveSlot, writeIdbSaveSlot } from '../save-idb';
import type { SaveSlotMeta } from '../api';

let seq = 0;
let worker: Worker | null = null;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function ensureWorker(): Worker {
  if (!worker) {
    const w = new Worker(new URL('../../workers/game.worker.ts', import.meta.url), { type: 'module' });
    w.addEventListener('message', (event: MessageEvent<RpcResponse>) => {
      const message = event.data;
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      if (message.ok) entry.resolve(message.data);
      else entry.reject(new Error(message.error));
    });
    worker = w;
  }
  return worker;
}

function call<T>(method: string, args: unknown[] = []): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    ensureWorker().postMessage({ id, method, args } satisfies RpcRequest);
  });
}

export async function fetchStatic(): ReturnType<typeof import('../api').fetchStatic> {
  return call('listStatic');
}
export function createGame(scenarioId: number, playerFactionId: number, eventLayers: EventSourceClass[]): Promise<GameState> {
  return call('createGame', [scenarioId, playerFactionId, eventLayers]);
}
export function getGameState(): Promise<GameState> {
  return call('getGameState');
}
export async function exportSave(): Promise<SaveEnvelopeV1> {
  return call('exportSave');
}
export function importSave(envelope: unknown): Promise<GameState> {
  return call('importSave', [envelope]);
}
export async function listSaveSlots(): Promise<SaveSlotMeta[]> {
  return listIdbSaveSlots();
}
export async function saveToSlot(slot: string): Promise<SaveSlotMeta> {
  const envelope = await call<SaveEnvelopeV1>('exportSave');
  return writeIdbSaveSlot(slot, envelope);
}
export async function loadFromSlot(slot: string): Promise<GameState> {
  const envelope = await readIdbSaveSlot(slot);
  return call('importSave', [envelope]);
}
export function endTurn(): Promise<GameState> {
  return call('endTurn');
}
export function chooseEvent(eventId: number, choiceIndex: number): Promise<GameState> {
  return call('chooseEvent', [eventId, choiceIndex]);
}
export function getAnnualBudget(): ReturnType<typeof import('../api').getAnnualBudget> {
  return call('getAnnualBudget');
}
export function developFarm(cityId: number): Promise<GameState> {
  return call('developFarm', [cityId]);
}
export function develop(cityId: number, kind: Parameters<typeof import('../api').develop>[1], officerId: number): Promise<GameState> {
  return call('develop', [cityId, kind, officerId]);
}
export function conscript(cityId: number): Promise<GameState> {
  return call('conscript', [cityId]);
}
export function relief(cityId: number): Promise<GameState> {
  return call('relief', [cityId]);
}
export function trainTroops(cityId: number): Promise<GameState> {
  return call('train', [cityId]);
}
export function reclaimLand(cityId: number, officerId: number): Promise<GameState> {
  return call('reclaimLand', [cityId, officerId]);
}
export function setCivilianFarming(cityId: number, households: number): Promise<GameState> {
  return call('setCivilianFarming', [cityId, households]);
}
export function setMilitaryFarming(cityId: number, enabled: boolean): Promise<GameState> {
  return call('setMilitaryFarming', [cityId, enabled]);
}
export function relocateGarrisonFamilies(fromCityId: number, toCityId: number): Promise<GameState> {
  return call('relocateGarrisonFamilies', [fromCityId, toCityId]);
}
export function resolveFamilyTreatment(mode: FamilyTreatmentMode): Promise<GameState> {
  return call('resolveFamilyTreatment', [mode]);
}
export function setNationalPolicy(type: string, targetCityId?: number): Promise<GameState> {
  return call('setNationalPolicy', [type, targetCityId]);
}
export function patrolCity(cityId: number, officerId: number): Promise<GameState> {
  return call('patrolCity', [cityId, officerId]);
}
export function buyArms(amount: number): Promise<GameState> {
  return call('buyArms', [amount]);
}
export function resolveImpeachment(cityId: number, action: 'appease' | 'remove'): Promise<GameState> {
  return call('resolveImpeachment', [cityId, action]);
}
export function seekBeauty(cityId: number): Promise<GameState> {
  return call('seekBeauty', [cityId]);
}
export function rewardBeautyStock(officerId: number, amount?: number): Promise<GameState> {
  return call('rewardBeautyStock', [officerId, amount]);
}
export function marry(femaleId: number, officerId: number): Promise<GameState> {
  return call('marry', [femaleId, officerId]);
}
export function searchTalent(cityId: number): Promise<GameState> {
  return call('searchTalent', [cityId]);
}
export function equipItem(officerId: number, itemId: number): Promise<GameState> {
  return call('equipItem', [officerId, itemId]);
}
export function unequipItem(officerId: number, itemId: number): Promise<GameState> {
  return call('unequipItem', [officerId, itemId]);
}
export function grantTreasure(officerId: number, itemId: number): Promise<GameState> {
  return call('grantTreasure', [officerId, itemId]);
}
export function recruitOfficer(officerId: number, recruiterId?: number): Promise<GameState> {
  return call('recruitOfficer', [officerId, recruiterId]);
}
export function appointOfficer(
  officerId: number,
  track: 'civil' | 'local' | 'military' | 'hegemony',
  position: string,
  cityId?: number,
): Promise<GameState> {
  return call('appoint', [officerId, track, position, cityId]);
}
export function grantNobility(officerId: number, targetRank: string): Promise<GameState> {
  return call('grantNobility', [officerId, targetRank]);
}
export function recruitSpies(cityId: number): Promise<GameState> {
  return call('recruitSpies', [cityId]);
}
export function plantFemale(targetFactionId: number): Promise<GameState> {
  return call('plantFemale', [targetFactionId]);
}
export function trainFemaleSpy(cityId: number): Promise<GameState> {
  return call('trainFemaleSpy', [cityId]);
}
export function spyMission(agentId: string, type: string, targetCityId: number, targetOfficerId?: number): Promise<GameState> {
  return call('spyMission', [agentId, type, targetCityId, targetOfficerId]);
}
export function stationCounter(agentId: string, cityId: number): Promise<GameState> {
  return call('stationCounter', [agentId, cityId]);
}
export function unstationCounter(cityId: number): Promise<GameState> {
  return call('unstationCounter', [cityId]);
}
export function resolveCaptive(agentId: string, action: string): Promise<GameState> {
  return call('captive', [agentId, action]);
}
export function launchPlot(
  type: string,
  opts: {
    targetFactionId?: number;
    targetCityId?: number;
    feintCityId?: number;
    secondaryFactionId?: number;
    targetOfficerId?: number;
    agentId?: string;
  } = {},
): Promise<GameState> {
  return call('launchPlot', [type, opts]);
}
export function cancelPlot(plotId: string): Promise<GameState> {
  return call('cancelPlot', [plotId]);
}
export function joinFaction(officerId: number, factionId: number, cityId?: number): Promise<GameState> {
  return call('joinFaction', [officerId, factionId, cityId]);
}
export function releaseOfficer(officerId: number): Promise<GameState> {
  return call('releaseOfficer', [officerId]);
}
export function followCheck(): Promise<GameState> {
  return call('followCheck');
}
export function transferCourtNetwork(targetFactionId: number, amount?: number): Promise<GameState> {
  return call('transferCourtNetwork', [targetFactionId, amount]);
}
export function tribute(targetFactionId: number): Promise<GameState> {
  return call('tribute', [targetFactionId]);
}
export function formAlliance(targetFactionId: number): Promise<GameState> {
  return call('alliance', [targetFactionId]);
}
export function establishHegemony(): Promise<GameState> {
  return call('establishHegemony');
}
export function proclaimKing(kingdomName: string): Promise<GameState> {
  return call('proclaimKing', [kingdomName]);
}
export function falseDecreeWar(targetFactionId: number): Promise<GameState> {
  return call('falseDecreeWar', [targetFactionId]);
}
export function startBattle(cityId: number, fromCityId?: number): Promise<BattleState> {
  return call('startBattle', [cityId, fromCityId]);
}
export function march(targetCityId: number, fromCityId?: number, troopCount?: number): Promise<{ game: GameState; battle: BattleState }> {
  return call('march', [targetCityId, fromCityId, troopCount]);
}
export async function suggestFromCity(targetCityId: number): Promise<number | null> {
  return call('suggestFromCity', [targetCityId]);
}
export function battleMove(unitId: string, q: number, r: number): Promise<BattleState> {
  return call('move', [unitId, q, r]);
}
export function battleUndo(): Promise<BattleState> {
  return call('undo');
}
export function battleAttack(attackerId: string, defenderId: string): Promise<BattleState> {
  return call('attack', [attackerId, defenderId]);
}
export function battleFire(attackerId: string, targetId: string): Promise<BattleState> {
  return call('fire', [attackerId, targetId]);
}
export function battleWeather(attackerId: string, weather: string): Promise<BattleState> {
  return call('weather', [attackerId, weather]);
}
export function battleUsableAbilities(unitId: string): Promise<import('../api').UsableAbility[]> {
  return call('usableAbilities', [unitId]);
}
export function battleAbility(attackerId: string, targetId: string, abilityId: string): Promise<BattleState> {
  return call('ability', [attackerId, targetId, abilityId]);
}
export function battleFinishPlayer(): Promise<BattleState> {
  return call('finishPlayer');
}
export function battleRetreat(): Promise<BattleState> {
  return call('retreat');
}
export function battleChangeFormation(unitId: string, targetFormation: FormationType): Promise<BattleState> {
  return call('formation', [unitId, targetFormation]);
}
export async function getActiveBattle(): Promise<BattleState | null> {
  try {
    return await call<BattleState | null>('getBattle');
  } catch {
    return null;
  }
}
export function battleDuelChallenge(challengerUnitId: string, targetUnitId: string, stance: DuelStance): Promise<BattleState> {
  return call('duelChallenge', [challengerUnitId, targetUnitId, stance]);
}
export function battleDuelStep(): Promise<BattleState> {
  return call('duelStep');
}
export function battleDuelSkip(): Promise<BattleState> {
  return call('duelSkip');
}
export function battleEnemyPhase(): Promise<BattleState> {
  return call('enemyPhase');
}
export function battleMoveRange(unitId: string): Promise<string[]> {
  return call('moveRange', [unitId]);
}
export function battleMovePath(unitId: string, q: number, r: number): ReturnType<typeof import('../api').battleMovePath> {
  return call('movePath', [unitId, q, r]);
}
export function exitBattle(): Promise<GameState> {
  return call('exitBattle');
}
export function campaignStart(body: Parameters<typeof import('../api').campaignStart>[0]): ReturnType<typeof import('../api').campaignStart> {
  return call('campaignStart', [body]);
}
export function campaignMarch(armyId: string, targetNodeId: number): Promise<GameState> {
  return call('campaignMarch', [armyId, targetNodeId]);
}
export function campaignBuild(armyId: string, structureType: string): Promise<GameState> {
  return call('campaignBuild', [armyId, structureType]);
}
export function campaignAssault(armyId: string): ReturnType<typeof import('../api').campaignAssault> {
  return call('campaignAssault', [armyId]);
}
export function campaignSiegeSurrender(armyId: string): ReturnType<typeof import('../api').campaignSiegeSurrender> {
  return call('campaignSiegeSurrender', [armyId]);
}
export function campaignRetreat(armyId: string): Promise<GameState> {
  return call('campaignRetreat', [armyId]);
}
export function campaignAdvisorAction(armyId: string, action: 'inspire' | 'trap' | 'retreat' | 'scout'): Promise<GameState> {
  return call('campaignAdvisor', [armyId, action]);
}
