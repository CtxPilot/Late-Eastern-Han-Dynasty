// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * Phase 7-05：商路贸易网络、十三州特产与跨国关税经济体系（Trade Routes & Regional Specialties）
 *
 * 核心模型：
 * 1. 十三州特产静态矩阵与异地溢价推导（PROVINCE_SPECIALTIES & calculateSpecialtyPriceMultiplier）
 * 2. 商路贸易路线数据实体（TradeRoute）
 * 3. 季首商税与贸易收益纯函数（calculateTradeRouteQuarterlyIncome）
 * 4. 商路配额校验与筛选纯函数
 */

import { DipRelation } from './enums/index.js';
import type { City } from './types/city.js';
import type { Officer } from './types/officer.js';
import type { DiplomacyLink } from './types/diplomacy.js';

export type TradeRouteStatus = 'active' | 'blockaded' | 'suspended';

export const MAX_TRADE_ROUTES_PER_CITY = 3;
export const TRADE_ROUTE_SETUP_COST = 200;

export interface SpecialtyItem {
  name: string;
  basePrice: number;
  category: 'horse' | 'mineral' | 'craft' | 'luxury' | 'agriculture' | 'herb';
  description: string;
}

/** 十三州史实特产矩阵（docs/04 §2.7） */
export const PROVINCE_SPECIALTIES: Record<string, SpecialtyItem[]> = {
  '幽州': [
    { name: '战马', basePrice: 40, category: 'horse', description: '北疆良驹，筋骨遒劲' },
    { name: '人参', basePrice: 80, category: 'herb', description: '辽东老参，固本培元' },
    { name: '貂皮', basePrice: 60, category: 'luxury', description: '塞外珍皮，御寒华贵' },
  ],
  '并州': [
    { name: '战马', basePrice: 35, category: 'horse', description: '并州铁骑良种' },
    { name: '铁矿', basePrice: 25, category: 'mineral', description: '晋阳富铁，锻兵利器' },
  ],
  '凉州': [
    { name: '良马', basePrice: 50, category: 'horse', description: '西凉大马，天下称雄' },
    { name: '玉石', basePrice: 100, category: 'luxury', description: '昆仑美玉，温润连城' },
    { name: '皮毛', basePrice: 40, category: 'luxury', description: '羌胡毛毡，商路畅销' },
  ],
  '冀州': [
    { name: '铁器', basePrice: 30, category: 'craft', description: '河北精铁用具' },
    { name: '陶器', basePrice: 20, category: 'craft', description: '邢台陶冶精器' },
    { name: '精盐', basePrice: 15, category: 'mineral', description: '渤海煮盐' },
  ],
  '司隶': [
    { name: '绢帛', basePrice: 45, category: 'craft', description: '洛阳织锦，文彩绚烂' },
    { name: '漆器', basePrice: 50, category: 'craft', description: '京畿朱漆器皿' },
    { name: '铜器', basePrice: 40, category: 'craft', description: '鼎尊礼器，商贾贵重' },
  ],
  '兖州': [
    { name: '布帛', basePrice: 25, category: 'craft', description: '东郡细葛布' },
    { name: '兵器', basePrice: 55, category: 'craft', description: '泰山精铸刀剑' },
  ],
  '豫州': [
    { name: '铁具', basePrice: 30, category: 'craft', description: '汝南镔铁犁刀' },
    { name: '布帛', basePrice: 25, category: 'craft', description: '颍川织葛' },
  ],
  '徐州': [
    { name: '海盐', basePrice: 20, category: 'mineral', description: '东海晒盐，晶莹洁白' },
    { name: '精铁', basePrice: 30, category: 'mineral', description: '下邳冶铁' },
    { name: '丝布', basePrice: 20, category: 'craft', description: '淮海丝绵' },
  ],
  '青州': [
    { name: '海盐', basePrice: 18, category: 'mineral', description: '齐地官盐，富商大贾之利' },
    { name: '鱼货', basePrice: 15, category: 'agriculture', description: '渤海干鲜水产' },
    { name: '紫贝', basePrice: 30, category: 'luxury', description: '齐东紫贝饰物' },
  ],
  '荆州': [
    { name: '生漆', basePrice: 35, category: 'craft', description: '南阳楚漆，胶粘光润' },
    { name: '竹器', basePrice: 20, category: 'craft', description: '云梦精编筠篮' },
    { name: '铜矿', basePrice: 30, category: 'mineral', description: '江夏大铜山矿石' },
  ],
  '扬州': [
    { name: '茶叶', basePrice: 40, category: 'agriculture', description: '顾渚紫笋，清冽回甘' },
    { name: '瓷器', basePrice: 45, category: 'craft', description: '越窑青瓷，秘色典雅' },
    { name: '珍珠', basePrice: 80, category: 'luxury', description: '太湖明珠，莹润如月' },
  ],
  '益州': [
    { name: '蜀锦', basePrice: 120, category: 'craft', description: '五彩错杂，锦市绝品，诸葛治蜀倚此充赋' },
    { name: '井盐', basePrice: 25, category: 'mineral', description: '自流深井煮盐' },
    { name: '丹砂', basePrice: 70, category: 'mineral', description: '巴峡丹砂，方士贵之' },
    { name: '药材', basePrice: 50, category: 'herb', description: '川芎当归，道地良药' },
  ],
  '交州': [
    { name: '珍珠', basePrice: 80, category: 'luxury', description: '合浦南珠，天下名珍' },
    { name: '玳瑁', basePrice: 90, category: 'luxury', description: '南洋玄甲，镂刻华簪' },
    { name: '象牙', basePrice: 100, category: 'luxury', description: '交趾灵象长牙' },
    { name: '香料', basePrice: 70, category: 'agriculture', description: '沉香肉桂，异域芬芳' },
  ],
};

/** 商路贸易路线实体 */
export interface TradeRoute {
  id: string; // 唯一商路标识如 "route_1_2"
  fromCityId: number;
  toCityId: number;
  distance: number; // 道路拓扑距离或步数（通常 1~4）
  isWaterWay?: boolean; // 是否经由长江/黄河水运干线（享受 x1.3 加成）
  isCrossFaction: boolean; // 是否跨势力贸易
  factionA: number; // 源城所属势力
  factionB: number; // 宿城所属势力
  status: TradeRouteStatus;
  assignedMerchantOfficerId?: number; // 主管经管文官 ID
  establishedYear: number;
  establishedMonth: number;
}

/**
 * 计算特产异地运销溢价倍率。
 *
 * 史实法则（docs/04 §2.7）：
 * - 同州同地无溢价（1.0）；
 * - 益州蜀锦运出益州：绝品天下竞求，溢价 +80% (1.80)；
 * - 交州异珍（象牙/玳瑁/珍珠/香料）运往北方：异域珍奇，溢价 +70% (1.70)；
 * - 北疆战马（幽/并/凉）运往江南（荆/扬/交）：极南少马，溢价 +60% (1.60)；
 * - 一般物产异地溢价根据拓扑距离递增，保底 +25% (1.25)。
 */
export function calculateSpecialtyPriceMultiplier(
  sourceProvince: string,
  targetProvince: string,
  specialtyName?: string,
): number {
  if (sourceProvince === targetProvince) {
    return 1.0;
  }

  // 益州独有蜀锦
  if (specialtyName === '蜀锦' || sourceProvince === '益州') {
    return 1.8;
  }

  // 交州南洋异珍
  if (
    sourceProvince === '交州' ||
    specialtyName === '象牙' ||
    specialtyName === '玳瑁'
  ) {
    return 1.7;
  }

  // 北马南运
  const northProvinces = ['幽州', '并州', '凉州'];
  const southProvinces = ['荆州', '扬州', '交州'];
  if (northProvinces.includes(sourceProvince) && southProvinces.includes(targetProvince)) {
    return 1.6;
  }

  // 常规跨州物产
  return 1.25;
}

export interface TradeRouteIncomeCalculation {
  totalIncome: number;
  incomeA: number;
  incomeB: number;
  tariffLoss: number;
  isBlockaded: boolean;
  note?: string;
}

/**
 * 纯函数：计算单条商路季度商税与贸易收益（季首结算时调用）。
 *
 * 结合双方商业总额、水陆干线、跨势力关税折损、外交友好度、主管文官才智及特产溢价。
 */
export function calculateTradeRouteQuarterlyIncome(params: {
  route: TradeRoute;
  cityA: City;
  cityB: City;
  diplomacyLink?: DiplomacyLink | null;
  merchantOfficer?: Officer | null;
}): TradeRouteIncomeCalculation {
  const { route, cityA, cityB, diplomacyLink, merchantOfficer } = params;

  // 战时封锁判定
  if (diplomacyLink?.relation === DipRelation.WAR) {
    return {
      totalIncome: 0,
      incomeA: 0,
      incomeB: 0,
      tariffLoss: 0,
      isBlockaded: true,
      note: '两国交战兵戎相见，商路关卡封闭禁运',
    };
  }

  // 1. 基础商贸基数：基于双方商业总额
  const commerceA = cityA.stats?.commerce ?? 100;
  const commerceB = cityB.stats?.commerce ?? 100;
  let baseGross = Math.floor(((commerceA + commerceB) / 200) * 80);
  baseGross = Math.max(30, baseGross);

  // 2. 水路加成（长江/黄河水运干线 x1.3）
  if (route.isWaterWay) {
    baseGross = Math.round(baseGross * 1.3);
  }

  // 3. 特产异地溢价加成
  const multiplier = calculateSpecialtyPriceMultiplier(
    cityA.province ?? '',
    cityB.province ?? '',
  );
  baseGross = Math.round(baseGross * multiplier);

  // 4. 主管文官才德加成
  if (merchantOfficer?.stats) {
    const competence = Math.max(
      merchantOfficer.stats.politics,
      merchantOfficer.stats.intelligence,
    );
    if (competence > 60) {
      const bonusPct = Math.min(30, Math.floor((competence - 60) * 0.5));
      baseGross = Math.round(baseGross * (1 + bonusPct / 100));
    }
  }

  // 5. 跨势力关税分润与友好度恢复
  if (!route.isCrossFaction) {
    // 同势力城际商道：无关税损耗，两城平分
    const half = Math.floor(baseGross / 2);
    return {
      totalIncome: half * 2,
      incomeA: half,
      incomeB: half,
      tariffLoss: 0,
      isBlockaded: false,
      note: '同势力境内商贸流通无阻',
    };
  } else {
    // 跨势力商道：边关关税损耗 30%（即仅余 70% 纯利），友好度每 10 点恢复 1%
    const favor = diplomacyLink?.favorability ?? 0;
    const recoveryRate = Math.min(10, Math.max(0, Math.floor(favor / 10)));
    const effectiveRetention = 0.7 + recoveryRate * 0.01; // [0.70, 0.80]

    const effectiveTotal = Math.round(baseGross * effectiveRetention);
    const tariffLoss = baseGross - effectiveTotal;
    const half = Math.floor(effectiveTotal / 2);

    return {
      totalIncome: half * 2,
      incomeA: half,
      incomeB: half,
      tariffLoss,
      isBlockaded: false,
      note: `跨国商道榷场通商，友好度+${recoveryRate}%通关减税`,
    };
  }
}

/**
 * 筛选指定城池参与的全部商路列表。
 */
export function getCityActiveTradeRoutes(
  routes: TradeRoute[] | undefined,
  cityId: number,
): TradeRoute[] {
  if (!routes) return [];
  return routes.filter(
    (r) => r.fromCityId === cityId || r.toCityId === cityId,
  );
}

/**
 * 校验是否允许在两城之间开辟新商路。
 */
export function canEstablishTradeRoute(
  routes: TradeRoute[] | undefined,
  cityAId: number,
  cityBId: number,
  maxRoutesPerCity: number = 3,
): { allowed: boolean; reason?: string } {
  if (cityAId === cityBId) {
    return { allowed: false, reason: '不能与同一座城池建立商路' };
  }

  const list = routes ?? [];

  // 是否已有商路
  const existing = list.some(
    (r) =>
      (r.fromCityId === cityAId && r.toCityId === cityBId) ||
      (r.fromCityId === cityBId && r.toCityId === cityAId),
  );
  if (existing) {
    return { allowed: false, reason: '两城之间已存在通商商路' };
  }

  // 城池商路容量上限
  const routesA = list.filter((r) => r.fromCityId === cityAId || r.toCityId === cityAId).length;
  if (routesA >= maxRoutesPerCity) {
    return { allowed: false, reason: `城池 ${cityAId} 商路开辟已达上限 (${maxRoutesPerCity})` };
  }

  const routesB = list.filter((r) => r.fromCityId === cityBId || r.toCityId === cityBId).length;
  if (routesB >= maxRoutesPerCity) {
    return { allowed: false, reason: `城池 ${cityBId} 商路开辟已达上限 (${maxRoutesPerCity})` };
  }

  return { allowed: true };
}
