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
  BattlefieldMap,
  DuelStance,
  EventSourceClass,
  FamilyTreatmentMode,
  FormationType,
  GameState,
  MeleeEntryMode,
  MeleeRoundResult,
  MeleeState,
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

export function getKingRequirements(): ReturnType<typeof import('../api').getKingRequirements> {
  return call('kingRequirements');
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

// ====== 战场地图（Tier I，Session 374 离线覆盖） ======

export function battlefieldInit(targetCityId: number, fromCityId: number): Promise<BattlefieldMap> {
  return call('battlefieldInit', [targetCityId, fromCityId]);
}

export async function getBattlefield(): Promise<BattlefieldMap | null> {
  try {
    return await call<BattlefieldMap | null>('getBattlefield');
  } catch {
    return null;
  }
}

export function battlefieldMarch(armyId: string, targetNodeId: number): Promise<{ game: GameState; battlefield: BattlefieldMap }> {
  return call('battlefieldMarch', [armyId, targetNodeId]);
}

export function battlefieldExit(): Promise<GameState> {
  return call('battlefieldExit');
}

// ====== 白刃战（Tier II，Session 374 离线覆盖） ======

export function meleeStart(attackerArmyId: string, defenderArmyId: string): Promise<{ game: GameState; melee: MeleeState }> {
  return call('meleeStart', [attackerArmyId, defenderArmyId]);
}

export async function getMelee(): Promise<MeleeState | null> {
  try {
    return await call<MeleeState | null>('getMelee');
  } catch {
    return null;
  }
}

export function meleeSelectMode(mode: MeleeEntryMode): Promise<{ game: GameState; melee: MeleeState; battle?: BattleState }> {
  return call('meleeSelectMode', [mode]);
}

export function meleeRound(actionType: string, targetFormation?: FormationType, commandId?: string, expectedRound?: number): Promise<{ game: GameState; result: MeleeRoundResult; melee: MeleeState }> {
  return call('meleeRound', [actionType, targetFormation, commandId, expectedRound]);
}

export function meleeRefresh(): Promise<MeleeState> {
  return call('meleeRefresh');
}

export function meleeExit(): Promise<{ game: GameState }> {
  return call('meleeExit');
}

export function meleeSetTactic(tactic: import('@leh/shared').TacticalTacticId | null): Promise<{ game: GameState; melee: MeleeState }> {
  return call('meleeSetTactic', [tactic]);
}

// ====== 战役节点 / 郡域实例只读 / 总军师 / 关系网 / 技能树 / 势力总览（Session 375 离线覆盖） ======

export function campaignNodes(): ReturnType<typeof import('../api').campaignNodes> {
  return call('campaignNodes');
}

export async function getBattlefieldInstance(): Promise<import('@leh/shared').BattlefieldInstance | null> {
  try {
    return await call<import('@leh/shared').BattlefieldInstance | null>('getBattlefieldInstance');
  } catch {
    return null;
  }
}

export function grandStrategistAppoint(officerId: number): Promise<{ game: GameState; strategist: import('@leh/shared').GrandStrategist }> {
  return call('grandStrategistAppoint', [officerId]);
}

export function grandStrategistDismiss(): Promise<{ game: GameState; log: string }> {
  return call('grandStrategistDismiss');
}

export function grandStrategistSwitch(strategy: string): Promise<{ game: GameState; log: string }> {
  return call('grandStrategistSwitch', [strategy]);
}

export function grandStrategistStatus(): ReturnType<typeof import('../api').grandStrategistStatus> {
  return call('grandStrategistStatus');
}

export function getOfficerRelations(officerId: number): ReturnType<typeof import('../api').getOfficerRelations> {
  return call('getOfficerRelations', [officerId]);
}

export function getSkillTrees(): ReturnType<typeof import('../api').getSkillTrees> {
  return call('getSkillTrees');
}

export function getOfficerSkillState(officerId: number): ReturnType<typeof import('../api').getOfficerSkillState> {
  return call('getOfficerSkillState', [officerId]);
}

export function upgradeSkillNode(officerId: number, nodeId: string): ReturnType<typeof import('../api').upgradeSkillNode> {
  return call('upgradeSkillNode', [officerId, nodeId]);
}

export function upgradeTrait(officerId: number, traitId: string): ReturnType<typeof import('../api').upgradeTrait> {
  return call('upgradeTrait', [officerId, traitId]);
}

export function resetSkillTree(officerId: number): ReturnType<typeof import('../api').resetSkillTree> {
  return call('resetSkillTree', [officerId]);
}

export function getFactionOverview(): ReturnType<typeof import('../api').getFactionOverview> {
  return call('getFactionOverview');
}

/** 与 seekBeauty 同一权威引擎（api.ts 的 searchBeauty 即 seekBeauty 别名）。 */
export function searchBeauty(cityId: number): Promise<GameState> {
  return call('seekBeauty', [cityId]);
}
