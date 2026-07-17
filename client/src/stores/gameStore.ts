// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { create } from 'zustand';
import type { AutoBattleResult, BattleState, CampaignArmy, GameState } from '@leh/shared';
import * as api from '../services/api';
import { errMsg, type CampaignStartBody, type ChildCatalogEntry, type EventCatalogEntry, type UsableAbility } from '../services/api';

type Screen = 'boot' | 'world' | 'battle';

interface Store {
  screen: Screen;
  game: GameState | null;
  battle: BattleState | null;
  selectedCityId: number | null;
  /** MapCanvas consumes then clears — left panel request zoom-to-city */
  mapFocusCityId: number | null;
  selectedUnitId: string | null;
  moveRange: string[];
  error: string | null;
  loading: boolean;
  /** short UI feedback for last successful action */
  lastActionOk: string | null;
  /** 子女史实表（家族面板） */
  childrenCatalog: ChildCatalogEntry[];
  /** 事件目录（对话/选项标签，无 effects） */
  eventsCatalog: EventCatalogEntry[];
  /** S10 当前选中单位可用战法 */
  usableAbilities: UsableAbility[];

  boot: () => Promise<void>;
  selectCity: (id: number | null) => void;
  focusMapOnCity: (id: number) => void;
  clearMapFocus: () => void;
  endTurn: () => Promise<void>;
  chooseEvent: (eventId: number, choiceIndex: number) => Promise<void>;
  developFarm: () => Promise<void>;
  develop: (kind: 'farm' | 'commerce' | 'wall') => Promise<void>;
  conscript: () => Promise<void>;
  relief: () => Promise<void>;
  trainTroops: () => Promise<void>;
  seekBeauty: () => Promise<void>;
  /** @deprecated use seekBeauty */
  searchBeauty: () => Promise<void>;
  rewardBeautyStock: (officerId: number, amount?: number) => Promise<void>;
  marry: (femaleId: number, officerId: number) => Promise<void>;
  giftBeauty: (femaleId: number, officerId: number) => Promise<void>;
  searchTalent: (cityId: number) => Promise<void>;
  recruitOfficer: (officerId: number, recruiterId?: number) => Promise<void>;
  appointOfficer: (
    officerId: number,
    track: 'civil' | 'local' | 'military',
    position: string,
    cityId?: number,
  ) => Promise<void>;
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
      targetOfficerId?: number;
      agentId?: string;
    },
  ) => Promise<void>;
  followCheck: () => Promise<void>;
  tribute: (targetFactionId: number) => Promise<void>;
  giftBeautyDip: (targetFactionId: number, amount?: number) => Promise<void>;
  plantFemale: (targetFactionId: number) => Promise<void>;
  formAlliance: (targetFactionId: number) => Promise<void>;
  startBattle: () => Promise<void>;
  /** 出征攻城：fromCityId 省略则服务端选道路邻接己方城 */
  marchOnCity: (fromCityId?: number, troopCount?: number) => Promise<void>;
  selectUnit: (id: string | null) => Promise<void>;
  moveTo: (q: number, r: number) => Promise<void>;
  attack: (defenderId: string) => Promise<void>;
  castFire: (targetId: string) => Promise<void>;
  castAbility: (targetId: string, abilityId: string) => Promise<void>;
  loadAbilities: (unitId: string) => Promise<void>;
  finishPlayer: () => Promise<void>;
  runEnemy: () => Promise<void>;
  exitBattle: () => Promise<void>;
  duelChallenge: (challengerUnitId: string, targetUnitId: string) => Promise<void>;
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
}

export const useGameStore = create<Store>((set, get) => ({
  screen: 'boot',
  game: null,
  battle: null,
  selectedCityId: null,
  mapFocusCityId: null,
  selectedUnitId: null,
  moveRange: [],
  error: null,
  loading: false,
  lastActionOk: null,
  childrenCatalog: [],
  eventsCatalog: [],
  usableAbilities: [],

  boot: async () => {
    set({ loading: true, error: null, lastActionOk: null });
    try {
      const st = await api.fetchStatic();
      // F1: 先尝试恢复已有游戏，避免刷新即重置进度
      let game: GameState | null = null;
      try {
        game = await api.getGameState();
      } catch {
        // 无进行中游戏 → 创建新局
        game = await api.createGame(2);
      }
      set({
        game,
        childrenCatalog: st.children,
        eventsCatalog: st.events,
        screen: 'world',
        loading: false,
      });
    } catch (e) {
      set({ error: errMsg(e, '启动失败'), loading: false });
    }
  },

  selectCity: (id) => set({ selectedCityId: id, lastActionOk: null }),

  focusMapOnCity: (id) => set({ selectedCityId: id, mapFocusCityId: id, lastActionOk: null }),

  clearMapFocus: () => set({ mapFocusCityId: null }),

  endTurn: async () => {
    const pending = get().game?.pendingEvents ?? [];
    if (pending.length > 0) {
      set({ error: '请先处理待决事件' });
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

  develop: async (kind) => {
    const id = get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const game = await api.develop(id, kind);
      const logMsg = game.actionLog[0]?.message ?? '开发完成';
      set({ game, loading: false, lastActionOk: logMsg });
    } catch (e) {
      set({ error: errMsg(e, '开发失败'), loading: false });
    }
  },

  conscript: async () => {
    const id = get().selectedCityId;
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

  relief: async () => {
    const id = get().selectedCityId;
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

  trainTroops: async () => {
    const id = get().selectedCityId;
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

  seekBeauty: async () => {
    const id = get().selectedCityId;
    if (id == null) {
      set({ error: '请先选择己方城池' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const game = await api.seekBeauty(id);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '寻访完成' });
    } catch (e) {
      set({ error: errMsg(e, '寻访失败'), loading: false });
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

  giftBeauty: async (femaleId, officerId) => {
    set({ loading: true, error: null });
    try {
      const game = await api.giftBeauty(femaleId, officerId);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '赏赐完成' });
    } catch (e) {
      set({ error: errMsg(e, '赏赐失败'), loading: false });
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

  giftBeautyDip: async (targetFactionId, amount) => {
    set({ loading: true, error: null });
    try {
      const game = await api.giftBeautyDip(targetFactionId, amount);
      set({ game, loading: false, lastActionOk: game.actionLog[0]?.message ?? '献美完成' });
    } catch (e) {
      set({ error: errMsg(e, '献美失败'), loading: false });
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
      set({
        game: nextGame,
        battle,
        screen: 'battle',
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
      set({ selectedUnitId: null, moveRange: [], usableAbilities: [] });
      return;
    }
    const keys = await api.battleMoveRange(id);
    const abilities = await api.battleUsableAbilities(id);
    set({ selectedUnitId: id, moveRange: keys, usableAbilities: abilities });
  },

  moveTo: async (q, r) => {
    const unitId = get().selectedUnitId;
    if (!unitId) return;
    try {
      const battle = await api.battleMove(unitId, q, r);
      set({ battle, moveRange: [] });
    } catch (e) {
      set({ error: errMsg(e, '移动失败') });
    }
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

  runEnemy: async () => {
    const battle = await api.battleEnemyPhase();
    set({ battle });
  },

  exitBattle: async () => {
    set({ loading: true, error: null });
    try {
      const game = await api.exitBattle();
      const msg = game.actionLog[0]?.message ?? '返回大地图';
      set({
        game,
        battle: null,
        screen: 'world',
        selectedUnitId: null,
        moveRange: [],
        loading: false,
        lastActionOk: msg,
      });
    } catch (e) {
      set({ error: errMsg(e, '退出战斗失败'), loading: false });
    }
  },

  duelChallenge: async (challengerUnitId: string, targetUnitId: string) => {
    try {
      const battle = await api.battleDuelChallenge(challengerUnitId, targetUnitId);
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
}));
