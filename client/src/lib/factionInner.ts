// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import type { Officer } from '@leh/shared';

/**
 * S20-W4: 势力内部派系判定纯函数
 *
 * 参照体系：
 * - docs/04-game-systems.md §4.5.2 派系系统
 * - docs/07-ui-design.md §11.1 派系面板落地方案
 *
 * 规则：
 * 1. 按 officer.tags 社会出身分类：士族、豪强、寒门、平民、宗室、边地；
 * 2. 门槛：豪强 ≥ 2 人，其余 ≥ 3 人成派；未达门槛武将归为散员（unaligned）；
 * 3. 领袖：该派系内官职权重 + 功绩 + 属性最高者为派系领袖；
 * 4. 派系效果文言、平均忠诚与整体势力凝聚力评估。
 */

export type FactionOrigin =
  | 'royal'    // 宗室
  | 'gentry'   // 士族
  | 'magnate'  // 豪强
  | 'humble'   // 寒门
  | 'frontier' // 边地
  | 'commoner';// 平民

export interface FactionParty {
  origin: FactionOrigin;
  name: string;
  tagLabel: string;
  color: string;
  badgeClass: string;
  borderClass: string;
  leader: Officer;
  members: Officer[];
  memberCount: number;
  averageLoyalty: number;
  description: string;
}

export interface FactionInnerReport {
  factionId: number;
  parties: FactionParty[];
  unalignedOfficers: Officer[];
  unalignedCount: number;
  totalOfficers: number;
  dominantParty: FactionParty | null;
  cohesionScore: number; // 0 ~ 100
  cohesionLevel: '上和' | '中洽' | '涣散' | '分裂';
}

const ORIGIN_CONFIG: Record<
  FactionOrigin,
  {
    name: string;
    tagLabel: string;
    color: string;
    badgeClass: string;
    borderClass: string;
    minMembers: number;
    description: string;
  }
> = {
  royal: {
    name: '宗室派',
    tagLabel: '宗室',
    color: '#e11d48',
    badgeClass: 'bg-rose-950/70 border-rose-800 text-rose-300',
    borderClass: 'border-rose-800/60',
    minMembers: 3,
    description: '汉家宗室皇族血脉，自矜帝胄，重国统正统与天下民望。',
  },
  gentry: {
    name: '士族派',
    tagLabel: '士族',
    color: '#a855f7',
    badgeClass: 'bg-purple-950/70 border-purple-800 text-purple-300',
    borderClass: 'border-purple-800/60',
    minMembers: 3,
    description: '天下世家经学门阀，文才清望，深植郡县乡评与政务治理。',
  },
  magnate: {
    name: '豪强派',
    tagLabel: '豪强',
    color: '#f59e0b',
    badgeClass: 'bg-amber-950/70 border-amber-800 text-amber-300',
    borderClass: 'border-amber-800/60',
    minMembers: 2, // §4.5.2 豪强 >= 2 即成派
    description: '地方豪强坞堡庄园，部曲骁勇，谙熟漕运私兵与钱粮输纳。',
  },
  humble: {
    name: '寒门派',
    tagLabel: '寒门',
    color: '#38bdf8',
    badgeClass: 'bg-sky-950/70 border-sky-800 text-sky-300',
    borderClass: 'border-sky-800/60',
    minMembers: 3,
    description: '出身孤微素履实干，尚智谋机变，不尚清谈而务实功军烈。',
  },
  frontier: {
    name: '边地派',
    tagLabel: '边地',
    color: '#10b981',
    badgeClass: 'bg-emerald-950/70 border-emerald-800 text-emerald-300',
    borderClass: 'border-emerald-800/60',
    minMembers: 3,
    description: '塞外边陲雄鸷之士，弓马娴熟，耐苦战冲阵与铁骑突击。',
  },
  commoner: {
    name: '平民派',
    tagLabel: '平民',
    color: '#78716c',
    badgeClass: 'bg-stone-900 border-stone-700 text-stone-300',
    borderClass: 'border-stone-700/60',
    minMembers: 3,
    description: '乡井草莽布衣出身，勤勉忠谨，为官府基层吏治与军资支柱。',
  },
};

/**
 * 识别武将出身分类
 */
export function detectOfficerOrigin(officer: Officer): FactionOrigin {
  const tags = officer.tags ?? [];

  if (tags.some((t) => t === '宗室' || t === '汉室' || t === '皇族')) {
    return 'royal';
  }
  if (tags.some((t) => t === '边地' || t === '异族' || t === '胡人' || t === '西凉' || t === '南蛮')) {
    return 'frontier';
  }
  if (tags.some((t) => t === '士族' || t === '名士' || t === '名门' || t === '望族')) {
    return 'gentry';
  }
  if (tags.some((t) => t === '豪强' || t === '豪族')) {
    return 'magnate';
  }
  if (tags.some((t) => t === '寒门')) {
    return 'humble';
  }
  return 'commoner';
}

/**
 * 计算武将领袖评定权重（官职 > 功绩 > 五维声望）
 */
export function calculateOfficerWeight(officer: Officer): number {
  let score = 0;

  // 霸府/朝职轨 (权重极高)
  if (officer.hegemonyPosition && String(officer.hegemonyPosition) !== 'none') {
    score += 1000;
  }

  // 文官轨
  const civilMap: Record<string, number> = {
    chancellor: 900,
    governor: 800,
    prefect: 600,
    magistrate: 400,
    clerk: 200,
  };
  score += civilMap[String(officer.civilPosition)] ?? 0;

  // 武官轨
  const militaryMap: Record<string, number> = {
    grand_general: 900,
    general: 700,
    colonel: 500,
    captain: 300,
  };
  score += militaryMap[String(officer.militaryPosition)] ?? 0;

  // 地方轨
  const localMap: Record<string, number> = {
    advisor: 850,
    prefect: 650,
    intendant: 400,
  };
  score += localMap[String(officer.localPosition)] ?? 0;

  // 功绩
  score += (officer.merit ?? 0) * 0.1;

  // 属性五维
  const stats = officer.stats ?? {
    leadership: 50,
    war: 50,
    intelligence: 50,
    politics: 50,
    charisma: 50,
  };
  const statSum =
    (stats.leadership ?? 50) +
    (stats.war ?? 50) +
    (stats.intelligence ?? 50) +
    (stats.politics ?? 50) +
    (stats.charisma ?? 50);
  score += statSum;

  return score;
}

/**
 * 派生指定势力的内部派系分布报告
 */
export function deriveFactionParties(
  officers: Record<number, Officer> | Officer[],
  targetFactionId: number,
): FactionInnerReport {
  const officerList = Array.isArray(officers) ? officers : Object.values(officers);
  const factionOfficers = officerList.filter(
    (o) => o && o.faction === targetFactionId && o.status === 'active',
  );

  const groups: Record<FactionOrigin, Officer[]> = {
    royal: [],
    gentry: [],
    magnate: [],
    humble: [],
    frontier: [],
    commoner: [],
  };

  for (const officer of factionOfficers) {
    const origin = detectOfficerOrigin(officer);
    groups[origin].push(officer);
  }

  const parties: FactionParty[] = [];
  const unalignedOfficers: Officer[] = [];

  for (const [key, list] of Object.entries(groups) as [FactionOrigin, Officer[]][]) {
    const cfg = ORIGIN_CONFIG[key];
    if (list.length >= cfg.minMembers) {
      // 依权重降序排列，首位为领袖
      const sorted = [...list].sort((a, b) => calculateOfficerWeight(b) - calculateOfficerWeight(a));
      const leader = sorted[0];
      const avgLoyalty = Math.round(
        list.reduce((acc, curr) => acc + (curr.loyalty ?? 100), 0) / list.length,
      );

      parties.push({
        origin: key,
        name: cfg.name,
        tagLabel: cfg.tagLabel,
        color: cfg.color,
        badgeClass: cfg.badgeClass,
        borderClass: cfg.borderClass,
        leader,
        members: sorted,
        memberCount: sorted.length,
        averageLoyalty: avgLoyalty,
        description: cfg.description,
      });
    } else {
      unalignedOfficers.push(...list);
    }
  }

  // 派系按成员数量降序排序
  parties.sort((a, b) => b.memberCount - a.memberCount);

  const dominantParty = parties[0] ?? null;
  const totalOfficers = factionOfficers.length;

  // 凝聚力测算：
  // 基线 100
  // 每多一个并立派系扣 8 分（派系林立导致内耗）
  // 主导派系占比提高凝聚力（强力主导）
  // 平均忠诚度偏离 70 加减分
  let cohesion = 100;
  if (parties.length > 1) {
    cohesion -= (parties.length - 1) * 8;
  }
  if (dominantParty && totalOfficers > 0) {
    const dominantRatio = dominantParty.memberCount / totalOfficers;
    cohesion += Math.round((dominantRatio - 0.4) * 25);
  }
  if (totalOfficers > 0) {
    const overallAvgLoyalty =
      factionOfficers.reduce((acc, curr) => acc + (curr.loyalty ?? 100), 0) / totalOfficers;
    cohesion += Math.round((overallAvgLoyalty - 70) * 0.4);
  }

  const cohesionScore = Math.max(0, Math.min(100, cohesion));
  let cohesionLevel: FactionInnerReport['cohesionLevel'] = '上和';
  if (cohesionScore >= 80) {
    cohesionLevel = '上和';
  } else if (cohesionScore >= 60) {
    cohesionLevel = '中洽';
  } else if (cohesionScore >= 40) {
    cohesionLevel = '涣散';
  } else {
    cohesionLevel = '分裂';
  }

  return {
    factionId: targetFactionId,
    parties,
    unalignedOfficers,
    unalignedCount: unalignedOfficers.length,
    totalOfficers,
    dominantParty,
    cohesionScore,
    cohesionLevel,
  };
}
