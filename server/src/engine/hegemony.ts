// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 霸府/称王/称帝主线引擎（docs/26，HC-P0~P2）。
 * 本轮（HC-P0-3）只实现"开霸府"状态转移；称王/称帝留 HC-P1/P2。
 */
import {
  DipRelation,
  controlsEmperor,
  findDiplomacy,
  type DiplomacyLink,
  type GameState,
  type PoliticalStage,
} from '@leh/shared';
import { staticData } from '../data/loader.js';

/** 霸府阶段头衔文案。汉末霸府典型为丞相（曹操迎帝都许后任丞相）。 */
const HEGEMON_TITLE = '丞相';
export const IMPERIAL_AUTHORITY_MAX = 100;
export const IMPERIAL_AUTHORITY_QUARTERLY_RECOVERY = 10;
export const FALSE_DECREE_COST = 40;
export const FALSE_DECREE_COOLDOWN_QUARTERS = 8;
export const HAN_LOYALIST_FAME_PENALTY = 30;
export const KING_STAGE_MONTHS_REQUIRED = 12;
export const KING_IMPERIAL_AUTHORITY_REQUIRED = 80;

export interface KingRequirement<T> {
  current: T;
  threshold: T;
  passed: boolean;
}

export interface KingRequirements {
  factionExists: KingRequirement<boolean>;
  factionAlive: KingRequirement<boolean>;
  politicalStage: KingRequirement<string>;
  cityCount: KingRequirement<number>;
  politicalStageAgeMonths: KingRequirement<number>;
  imperialAuthority: KingRequirement<number>;
  contestableCityCount: number;
  allPassed: boolean;
}

/**
 * HC-P1-1 称王门槛权威查询。只读取输入状态与只读剧本静态数据，不修改状态。
 *
 * 城池门槛固定取开局纳入争夺的城市数，避免随灭国或当前地图状态漂移：
 * scenario.kingRequirements?.minCities
 *   ?? Math.max(3, Math.ceil(contestableCityCount * 0.25))
 */
export function getKingRequirements(state: GameState, factionId: number): KingRequirements {
  const scenario = staticData.scenarios.find((candidate) => candidate.id === state.scenarioId);
  if (!scenario) throw new Error(`剧本 ${state.scenarioId} 不存在`);

  const faction = state.factions[factionId];
  const contestableCityCount = Object.keys(scenario.startState.cityOwnership).length;
  const cityThreshold = scenario.kingRequirements?.minCities
    ?? Math.max(3, Math.ceil(contestableCityCount * 0.25));
  const factionExists = {
    current: faction !== undefined,
    threshold: true,
    passed: faction !== undefined,
  };
  const factionAlive = {
    current: faction?.isAlive ?? false,
    threshold: true,
    passed: faction?.isAlive === true,
  };
  const politicalStage = {
    current: faction?.politicalStage ?? 'vassal',
    threshold: 'hegemon',
    passed: faction?.politicalStage === 'hegemon',
  };
  const cityCountValue = faction?.cityIds.length ?? 0;
  const cityCount = {
    current: cityCountValue,
    threshold: cityThreshold,
    passed: cityCountValue >= cityThreshold,
  };
  const stageAgeValue = faction?.politicalStageAgeMonths ?? 0;
  const politicalStageAgeMonths = {
    current: stageAgeValue,
    threshold: KING_STAGE_MONTHS_REQUIRED,
    passed: stageAgeValue >= KING_STAGE_MONTHS_REQUIRED,
  };
  const authorityValue = faction?.imperialAuthority ?? 0;
  const imperialAuthority = {
    current: authorityValue,
    threshold: KING_IMPERIAL_AUTHORITY_REQUIRED,
    passed: authorityValue >= KING_IMPERIAL_AUTHORITY_REQUIRED,
  };
  const checks = [
    factionExists,
    factionAlive,
    politicalStage,
    cityCount,
    politicalStageAgeMonths,
    imperialAuthority,
  ];

  return {
    factionExists,
    factionAlive,
    politicalStage,
    cityCount,
    politicalStageAgeMonths,
    imperialAuthority,
    contestableCityCount,
    allPassed: checks.every((requirement) => requirement.passed),
  };
}

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
      politicalStageAgeMonths: 0,
      imperialAuthority: IMPERIAL_AUTHORITY_MAX,
      imperialDecreeCooldown: 0,
    },
  };

  return pushLog(
    state,
    'hegemony_established',
    `${rulerName} 迎奉天子，开霸府，自领${HEGEMON_TITLE}（${faction.name}进入霸府阶段）`,
    { factions },
  );
}

function targetSupportsHan(state: GameState, factionId: number): boolean {
  const faction = state.factions[factionId];
  if (!faction) return false;
  return faction.officerIds.some((id) => state.officers[id]?.tags?.includes('匡扶汉室'));
}

/** HC-P0-6：伪诏宣战，绕过普通外交关系前置。 */
export function declareWarByFalseDecree(
  state: GameState,
  factionId: number,
  targetFactionId: number,
): GameState {
  const faction = state.factions[factionId];
  const target = state.factions[targetFactionId];
  if (!faction) throw new Error('发起势力不存在');
  if (!target?.isAlive) throw new Error('目标势力不存在或已灭亡');
  if (factionId === targetFactionId) throw new Error('不能对本势力宣战');
  if ((faction.politicalStage ?? 'vassal') === 'vassal') {
    throw new Error('尚未开霸府，无法使用伪诏宣战');
  }
  const authority = faction.imperialAuthority ?? 0;
  if (authority < FALSE_DECREE_COST) {
    throw new Error(`皇权点数不足（需 ${FALSE_DECREE_COST}，当前 ${authority}）`);
  }
  const cooldown = faction.imperialDecreeCooldown ?? 0;
  if (cooldown > 0) throw new Error(`伪诏宣战冷却中（剩余 ${cooldown} 季）`);
  const existing = findDiplomacy(state.diplomacy, factionId, targetFactionId);
  if ((existing?.relation as string) === 'war') throw new Error('目标已处于交战状态');

  const loyalistPenalty = targetSupportsHan(state, targetFactionId)
    ? HAN_LOYALIST_FAME_PENALTY
    : 0;
  const factions = {
    ...state.factions,
    [factionId]: {
      ...faction,
      imperialAuthority: authority - FALSE_DECREE_COST,
      imperialDecreeCooldown: FALSE_DECREE_COOLDOWN_QUARTERS,
      fame: Math.max(0, (faction.fame ?? 0) - loyalistPenalty),
    },
  };
  const nextLink: DiplomacyLink = existing
    ? { ...existing, relation: DipRelation.WAR, favorability: Math.min(existing.favorability, -50) }
    : { factionA: factionId, factionB: targetFactionId, relation: DipRelation.WAR, favorability: -50 };
  const diplomacy = existing
    ? state.diplomacy.map((link) =>
        link === existing ? nextLink : link,
      )
    : [...state.diplomacy, nextLink];
  const penaltyText = loyalistPenalty > 0 ? `；对匡扶汉室势力动兵，声望-${loyalistPenalty}` : '';
  return pushLog(
    state,
    'false_decree_war',
    `${faction.name}矫制天子诏命，对${target.name}宣战（皇权-${FALSE_DECREE_COST}，冷却${FALSE_DECREE_COOLDOWN_QUARTERS}季${penaltyText}）`,
    { factions, diplomacy },
  );
}

/** 季度开始时恢复皇权并推进伪诏冷却。 */
export function tickImperialAuthorityQuarter(state: GameState): GameState {
  return {
    ...state,
    factions: Object.fromEntries(Object.entries(state.factions).map(([id, faction]) => {
      if ((faction.politicalStage ?? 'vassal') === 'vassal') return [id, faction];
      return [id, {
        ...faction,
        imperialAuthority: Math.min(
          IMPERIAL_AUTHORITY_MAX,
          (faction.imperialAuthority ?? 0) + IMPERIAL_AUTHORITY_QUARTERLY_RECOVERY,
        ),
        imperialDecreeCooldown: Math.max(0, (faction.imperialDecreeCooldown ?? 0) - 1),
      }];
    })),
  };
}
