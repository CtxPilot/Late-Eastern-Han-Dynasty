// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * R5 持续内政引擎
 * 征兵扣成年男；与人口结构/粮耗挂钩
 * 宫廷人脉地方结交见 engine/beauty.ts（S09；旧文件名兼容）
 */
import {
  ensureDemographics,
  maxConscriptable,
  withSyncedPopulation,
  meritEffects,
  meritLevelFor,
  type City,
  type DevelopmentProject,
  type DevelopmentProjectKind,
  type GameState,
} from '@leh/shared';
import { grantMeritTo } from './meritGrant.js';

export type DevelopKind = DevelopmentProjectKind;

// 功绩获取数值（docs/04 §6.1 内政条；固定值不消耗权威 RNG，待平衡）
const MERIT_DEVELOP_START = 4;
const MERIT_CONSCRIPT = 3;
const MERIT_RELIEF = 3;
const MERIT_TRAIN = 3;

export const DEVELOPMENT_PROJECTS: Record<
  DevelopKind,
  { totalGoldCost: number; label: string; stat: DevelopKind; totalMonths: number; gain: number }
> = {
  farm: { totalGoldCost: 300, label: '农业', stat: 'farm', totalMonths: 9, gain: 100 },
  commerce: { totalGoldCost: 400, label: '商业', stat: 'commerce', totalMonths: 6, gain: 100 },
  wall: { totalGoldCost: 500, label: '城防', stat: 'wall', totalMonths: 12, gain: 100 },
};

function requirePlayerCity(state: GameState, cityId: number): City {
  const city = state.cities[cityId];
  if (!city) throw new Error('城市不存在');
  if (city.ruler !== state.playerFactionId) throw new Error('非己方城市');
  return city;
}

function pushLog(
  state: GameState,
  type: string,
  message: string,
  patch: Partial<Pick<GameState, 'cities' | 'females' | 'officers'>> = {},
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

/** 启动农业 / 商业 / 城防持续项目；首付总成本 1/3。 */
export function developCity(
  state: GameState,
  cityId: number,
  kind: DevelopKind,
  assignedOfficerId: number,
): GameState {
  const conf = DEVELOPMENT_PROJECTS[kind];
  if (!conf) throw new Error('未知开发类型');
  const city = requirePlayerCity(state, cityId);
  if (city.activeDevelopment) throw new Error('该城已有持续开发项目');
  const officer = state.officers[assignedOfficerId];
  if (!officer || officer.faction !== state.playerFactionId || officer.location !== cityId) {
    throw new Error('指派武将不在本城或不属己方');
  }
  if (officer.status !== 'active') throw new Error('指派武将当前不可执行内政');
  const initialCost = Math.ceil(conf.totalGoldCost / 3);
  if (city.gold < initialCost) throw new Error('金钱不足');
  const project: DevelopmentProject = {
    kind,
    assignedOfficerId,
    totalMonths: conf.totalMonths,
    remainingMonths: conf.totalMonths,
    totalGoldCost: conf.totalGoldCost,
    goldPaid: initialCost,
    pausedMonths: 0,
    progressLostMonths: 0,
    status: 'active',
  };
  const nextCity: City = {
    ...city,
    gold: city.gold - initialCost,
    activeDevelopment: project,
  };

  return pushLog(
    grantMeritTo(state, assignedOfficerId, MERIT_DEVELOP_START),
    `development_start_${kind}`,
    `${city.name} 启动${conf.label}持续开发（${conf.totalMonths}个月，首付${initialCost}金）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}

/** 兼容旧 API */
export function developFarm(state: GameState, cityId: number, assignedOfficerId: number): GameState {
  return developCity(state, cityId, 'farm', assignedOfficerId);
}

function monthlyInstallment(project: DevelopmentProject): number {
  const monthsAfterThis = Math.max(0, project.remainingMonths - 1);
  return Math.ceil((project.totalGoldCost - project.goldPaid) / Math.max(1, monthsAfterThis + 1));
}

/** 城主内政效率加成（等级表 文 Lv6/9 内政+10%，Session 265 数值消费） */
function civilEfficiencyOf(state: GameState, city: City): number {
  const lord = state.officers[city.officers[0]];
  if (!lord) return 0;
  return meritEffects(meritLevelFor(lord.merit ?? 0), lord.meritPath ?? 'neutral').civilEfficiency;
}

/** 每月推进一个城市项目；资源或人员条件不满足即暂停并应用中断损失。 */
export function tickDevelopmentProject(state: GameState, city: City): { city: City; note?: string } {
  const project = city.activeDevelopment;
  if (!project) return { city };
  const officer = state.officers[project.assignedOfficerId];
  const isDeployed = state.campaignArmies.some((army) =>
    army.commanderId === project.assignedOfficerId
    || army.subCommanderIds.includes(project.assignedOfficerId)
    || army.advisorId === project.assignedOfficerId
    || army.subAdvisorId === project.assignedOfficerId);
  const officerAvailable =
    officer?.faction === city.ruler
    && officer.location === city.id
    && officer.status === 'active'
    && !isDeployed;
  const installment = monthlyInstallment(project);
  const canPay = city.gold >= installment;
  if (!officerAvailable || !canPay) {
    const pausedMonths = project.pausedMonths + 1;
    let remainingMonths = project.remainingMonths;
    let progressLostMonths = project.progressLostMonths;
    if (pausedMonths === 3) {
      const completed = project.totalMonths - remainingMonths;
      const lost = Math.min(completed, Math.max(1, Math.ceil(completed * 0.25)));
      remainingMonths += lost;
      progressLostMonths += lost;
    } else if (pausedMonths > 3) {
      const completed = project.totalMonths - remainingMonths;
      if (completed > 0) {
        remainingMonths += 1;
        progressLostMonths += 1;
      }
    }
    return {
      city: {
        ...city,
        activeDevelopment: {
          ...project,
          status: 'paused',
          pausedMonths,
          remainingMonths: Math.min(project.totalMonths, remainingMonths),
          progressLostMonths,
        },
      },
      note: `${city.name}${DEVELOPMENT_PROJECTS[project.kind].label}项目暂停（${!officerAvailable ? '人员不可用' : '月费不足'}）`,
    };
  }
  const remainingMonths = project.remainingMonths - 1;
  const goldPaid = project.goldPaid + installment;
  if (remainingMonths > 0) {
    return {
      city: {
        ...city,
        gold: city.gold - installment,
        activeDevelopment: { ...project, remainingMonths, goldPaid, pausedMonths: 0, status: 'active' },
      },
    };
  }
  const conf = DEVELOPMENT_PROJECTS[project.kind];
  // 开发效率加成（等级表 文 Lv3/4 开发+5%/+10%，Session 265：指派将执行）
  let gain = conf.gain;
  const assignee = state.officers[project.assignedOfficerId];
  if (assignee) {
    const developBonus = meritEffects(
      meritLevelFor(assignee.merit ?? 0),
      assignee.meritPath ?? 'neutral',
    ).developBonus;
    if (developBonus > 0) gain = Math.floor(conf.gain * (1 + developBonus));
  }
  return {
    city: {
      ...city,
      gold: city.gold - installment,
      stats: { ...city.stats, [conf.stat]: Math.min(999, city.stats[conf.stat] + gain) },
      activeDevelopment: undefined,
    },
    note: `${city.name}${conf.label}持续开发完成，${conf.label}+${gain}`,
  };
}

/**
 * 征兵：耗金+粮；兵力来自成年男（可征上限）
 * 80 金 + 120 粮 → 尝试征 300~450+bonus，不超过可征男丁
 */
export function conscript(state: GameState, cityId: number, rng: () => number): GameState {
  const city = requirePlayerCity(state, cityId);
  const goldCost = 80;
  const foodCost = 120;
  if (city.gold < goldCost) throw new Error('金钱不足');
  if (city.food < foodCost) throw new Error('粮食不足');

  const d = ensureDemographics(city);
  const maxMen = maxConscriptable(d);
  if (maxMen < 50) throw new Error('成年男丁不足（需保留劳作人口）');

  const troopsGain = 300 + Math.floor(rng() * 151);
  const bonus = Math.floor(city.stats.farm / 50) + Math.floor((city.stats.morale ?? 70) / 40);
  // 内政效率加成（城主功绩，Session 265；不消耗 RNG）
  const want = Math.floor((troopsGain + bonus * 10) * (1 + civilEfficiencyOf(state, city)));
  const total = Math.min(want, maxMen);

  const nextDemo = { ...d, adultMale: d.adultMale - total };
  const base: City = {
    ...city,
    gold: city.gold - goldCost,
    food: city.food - foodCost,
    troops: city.troops + total,
    demographics: nextDemo,
    population: city.population,
    stats: {
      ...city.stats,
      morale: Math.max(0, (city.stats.morale ?? 70) - 2),
    },
  };
  const nextCity = withSyncedPopulation(base, nextDemo);

  return pushLog(
    grantMeritTo(state, nextCity.officers[0], MERIT_CONSCRIPT),
    'conscript',
    `${city.name} 征兵 +${total}（扣男成${total}，可征余${maxMen - total}；${goldCost}金/${foodCost}粮）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}

/**
 * 施米：耗粮，提民心（morale）
 */
export function relief(state: GameState, cityId: number, rng: () => number): GameState {
  const city = requirePlayerCity(state, cityId);
  const foodCost = 150;
  if (city.food < foodCost) throw new Error('粮食不足');

  const gain = Math.floor((8 + Math.floor(rng() * 5)) * (1 + civilEfficiencyOf(state, city)));
  const prev = city.stats.morale ?? 70;
  const nextMorale = Math.min(100, prev + gain);

  const nextCity: City = {
    ...city,
    food: city.food - foodCost,
    stats: { ...city.stats, morale: nextMorale },
  };

  return pushLog(
    grantMeritTo(state, nextCity.officers[0], MERIT_RELIEF),
    'relief',
    `${city.name} 施米安民 民心+${gain}（${prev}→${nextMorale}，耗粮${foodCost}）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}

/**
 * 训练：耗粮，略提士气（troopsMorale）
 */
export function trainTroops(state: GameState, cityId: number, rng: () => number): GameState {
  const city = requirePlayerCity(state, cityId);
  const foodCost = 60;
  if (city.food < foodCost) throw new Error('粮食不足');
  if (city.troops < 100) throw new Error('兵力不足，无法训练');

  const gain = Math.floor((5 + Math.floor(rng() * 6)) * (1 + civilEfficiencyOf(state, city)));
  const prev = city.troopsMorale ?? 70;
  const next = Math.min(100, prev + gain);

  const nextCity: City = {
    ...city,
    food: city.food - foodCost,
    troopsMorale: next,
  };

  return pushLog(
    grantMeritTo(state, nextCity.officers[0], MERIT_TRAIN),
    'train',
    `${city.name} 训练部队 士气+${gain}（${prev}→${next}，耗粮${foodCost}）`,
    { cities: { ...state.cities, [cityId]: nextCity } },
  );
}
