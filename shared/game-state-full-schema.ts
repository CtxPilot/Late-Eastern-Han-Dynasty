// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { z } from 'zod';
import { GameStateBattleSchema } from './game-state-battle-schema.js';
import { GameStateCampaignSchema } from './game-state-campaign-schema.js';
import { GameStateDiplomacySchema } from './game-state-diplomacy-schema.js';
import { GameStateEntitiesSchema } from './game-state-entity-schema.js';
import { GameStateIntelSchema } from './game-state-intel-schema.js';
import { GameStatePlotSchema } from './game-state-plot-schema.js';
import { GameStateTimelineSchema } from './game-state-schema.js';
import type { GameState } from './types/game.js';

const ROOT_KEYS = [
  'scenarioId', 'enabledEventLayers', 'enabledChildEventIds', 'currentYear', 'currentMonth',
  'season', 'playerFactionId', 'officers', 'cities', 'factions', 'females', 'armys',
  'campaignArmies', 'campaignNodes', 'grandStrategists', 'activeBattles',
  'activeBattlefield', 'activeMelee', 'activeBattlefieldInstance', 'diplomacy', 'intel',
  'plots', 'completedEvents', 'pendingEvents', 'invalidatedEvents', 'eventChoices',
  'actionLog',
] as const satisfies readonly (keyof GameState)[];

const RootShape = Object.fromEntries(ROOT_KEYS.map((key) => [key, z.unknown()])) as {
  [K in keyof GameState]: z.ZodUnknown;
};

function forwardIssues(
  result: z.SafeParseReturnType<unknown, unknown>,
  ctx: z.RefinementCtx,
): void {
  if (result.success) return;
  result.error.issues.forEach((issue) => ctx.addIssue({ ...issue }));
}

function requireRef(
  exists: boolean,
  path: (string | number)[],
  message: string,
  ctx: z.RefinementCtx,
): void {
  if (!exists) ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
}

function pickState<K extends keyof GameState>(state: GameState, keys: readonly K[]): Pick<GameState, K> {
  return Object.fromEntries(keys.map((key) => [key, state[key]])) as Pick<GameState, K>;
}

/**
 * 当前运行时 GameState 的完整持久化边界。
 *
 * 七个域内 Schema 仍是各自规则真源；本 Schema 只负责完整根字段以及跨切片引用。
 * 它不等于生产存档功能：版本迁移、存储介质和运行时恢复仍由 S16 后续步骤实现。
 */
export const GameStateSchema = z
  .object(RootShape)
  .strict()
  .superRefine((unknownState, ctx) => {
    const state = unknownState as GameState;
    const sliceResults = [
      GameStateTimelineSchema.safeParse(pickState(state, ['scenarioId', 'enabledEventLayers', 'enabledChildEventIds', 'currentYear', 'currentMonth', 'season', 'playerFactionId', 'completedEvents', 'pendingEvents', 'invalidatedEvents', 'eventChoices', 'actionLog'])),
      GameStateEntitiesSchema.safeParse(pickState(state, ['officers', 'cities', 'factions', 'females'])),
      GameStateCampaignSchema.safeParse(pickState(state, ['armys', 'campaignArmies', 'campaignNodes', 'grandStrategists'])),
      GameStateBattleSchema.safeParse(pickState(state, ['activeBattles', 'activeBattlefield', 'activeMelee', 'activeBattlefieldInstance'])),
      GameStateDiplomacySchema.safeParse(pickState(state, ['diplomacy'])),
      GameStateIntelSchema.safeParse(pickState(state, ['intel'])),
      GameStatePlotSchema.safeParse(pickState(state, ['plots'])),
    ];
    sliceResults.forEach((result) => forwardIssues(result, ctx));

    // 域内解析失败时数据形状并不可信；跨域检查必须等待所有切片先通过。
    const slicesValid = sliceResults.every((result) => result.success);
    if (!slicesValid) return;

    const officerIds = new Set(Object.keys(state.officers).map(Number));
    const cityIds = new Set(Object.keys(state.cities).map(Number));
    const factionIds = new Set(Object.keys(state.factions).map(Number));
    const femaleIds = new Set(Object.keys(state.females).map(Number));
    const campaignNodeIds = new Set(state.campaignNodes.map((node) => node.id));
    const campaignArmyIds = new Set(state.campaignArmies.map((army) => army.id));
    const spyIds = new Set(Object.keys(state.intel.agents));

    requireRef(factionIds.has(state.playerFactionId), ['playerFactionId'], '玩家势力不存在', ctx);

    Object.values(state.factions).forEach((faction) => {
      const base = ['factions', faction.id] as (string | number)[];
      requireRef(officerIds.has(faction.rulerId), [...base, 'rulerId'], '势力君主不存在', ctx);
      requireRef(cityIds.has(faction.capitalCityId), [...base, 'capitalCityId'], '势力治所不存在', ctx);
      if (state.officers[faction.rulerId]?.faction !== faction.id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...base, 'rulerId'], message: '势力君主必须属于本势力' });
      }
      if (state.cities[faction.capitalCityId]?.ruler !== faction.id) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...base, 'capitalCityId'], message: '势力治所必须由本势力控制' });
      }
      faction.cityIds.forEach((id, index) => {
        requireRef(cityIds.has(id), [...base, 'cityIds', index], '势力引用的城市不存在', ctx);
        if (state.cities[id] && state.cities[id].ruler !== faction.id) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...base, 'cityIds', index], message: '势力城市清单与城市归属不一致' });
        }
      });
      faction.officerIds.forEach((id, index) => {
        requireRef(officerIds.has(id), [...base, 'officerIds', index], '势力引用的武将不存在', ctx);
        if (state.officers[id] && state.officers[id].faction !== faction.id) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...base, 'officerIds', index], message: '势力武将清单与武将归属不一致' });
        }
      });
    });

    Object.values(state.cities).forEach((city) => {
      const base = ['cities', city.id] as (string | number)[];
      if (city.ruler != null) requireRef(factionIds.has(city.ruler), [...base, 'ruler'], '城市所属势力不存在', ctx);
      if (city.ruler != null && state.factions[city.ruler] && !state.factions[city.ruler].cityIds.includes(city.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...base, 'ruler'], message: '城市归属与势力城市清单不一致' });
      }
      city.officers.forEach((id, index) => {
        requireRef(officerIds.has(id), [...base, 'officers', index], '城市引用的武将不存在', ctx);
        if (state.officers[id]?.location !== city.id) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...base, 'officers', index], message: '城市武将清单与武将所在地不一致' });
        }
      });
    });

    Object.values(state.officers).forEach((officer) => {
      const base = ['officers', officer.id] as (string | number)[];
      if (officer.faction != null) requireRef(factionIds.has(officer.faction), [...base, 'faction'], '武将所属势力不存在', ctx);
      if (officer.location != null) requireRef(cityIds.has(officer.location), [...base, 'location'], '武将所在城市不存在', ctx);
      if (officer.faction != null && state.factions[officer.faction] && !state.factions[officer.faction].officerIds.includes(officer.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...base, 'faction'], message: '武将归属与势力武将清单不一致' });
      }
      if (officer.wifeId != null) requireRef(femaleIds.has(officer.wifeId), [...base, 'wifeId'], '武将配偶不存在', ctx);
      officer.beauties.forEach((id, index) => requireRef(femaleIds.has(id), [...base, 'beauties', index], '武将赏赐对象不存在', ctx));
    });

    Object.values(state.females).forEach((female) => {
      const base = ['females', female.id] as (string | number)[];
      if (female.factionId != null) requireRef(factionIds.has(female.factionId), [...base, 'factionId'], '女性角色所属势力不存在', ctx);
      requireRef(cityIds.has(female.locationId), [...base, 'locationId'], '女性角色所在城市不存在', ctx);
      if (female.husbandId != null) requireRef(officerIds.has(female.husbandId), [...base, 'husbandId'], '女性角色配偶不存在', ctx);
      if (female.giftedToOfficerId != null) requireRef(officerIds.has(female.giftedToOfficerId), [...base, 'giftedToOfficerId'], '赏赐目标武将不存在', ctx);
    });

    state.armys.forEach((army, index) => {
      requireRef(officerIds.has(army.commanderId), ['armys', index, 'commanderId'], '旧 Army 主将不存在', ctx);
      army.subCommanders.forEach((id, subIndex) => requireRef(officerIds.has(id), ['armys', index, 'subCommanders', subIndex], '旧 Army 副将不存在', ctx));
      requireRef(cityIds.has(army.location), ['armys', index, 'location'], '旧 Army 所在城市不存在', ctx);
      if (army.targetCityId != null) requireRef(cityIds.has(army.targetCityId), ['armys', index, 'targetCityId'], '旧 Army 目标城市不存在', ctx);
    });

    state.campaignNodes.forEach((node, index) => {
      requireRef(cityIds.has(node.commanderyId), ['campaignNodes', index, 'commanderyId'], '战役节点所属郡国不存在', ctx);
      if (node.ruler != null) requireRef(factionIds.has(node.ruler), ['campaignNodes', index, 'ruler'], '战役节点所属势力不存在', ctx);
      node.adjacentNodeIds.forEach((id, adjacentIndex) => requireRef(campaignNodeIds.has(id), ['campaignNodes', index, 'adjacentNodeIds', adjacentIndex], '相邻战役节点不存在', ctx));
    });

    state.campaignArmies.forEach((army, index) => {
      requireRef(factionIds.has(army.factionId), ['campaignArmies', index, 'factionId'], '战役 Army 所属势力不存在', ctx);
      [army.commanderId, ...army.subCommanderIds, ...army.squads.map((squad) => squad.officerId)].forEach((id) => requireRef(officerIds.has(id), ['campaignArmies', index], '战役 Army 引用的武将不存在', ctx));
      if (army.advisorId != null) requireRef(officerIds.has(army.advisorId), ['campaignArmies', index, 'advisorId'], '战役 Army 参谋不存在', ctx);
      if (army.subAdvisorId != null) requireRef(officerIds.has(army.subAdvisorId), ['campaignArmies', index, 'subAdvisorId'], '战役 Army 副参谋不存在', ctx);
      [army.currentNodeId, ...army.path, ...army.structures.map((structure) => structure.nodeId)].forEach((id) => requireRef(campaignNodeIds.has(id), ['campaignArmies', index], '战役 Army 引用的节点不存在', ctx));
      if (army.targetNodeId != null) requireRef(campaignNodeIds.has(army.targetNodeId), ['campaignArmies', index, 'targetNodeId'], '战役 Army 目标节点不存在', ctx);
      if (army.fromNodeId != null) requireRef(campaignNodeIds.has(army.fromNodeId), ['campaignArmies', index, 'fromNodeId'], '战役 Army 出发节点不存在', ctx);
    });

    state.grandStrategists.forEach((strategist, index) => {
      requireRef(factionIds.has(strategist.factionId), ['grandStrategists', index, 'factionId'], '总军师所属势力不存在', ctx);
      requireRef(officerIds.has(strategist.officerId), ['grandStrategists', index, 'officerId'], '总军师武将不存在', ctx);
    });

    state.activeBattles.forEach((battle, index) => {
      requireRef(factionIds.has(battle.attackerFaction), ['activeBattles', index, 'attackerFaction'], '战斗进攻势力不存在', ctx);
      requireRef(factionIds.has(battle.defenderFaction), ['activeBattles', index, 'defenderFaction'], '战斗防守势力不存在', ctx);
      if (battle.cityId != null) requireRef(cityIds.has(battle.cityId), ['activeBattles', index, 'cityId'], '战斗城市不存在', ctx);
      if (battle.fromCityId != null) requireRef(cityIds.has(battle.fromCityId), ['activeBattles', index, 'fromCityId'], '战斗出发城市不存在', ctx);
      battle.units.forEach((unit, unitIndex) => {
        requireRef(officerIds.has(unit.commanderId), ['activeBattles', index, 'units', unitIndex, 'commanderId'], '战斗单位主将不存在', ctx);
      });
    });

    if (state.activeBattlefield) {
      requireRef(cityIds.has(state.activeBattlefield.targetCityId), ['activeBattlefield', 'targetCityId'], '战场目标城市不存在', ctx);
      requireRef(factionIds.has(state.activeBattlefield.attackerFactionId), ['activeBattlefield', 'attackerFactionId'], '战场进攻势力不存在', ctx);
      requireRef(factionIds.has(state.activeBattlefield.defenderFactionId), ['activeBattlefield', 'defenderFactionId'], '战场防守势力不存在', ctx);
      state.activeBattlefield.armyIds.forEach((id, index) => requireRef(campaignArmyIds.has(id), ['activeBattlefield', 'armyIds', index], '战场引用的战役 Army 不存在', ctx));
    }

    if (state.activeBattlefieldInstance) {
      const inst = state.activeBattlefieldInstance;
      const instNodeIds = new Set(inst.nodeStates.map((n) => n.nodeId));
      // 注意：routeStates 的 fromNodeId/toNodeId 与 entryNodeIds 可合法引用郡域外
      // 边界入口节点（如 nanjun_xiangyang_ferry 即襄阳北部入口），因此不做
      // “必须在 nodeStates 中”的校验；只校验真正跨域的引用。
      inst.nodeStates.forEach((node, nodeIndex) => {
        if (node.rulerFactionId != null) {
          requireRef(factionIds.has(node.rulerFactionId), ['activeBattlefieldInstance', 'nodeStates', nodeIndex, 'rulerFactionId'], '郡域战场节点控制势力不存在', ctx);
        }
        node.armyIds.forEach((armyId, armyIndex) => requireRef(campaignArmyIds.has(armyId), ['activeBattlefieldInstance', 'nodeStates', nodeIndex, 'armyIds', armyIndex], '郡域战场节点引用的战役 Army 不存在', ctx));
      });
      inst.armyIds.forEach((armyId, armyIndex) => requireRef(campaignArmyIds.has(armyId), ['activeBattlefieldInstance', 'armyIds', armyIndex], '郡域战场引用的战役 Army 不存在', ctx));
      inst.encounters.forEach((encounter, encIndex) => {
        requireRef(campaignArmyIds.has(encounter.attackerArmyId), ['activeBattlefieldInstance', 'encounters', encIndex, 'attackerArmyId'], '郡域战场遭遇战攻方 Army 不存在', ctx);
        if (encounter.defenderArmyId) requireRef(campaignArmyIds.has(encounter.defenderArmyId), ['activeBattlefieldInstance', 'encounters', encIndex, 'defenderArmyId'], '郡域战场遭遇战守方 Army 不存在', ctx);
        encounter.defenderNodeIds.forEach((nodeId, nodeIndex) => requireRef(instNodeIds.has(nodeId), ['activeBattlefieldInstance', 'encounters', encIndex, 'defenderNodeIds', nodeIndex], '郡域战场遭遇战守方节点不在本实例中', ctx));
      });
      requireRef(instNodeIds.has(inst.targetSeatNodeId), ['activeBattlefieldInstance', 'targetSeatNodeId'], '郡域战场目标 seat 节点不在本实例中', ctx);
    }

    state.diplomacy.forEach((link, index) => {
      requireRef(factionIds.has(link.factionA), ['diplomacy', index, 'factionA'], '外交势力 A 不存在', ctx);
      requireRef(factionIds.has(link.factionB), ['diplomacy', index, 'factionB'], '外交势力 B 不存在', ctx);
    });

    Object.entries(state.intel.cities).forEach(([cityId]) => requireRef(cityIds.has(Number(cityId)), ['intel', 'cities', cityId], '情报城市不存在', ctx));
    Object.entries(state.intel.cityDefense).forEach(([cityId]) => requireRef(cityIds.has(Number(cityId)), ['intel', 'cityDefense', cityId], '反间城市不存在', ctx));
    Object.entries(state.intel.plantableBeauty ?? {}).forEach(([factionId]) => requireRef(factionIds.has(Number(factionId)), ['intel', 'plantableBeauty', factionId], '献美点化目标势力不存在', ctx));
    Object.values(state.intel.agents).forEach((agent) => {
      requireRef(factionIds.has(agent.factionId), ['intel', 'agents', agent.id, 'factionId'], '特工所属势力不存在', ctx);
      requireRef(cityIds.has(agent.homeCityId), ['intel', 'agents', agent.id, 'homeCityId'], '特工本城不存在', ctx);
      if (agent.locationCityId != null) requireRef(cityIds.has(agent.locationCityId), ['intel', 'agents', agent.id, 'locationCityId'], '特工所在城市不存在', ctx);
      if (agent.captiveByFactionId != null) requireRef(factionIds.has(agent.captiveByFactionId), ['intel', 'agents', agent.id, 'captiveByFactionId'], '俘获特工的势力不存在', ctx);
    });
    state.intel.recentMissions.forEach((mission, index) => {
      requireRef(factionIds.has(mission.factionId), ['intel', 'recentMissions', index, 'factionId'], '谍报日志势力不存在', ctx);
      if (mission.targetCityId != null) requireRef(cityIds.has(mission.targetCityId), ['intel', 'recentMissions', index, 'targetCityId'], '谍报日志目标城市不存在', ctx);
    });

    state.plots.forEach((plot, index) => {
      requireRef(factionIds.has(plot.casterFactionId), ['plots', index, 'casterFactionId'], '计谋施计势力不存在', ctx);
      if (plot.targetFactionId != null) requireRef(factionIds.has(plot.targetFactionId), ['plots', index, 'targetFactionId'], '计谋目标势力不存在', ctx);
      if (plot.targetCityId != null) requireRef(cityIds.has(plot.targetCityId), ['plots', index, 'targetCityId'], '计谋目标城市不存在', ctx);
      if (plot.targetOfficerId != null) requireRef(officerIds.has(plot.targetOfficerId), ['plots', index, 'targetOfficerId'], '计谋目标武将不存在', ctx);
      if (plot.agentId != null) requireRef(spyIds.has(plot.agentId), ['plots', index, 'agentId'], '计谋特工不存在', ctx);
      plot.result?.favorChanges?.forEach((change, changeIndex) => {
        requireRef(factionIds.has(change.a), ['plots', index, 'result', 'favorChanges', changeIndex, 'a'], '计谋关系变化势力 A 不存在', ctx);
        requireRef(factionIds.has(change.b), ['plots', index, 'result', 'favorChanges', changeIndex, 'b'], '计谋关系变化势力 B 不存在', ctx);
      });
    });

    const eventLedgers = [state.completedEvents, state.pendingEvents, state.invalidatedEvents];
    const seenEvents = new Set<number>();
    eventLedgers.forEach((ledger, ledgerIndex) => ledger.forEach((eventId, eventIndex) => {
      if (seenEvents.has(eventId)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [['completedEvents', 'pendingEvents', 'invalidatedEvents'][ledgerIndex], eventIndex], message: '事件不能同时存在于多个状态账本' });
      seenEvents.add(eventId);
    }));
  }) as unknown as z.ZodType<GameState>;

export type PersistedGameState = z.infer<typeof GameStateSchema>;
