// SPDX-License-Identifier: MIT
// Copyright (c) 2026 CtxPilot

import { OfficerStatus, type GameState } from '@leh/shared';
import { createGame, getGame } from '../services/game.js';
import { buildAnnualBudget } from '../engine/budget.js';
import { developCity, tickDevelopmentProject } from '../engine/civil.js';
import { advanceTurn } from '../engine/turn.js';

let passed = 0;
function check(label: string, condition: unknown): asserts condition {
  if (!condition) throw new Error(`FAIL: ${label}`);
  passed += 1;
  console.log(`PASS ${passed}: ${label}`);
}

createGame(1, 1);
const base = getGame();
const sourceCity = Object.values(base.cities).find((city) => city.ruler === base.playerFactionId);
if (!sourceCity) throw new Error('缺少玩家样本城');
const officerId = sourceCity.officers[0];
if (officerId == null) throw new Error('样本城缺少武将');
const prepared: GameState = {
  ...base,
  cities: { ...base.cities, [sourceCity.id]: { ...sourceCity, gold: 5_000, activeDevelopment: undefined } },
  officers: {
    ...base.officers,
    [officerId]: {
      ...base.officers[officerId]!,
      faction: base.playerFactionId,
      location: sourceCity.id,
      status: OfficerStatus.ACTIVE,
    },
  },
};

let projectState = developCity(prepared, sourceCity.id, 'farm', officerId);
check('农业项目启动仅扣100金首付', projectState.cities[sourceCity.id]!.gold === 4_900);
check('农业项目启动不即时增加开发度', projectState.cities[sourceCity.id]!.stats.farm === sourceCity.stats.farm);
const afterRealMonth = advanceTurn(projectState, () => 0.5);
check('真实月结算推进项目一个月', afterRealMonth.cities[sourceCity.id]!.activeDevelopment?.remainingMonths === 8);
for (let month = 0; month < 9; month += 1) {
  const city = projectState.cities[sourceCity.id]!;
  const result = tickDevelopmentProject(projectState, city);
  projectState = { ...projectState, cities: { ...projectState.cities, [city.id]: result.city } };
}
check('9个月后农业项目完成', projectState.cities[sourceCity.id]!.activeDevelopment == null);
check('完成后农业恰好+100', projectState.cities[sourceCity.id]!.stats.farm === sourceCity.stats.farm + 100);
check('项目总扣款恰好300金', projectState.cities[sourceCity.id]!.gold === 4_700);

let paused = developCity(prepared, sourceCity.id, 'commerce', officerId);
paused = { ...paused, officers: { ...paused.officers, [officerId]: { ...paused.officers[officerId]!, location: null } } };
for (let month = 0; month < 3; month += 1) {
  const city = paused.cities[sourceCity.id]!;
  const result = tickDevelopmentProject(paused, city);
  paused = { ...paused, cities: { ...paused.cities, [city.id]: result.city } };
}
check('暂停第3月进入损失阶段', paused.cities[sourceCity.id]!.activeDevelopment?.pausedMonths === 3);
check('暂停期间不产生免费推进', paused.cities[sourceCity.id]!.activeDevelopment?.remainingMonths === 6);

for (const count of [1, 3, 10]) {
  const ids = new Set(Object.values(base.cities).sort((a, b) => a.id - b.id).slice(0, count).map((city) => city.id));
  const sample: GameState = {
    ...base,
    cities: Object.fromEntries(Object.values(base.cities).map((city) => [
      city.id, { ...city, ruler: ids.has(city.id) ? base.playerFactionId : null, activeDevelopment: undefined },
    ])),
  };
  const budget = buildAnnualBudget(sample, base.playerFactionId);
  check(`${count}城预算覆盖12个月`, budget.months === 12 && budget.cityCount === count);
  check(`${count}城行政成本可解释`, budget.administrativeGold === 30 * count * (count - 1));
  check(`${count}城预算无免费项`, budget.salaryGold === 0 && budget.warLossGold === 0
    && budget.netGold === budget.goldIncome - budget.projectGold - budget.administrativeGold);
}
console.log(`R5 civil project and annual budget verification passed: ${passed}/17`);
