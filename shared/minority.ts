// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-07 边疆异族羁縻、朝贡互市与寇边讨伐体系纯函数模型与规则真源
 */

import { Season } from './enums/index.js';
import type { City } from './types/city.js';
import type { Officer } from './types/officer.js';
import {
  MinorityTribeId,
  MinorityTribe,
  TribeThreatLevel,
} from './types/minority.js';

export { MinorityTribeId, MinorityTribe, TribeThreatLevel };

export const TRIBAL_PACIFY_COST_GOLD = 300; // 宣抚进贡经费（金）
export const TRIBAL_PACIFY_TENSION_REDUCTION = 25; // 宣抚降低紧张度点数
export const TRIBAL_SUBDUE_MONTHS = 24; // 讨平大捷威慑期（24个月）
export const TRIBAL_LEVY_BATCH_SIZE = 500; // 单次异族羁縻借兵兵力
export const TRIBAL_LEVY_COST_GOLD = 500; // 单次借兵军饷
export const TRIBAL_LEVY_TENSION_COST = 5; // 借兵轻微消耗张力点数

/**
 * 汉末六大边疆少数民族初始基准配置表（docs/04 §7.1）
 */
export const DEFAULT_MINORITY_TRIBES: Record<MinorityTribeId, MinorityTribe> = {
  xiongnu: {
    id: 'xiongnu',
    name: '匈奴',
    regionName: '并州北',
    relatedProvinces: ['并州', '凉州'],
    tension: 25,
    specialUnitName: '匈奴突骑',
    specialtyTribute: '战马',
    activeSeason: 'winter',
  },
  xianbei: {
    id: 'xianbei',
    name: '鲜卑',
    regionName: '幽州北',
    relatedProvinces: ['幽州', '冀州'],
    tension: 20,
    specialUnitName: '鲜卑突骑',
    specialtyTribute: '角弓',
    activeSeason: 'spring',
  },
  qiang: {
    id: 'qiang',
    name: '羌族',
    regionName: '凉州',
    relatedProvinces: ['凉州', '司隶'],
    tension: 30,
    specialUnitName: '羌族骑兵',
    specialtyTribute: '良马',
    activeSeason: 'summer',
  },
  di: {
    id: 'di',
    name: '氐族',
    regionName: '凉益交界',
    relatedProvinces: ['凉州', '益州'],
    tension: 20,
    specialUnitName: '氐族步兵',
    specialtyTribute: '药材',
    activeSeason: 'autumn',
  },
  shanyue: {
    id: 'shanyue',
    name: '山越',
    regionName: '扬州山地',
    relatedProvinces: ['扬州', '荆州'],
    tension: 35,
    specialUnitName: '山越精兵',
    specialtyTribute: '生铜',
    activeSeason: 'all',
  },
  nanman: {
    id: 'nanman',
    name: '南蛮',
    regionName: '益州南部',
    relatedProvinces: ['益州', '交州'],
    tension: 30,
    specialUnitName: '藤甲兵',
    specialtyTribute: '象牙',
    activeSeason: 'summer',
  },
};

/**
 * 将紧张度映射至 4 档边疆威胁等级（docs/04 §7.2）
 */
export function getTribeThreatLevel(tension: number): TribeThreatLevel {
  const clamped = Math.max(0, Math.min(100, Math.round(tension)));
  if (clamped < 30) {
    return TribeThreatLevel.PACIFIED;
  }
  if (clamped < 60) {
    return TribeThreatLevel.UNSETTLED;
  }
  if (clamped < 80) {
    return TribeThreatLevel.RAIDING;
  }
  return TribeThreatLevel.INVASION;
}

/**
 * 判定武将是否具备镇抚边疆的宿将威慑资格（统帅≥80 且 武力≥75）
 */
export function isBorderWarden(officer?: Officer | null): boolean {
  if (!officer?.stats) return false;
  return (officer.stats.leadership ?? 0) >= 80 && (officer.stats.war ?? 0) >= 75;
}

/**
 * 纯函数：计算异族月度紧张度净变化值（Delta）
 *
 * 影响因子：
 * 1. 威慑平静期：若处于 subdued 状态，张力归零且变化为 0；
 * 2. 基础张力自然演化：+1 点/月；
 * 3. 季节活跃偏转：当季若为该异族活跃季，额外 +2 点；
 * 4. 边塞名将镇守：边境郡城若有统≥80且武≥75之大将出镇，-2 点；
 * 5. 边境重兵慑边：边境总驻军≥15000 则 -1 点；边防空虚（总驻军<4000）则 +2 点；
 * 6. 互市通商平抑：边郡平均商业值≥400 则 -1 点。
 */
export function calculateTribeTensionDelta(params: {
  tribe: MinorityTribe;
  season?: Season;
  borderCities?: City[];
  borderOfficers?: Officer[];
}): number {
  const { tribe, season, borderCities = [], borderOfficers = [] } = params;

  // 1. 若处于讨平威慑期，张力保持零增长
  if (tribe.isSubdued && (tribe.subduedMonths ?? 0) > 0) {
    return 0;
  }

  let delta = 1; // 基础自然波动

  // 2. 季节偏转
  const seasonKey =
    season === Season.SPRING ? 'spring'
    : season === Season.SUMMER ? 'summer'
    : season === Season.AUTUMN ? 'autumn'
    : season === Season.WINTER ? 'winter'
    : undefined;

  if (tribe.activeSeason === 'all') {
    delta += 1; // 山越全年活跃
  } else if (tribe.activeSeason && seasonKey && tribe.activeSeason === seasonKey) {
    delta += 2; // 季节性出塞
  }

  // 3. 宿将镇边压制
  const hasWarden = borderOfficers.some((o) => isBorderWarden(o));
  if (hasWarden) {
    delta -= 2;
  }

  // 4. 边防驻军厚实度
  const totalTroops = borderCities.reduce((sum, c) => sum + (c.troops ?? 0), 0);
  if (totalTroops >= 15000) {
    delta -= 1;
  } else if (totalTroops < 4000 && borderCities.length > 0) {
    delta += 2;
  }

  // 5. 互市通商平抑
  if (borderCities.length > 0) {
    const avgCommerce =
      borderCities.reduce((sum, c) => sum + (c.stats?.commerce ?? 0), 0) / borderCities.length;
    if (avgCommerce >= 400) {
      delta -= 1;
    }
  }

  return delta;
}

/**
 * 校验指定城池是否满足向指定异族借募特色精锐的条件
 */
export function canRecruitTribeTroops(
  city: City,
  tribe: MinorityTribe,
): { canRecruit: boolean; reason?: string } {
  // 必须属于该异族关联的地缘边郡
  if (!tribe.relatedProvinces.includes(city.province)) {
    return {
      canRecruit: false,
      reason: `${city.name} 位于 ${city.province}，非 ${tribe.name} 活跃边郡，不可征募`,
    };
  }

  // 紧张度必须处于顺服档次 (<30)
  if (getTribeThreatLevel(tribe.tension) !== TribeThreatLevel.PACIFIED) {
    return {
      canRecruit: false,
      reason: `${tribe.name} 当前紧张度为 ${tribe.tension}（非羁縻顺服态），边民戒备无法借兵`,
    };
  }

  // 资金检定
  if ((city.gold ?? 0) < TRIBAL_LEVY_COST_GOLD) {
    return {
      canRecruit: false,
      reason: `城池金钱不足 ${TRIBAL_LEVY_COST_GOLD} 贯，无法支付异族募兵安家银`,
    };
  }

  return { canRecruit: true };
}

/**
 * 校验武将是否具备统军出塞讨伐异族的帅才资质
 */
export function canLeadTribeSubjugation(
  officer: Officer,
): { canLead: boolean; reason?: string } {
  const martial = officer.stats?.war ?? 0;
  const command = officer.stats?.leadership ?? 0;

  if (martial < 70 && command < 70) {
    return {
      canLead: false,
      reason: `${officer.name} 统帅(${command})与武力(${martial})皆不足 70，难御荒塞蛮夷之勇`,
    };
  }

  // 创伤检定：重伤或濒死者不可领兵深入
  if ((officer.injury ?? 0) >= 3) {
    return {
      canLead: false,
      reason: `${officer.name} 战创深重，禁止出征行军远涉边陲`,
    };
  }

  return { canLead: true };
}
