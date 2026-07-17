// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

/**
 * 城市人口结构 + 粮耗/劳力 + 自然生育/衰老（04-game-systems §28）
 * 成年男性耗粮显著高于其他群体。
 *
 * 性别比依据（史学常用简化，非逐郡精校）：
 * - 新生儿：约 105 男 : 100 女（近现代生物学亦同；古代亦以略偏男计）
 * - 长成成人：约 112 男 : 100 女 — 参考历代户籍「男口多于女口」
 *   （漏籍、溺女、女孩死亡率偏高等史家解释；明清里甲性别比常见约 110~120）
 *   参见人口史通论中对传统中国户籍性别比的讨论（如葛剑雄等综论）。
 */
import type { Season } from './enums/index.js';
import type { City, CityDemographics } from './types/city.js';

/** 默认开局比例：男成偏高（劳作/征兵社会） */
export const DEFAULT_DEMO_RATIO = {
  adultMale: 0.3,
  adultFemale: 0.27,
  child: 0.29,
  elder: 0.14,
} as const;

/** 新生儿男性占比 ≈ 105/(105+100) */
export const BIRTH_MALE_RATIO = 105 / 205;

/**
 * 儿童长成成人时的男性占比 ≈ 112/(112+100)
 * 高于出生比，体现长至成丁过程中女口损耗/漏计（古代户籍常见男多女少）
 */
export const ADULT_FROM_CHILD_MALE_RATIO = 112 / 212;

/**
 * 每月（1 回合）自然推移率 — 游戏节奏可感，非精确生命表
 * 约：童年 ~10 年入丁、丁年 ~40 年入老、老境 ~12 年故去
 */
export const AGE_RATES = {
  /** 配对生育 → 新生儿入儿童 */
  birthPerCouple: 0.012,
  /** 儿童 → 成人 */
  childToAdult: 0.0085,
  /** 成人 → 老人 */
  adultToElder: 0.0028,
  /** 老人自然死亡（衰老主因） */
  elderDeath: 0.014,
  /** 成人本底死亡（疾病/事故，低于老人） */
  adultDeath: 0.0012,
  /** 儿童本底死亡（高于成人、低于饥荒） */
  childDeath: 0.0025,
} as const;

export interface AgeTickResult {
  next: CityDemographics;
  births: number;
  childToAdult: number;
  adultToElder: number;
  deaths: {
    child: number;
    adultMale: number;
    adultFemale: number;
    elder: number;
    total: number;
  };
}

/**
 * 每季人均粮耗（人×系数，再 × 季节）
 * 标定：~3 万城 + 5k 兵 ≈ 1200~1500 粮/季；成年男显著最高
 */
export const FOOD_EAT: Readonly<Record<keyof CityDemographics, number>> = {
  adultMale: 0.048, // 明显高于其他
  adultFemale: 0.032,
  child: 0.018,
  elder: 0.024,
};

/** 农产劳力权重 */
export const LABOR_WEIGHT: Readonly<Record<keyof CityDemographics, number>> = {
  adultMale: 1.0,
  adultFemale: 0.85,
  child: 0.1,
  elder: 0.35,
};

/** 驻军粮耗（人/季）— 高于普通男成 */
export const TROOP_FOOD_EAT = 0.055;

const SEASON_FOOD_MUL: Record<number, number> = {
  0: 1.0, // 春
  1: 1.05, // 夏
  2: 1.0, // 秋
  3: 1.2, // 冬 — 取暖/枯季
};

export function sumDemographics(d: CityDemographics): number {
  return d.adultMale + d.adultFemale + d.child + d.elder;
}

export function syncPopulation(d: CityDemographics): number {
  return sumDemographics(d);
}

/** 将总人口按比例拆成四桶（总和精确等于 total） */
export function splitDemographics(
  total: number,
  ratio: typeof DEFAULT_DEMO_RATIO = DEFAULT_DEMO_RATIO,
): CityDemographics {
  const t = Math.max(0, Math.floor(total));
  if (t === 0) {
    return { adultMale: 0, adultFemale: 0, child: 0, elder: 0 };
  }
  let adultMale = Math.floor(t * ratio.adultMale);
  let adultFemale = Math.floor(t * ratio.adultFemale);
  let child = Math.floor(t * ratio.child);
  let elder = t - adultMale - adultFemale - child;
  if (elder < 0) {
    // 四舍五入误差：从最大桶扣
    adultMale = Math.max(0, adultMale + elder);
    elder = 0;
  }
  return { adultMale, adultFemale, child, elder };
}

export function ensureDemographics(city: Pick<City, 'population' | 'demographics'>): CityDemographics {
  if (city.demographics && sumDemographics(city.demographics) > 0) {
    return { ...city.demographics };
  }
  return splitDemographics(city.population ?? 0);
}

/**
 * 城潜在可寻次数初值：约每 400 成年女 → 1 次可寻（04§30）
 * 之后只随寻访/抢夺扣减，不每月强制重刷
 */
export const BEAUTY_PER_ADULT_FEMALE = 1 / 400;

/** 开局/扩城时计算 beautySeekLeft */
export function beautySeekLeftFromFemales(adultFemale: number): number {
  return Math.max(0, Math.floor(adultFemale * BEAUTY_PER_ADULT_FEMALE));
}

/** @deprecated 同 beautySeekLeftFromFemales */
export function beautyPoolFromFemales(adultFemale: number): number {
  return beautySeekLeftFromFemales(adultFemale);
}

export function adultFemaleFromBeautyPool(beautyPool: number): number {
  return Math.max(0, Math.floor(beautyPool / BEAUTY_PER_ADULT_FEMALE));
}

/** @deprecated 旧搜罗扣女成；S09 不再扣人口 */
export function adultFemaleCostForBeautyPoints(points: number): number {
  if (points <= 0) return 0;
  return Math.ceil(points / BEAUTY_PER_ADULT_FEMALE);
}

/** 寻访（04§30） */
export const BEAUTY_SEEK = {
  goldCost: 60,
  stockGain: 1,
  seekCost: 1,
  /** 成功率基础（人多略提高） */
  baseSuccess: 0.65,
} as const;

/** 占城抢夺 beauty */
export const BEAUTY_LOOT = {
  gainMin: 2,
  gainMax: 4,
  moraleLossMin: 10,
  moraleLossMax: 20,
} as const;

/** 赏赐 1 点 beauty → 忠诚 */
export const BEAUTY_REWARD = {
  stockCost: 1,
  loyaltyGain: 12,
} as const;

/** @deprecated 旧搜罗常量 */
export const BEAUTY_SEARCH = {
  goldCost: 80,
  poolCost: 1,
  preferLocalNamed: true,
  moraleOnGeneric: 2,
} as const;

export function withSyncedPopulation<
  T extends {
    demographics: CityDemographics;
    population: number;
    beautySeekLeft?: number;
    beautyPool?: number;
  },
>(city: T, d: CityDemographics): T {
  const demographics = {
    adultMale: Math.max(0, Math.floor(d.adultMale)),
    adultFemale: Math.max(0, Math.floor(d.adultFemale)),
    child: Math.max(0, Math.floor(d.child)),
    elder: Math.max(0, Math.floor(d.elder)),
  };
  // 不重算 beautySeekLeft / beautyStock（04§30）
  return {
    ...city,
    demographics,
    population: sumDemographics(demographics),
  };
}

/** 民口季度粮耗（不含驻军） */
export function civilianFoodNeed(d: CityDemographics, season: Season | number = 0): number {
  const mul = SEASON_FOOD_MUL[season as number] ?? 1;
  const raw =
    d.adultMale * FOOD_EAT.adultMale +
    d.adultFemale * FOOD_EAT.adultFemale +
    d.child * FOOD_EAT.child +
    d.elder * FOOD_EAT.elder;
  return Math.floor(raw * mul);
}

/** 驻军粮耗 */
export function troopFoodNeed(troops: number, season: Season | number = 0): number {
  const mul = SEASON_FOOD_MUL[season as number] ?? 1;
  return Math.floor(Math.max(0, troops) * TROOP_FOOD_EAT * mul);
}

/** 城池总粮耗 = 民 + 军 */
export function cityFoodNeed(
  city: Pick<City, 'population' | 'demographics' | 'troops'>,
  season: Season | number = 0,
): number {
  const d = ensureDemographics(city);
  return civilianFoodNeed(d, season) + troopFoodNeed(city.troops ?? 0, season);
}

/** 农业劳力当量 */
export function laborForce(d: CityDemographics): number {
  return (
    d.adultMale * LABOR_WEIGHT.adultMale +
    d.adultFemale * LABOR_WEIGHT.adultFemale +
    d.child * LABOR_WEIGHT.child +
    d.elder * LABOR_WEIGHT.elder
  );
}

/**
 * 可征男丁：保留约 8% 总人口当量的男成劳作底线
 */
export function maxConscriptable(d: CityDemographics): number {
  const reserve = Math.ceil(sumDemographics(d) * 0.08);
  return Math.max(0, d.adultMale - reserve);
}

/**
 * 一回合自然人口：生育(入儿童) → 童亡 → 长成(按历史偏男比) → 衰老入老 → 老死/丁故
 * foodRatio: 1=够吃，&lt;1 饥荒抑制生育并略增死亡；morale 0~100
 */
export function ageDemographicsTick(
  d: CityDemographics,
  opts: {
    season?: Season | number;
    morale?: number;
    foodRatio?: number;
    maxPopulation?: number;
  } = {},
): AgeTickResult {
  const season = opts.season ?? 0;
  const morale = opts.morale ?? 70;
  const foodRatio = Math.min(2, Math.max(0.2, opts.foodRatio ?? 1));
  const cap = opts.maxPopulation ?? 999_999;

  let adultMale = d.adultMale;
  let adultFemale = d.adultFemale;
  let child = d.child;
  let elder = d.elder;

  // —— 1. 生育：只生儿童 ——
  const couples = Math.min(adultMale, adultFemale);
  const seasonBirth =
    season === 0 || season === 1 ? 1.1 : season === 3 ? 0.85 : 1.0; // 春夏旺、冬淡
  const birthMod = foodRatio * (0.55 + morale / 180) * seasonBirth;
  let births = Math.floor(couples * AGE_RATES.birthPerCouple * birthMod);
  // 承载力上限：只挡净增
  const headroom = Math.max(0, cap - (adultMale + adultFemale + child + elder));
  births = Math.min(births, headroom);
  // 新生儿性别（略偏男 105:100），但全部先入儿童桶（不分童男童女，简化）
  child += births;

  // —— 2. 儿童本底死亡 ——
  const childDeathMul = foodRatio < 0.9 ? 1.4 : 1;
  const childDie = Math.min(child, Math.floor(child * AGE_RATES.childDeath * childDeathMul));
  child -= childDie;

  // —— 3. 儿童 → 成人（性别按古代户籍偏男比分配） ——
  const toAdult = Math.min(child, Math.floor(child * AGE_RATES.childToAdult));
  child -= toAdult;
  const toMale = Math.floor(toAdult * ADULT_FROM_CHILD_MALE_RATIO);
  const toFemale = toAdult - toMale;
  adultMale += toMale;
  adultFemale += toFemale;

  // —— 4. 成人本底死亡（男女分计，女口略高：产育风险史观简化） ——
  const adultDieMul = foodRatio < 0.9 ? 1.3 : 1;
  const maleDie = Math.min(
    adultMale,
    Math.floor(adultMale * AGE_RATES.adultDeath * adultDieMul),
  );
  const femaleDie = Math.min(
    adultFemale,
    Math.floor(adultFemale * AGE_RATES.adultDeath * 1.15 * adultDieMul),
  );
  adultMale -= maleDie;
  adultFemale -= femaleDie;

  // —— 5. 成人 → 老人 ——
  const maleToElder = Math.min(adultMale, Math.floor(adultMale * AGE_RATES.adultToElder));
  const femaleToElder = Math.min(
    adultFemale,
    Math.floor(adultFemale * AGE_RATES.adultToElder),
  );
  adultMale -= maleToElder;
  adultFemale -= femaleToElder;
  elder += maleToElder + femaleToElder;

  // —— 6. 老人衰老死亡（自然减员主因） ——
  const elderDieMul = foodRatio < 0.9 ? 1.5 : season === 3 ? 1.2 : 1;
  const elderDie = Math.min(elder, Math.floor(elder * AGE_RATES.elderDeath * elderDieMul));
  elder -= elderDie;

  const next: CityDemographics = {
    adultMale: Math.max(0, adultMale),
    adultFemale: Math.max(0, adultFemale),
    child: Math.max(0, child),
    elder: Math.max(0, elder),
  };

  return {
    next,
    births,
    childToAdult: toAdult,
    adultToElder: maleToElder + femaleToElder,
    deaths: {
      child: childDie,
      adultMale: maleDie,
      adultFemale: femaleDie,
      elder: elderDie,
      total: childDie + maleDie + femaleDie + elderDie,
    },
  };
}

/** 粮耗结构拆解（UI） */
export function foodNeedBreakdown(
  d: CityDemographics,
  troops: number,
  season: Season | number = 0,
): {
  adultMale: number;
  adultFemale: number;
  child: number;
  elder: number;
  troops: number;
  total: number;
} {
  const mul = SEASON_FOOD_MUL[season as number] ?? 1;
  const adultMale = Math.floor(d.adultMale * FOOD_EAT.adultMale * mul);
  const adultFemale = Math.floor(d.adultFemale * FOOD_EAT.adultFemale * mul);
  const child = Math.floor(d.child * FOOD_EAT.child * mul);
  const elder = Math.floor(d.elder * FOOD_EAT.elder * mul);
  const tr = troopFoodNeed(troops, season);
  return {
    adultMale,
    adultFemale,
    child,
    elder,
    troops: tr,
    total: adultMale + adultFemale + child + elder + tr,
  };
}
