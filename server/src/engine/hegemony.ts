// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 霸府/称王/称帝主线引擎（docs/26，HC-P0~P2）。
 * 本轮（HC-P0-3）只实现"开霸府"状态转移；称王/称帝留 HC-P1/P2。
 */
import { controlsEmperor, type GameState, type PoliticalStage } from '@leh/shared';

/** 霸府阶段头衔文案。汉末霸府典型为丞相（曹操迎帝都许后任丞相）。 */
const HEGEMON_TITLE = '丞相';

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<GameState> = {},
): GameState {
  return {
    ...state,
    ...patch,
    actionLog: [
      {
        year: state.currentYear,
        month: state.currentMonth,
        type,
        message,
      },
      ...state.actionLog,
    ].slice(0, 80),
  };
}

/**
 * 开霸府（docs/26 HC-P0-3）。
 *
 * 前置条件：
 * 1. 当前势力必须控制汉献帝（controlsEmperor）
 * 2. 当前 politicalStage 必须为 'vassal'（防止重复开府/对已是霸府王帝的势力触发）
 *
 * 操作执行：
 * - politicalStage: 'vassal' → 'hegemon'
 * - politicalTitle: undefined → HEGEMON_TITLE
 * - politicalStageChangedYear: 当前年份
 *
 * 后退禁令：开府不可撤销（§三设计），不提供退回诸侯的反向操作。
 */
export function establishHegemony(state: GameState, factionId: number): GameState {
  const faction = state.factions[factionId];
  if (!faction) throw new Error('势力不存在');
  if (!controlsEmperor(state, factionId)) {
    throw new Error('未控制汉献帝，无法开霸府（需先占领汉帝所在城池）');
  }
  const stage = faction.politicalStage ?? 'vassal';
  if (stage !== 'vassal') {
    const title = stage === 'hegemon' ? '已是霸府' : stage === 'king' ? '已称王' : '已称帝';
    throw new Error(`当前${title}，无法重复开霸府`);
  }

  const ruler = state.officers[faction.rulerId];
  const rulerName = ruler?.name ?? faction.name;

  const factions = {
    ...state.factions,
    [factionId]: {
      ...faction,
      politicalStage: 'hegemon' as PoliticalStage,
      politicalTitle: HEGEMON_TITLE,
      politicalStageChangedYear: state.currentYear,
    },
  };

  return pushLog(
    state,
    'hegemony_established',
    `${rulerName} 迎奉天子，开霸府，自领${HEGEMON_TITLE}（${faction.name}进入霸府阶段）`,
    { factions },
  );
}