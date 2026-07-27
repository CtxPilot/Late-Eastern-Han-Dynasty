// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 霸府/称王/称帝主线引擎（docs/26，HC-P0~P2）。
 * HC-P0 实现开霸府；HC-P1-1/2 实现称王门槛、王号与状态转移；称帝留 HC-P2。
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
  kingdomNameCandidates: KingdomNameCandidate[];
  contestableCityCount: number;
  allPassed: boolean;
}

export interface KingdomNameCandidate {
  name: string;
  source: 'scenario' | 'geography' | 'faction';
  available: boolean;
}

const PROVINCE_KINGDOM_NAMES: Record<string, string[]> = {
  司隶: ['雒', '河南'],
  豫州: ['豫', '陈'],
  冀州: ['冀', '赵'],
  兖州: ['兖', '魏'],
  徐州: ['徐', '彭城'],
  青州: ['齐', '青'],
  荆州: ['楚', '荆'],
  扬州: ['吴', '越'],
  益州: ['蜀', '汉中'],
  凉州: ['凉', '西凉'],
  并州: ['晋', '并'],
  幽州: ['燕', '幽'],
  交州: ['越', '交'],
};

function isKingdomNameUsed(state: GameState, factionId: number, name: string): boolean {
  return Object.values(state.factions).some(
    (other) => other.id !== factionId && other.isAlive && other.kingdomName === name,
  );
}

/** K4：剧本策划配置 → 称王时首都地理 → 势力名去后缀，去重后形成有限候选。 */
export function getKingdomNameCandidates(
  state: GameState,
  factionId: number,
): KingdomNameCandidate[] {
  const scenario = staticData.scenarios.find((candidate) => candidate.id === state.scenarioId);
  if (!scenario) throw new Error(`剧本 ${state.scenarioId} 不存在`);
  const faction = state.factions[factionId];
  if (!faction) return [];

  const setup = scenario.factionSetups.find((candidate) => candidate.id === factionId);
  const capital = state.cities[faction.capitalCityId];
  const raw: Array<{ name: string; source: KingdomNameCandidate['source'] }> = [];
  if (setup?.preferredKingdomName) {
    raw.push({ name: setup.preferredKingdomName, source: 'scenario' });
  }
  for (const name of PROVINCE_KINGDOM_NAMES[capital?.province ?? ''] ?? []) {
    raw.push({ name, source: 'geography' });
  }
  const factionFallback = faction.name.replace(/(?:义兵|河内军|鲁阳军|政权|势力|军)$/u, '');
  if (factionFallback) raw.push({ name: factionFallback, source: 'faction' });

  const seen = new Set<string>();
  return raw
    .filter(({ name }) => name.length > 0 && name.length <= 4 && !seen.has(name) && seen.add(name))
    .map(({ name, source }) => ({
      name,
      source,
      available: !isKingdomNameUsed(state, factionId, name),
    }));
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
    kingdomNameCandidates: getKingdomNameCandidates(state, factionId),
    contestableCityCount,
    allPassed: checks.every((requirement) => requirement.passed),
  };
}

/**
 * HC-P1-2 称王权威状态转移。
 *
 * 所有校验先于克隆和写入完成；任一失败均返回异常且不修改输入快照。
 * 不要求继续控制汉帝。王号只允许从当前剧本/地理生成的有限候选中选择。
 */
export function proclaimKing(
  state: GameState,
  factionId: number,
  kingdomName: string,
): GameState {
  const requirements = getKingRequirements(state, factionId);
  const faction = state.factions[factionId];
  if (!requirements.factionExists.passed || !faction) throw new Error('势力不存在');
  if (!requirements.factionAlive.passed) throw new Error('势力已灭亡，无法称王');
  if (!requirements.politicalStage.passed) {
    const stage = faction.politicalStage ?? 'vassal';
    if (stage === 'vassal') throw new Error('尚未开霸府，不可跳级称王');
    throw new Error(stage === 'king' ? '已经称王，不可重复提交' : '已经称帝，不可重复称王');
  }
  if (!requirements.cityCount.passed) {
    throw new Error(
      `城池不足（需 ${requirements.cityCount.threshold}，当前 ${requirements.cityCount.current}）`,
    );
  }
  if (!requirements.politicalStageAgeMonths.passed) {
    throw new Error(
      `霸府沉淀不足（需 ${requirements.politicalStageAgeMonths.threshold} 月，当前 ${requirements.politicalStageAgeMonths.current} 月）`,
    );
  }
  if (!requirements.imperialAuthority.passed) {
    throw new Error(
      `皇权点数不足（需 ${requirements.imperialAuthority.threshold}，当前 ${requirements.imperialAuthority.current}）`,
    );
  }

  const candidate = requirements.kingdomNameCandidates.find(({ name }) => name === kingdomName);
  if (!candidate) throw new Error('王号不合法，请从剧本提供的有限候选中选择');
  if (!candidate.available) {
    const alternative = requirements.kingdomNameCandidates.find(({ available }) => available);
    const suffix = alternative ? `；可选候选号「${alternative.name}」` : '；当前无可用候选';
    throw new Error(`王号「${kingdomName}」已被其他存活势力占用${suffix}`);
  }

  const authority = faction.imperialAuthority ?? 0;
  const factions = {
    ...state.factions,
    [factionId]: {
      ...faction,
      imperialAuthority: authority - KING_IMPERIAL_AUTHORITY_REQUIRED,
      politicalStage: 'king' as PoliticalStage,
      politicalTitle: `${kingdomName}王`,
      kingdomName,
      politicalStageChangedYear: state.currentYear,
      politicalStageAgeMonths: 0,
    },
  };
  return pushLog(
    state,
    'king_proclaimed',
    `${faction.name}称${kingdomName}王（领有${requirements.cityCount.current}城，皇权-${KING_IMPERIAL_AUTHORITY_REQUIRED}）`,
    { factions },
  );
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
