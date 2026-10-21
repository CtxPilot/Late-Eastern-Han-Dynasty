// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * S03 技艺与制度研发权威引擎（Tech / Craft R&D Engine）。
 *
 * 依据 docs/04 §34.6 与 docs/51-s03-craft-research-and-sanitation-proposal.md。
 * 纯函数确定性推演，零 RNG 消费。
 */
import {
  type ActiveResearch,
  type AvailableTechResearchResult,
  type GameState,
  type TechBranch,
  type TechBranchOption,
  type TechLevels,
  TECH_BRANCHES,
  TECH_BRANCH_CONFIGS,
  getTechInitialGoldCost,
  getTechTierInfo,
  safeTechLevels,
} from '@leh/shared';

export type { AvailableTechResearchResult, TechBranchOption };

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

/** 获取本势力全境最高城池文化（声教吸引与技术研发门槛） */
export function getFactionHighestCulture(state: GameState, factionId: number): number {
  let max = 0;
  for (const c of Object.values(state.cities)) {
    if (c.ruler === factionId) {
      const val = c.stats.culture ?? 0;
      if (val > max) max = val;
    }
  }
  return max;
}

/** 查询势力当前技艺研发可用性与全部路线进度 */
export function getAvailableTechResearch(
  state: GameState,
  factionId: number,
): AvailableTechResearchResult {
  const faction = state.factions[factionId];
  if (!faction) throw new Error('势力不存在');

  const levels = safeTechLevels(faction.techLevels);
  const highestCulture = getFactionHighestCulture(state, factionId);
  const hasActiveResearch = faction.activeResearch != null;

  const branches = {} as Record<TechBranch, TechBranchOption>;

  for (const b of TECH_BRANCHES) {
    const conf = TECH_BRANCH_CONFIGS[b];
    const curLevel = levels[b];
    const nextTier = curLevel < 5 ? getTechTierInfo(b, curLevel + 1) : null;
    const initialCost = nextTier ? getTechInitialGoldCost(b, curLevel + 1) : 0;
    const culturePassed = nextTier ? highestCulture >= nextTier.cultureThreshold : false;
    const goldPassed = nextTier ? faction.gold >= initialCost : false;
    const canResearch = !hasActiveResearch && nextTier != null && culturePassed && goldPassed;

    branches[b] = {
      branch: b,
      name: conf.name,
      description: conf.description,
      currentLevel: curLevel,
      maxLevel: 5,
      nextTier,
      culturePassed,
      highestCulture,
      goldPassed,
      initialGoldCost: initialCost,
      canResearch,
    };
  }

  // 可指派进行研发的学者/谋臣（本势力在职活跃武将）
  const eligibleOfficers = Object.values(state.officers)
    .filter((o) => o.faction === factionId && o.status === 'active')
    .map((o) => ({
      id: o.id,
      name: o.name,
      intelligence: o.stats.intelligence,
      politics: o.stats.politics,
    }))
    .sort((a, b) => b.intelligence + b.politics - (a.intelligence + a.politics));

  return {
    factionId,
    branches,
    activeResearch: faction.activeResearch ?? null,
    highestCulture,
    factionGold: faction.gold,
    hasActiveResearch,
    eligibleOfficers,
  };
}

/** 启动一项技艺研发 */
export function startTechResearch(
  state: GameState,
  factionId: number,
  branch: TechBranch,
  assignedOfficerId: number,
): GameState {
  const faction = state.factions[factionId];
  if (!faction) throw new Error('势力不存在');
  if (!faction.isAlive) throw new Error('势力已灭亡');
  if (faction.activeResearch != null) throw new Error('已有正在进行的技艺研发项目');

  const levels = safeTechLevels(faction.techLevels);
  const curLevel = levels[branch];
  if (curLevel >= 5) throw new Error('该路线已达最高技术等级（Lv5）');

  const targetLevel = curLevel + 1;
  const tier = getTechTierInfo(branch, targetLevel);
  if (!tier) throw new Error('无效的研发等级目标');

  const highestCulture = getFactionHighestCulture(state, factionId);
  if (highestCulture < tier.cultureThreshold) {
    throw new Error(`领内最高文化不足（需 ${tier.cultureThreshold}，当前最高 ${highestCulture}）`);
  }

  // 工商 Lv4 减免 15% 研发与开发成本
  const discountMul = levels.commerce >= 4 ? 0.85 : 1.0;
  const effectiveTotalGoldCost = Math.floor(tier.goldCost * discountMul);
  const initialCost = Math.ceil(effectiveTotalGoldCost / 3);

  if (faction.gold < initialCost) {
    throw new Error(`势力资金不足，无法支付首付（需 ${initialCost} 金，当前余量 ${faction.gold}）`);
  }

  const officer = state.officers[assignedOfficerId];
  if (!officer || officer.faction !== factionId || officer.status !== 'active') {
    throw new Error('指派学者不可用或非本势力在职武将');
  }

  const activeResearch: ActiveResearch = {
    branch,
    targetLevel,
    assignedOfficerId,
    totalMonths: tier.months,
    remainingMonths: tier.months,
    totalGoldCost: effectiveTotalGoldCost,
    goldPaid: initialCost,
  };

  const nextFaction = {
    ...faction,
    gold: faction.gold - initialCost,
    activeResearch,
  };

  const branchConf = TECH_BRANCH_CONFIGS[branch];
  return pushLog(
    state,
    'tech_research_started',
    `${faction.name}立项研习「${branchConf.name}·${tier.name}」（目标Lv${targetLevel}，工期${tier.months}月，首付${initialCost}金，主研：${officer.name}）`,
    {
      factions: {
        ...state.factions,
        [factionId]: nextFaction,
      },
    },
  );
}

/** 中止正在进行的技艺研发 */
export function cancelTechResearch(state: GameState, factionId: number): GameState {
  const faction = state.factions[factionId];
  if (!faction || !faction.activeResearch) throw new Error('当前无进行中的技艺研发项目');

  const branchConf = TECH_BRANCH_CONFIGS[faction.activeResearch.branch];
  const nextFaction = {
    ...faction,
    activeResearch: undefined,
  };

  return pushLog(
    state,
    'tech_research_cancelled',
    `${faction.name}中止了「${branchConf.name}」的技艺研习`,
    {
      factions: {
        ...state.factions,
        [factionId]: nextFaction,
      },
    },
  );
}

/** 每月推进所有势力的技艺研发进度 */
export function tickTechResearch(state: GameState): GameState {
  let nextFactions = state.factions;
  let nextState = state;

  for (const [fidStr, faction] of Object.entries(state.factions)) {
    const fid = Number(fidStr);
    if (!faction || !faction.isAlive || !faction.activeResearch) continue;

    const research = faction.activeResearch;
    const assignee = state.officers[research.assignedOfficerId];

    // 指派学者失效（阵亡/被俘/叛逃）则暂停，不推进工期
    if (!assignee || assignee.faction !== fid || assignee.status !== 'active') {
      continue;
    }

    // 计算月度续缴款项
    const remainingInstallments = Math.max(1, research.remainingMonths);
    const dueGold = Math.min(
      faction.gold,
      Math.ceil((research.totalGoldCost - research.goldPaid) / remainingInstallments),
    );

    // 钱不够续缴则暂停推进
    if (faction.gold < dueGold && dueGold > 0) {
      continue;
    }

    const nextGold = faction.gold - dueGold;
    const nextGoldPaid = research.goldPaid + dueGold;
    const nextRemainingMonths = research.remainingMonths - 1;

    if (nextRemainingMonths <= 0) {
      // 研发圆满完成！
      const currentLevels = safeTechLevels(faction.techLevels);
      const nextLevels: TechLevels = {
        ...currentLevels,
        [research.branch]: research.targetLevel,
      };

      const updatedFaction = {
        ...faction,
        gold: nextGold,
        techLevels: nextLevels,
        activeResearch: undefined,
      };

      nextFactions = {
        ...nextFactions,
        [fid]: updatedFaction,
      };

      const branchConf = TECH_BRANCH_CONFIGS[research.branch];
      const tier = getTechTierInfo(research.branch, research.targetLevel);
      nextState = pushLog(
        { ...nextState, factions: nextFactions },
        'tech_researched',
        `【技艺革新】${faction.name}成功研习「${branchConf.name}·${tier?.name ?? `Lv${research.targetLevel}`}」，${tier?.effect ?? ''}！`,
      );
      nextFactions = nextState.factions;
    } else {
      // 继续推进
      const updatedResearch: ActiveResearch = {
        ...research,
        remainingMonths: nextRemainingMonths,
        goldPaid: nextGoldPaid,
      };

      nextFactions = {
        ...nextFactions,
        [fid]: {
          ...faction,
          gold: nextGold,
          activeResearch: updatedResearch,
        },
      };
    }
  }

  return {
    ...nextState,
    factions: nextFactions,
  };
}
