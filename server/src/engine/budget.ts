// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import {
  Season,
  cityFoodNeed,
  laborForce,
  type City,
  type GameState,
} from '@leh/shared';

export interface AnnualBudget {
  factionId: number;
  cityCount: number;
  months: 12;
  goldIncome: number;
  foodProduced: number;
  civilianAndMilitaryFood: number;
  projectGold: number;
  administrativeGold: number;
  salaryGold: 0;
  warLossGold: 0;
  netGold: number;
  netFood: number;
  notes: string[];
}

function fixedMonth(city: City, season: Season): { gold: number; food: number; need: number } {
  const d = city.demographics;
  const total = Math.max(1, city.population);
  const laborFactor = Math.min(1.4, 0.4 + laborForce(d) / total);
  const foodMul =
    season === Season.WINTER ? 0.7 : season === Season.AUTUMN ? 1.25 : season === Season.SPRING ? 1.1 : 1;
  const goldMul = season === Season.WINTER || season === Season.SUMMER ? 1.1 : 1;
  const food = Math.floor(city.stats.farm * 3.2 * laborFactor * foodMul);
  const adultShare = (d.adultMale + d.adultFemale) / total;
  const gold = Math.floor((city.stats.commerce / 9) * (0.7 + adultShare) * goldMul);
  return { gold, food, need: cityFoodNeed(city, season) };
}

/** R5 标准化 12 月预算：只使用现有金粮，不虚构尚未实装的俸禄和战争损失。 */
export function buildAnnualBudget(state: GameState, factionId: number): AnnualBudget {
  const cities = Object.values(state.cities)
    .filter((city) => city.ruler === factionId)
    .sort((a, b) => a.id - b.id);
  let goldIncome = 0;
  let foodProduced = 0;
  let civilianAndMilitaryFood = 0;
  for (const city of cities) {
    for (let month = 1; month <= 12; month += 1) {
      const result = fixedMonth(city, Math.floor((month - 1) / 3) as Season);
      goldIncome += result.gold;
      foodProduced += result.food;
      civilianAndMilitaryFood += result.need;
    }
  }
  const projectGold = cities.reduce(
    (sum, city) =>
      sum + Math.max(0, (city.activeDevelopment?.totalGoldCost ?? 0) - (city.activeDevelopment?.goldPaid ?? 0)),
    0,
  );
  const administrativeGold = cities.reduce((sum, _city, index) => sum + index * 5 * 12, 0);
  return {
    factionId,
    cityCount: cities.length,
    months: 12,
    goldIncome,
    foodProduced,
    civilianAndMilitaryFood,
    projectGold,
    administrativeGold,
    salaryGold: 0,
    warLossGold: 0,
    netGold: goldIncome - projectGold - administrativeGold,
    netFood: foodProduced - civilianAndMilitaryFood,
    notes: [
      '按当前人口、驻军和开发度投影；不预测自然人口变化与随机事件。',
      '俸禄尚未实装，预算列0；战争损失由战役实际发生后入账，基线列0。',
      '行政费：首城0，后续城市按排序每城递增5金/月。',
    ],
  };
}
