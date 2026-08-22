// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { create } from 'zustand';
import type { AutoBattleResult, BattleState, BattlefieldMap, CampaignArmy, EventSourceClass, FamilyTreatmentMode, GameState, ItemStatic, MeleeRoundResult, MeleeState, PathResult } from '@leh/shared';
import { type SceneFrame, type BattlefieldInstance, pushScene, popScene, popToScene, replaceStack, screenOf, clearStack, BOOT_SCREEN, getCommanderyLabel } from '@leh/shared';
import { gameApi as api } from '../services/gateway';
import { errMsg, type CampaignStartBody, type ChildCatalogEntry, type EventCatalogEntry, type ScenarioCatalogEntry, type UsableAbility } from '../services/api';

type Screen = 'boot' | 'scenario' | 'world' | 'battle' | 'battlefield' | 'melee' | 'tactical' | 'duel';

interface Store {
  screen: Screen;
  sceneStack: SceneFrame[];
  pushSceneFrame: (frame: SceneFrame) => void;
  popSceneFrame: () => void;
  popToSceneFrame: (scene: SceneFrame['scene']) => void;
  replaceSceneStack: (frame: SceneFrame) => void;
  clearSceneStack: () => void;

  battlefieldInstance: BattlefieldInstance | null;
  enterNanjunBattlefield: (commandery?: string) => Promise<void>;
  exitNanjunBattlefield: () => Promise<void>;
  engageJiangling: () => Promise<void>;
  engageCounty: (countyId: string) => Promise<void>;
  startBattlefieldDuel: (kind: 'formation_front' | 'city_front', nodeId: string, stance: import('@leh/shared').DuelStance) => Promise<void>;
  stepBattlefieldDuel: () => Promise<void>;
  skipBattlefieldDuel: () => Promise<void>;
  closeBattlefieldDuel: () => Promise<void>;
  game: GameState | null;
  battle: BattleState | null;
  selectedCityId: number | null;
  /** MapCanvas consumes then clears — left panel request zoom-to-city */
  mapFocusCityId: number | null;
  selectedUnitId: string | null;
  moveRange: string[];
  movePath: PathResult | null;
  error: string | null;
  clearError: () => void;
  loading: boolean;
  /** short UI feedback for last successful action */
  lastActionOk: string | null;
  /** 子女史实表（家族面板） */
  childrenCatalog: ChildCatalogEntry[];
  /** 事件目录（对话/选项标签，无 effects） */
  eventsCatalog: EventCatalogEntry[];
  scenariosCatalog: ScenarioCatalogEntry[];
  /** S13 宝物静态目录（Session 266，装备展示用）。 */
  itemsCatalog: ItemStatic[];
  /** S10 当前选中单位可用战法 */
  usableAbilities: UsableAbility[];

  boot: () => Promise<void>;
  importSave: (envelope: unknown) => Promise<void>;
  saveToSlot: (slot: string) => Promise<void>;
  loadFromSlot: (slot: string) => Promise<void>;
  startGame: (scenarioId: number, factionId: number, eventLayers: EventSourceClass[]) => Promise<void>;
  openScenarioSelect: () => void;
  selectCity: (id: number | null) => void;
  focusMapOnCity: (id: number) => void;
  clearMapFocus: () => void;
  endTurn: () => Promise<void>;
  chooseEvent: (eventId: number, choiceIndex: number) => Promise<void>;
  developFarm: () => Promise<void>;
  develop: (kind: import('@leh/shared').DevelopmentProjectKind, cityId?: number, officerId?: number) => Promise<void>;
  conscript: (cityId?: number) => Promise<void>;
  relief: (cityId?: number) => Promise<void>;
  trainTroops: (cityId?: number) => Promise<void>;
  reclaimLand: (cityId?: number, officerId?: number) => Promise<void>;
  patrolCity: (cityId?: number, officerId?: number) => Promise<void>;
  buyArms: (amount?: number) => Promise<void>;
  resolveImpeachment: (cityId?: number, action?: 'appease' | 'remove') => Promise<void>;
  seekBeauty: (cityId?: number) => Promise<void>;
  /** @deprecated use seekBeauty */
  searchBeauty: () => Promise<void>;
  rewardBeautyStock: (officerId: number, amount?: number) => Promise<void>;
  marry: (femaleId: number, officerId: number) => Promise<void>;
  searchTalent: (cityId: number) => Promise<void>;
  recruitOfficer: (officerId: number, recruiterId?: number) => Promise<void>;
  equipItem: (officerId: number, itemId: number) => Promise<void>;
  unequipItem: (officerId: number, itemId: number) => Promise<void>;
  grantTreasure: (officerId: number, itemId: number) => Promise<void>;
  appointOfficer: (
    officerId: number,
    track: 'civil' | 'local' | 'military' | 'hegemony',
    position: string,
    cityId?: number,
  ) => Promise<void>;
  grantNobility: (officerId: number, targetRank: string) => Promise<void>;
  recruitSpies: (cityId: number) => Promise<void>;
  trainFemaleSpy: (cityId: number) => Promise<void>;
  spyMission: (
    agentId: string,
    type: string,
    targetCityId: number,
    targetOfficerId?: number,
  ) => Promise<void>;
  stationCounter: (agentId: string, cityId: number) => Promise<void>;
  unstationCounter: (cityId: number) => Promise<void>;
  resolveCaptive: (agentId: string, action: string) => Promise<void>;
  launchPlot: (
    type: string,
    opts: {
      targetFactionId?: number;
      targetCityId?: number;
      feintCityId?: number;
      secondaryFactionId?: number;
      targetOfficerId?: number;
      agentId?: string;
    },
  ) => Promise<void>;
  cancelPlot: (plotId: string) => Promise<void>;
  setCivilianFarming: (cityId: number, households: number) => Promise<void>;
  setMilitaryFarming: (cityId: number, enabled: boolean) => Promise<void>;
  relocateGarrisonFamilies: (fromCityId: number, toCityId: number) => Promise<void>;
  resolveFamilyTreatment: (mode: FamilyTreatmentMode) => Promise<void>;
  setNationalPolicy: (type: string, targetCityId?: number) => Promise<void>;
  followCheck: () => Promise<void>;
  tribute: (targetFactionId: number) => Promise<void>;
  establishHegemony: () => Promise<void>;
  proclaimKing: (kingdomName: string) => Promise<void>;
  falseDecreeWar: (targetFactionId: number) => Promise<void>;
  transferCourtNetwork: (targetFactionId: number, amount?: number) => Promise<void>;
  plantFemale: (targetFactionId: number) => Promise<void>;
  formAlliance: (targetFactionId: number) => Promise<void>;
  startBattle: () => Promise<void>;
  /** 出征攻城：fromCityId 省略则服务端选道路邻接己方城 */
  marchOnCity: (fromCityId?: number, troopCount?: number) => Promise<void>;
  selectUnit: (id: string | null) => Promise<void>;
  moveTo: (q: number, r: number) => Promise<void>;
  previewMoveTo: (q: number, r: number) => Promise<void>;
  undoBattleAction: () => Promise<void>;
  attack: (defenderId: string) => Promise<void>;
  castFire: (targetId: string) => Promise<void>;
  castWeather: (weather: string) => Promise<void>;
  castAbility: (targetId: string, abilityId: string) => Promise<void>;
  loadAbilities: (unitId: string) => Promise<void>;
  finishPlayer: () => Promise<void>;
  retreatBattle: () => Promise<void>;
  changeBattleFormation: (targetFormation: import('@leh/shared').FormationType) => Promise<void>;
  runEnemy: () => Promise<void>;
  exitBattle: () => Promise<void>;
  duelChallenge: (challengerUnitId: string, targetUnitId: string, stance: import('@leh/shared').DuelStance) => Promise<void>;
  duelStep: () => Promise<void>;
  duelSkip: () => Promise<void>;

  // 战役层
  /** 最近一次自动战斗结果（强攻/劝降） */
  lastBattleResult: AutoBattleResult | null;
  campaignStart: (body: CampaignStartBody) => Promise<CampaignArmy | null>;
  campaignMarch: (armyId: string, targetNodeId: number) => Promise<void>;
  campaignBuild: (armyId: string, structureType: string) => Promise<void>;
  campaignAssault: (armyId: string) => Promise<void>;
  campaignSiegeSurrender: (armyId: string) => Promise<void>;
  campaignRetreat: (armyId: string) => Promise<void>;
  campaignAdvisorAction: (armyId: string, action: 'inspire' | 'trap' | 'retreat' | 'scout') => Promise<void>;

  // 战场地图（Tier I）
  battlefield: BattlefieldMap | null;
  /** 初始化战场地图 */
  battlefieldInit: (targetCityId: number, fromCityId: number) => Promise<void>;
  /** 战场行军 */
  battlefieldMarch: (armyId: string, targetNodeId: number) => Promise<void>;
  /** 退出战场 */
  battlefieldExit: () => Promise<void>;

  // 白刃战（Tier II）
  melee: MeleeState | null;
  meleeLastResult: MeleeRoundResult | null;
  /** 发起白刃战 */
  meleeStart: (attackerArmyId: string, defenderArmyId: string) => Promise<void>;
  meleeSelectMode: (mode: import('@leh/shared').MeleeEntryMode) => Promise<void>;
  /** 执行白刃战回合（FM-P3 动作级幂等：自动生成 commandId + 当前回合作为 expectedRound） */
  meleeRound: (actionType: string, targetFormation?: import('@leh/shared').FormationType) => Promise<void>;
  /** 刷新战术点 */
  meleeRefresh: () => Promise<void>;
  /** 退出白刃战 */
  meleeExit: () => Promise<void>;
  /** 设定攻方玩家持久战术姿态（FM-P3：assault/hold/ambush 或 null 清除，不耗 TP） */
  meleeSetTactic: (tactic: import('@leh/shared').TacticalTacticId | null) => Promise<void>;

  // 总军师系统
  grandStrategist: import('@leh/shared').GrandStrategist | null;
  grandStrategistModifiers: import('@leh/shared').StrategyModifiers | null;
  grandStrategistLoading: boolean;
  grandStrategistAppoint: (officerId: number) => Promise<void>;
  grandStrategistDismiss: () => Promise<void>;
  grandStrategistSwitch: (strategy: import('@leh/shared').StrategyType) => Promise<void>;
  grandStrategistRefresh: () => Promise<void>;
}

/** meleeRound 幂等 commandId 的回退单调计数（crypto.randomUUID 不可用时）。 */
let commandIdSeq = 0;

export const useGameStore = create<Store>((set, get) => ({
  screen: 'boot',
  sceneStack: [],
  battlefieldInstance: null,
  game: null,
  battle: null,
  selectedCityId: null,
  mapFocusCityId: null,
  selectedUnitId: null,
  moveRange: [],
  movePath: null,
  error: null,
  loading: false,
  lastActionOk: null,
  childrenCatalog: [],
  eventsCatalog: [],
  scenariosCatalog: [],
  itemsCatalog: [],
  usableAbilities: [],
  battlefield: null,
  melee: null,
  meleeLastResult: null,
  grandStrategist: null,
  grandStrategistModifiers: null,
  grandStrategistLoading: false,
  clearError: () => set({ error: null }),

  importSave: async (envelope) => {
    set({ loading: true, error: null, lastActionOk: null });
    try {
      const game = await api.importSave(envelope);
      set({ game, battle: game.activeBattles[0] ?? null, loading: false, lastActionOk: '存档已恢复' });
    } catch (e) {
      set({ error: errMsg(e, '导入存档失败'), loading: false });
    }
  },

  pushSceneFrame: (frame) => set((s) => { const stack = pushScene(s.sceneStack, frame); return { sceneStack: stack, screen: screenOf(stack) }; }),
  popSceneFrame: () => set((s) => { const stack = popScene(s.sceneStack); return { sceneStack: stack, screen: screenOf(stack) }; }),
  popToSceneFrame: (scene) => set((s) => { const stack = popToScene(s.sceneStack, scene); return { sceneStack: stack, screen: screenOf(stack) }; }),
  replaceSceneStack: (frame) => set({ sceneStack: replaceStack(frame), screen: screenOf([frame]) }),
  clearSceneStack: () => set({ sceneStack: clearStack(), screen: BOOT_SCREEN }),

  enterNanjunBattlefield: async (commandery = 'nanjun') => {
    set({ loading: true, error: null, lastActionOk: null });
    try {
      const game = await api.enterNanjunBattlefield(commandery);
      const inst = game.activeBattlefieldInstance ?? null;
      if (!inst) {
        throw new Error('服务端未返回郡域战场实例');
      }
      const after = pushScene(get().sceneStack, { scene: 'battlefield', battlefieldId: inst.id });
      const label = getCommanderyLabel(commandery) ?? commandery;
      set({
        game,
        battlefieldInstance: inst,
        sceneStack: after,
        screen: screenOf(after),
        loading: false,
        lastActionOk: `进入${label}战场`,
      });
    } catch (e) {
      set({ error: errMsg(e, `进入${getCommanderyLabel(commandery) ?? commandery}战场失败`), loading: false });
    }
  },

  exitNanjunBattlefield: async () => {
    set({ loading: true, error: null });
    try {
      const game = await api.exitNanjunBattlefield();
      // 战场是从大地图进入的根级场景；退出必须丢弃所有历史瞬态帧。
      // 只 popToScene 在重复进入/读档后可能保留旧 battlefield 残帧，导致再次退出回环。
      const worldStack = replaceStack({ scene: 'world' });
      set({
        game,
        battlefieldInstance: null,
        battlefield: null,
        battle: null,
        melee: null,
        sceneStack: worldStack,
        screen: 'world',
        loading: false,
        lastActionOk: '退出南郡战场',
      });
    } catch (e) {
      set({ error: errMsg(e, '退出南郡战场失败'), loading: false });
    }
  },

  // engageJiangling（P1 既有 hack）：借用 marchOnCity 路径打 cityId=14（江陵 worldCityId），
  // 不重写战斗逻辑，沿用既有 createBattle + runtimeRandom。Q9 县级攻打扩展时
  // 会新增 engageCounty(countyId) 走同一 createBattle 路径，仍沿用 runtimeRandom，
  // 为 BF-P3 预留 RNG 注入接口（不引入 Math.random）。
  engageJiangling: async () => {
    await get().selectCity(14);
    await get().marchOnCity(undefined, 5000);
  },

  // engageCounty（BF-P2 Q9）：攻打郡域县节点（当阳/华容/枝江）。
  // 调服务端 engageCounty orchestrator（runAutoBattle 自动结算 + 更新 nodeStates/CampaignArmy）。
  engageCounty: async (countyId) => {
    set({ loading: true, error: null, lastActionOk: null });
    try {
      const game = await api.engageCounty(countyId);
      const inst = game.activeBattlefieldInstance ?? null;
      set({
        game,
        battlefieldInstance: inst,
        loading: false,
        lastActionOk: game.actionLog[0]?.message ?? '攻打县节点',
      });
    } catch (e) {
      set({ error: errMsg(e, '攻打县失败'), loading: false });
    }
  },

  startBattlefieldDuel: async (kind, nodeId, stance) => {
    set({ loading: true, error: null });
    try {
      const game = await api.startBattlefieldDuel(kind, nodeId, stance);
      set({ game, battlefieldInstance: game.activeBattlefieldInstance ?? null, loading: false });
    } catch (e) {
      set({ error: errMsg(e, '发起阵前单挑失败'), loading: false });
    }
  },

  stepBattlefieldDuel: async () => {
    try {
      const game = await api.stepBattlefieldDuel();
      set({ game, battlefieldInstance: game.activeBattlefieldInstance ?? null });
    } catch (e) {
      set({ error: errMsg(e, '阵前单挑推进失败') });
    }
  },

  skipBattlefieldDuel: async () => {
    try {
      const game = await api.skipBattlefieldDuel();
      set({ game, battlefieldInstance: game.activeBattlefieldInstance ?? null });
    } catch (e) {
      set({ error: errMsg(e, '阵前单挑跳过失败') });
    }
  },

  closeBattlefieldDuel: async () => {
    try {
      const game = await api.closeBattlefieldDuel();
      set({ game, battlefieldInstance: game.activeBattlefieldInstance ?? null });
    } catch (e) {
      set({ error: errMsg(e, '关闭阵前单挑失败') });
    }
  },

  boot: async () => {
    set({ loading: true, error: null, lastActionOk: null });
    try {
      const st = await api.fetchStatic();
      // 先尝试恢复已有游戏；无进行中游戏时进入剧本选择，不再静默创建固定剧本。
      let game: GameState | null = null;
      try {
        game = await api.getGameState();
      } catch {
        game = null;
      }
      const activeBattle = game ? await api.getActiveBattle() : null;
      const activeMelee = game && !activeBattle ? await api.getMelee() : null;
      const activeBattlefield = game && !activeBattle ? await api.getBattlefield() : null;
      const activeBattlefieldInstance = game && !activeBattle && !activeBattlefield ? await api.getBattlefieldInstance() : null;
      const restoredStack = activeBattle
        ? [{ scene: 'world' as const }, { scene: 'battle' as const, battleId: activeBattle.id }]
        : activeMelee
          ? [
              { scene: 'world' as const },
              { scene: 'battlefield' as const, battlefieldId: activeMelee.battlefieldId },
              { scene: 'melee' as const, encounterId: `${activeMelee.attackerArmyId}:${activeMelee.defenderArmyId}` },
            ]
          : activeBattlefield
            ? [{ scene: 'world' as const }, { scene: 'battlefield' as const, battlefieldId: activeBattlefield.id }]
            : activeBattlefieldInstance
              ? [{ scene: 'world' as const }, { scene: 'battlefield' as const, battlefieldId: activeBattlefieldInstance.id }]
              : game ? replaceStack({ scene: 'world' }) : [];
      set({
        game,
        battle: activeBattle,
        battlefield: activeBattlefield,
        melee: activeMelee,
        battlefieldInstance: activeBattlefieldInstance,
        sceneStack: restoredStack,
        childrenCatalog: st.children,
        eventsCatalog: st.events,
        scenariosCatalog: st.scenarios,
        itemsCatalog: st.items,
        screen: activeBattle ? 'battle' : activeMelee ? 'melee' : activeBattlefield ? 'battlefield' : activeBattlefieldInstance ? 'battlefield' : game ? 'world' : 'scenario',
        loading: false,
      });
    } catch (e) {
      set({ error: errMsg(e, '启动失败'), loading: false });
    }
  },

  startGame: async (scenarioId, factionId, eventLayers) => {
    set({ loading: true, error: null, lastActionOk: null });
    try {
      const game = await api.createGame(scenarioId, factionId, eventLayers);
      set({ game, sceneStack: replaceStack({ scene: 'world' }), screen: 'world', loading: false, selectedCityId: game.factions[factionId]?.capitalCityId ?? null });
    } catch (e) {
      set({ error: errMsg(e, '创建剧本失败'), loading: false });
    }
  },

  openScenarioSelect: () => set({ sceneStack: replaceStack({ scene: 'scenario' }), screen: 'scenario', error: null }),

  saveToSlot: async (slot) => {
    set({ loading: true, error: null, lastActionOk: null });
    try {
      await api.saveToSlot(slot);
      set({ loading: false, lastActionOk: `已保存至槽位「${slot}」` });
    } catch (e) {
      set({ error: errMsg(e, '保存槽位失败'), loading: false });
      throw e;
    }
  },

  loadFromSlot: async (slot) => {
    set({ loading: true, error: null, lastActionOk: null });
    try {
      const game = await api.loadFromSlot(slot);
      const activeBattle = await api.getActiveBattle();
      const activeMelee = !activeBattle ? await api.getMelee() : null;
      const activeBattlefield = !activeBattle && !activeMelee ? await api.getBattlefield() : null;
      const activeBattlefieldInstance = !activeBattle && !activeMelee && !activeBattlefield
        ? await api.getBattlefieldInstance()
        : null;
      const sceneStack = activeBattle
        ? [{ scene: 'world' as const }, { scene: 'battle' as const, battleId: activeBattle.id }]
        : activeMelee
          ? [{ scene: 'world' as const }, { scene: 'battlefield' as const, battlefieldId: activeMelee.battlefieldId }, { scene: 'melee' as const, encounterId: `${activeMelee.attackerArmyId}:${activeMelee.defenderArmyId}` }]
          : activeBattlefield
            ? [{ scene: 'world' as const }, { scene: 'battlefield' as const, battlefieldId: activeBattlefield.id }]
            : activeBattlefieldInstance
              ? [{ scene: 'world' as const }, { scene: 'battlefield' as const, battlefieldId: activeBattlefieldInstance.id }]
              : replaceStack({ scene: 'world' });
      set({ game, battle: activeBattle, melee: activeMelee, battlefield: activeBattlefield, battlefieldInstance: activeBattlefieldInstance, sceneStack, screen: screenOf(sceneStack), loading: false, lastActionOk: `已读取槽位「${slot}」` });
    } catch (e) {
      set({ error: errMsg(e, '读取槽位失败'), loading: false });
      throw e;
    }
  },

  selectCity: (id) => set({ selectedCityId: id, lastActionOk: null, error: null }),

  focusMapOnCity: (id) => set({ selectedCityId: id, mapFocusCityId: id, lastActionOk: null }),

  clearMapFocus: () => set({ mapFocusCityId: null }),

  endTurn: async () => {
    const pending = get().game?.pendingEvents ?? [];
    if (pending.length > 0) {
      set({ error: '请先处理待决事件' });
      return;
    }
    if (get().game?.pendingFamilyTreatment) {
      set({ error: '请先处理家属处置' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const game = await api.endTurn();
      const msg = game.actionLog[0]?.message ?? '回合结束';
      set({ game, loading: false, lastActionOk: msg });
    } catch (e) {
      set({ error: errMsg(e, '结束回合失败'), loading: false });
    }
  },

  chooseEvent: async (eventId, choiceIndex) => {
    set({ loading: true, error: null });
    try {
      const game = await api.chooseEvent(eventId, choiceIndex);
      set({
        game,
        loading: false,
        lastActionOk: game.actionLog[0]?.message ?? '事件抉择完成',
      });
    } catch (e) {
      set({ error: errMsg(e, '事件抉择失败'), loading: false });
    }
  },

  developFarm: async () => {
    await get().develop('farm');
  },

  develop: async (kind, cityId, officerId) => {
    const id = cityId ?? get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const selectedOfficerId = officerId ?? get().game?.cities[id]?.officers[0];
      if (selectedOfficerId == null) throw new Error('本城没有可指派武将');
      const game = await api.develop(id, kind, selectedOfficerId);
      const logMsg = game.actionLog[0]?.message ?? '开发完成';
      set({ game, loading: false, lastActionOk: logMsg });
    } catch (e) {
      set({ error: errMsg(e, '开发失败'), loading: false });
    }
  },

  conscript: async (cityId) => {
    const id = cityId ?? get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const game = await api.conscript(id);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '征兵完成' });
    } catch (e) {
      set({ error: errMsg(e, '征兵失败'), loading: false });
    }
  },

  relief: async (cityId) => {
    const id = cityId ?? get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const game = await api.relief(id);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '施米完成' });
    } catch (e) {
      set({ error: errMsg(e, '施米失败'), loading: false });
    }
  },

  trainTroops: async (cityId) => {
    const id = cityId ?? get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const game = await api.trainTroops(id);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '训练完成' });
    } catch (e) {
      set({ error: errMsg(e, '训练失败'), loading: false });
    }
  },

  reclaimLand: async (cityId, officerId) => {
    const id = cityId ?? get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const selectedOfficerId = officerId ?? get().game?.cities[id]?.officers[0];
      if (selectedOfficerId == null) throw new Error('本城没有可指派武将');
      const game = await api.reclaimLand(id, selectedOfficerId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '开垦完成' });
    } catch (e) {
      set({ error: errMsg(e, '开垦失败'), loading: false });
    }
  },

  setCivilianFarming: async (cityId, households) => {
    set({ loading: true, error: null });
    try {
      const game = await api.setCivilianFarming(cityId, households);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '民屯已调整' });
    } catch (e) {
      set({ error: errMsg(e, '民屯调整失败'), loading: false });
    }
  },

  setMilitaryFarming: async (cityId, enabled) => {
    set({ loading: true, error: null });
    try {
      const game = await api.setMilitaryFarming(cityId, enabled);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '军屯已调整' });
    } catch (e) {
      set({ error: errMsg(e, '军屯调整失败'), loading: false });
    }
  },

  relocateGarrisonFamilies: async (fromCityId, toCityId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.relocateGarrisonFamilies(fromCityId, toCityId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '家属已迁移' });
    } catch (e) {
      set({ error: errMsg(e, '迁家属失败'), loading: false });
    }
  },

  resolveFamilyTreatment: async (mode) => {
    set({ loading: true, error: null });
    try {
      const game = await api.resolveFamilyTreatment(mode);
      set({ game, loading: false, lastActionOk: mode === 'kindness' ? '已善待家属' : mode === 'repression' ? '已镇压家属' : '已中立处置家属' });
    } catch (e) {
      set({ error: errMsg(e, '家属处置失败'), loading: false });
      throw e;
    }
  },

  setNationalPolicy: async (type, targetCityId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.setNationalPolicy(type, targetCityId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '国策已改' });
    } catch (e) {
      set({ error: errMsg(e, '国策切换失败'), loading: false });
    }
  },

  patrolCity: async (cityId, officerId) => {
    const id = cityId ?? get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const selectedOfficerId = officerId ?? get().game?.cities[id]?.officers[0];
      if (selectedOfficerId == null) throw new Error('本城没有可指派武将');
      const game = await api.patrolCity(id, selectedOfficerId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '巡查完成' });
    } catch (e) {
      set({ error: errMsg(e, '巡查失败'), loading: false });
    }
  },

  buyArms: async (amount) => {
    set({ loading: true, error: null });
    try {
      const game = await api.buyArms(amount ?? 10);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '采购完成' });
    } catch (e) {
      set({ error: errMsg(e, '兵装采购失败'), loading: false });
    }
  },

  resolveImpeachment: async (cityId, action) => {
    const id = cityId ?? get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const game = await api.resolveImpeachment(id, action ?? 'appease');
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '弹劾已处理' });
    } catch (e) {
      set({ error: errMsg(e, '弹劾处理失败'), loading: false });
    }
  },

  seekBeauty: async (cityId) => {
    const id = cityId ?? get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const game = await api.seekBeauty(id);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '结交完成' });
    } catch (e) {
      set({ error: errMsg(e, '结交失败'), loading: false });
    }
  },

  searchBeauty: async () => {
    await get().seekBeauty();
  },

  rewardBeautyStock: async (officerId, amount) => {
    set({ loading: true, error: null });
    try {
      const game = await api.rewardBeautyStock(officerId, amount);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '赏赐完成' });
    } catch (e) {
      set({ error: errMsg(e, '赏赐美女失败'), loading: false });
    }
  },

  marry: async (femaleId, officerId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.marry(femaleId, officerId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '婚配完成' });
    } catch (e) {
      set({ error: errMsg(e, '婚配失败'), loading: false });
    }
  },

  searchTalent: async (cityId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.searchTalent(cityId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '搜索完成' });
    } catch (e) {
      set({ error: errMsg(e, '搜索失败'), loading: false });
    }
  },

  equipItem: async (officerId, itemId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.equipItem(officerId, itemId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '装备完成' });
    } catch (e) {
      set({ error: errMsg(e, '装备失败'), loading: false });
    }
  },

  unequipItem: async (officerId, itemId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.unequipItem(officerId, itemId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '卸下完成' });
    } catch (e) {
      set({ error: errMsg(e, '卸下失败'), loading: false });
    }
  },

  grantTreasure: async (officerId, itemId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.grantTreasure(officerId, itemId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '赏赐完成' });
    } catch (e) {
      set({ error: errMsg(e, '赏赐宝物失败'), loading: false });
    }
  },

  recruitOfficer: async (officerId, recruiterId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.recruitOfficer(officerId, recruiterId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '登用完成' });
    } catch (e) {
      set({ error: errMsg(e, '登用失败'), loading: false });
    }
  },

  appointOfficer: async (officerId, track, position, cityId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.appointOfficer(officerId, track, position, cityId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '任命完成' });
    } catch (e) {
      set({ error: errMsg(e, '任命失败'), loading: false });
    }
  },

  grantNobility: async (officerId, targetRank) => {
    set({ loading: true, error: null });
    try {
      const game = await api.grantNobility(officerId, targetRank);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '封爵完成' });
    } catch (e) {
      set({ error: errMsg(e, '封爵失败'), loading: false });
    }
  },

  recruitSpies: async (cityId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.recruitSpies(cityId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '招募完成' });
    } catch (e) {
      set({ error: errMsg(e, '招募失败'), loading: false });
    }
  },

  trainFemaleSpy: async (cityId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.trainFemaleSpy(cityId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '训练完成' });
    } catch (e) {
      set({ error: errMsg(e, '训练失败'), loading: false });
    }
  },

  spyMission: async (agentId, type, targetCityId, targetOfficerId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.spyMission(agentId, type, targetCityId, targetOfficerId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '任务完成' });
    } catch (e) {
      set({ error: errMsg(e, '任务失败'), loading: false });
    }
  },

  stationCounter: async (agentId, cityId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.stationCounter(agentId, cityId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '驻守完成' });
    } catch (e) {
      set({ error: errMsg(e, '驻守失败'), loading: false });
    }
  },

  unstationCounter: async (cityId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.unstationCounter(cityId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '撤回完成' });
    } catch (e) {
      set({ error: errMsg(e, '撤回失败'), loading: false });
    }
  },

  resolveCaptive: async (agentId, action) => {
    set({ loading: true, error: null });
    try {
      const game = await api.resolveCaptive(agentId, action);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '处置完成' });
    } catch (e) {
      set({ error: errMsg(e, '处置失败'), loading: false });
    }
  },

  launchPlot: async (type, opts) => {
    set({ loading: true, error: null });
    try {
      const game = await api.launchPlot(type, opts);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '计谋已发起' });
    } catch (e) {
      set({ error: errMsg(e, '计谋发起失败'), loading: false });
    }
  },

  cancelPlot: async (plotId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.cancelPlot(plotId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '计谋已终止' });
    } catch (e) {
      set({ error: errMsg(e, '终止计谋失败'), loading: false });
    }
  },

  followCheck: async () => {
    set({ loading: true, error: null });
    try {
      const game = await api.followCheck();
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '跟随检查完成' });
    } catch (e) {
      set({ error: errMsg(e, '跟随检查失败'), loading: false });
    }
  },

  tribute: async (targetFactionId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.tribute(targetFactionId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '进贡完成' });
    } catch (e) {
      set({ error: errMsg(e, '进贡失败'), loading: false });
    }
  },

  establishHegemony: async () => {
    set({ loading: true, error: null });
    try {
      const game = await api.establishHegemony();
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '开霸府成功' });
    } catch (e) {
      set({ error: errMsg(e, '开霸府失败'), loading: false });
    }
  },

  proclaimKing: async (kingdomName) => {
    set({ loading: true, error: null });
    try {
      const game = await api.proclaimKing(kingdomName);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '称王成功' });
    } catch (e) {
      set({ error: errMsg(e, '称王失败'), loading: false });
    }
  },

  falseDecreeWar: async (targetFactionId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.falseDecreeWar(targetFactionId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '伪诏宣战成功' });
    } catch (e) {
      set({ error: errMsg(e, '伪诏宣战失败'), loading: false });
    }
  },

  transferCourtNetwork: async (targetFactionId, amount) => {
    set({ loading: true, error: null });
    try {
      const game = await api.transferCourtNetwork(targetFactionId, amount);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '宫廷牵线完成' });
    } catch (e) {
      set({ error: errMsg(e, '宫廷牵线失败'), loading: false });
    }
  },

  plantFemale: async (targetFactionId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.plantFemale(targetFactionId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '点化完成' });
    } catch (e) {
      set({ error: errMsg(e, '点化失败'), loading: false });
    }
  },

  formAlliance: async (targetFactionId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.formAlliance(targetFactionId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '结盟完成' });
    } catch (e) {
      set({ error: errMsg(e, '结盟失败'), loading: false });
    }
  },

  startBattle: async () => {
    // 兼容：走出征逻辑（自动选出发城）
    await get().marchOnCity();
  },

  marchOnCity: async (fromCityId, troopCount) => {
    const id = get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择目标城池' });
      return;
    }
    const game = get().game;
    if (game && game.cities[id]?.ruler === game.playerFactionId) {
      set({ error: '目标已是己方城，无需出征' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const { game: nextGame, battle } = await api.march(id, fromCityId, troopCount);
      const after = pushScene(get().sceneStack, { scene: 'battle' });
      set({
        game: nextGame,
        battle,
        sceneStack: after,
        screen: screenOf(after),
        selectedUnitId: null,
        moveRange: [],
        loading: false,
        lastActionOk: nextGame.actionLog[0]?.message ?? '出征',
      });
    } catch (e) {
      set({ error: errMsg(e, '出征失败'), loading: false });
    }
  },

  selectUnit: async (id) => {
    if (!id) {
      set({ selectedUnitId: null, moveRange: [], movePath: null, usableAbilities: [] });
      return;
    }
    const keys = await api.battleMoveRange(id);
    const abilities = await api.battleUsableAbilities(id);
    set({ selectedUnitId: id, moveRange: keys, movePath: null, usableAbilities: abilities });
  },

  previewMoveTo: async (q, r) => {
    const unitId = get().selectedUnitId;
    if (!unitId || !get().moveRange.includes(`${q},${r}`)) { set({ movePath: null }); return; }
    try { set({ movePath: await api.battleMovePath(unitId, q, r) }); } catch { set({ movePath: null }); }
  },

  moveTo: async (q, r) => {
    const unitId = get().selectedUnitId;
    if (!unitId) return;
    try {
      const battle = await api.battleMove(unitId, q, r);
      set({ battle, moveRange: [], movePath: null });
    } catch (e) {
      set({ error: errMsg(e, '移动失败') });
    }
  },

  undoBattleAction: async () => {
    try { const battle = await api.battleUndo(); set({ battle, movePath: null, selectedUnitId: null, moveRange: [] }); }
    catch (e) { set({ error: errMsg(e, '撤销失败') }); }
  },

  attack: async (defenderId) => {
    const attackerId = get().selectedUnitId;
    if (!attackerId) return;
    try {
      let battle = await api.battleAttack(attackerId, defenderId);
      set({ battle, selectedUnitId: null, moveRange: [] });
      if (battle.phase === 'enemy') {
        await new Promise((r) => setTimeout(r, 500));
        battle = await api.battleEnemyPhase();
        set({ battle });
      }
    } catch (e) {
      set({ error: errMsg(e, '攻击失败') });
    }
  },

  castFire: async (targetId) => {
    const attackerId = get().selectedUnitId;
    if (!attackerId) return;
    try {
      let battle = await api.battleFire(attackerId, targetId);
      set({ battle, selectedUnitId: null, moveRange: [], usableAbilities: [] });
      if (battle.phase === 'enemy') {
        await new Promise((r) => setTimeout(r, 500));
        battle = await api.battleEnemyPhase();
        set({ battle });
      }
    } catch (e) {
      set({ error: errMsg(e, '火计失败') });
    }
  },

  castWeather: async (weather) => {
    const attackerId = get().selectedUnitId;
    if (!attackerId) return;
    try {
      let battle = await api.battleWeather(attackerId, weather);
      set({ battle, selectedUnitId: null, moveRange: [], usableAbilities: [] });
      if (battle.phase === 'enemy') {
        await new Promise((r) => setTimeout(r, 500));
        battle = await api.battleEnemyPhase();
        set({ battle });
      }
    } catch (e) {
      set({ error: errMsg(e, '观天失败') });
    }
  },

  loadAbilities: async (unitId) => {
    try {
      const abilities = await api.battleUsableAbilities(unitId);
      set({ usableAbilities: abilities });
    } catch {
      set({ usableAbilities: [] });
    }
  },

  castAbility: async (targetId, abilityId) => {
    const attackerId = get().selectedUnitId;
    if (!attackerId) return;
    try {
      let battle = await api.battleAbility(attackerId, targetId, abilityId);
      set({ battle, selectedUnitId: null, moveRange: [], usableAbilities: [] });
      if (battle.phase === 'enemy') {
        await new Promise((r) => setTimeout(r, 500));
        battle = await api.battleEnemyPhase();
        set({ battle });
      }
    } catch (e) {
      set({ error: errMsg(e, '战法失败') });
    }
  },

  finishPlayer: async () => {
    try {
      let battle = await api.battleFinishPlayer();
      set({ battle, selectedUnitId: null, moveRange: [] });
      if (battle.phase === 'enemy') {
        await new Promise((r) => setTimeout(r, 500));
        battle = await api.battleEnemyPhase();
        set({ battle });
      }
    } catch (e) {
      set({ error: errMsg(e, '结束行动失败') });
    }
  },

  retreatBattle: async () => {
    try {
      const battle = await api.battleRetreat();
      set({ battle, selectedUnitId: null, moveRange: [], movePath: null, usableAbilities: [] });
    } catch (e) {
      set({ error: errMsg(e, '撤退失败') });
    }
  },

  changeBattleFormation: async (targetFormation: import('@leh/shared').FormationType) => {
    const unitId = get().selectedUnitId;
    if (!unitId) return;
    try {
      const battle = await api.battleChangeFormation(unitId, targetFormation);
      set({ battle, selectedUnitId: null, moveRange: [], movePath: null, usableAbilities: [] });
    } catch (e) {
      set({ error: errMsg(e, '变阵失败') });
    }
  },

  runEnemy: async () => {
    const battle = await api.battleEnemyPhase();
    set({ battle });
  },

  exitBattle: async () => {
    set({ loading: true, error: null });
    try {
      const game = await api.exitBattle();
      const msg = game.actionLog[0]?.message ?? '返回大地图';
      const after = popScene(get().sceneStack);
      const resolvedMelee = game.activeMelee ?? null;
      set({
        game,
        battle: null,
        melee: resolvedMelee,
        battlefieldInstance: game.activeBattlefieldInstance ?? null,
        sceneStack: after,
        screen: resolvedMelee ? 'melee' : screenOf(after),
        selectedUnitId: null,
        moveRange: [],
        loading: false,
        lastActionOk: msg,
      });
    } catch (e) {
      set({ error: errMsg(e, '退出战斗失败'), loading: false });
    }
  },

  duelChallenge: async (challengerUnitId: string, targetUnitId: string, stance: import('@leh/shared').DuelStance) => {
    try {
      const battle = await api.battleDuelChallenge(challengerUnitId, targetUnitId, stance);
      set({ battle, selectedUnitId: null, moveRange: [], usableAbilities: [] });
    } catch (e) {
      set({ error: errMsg(e, '发起单挑失败') });
    }
  },

  duelStep: async () => {
    try {
      const battle = await api.battleDuelStep();
      set({ battle });
    } catch (e) {
      set({ error: errMsg(e, '单挑推进失败') });
    }
  },

  duelSkip: async () => {
    try {
      const battle = await api.battleDuelSkip();
      set({ battle });
    } catch (e) {
      set({ error: errMsg(e, '单挑跳过失败') });
    }
  },

  // ====== 战役层 actions ======
  lastBattleResult: null,

  campaignStart: async (body) => {
    set({ loading: true, error: null });
    try {
      const { game, army } = await api.campaignStart(body);
      set({ game, loading: false, lastActionOk: `${army.name} 出征` });
      return army;
    } catch (e) {
      set({ error: errMsg(e, '出征失败'), loading: false });
      return null;
    }
  },

  campaignMarch: async (armyId, targetNodeId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.campaignMarch(armyId, targetNodeId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '行军指令已下达' });
    } catch (e) {
      set({ error: errMsg(e, '行军失败'), loading: false });
    }
  },

  campaignBuild: async (armyId, structureType) => {
    set({ loading: true, error: null });
    try {
      const game = await api.campaignBuild(armyId, structureType);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '建造完成' });
    } catch (e) {
      set({ error: errMsg(e, '建造失败'), loading: false });
    }
  },

  campaignAssault: async (armyId) => {
    set({ loading: true, error: null });
    try {
      const { game, result } = await api.campaignAssault(armyId);
      const msg = `${result.battlefield} 战 — ${result.winner === 'attacker' ? '攻方胜' : '守方胜'}（伤亡 ${result.attackerCasualties}/${result.defenderCasualties}）`;
      set({ game, loading: false, lastActionOk: msg, lastBattleResult: result });
    } catch (e) {
      set({ error: errMsg(e, '强攻失败'), loading: false });
    }
  },

  campaignSiegeSurrender: async (armyId) => {
    set({ loading: true, error: null });
    try {
      const { game, success } = await api.campaignSiegeSurrender(armyId);
      set({ game, loading: false, lastActionOk: success ? '守军开城投降' : '守军拒不投降' });
    } catch (e) {
      set({ error: errMsg(e, '劝降失败'), loading: false });
    }
  },

  campaignRetreat: async (armyId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.campaignRetreat(armyId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '撤退' });
    } catch (e) {
      set({ error: errMsg(e, '撤退失败'), loading: false });
    }
  },

  campaignAdvisorAction: async (armyId, action) => {
    set({ loading: true, error: null });
    try {
      const game = await api.campaignAdvisorAction(armyId, action);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '参谋行动' });
    } catch (e) {
      set({ error: errMsg(e, '参谋行动失败'), loading: false });
    }
  },

  // ====== 战场地图（Tier I） ======

  battlefieldInit: async (targetCityId, fromCityId) => {
    set({ loading: true, error: null });
    try {
      const bf = await api.battlefieldInit(targetCityId, fromCityId);
      const after = pushScene(get().sceneStack, { scene: 'battlefield' });
      set({ battlefield: bf, sceneStack: after, screen: screenOf(after), loading: false });
    } catch (e) {
      set({ error: errMsg(e, '战场初始化失败'), loading: false });
    }
  },

  battlefieldMarch: async (armyId, targetNodeId) => {
    set({ loading: true, error: null });
    try {
      const { game, battlefield } = await api.battlefieldMarch(armyId, targetNodeId);
      set({ game, battlefield, loading: false });
    } catch (e) {
      set({ error: errMsg(e, '行军失败'), loading: false });
    }
  },

  battlefieldExit: async () => {
    set({ loading: true, error: null });
    try {
      const game = await api.battlefieldExit();
      // 退出必须同时回收瞬态场景栈；战场退出是根级回收，不能保留旧 battlefield 残帧。
      const worldStack = replaceStack({ scene: 'world' });
      set({ game, battlefield: null, battlefieldInstance: game.activeBattlefieldInstance ?? null, melee: null, battle: null, sceneStack: worldStack, screen: 'world', loading: false });
    } catch (e) {
      set({ error: errMsg(e, '退出战场失败'), loading: false });
    }
  },

  // ====== 白刃战（Tier II） ======

  meleeStart: async (attackerArmyId, defenderArmyId) => {
    set({ loading: true, error: null, meleeLastResult: null });
    try {
      const { game, melee } = await api.meleeStart(attackerArmyId, defenderArmyId);
      set({ game, melee, screen: 'melee', loading: false });
    } catch (e) {
      set({ error: errMsg(e, '白刃战发起失败'), loading: false });
    }
  },

  meleeSelectMode: async (mode) => {
    set({ loading: true, error: null });
    try {
      const { game, melee, battle } = await api.meleeSelectMode(mode);
      if (mode === 'tactical' && battle) {
        const after = pushScene(get().sceneStack, { scene: 'battle', battleId: battle.id });
        set({ game, melee, battle, sceneStack: after, screen: screenOf(after), loading: false });
        return;
      }
      set({ game, melee, screen: mode === 'auto' ? 'melee' : 'melee', loading: false });
    } catch (e) {
      set({ error: errMsg(e, '选择交战模式失败'), loading: false });
    }
  },

  meleeRound: async (actionType, targetFormation) => {
    set({ loading: true, error: null });
    try {
      // FM-P3 动作级幂等：每次点击生成唯一 commandId，并用当前回合作为 expectedRound。
      // 离线可玩版（Session 372 Phase 0）：改用 crypto.randomUUID（回退单调计数），
      // 避免与玩法随机流混淆的 Math.random 出现在客户端代码中。
      const currentRound = get().melee?.round ?? 0;
      const nonce = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${(++commandIdSeq).toString(36)}`;
      const commandId = `r${currentRound}-${actionType}-${targetFormation ?? ''}-${nonce}`;
      const { game, result, melee } = await api.meleeRound(actionType, targetFormation, commandId, currentRound);
      set({ game, melee, meleeLastResult: result, loading: false });
    } catch (e) {
      set({ error: errMsg(e, '白刃战回合失败'), loading: false });
    }
  },

  meleeRefresh: async () => {
    try {
      const melee = await api.meleeRefresh();
      set({ melee });
    } catch (e) {
      set({ error: errMsg(e, '战术点刷新失败') });
    }
  },

  meleeExit: async () => {
    set({ loading: true, error: null });
    try {
      const { game } = await api.meleeExit();
      const after = get().sceneStack.some((frame) => frame.scene === 'battlefield')
        ? popToScene(get().sceneStack, 'battlefield')
        : replaceStack({ scene: 'world' });
      set({ game, melee: null, meleeLastResult: null, sceneStack: after, screen: screenOf(after), loading: false });
    } catch (e) {
      set({ error: errMsg(e, '退出白刃战失败'), loading: false });
    }
  },

  meleeSetTactic: async (tactic) => {
    set({ loading: true, error: null });
    try {
      const { game, melee } = await api.meleeSetTactic(tactic);
      set({ game, melee, loading: false });
    } catch (e) {
      set({ error: errMsg(e, '设定战术失败'), loading: false });
    }
  },

  // ====== 总军师系统 ======

  grandStrategistAppoint: async (officerId) => {
    set({ grandStrategistLoading: true, error: null });
    try {
      const { game, strategist } = await api.grandStrategistAppoint(officerId);
      set({ game, grandStrategist: strategist, grandStrategistLoading: false, lastActionOk: `拜 ${game?.officers[officerId]?.name ?? ''} 为总军师` });
    } catch (e) {
      set({ error: errMsg(e, '任命失败'), grandStrategistLoading: false });
    }
  },

  grandStrategistDismiss: async () => {
    set({ grandStrategistLoading: true, error: null });
    try {
      const { game } = await api.grandStrategistDismiss();
      set({ game, grandStrategist: null, grandStrategistLoading: false });
    } catch (e) {
      set({ error: errMsg(e, '解职失败'), grandStrategistLoading: false });
    }
  },

  grandStrategistSwitch: async (strategy) => {
    set({ grandStrategistLoading: true, error: null });
    try {
      const { game, log } = await api.grandStrategistSwitch(strategy);
      set({ game, grandStrategistLoading: false, lastActionOk: log });
      // 刷新总军师状态
      await get().grandStrategistRefresh();
    } catch (e) {
      set({ error: errMsg(e, '态势切换失败'), grandStrategistLoading: false });
    }
  },

  grandStrategistRefresh: async () => {
    try {
      const { strategist, modifiers } = await api.grandStrategistStatus();
      set({ grandStrategist: strategist, grandStrategistModifiers: modifiers });
    } catch {
      // 静默失败（非关键请求）
    }
  },
}));
