// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 天下一统与战役终局引擎（HC-P2，docs/50）。
 *
 * 核心职责：
 * 1. 判定玩家势力的「天下一统」（Unification Victory）
 *    - 条件：除玩家势力外的所有其他割据势力均已灭亡（alive.length === 0），或占领全部争夺城池；
 *    - 结算：生成开国功臣榜、霸业史诗年谱、一统战报与终局摘要；
 * 2. 判定玩家势力的「身死国灭」（Defeat Game Over）
 *    - 条件：玩家势力城池归零且被标记为灭亡（isAlive === false）；
 *    - 结算：生成破国年表与败亡战报；
 * 3. 严格零 RNG 消耗，保护既有 12/24 月月结金样确定性。
 */

import {
  deriveMeritPath,
  meritTitle,
  OfficerStatus,
  type EndgameMeritOfficer,
  type EndgameResult,
  type GameState,
} from '@leh/shared';
import { staticData } from '../data/loader.js';

export function checkEndgameStatus(state: GameState): GameState {
  // 幂等保护：若已产生终局结果，不再重复判定
  if (state.endgameResult) return state;

  const playerFaction = state.factions[state.playerFactionId];
  if (!playerFaction) return state;

  const scenario = staticData.scenarios.find((s) => s.id === state.scenarioId);
  const contestableCityCount = scenario ? Object.keys(scenario.startState.cityOwnership).length : 30;

  // 1. 胜利判定（天下一统 / Unification Victory）
  if (playerFaction.isAlive) {
    const aliveOtherFactions = Object.values(state.factions).filter(
      (f) => f.id !== state.playerFactionId && f.isAlive,
    );
    const playerCityCount = playerFaction.cityIds.length;
    const isAllCitiesConquered = playerCityCount >= contestableCityCount;
    const isAllEnemiesEliminated = aliveOtherFactions.length === 0;

    if (isAllCitiesConquered || isAllEnemiesEliminated) {
      const ruler = state.officers[playerFaction.rulerId];
      const capital = state.cities[playerFaction.capitalCityId];
      const startYear = scenario?.startState.year ?? state.currentYear;
      const totalYears = Math.max(1, state.currentYear - startYear + 1);

      // 开国功臣榜（提取功绩前 5 位臣属）
      const playerOfficers = Object.values(state.officers).filter(
        (o) => o.faction === playerFaction.id && o.status !== OfficerStatus.DEAD && o.id !== playerFaction.rulerId,
      );
      playerOfficers.sort((a, b) => (b.meritLevel ?? 0) - (a.meritLevel ?? 0));
      const topMeritOfficers: EndgameMeritOfficer[] = playerOfficers.slice(0, 5).map((o) => {
        const path = deriveMeritPath(o);
        const level = o.meritLevel ?? 1;
        const title = meritTitle(level, path);
        return {
          officerId: o.id,
          name: o.name,
          meritLevel: level,
          meritTitle: title,
          officialPosition: o.hegemonyPosition ?? o.militaryPosition ?? o.civilPosition ?? o.localPosition,
        };
      });

      // 提取霸业史诗年谱（精炼 actionLog 中的关键历史节点）
      const chronicleEvents: string[] = [];
      chronicleEvents.push(`${startYear}年：${playerFaction.name}起兵于${capital?.name ?? '治所'}，经略中原。`);
      for (const log of [...state.actionLog].reverse()) {
        if (
          log.type === 'hegemony_established' ||
          log.type === 'king_proclaimed' ||
          log.type === 'emperor_proclaimed' ||
          log.type === 'city_captured' ||
          log.type === 'faction_destroyed'
        ) {
          chronicleEvents.push(`${log.year}年${log.month}月：${log.message}`);
        }
      }
      chronicleEvents.push(
        `${state.currentYear}年${state.currentMonth}月：扫清六合，天下一统！定鼎${capital?.name ?? '京师'}。`,
      );

      const victoryResult: EndgameResult = {
        type: 'unification_victory',
        achievedYear: state.currentYear,
        achievedMonth: state.currentMonth,
        rulerOfficerId: ruler?.id ?? 0,
        rulerName: ruler?.name ?? playerFaction.name,
        factionId: playerFaction.id,
        factionName: playerFaction.name,
        kingdomName: playerFaction.kingdomName,
        politicalTitle: playerFaction.politicalTitle ?? '皇帝',
        eraName: playerFaction.eraName ?? '建元',
        totalYearsElapsed: totalYears,
        totalCitiesConquered: playerCityCount,
        capitalCityName: capital?.name ?? '洛阳',
        topMeritOfficers,
        chronicle: chronicleEvents.slice(-12),
      };

      const victoryLog = `【天下一统】${playerFaction.name}扫荡群雄，一统天下！四海毕极，九州同风！`;
      return {
        ...state,
        endgameResult: victoryResult,
        actionLog: [
          {
            year: state.currentYear,
            month: state.currentMonth,
            type: 'game_victory',
            message: victoryLog,
          },
          ...state.actionLog,
        ].slice(0, 80),
      };
    }
  }

  // 2. 失败判定（身死国灭 / Defeat Game Over）
  if (!playerFaction.isAlive || playerFaction.cityIds.length === 0) {
    const ruler = state.officers[playerFaction.rulerId];
    const capital = state.cities[playerFaction.capitalCityId];
    const startYear = scenario?.startState.year ?? state.currentYear;
    const totalYears = Math.max(1, state.currentYear - startYear + 1);

    const defeatResult: EndgameResult = {
      type: 'defeat',
      achievedYear: state.currentYear,
      achievedMonth: state.currentMonth,
      rulerOfficerId: ruler?.id ?? 0,
      rulerName: ruler?.name ?? playerFaction.name,
      factionId: playerFaction.id,
      factionName: playerFaction.name,
      kingdomName: playerFaction.kingdomName,
      politicalTitle: playerFaction.politicalTitle,
      eraName: playerFaction.eraName,
      totalYearsElapsed: totalYears,
      totalCitiesConquered: 0,
      capitalCityName: capital?.name ?? '旧都',
      topMeritOfficers: [],
      chronicle: [
        `${startYear}年：起兵割据。`,
        `${state.currentYear}年${state.currentMonth}月：城倾军散，国破家亡。`,
      ],
    };

    const defeatLog = `【身死国灭】${playerFaction.name}城池全失，将士散尽，霸业中道崩殂。`;
    return {
      ...state,
      endgameResult: defeatResult,
      actionLog: [
        {
          year: state.currentYear,
          month: state.currentMonth,
          type: 'game_defeat',
          message: defeatLog,
        },
        ...state.actionLog,
      ].slice(0, 80),
    };
  }

  return state;
}
