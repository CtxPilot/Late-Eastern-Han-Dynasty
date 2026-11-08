// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-03：天下大势演进与九品中正制门阀政治
 *
 * 1. 天下大势（GeneralTrendStage）：
 *    群雄割据（190~199）→ 中原争霸（200~207）→ 三分鼎立（208~219）→
 *    三国对峙（220~264）→ 九州归一（265+）
 *
 * 2. 九品中正制（Nine-Rank System）：
 *    魏黄初/延康元年陈群立九品官人法，中正定品（一品至九品，1 品最高 9 品最低）。
 *    门阀世家（名门士族）天然占优起评高阶，寒门将领依仗卓越才德与功绩拔擢突破。
 */

import { GeneralTrendStage, type GameState } from './types/game.js';
import type { Officer } from './types/officer.js';
import { meritLevelFor } from './merit.js';

export { GeneralTrendStage };

export interface TrendStageMeta {
  stage: GeneralTrendStage;
  name: string;
  label: string;
  period: string;
  description: string;
}

export const TREND_STAGE_INFO: Record<GeneralTrendStage, TrendStageMeta> = {
  [GeneralTrendStage.WARLORDS_DISORDER]: {
    stage: GeneralTrendStage.WARLORDS_DISORDER,
    name: '群雄割据',
    label: '群雄割据',
    period: '190~199',
    description: '董卓乱京，关东诸侯起兵，海内震荡，群雄割据四方。',
  },
  [GeneralTrendStage.HEGEMONY_CONTEST]: {
    stage: GeneralTrendStage.HEGEMONY_CONTEST,
    name: '中原争霸',
    label: '中原争霸',
    period: '200~207',
    description: '官渡战起，袁曹决胜中原，四方豪杰各谋霸业。',
  },
  [GeneralTrendStage.THREE_KINGDOMS_FORMING]: {
    stage: GeneralTrendStage.THREE_KINGDOMS_FORMING,
    name: '三分鼎立',
    label: '三分鼎立',
    period: '208~219',
    description: '赤壁烽火，荆益鼎足，天下三分之势初成。',
  },
  [GeneralTrendStage.THREE_KINGDOMS_RIVALRY]: {
    stage: GeneralTrendStage.THREE_KINGDOMS_RIVALRY,
    name: '三国对峙',
    label: '三国对峙',
    period: '220~264',
    description: '魏蜀吴相继称尊建号，九品官人，北伐东征，对峙甲子。',
  },
  [GeneralTrendStage.UNIFICATION_CLIMAX]: {
    stage: GeneralTrendStage.UNIFICATION_CLIMAX,
    name: '九州归一',
    label: '九州归一',
    period: '265+',
    description: '三家归晋，海内混一，天下大势分久必合。',
  },
};

/**
 * 根据年份及当前游戏格局推导天下大势阶段。
 * - 兼顾历史编年与游戏进程动态演进：
 *   - 当存活领地势力仅剩 1 家或全图统一时，大势自然提前步入九州归一；
 *   - 当已有两家及以上势力称帝时，大势保底处于三国对峙阶段；
 *   - 默认根据当前年份标准区间演进。
 */
export function deriveTrendStage(year: number, state?: GameState): GeneralTrendStage {
  if (state) {
    // 检查是否已大一统
    const livingFactionsWithCities = Object.values(state.factions).filter(
      (f) => f.isAlive && f.cityIds && f.cityIds.length > 0,
    );
    if (livingFactionsWithCities.length <= 1 && Object.keys(state.cities).length > 0) {
      return GeneralTrendStage.UNIFICATION_CLIMAX;
    }

    // 检查是否已有多个称帝势力
    const emperorCount = Object.values(state.factions).filter(
      (f) => f.isAlive && f.politicalStage === 'emperor',
    ).length;
    if (emperorCount >= 2 && year >= 208) {
      return GeneralTrendStage.THREE_KINGDOMS_RIVALRY;
    }
  }

  if (year < 200) {
    return GeneralTrendStage.WARLORDS_DISORDER;
  }
  if (year < 208) {
    return GeneralTrendStage.HEGEMONY_CONTEST;
  }
  if (year < 220) {
    return GeneralTrendStage.THREE_KINGDOMS_FORMING;
  }
  if (year < 265) {
    return GeneralTrendStage.THREE_KINGDOMS_RIVALRY;
  }
  return GeneralTrendStage.UNIFICATION_CLIMAX;
}

/**
 * 获取当前 GameState 的天下大势（若 state 上已有显式 trendStage 则优先，否则由年份推导）。
 */
export function getTrendStage(state: GameState): GeneralTrendStage {
  return state.trendStage ?? deriveTrendStage(state.currentYear, state);
}

export function getTrendStageLabel(stage: GeneralTrendStage): string {
  return TREND_STAGE_INFO[stage]?.label ?? stage;
}

export function getTrendStageDescription(stage: GeneralTrendStage): string {
  return TREND_STAGE_INFO[stage]?.description ?? '';
}

/** 九品中正制法定品名称与代表官职 */
export const RANK_GRADE_LABELS: Record<number, string> = {
  1: '一品（极品·公卿辅政）',
  2: '二品（上卿·州牧大将）',
  3: '三品（中坚·刺史尚书）',
  4: '四品（藩屏·都督四征）',
  5: '五品（列曹·太守偏将）',
  6: '六品（郡佐·都尉杂号）',
  7: '七品（百里·县令校尉）',
  8: '八品（州郡·从事司马）',
  9: '九品（草创·书吏军候）',
};

export function rankGradeLabel(grade: number): string {
  return RANK_GRADE_LABELS[grade] ?? `${grade}品`;
}

/** 上品：一品至三品 */
export function isUpperRank(grade: number): boolean {
  return grade >= 1 && grade <= 3;
}

/** 中品：四品至六品 */
export function isMiddleRank(grade: number): boolean {
  return grade >= 4 && grade <= 6;
}

/** 下品：七品至九品 */
export function isLowerRank(grade: number): boolean {
  return grade >= 7 && grade <= 9;
}

/**
 * 考评武将中正品阶（evaluateOfficerRankGrade）：
 * 依据魏晋九品官人法法理：
 * 1. 家世门第（门阀）：
 *    - 名门/望族/皇室/宗亲/外戚：起家定品基准 3 品；
 *    - 士族：起家定品基准 4 品；
 *    - 豪族/将门：起家定品基准 6 品；
 *    - 寒门/平民/商贾/工匠：起家定品基准 8 品。
 * 2. 才德行能（属性）：
 *    - 单项极高（≥95）：拔擢 -2 品；
 *    - 单项拔尖（≥85）：拔擢 -1 品；
 *    - 平庸低劣（五维最高 < 50）：降格 +1 品。
 * 3. 德望与名士风评（标签）：
 *    - 德高望重/海内名士/清流/经学大师/天下楷模：-1 品。
 * 4. 朝野功绩（功绩等级）：
 *    - 功绩达到宿将重臣（Lv ≥ 15）：-2 品；
 *    - 功绩达到干练中坚（Lv ≥ 8）：-1 品。
 * 5. 门阀壁垒（上品无寒门，下品无势族）：
 *    - 寒门平民若无极高属性（maxStat < 95）且无极高功绩（Lv < 12），品阶受限不得入上品（保底 ≥ 4 品）；
 *    - 世家名门除属性极差（maxStat < 40）外，不得流按下品（保底 ≤ 6 品）。
 * 6. 一品极品门槛：
 *    - 仅限名门士族且具备卓越才德或极高功绩者。
 */
export function evaluateOfficerRankGrade(officer: Officer): number {
  const tags = officer.tags ?? [];

  const isHighNoble = tags.some((t) =>
    ['名门', '望族', '皇室', '汉室宗亲', '外戚'].includes(t),
  );
  const isNoble = isHighNoble || tags.some((t) => ['士族'].includes(t));
  const isMiddle = tags.some((t) => ['豪族', '将门'].includes(t));
  const isCommoner = !isNoble && !isMiddle;

  // 1. 家世门第基准品
  let baseGrade = 8;
  if (isHighNoble) {
    baseGrade = 3;
  } else if (isNoble) {
    baseGrade = 4;
  } else if (isMiddle) {
    baseGrade = 6;
  }

  // 2. 才德能力
  const stats = officer.stats;
  const maxStat = Math.max(
    stats.leadership,
    stats.war,
    stats.intelligence,
    stats.politics,
    stats.charisma,
  );

  if (maxStat >= 95) {
    baseGrade -= 2;
  } else if (maxStat >= 85) {
    baseGrade -= 1;
  } else if (maxStat < 50) {
    baseGrade += 1;
  }

  // 3. 德望声誉
  const hasPrestigiousReputation = tags.some((t) =>
    ['德高望重', '海内名士', '清流', '经学大师', '天下楷模'].includes(t),
  );
  if (hasPrestigiousReputation) {
    baseGrade -= 1;
  }

  // 4. 朝野功绩
  const meritLv = officer.meritLevel ?? meritLevelFor(officer.merit ?? 0);
  if (meritLv >= 16) {
    baseGrade -= 3;
  } else if (meritLv >= 12) {
    baseGrade -= 2;
  } else if (meritLv >= 6) {
    baseGrade -= 1;
  }

  // 5. 门阀壁垒
  if (isCommoner && maxStat < 95 && meritLv < 12) {
    // 上品无寒门
    baseGrade = Math.max(baseGrade, 4);
  } else if (isNoble && maxStat >= 40) {
    // 下品无势族
    baseGrade = Math.min(baseGrade, 6);
  }

  // 6. 一品门槛约束：一品为宰辅三公极品
  if (baseGrade < 1) {
    baseGrade = 1;
  }
  if (baseGrade === 1 && !isNoble && maxStat < 95 && meritLv < 16) {
    baseGrade = 2;
  }

  return Math.max(1, Math.min(9, Math.round(baseGrade)));
}

/**
 * 势力全员中正定品（COW 优化：仅品级产生变化的武将创建新引用）。
 */
export function evaluateFactionNineRanks(
  officers: Record<number, Officer>,
  factionId: number,
): Record<number, Officer> {
  let changed = false;
  const nextOfficers = { ...officers };

  for (const [idStr, officer] of Object.entries(officers)) {
    if (officer.faction !== factionId) continue;
    const grade = evaluateOfficerRankGrade(officer);
    if (officer.rankGrade !== grade) {
      changed = true;
      nextOfficers[Number(idStr)] = {
        ...officer,
        rankGrade: grade,
      };
    }
  }

  return changed ? nextOfficers : officers;
}
